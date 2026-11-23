import { Sparring, Feedback } from "./CashTools";
import { Practice } from "./Practice";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  KeyRound,
  ArrowUpRight,
  Star,
  LockKeyhole,
  SlidersHorizontal,
} from "lucide-react";
import { api, fail, refresh, useApp, num, date } from "./api";
import { Modal, Field, Empty } from "./ui";
function tableAge(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
// Keep the client default aligned with server/catalog.mjs (including Double Board).
const dealerOptions = [
  "texas", "super", "crazy", "watermelon", "om4", "om5", "om6",
  "om5db", "om6db", "draw", "om3", "cour", "om7",
];
const oldDealerOptions = dealerOptions.filter((key) => !["om5db", "om6db"].includes(key));
function normalizeDealerOptions(rotation: string[] | undefined, isChoice: boolean) {
  if (!isChoice || !Array.isArray(rotation)) return rotation;
  if (rotation.length === oldDealerOptions.length &&
      rotation.every((key, index) => key === oldDealerOptions[index])) return dealerOptions;
  return rotation;
}
export function Create({
  close,
  tour = false,
  preset,
  initial = "texas",
}: any) {
  const template =
    !tour &&
    (preset || JSON.parse(localStorage.getItem("mesa-template") || "null"));
  const h = useApp((s) => s.home),
    [id, I] = useState(
      initial === "texas" ? (template?.game ?? initial) : initial,
    ),
    [rot, R] = useState(
      template?.rotation?.length
        ? normalizeDealerOptions(template.rotation, (initial === "choice" || template?.game === "choice"))
        : initial === "choice"
          ? dealerOptions
          : ["texas", "om4", "draw"],
    ),
    [busy, B] = useState(false),
    [config, setConfig] = useState(tour || !!preset),
    nav = useNavigate();
  const games = h.catalog;
  const g = games.find((v) => v.id === id) || games[0];
  const custom = ["custom", "choice"].includes(id);
  const max =
    id === "custom"
      ? Math.min(g.max, ...rot.map((k) => games.find((v) => v.id === k).max))
      : g.max;
  async function send(e) {
    e.preventDefault();
    const b: any = Object.fromEntries(new FormData(e.target));
    for (const k of ["capacity", "blind", "buy", "seconds", "timeBank", "bombInterval", "bombAnteMultiplier", "cucuruchoAnteMultiplier"])
      b[k] = Number(b[k]);
    if (!tour && b.entryAmount) b.entryAmount = Number(b.entryAmount);
    else delete b.entryAmount;
    b.cucuruchoEnabled = b.cucuruchoEnabled === "on";
    b.watch = b.watch === "on";
    b.private = b.private === "on" || !!b.password;
    if (custom && rot.length === 0) { fail(new Error("Selecione pelo menos uma modalidade.")); return; }
    b.rotation = custom ? rot : [];
    if (tour) b.blindMinutes = Number(b.blindMinutes);
    b.start = b.time ? new Date(b.time).getTime() : Date.now();
    B(true);
    try {
      const r = await api(tour ? "tourCreate" : "create", b);
      if (!tour && b.saveTemplate === "on") {
        const {
          game,
          capacity,
          blind,
          buy,
          seconds,
          timeBank,
          rotation,
          name,
          watch,
        } = b;
        const key = "mesa-presets-" + h.me.id;
        const prior = JSON.parse(localStorage.getItem(key) || "[]");
        localStorage.setItem(
          key,
          JSON.stringify(
            [
              {
                game,
                capacity,
                blind,
                buy,
                seconds,
                timeBank,
                rotation,
                name,
                watch,
                private: b.private,
              },
              ...prior.filter((p) => p.name !== name),
            ].slice(0, 12),
          ),
        );
        localStorage.setItem(
          "mesa-template",
          JSON.stringify({
            game,
            capacity,
            blind,
            buy,
            seconds,
            timeBank,
            rotation,
          }),
        );
      }
      await refresh();
      close();
      if (!tour) nav("/mesa/" + r.id);
    } catch (e) {
      fail(e);
    } finally {
      B(false);
    }
  }
  return (
    <Modal title={tour ? "Criar torneio" : "Criar mesa"} close={close}>
      {!config ? (
        <div className="create-game-grid">
          {[
            ["texas", "Texas Hold’em", "♠"],
            ["om4", "Omaha", "♦"],
            ["short", "Short Deck", "♥"],
            ["ofc", "Poker Chinês", "♣"],
            ["choice", "Dealer’s Choice", "♠"],
            ["draw", "Five Card Draw", "♦"],
          ].map(([key, name, suit], index) => (
            <button
              key={key}
              data-tone={index}
              onClick={() => {
                I(key);
                if (key === "choice") R(normalizeDealerOptions(rot, true)?.length ? normalizeDealerOptions(rot, true)! : dealerOptions);
                setConfig(true);
              }}
            >
              <i aria-hidden="true">{suit}</i>
              <strong>{name}</strong>
            </button>
          ))}
        </div>
      ) : (
        <form className={tour ? undefined : "club-create-form"} onSubmit={send}>
          {!tour && (
            <button type="button" onClick={() => setConfig(false)}>
              ‹ Modalidades
            </button>
          )}

          <Field title="Nome">
            <input
              name="name"
              minLength={2}
              maxLength={32}
              required
              defaultValue={preset?.name}
              placeholder={tour ? "Torneio de sexta" : "Mesa dos amigos"}
            />
          </Field>
          <Field title="Modalidade">
            <select
              name="game"
              value={id}
              onChange={(e) => {
                I(e.target.value);
                if (e.target.value === "choice") R(normalizeDealerOptions(rot, true)?.length ? normalizeDealerOptions(rot, true)! : dealerOptions);
              }}
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.limit}
                </option>
              ))}
            </select>
          </Field>
          <p className="rule">{g.rule}</p>
          {custom && (
            <div className="choices">
              {id === "choice" && (
                <div className="dealer-select-all" role="group" aria-label="Seleção de modalidades do Dealer's Choice">
                  <button type="button" onClick={() => R(dealerOptions.filter(key => games.some(g => g.id === key)))}>
                    Selecionar todos
                  </button>
                  <button type="button" onClick={() => R([])} disabled={rot.length === 0}>
                    Desmarcar todos
                  </button>
                  <small>{rot.filter(key => dealerOptions.includes(key)).length} modalidades selecionadas</small>
                </div>
              )}
              {games
                .filter((g) =>
                  id === "choice"
                    ? dealerOptions.includes(g.id) || rot.includes(g.id)
                    : !["Mistos", "Chinês"].includes(g.family),
                )
                .map((g) => (
                  <label key={g.id}>
                    <input
                      type="checkbox"
                      checked={rot.includes(g.id)}
                      onChange={() =>
                        R(
                          rot.includes(g.id)
                            ? rot.filter((k) => k !== g.id)
                            : [...rot, g.id],
                        )
                      }
                    />
                    {g.name}
                  </label>
                ))}
            </div>
          )}
          <div className="grid2">
            <Field title="Assentos">
              <select
                key={max}
                name="capacity"
                defaultValue={Math.min(max, template?.capacity ?? 6)}
              >
                {Array.from({ length: max - 1 }, (_, i) => (
                  <option key={i}>{i + 2}</option>
                ))}
              </select>
            </Field>
            <Field title="Tempo de decisão">
              <select name="seconds" defaultValue={template?.seconds ?? 25}>
                <option value="15">15 segundos</option>
                <option value="25">25 segundos</option>
                <option value="30">30 segundos</option>
              </select>
            </Field>
            <Field title="Banco de tempo por mão">
              <select name="timeBank" defaultValue={template?.timeBank ?? 0}>
                <option value="0">Desativado</option>
                <option value="10">+10 segundos</option>
                <option value="20">+20 segundos</option>
              </select>
            </Field>

            <Field title={g.family === "Stud" ? "Aposta pequena" : "Big blind"}>
              <input
                name="blind"
                type="number"
                step="2"
                min="2"
                max="1000"
                defaultValue={template?.blind ?? 10}
              />
            </Field>
            <Field
              title={tour ? "Inscrição (fichas)" : "Entrada mínima (fichas)"}
            >
              <input
                name="buy"
                type="number"
                min="20"
                max="1000000"
                defaultValue={template?.buy ?? 1000}
              />
            </Field>
          </div>
          {!tour && g.family !== "Chinês" && (
            <fieldset className="royale-special-rules">
              <legend>Eventos especiais da mesa</legend>
              <label htmlFor="bomb-interval">Bomb Pot a cada quantas mãos?</label>
              <select id="bomb-interval" name="bombInterval" defaultValue="0">
                <option value="0">Desativado</option>
                {[2,3,4,5,6,8,10,12,15,20,25,30].map(value => <option key={value} value={value}>A cada {value} mãos</option>)}
              </select>
              <label htmlFor="bomb-ante">Ante por jogador</label>
              <select id="bomb-ante" name="bombAnteMultiplier" defaultValue="2">
                {[1,2,3,4,5,6,8,10].map(value => <option key={value} value={value}>{value}× BB</option>)}
              </select>
              <small>Bomb Pot: todos pagam o ante e a jogada começa no flop. Disponível para Texas e Omaha High. Em outras modalidades, a mão acontece normalmente.</small>
              <label className="royale-cucu-enable"><input type="checkbox" name="cucuruchoEnabled" /> Ativar Cucurucho</label>
              <label htmlFor="cucu-ante">Ante por jogador no Cucurucho</label>
              <select id="cucu-ante" name="cucuruchoAnteMultiplier" defaultValue="5">
                {[1,2,3,4,5,6,8,10,15,20].map(value => <option key={value} value={value}>{value}× BB</option>)}
              </select>
              <small>Quando o marcador Cucurucho encontra o dealer: todos pagam o ante, o flop abre e cada jogador escolhe Ficar &amp; Pagar o pote ou Desistir. Sem novas apostas no turn/river. Somente Texas e Omaha High simples.</small>
            </fieldset>
          )}
          {!tour && g.family !== "Chinês" && (
            <Field title="Seu buy-in ao abrir a mesa">
              <input
                name="entryAmount"
                type="number"
                min="20"
                placeholder="Entrada mínima da mesa"
              />
            </Field>
          )}
          {tour ? (
            <>
              <Field title="Duração de cada nível">
                <select name="blindMinutes" defaultValue="10">
                  <option value="5">5 minutos</option>
                  <option value="10">10 minutos</option>
                  <option value="15">15 minutos</option>
                </select>
              </Field>
              <Field title="Início previsto">
                <input name="time" type="datetime-local" />
              </Field>
            </>
          ) : (
            <>
              <label>
                <input
                  name="private"
                  defaultChecked={preset?.private}
                  type="checkbox"
                />{" "}
                Mesa privada
              </label>
              <label>
                <input
                  name="watch"
                  type="checkbox"
                  defaultChecked={preset?.watch ?? true}
                />{" "}
                Permitir espectadores
              </label>
              <Field title="Senha opcional">
                <input name="password" type="password" maxLength={72} />
              </Field>
            </>
          )}
          <button className="primary" disabled={busy}>
            Criar {tour ? "torneio" : "mesa"}
          </button>
          {!tour && (
            <label>
              <input type="checkbox" name="saveTemplate" /> Salvar modelo para
              jogar novamente
            </label>
          )}
        </form>
      )}
    </Modal>
  );
}
export function Invite({ close, code = "" }: any) {
  const nav = useNavigate();
  const [busy, B] = useState(false);
  const attempted = React.useRef("");
  useEffect(() => {
    if (!code || attempted.current === code) return;
    attempted.current = code;
    let alive = true;
    B(true);
    api("unlock", { code })
      .then(async (r) => {
        await refresh();
        if (alive) {
          close();
          nav("/mesa/" + r.id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) B(false);
      });
    return () => {
      alive = false;
    };
  }, [code]);
  return (
    <Modal close={close} title="Entrar por convite">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const b = Object.fromEntries(new FormData(e.currentTarget));
          try {
            B(true);
            const r = await api("unlock", {
              ...b,
              code: String(b.code).trim(),
            });
            await refresh();
            close();
            nav("/mesa/" + r.id);
          } catch (e) {
            fail(e);
          } finally {
            B(false);
          }
        }}
      >
        <Field title="Código da mesa">
          <input name="code" defaultValue={code} required />
        </Field>
        <Field title="Senha, se houver">
          <input type="password" name="password" />
        </Field>
        <button disabled={busy} className="primary">
          {busy ? "Abrindo…" : "Abrir mesa"}
        </button>
      </form>
    </Modal>
  );
}
const royalePresets = [
  { key: "royal", label: "Arena Royale", description: "Ouro e cartas intensas", theme: "wood", cards: "vivid", icon: "♠" },
  { key: "midnight", label: "Noite Imperial", description: "Azul e baralho noturno", theme: "blue", cards: "night", icon: "♦" },
  { key: "ruby", label: "Salão Rubi", description: "Vinho e cartas clássicas", theme: "ruby", cards: "classic", icon: "♥" },
] as const;

export default function Lobby() {
  const h = useApp((s) => s.home),
    [applyingVisual, setApplyingVisual] = useState<string | null>(null),
    [favorites, setFavorites] = useState<string[]>(() =>
      JSON.parse(localStorage.getItem("mesa-favorites") || "[]"),
    ),
    [recent, setRecent] = useState<string[]>(() =>
      JSON.parse(localStorage.getItem("mesa-recent") || "[]"),
    ),
    [query, Q] = useState(""),
    [sort, Sort] = useState("recent"),
    [preview, P] = useState(""),
    [preset, Preset] = useState<any>(),
    [version, Vr] = useState(0),
    [roomGroup, setRoomGroup] = useState(""),
    [family, F] = useState("Todas"),
    [mod, M] = useState(""),
    [game, G] = useState(""),
    [filter, A] = useState(false),
    [limit, L] = useState(""),
    [open, O] = useState(false),
    [privacy, V] = useState(""),
    [seats, E] = useState(""),
    [buy, Y] = useState(""),
    [blind, D] = useState(""),
    [occupancy, U] = useState(""),
    nav = useNavigate();
  const games = h.catalog.filter(
    (g) => family === "Todas" || g.family === family,
  );
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);
  const key = "mesa-presets-" + h.me.id;
  const presets = JSON.parse(localStorage.getItem(key) || "[]");
  const folded = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const selected = h.rooms.find((r) => r.id === preview);
  const rooms = h.rooms.filter(
    (r) =>
      !r.tour &&
      folded(r.name).includes(folded(query.trim())) &&
      (!roomGroup ||
        (roomGroup === "friends"
          ? r.seats.some((seat) => h.me.friends.includes(seat.id))
          : (roomGroup === "favorites" ? favorites : recent).includes(r.id))) &&
      games.some((g) => g.id === r.game) &&
      (!game || r.game === game) &&
      (!limit || h.catalog.find((g) => g.id === r.game).limit === limit) &&
      (!open || r.seats.length < r.capacity) &&
      (!privacy || r.private === (privacy === "private")) &&
      (!seats || r.capacity === +seats) &&
      (!buy || r.buy <= +buy) &&
      (!blind || r.blind === +blind) &&
      (!occupancy ||
        (occupancy === "empty"
          ? r.seats.length === 0
          : r.seats.length === r.capacity)),
  );
  rooms.sort(
    (a, b) =>
      (sort === "blind"
        ? a.blind - b.blind
        : sort === "seats"
          ? b.seats.length - a.seats.length
          : 0) ||
      Number(b.id === recent[0]) - Number(a.id === recent[0]) ||
      Number(b.seats.length < b.capacity) - Number(a.seats.length < a.capacity),
  );
  return (
    <div className="club-lobby">
      <div className="royale-lobby-hero">
        <div className="royale-lobby-hero-copy">
          <small>POKER ROYALE · CLUBE ONLINE</small>
          <h1>Escolha sua mesa</h1>
          <p>Encontre uma partida, entre com convite ou crie sua própria mesa.</p>
          <div className="royale-lobby-hero-stats">
            <span><b>{rooms.length}</b> mesas</span>
            <span><b>{rooms.filter(room=>room.seats.length<room.capacity).length}</b> com vagas</span>
            <span><b>{h.me.wallet.toLocaleString("pt-BR")}</b> fichas</span>
          </div>
        </div>
        <div className="royale-lobby-hero-actions">
          <button className="primary" onClick={()=>M("create")}><Plus size={19}/> Criar mesa</button>
          <button onClick={()=>M("invite")}><KeyRound size={18}/> Convite</button>
          <button onClick={()=>nav("/carteira")}>Carteira Royal</button>
        </div>
      </div>
      <div className="club-lobby-heading">
        <h2>Mesas disponíveis</h2>
        <div className="club-quick-actions">
          <button className="primary" onClick={() => M("create")}>
            <Plus size={21} /> Criar mesa
          </button>
          <button onClick={() => M("invite")}>
            <KeyRound size={19} /> Usar convite
          </button>
          <button onClick={() => M("training")}>Treinar</button>
        </div>
      </div>
      <div className="cash-shortcuts">
        {h.rooms
          .filter((r) => r.joined && !r.tour)
          .map((r) => (
            <button
              key={r.id}
              className="primary"
              onClick={() => nav("/mesa/" + r.id)}
            >
              Voltar · {r.name}
            </button>
          ))}
      </div>
      <div className="cash-shortcuts">
        <input
          aria-label="Pesquisar mesa"
          type="search"
          placeholder="Pesquisar mesa"
          value={query}
          onChange={(e) => Q(e.target.value)}
        />
        <select
          aria-label="Ordenar mesas"
          value={sort}
          onChange={(e) => Sort(e.target.value)}
        >
          <option value="recent">Recentes e com vaga</option>
          <option value="blind">Menor blind</option>
          <option value="seats">Mais jogadores</option>
        </select>
        {!!presets.length && (
          <button onClick={() => M("presets")}>Mesas salvas</button>
        )}
      </div>
      <div className="club-room-toolbar">
        <div
          className="club-room-groups"
          role="group"
          aria-label="Listas de mesas"
        >
          {[
            ["", "Todas"],
            ["favorites", "Favoritas"],
            ["recent", "Recentes"],
            ["friends", "Amigos"],
          ].map(([value, name]) => (
            <button
              key={value}
              aria-pressed={roomGroup === value}
              onClick={() => setRoomGroup(value)}
            >
              {name}
            </button>
          ))}
        </div>
        <button
          className="club-filter"
          aria-expanded={filter}
          onClick={() => A(!filter)}
        >
          <SlidersHorizontal size={18} /> Filtros
        </button>
      </div>
      <div className="tabs club-family-tabs">
        {["Todas", "Hold’em", "Omaha", "Stud", "Draw", "Chinês", "Mistos"].map(
          (v) => (
            <button
              className={family === v ? "active" : ""}
              key={v}
              onClick={() => {
                F(v);
                G("");
              }}
            >
              {v}
            </button>
          ),
        )}
      </div>
      {filter && (
        <div className="row filters club-filters">
          <button
            onClick={() => {
              G("");
              L("");
              V("");
              U("");
              E("");
              D("");
              Y("");
              O(false);
              F("Todas");
              Q("");
              setRoomGroup("");
            }}
          >
            Limpar filtros
          </button>
          <select value={game} onChange={(e) => G(e.target.value)}>
            <option value="">Todas as modalidades</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select value={limit} onChange={(e) => L(e.target.value)}>
            <option value="">Todos os limites</option>
            {["NL", "PL", "FL", "PTS", "MIX"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Visibilidade"
            value={privacy}
            onChange={(e) => V(e.target.value)}
          >
            <option value="">Públicas e privadas</option>
            <option value="public">Públicas</option>
            <option value="private">Privadas</option>
          </select>
          <select
            aria-label="Ocupação"
            value={occupancy}
            onChange={(e) => U(e.target.value)}
          >
            <option value="">Qualquer ocupação</option>
            <option value="empty">Vazias</option>
            <option value="full">Lotadas</option>
          </select>
          <input
            type="number"
            aria-label="Número de assentos"
            placeholder="Assentos"
            min="2"
            max="10"
            value={seats}
            onChange={(e) => E(e.target.value)}
          />
          <input
            type="number"
            aria-label="Big blind"
            placeholder="Big blind"
            min="2"
            value={blind}
            onChange={(e) => D(e.target.value)}
          />
          <input
            type="number"
            aria-label="Entrada máxima"
            placeholder="Entrada máxima"
            value={buy}
            onChange={(e) => Y(e.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={open}
              onChange={(e) => O(e.target.checked)}
            />{" "}
            Com vagas
          </label>
        </div>
      )}
      {rooms.length ? (
        <div className="club-room-grid">
          {rooms.map((r) => (
            <article key={r.id} className="club-room-card">
              <button
                className="club-room-open"
                onClick={() => {
                  const updated = [
                    r.id,
                    ...recent.filter((id) => id !== r.id),
                  ].slice(0, 25);
                  setRecent(updated);
                  localStorage.setItem("mesa-recent", JSON.stringify(updated));
                  nav("/mesa/" + r.id);
                }}
                key={r.id}
              >
                <span className="club-table-pill">
                  <b className="club-table-title">
                    {r.name}{" "}
                    {r.private && (
                      <LockKeyhole size={13} aria-label="Privada" />
                    )}
                  </b>
                  <strong>
                    Blinds {num(r.blind / 2)} / {num(r.blind)}
                  </strong>

                  <span className="club-table-count">
                    {r.seats.length}/{r.capacity} jogando
                  </span>
                  {r.created && (
                    <small aria-label="Tempo da mesa">
                      {tableAge(now - r.created)}
                    </small>
                  )}
                  <small>{h.catalog.find((g) => g.id === r.game)?.name}</small>
                  <ArrowUpRight
                    className="club-table-arrow"
                    size={21}
                    aria-hidden="true"
                  />
                </span>
                <span className="club-table-queue">
                  {r.paused && r.inHand
                    ? "Pausa após a mão"
                    : r.paused
                      ? "Pausada"
                      : r.inHand
                        ? "Em jogo"
                        : r.count
                          ? "Intervalo"
                          : "Aguardando início"}{" "}
                  · Fila {r.queueLength}
                </span>
              </button>
              <button onClick={() => P(r.id)}>
                Ver lugares · {r.capacity - r.seats.length} livres
              </button>
              <button
                className="club-favorite"
                aria-pressed={favorites.includes(r.id)}
                aria-label={
                  (favorites.includes(r.id)
                    ? "Remover favorita: "
                    : "Favoritar mesa: ") + r.name
                }
                onClick={() => {
                  const updated = favorites.includes(r.id)
                    ? favorites.filter((id) => id !== r.id)
                    : [...favorites, r.id];
                  setFavorites(updated);
                  localStorage.setItem(
                    "mesa-favorites",
                    JSON.stringify(updated),
                  );
                }}
              >
                <Star
                  size={18}
                  fill={favorites.includes(r.id) ? "currentColor" : "none"}
                />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty>Nenhuma mesa aberta para esta seleção.</Empty>
      )}
      {selected && (
        <Modal title={selected.name} close={() => P("")}>
          <p>
            {h.catalog.find((g) => g.id === selected.game)?.name} · Entrada{" "}
            {num(selected.buy)} · {selected.seconds}s por jogada
          </p>
          <p>
            {selected.paused && selected.inHand
              ? "Pausa programada ao fim desta mão"
              : selected.paused
                ? "Mesa pausada"
                : selected.inHand
                  ? "Mão em andamento"
                  : selected.count
                    ? "Intervalo entre mãos"
                    : "A primeira mão começa quando o dono distribuir"}
          </p>
          <small>
            {selected.watch ? "Espectadores permitidos" : "Somente jogadores"}
          </small>
          <ol>
            {Array.from({ length: selected.capacity }, (_, i) => (
              <li key={i}>
                {selected.seats.find((s) => s.position === i)?.name || "Livre"}
              </li>
            ))}
          </ol>
          <button
            className="primary"
            onClick={() => nav("/mesa/" + selected.id)}
          >
            Abrir mesa
          </button>
        </Modal>
      )}
      {mod === "presets" && (
        <Modal title="Modelos de mesa" close={() => M("")}>
          {presets.map((p) => (
            <div className="cash-room-summary" key={p.name}>
              <div>
                <b>{p.name}</b>
                <small>
                  {p.capacity} lugares · Blind {num(p.blind)} · Entrada{" "}
                  {num(p.buy)}
                </small>
              </div>
              <button
                onClick={() => {
                  Preset(p);
                  M("create");
                }}
              >
                Usar
              </button>
              <button
                onClick={() => {
                  localStorage.setItem(
                    key,
                    JSON.stringify(presets.filter((o) => o.name !== p.name)),
                  );
                  Vr(version + 1);
                }}
              >
                Excluir modelo
              </button>
            </div>
          ))}
        </Modal>
      )}
      {mod === "create" && (
        <Create
          preset={preset}
          close={() => {
            Preset(undefined);
            M("");
          }}
        />
      )}
      {mod === "training" && (
        <Modal title="Treinar" close={() => M("")}>
          <div className="cash-shortcuts">
            <button onClick={() => M("bot")}>Jogar contra o computador</button>
            <button onClick={() => M("practice")}>Exercícios guiados</button>
          </div>
        </Modal>
      )}
      {mod === "bot" && <Sparring close={() => M("")} />}
      <button onClick={() => M("feedback")}>Enviar feedback do beta</button>
      {mod === "feedback" && <Feedback close={() => M("")} />}
      {mod === "invite" && <Invite close={() => M("")} />}
      {mod === "practice" && <Practice close={() => M("")} />}
    </div>
  );
}
