import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/PortraitBoard.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/poker-royale-board-system.css', import.meta.url), 'utf8');

test('one authoritative multiple board stylesheet loaded last', () => {
  // Older layout contract assumed two imports were last. The current
  // layout authority is the final multi-board stylesheet; subsequent imports
  // own card artwork, not community-board coordinates.
  const boardAuthority = main.indexOf('import "./royale-double-board-final.css";');
  assert.ok(boardAuthority > main.indexOf('import "./poker-royale-board-system.css";'));
  assert.ok(boardAuthority > main.indexOf('import "./poker-royale-mobile-orientation.css";'));
  const finalLayout = readFileSync(new URL('../src/royale-double-board-final.css',import.meta.url),'utf8');
  assert.match(finalLayout,/SINGLE LAYOUT AUTHORITY/);
  assert.match(finalLayout,/royale-multiple-boards/);
  for (const obsolete of ['multi-board-layout', 'centered-boards', 'visible-boards', 'runout-final', 'board-fixes']) {
    assert.doesNotMatch(main, new RegExp('import.*poker-royale-' + obsolete + '\\.css'));
  }
  assert.match(css,/royale-boards-3/);
  assert.match(css,/royale-board-cluster/);
  assert.match(css,/flex-direction:column/);
});

test('opponent public showdown cards rendered at table level above avatars', () => {
  assert.match(source,/const publicOpponentHands/);
  assert.match(source,/className="royale-opponent-showdown-cards"/);
  assert.match(source,/publicOpponentHands\.map/);
  assert.match(css,/z-index:65!important/);
  assert.match(css,/has-public-showdown \.pocket/);
});

test('board rows remain separate with no giant multi-board zoom transform', () => {
  assert.match(source,/extra-runout-boards/);
  assert.match(source,/royale-board-row/);
  assert.match(css,/royale-community-h/);
  assert.doesNotMatch(css,/scale\(\.5\)/);
});
