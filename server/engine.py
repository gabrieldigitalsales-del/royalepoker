"""Private JSON-lines worker. Only the trusted Node process supplies checkpoints."""
import sys, json, base64, pickle, secrets
from dataclasses import replace
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'vendor'))
sys.path.insert(0,str(Path(__file__).parent))
import chinese
import pokerkit as pk
import pokerkit.state, pokerkit.utilities
pokerkit.state.shuffle = pokerkit.utilities.shuffle = secrets.SystemRandom().shuffle

begin_showdown = pk.State._begin_showdown

def capture_showdown_pots(state):
    # PokerKit removes mucked hands from its final settlement pots.
    if not hasattr(state, 'mesa_showdown_pots'):
        state.mesa_showdown_pots = [
            dict(amount=pot.amount, eligible=pot.player_indices)
            for pot in state.pots
        ]
    begin_showdown(state)

pk.State._begin_showdown = capture_showdown_pots

# With multiple runouts, retain every showdown hand until ALL boards are
# evaluated. PokerKit can kill a hand that loses every board and collapse all
# awards into a single board-0 push, hiding Run 2/3 settlement in the UI.
original_begin_hand_killing = pk.State._begin_hand_killing
def preserve_multiboard_showdown(state):
    if state.board_count > 1 and sum(state.statuses) > 1:
        state._end_hand_killing()
    else:
        original_begin_hand_killing(state)
pk.State._begin_hand_killing = preserve_multiboard_showdown

class DrawHigh(pk.NoLimitDeuceToSevenLowballSingleDraw):
    hand_types=(pk.StandardHighHand,)
class AceDraw(DrawHigh):
    hand_types=(pk.RegularLowHand,)
class Badacey(pk.FixedLimitDeuceToSevenLowballTripleDraw):
    hand_types=(pk.RegularLowHand,pk.BadugiHand)
class Badeucey(Badacey):
    hand_types=(pk.StandardLowHand,pk.StandardBadugiHand)
class PocketHigh(pk.StandardHighHand):
    @classmethod
    def from_game(cls,hole_cards,board_cards=()):
        return super().from_game(hole_cards)
class Drawmaha(pk.PotLimitOmahaHoldem):
    hole_dealing_count=5
    hand_types=(pk.OmahaHoldemHand,PocketHigh)

def new(q):
    k,b,stacks=q['game'],q['blind'],q['stacks']
    auto=tuple(a for a in pk.Automation if a!=pk.Automation.BOARD_DEALING and (not q.get("runout") or a not in (pk.Automation.RUNOUT_COUNT_SELECTION, pk.Automation.HOLE_CARDS_SHOWING_OR_MUCKING)))
    cucurucho=bool(q.get('cucurucho'))
    if cucurucho and k not in ('texas','om4','om5','om6','om7'):
        raise ValueError('Cucurucho permitido somente em Texas e Omaha High de bordo único.')
    bomb=bool(q.get('bomb')) or cucurucho
    ante = max(1,int(q.get('cucuruchoAnte',b*2))) if cucurucho else max(1,int(q.get('bombAnte',b*2)))
    args=[auto,True,ante if bomb else 0,() if bomb else (b//2,b,2*b) if q.get('straddle') and len(stacks)>=3 and k not in ('stud','stud5','studlo','razz') else (b//2,b)]
    classes={'texas':pk.NoLimitTexasHoldem,'limit':pk.FixedLimitTexasHoldem,'short':pk.NoLimitShortDeckHoldem,'oe':pk.FixedLimitOmahaHoldemHighLowSplitEightOrBetter,'stud':pk.FixedLimitSevenCardStud,'stud5':pk.FixedLimitSevenCardStud,'studlo':pk.FixedLimitSevenCardStudHighLowSplitEightOrBetter,'razz':pk.FixedLimitRazz,'draw':DrawHigh,'single':pk.NoLimitDeuceToSevenLowballSingleDraw,'ace':AceDraw,'triple':pk.FixedLimitDeuceToSevenLowballTripleDraw,'badugi':pk.FixedLimitBadugi,'badacey':Badacey,'badeucey':Badeucey,'pine':pk.NoLimitTexasHoldem,'crazy':pk.NoLimitTexasHoldem,'super':pk.NoLimitTexasHoldem,'watermelon':pk.NoLimitTexasHoldem,'drawmaha':Drawmaha}
    cls=classes.get(k,pk.PotLimitOmahaHoldem)
    if k in ('stud','stud5','studlo','razz'):args[2:4]=[max(1,b//5),max(1,b//2)]
    args.append(b)
    if k in ('limit','oe','stud','stud5','studlo','razz','triple','badugi','badacey','badeucey'):args.append(b*2)
    g=cls(*args,mode=pk.Mode.CASH_GAME if q.get("runout") else pk.Mode.TOURNAMENT,starting_board_count=2 if k in ("om5db","om6db") else 1)
    streets=list(g.streets)
    if k.startswith(('om','cour')) or k in ('pine','crazy','super','watermelon'):
        n=int(k[2]) if k.startswith('om') else 5 if k.startswith('cour') else 4 if k=='watermelon' else 3
        streets[0]=replace(streets[0],hole_dealing_statuses=(False,)*n)
        if k.endswith('lo'):g.hand_types=(pk.OmahaHoldemHand,pk.OmahaEightOrBetterLowHand)
        if k.startswith('cour'):
            streets[0]=replace(streets[0],board_dealing_count=1)
            streets[1]=replace(streets[1],board_dealing_count=2)
    if k=='stud5':
        streets=[replace(streets[0],hole_dealing_statuses=(False,True)),streets[1],streets[2],streets[3]]
    if k=='drawmaha':streets[2]=replace(streets[2],draw_status=True)
    g.streets=tuple(streets)
    s=g(stacks,len(stacks))
    if bomb:
        for _ in range(len(stacks)*2+2):
            if not s.status or s.street_index != 0:break
            if not s.can_check_or_call():break
            s.check_or_call()
    return {'s':s,'k':k,'pending':list(range(len(stacks))) if k=='pine' else [],'marked':set(),'discards':{},
            'cucu':({'phase':'flop','price':s.total_pot_amount,'paid':set()} if cucurucho else None)}

def runout_options(s):
    """Count complete independent remaining boards, including mandatory burns.

    PokerKit has already removed dealt hole/community cards from deck_cards.
    Each run needs the remaining board cards and the burn for each future street.
    """
    remaining = 0
    for street_index in range(s.street_index + 1, len(s.streets)):
        street = s.streets[street_index]
        remaining += street.board_dealing_count * s.board_count
        remaining += int(street.card_burning_status)
    # A runout vote normally occurs between streets. Some PokerKit versions
    # expose the selection within a street; account for pending deal too.
    if remaining <= 0:
        return [1]
    possible = max(1, len(s.deck_cards) // remaining)
    return list(range(1, min(3, possible) + 1))

def advance(h):
    s=h['s']
    while s.can_deal_board() and not h['pending']:
        discard_streets={'crazy':{2},'watermelon':{2,3}}
        marked=h['marked']
        if isinstance(marked,bool):marked=h['marked']={2} if marked else set()
        if s.street_index in discard_streets.get(h['k'],()) and s.street_index not in marked:
            marked.add(s.street_index)
            h['pending']=[i for i,c in enumerate(s.hole_cards) if len(c)>2 and s.statuses[i]]
            if h['pending']:break
        s.deal_board()

def finish_cucurucho(h):
    """After the one mandatory flop decision, run to showdown without more wagers.

    PokerKit remains the sole authority for side pots and payouts.
    """
    s=h['s']; special=h.get('cucu')
    if not special or special['phase']!='runout': return
    for _ in range(100):
        if not s.status: return
        if s.can_deal_board():
            s.deal_board()
            continue
        if s.can_check_or_call():
            s.check_or_call()
            continue
        # Finishing automatically sometimes crosses a showdown/muck boundary.
        if s.can_show_or_muck_hole_cards():
            s.show_or_muck_hole_cards(True)
            continue
        if s.can_select_runout_count():
            s.select_runout_count(1)
            continue
        raise ValueError('Cucurucho: estado do motor não pode avançar sem aposta adicional.')
    raise ValueError('Cucurucho excedeu limite de operações da mão.')

def cards(seq):return [repr(c) for c in seq]

def step(q):
    h=pickle.loads(base64.b64decode(q['state'])) if 'state' in q else None
    if (h or q).get('k',q.get('game')) in ('chinese','ofc','ofcp'):
        h,f=chinese.run(q,h)
        return {'state':None if f['finished'] else base64.b64encode(pickle.dumps(h)).decode(),'frame':f}
    if h is None:h=new(q)
    s=h['s']; act=q.get('action')
    special=h.get('cucu')
    if special:
        advance(h)
        if special['phase']=='flop':
            if not s.status:
                special['phase']='settled'  # todos estavam all-in só com o ante
            else:
                if s.street_index != 1 or len(tuple(s.get_board_cards(0))) != 3:
                    raise ValueError('Cucurucho deve decidir após o flop.')
                special['price']=s.total_pot_amount
                special['phase']='decision'
        if act:
            t=act['type']
            if special['phase']!='decision' or t not in ('cucuStay','fold','timeoutFold'):
                raise ValueError('Somente Ficar & Pagar ou Desistir são válidos no Cucurucho.')
            if t == 'cucuStay':
                price=special['price']; i=s.turn_index
                if i is None or s.stacks[i] < price:
                    raise ValueError('Fichas insuficientes para Ficar & Pagar o pote.')
                if not special['paid']:
                    s.complete_bet_or_raise_to(price)
                else:
                    if not s.can_check_or_call() or s.checking_or_calling_amount != price:
                        raise ValueError('Valor do Cucurucho não corresponde ao pote do flop.')
                    s.check_or_call()
                special['paid'].add(i)
            else:
                original_mode = s.mode
                try:
                    s.mode = pk.Mode.CASH_GAME
                    if not s.can_fold(): raise ValueError('Desistência indisponível.')
                    s.fold()
                finally:
                    s.mode = original_mode
            act=None
            if s.status and s.street_index >= 2: special['phase']='runout'
        if special['phase']=='runout':finish_cucurucho(h)
    if act:
        t=act['type']; picked=act.get('cards',[])
        if h['pending']:
            i=h['pending'][0]
            if t!='draw' or len(picked)!=1:raise ValueError('Descarte uma carta.')
            j=cards(s.hole_cards[i]).index(picked[0])
            prev=h['discards'].get(i,[])
            if isinstance(prev,str):prev=[prev]
            h['discards'][i]=[*prev,picked[0]]
            s.mucked_cards.append(s.hole_cards[i].pop(j));s.hole_card_statuses[i].pop(j)
            h['pending'].pop(0)
        elif t=='draw':s.stand_pat_or_discard(''.join(picked))
        elif t=='pass':s.check_or_call()
        elif t=='fold':s.fold()
        elif t=='runout':
            count=int(act.get('count',1))
            if count not in runout_options(s):raise ValueError('Baralho insuficiente para essa quantidade de corridas.')
            s.select_runout_count(count)
        elif t=='timeoutFold':
            mode = s.mode
            try:
                s.mode = pk.Mode.CASH_GAME
                s.fold()
            finally:
                s.mode = mode
        elif t=='bring':s.post_bring_in()
        elif t=='raise':s.complete_bet_or_raise_to(act['amount'])
        else:raise ValueError('Ação inválida.')
    advance(h)
    # The engine must show every all-in contestant before running multiple
    # boards; default PokerKit automation can muck an otherwise eligible hand
    # before the additional boards are scored.
    if q.get('runout') or s.mode == pk.Mode.CASH_GAME:
        while s.can_show_or_muck_hole_cards():
            s.show_or_muck_hole_cards(True)
    if special and special['phase']=='flop':
        special['phase']='settled' if not s.status else 'decision'
        if s.status: special['price']=s.total_pot_amount
    if special and special['phase']=='runout':finish_cucurucho(h)
    i=h['pending'][0] if h['pending'] else (next(iter(s.runout_count_selector_indices),None) if s.can_select_runout_count() else s.turn_index)
    legal={}
    if special and special['phase']=='decision' and s.status:
        legal={'fold':True}
        if s.stacks[i] >= special['price']:
            legal['cucu']=special['price']
    elif h['pending']:legal={'draw':1,'required':1}
    elif s.can_select_runout_count():legal={'runout':runout_options(s)}
    elif s.can_stand_pat_or_discard():legal={'draw':len(s.hole_cards[i]),'required':0}
    elif s.status:
        if s.can_check_or_call():legal['call']=s.checking_or_calling_amount
        if s.can_fold():legal['fold']=True
        if s.can_post_bring_in():legal['bring']=s.effective_bring_in_amount
        if s.can_complete_bet_or_raise_to():
            legal['min']=s.min_completion_betting_or_raising_to_amount
            legal['max']=s.max_completion_betting_or_raising_to_amount
    exposed=[list(x) for x in s.hole_card_statuses]; hole=[cards(x) for x in s.hole_cards]
    # During an unfinished all-in draw, a future discard is still private.
    if s.status and h['k'] in ('pine','crazy','watermelon','drawmaha'):
        exposed=[[False]*len(cs) for cs in hole]
    dealt=[[] for _ in s.player_indices]
    revealed=set()
    blinds=[0 for _ in s.player_indices]
    for op in s.operations:
        if isinstance(op,pk.BlindOrStraddlePosting):
            blinds[op.player_index]=op.amount
        elif isinstance(op,pk.HoleDealing):
            dealt[op.player_index].extend(cards(op.cards))
        elif isinstance(op,pk.StandingPatOrDiscarding):
            for c in cards(op.cards):dealt[op.player_index].remove(c)
        elif isinstance(op,pk.HoleCardsShowingOrMucking) and op.hole_cards:
            revealed.add(op.player_index)
    if not s.status:
        for j in revealed:
            discards=h['discards'].get(j,[])
            for card in ([discards] if isinstance(discards,str) else discards):
                dealt[j].remove(card)
            hole[j]=dealt[j]
            exposed[j]=[True]*len(hole[j])
        # Preserve *all* players who reached a contested showdown, including
        # losing hands automatically mucked by PokerKit during settlement.
        # This applies to normal cash games, Run It Twice/Three and Cucurucho.
        # Players who folded beforehand are never part of these eligible pots.
        eligible_showdown = set()
        for pot_record in getattr(s, 'mesa_showdown_pots', ()):
            if len(pot_record['eligible']) > 1:
                eligible_showdown.update(pot_record['eligible'])
        for j in eligible_showdown:
            if dealt[j]:
                hole[j] = dealt[j]
                exposed[j] = [True] * len(dealt[j])
    payouts=[sum(op.amounts[j] for op in s.operations if isinstance(op,pk.ChipsPushing)) for j in s.player_indices]
    board = tuple(s.get_board_cards(0))
    boards=[cards(s.get_board_cards(j)) for j in s.board_indices]
    combinations = []
    for pocket in hole:
        labels = []
        if pocket and '??' not in pocket:
            for hand_type in s.hand_types:
                hand = hand_type.from_game_or_none(''.join(pocket), board)
                if hand is not None:
                    labels.append(str(hand).split(' (', 1)[0] if not hand.low else 'Low ' + '-'.join(card.rank.value for card in hand.cards))
        combinations.append(labels)
    awards = []
    # PokerKit can settle a contested showdown through HandKilling and produce a
    # ChipsPushing with hand_type_index=None. That does NOT mean the pot was
    # uncontested. Preserve the actual pot eligibility captured at showdown.
    showdown_pots = getattr(s, 'mesa_showdown_pots', None) or []
    if not s.status:
        for push in s.operations:
            if not isinstance(push, pk.ChipsPushing):
                continue
            winners = []
            for j, amount in enumerate(push.amounts):
                if not amount:
                    continue
                pattern = None
                eligible = showdown_pots[push.pot_index]['eligible'] if push.pot_index < len(showdown_pots) else ()
                contested_showdown = len(eligible) > 1
                if (push.hand_type_index is not None or contested_showdown) and hole[j] and '??' not in hole[j]:
                    hand_type_index = push.hand_type_index if push.hand_type_index is not None else 0
                    hand_type = s.hand_types[hand_type_index]
                    pattern = hand_type.from_game_or_none(''.join(hole[j]), tuple(s.get_board_cards(push.board_index or 0)))
                winners.append(dict(index=j, amount=amount, cards=cards(pattern.cards) if pattern is not None else [], label=(str(pattern).split(' (', 1)[0] if not pattern.low else 'Low ' + '-'.join(card.rank.value for card in pattern.cards)) if pattern is not None else None))
            if winners:
                eligible = showdown_pots[push.pot_index]['eligible'] if push.pot_index < len(showdown_pots) else ()
                actually_contested = len(eligible) > 1
                awards.append(dict(pot=push.pot_index, boardIndex=push.board_index or 0, winners=winners,
                                   uncontested=not actually_contested))
    settled_amounts={}
    for award in awards:
        index=award['pot']
        settled_amounts[index]=settled_amounts.get(index,0)+sum(w['amount'] for w in award['winners'])
    pot_details=[dict(amount=settled_amounts.get(i,p.amount), eligible=p.player_indices) for i,p in enumerate(s._pots if s._pots is not None else s.pots)]
    if not s.status and getattr(s, "mesa_showdown_pots", None):
        pot_details=s.mesa_showdown_pots
    return {'state':base64.b64encode(pickle.dumps(h)).decode() if s.status else None,'frame':dict(actor=i,combinations=combinations,awards=awards,blinds=blinds,legal=legal,stacks=s.stacks,bets=s.bets,pot=s.total_pot_amount,pots=list(s.pot_amounts),potDetails=pot_details,cucurucho=bool(special),cucuruchoPrice=special['price'] if special else None,cucuruchoPhase=special['phase'] if special else None,cucuruchoAccepted=sorted(special['paid']) if special else [],board=cards(s.get_board_cards(0)),boards=boards,runoutCount=s.runout_count or 1,hole=hole,public=exposed,active=s.statuses,finished=not s.status,payouts=payouts,street=s.street_index)}

if __name__=='__main__':
    for line in sys.stdin:
        try:print(json.dumps(step(json.loads(line))),flush=True)
        except Exception as e: print(json.dumps({'error':str(e)}),flush=True)
