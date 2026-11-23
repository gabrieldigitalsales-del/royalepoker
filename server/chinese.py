"""Chinese poker with independent points. Royalties are settled per opponent."""
import secrets,itertools
RANK='23456789TJQKA'
def strength(cs):
    values=sorted((RANK.index(c[0])+2 for c in cs),reverse=True)
    groups=sorted(((values.count(v),v) for v in set(values)),reverse=True)
    shape=[n for n,v in groups]
    straight=0
    if len(cs)==5 and len(set(values))==5:
        straight=values[0] if values[0]-values[-1]==4 else 5 if values==[14,5,4,3,2] else 0
    flush=len(cs)==5 and len({c[1] for c in cs})==1
    cat=8 if straight and flush else 7 if shape[0]==4 else 6 if shape==[3,2] else 5 if flush else 4 if straight else 3 if shape[0]==3 else 2 if shape[:2]==[2,2] else 1 if shape[0]==2 else 0
    return (cat,straight) if cat in (4,8) else (cat,*(v for n,v in groups))
def royalty(line,s):
    k,v=s[:2]
    if line==0:return max(0,v-5) if k==1 else v+8 if k==3 else 0
    back={4:2,5:4,6:6,7:10,8:25 if v==14 else 15}.get(k,0)
    return back if line==2 else (2 if k==3 else back*2)
def start(q):
    d=[r+s for r in RANK for s in 'cdhs'];secrets.SystemRandom().shuffle(d)
    n=len(q['stacks']); k=q['game']; fantasy=q.get('fantasy',[False]*n)
    return dict(k=k,deck=d,rows=[[[],[],[]] for _ in range(n)],hands=[[] for _ in range(n)],fantasy=fantasy,round=0,i=0,stacks=q['stacks'],done=False,pay=[0]*n,nextFantasy=[False]*n)
def deal(h):
    i=h['i'];k=h['k']
    count=13 if k=='chinese' else 14 if h['fantasy'][i] else 5 if h['round']==0 else 3 if k=='ofcp' else 1
    h['hands'][i]=[h['deck'].pop() for _ in range(count)]
def score(h):
    lines=[[strength(row) for row in p] for p in h['rows']]
    fouls=[not(a<=b<=c) for a,b,c in lines]
    royalties=[sum(royalty(i,s) for i,s in enumerate(p)) for p in lines]
    for i,j in itertools.combinations(range(len(lines)),2):
        if fouls[i] and fouls[j]:continue
        if fouls[i]:points=-6-royalties[j]
        elif fouls[j]:points=6+royalties[i]
        else:
            wins=sum((a>b)-(a<b) for a,b in zip(lines[i],lines[j]))
            points=(wins*2 if abs(wins)==3 else wins)+royalties[i]-royalties[j]
        h['pay'][i]+=points;h['pay'][j]-=points
    for i,(a,b,c) in enumerate(lines):
        h['nextFantasy'][i]=h['k']!='chinese' and not fouls[i] and ((a[0]==3 or b[0]>=6 or c[0]>=7) if h['fantasy'][i] else (a>=(1,12)))
    h['fouls']=fouls;h['done']=True
def assign(h,assignments):
    i=h['i']; hand=h['hands'][i]; rows=h['rows'][i]
    discard=1 if h['fantasy'][i] or (h['k']=='ofcp' and h['round']>0) else 0
    if len(hand)!=len(assignments) or assignments.count(-1)!=discard or any(type(v)!=int or v not in (-1,0,1,2) for v in assignments):raise ValueError('Distribuição inválida.')
    for j,cap in enumerate([3,5,5]):
        if len(rows[j])+assignments.count(j)>cap:raise ValueError('Linha cheia.')
    for c,j in zip(hand,assignments):
        if j>=0:rows[j].append(c)
    h['hands'][i]=[]
    for off in range(1,len(h['rows'])+1):
        nxt=(i+off)%len(h['rows'])
        if nxt<=i and off==len(h['rows'])-i:h['round']+=1
        if sum(map(len,h['rows'][nxt]))<13:
            h['i']=nxt;deal(h);return
    score(h)
def run(q,h=None):
    if h is None:h=start(q);deal(h)
    else:
        if q['action']['type']!='place':raise ValueError('Monte as linhas.')
        assign(h,q['action']['lines'])
    n=len(h['rows']);i=h['i'];done=h['done']
    return h,dict(actor=None if done else i,legal={} if done else {'place':True,'discard':int(h['fantasy'][i] or (h['k']=='ofcp' and h['round']>0))},stacks=h['stacks'],bets=[0]*n,pot=0,pots=[],board=[],hole=h['hands'],public=[[False]*len(c) for c in h['hands']],active=[True]*n,finished=done,payouts=h['pay'],street=h['round'],rows=h['rows'],hiddenRows=[not done and (h['k']=='chinese' or f) for f in h['fantasy']],nextFantasy=h['nextFantasy'],fouls=h.get('fouls',[]))
