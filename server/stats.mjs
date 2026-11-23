const ratio = (n, d) => (d ? Math.round((100 * n) / d) : null);
export function statistics(hands, id) {
  let vpip = 0,
    pfr = 0,
    preflops = 0,
    three = 0,
    opps = 0,
    raises = 0,
    calls = 0,
    cbetOpportunities = 0,
    cbets = 0,
    show = 0,
    showwins = 0,
    saw = 0,
    streak = 0,
    longest = 0,
    largest = 0;
  const gameCounts = {};
  let handsCount = 0;
  const sessions = [],
    days = {},
    weeks = {},
    months = {};
  for (const h of hands.toSorted((a, b) => a.started - b.started)) {
    const i = h.players.findIndex((p) => p.id === id),
      last = h.frames.at(-1);
    if (i < 0 || h.tour || last.rows) continue;
    handsCount++;
    gameCounts[h.game] = (gameCounts[h.game] ?? 0) + 1;
    const net = last.stacks[i] - h.players[i].stack;
    const community =
      ["texas", "limit", "short", "pine", "crazy", "oe", "drawmaha"].includes(
        h.game,
      ) || /^(om|cour)/.test(h.game);
    let preflopAggressor = null;
    let flopOpportunity = false;
    let flopContinuation = false;
    let didV = false,
      didP = false,
      can3 = false,
      did3 = false,
      raiseCount = 0,
      sawFlop = false,
      fold = false,
      otherFolds = 0;
    for (let j = 1; j < h.frames.length; j++) {
      const f = h.frames[j],
        before = h.frames[j - 1],
        mine = f.by === id,
        pre = before.street === 0;
      if (mine && f.action === "raise") raises++;
      if (mine && f.action === "pass" && before.legal.call > 0) calls++;
      if (mine && f.action === "fold") fold = true;
      // A continuation bet requires the last preflop aggressor to make
      // the first bet on the flop when no one has bet before them.
      if (community && pre && f.action === "raise") preflopAggressor = f.by;
      if (community && before.street === 1 && mine && preflopAggressor === id && !flopOpportunity && !fold) {
        if (before.legal && (before.legal.min != null || before.legal.call != null)) {
          flopOpportunity = true;
          flopContinuation = f.action === "raise" && (before.legal.call ?? 0) === 0;
        }
      }
      if (!mine && f.action === "fold") otherFolds++;
      if (community && pre) {
        if (mine && raiseCount === 1 && before.legal.min != null) can3 = true;
        if (mine && f.action === "raise") {
          didP = true;
          didV = true;
          if (raiseCount === 1) did3 = true;
        }
        if (mine && f.action === "pass" && before.legal.call > 0) didV = true;
        if (f.action === "raise") raiseCount++;
      }
      if (community && !fold && f.board.length >= 3) sawFlop = true;
    }
    if (community) {
      preflops++;
      cbetOpportunities += +flopOpportunity;
      cbets += +flopContinuation;
      vpip += +didV;
      pfr += +didP;
      opps += +can3;
      three += +did3;
      if (sawFlop) {
        saw++;
        if (!fold && otherFolds < h.players.length - 1) {
          show++;
          showwins += +(last.payouts[i] > 0);
        }
      }
    }
    streak = last.payouts[i] > 0 ? streak + 1 : 0;
    longest = Math.max(streak, longest);
    largest = Math.max(largest, last.payouts[i]);
    const lastSession = sessions.at(-1);
    if (lastSession && h.started - lastSession.end < 30 * 60000) {
      lastSession.end = Math.max(h.ended, lastSession.end);
      lastSession.net += net;
      lastSession.hands++;
    } else sessions.push({ start: h.started, end: h.ended, net, hands: 1 });
    const day = new Date(h.ended).toISOString().slice(0, 10),
      m = day.slice(0, 7),
      w = new Date(day + "T00:00Z");
    w.setUTCDate(w.getUTCDate() - ((w.getUTCDay() + 6) % 7));
    const wk = w.toISOString().slice(0, 10);
    days[day] = (days[day] || 0) + net;
    weeks[wk] = (weeks[wk] || 0) + net;
    months[m] = (months[m] || 0) + net;
  }
  return {
    handsCount,
    favoriteGame: Object.keys(gameCounts).sort((a,b) => gameCounts[b]-gameCounts[a])[0] ?? null,
    vpip: ratio(vpip, preflops),
    pfr: ratio(pfr, preflops),
    cbet: ratio(cbets, cbetOpportunities),
    three: ratio(three, opps),
    af: calls ? +(raises / calls).toFixed(2) : null,
    wtsd: ratio(show, saw),
    wsd: ratio(showwins, show),
    longest,
    largest,
    sessions: sessions.reverse(),
    days,
    weeks,
    months,
  };
}
