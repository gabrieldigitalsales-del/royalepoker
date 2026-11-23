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
  let db, pg;
  if (remote) {
    const { Client } = await import("pg");
    pg = new Client({ connectionString: process.env.DATABASE_URL });
    await pg.connect();
    // Render PostgreSQL does not automatically receive the old Supabase migrations.
    // Only this trusted server accesses mesa_private through DATABASE_URL.
    await pg.query(`
      CREATE SCHEMA IF NOT EXISTS mesa_private;
      CREATE TABLE IF NOT EXISTS mesa_private.records (
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        body JSONB NOT NULL,
        PRIMARY KEY(kind,id)
      );
      CREATE TABLE IF NOT EXISTS public.mesa_lobby_clock (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        revision BIGINT NOT NULL DEFAULT 0
      );
      INSERT INTO public.mesa_lobby_clock (id, revision)
      VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
    `);
    const lock = await pg.query(
      "select pg_try_advisory_lock(872510416) as acquired",
    );
    if (!lock.rows[0].acquired)
      throw Error("Outro servidor já controla este clube.");
  } else {
    mkdirSync(dirname(path), { recursive: true });
    db = new DatabaseSync(path);
    db.exec(
      "PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS records(kind TEXT,id TEXT,body TEXT NOT NULL,PRIMARY KEY(kind,id))",
    );
  }
  const rows = remote
    ? (await pg.query("select kind,id,body from mesa_private.records")).rows
    : db.prepare("select * from records").all();
  let data = Object.fromEntries(groups.map((g) => [g, {}]));
  for (const r of rows)
    data[r.kind][r.id] =
      typeof r.body === "string" ? JSON.parse(r.body) : r.body;
  return {
    get value() {
      return data;
    },
    async commit(next, reason) {
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
                "delete from mesa_private.records where kind=$1 and id=$2",
                [k, id],
              );
            else
              await pg.query(
                "insert into mesa_private.records values($1,$2,$3) on conflict(kind,id) do update set body=excluded.body",
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
            "update public.mesa_lobby_clock set revision=revision+1 where id=1",
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
