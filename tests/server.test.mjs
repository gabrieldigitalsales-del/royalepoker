import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
test("API, WebSocket, carteiras, torneio, recuperação, privacidade e reinício", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mesa-api-")),
    port = 4491,
    url = "http://127.0.0.1:" + port;
  let srv, ws;
  const start = async () => {
    srv = spawn(process.execPath, ["server/start.mjs"], {
      env: {
        ...process.env,
        PORT: port,
        HOST: "127.0.0.1",
        ADMIN_EMAIL: "admin@example.net",
        POKER_ROYALE_ADMIN_CODE: "test-audit-admin-unlock-secret",
        DATA_FILE: join(dir, "game.db"),
      },
      stdio: ["ignore", "pipe", "inherit"],
    });
    await new Promise((ok, no) => {
      srv.stdout.once("data", ok);
      srv.once("exit", (n) => no(Error("Servidor saiu " + n)));
    });
  };
  const stop = async () => {
    if (srv?.exitCode == null && srv?.signalCode == null) {
      const done = new Promise((r) => srv.once("exit", r));
      srv.kill();
      await done;
    }
  };
  async function call(cmd, token = "", body = {}) {
    const res = await fetch(url + "/api", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: JSON.stringify({ ...body, cmd }),
      }),
      d = await res.json();
    if (!res.ok) throw Error(d.error);
    return d;
  }
  try {
    await start();
    const a = await call("register", "", {
        name: "Alpha",
        email: "admin@example.net",
        password: "abcdefgh123",
      }),
      b = await call("register", "", {
        name: "Bravo",
        email: "bravo@example.net",
        password: "abcdefgh123",
      });
    await assert.rejects(call("admin", a.token), /Desbloqueie/);
    await call("adminUnlock", a.token, { password: "test-audit-admin-unlock-secret" });
    assert.equal((await call("adminAuthStatus", a.token)).unlocked, true);
    ws = new WebSocket(url.replace("http", "ws") + "/live");
    await new Promise((ok, no) => {
      ws.once("open", () => ws.send(a.token));
      ws.once("message", ok);
      ws.once("error", no);
    });
    const opt = {
      name: "Mesa do teste",
      game: "texas",
      blind: 10,
      buy: 100,
      capacity: 2,
      seconds: 30,
      timeBank: 10,
      private: true,
    };
    const { id: room } = await call("create", a.token, opt);
    const invite = (await call("room", a.token, { room })).code;
    assert.equal((await call("home", b.token)).rooms.length, 0);
    await assert.rejects(call("room", b.token, { room }));
    await call("rotateInvite", a.token, { room });
    await assert.rejects(call("unlock", b.token, { code: invite }));
    const newCode = (await call("room", a.token, { room })).code;
    await call("unlock", b.token, { code: newCode });
    await assert.rejects(
      call("sit", b.token, { room, position: 0, amount: 125 }),
    );
    await assert.rejects(
      call("sit", b.token, { room, position: 1, amount: 10001 }),
    );
    await call("sit", b.token, { room, position: 1, amount: 125 });
    const entry = await call("room", b.token, { room });
    assert.equal(entry.session.stack, 125);
    assert.equal(entry.seats[1].position, 1);
    const c = await call("register", "", {
      name: "Charlie",
      email: "charlie@example.net",
      password: "abcdefgh123",
    });
    await call("unlock", c.token, { code: newCode });
    await call("waitlist", c.token, { room });
    assert.equal((await call("room", c.token, { room })).queuePosition, 1);
    await call("chat", c.token, { room, text: "Mensagem da arquibancada" });
    assert.equal((await call("room", a.token, { room })).chat.length, 0);
    assert.equal((await call("room", c.token, { room })).chat.length, 1);
    const bravoId = (await call("home", b.token)).me.id;
    await call("cohost", a.token, { room, id: bravoId });
    assert.equal((await call("room", b.token, { room })).canHost, true);
    await call("deal", a.token, { room });
    let r = await call("room", a.token, { room });
    await assert.rejects(
      call("move", a.token, { room, rev: r.rev - 1, action: { type: "pass" } }),
    );
    const id = (await call("home", a.token)).me.id;
    assert.ok(
      r.live.frames[0].hole[r.live.players.findIndex((p) => p.id !== id)].every(
        (x) => x === null,
      ),
    );
    const turn =
      r.live.players[r.live.frames[0].actor].id === id ? a.token : b.token;
    const deadline = r.deadline;
    await call("timeBank", turn, { room });
    await assert.rejects(call("timeBank", turn, { room }));
    r = await call("room", a.token, { room });
    assert.equal(r.deadline, deadline + 10000);
    const sameAction = () =>
      call("move", turn, { room, rev: r.rev, action: { type: "pass" } });
    assert.equal(
      (await Promise.allSettled([sameAction(), sameAction()])).filter(
        (result) => result.status === "fulfilled",
      ).length,
      1,
    );
    r = await call("room", a.token, { room });
    const prior = r.live.id;
    ws.close();
    await stop();
    await start();
    r = await call("room", a.token, { room });
    assert.equal(r.live.id, prior);
    ws = new WebSocket(url.replace("http", "ws") + "/live");
    await new Promise((ok, no) => {
      ws.once("open", () => ws.send(a.token));
      ws.once("message", ok);
      ws.once("error", no);
    });
    const resumed = await call("room", a.token, { room });
    assert.deepEqual(resumed.live, r.live);
    assert.equal(resumed.deadline, r.deadline);
    while (r.live) {
      const f = r.live.frames[0],
        token = r.live.players[f.actor].id === id ? a.token : b.token;
      await call("move", token, { room, rev: r.rev, action: { type: "pass" } });
      r = await call("room", a.token, { room });
    }
    const h = await call("replay", a.token, { hand: r.last });
    assert.deepEqual(h.frames.at(-1), r.lastHand.frames[0]);
    await assert.rejects(call("pauseTable", b.token, { room }));
    await call("pauseTable", a.token, { room });
    const loser = r.lastHand.players.find(
      (p, index) => r.lastHand.frames[0].stacks[index] < p.stack,
    );
    if (loser) {
      const loserToken = loser.id === id ? a.token : b.token;
      const old = (await call("room", loserToken, { room })).session.stack;
      await assert.rejects(
        call("rebuy", loserToken, { room, amount: opt.buy - old - 1 }),
      );
      await assert.rejects(call("rebuy", loserToken, { room, amount: 20000 }));
      await call("rebuy", loserToken, { room, amount: 350 - old });
      const session = (await call("room", loserToken, { room })).session;
      assert.equal(session.stack, 350);
      assert.ok(session.bought > opt.buy);
    }
    const completed = r.history[0];
    assert.equal(completed.participants.length, 2);
    assert.equal(
      completed.participants.reduce((sum, player) => sum + player.net, 0),
      0,
    );
    completed.participants.forEach((player, index) => {
      assert.equal(
        player.net,
        h.frames.at(-1).stacks[index] - h.players[index].stack,
      );
    });
    const ownerWallet = (await call("home", a.token)).me.wallet;
    const guestStack = (await call("room", b.token, { room })).session.stack;
    await assert.rejects(
      call("rebuy", b.token, { room, recipient: id, amount: 10 }),
    );
    await call("rebuy", a.token, {
      room,
      recipient: bravoId,
      amount: 10,
      expectedStack: guestStack,
    });
    assert.equal(
      (await call("room", b.token, { room })).session.stack,
      guestStack + 10,
    );
    assert.equal((await call("home", a.token)).me.wallet, ownerWallet - 10);
    await call("leave", b.token, { room });
    const afterLeaving = (await call("room", a.token, {room})).balances;
    const former = afterLeaving.find(p=>p.id===bravoId);
    assert.equal(former.seated,false);
    assert.equal(former.hands,1);
    assert.equal(former.net,completed.participants.find(p=>p.id===bravoId).net);
    assert.equal(afterLeaving.find(p=>p.id===id).online,true);
    await assert.rejects(call("sit", b.token, { room }));
    await call("sit", c.token, { room });
    assert.equal((await call("room", c.token, { room })).queuePosition, 0);
    await call("leave", c.token, { room });
    await call("close", a.token, { room });
    const wallet = async (tok) => (await call("home", tok)).me.wallet;
    assert.equal((await wallet(a.token)) + (await wallet(b.token)), 20000);
    await assert.rejects(call("admin", b.token));
    assert.equal((await call("admin", a.token)).hands, 1);
    const { id: tour } = await call("tourCreate", a.token, {
      ...opt,
      private: false,
      start: Date.now(),
    });
    await call("enroll", a.token, { tour });
    await call("enroll", b.token, { tour });
    await call("startTour", a.token, { tour });
    const tr = (await call("home", a.token)).rooms.find(
      (r) => r.tour === tour,
    ).id;
    for (let hand = 0; hand < 10; hand++) {
      await call("deal", a.token, { room: tr });
      r = await call("room", a.token, { room: tr });
      while (r.live) {
        let f = r.live.frames[0];
        const tok = r.live.players[f.actor].id === id ? a.token : b.token;
        f = (await call("room", tok, { room: tr })).live.frames[0];
        await call("move", tok, {
          room: tr,
          rev: r.rev,
          action: f.legal.max
            ? { type: "raise", amount: f.legal.max }
            : { type: "pass" },
        });
        r = await call("room", a.token, { room: tr });
      }
      assert.equal(r.lastHand.frames[0].runoutFrom, 0);
      assert.equal(r.lastHand.frames[0].board.length, 5);
      if ((await call("home", a.token)).tours[0].state === "finished") break;
    }
    assert.equal((await call("home", a.token)).tours[0].state, "finished");
    assert.equal((await wallet(a.token)) + (await wallet(b.token)), 20000);
    await assert.rejects(
      call("cashier", b.token, { action: "fund", amount: 100 }),
    );
    const beforeCashier = await wallet(b.token);
    await call("cashier", a.token, { action: "fund", amount: 500 });
    await assert.rejects(
      call("cashier", a.token, { action: "send", id: bravoId, amount: 501 }),
    );
    const payment = {
      action: "send",
      id: bravoId,
      amount: 200,
      reference: "00440044004400440044004400440044",
    };
    await Promise.all([
      call("cashier", a.token, payment),
      call("cashier", a.token, payment),
    ]);
    await assert.rejects(call("cashier", a.token, { ...payment, amount: 201 }));
    await call("cashier", a.token, {
      action: "receive",
      id: bravoId,
      amount: 50,
    });
    assert.equal(await wallet(b.token), beforeCashier + 150);
    const cashier = await call("admin", a.token);
    assert.equal(cashier.clubChips, 350);
    assert.deepEqual(
      cashier.cashier.map((entry) => entry.action),
      ["receive", "send", "fund"],
    );

    const adminBeforeRake = await wallet(a.token);
    const guestWallet = await wallet(b.token);
    const { id: cashRoom } = await call("create", b.token, {
      ...opt,
      name: "Protótipo rake",
      private: false,
      rakeEnabled: true,
    });
    await call("sit", c.token, { room: cashRoom });
    await call("deal", b.token, { room: cashRoom });
    await call("leaveAfterHand", b.token, { room: cashRoom });
    let cash = await call("room", b.token, { room: cashRoom });
    const actorToken =
      cash.live.players[cash.live.frames[0].actor].id === bravoId
        ? b.token
        : c.token;
    const first = {
      room: cashRoom,
      rev: cash.rev,
      requestId: "4ab3ca54-4360-4c04-9872-ef33fe449221",
      action: { type: "raise", amount: 100 },
    };
    assert.equal((await call("move", actorToken, first)).accepted, true);
    assert.equal((await call("move", actorToken, first)).repeated, true);
    assert.ok(!(await call("room", c.token, { room: cashRoom })).moveReceipts);
    cash = await call("room", b.token, { room: cashRoom });
    const other = actorToken === b.token ? c.token : b.token;
    await call("move", other, {
      room: cashRoom,
      rev: cash.rev,
      action: { type: "pass" },
    });
    cash = await call("room", b.token, { room: cashRoom });
    const finalCash = cash.lastHand.frames[0];
    assert.equal(finalCash.rake, 6);
    assert.equal(finalCash.grossPot, 200);
    assert.equal(
      finalCash.stacks.reduce((total, amount) => total + amount, 0),
      194,
    );
    assert.equal(await wallet(a.token), adminBeforeRake + 6);
    assert.equal(
      await wallet(b.token),
      guestWallet -
        100 +
        finalCash.stacks[
          cash.lastHand.players.findIndex((player) => player.id === bravoId)
        ],
    );
    assert.equal(cash.joined, false);
    const adminCash = await call("admin", a.token);
    assert.equal(adminCash.clubChips, 350);
    assert.equal(adminCash.rakeEarned, 6);
    assert.equal(adminCash.rakeHands[0].distributed, 194);
    const ledger = await call("walletHistory", a.token);
    assert.equal(ledger.entries[0].amount, 6);
    assert.equal(ledger.entries[0].balance, adminBeforeRake + 6);
    await assert.rejects(call("buyShop", b.token, { item: "phoenix" }));
    await call("feedback", b.token, { text: "Teste do suporte do clube" });
    assert.ok(
      (await call("admin", a.token)).reports.some((r) =>
        r.text.includes("Teste do suporte"),
      ),
    );
    await assert.rejects(call("stats", b.token, { target: id }));
    await assert.rejects(call("buyShop", b.token, { item: "gold" }));
    const { id: practiceRoom } = await call("create", b.token, {
      ...opt,
      private: false,
      name: "Diamantes",
    });
    const charlie = (await call("home", c.token)).me.id;
    await call("waitlist", c.token, { room: practiceRoom });
    const jpeg = Buffer.from([255,216,255,224,0,16,74,70,73,70,0,255,217]).toString("base64");
    await call("photo",b.token,{jpeg});
    const photoId=(await call("home",b.token)).me.photo;
    const photo=await fetch(url+"/avatar/"+photoId);
    assert.equal(photo.headers.get("content-type"),"image/jpeg");
    assert.deepEqual(Buffer.from(await photo.arrayBuffer()).toString("base64"),jpeg);
    await call("photo",b.token);
    assert.equal((await fetch(url+"/avatar/"+photoId)).status,404);
    const skin = { theme: "lagoon", cards: "night" };
    await call("appearance", b.token, { appearance: skin });
    assert.deepEqual((await call("home", b.token)).me.appearance, skin);
    assert.notDeepEqual((await call("home", c.token)).me.appearance, skin);
    const adminGrant = {
      id: charlie,
      destination: "carteira",
      amount: 200000,
      reference: "aa000000000000000000000000000001",
    };
    const balanceBefore = await wallet(c.token);
    await call("grantChips", a.token, adminGrant);
    assert.equal(await wallet(c.token), balanceBefore + 200000);
    await assert.rejects(call("grantChips", b.token, adminGrant));
    const grant = {
      room: practiceRoom,
      id: charlie,
      destination: "carteira",
      amount: 95,
      reference: "10000000000000000000000000000000",
    };
    const waiting = await wallet(c.token);
    await assert.rejects(call("grantChips", c.token, grant));
    await call("grantChips", b.token, grant);
    await call("grantChips", b.token, grant);
    assert.equal(await wallet(c.token), waiting + 95);
    await call("sit", c.token, { room: practiceRoom });
    for (const [i, who] of [bravoId, charlie].entries())
      await call("grantChips", b.token, {
        ...grant,
        destination: "mesa",
        id: who,
        amount: 800000,
        reference: "1000000000000000000000000000000" + (i + 1),
      });
    await call("deal", b.token, { room: practiceRoom });
    let g = await call("room", b.token, { room: practiceRoom });
    const liveStack = g.live.players.find((p) => p.id === charlie).stack;
    await call("grantChips", b.token, {
      ...grant,
      reference: "bb000000000000000000000000000002",
    });
    assert.equal(
      (await call("room", b.token, { room: practiceRoom })).live.players.find(
        (p) => p.id === charlie,
      ).stack,
      liveStack,
    );
    while (g.live) {
      const f = g.live.frames[0],
        mine = g.live.players[f.actor].id === bravoId;
      const action =
        !f.board.length && Math.max(...f.bets) < 600000
          ? { type: "raise", amount: 600000 }
          : f.board.length && mine
            ? { type: "raise", amount: f.legal.min }
            : f.board.length && Math.max(...f.bets) > f.bets[f.actor]
              ? { type: "fold" }
              : { type: "pass" };
      await call("move", mine ? b.token : c.token, {
        room: practiceRoom,
        rev: g.rev,
        action,
      });
      g = await call("room", b.token, { room: practiceRoom });
    }
    assert.equal((await call("home", b.token)).me.diamonds, 12);
    const beforeShop = await wallet(b.token);
    const diamondsBeforeShop = (await call("home", b.token)).me.diamonds;
    await assert.rejects(call("buyShop", b.token, { item: "gold" }), /em breve/i);
    await assert.rejects(call("buyShop", b.token, { item: "vip" }), /em breve/i);
    const shopper = await call("home", b.token);
    assert.equal(shopper.me.vip, false);
    assert.equal(shopper.me.diamonds, diamondsBeforeShop, "blocked purchases cannot consume diamonds");
    assert.equal(shopper.me.shopAvatar ?? "", "", "blocked items cannot be equipped");
    assert.equal(shopper.me.wallet, beforeShop);
    assert.ok(shopper.progress.hands >= 2);
    assert.ok(shopper.me.notices.some((entry) => entry.message.includes("Saída concluída")));
    await assert.rejects(call("stats", b.token, { target: id }), "VIP statistics require an activated entitlement");

    const reset = await call("recover", "", {
      email: "bravo@example.net",
      password: "abcd1234xyz",
      recovery: b.recovery,
    });
    assert.ok(reset.recovery);
    await assert.rejects(call("home", b.token));
  } finally {
    ws?.terminate();
    await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
