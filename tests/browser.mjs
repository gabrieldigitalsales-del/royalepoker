import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
const temp = mkdtempSync(join(tmpdir(), "mesa-e2e-")),
  port = process.env.TEST_PORT || 4281,
  url = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["server/local.mjs"], {
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: port,
    DATA_FILE: join(temp, "test.sqlite"),
  },
  stdio: ["ignore", "pipe", "inherit"],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("exit", (code) => reject(Error("Servidor " + code)));
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN || undefined,
    args: ["--no-sandbox"],
  });
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 1318, height: 930 } }),
    browser.newContext({ viewport: { width: 390, height: 844 } }),
  ]);
  const [a, b] = await Promise.all(contexts.map((c) => c.newPage()));
  const flights = new Set();
  for (const p of [a, b]) {
    await p.exposeFunction("recordChipFlight", (kind) => flights.add(kind));
    await p.addInitScript(() =>
      new MutationObserver((records) => {
        for (const item of records)
          for (const el of item.addedNodes)
            if (el.nodeType === 1 && el.dataset?.flight)
              window.recordChipFlight(el.dataset.flight);
      }).observe(document, { childList: true, subtree: true }),
    );
  }
  const errors = [];
  for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
  async function register(page, n) {
    await page.goto(url);
    await page.getByRole("button", { name: "Criar uma conta" }).click();
    await page.getByLabel("Apelido").fill("Teste " + n);
    await page.getByLabel("E-mail").fill(n + "@example.com");
    await page.getByLabel("Senha", { exact: true }).fill("Teste-12345");
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Guardei, entrar no clube" })
      .click();
    await page.getByRole("heading", { name: "Lobby de mesas" }).waitFor();
  }
  await register(a, "um");
  await register(b, "dois");
  const request = (p, cmd, more = {}) =>
    p.evaluate(
      async ({ cmd, more }) => {
        const r = await fetch("/api", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + localStorage.mesaToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cmd, ...more }),
        });
        const d = await r.json();
        if (d.error) throw Error(d.error);
        return d;
      },
      { cmd, more },
    );
  const mine = (await request(a, "home")).me.id;
  for (const game of ["texas", "om4", "draw"]) {
    await a.goto(url);
    await a.getByRole("button", { name: "Criar mesa", exact: true }).click();
    const modal = a.getByRole("dialog");
    await modal
      .getByRole("button", { name: "Texas Hold’em", exact: true })
      .click();
    await modal.getByLabel("Nome", { exact: true }).fill("Mesa " + game);
    await modal.getByLabel("Modalidade").selectOption(game);
    await modal
      .getByRole("button", { name: "Criar mesa", exact: true })
      .click();
    await a.waitForURL("**/mesa/**");
    const room = a.url().split("/").at(-1);
    await b.goto(url);
    const roomCard = b
      .locator(".club-room-open")
      .filter({ hasText: "Mesa " + game });
    await roomCard.getByText("1/6 jogando", { exact: true }).waitFor();
    await roomCard.getByText(/Fila 0/).waitFor();
    await roomCard.click();
    await b.getByRole("button", { name: "Sentar à mesa" }).click();
    const entry = b.getByRole("dialog", { name: "Sentar na mesa" });
    await entry.getByRole("button", { name: "3", exact: true }).click();
    await entry.getByLabel("Fichas para entrar").fill("1500");
    await entry.getByRole("button", { name: "Confirmar entrada" }).click();
    await entry.waitFor({ state: "hidden" });
    const seated = await request(b, "room", { room });
    assert.equal(seated.session.stack, 1500);
    assert.equal(seated.seats.find((seat) => seat.id !== mine).position, 2);
    if (game === "texas") {
      await b.getByRole("button", { name: "Mais opções" }).click();
      await b.getByRole("button", { name: "Visual", exact: true }).click();
      const visual = b.getByRole("dialog", { name: "Visual da mesa" });
      await visual.getByRole("button", { name: "Orbital · azul" }).click();
      await visual.getByLabel("Estilo das cartas").selectOption("ivory");
      assert.equal(
        await b.locator("html").getAttribute("data-card-style"),
        "ivory",
      );
      assert.equal(
        await b.locator(".studio").getAttribute("data-table-theme"),
        "blue",
      );
      await visual.getByLabel("Estilo das cartas").selectOption("vivid");
      await visual.getByRole("button", { name: "Fechar", exact: true }).click();
    }
    await a.getByRole("button", { name: "Iniciar mesa" }).click();
    let turns = 0;
    for (;;) {
      const r = await request(a, "room", { room });
      if (!r.live) {
        assert.ok(r.lastHand);
        break;
      }
      const f = r.live.frames[0],
        p = r.live.players[f.actor].id === mine ? a : b;
      if (++turns === 3) await p.reload();
      if (turns === 1) {
        for (const page of [a, b]) {
          const table = page.getByLabel("Mesa de poker", { exact: true });
          const cards = page.locator(".player-hand .card");
          await table.waitFor({ state: "visible" });
          await cards.first().waitFor({ state: "visible" });
          assert.equal(
            await cards.count(),
            game === "texas" ? 2 : game === "om4" ? 4 : 5,
          );
          await cards.first().evaluate((el) =>
            Promise.all(
              el
                .closest(".player-hand")
                .getAnimations({ subtree: true })
                .map((animation) => animation.finished.catch(() => {})),
            ),
          );
          const boardBox = await table.boundingBox(),
            cardBox = await cards.first().boundingBox();
          assert.ok(boardBox.width > boardBox.height, "Feltro na horizontal");
          for (const stack of await page
            .locator(".portrait-seat .stackplate")
            .all()) {
            const bounds = await stack.boundingBox();
            assert.ok(
              bounds &&
                bounds.y >= boardBox.y &&
                bounds.y + bounds.height <= boardBox.y + boardBox.height,
              "Saldo totalmente dentro do palco.",
            );
          }
          const actionsBox = await page
            .locator(".studio .actions")
            .boundingBox();
          assert.ok(
            cardBox.y >= boardBox.y + boardBox.height && cardBox.width >= 36,
          );
          assert.ok(actionsBox.y >= cardBox.y + cardBox.height);
          assert.ok(
            actionsBox.y + actionsBox.height <= page.viewportSize().height,
          );
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollHeight <= innerHeight,
            ),
          );
        }
      }
      if (turns === 1 && game === "texas") {
        await p.getByRole("button", { name: "Mais opções" }).click();
        await p
          .getByRole("button", { name: "+ Adicionar fichas", exact: true })
          .click();
        const chips = p.getByRole("dialog");
        await chips
          .getByText("Aguarde o fim da mão para adicionar fichas.")
          .waitFor();
        assert.equal(
          await chips
            .getByRole("button", { name: "Confirmar reposição" })
            .isDisabled(),
          true,
        );
        await chips
          .getByRole("button", { name: "Fechar", exact: true })
          .click();
        await p
          .getByRole("button", { name: "Mais opções", exact: true })
          .click();
        await p
          .getByRole("dialog")
          .getByRole("button", { name: "Minha sessão", exact: true })
          .click();
        await p
          .getByRole("heading", { name: "Minha sessão", exact: true })
          .waitFor();
        await p
          .getByRole("dialog")
          .getByRole("button", { name: "Fechar", exact: true })
          .click();
        const waiting = p === a ? b : a;
        const pre = waiting
          .getByRole("group", { name: "Pré-ação da próxima vez" })
          .getByRole("button", { name: "Passar", exact: true });
        await pre.click();
        assert.equal(await pre.getAttribute("aria-pressed"), "true");
        await pre.click();
        assert.equal(await pre.getAttribute("aria-pressed"), "false");
        const raise = p.getByRole("button", { name: /^(RAISE|BET)$/ });
        await raise.click();
        const sizing = p.locator(".bet-popover");
        await sizing.getByRole("button", { name: /Confirmar/ }).waitFor();
        await raise.click();
        const legal = (await request(p, "room", { room })).live.frames[0].legal;
        const expected = Math.max(
          legal.min,
          Math.min(legal.max, Math.max(...f.bets) * 2 || legal.min * 2),
        );
        assert.equal(
          await sizing.getByLabel("Valor total").inputValue(),
          String(expected),
        );
        await sizing.getByRole("button", { name: "Aumentar aposta" }).click();
        await sizing
          .getByRole("button", { name: "Fechar", exact: true })
          .click();
        await sizing.waitFor({ state: "hidden" });
      }
      const action = p
        .getByRole("button", { name: /^(CHECK|CALL|Manter todas)/ })
        .first();
      await action.click();
      await p.waitForFunction(
        async ({ room, rev }) => {
          const d = await fetch("/api", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + localStorage.mesaToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ cmd: "room", room }),
          }).then((r) => r.json());
          return d.rev > rev;
        },
        { room, rev: r.rev },
      );
      assert.ok(turns < 40);
    }
    const r = await request(a, "room", { room });
    if (process.env.TABLE_SCREENSHOT && game === "texas")
      await a.screenshot({ path: process.env.TABLE_SCREENSHOT });
    await a.getByRole("button", { name: "Resultado de Teste dois" }).click();
    const playerDialog = a.getByRole("dialog");
    await playerDialog.getByText("1 mãos concluídas nesta mesa").waitFor();
    for (const text of ["Ganhou", "Perdeu", "Saldo"])
      await playerDialog.getByText(text, { exact: true }).waitFor();
    await playerDialog.getByRole("button", { name: "Fechar" }).click();
    await a.getByRole("button", { name: "Mais opções" }).click();
    await a.getByRole("button", { name: "Ver resultado", exact: true }).click();
    const awardDialog = a.getByRole("dialog");
    await awardDialog
      .getByRole("heading", { name: "Pote principal" })
      .waitFor();
    await awardDialog
      .getByRole("button", { name: "Fechar", exact: true })
      .click();
    const tableUrl = a.url();
    await a.getByRole("button", { name: "Mais opções" }).click();
    await a.getByRole("button", { name: "Histórico", exact: true }).click();
    const historyRow = a.locator(".table-history li").first();
    await historyRow.getByText("Mão #1", { exact: true }).waitFor();
    const winners = r.lastHand.players
      .filter((_, index) => r.lastHand.frames.at(-1).payouts[index] > 0)
      .map((player) => player.name);
    assert.equal(
      await historyRow.locator("summary strong").textContent(),
      winners.join(", "),
    );
    await historyRow.locator("summary").click();
    await historyRow.getByText(/Seu saldo na mão/).waitFor();
    assert.equal(a.url(), tableUrl);
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "Fechar", exact: true })
      .click();
    const replay = await request(a, "replay", { hand: r.last });
    assert.deepEqual(replay.frames.at(-1), r.lastHand.frames.at(-1));
    if (game === "texas") {
      await a.getByRole("button", { name: "Pausar mesa", exact: true }).click();
      await a
        .getByRole("button", { name: "Retomar mesa", exact: true })
        .waitFor();
      await a
        .getByRole("button", { name: "Retomar mesa", exact: true })
        .click();
      const second = (await request(a, "room", { room })).live;
      assert.notEqual(second.button, r.lastHand.button);
      const frame = second.frames.at(-1);
      assert.equal(
        frame.blinds[second.players.findIndex((p) => p.id === second.button)],
        second.blind / 2,
      );
      assert.equal(
        frame.blinds[second.players.findIndex((p) => p.id !== second.button)],
        second.blind,
      );
      const acting = second.players[frame.actor].id === mine ? a : b;
      await acting
        .getByRole("button", { name: "Desistir", exact: true })
        .click();
      await a.waitForFunction(
        async (room) => {
          const res = await fetch("/api", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + localStorage.mesaToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ cmd: "room", room }),
          });
          return (await res.json()).live?.number === 3;
        },
        room,
        { timeout: 14000 },
      );
    }
    console.log("Dois navegadores, reconexão e replay:", game);
  }
  const full = await request(a, "create", {
    name: "Mesa cheia",
    game: "texas",
    capacity: 10,
    seconds: 30,
    buy: 100,
    blind: 10,
  });
  const extra = await Promise.all(
    Array.from({ length: 8 }, () => browser.newContext()),
  );
  const guests = await Promise.all(
    extra.map(async (context, j) => {
      const account = await context.request.post(url + "/api", {
        data: {
          cmd: "register",
          name: "Convidado " + j,
          email: "guest" + j + "@example.com",
          password: "Teste-12345",
        },
      });
      const { token } = await account.json();
      assert.ok(token);
      await context.addInitScript(
        (token) => localStorage.setItem("mesaToken", token),
        token,
      );
      const page = await context.newPage();
      await page.goto(url + "/mesa/" + full.id);
      return page;
    }),
  );
  const players = [a, b, ...guests];
  await b.goto(url + "/mesa/" + full.id);
  await Promise.all(
    players.slice(1).map((page) => request(page, "sit", { room: full.id })),
  );
  await a.goto(url + "/mesa/" + full.id);
  await a.getByRole("button", { name: "Iniciar mesa" }).click();
  await Promise.all(
    players.map((page) => page.locator(".portrait-seat").nth(9).waitFor()),
  );
  await Promise.all(
    players.map(async (page) => {
      const mine = (await request(page, "home")).me.id;
      const seat = page.locator(
        '.portrait-seat[data-player-id="' + mine + '"]',
      );
      assert.equal(await seat.evaluate((element) => element.style.left), "50%");
      assert.ok(
        parseFloat(await seat.evaluate((element) => element.style.top)) > 80,
      );
    }),
  );
  await a.locator(".turn-clock").waitFor();
  const before = (await request(a, "room", { room: full.id })).live.id;
  await guests[0].reload();
  await guests[0].locator(".player-hand .card").first().waitFor();
  assert.equal(
    (await request(guests[0], "room", { room: full.id })).live.id,
    before,
  );
  await request(guests[1], "away", { room: full.id }).then(
    () => assert.fail("pausa durante a mão"),
    () => {},
  );
  await Promise.all(extra.map((context) => context.close()));
  console.log("Dez sessões, relógio no avatar e reconexão da mão confirmados.");
  await a.goto(url + "/historico");
  await a
    .getByRole("button", { name: /Five Card Draw/ })
    .first()
    .click();
  await a.getByRole("dialog").getByRole("button", { name: "Avançar" }).click();
  await a
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  assert.equal(
    await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  assert.deepEqual([...flights].sort(), ["award", "bet", "blind", "collect"]);
  console.log(
    "Fichas observadas no DOM: blinds, apostas, recolhimento e pagamento.",
  );
  assert.deepEqual(errors, []);
  console.log("Histórico visual e largura mobile aprovados.");
} finally {
  await browser?.close();
  server.kill();
  await new Promise((r) => setTimeout(r, 300));
  rmSync(temp, { recursive: true, force: true });
}
