import { PhotoEditor, Grant, Face } from "./PlayerIdentity";
import { exportCsv } from "./export-csv";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Heart, UserRound, Search } from "lucide-react";
import { api, refresh, useApp, fail, num, date } from "./api";
import { Modal, Field, Empty, Card } from "./ui";
import { Create, Invite } from "./Lobby";
import { Replay } from "./Table";
const change = async (cmd, b = {}) => {
  try {
    await api(cmd, b);
    await refresh();
  } catch (e) {
    fail(e);
  }
};
export function History() {
  const h = useApp((s) => s.home),
    [k, K] = useState(""),
    [scope, S] = useState(""),
    [id, I] = useState(""),
    [onlySaved, setOnlySaved] = useState(false),
    [saved, setSaved] = useState<string[]>(() =>
      JSON.parse(localStorage.getItem("mesa-hands") || "[]"),
    );
  function toggleSaved(id: string) {
    const next = saved.includes(id)
      ? saved.filter((key) => key !== id)
      : [...saved, id];
    localStorage.setItem("mesa-hands", JSON.stringify(next));
    setSaved(next);
  }
  const rows = h.history.filter(
      (r) =>
        (!onlySaved || saved.includes(r.id)) &&
        (!k || r.game === k) &&
        (!scope || (scope === "torneio" ? r.tour : !r.tour)),
    ),
    cash = rows.filter((r) => !r.points && !r.tour);
  const [stats, Stats] = useState<any>(),
    [period, Period] = useState("days");
  useEffect(() => {
    let active = true;
    api("stats", { game: k })
      .then((s) => {
        if (active) Stats(s);
      })
      .catch(fail);
    return () => {
      active = false;
    };
  }, [k, h.history.length]);
  const pnl = cash.reduce((n, r) => n + r.net, 0),
    best = Math.max(0, ...cash.map((r) => r.payout));
  let balance = 0;
  const chart = cash
    .slice(0, 30)
    .reverse()
    .map((r) => (balance += r.net));
  const lo = Math.min(0, ...chart),
    hi = Math.max(1, ...chart);
  return (
    <>
      <h1>Histórico de mãos</h1>
      <div className="row">
        <select value={k} onChange={(e) => K(e.target.value)}>
          <option value="">Todas as modalidades</option>
          {h.catalog.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select value={scope} onChange={(e) => S(e.target.value)}>
          <option value="">Todas as partidas</option>
          <option value="mesa">Mesas</option>
          <option value="torneio">Torneios</option>
        </select>
      </div>
      <details className="history-stats">
        <summary>Estatísticas</summary>
        <div className="overview">
          {[
            [rows.length, "Mãos jogadas"],
            [
              rows.length
                ? Math.round(
                    (100 * rows.filter((r) => r.won).length) / rows.length,
                  ) + "%"
                : "—",
              "Mãos com premiação",
            ],
            [num(pnl), "Resultado em fichas"],
          ].map(([v, l]) => (
            <div key={l}>
              <strong>{v}</strong>
              <span>{l}</span>
            </div>
          ))}
        </div>
        {chart.length > 0 && (
          <div className="panel">
            <h2>Evolução das fichas</h2>
            <small>
              Resultado acumulado nas últimas {chart.length} mãos de mesa ·
              maior prêmio: {num(best)} fichas
            </small>
            <svg
              role="img"
              aria-label="Evolução acumulada das fichas"
              viewBox="0 0 600 100"
              width="100%"
              height="100"
            >
              <polyline
                stroke="#d9be85"
                fill="none"
                strokeWidth="3"
                points={[0, ...chart]
                  .map(
                    (v, i) =>
                      10 +
                      (580 * i) / chart.length +
                      "," +
                      (90 - (80 * (v - lo)) / (hi - lo)),
                  )
                  .join(" ")}
              />
            </svg>
          </div>
        )}
        {stats && scope !== "torneio" && (
          <details className="panel">
            <summary>Estatísticas avançadas de mesa</summary>
            <div className="variants">
              {[
                ["VPIP", stats.vpip],
                ["PFR", stats.pfr],
                ["3-Bet", stats.three],
                ["WTSD", stats.wtsd],
                ["W$SD", stats.wsd],
              ].map(([name, v]) => (
                <p key={name}>
                  {name} <b>{v == null ? "—" : v + "%"}</b>
                </p>
              ))}
            </div>
            <p>
              Fator de agressão: {stats.af ?? "—"} · Maior sequência premiada:{" "}
              {stats.longest}
            </p>
            <small>
              VPIP, PFR e 3-Bet usam mãos com cartas comunitárias. WTSD usa mãos
              que chegaram ao flop. Um traço indica ausência de oportunidades.
            </small>
            <h2>Sessões</h2>
            {stats.sessions.slice(0, 20).map((s) => (
              <p key={s.start}>
                {date(s.start)} · {s.hands} mãos ·{" "}
                {Math.max(1, Math.round((s.end - s.start) / 60000))} min ·{" "}
                {num(s.net)} fichas
              </p>
            ))}
            <select value={period} onChange={(e) => Period(e.target.value)}>
              <option value="days">Por dia</option>
              <option value="weeks">Por semana</option>
              <option value="months">Por mês</option>
            </select>
            {Object.entries(stats[period])
              .reverse()
              .slice(0, 15)
              .map(([key, v]: any) => (
                <p key={key}>
                  {key} · {num(v)} fichas
                </p>
              ))}
          </details>
        )}
      </details>
      <label className="row">
        <input
          type="checkbox"
          checked={onlySaved}
          onChange={(e) => setOnlySaved(e.target.checked)}
        />{" "}
        Só mãos favoritas
      </label>
      <section className="club-hand-list">
        <h2>Últimas 100 mãos jogadas</h2>
        {rows.length ? (
          rows.slice(0, 100).map((r) => (
            <article key={r.id} className="club-hand-row">
              <button className="club-hand-open" onClick={() => I(r.id)}>
                <span className="club-hand-cards">
                  {r.cards
                    ?.filter(Boolean)
                    .slice(0, 7)
                    .map((card, index) => (
                      <Card c={card} key={index} />
                    ))}
                </span>
                <span className="club-hand-details">
                  <b>{h.catalog.find((g) => g.id === r.game)?.name}</b>
                  <small>
                    {date(r.ended)} · {r.name}
                  </small>
                  <small>
                    {r.winners?.join(", ")}
                    {r.diamonds > 0 && (
                      <b className="diamond-prize"> ◆ +{r.diamonds}</b>
                    )}
                  </small>
                  {!r.points && r.blind > 0 && (
                    <small>
                      Blinds {num(r.blind / 2)} / {num(r.blind)}
                    </small>
                  )}
                </span>
                <strong
                  data-balance={
                    r.net < 0 ? "loss" : r.net > 0 ? "gain" : "even"
                  }
                >
                  {(r.grossNet ?? r.net) > 0 ? "+" : ""}
                  {num(r.grossNet ?? r.net)}
                  {r.points ? " pts" : ""}
                </strong>
              </button>
              <button
                className="club-hand-save"
                aria-label={
                  saved.includes(r.id)
                    ? "Remover mão dos favoritos"
                    : "Favoritar mão"
                }
                aria-pressed={saved.includes(r.id)}
                onClick={() => toggleSaved(r.id)}
              >
                <Heart
                  size={22}
                  fill={saved.includes(r.id) ? "currentColor" : "none"}
                />
              </button>
            </article>
          ))
        ) : (
          <Empty>As mãos concluídas aparecem aqui para você rever.</Empty>
        )}
      </section>
      {id && (
        <Replay
          hand={id}
          close={() => {
            I("");
            setSaved(JSON.parse(localStorage.getItem("mesa-hands") || "[]"));
          }}
        />
      )}
    </>
  );
}
export function Tours() {
  const h = useApp((s) => s.home),
    [open, O] = useState(false),
    nav = useNavigate();
  return (
    <>
      <div className="section">
        <h1>Torneios</h1>
        <button className="primary" onClick={() => O(true)}>
          <Plus /> Criar torneio
        </button>
      </div>
      {!h.tours.length && <Empty>Nenhum torneio agendado.</Empty>}
      <div className="variants">
        {h.tours.map((t) => (
          <div key={t.id} className="panel">
            <div className="kicker">
              {
                {
                  open: "Inscrições abertas",
                  playing: "Em andamento",
                  finished: "Encerrado",
                }[t.state]
              }
            </div>
            <h2>{t.name}</h2>
            <p>
              {h.catalog.find((g) => g.id === t.game)?.name} · {date(t.start)}
            </p>
            <p>
              {t.entries.length} inscritos · Entrada {num(t.buy)} · Prêmio{" "}
              {num(t.entries.length * t.buy)}
            </p>
            {t.state === "open" && (
              <div className="row">
                <button
                  onClick={() =>
                    change(
                      t.entries.includes(h.me.id) ? "withdraw" : "enroll",
                      { tour: t.id },
                    )
                  }
                >
                  {t.entries.includes(h.me.id)
                    ? "Cancelar inscrição"
                    : "Inscrever-se"}
                </button>
                {t.owner === h.me.id && (
                  <button onClick={() => change("startTour", { tour: t.id })}>
                    Iniciar torneio
                  </button>
                )}
              </div>
            )}
            {t.state === "playing" &&
              h.rooms
                .filter((r) => r.tour === t.id)
                .map((r) => (
                  <button key={r.id} onClick={() => nav("/mesa/" + r.id)}>
                    {r.name}
                  </button>
                ))}
            {t.ranking && (
              <ol>
                {t.ranking.map((id) => (
                  <li key={id}>{h.people.find((p) => p.id === id)?.name}</li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
      {open && <Create tour close={() => O(false)} />}
    </>
  );
}
export function People() {
  const h = useApp((s) => s.home),
    [code, C] = useState(""),
    [report, R] = useState(""),
    [statsPlayer, setStatsPlayer] = useState<any>();
  async function viewStats(player) {
    try {
      const stats = await api("stats", { target: player.id });
      setStatsPlayer({ name: player.name, stats });
    } catch (error) {
      fail(error);
    }
  }
  return (
    <>
      <h1>Jogadores</h1>
      {!!h.me.invites.length && (
        <div className="panel">
          <h2>Seus convites</h2>
          {h.me.invites.map((i) => (
            <button key={i.room} onClick={() => C(i.code)}>
              {i.from} · {i.name}
            </button>
          ))}
        </div>
      )}
      <div className="section">
        <h2>Ranking de fichas</h2>
        <span>{h.people.length} jogadores</span>
      </div>
      <div className="list">
        {[...h.people]
          .sort((a, b) => b.chips - a.chips)
          .map((p, i) => (
            <div className="listitem" key={p.id}>
              <b className="rank">{i + 1}</b>
              <span>
                <b>
                  <Face player={p} />
                  {p.name}
                </b>
                <small>
                  {p.online ? "Online" : "Offline"} · {num(p.chips)} fichas
                </small>
              </span>
              {p.id !== h.me.id && (
                <div className="row end">
                  <button onClick={() => change("friend", { id: p.id })}>
                    {h.me.friends.includes(p.id) ? "Favorito ✓" : "Favoritar"}
                  </button>
                  <button onClick={() => change("block", { id: p.id })}>
                    {h.me.blocked.includes(p.id) ? "Desbloquear" : "Bloquear"}
                  </button>
                  {h.me.vip && (
                    <button onClick={() => viewStats(p)}>Estatísticas</button>
                  )}
                  <button onClick={() => R(p.id)}>Denunciar</button>
                </div>
              )}
            </div>
          ))}
      </div>
      {code && <Invite code={code} close={() => C("")} />}
      {statsPlayer && (
        <Modal
          title={"Estatísticas de " + statsPlayer.name}
          close={() => setStatsPlayer(undefined)}
        >
          <dl className="shop-stats">
            {[
              ["VPIP", "vpip"],
              ["PFR", "pfr"],
              ["3-Bet", "three"],
              ["Foi ao showdown", "wtsd"],
              ["Vitórias no showdown", "wsd"],
            ].map(([label, key]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  {statsPlayer.stats[key] == null
                    ? "—"
                    : statsPlayer.stats[key] + "%"}
                </dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
      {report && (
        <Modal close={() => R("")} title="Denunciar jogador">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              change("report", {
                id: report,
                text: new FormData(e.currentTarget).get("text"),
              });
              R("");
            }}
          >
            <Field title="Motivo">
              <textarea minLength={3} required name="text" />
            </Field>
            <button>Enviar denúncia</button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Profile() {
  const home = useApp((s) => s.home),
    u = home.me,
    [saved, S] = useState(false);
  return (
    <>
      <h1>Meu perfil</h1>
      <PhotoEditor player={u} />
      <section className="panel shop-panel">
        <div className="section">
          <h2>Nível {home.progress.level}</h2>
          <b>{u.vip ? "VIP" : num(home.progress.hands) + " mãos"}</b>
        </div>
        <progress
          aria-label="Progresso de nível"
          value={home.progress.hands % 10}
          max={10}
        />
        <small>
          Próximo nível em {home.progress.next - home.progress.hands} mãos de
          cash game
        </small>
        <h2>Loja de diamantes</h2>
        <small>Itens especiais e recompensas do clube. Os resgates estarão disponíveis em breve.</small>
        <p className="diamond-prize">◆ {num(u.diamonds)} diamantes</p>
        <div className="shop-grid royale-coming-soon-shop" aria-label="Loja de diamantes — em breve">
          {home.shop.avatars.map((item) => (
            <div key={item.id} className="royale-locked-shop-item" aria-disabled="true">
              <span className="royale-locked-shop-symbol">{item.symbol}</span>
              <strong>{item.name}</strong>
              <span className="royale-coming-soon-mark" aria-label="Em breve">EM BREVE</span>
            </div>
          ))}
          <div className="royale-locked-shop-item" aria-disabled="true">
            <span className="royale-locked-shop-symbol">♦</span>
            <strong>VIP</strong>
            <span className="royale-coming-soon-mark" aria-label="Em breve">EM BREVE</span>
          </div>
        </div>
        <small>Os diamantes continuam sendo acumulados; os itens permanecem indisponíveis até o lançamento da loja.</small>
        {u.shopAvatar && (
          <button type="button" onClick={() => change("equipAvatar", { item: "" })}>
            Voltar ao avatar pessoal
          </button>
        )}
      </section>
      <form
        className="panel narrow"
        onChange={() => S(false)}
        onSubmit={async (e) => {
          e.preventDefault();
          const b = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await api("profile", {
              name: b.name,
              avatar: b.avatar,
              preferences: {
                felt: b.felt,
                mute: !!b.mute,
                bb: !!b.bb,
                motion: !!b.motion,
                largeCards: !!b.largeCards,
                shortcuts: String(b.shortcuts || "fcr").toLowerCase(),
                back: b.back,
                chip: b.chip,
                face: b.face,
                theme: b.theme,
                volume: Number(b.turnVolume),
                speed: b.speed,
                chatMuted: !!b.chatMuted,
                confirmAllIn: !!b.confirmAllIn,
                turnVolume: Number(b.turnVolume),
                chipVolume: Number(b.chipVolume),
                handVolume: Number(b.handVolume),
              },
            });
            await refresh();
            S(true);
          } catch (e) {
            fail(e);
          }
        }}
      >
        <Field title="Apelido">
          <input name="name" defaultValue={u.name} required minLength={2} />
        </Field>
        <Field title="Iniciais do avatar">
          <input
            name="avatar"
            maxLength={4}
            defaultValue={u.customAvatar ?? u.avatar}
          />
        </Field>
        <Field title="Atalhos · desistir, passar/pagar e aumentar">
          <input
            name="shortcuts"
            pattern="off|[a-zA-Z]{3}"
            maxLength={3}
            defaultValue={u.preferences.shortcuts || "fcr"}
          />
          <small>
            Escolha três letras diferentes na ordem acima ou digite off para
            desligar.
          </small>
        </Field>
        <Field title="Cor do feltro">
          <select name="felt" defaultValue={u.preferences.felt || "verde"}>
            <option>verde</option>
            <option>azul</option>
            <option>vinho</option>
          </select>
        </Field>
        {[
          ["chatMuted", "Ocultar conversa da mesa"],
          ["bb", "Exibir valores em big blinds"],
          ["mute", "Silenciar efeitos da mesa"],
          ["confirmAllIn", "Pedir confirmação para all-in"],
          ["motion", "Reduzir animações"],
          ["largeCards", "Cartas maiores"],
        ].map(([k, v]) => (
          <label key={k}>
            <input name={k} type="checkbox" defaultChecked={u.preferences[k]} />{" "}
            {v}
          </label>
        ))}
        {[
          ["back", "Verso das cartas", ["verde", "bordo", "azul"]],
          ["chip", "Fichas", ["ouro", "jade", "rubi"]],
          ["face", "Naipes", ["classica", "quatro"]],
          ["theme", "Tema", ["clube", "grafite"]],
          ["speed", "Velocidade das animações", ["normal", "rapida"]],
        ].map(([key, title, values]: any) => (
          <Field key={key} title={title}>
            <select name={key} defaultValue={u.preferences[key] || values[0]}>
              {values.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
        ))}
        {[
          ["turnVolume", "Volume do aviso da vez", u.preferences.volume ?? 50],
          ["chipVolume", "Volume das fichas", 35],
          ["handVolume", "Volume do fim da mão", 35],
        ].map(([name, label, fallback]) => (
          <Field key={name} title={label}>
            <input
              name={name}
              type="range"
              min={0}
              max={100}
              defaultValue={u.preferences[name] ?? fallback}
            />
          </Field>
        ))}
        <button className="primary">Salvar preferências</button>
        {saved && <small>Preferências salvas.</small>}
      </form>
    </>
  );
}
export function Admin() {
  const home = useApp((s) => s.home),
    [d, D] = useState<any>(),
    [tab, setTab] = useState("wallet"),
    [query, setQuery] = useState(""),
    [target, setTarget] = useState(""),
    [grant, GrantTo] = useState<any>(),
    [operation, setOperation] = useState<string>(),
    [busy, setBusy] = useState(false);
  const selected = d?.users.find((player) => player.id === target);
  const labels = {
    fund: "Adicionar fichas ao clube",
    send: "Enviar fichas",
    receive: "Receber fichas",
  };
  const pending = React.useRef<{ key: string; reference: string }>();
  async function transact(event) {
    event.preventDefault();
    const amount = Number(new FormData(event.currentTarget).get("amount"));
    setBusy(true);
    try {
      const key = JSON.stringify([operation, target, amount]);
      if (pending.current?.key !== key)
        pending.current = {
          key,
          reference: Array.from(
            crypto.getRandomValues(new Uint8Array(16)),
            (b) => b.toString(16).padStart(2, "0"),
          ).join(""),
        };
      await api("cashier", {
        action: operation,
        amount,
        id: target,
        reference: pending.current.reference,
      });
      D(await api("admin"));
      await refresh();
      pending.current = undefined;
      setOperation(undefined);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (home.me.admin) api("admin").then(D).catch(fail);
  }, [home]);
  if (!home.me.admin) return <Empty>Acesso administrativo restrito.</Empty>;
  return (
    <>
      <section className="club-cashier">
        <h1>Caixa</h1>
        {grant && (
          <Grant
            person={grant}
            destination="carteira"
            close={() => GrantTo(undefined)}
          />
        )}
        <div className="club-cashier-tabs">
          {[
            ["wallet", "Enviar / Receber"],
            ["history", "Histórico"],

            ["admin", "Administração"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {d && tab === "wallet" && (
          <>
            <div className="club-cashier-line">
              <span>Fichas do clube</span>
              <strong>{num(d.clubChips)}</strong>
              <button
                aria-label="Adicionar fichas ao clube"
                onClick={() => setOperation("fund")}
              >
                <Plus size={18} />
              </button>
            </div>
            <label className="club-cashier-search">
              <Search size={18} />
              <input
                aria-label="Buscar jogador"
                placeholder="Buscar por nome ou ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="club-cashier-members">
              {d.users
                .filter((player) =>
                  [player.name, player.id].some((value) =>
                    value.toLowerCase().includes(query.trim().toLowerCase()),
                  ),
                )
                .map((player) => (
                  <button
                    key={player.id}
                    aria-pressed={target === player.id}
                    onClick={() => setTarget(player.id)}
                  >
                    <span className="avatar">
                      {player.name.slice(0, 2).toUpperCase()}
                    </span>
                    <b>{player.name}</b>
                    <strong>{num(player.wallet)}</strong>
                  </button>
                ))}
            </div>
            <div className="club-cashier-line">
              <span>Fichas nas carteiras</span>
              <strong>
                {num(
                  d.users.reduce((total, player) => total + player.wallet, 0),
                )}
              </strong>
            </div>
            <div className="club-cashier-tabs">
              <button disabled={!selected} onClick={() => GrantTo(selected)}>
                Emitir fichas
              </button>
              <button
                className="primary"
                disabled={!selected}
                onClick={() => setOperation("send")}
              >
                Enviar
              </button>
              <button
                disabled={!selected}
                onClick={() => setOperation("receive")}
              >
                Receber
              </button>
            </div>
          </>
        )}
        {d && tab === "history" && (
          <div className="club-cashier-members">
            {d.cashier.length ? (
              d.cashier.map((event) => (
                <div className="club-cashier-line" key={event.id}>
                  <span>
                    {labels[event.action]} · {event.target}
                    <small>
                      {date(event.at)} · {event.by}
                    </small>
                  </span>
                  <strong>{num(event.amount)}</strong>
                </div>
              ))
            ) : (
              <Empty>Nenhuma movimentação registrada.</Empty>
            )}
          </div>
        )}
      </section>
      {operation && (
        <Modal title={labels[operation]} close={() => setOperation(undefined)}>
          <form onSubmit={transact}>
            {operation !== "fund" && <p>Jogador: {selected?.name}</p>}
            <Field title="Quantidade de fichas">
              <input name="amount" type="number" min="1" step="1" required />
            </Field>
            <button className="primary" disabled={busy}>
              Confirmar
            </button>
          </form>
        </Modal>
      )}
      {tab === "admin" && (
        <>
          {d?.health && (
            <div className="panel">
              Jogadores online: {d.health.online} · Conexões:{" "}
              {d.health.connections} · Mesas abertas: {d.health.activeRooms} ·
              Mãos com atraso: {d.health.overdueHands}
              <p>
                Últimas 24h · {d.health.activeCash24} jogadores de cash ·{" "}
                {d.health.handsCash24} mãos concluídas
              </p>
              <p>
                {d.health.actions} jogadas · {d.health.meanActionMs} ms em média
                · {d.health.duplicates} reenvios reconhecidos ·{" "}
                {d.health.socketConnections} conexões abertas desde a
                inicialização
              </p>
            </div>
          )}
          {d && (
            <>
              <div className="overview">
                <div>
                  <strong>{d.users.length}</strong>
                  <span>Usuários</span>
                </div>
                <div>
                  <strong>{d.hands}</strong>
                  <span>Mãos</span>
                </div>
                <div>
                  <strong>{d.reports.length}</strong>
                  <span>Mensagens recebidas</span>
                </div>
              </div>
              <div className="list">
                {d.users.map((u) => (
                  <div key={u.id} className="listitem">
                    <b>{u.name}</b>
                    {u.id !== home.me.id && (
                      <div className="row end">
                        {[
                          ["suspend", u.banned ? "Reativar" : "Suspender"],

                          ["clear", "Limpar chat"],
                        ].map(([kind, text]) => (
                          <button
                            key={kind}
                            onClick={() =>
                              change("moderate", {
                                id: u.id,
                                kind,
                                amount: 1000,
                              })
                            }
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <h2>Denúncias e feedback</h2>
              {d.reports.map((r) => (
                <p key={r.id}>
                  {date(r.at)} · {d.users.find((u) => u.id === r.target)?.name}{" "}
                  · {r.text}
                </p>
              ))}
              <h2>Registro administrativo</h2>
              {d.events.map((r) => (
                <p key={r.id}>
                  {date(r.at)} · {r.by} · {r.action} · {r.target}
                  {r.reason && " · " + r.reason}
                </p>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}


export function RakeControl() {
  const home = useApp((s) => s.home);
  const [report, setReport] = useState<any>(null);
  const [percent, setPercent] = useState(3);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!home?.me?.admin) return;
    let active = true;
    api("globalRake").then((result) => {
      if (!active) return;
      setReport(result);
      setPercent(result.percent);
    }).catch(fail);
    return () => { active = false; };
  }, [home?.me?.admin]);
  if (!home?.me?.admin) return <Empty>Acesso reservado à administração do Poker Royale.</Empty>;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("setGlobalRake", { percent });
      const next = await api("globalRake");
      setReport(next);
      await refresh();
      setMessage("Taxa global atualizada. A nova taxa vale para as próximas mãos.");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel poker-rake-control" style={{ maxWidth: 850, margin: "0 auto" }}>
      <small style={{ letterSpacing: "0.15em", opacity: 0.65 }}>POKER ROYALE · ADMINISTRAÇÃO PRIVADA</small>
      <h1>Controle global de rake</h1>
      <p>Uma única taxa para todas as mesas de cash game. Não existe rake por agente ou responsável de mesa.</p>
      {report ? (
        <>
          <div className="overview" style={{ margin: "22px 0" }}>
            <div><strong>{report.percent}%</strong><span>Rake atual do jogo</span></div>
            <div><strong>{num(report.collected)}</strong><span>Fichas retidas pelo jogo</span></div>
            <div><strong>{num(report.chargedHands)}</strong><span>Mãos com rake</span></div>
          </div>
          <form onSubmit={save} className="panel" style={{ display: "grid", gap: 16 }}>
            <Field title="Percentual aplicado às próximas mãos">
              <select value={percent} onChange={(e) => setPercent(Number(e.target.value))}>
                {Array.from({length: 11}, (_, n) => <option key={n} value={n}>{n === 0 ? "0% — Sem rake" : n + "% de rake"}</option>)}
              </select>
            </Field>
            <p style={{ margin: 0 }}>O Poker Royale está configurado para cobrar <strong>{report.percent}%</strong>. Uma mudança não altera mãos já iniciadas ou finalizadas.</p>
            <button className="primary" type="submit" disabled={busy || percent === report.percent}>
              {busy ? "Salvando…" : "Aplicar nova taxa global"}
            </button>
            {message && <p role="status">{message}</p>}
          </form>
          <h2>Histórico de alterações</h2>
          {report.changes.length ? report.changes.map((entry) => (
            <div className="club-cashier-line" key={entry.id}>
              <span>{date(entry.at)} · {entry.by}</span>
              <strong>{entry.previous}% → {entry.percent}%</strong>
            </div>
          )) : <p>Nenhuma alteração registrada.</p>}
          <h2>Últimas mãos com rake</h2>
          {report.hands.length ? report.hands.slice(0, 30).map((hand) => (
            <div className="club-cashier-line" key={hand.id}>
              <span>
                <strong>{hand.name} · Mão #{hand.number}</strong>
                <small style={{ display: "block" }}>{date(hand.at)} · Pote {num(hand.gross)} · {hand.percent ?? "—"}% de rake</small>
              </span>
              <strong>+{num(hand.fee)} fichas</strong>
            </div>
          )) : <p>Nenhuma mão cobrada até agora.</p>}
        </>
      ) : <p>Carregando os dados de rake…</p>}
    </section>
  );
}
