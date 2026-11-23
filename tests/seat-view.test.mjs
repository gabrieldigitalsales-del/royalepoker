import assert from "node:assert/strict";
import test from "node:test";
import { seatPerspective } from "../src/seat-view.mjs";

test("cada assento pode centralizar a mesa mantendo a ordem e as vagas", () => {
  for (let capacity = 2; capacity <= 10; capacity++) {
    for (let viewer = 0; viewer < capacity; viewer++) {
      const view = seatPerspective(capacity, viewer);
      assert.equal(view.visual(viewer), 0);
      assert.equal(view.visual((viewer + 1) % capacity), 1);
      for (let physical = 0; physical < capacity; physical++) {
        assert.equal(view.physical(view.visual(physical)), physical);
      }
    }
  }
  assert.equal(seatPerspective(10, 7).visual(0), 3);
  assert.equal(seatPerspective(10, 0).visual(7), 7);
});
