import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
test("Regras determinísticas de High, Hi-Lo, Short Deck, OFC e Fantasyland", () => {
  const code = `
from engine import pk
from chinese import strength, royalty, score
# Board royal flush, but an Omaha player must use exactly two hole cards.
assert pk.OmahaHoldemHand.from_game('2c3h4d5s','TsJsQsKsAs') < pk.OmahaHoldemHand.from_game('9s8s4c5h','TsJsQsKsAs')
assert pk.OmahaEightOrBetterLowHand.from_game_or_none('Ac2dJsQh','KhKsTc9d8c') is None
assert pk.ShortDeckHoldemHand.from_game('6s8sTsQsAs') > pk.ShortDeckHoldemHand.from_game('6s6d6h7c7d')
assert pk.BadugiHand.from_game('Ac2s3h4d') > pk.BadugiHand.from_game('2h3d4c5s')
assert strength(['As','2c','3d','4h','5s']) == (4,5)
assert royalty(0,strength(['Qs','Qd','2s'])) == 7
h={'rows':[[['Qs','Qd','2s'],['3s','3c','3d','4s','5c'],['6s','7s','8s','9s','Ts']],[['2d','3c','5s'],['4h','4c','7s','9d','Tc'],['6d','6h','6c','8d','Ac']]],'pay':[0,0],'k':'ofc','fantasy':[False,False],'nextFantasy':[False,False]}
score(h)
assert h['pay']==[30,-30], h
assert h['nextFantasy']==[True,False]
h['rows'][0][0]=['As','Ac','Ad'];h['rows'][0][1]=['2c','2d','4c','6s','9d'];h['pay']=[0,0];score(h)
assert h['fouls'][0] and not h['nextFantasy'][0] and sum(h['pay'])==0
`;
  const commands = process.env.PYTHON
    ? [[process.env.PYTHON]]
    : process.platform === "win32"
      ? [["py", "-3"], ["python"]]
      : [["python3"], ["python"]];
  let result;
  for (const [exe, ...args] of commands) {
    result = spawnSync(exe, [...args, "-B", "-c", code], {
      cwd: "server",
      encoding: "utf8",
    });
    if (!result.error) break;
  }
  assert.equal(result.status, 0, result.stderr);
});
