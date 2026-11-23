import { recordWallets } from "./cash-updates.mjs";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
const groups = [
  "users",
  "sessions",
  "rooms",
  "hands",
  "events",
  "cashier",
  "tours",
  "reports",
];
export async function storage() {
  const path = process.env.DATA_FILE || "data/mesa.sqlite";
  const remote = !!process.env.DATABASE_URL;
  let db, pg, ownsLock = true;
  if (remote) {
    const { Client } = await import("pg");
    pg = new Client({ connectionString: process.env.DATABASE_URL });
    await pg.connect();
    // The private schema and its tables are provisioned by Supabase migrations.
    // The restricted runtime role must not attempt CREATE SCHEMA/TABLE.
    await pg.query(
      "INSERT INTO pokeroyale_private.pokeroyale_lobby_clock (id, revision) VALUES (1, 0) ON CONFLICT (id) DO NOTHING",
    );
    // During a zero-downtime deploy the old instance legitimately holds
    // the session advisory lock. Start the replacement in standby mode;
    // Render can health-check it and drain the old instance, then the new
    // instance acquires the lock and reloads the authoritative state.
    const lock = await pg.query(
      "select pg_try_advisory_lock(872510426) as acquired",
    );
    ownsLock = !!lock.rows[0].acquired;
  } else {
    mkdirSync(dirname(path), { recursive: true });
    db = new DatabaseSync(path);
    db.exec(
      "PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS records(kind TEXT,id TEXT,body TEXT NOT NULL,PRIMARY KEY(kind,id))",
    );
  }
  async function loadData() {
    const rows = remote
      ? (await pg.query("select kind,id,body from pokeroyale_private.pokeroyale_records")).rows
      : db.prepare("select * from records").all();
    const result = Object.fromEntries(groups.map((g) => [g, {}]));
    for (const r of rows)
      result[r.kind][r.id] =
        typeof r.body === "string" ? JSON.parse(r.body) : r.body;
    return result;
  }
  let data = await loadData();
  if (remote && !ownsLock) {
    let checking = false;
    const poll = setInterval(async () => {
      if (ownsLock || checking) return;
      checking = true;
      try {
        const lock = await pg.query("select pg_try_advisory_lock(872510426) as acquired");
        if (lock.rows[0].acquired) {
          data = await loadData();
          ownsLock = true;
          clearInterval(poll);
          console.log("Poker Royale assumiu a instância ativa com dados atualizados.");
        }
      } catch (error) {
        console.error("Aguardando bloqueio exclusivo:", error.message);
      } finally {
        checking = false;
      }
    }, 1000);
    poll.unref();
    console.log("Poker Royale em standby; aguardando saída da instância anterior.");
  }
  return {
    get active() {
      return ownsLock;
    },
    get value() {
      return data;
    },
    async commit(next, reason) {
      if (!ownsLock) throw Error("Servidor em atualização; tente novamente.");
      recordWallets(data, next, reason);
      const changes = [];
      for (const k of groups)
        for (const id of new Set([
          ...Object.keys(data[k]),
          ...Object.keys(next[k]),
        ])) {
          const before = JSON.stringify(data[k][id]),
            after = JSON.stringify(next[k][id]);
          if (before !== after) changes.push([k, id, after]);
        }
      if (!changes.length) return;
      if (remote) await pg.query("begin");
      else db.exec("BEGIN");
      try {
        for (const [k, id, v] of changes) {
          if (remote) {
            if (v === undefined)
              await pg.query(
                "delete from pokeroyale_private.pokeroyale_records where kind=$1 and id=$2",
                [k, id],
              );
            else
              await pg.query(
                "insert into pokeroyale_private.pokeroyale_records values($1,$2,$3) on conflict(kind,id) do update set body=excluded.body",
                [k, id, v],
              );
          } else if (v === undefined)
            db.prepare("delete from records where kind=? and id=?").run(k, id);
          else
            db.prepare(
              "insert into records values(?,?,?) on conflict(kind,id) do update set body=excluded.body",
            ).run(k, id, v);
        }
        if (
          remote &&
          changes.some(([kind]) => kind === "rooms" || kind === "tours")
        )
          await pg.query(
            "update pokeroyale_private.pokeroyale_lobby_clock set revision=revision+1 where id=1",
          );
        if (remote) await pg.query("commit");
        else db.exec("COMMIT");
        data = next;
      } catch (e) {
        if (remote) await pg.query("rollback");
        else db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
