import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { catalog } from "../server/catalog.mjs";
test("33 opções no servidor: mão completa, autorização, revisão e replay fiel", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mesa-catalog-")),
    port = 4493,
    base = "http://127.0.0.1:" + port;
  const server = spawn(process.execPath, ["server/start.mjs"], {
    env: {
      ...process.env,
      PORT: port,
      HOST: "127.0.0.1",
      DATA_FILE: join(dir, "mesa.sqlite"),
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  try {
    await new Promise((ok, no) => {
      server.stdout.once("data", ok);
      server.once("exit", (n) => no(Error("Servidor " + n)));
    });
    const call = async (cmd, token = "", body = {}) => {
      const r = await fetch(base + "/api", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ ...body, cmd }),
        }),
        j = await r.json();
      if (!r.ok) throw Error(j.error);
      return j;
    };
    const tokens = [];
    for (const name of ["JogadorA", "JogadorB"])
      tokens.push(
        (
          await call("register", "", {
            name,
            email: name + "@example.net",
            password: "teste-1234",
          })
        ).token,
      );
    const [a, b] = tokens,
      id = (await call("home", a)).me.id;
    for (const g of Object.values(catalog)) {
      const { id: room } = await call("create", a, {
        name: "Teste " + g.name.slice(0, 20),
        game: g.id,
        capacity: 2,
        seconds: 30,
        buy: 100,
        blind: 10,
        rotation: ["texas", "draw"],
      });
      await call("sit", b, { room });
      await call("deal", a, { room });
      if (g.id === "choice") {
        await assert.rejects(call("chooseNext", b, { room, choice: "texas" }));
        await call("chooseNext", a, { room, choice: "texas" });
        assert.equal((await call("room", a, { room })).live.game, "texas");
      }
      let r = await call("room", a, { room }),
        turns = 0;
      await assert.rejects(
        call("move", a, { room, rev: r.rev, action: { type: "unknown" } }),
      );
      const first = r.live.frames[0];
      while (r.live) {
        const i = r.live.frames[0].actor,
          tok = r.live.players[i].id === id ? a : b,
          other = tok === a ? b : a;
        if (turns === 0)
          await assert.rejects(
            call("move", other, { room, rev: r.rev, action: { type: "pass" } }),
          );
        const f = (await call("room", tok, { room })).live.frames[0],
          l = f.legal;
        let action;
        if (l.place) {
          const space = [3, 5, 5].map((v, j) => v - f.rows[i][j].length),
            lines = [];
          for (let j = 0; j < f.hole[i].length - l.discard; j++) {
            const at = space.findIndex((x) => x > 0);
            space[at]--;
            lines.push(at);
          }
          if (l.discard) lines.push(-1);
          action = { type: "place", lines };
        } else if ("draw" in l)
          action = {
            type: "draw",
            cards: f.hole[i].slice(0, Math.max(1, l.required)),
          };
        else action = { type: "bring" in l ? "bring" : "pass" };
        const rev = r.rev;
        await call("move", tok, { room, rev, action });
        if (turns === 0)
          await assert.rejects(call("move", tok, { room, rev, action }));
        r = await call("room", a, { room });
        assert.ok(++turns < 100);
      }
      const replay = await call("replay", a, { hand: r.last });
      assert.deepEqual(replay.frames[0], first);
      assert.deepEqual(replay.frames.at(-1), r.lastHand.frames[0]);
      assert.equal(replay.frames.length, turns + 1);
      await call("close", a, { room });
    }
    assert.equal(
      (await call("home", a)).history.length,
      Object.keys(catalog).length,
    );
  } finally {
    const done = new Promise((r) => server.once("exit", r));
    server.kill();
    await done;
    rmSync(dir, { recursive: true, force: true });
  }
});
