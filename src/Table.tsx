import { TableClosingSummary } from "./TableClosingSummary";
import {TableBalances} from "./TableBalances";
import { actionVoicePhrase, speakPokerAction } from "./action-voice.mjs";
import { Grant } from "./PlayerIdentity";
import { betPresets } from "./bet-presets.mjs";
import { PrivateNote, downloadText } from "./PrivateNote";
import { ChipAmount, ChipReceipt } from "./ChipMotion";
import { DealerChoice, DealerModeAnnouncement } from "./DealerChoice";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Maximize2,
  Send,
  Link2,
  Flag,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  History,
  MessageSquare,
  CircleHelp,
  Menu,
} from "lucide-react";
import { useApp, api, refresh, fail, num } from "./api";
import { cardStyles, setCardStyle, Card, Empty, Field, Modal } from "./ui";
const lanes = ["Frente", "Meio", "Fundo"];
import { Board } from "./PortraitBoard";
import { showdownFlow } from "./showdown-flow.mjs";
import { ProgressSplash } from "./ProgressSplash";
import "./portrait.css";
const pokerWords = {
  "High card": "Carta alta",
  "One pair": "Um par",
  "Two pair": "Dois pares",
  "Three of a kind": "Trinca",
  Straight: "Sequência",
  "Four of a kind": "Quadra",
  "Straight flush": "Sequência do mesmo naipe",
  Check: "Passou",
  Fold: "Desistiu",
  Call: "Pagou",
  Raise: "Aumentou",
  Bet: "Apostou",
  "Bring-in": "Aposta inicial",
  "All-in": "Tudo em jogo",
  Low: "Mão baixa",
};
const pokerText = (text: string) =>
  text?.replace(
    /(?:^| · )(Straight flush|High card|One pair|Two pair|Three of a kind|Four of a kind|Straight|Check|Fold|Call|Raise|Bet|Bring-in|All-in|Low)\b/g,
    (match, word) => match.slice(0, -word.length) + pokerWords[word],
  );

function RunoutVote({send,busy,available}:{send:(action:any)=>void;busy:boolean;available:number[]}){
  const [count,setCount]=useState(1);
  const chosen=available.includes(count)?count:1;
  return <div className="runout-vote" role="group" aria-label="Votação de corridas após all-in">
    <strong>All-in · Quantas vezes bater?</strong>
    <p>Todos os envolvidos precisam confirmar a mesma quantidade. Votos diferentes = 1 (côco).</p>
    <div className="runout-options">{[1,2,3].map(n=><button type="button" key={n}
      aria-pressed={chosen===n} title={!available.includes(n)?'Baralho insuficiente para '+n+' corridas':''}
      className={!available.includes(n)?'runout-unavailable':''}
      disabled={busy||!available.includes(n)} onClick={()=>setCount(n)}>
      {n===1?'1 · Côco':n===2?'2 · Twice':'3 · Three'}{!available.includes(n)?' 🔒':''}
    </button>)}</div>
    <button type="button" className="primary runout-deal" disabled={busy} onClick={()=>send({type:'runout',count:chosen})}>DEAL · Confirmar {chosen} {chosen===1?'bordo':'bordos'}</button>
  </div>;
}

function Actions({ f, send, busy, blind, limit, shortcuts = "fcr" }: any) {
  const l = f.legal,
    [sizing, setSizing] = useState(false),
    [cards, C] = useState<string[]>([]),
    [amount, A] = useState(l.min || 0),
    [lines, L] = useState<number[]>(f.hole[f.actor]?.map(() => -2) || []);
  useEffect(() => {
    const key = (e) => {
      if (
        busy ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        document.querySelector("dialog[open]") ||
        e.altKey ||
        /INPUT|SELECT|TEXTAREA|BUTTON/.test(
          document.activeElement?.tagName || "",
        )
      )
        return;
      if (e.key === "Escape") setSizing(false);
      if (shortcuts === "off") return;
      if (e.key === shortcuts[0] && l.fold) send({ type: "fold" });
      if (e.key === shortcuts[1] && "call" in l) send({ type: "pass" });
      if (
        e.key === shortcuts[2] &&
        l.min != null &&
        amount >= l.min &&
        amount <= l.max
      )
        setSizing(true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [busy, l, amount, send, shortcuts]);
  if (f.cucurucho && (l.cucu != null || l.fold)) return <div className="royale-cucu-controls" role="group" aria-label="Decisão de Cucurucho no flop">
    <strong>CUCURUCHO · FLOP</strong>
    <span>{l.cucu != null ? `Ficar custa ${num(l.cucu)} fichas` : 'Fichas insuficientes: desista'}</span>
    <button disabled={busy} onClick={() => send({type:'fold'})}>Desistir</button>
    <button className="primary" disabled={busy || l.cucu == null} onClick={() => send({type:'cucuStay'})}>Ficar &amp; Pagar {l.cucu != null ? num(l.cucu) : ''}</button>
  </div>;
  if (l.runout) return <RunoutVote send={send} busy={busy} available={l.runout}/>;
  if (l.place)
    return (
      <div>
        <p>Posicione as cartas. Descartes necessários: {l.discard}.</p>
        <div className="placing">
          {f.hole[f.actor].map((c, i) => (
            <label key={c}>
              <Card c={c} />
              <select
                aria-label={"Linha de " + c}
                value={lines[i]}
                onChange={(e) =>
                  L(lines.map((v, j) => (j === i ? +e.target.value : v)))
                }
              >
                <option value={-2}>Linha…</option>
                {lanes.map((n, k) => (
                  <option value={k} key={n}>
                    {n}
                  </option>
                ))}
                {!!l.discard && <option value={-1}>Descartar</option>}
              </select>
            </label>
          ))}
        </div>
        <button
          disabled={busy || lines.includes(-2)}
          className="primary"
          onClick={() => send({ type: "place", lines })}
        >
          Confirmar linhas
        </button>
      </div>
    );
  if ("draw" in l)
    return (
      <div>
        <p>
          {l.required
            ? "Escolha uma carta para descartar."
            : "Selecione as cartas que deseja trocar."}
        </p>
        <div className="row">
          {f.hole[f.actor].map((c) => (
            <Card
              key={c}
              c={c}
              selected={cards.includes(c)}
              onClick={() =>
                C(
                  cards.includes(c)
                    ? cards.filter((x) => x !== c)
                    : [...cards, c],
                )
              }
            />
          ))}
          <button
            className="primary"
            disabled={
              busy || cards.length < l.required || cards.length > l.draw
            }
            onClick={() => send({ type: "draw", cards })}
          >
            {cards.length ? "Descartar " + cards.length : "Manter todas"}
          </button>
        </div>
      </div>
    );
  if (!Object.keys(l).length) return null;
  const target = (v) => A(Math.max(l.min, Math.min(l.max, Math.round(v))));
  return (
    <div className="betbar">
      {l.min != null && sizing && (
        <div className="row sizes bet-popover" aria-label="Ajustar aposta">
          <div className="bet-heading">
            <h3>{Math.max(...f.bets) > 0 ? "Aumentar aposta" : "Apostar"}</h3>
            <button type="button" onClick={() => setSizing(false)}>
              Fechar
            </button>
          </div>
          <div className="bet-summary">
            <div>
              <small>Total na rodada</small>
              <strong key={amount}>{num(amount)}</strong>
            </div>
            <div>
              <small>Sai do seu saldo agora</small>
              <strong key={amount}>
                {num(Math.max(0, amount - f.bets[f.actor]))}
              </strong>
            </div>
          </div>
          <div className="bet-limits">
            <small>Mín. {num(l.min)}</small>
            <small>
              {limit === "PL" ? "Limite do pote" : "Máx."} {num(l.max)}
            </small>
            <small>
              Saldo após apostar{" "}
              {num(Math.max(0, f.stacks[f.actor] - amount + f.bets[f.actor]))}
            </small>
          </div>
          <input
            aria-label="Aposta"
            type="range"
            min={l.min}
            max={l.max}
            value={amount}
            onChange={(e) => A(+e.target.value)}
          />
          <div className="bet-presets">
            {" "}
            {betPresets(l, f, blind, limit).map(([n, v]) => (
              <button
                key={n}
                aria-pressed={
                  amount ===
                  Math.max(l.min, Math.min(l.max, Math.round(Number(v))))
                }
                onClick={() => target(v)}
              >
                {n} ·{" "}
                {num(Math.max(l.min, Math.min(l.max, Math.round(Number(v)))))}
              </button>
            ))}
          </div>
          <div className="bet-stepper">
            <button
              type="button"
              aria-label="Reduzir aposta"
              disabled={amount <= l.min}
              onClick={() => target(amount - blind)}
            >
              −
            </button>
            <input
              onWheel={(e) => {
                if (document.activeElement === e.currentTarget)
                  target(amount + (e.deltaY < 0 ? blind : -blind));
              }}
              aria-label="Valor total"
              type="number"
              min={l.min}
              max={l.max}
              value={amount}
              onChange={(e) => A(+e.target.value)}
            />
            <button
              type="button"
              aria-label="Aumentar aposta"
              disabled={amount >= l.max}
              onClick={() => target(amount + blind)}
            >
              +
            </button>
          </div>
          <button
            className="primary bet-confirm"
            disabled={
              busy ||
              !Number.isSafeInteger(amount) ||
              amount < l.min ||
              amount > l.max
            }
            onClick={() => send({ type: "raise", amount })}
          >
            Confirmar · {num(amount)}
          </button>
        </div>
      )}
      <div className="row action-choices">
        <button
          className="danger"
          disabled={busy || !l.fold}
          onClick={() => send({ type: "fold" })}
        >
          FOLD
        </button>
        <button
          className="action-pass royale-check"
          disabled={busy || !("call" in l) || l.call !== 0}
          onClick={() => send({ type: "pass" })}
        >
          CHECK
        </button>
        <button
          className="action-pass royale-call"
          disabled={busy || !("call" in l) || l.call === 0}
          onClick={() => send({ type: "pass" })}
        >
          <span className="royale-call-label">CALL</span>
          {l.call > 0 && <strong className="royale-call-value">{num(l.call)}{l.call === f.stacks[f.actor] && <em>ALL-IN</em>}</strong>}
        </button>
        <button
          className="primary"
          disabled={busy || (l.min == null && l.bring == null)}
          aria-expanded={l.min != null ? sizing : undefined}
          onClick={() => {
            if (l.min == null) send({ type: "bring" });
            else if (sizing) target(Math.max(...f.bets) * 2 || l.min * 2);
            else setSizing(true);
          }}
        >
          {l.min != null && Math.max(...f.bets) ? "RAISE" : "BET"}
          {l.min == null && l.bring != null && <small>{num(l.bring)}</small>}
        </button>
      </div>
    </div>
  );
}
function Lines({ h, f }: any) {
  return (
    f?.rows && (
      <div className="variants">
        {h.players.map((p, i) => (
          <div className="panel" key={p.id}>
            <b>{p.name}</b>
            {f.rows[i].map((row, j) => (
              <div key={j}>
                <small>{lanes[j]}</small>
                <div className="cards mini">
                  {row.map((c, k) => (
                    <Card key={k} c={c} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  );
}
const signed = (amount: number) => (amount > 0 ? "+" : "") + num(amount);
const balanceTone = (amount: number) =>
  amount > 0 ? "gain" : amount < 0 ? "loss" : "even";

function Result({ h, f }: any) {
  if (!f?.finished) return null;
  const best = Math.max(...f.payouts);
  const winners = h.players.flatMap((player, i) => {
    if (f.rows ? f.payouts[i] !== best : f.payouts[i] <= 0) return [];
    const net = f.rows ? f.payouts[i] : f.stacks[i] - player.stack;
    return [
      <span key={player.id}>
        {player.name}{" "}
        <b data-balance={balanceTone(net)}>
          {signed(net)} {f.rows ? "pts" : "fichas líquidas"}
        </b>
      </span>,
    ];
  });
  return (
    <div className="result result-net" key={h.id}>
      <Flag size={17} />
      {winners}
      {!f.rows && (
        <small>
          Pote total{" "}
          {num(
            f.grossPot ??
              f.payouts.reduce((total, amount) => total + amount, 0),
          )}
        </small>
      )}
    </div>
  );
}
export default function Table() {
  const { id } = useParams(),
    home = useApp((s) => s.home),
    liveStatus = useApp((s) => s.liveStatus),
    me = home.me,
    nav = useNavigate(),
    [r, R] = useState<any>(),
    [roomError, setRoomError] = useState<{ id: string; message: string }>(),
    [retry, setRetry] = useState(0),
    [roomReady, setRoomReady] = useState(false),
    [busy, B] = useState(false),
    [chooseGame, setChooseGame] = useState(false),
    [lookOpen, setLookOpen] = useState(false),
    [theme, setTheme] = useState(
      () =>
        me.appearance?.theme ??
        localStorage.getItem("mesa-table-theme") ??
        "wood",
    ),
    [cardStyle, setCardLook] = useState(
      () =>
        me.appearance?.cards ??
        localStorage.getItem("mesa-card-style") ??
        "royale",
    ),
    [entry, setEntry] = useState<{ position: number; amount: number }>(),
    [tableOptions, setTableOptions] = useState(false),
    [visualEffects, setVisualEffects] = useState(() => localStorage.getItem("royale-effects") ?? "normal"),
    [closingResults, setClosingResults] = useState<any>(null),
    [mobileDock, setMobileDock] = useState(() => localStorage.getItem("mesa-mobile-dock") !== "off"),
    [bbView, setBbView] = useState(() => localStorage.getItem("mesa-bb-view") === "on"),
    [requestAmount, setRequestAmount] = useState(100),
    [requestOverrides, setRequestOverrides] = useState<Record<string, number>>({}),
    [invite, I] = useState(false),
    [linkCopied, Copy] = useState(false),
    [info, setInfo] = useState(false),
    [resultHand, setResultHand] = useState<any>(),
    [dealerReviewActive, setDealerReviewActive] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [handSearch, setHandSearch] = useState(""),
    [historyFilter, setHistoryFilter] = useState("all"),
    [historyReplay, setHistoryReplay] = useState(""),
    [tableControls, setTableControls] = useState(false),
    [grant, GrantTo] = useState<any>(),
    [chipsOpen, setChipsOpen] = useState(false),
    [chipRecipient, setChipRecipient] = useState<string>(),
    [chipsAmount, setChipsAmount] = useState<number | undefined>(),
    [chatOpen, setChatOpen] = useState(false),
    [player, setPlayer] = useState<{ id: string; name: string }>(),
    [vipStats, setVipStats] = useState<any>(null),
    [vipLoading, setVipLoading] = useState(false),
    [time, T] = useState(Date.now()),
    [chat, C] = useState("");
  useEffect(() => {
    setRoomReady(false);
  }, [id]);
  useEffect(() => {
    let ok = true;
    api("room", { room: id })
      .then((x) => {
        if (ok) {
          R({ ...x, clientReceivedAt: Date.now() });
          setRoomError(undefined);
        }
      })
      .catch((error) => {
        if (ok) setRoomError({ id, message: error.message });
      });
    return () => {
      ok = false;
    };
  }, [id, home, retry, liveStatus]);
  // The authoritative server exposes pre-award stacks during the last-board
  // reveal. Refresh exactly at the award boundary so winners appear on time,
  // rather than waiting for the lobby's next 15-second polling tick.
  useEffect(() => {
    const last = r?.lastHand;
    const frame = last?.frames?.at(-1);
    if (!last || !frame?.finished || frame.runoutFrom == null || (frame.boards?.length ?? 0) < 2) return;
    const releaseAt = last.ended + showdownFlow(frame, 0).awardAt;
    const offset = (r?.clientReceivedAt ?? Date.now()) - (r?.serverTime ?? Date.now());
    const remaining = releaseAt - (Date.now() - offset);
    if (remaining < -500) return;
    const timer = window.setTimeout(() => setRetry(value => value + 1), Math.max(70, remaining + 150));
    return () => window.clearTimeout(timer);
  }, [r?.id, r?.lastHand?.id, r?.lastHand?.ended]);
  useEffect(() => {
    if (!player) { setVipStats(null); return; }
    const canSee = player.id === me.id || !!me.vip;
    if (!canSee) { setVipStats(null); return; }
    let active = true;
    setVipLoading(true);
    setVipStats(null);
    api("stats", player.id === me.id ? {} : { target: player.id })
      .then((data) => { if (active) setVipStats(data); })
      .catch(() => { if (active) setVipStats(null); })
      .finally(() => { if (active) setVipLoading(false); });
    return () => { active = false; };
  }, [player?.id, me.id, me.vip]);
  useEffect(() => {
    const t = setInterval(() => T(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const [pendingAllIn, setPendingAllIn] = useState<{
    action: any;
    rev: number;
  }>();
  const [pinnedTool, setPinnedTool] = useState(
    () => localStorage.getItem("mesa-pinned-tool") ?? "",
  );
  function submitAction(action) {
    const frame = r?.live?.frames.at(-1);
    if (!frame || liveStatus === "offline") return;
    const allIn =
      (action.type === "raise" &&
        action.amount ===
          frame.stacks[frame.actor] + frame.bets[frame.actor]) ||
      (action.type === "pass" &&
        frame.legal.call > 0 &&
        frame.legal.call === frame.stacks[frame.actor]);
    if (allIn && me.preferences.confirmAllIn)
      setPendingAllIn({ action, rev: r.rev });
    else run("move", { action, rev: r.rev });
  }
  const [receipt, setReceipt] = useState<{ amount: number; label: string }>();
  useEffect(() => {
    if (!receipt) return;
    const timer = window.setTimeout(() => setReceipt(undefined), 2200);
    return () => window.clearTimeout(timer);
  }, [receipt]);
  const requestInFlight = useRef(false);
  const [moveStatus, setMoveStatus] = useState("");
  const [unconfirmed, setUnconfirmed] = useState<any>();
  useEffect(() => {
    if (!moveStatus || unconfirmed || busy) return;
    const timer = setTimeout(() => setMoveStatus(""), 3500);
    return () => clearTimeout(timer);
  }, [moveStatus, unconfirmed, busy]);
  async function openDealerReview() {
    if (busy || !r?.lastHand) return;
    const previous = r.lastHand;
    try {
      if (r.game === "choice" && r.nextChoice?.selecting && r.nextChoice.dealer === me.id)
        await api("choiceHold", { room: id });
      setDealerReviewActive(true);
      setResultHand({ hand: previous, frame: previous.frames.at(-1) });
      await refresh();
    } catch (error) { fail(error); }
  }
  async function closeDealerReview() {
    setResultHand(undefined);
    if (dealerReviewActive) {
      setDealerReviewActive(false);
      try { await api("choiceResume", { room: id }); await refresh(); }
      catch (error) { fail(error); }
    }
  }
  async function openDealerChoice() {
    if (busy) return;
    try {
      await api("choiceHold", { room: id });
      await refresh();
      setChooseGame(true);
    } catch (error) { fail(error); }
  }
  const rebuyReference = useRef<string | null>(null);
  async function closeDealerChoice() {
    setChooseGame(false);
    try { await api("choiceResume", { room: id }); await refresh(); }
    catch (error) { fail(error); }
  }
  async function run(cmd, more: any = {}) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    B(true);
    const moving = cmd === "move";
    const payload = moving
      ? {
          ...more,
          requestId:
            more.requestId ??
            (typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : undefined),
        }
      : more;
    let accepted = false;
    if (moving) {
      setMoveStatus("Enviando jogada…");
      setUnconfirmed(undefined);
    }
    try {
      const result = await api(cmd, { room: id, ...payload });
      accepted = true;
      if (moving) setMoveStatus("Jogada registrada");
      if (cmd === "leave" || cmd === "leaveAfterHand") {
        setTableOptions(false);
        setMoveStatus(
          result?.pending == null
            ? "Saída solicitada"
            : result.pending
              ? "Saída programada para o fim da mão"
              : "Saída cancelada",
        );
      }
      await refresh();
      if (cmd === "sit" || cmd === "queueEntry") {
        setEntry(undefined);
        if (game.family !== "Chinês")
          setReceipt({
            amount: cmd === "queueEntry" ? more.amount ?? r.buy : result?.credited ?? 0,
            label: cmd === "queueEntry" ? "Entrada programada (ainda não creditada)" : "Buy-in confirmado pelo servidor",
          });
      }
      if (cmd === "move" && more.action?.type === "raise") {
        setReceipt({
          amount: Math.max(0, more.action.amount - (f?.bets[f.actor] ?? 0)),
          label: "Aposta na mesa",
        });
      }
      if (cmd === "chooseNext") setChooseGame(false);
      if (cmd === "close") {
        setTableOptions(false);
        setClosingResults(result?.closingResults ?? null);
      }
    } catch (e) {
      if (moving && !accepted) {
        const ambiguous = e instanceof TypeError || e instanceof SyntaxError;
        setMoveStatus(
          ambiguous ? "Confirmação da jogada pendente" : "Jogada recusada",
        );
        if (ambiguous) setUnconfirmed(payload);
        await refresh().catch(() => {});
      }
      fail(e);
    } finally {
      requestInFlight.current = false;
      B(false);
    }
  }
  const [preset, Pre] = useState(""),
    [cap, Cap] = useState(0),
    used = useRef(""),
    presetHand = useRef(""),
    presetStreet = useRef<number>(),
    lastSound = useRef(""),
    [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem("mesa-voice-enabled") !== "false"),
    [voiceVolume, setVoiceVolume] = useState(() => Number(localStorage.getItem("mesa-voice-volume") ?? 85)),
    tone = useRef<AudioContext | null>(null),
    drawerStart = useRef(0);
  useEffect(() => {
    const arm = () => {
      try {
        tone.current ??= new AudioContext();
        tone.current.resume().catch(() => {});
      } catch {}
    };
    window.addEventListener("pointerdown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      tone.current?.close().catch(() => {});
    };
  }, []);
  function playTurnTone(frequency: number, duration = 0.12, channel = "turn") {
    if (!me.preferences.mute && tone.current?.state === "running") {
      const ctx = tone.current,
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(
        0.0001 +
          (0.09 *
            (me.preferences[channel + "Volume"] ??
              (channel === "turn" ? (me.preferences.volume ?? 50) : 35))) /
            100,
        ctx.currentTime,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration * 0.85,
      );
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }
  }
  const turnSecondsLeft = r?.live
    ? Math.max(0, Math.ceil((r.deadline - time) / 1000))
    : undefined;
  const isMyTurn = r?.live?.players[r.live.frames.at(-1).actor]?.id === me.id;
  useEffect(() => {
    if (
      isMyTurn &&
      turnSecondsLeft != null &&
      turnSecondsLeft > 0 &&
      turnSecondsLeft <= 5
    )
      playTurnTone(
        720 + (5 - turnSecondsLeft) * 105,
        turnSecondsLeft === 1 ? 0.24 : 0.13,
      );
  }, [isMyTurn, turnSecondsLeft]);
  useEffect(() => {
    const h = r?.live,
      f = h?.frames.at(-1);
    if (
      !h ||
      h.players[f.actor]?.id !== me.id ||
      used.current === h.id + ":" + r.rev
    )
      return;
    used.current = h.id + ":" + r.rev;
    playTurnTone(520);
    const l = f.legal;
    if (presetHand.current !== h.id || presetStreet.current !== f.street) {
      Pre("");
      return;
    }
    let type = "";
    if (preset === "fold" && l.fold) type = "fold";
    if (preset === "checkfold")
      type = l.call === 0 ? "pass" : l.fold ? "fold" : "";
    if (preset === "check" && l.call === 0) type = "pass";
    if (preset === "call" && "call" in l && l.call <= cap) type = "pass";
    Pre("");
    if (type) submitAction({ type });
  }, [r, me.id]);
  const liveFrame = r?.live?.frames.at(-1);
  useEffect(() => {
    if (
      preset &&
      (presetHand.current !== r?.live?.id ||
        presetStreet.current !== liveFrame?.street)
    )
      Pre("");
  }, [r?.live?.id, liveFrame?.street, preset]);
  const soundHand = r?.live ?? r?.lastHand;
  const soundFrame = soundHand?.frames.at(-1);
  useEffect(() => {
    const key = soundHand?.id + ":" + soundFrame?.sequence;
    if (!soundFrame || key === lastSound.current) return;
    const wasLoaded = lastSound.current !== "";
    lastSound.current = key;
    if (!wasLoaded) return;
    if (voiceEnabled && !me.preferences.mute) {
      const previousFrame = soundHand?.frames?.at(-2);
      const phrase = actionVoicePhrase(soundFrame, previousFrame);
      if (phrase) speakPokerAction(phrase, voiceVolume / 100);
    }
    if (soundFrame.finished) {
      const delay =
        soundFrame.runoutFrom == null
          ? 0
          : Math.max(0, (r.reviewUntil ?? 0) - 3500 - Date.now());
      const timer = setTimeout(() => playTurnTone(610, 0.18, "hand"), delay);
      return () => clearTimeout(timer);
    }
    if (soundFrame.paid > 0) playTurnTone(235, 0.075, "chip");
  }, [soundHand?.id, soundFrame?.sequence]);
  // React hooks must execute on every render, including before room data loads.
  // The previous conditional hook mounted only after fetching a room, crashing
  // the app with "Rendered more hooks than during the previous render".
  const [revealConfirmation, setRevealConfirmation] = useState("");
  const currentHandId = r?.live?.id ?? r?.lastHand?.id;
  useEffect(() => setRevealConfirmation(""), [currentHandId]);

  if (roomError?.id === id)
    return (
      <div className="panel">
        <h2>Mesa indisponível</h2>
        <p role="alert">{roomError.message}</p>
        <div className="row">
          <button
            onClick={() => {
              setRoomError(undefined);
              setRetry((v) => v + 1);
            }}
          >
            Tentar novamente
          </button>
          <button onClick={() => nav("/")}>Voltar ao lobby</button>
        </div>
      </div>
    );
  if (!r || r.id !== id || !roomReady)
    return (
      <ProgressSplash
        key={id}
        ready={!!r && r.id === id}
        title="ENTRANDO NA MESA"
        onComplete={() => setRoomReady(true)}
      />
    );
  const h = r.live || r.lastHand,
    f = h?.frames.at(-1),
    game = home.catalog.find((g) => g.id === (h?.game || r.game)),
    myturn = r.live && h.players[f.actor]?.id === me.id;
  // Derive animation time from the server's clock, not the phone's wall clock.
  // Incorrect phone time must never make a winner appear before run 3's river.
  const serverOffset = (r?.clientReceivedAt ?? time) - (r?.serverTime ?? time);
  const serverNow = time - serverOffset;
  const runoutElapsed = h?.ended == null ? 0 : Math.max(0, serverNow - h.ended);
  const showdownPresentation = showdownFlow(f, runoutElapsed, !!me.preferences?.motion);
  const revealing = !!(
    f?.finished &&
    f.runoutFrom != null &&
    !showdownPresentation.resultsReady
  );
  const awardPending = !!(f?.finished && f.runoutFrom != null && !showdownPresentation.awardsReady);
  const ownIndex = h?.players.findIndex((p) => p.id === me.id) ?? -1;
  const selectedRevealCards: number[] = h?.showCards?.[me.id] ?? [];
  const canSelectReveal = !!h && ownIndex >= 0 && (!!r.live || (!!f?.finished && r.lastHand?.id === h.id && time < (r.reviewUntil ?? 0)));

  async function toggleRevealCard(index: number) {
    if (!canSelectReveal || !h || busy) return;
    const next = selectedRevealCards.includes(index)
      ? selectedRevealCards.filter((value) => value !== index)
      : [...selectedRevealCards, index].sort((a, b) => a - b);
    setRevealConfirmation("Salvando seleção…");
    try {
      await api("showCards", { room: id, handId: h.id, indices: next });
      await refresh();
      setRevealConfirmation(next.length ? `${next.length} carta${next.length > 1 ? "s" : ""} confirmada${next.length > 1 ? "s" : ""} para mostrar` : "Nenhuma carta selecionada para mostrar");
    } catch (error) {
      setRevealConfirmation("Não foi possível confirmar as cartas");
      fail(error);
    }

  }
  const handLabel = f?.combinations?.[ownIndex]?.map(pokerText).join(" · ");
  const accepted = r.seats.some((s) => s.id === me.id),
    eligible = r.seats.filter(
      (s) =>
        !s.away && (s.stack > 0 || s.autoRefill || game.family === "Chinês"),
    ),
    dealerIndex = r.seats.findIndex((s) => s.id === r.button),
    next = [
      ...r.seats.slice(dealerIndex + 1),
      ...r.seats.slice(0, dealerIndex + 1),
    ].find((s) => eligible.includes(s));
  // The straddle is offered exclusively to the player who will be UTG
  // when the next hand is dealt; available during the current hand as well.
  const straddleActive = r.seats.filter((seat:any) => !seat.away && (seat.stack > 0 || seat.autoRefill));
  const straddleClockwise = [
    ...r.seats.slice(dealerIndex + 1),
    ...r.seats.slice(0, dealerIndex + 1),
  ].filter((seat:any) => straddleActive.includes(seat));
  const nextUtgSeat = straddleActive.length >= 3
    ? straddleClockwise[3 % straddleClockwise.length] : null;
  const isNextUtg = accepted && nextUtgSeat?.id === me.id;
  const chipSeat = chipRecipient
    ? r.seats.find((s) => s.id === chipRecipient)
    : r.session;
  const chipStack = chipSeat?.stack ?? 0;
  const minChips = Math.max(1, r.buy - chipStack);
  const maxChips = me.wallet;
  const chipAmount = chipsAmount ?? minChips;
  const canAdd = !!chipSeat && !r.live && maxChips >= minChips;
  const slots = Array.from({ length: r.capacity }, (_, i) => i);
  const occupiedSlots = new Set(r.seats.map((seat) => seat.position));
  const entryMax = me.wallet;
  const listedHands = (r.history ?? []).filter(
    (hand) =>
      String(hand.number).includes(handSearch) &&
      (historyFilter === "all" ||
        (historyFilter === "big"
          ? (hand.totalPot ?? 0) >= 1000
          : historyFilter === "mine"
          ? hand.net != null
          : historyFilter === "lost"
            ? hand.net < 0
            : historyFilter === "even"
              ? hand.net === 0
              : hand.net > 0)),
  );
  return (
    <div
      data-table-theme={theme}
      data-visual-effects={visualEffects}
      className={"studio" + (me.preferences.largeCards ? " large-cards" : "") + (mobileDock ? " mobile-game-dock" : "") + (f?.runoutCount >= 2 && f?.boards?.length >= 2 && f?.runoutFrom != null ? " royale-triple-run-active" : "") + (awardPending ? " royale-runout-settling" : "")}
    >
      {grant && (
        <Grant
          person={grant}
          room={r.id}
          destination={
            r.seats.some((s) => s.id === grant.id) &&
            !r.live &&
            !r.closed &&
            !r.tour &&
            game.family !== "Chinês"
              ? "mesa"
              : "carteira"
          }
          close={() => GrantTo(undefined)}
        />
      )}
      {receipt && <ChipReceipt {...receipt} />}
      {moveStatus && (
        <div className="move-feedback" role="status">
          {moveStatus}
          {unconfirmed && (
            <button
              disabled={busy || liveStatus === "offline"}
              onClick={() => run("move", unconfirmed)}
            >
              Verificar / reenviar
            </button>
          )}
        </div>
      )}
      <div className="studio-top">
        <img className="royale-hud-logo" src="/poker-royale-logo.svg" alt="Poker Royale" />
        <div className="row studio-nav">
          <button type="button" className="royale-top-menu" aria-label="Abrir opções da mesa" aria-haspopup="dialog" onClick={() => setTableOptions(true)}>
            <Menu size={21} aria-hidden="true" /> <span>Menu</span>
          </button>
          <button onClick={() => nav("/")}>
            <ArrowLeft size={15} /> Lobby
          </button>
          <div className="table-voice-settings" role="group" aria-label="Vozes das ações">
            <button type="button" aria-pressed={voiceEnabled} title="Ligar ou desligar narração" onClick={() => {
              const next = !voiceEnabled;
              setVoiceEnabled(next);
              localStorage.setItem("mesa-voice-enabled", String(next));
              if (!next && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              if (next) speakPokerAction('VOZES ATIVADAS', voiceVolume / 100);
            }}>{voiceEnabled ? '🔊 Vozes' : '🔇 Vozes'}</button>
            {voiceEnabled && <label className="table-voice-volume">
              <span>Volume das vozes</span>
              <input aria-label="Volume das vozes" type="range" min="0" max="100" value={voiceVolume}
                onChange={e => {const value = Number(e.target.value); setVoiceVolume(value); localStorage.setItem("mesa-voice-volume", String(value));}} />
            </label>}
          </div>
        </div>
        {!accepted && <span className="royale-spectator-status" aria-label="Modo espectador">👁 Modo espectador</span>}
        <div className="section studio-title">
          <div>
            <h1>{r.name}</h1>
            <p>
              {game.name} · {r.seats.length}/{r.capacity} jogadores{" "}
              {game.limit !== "PTS" && " · Entrada " + num(r.buy)}
            </p>
          </div>
          {!r.tour && game.limit!=="PTS" && <TableBalances rows={r.balances??[]} me={me.id} history={r.history??[]} onReplay={(hand) => setHistoryReplay(hand)}/>}
          {game.limit !== "PTS" && <button className="unit-switch" title="Alternar visualização de valores" onClick={() => {const next=!bbView;setBbView(next);localStorage.setItem("mesa-bb-view",next?"on":"off");}}>{bbView ? "BB" : "Fichas"} <span>⇄</span></button>}
          <button
            className="icon"
            hidden={!document.fullscreenEnabled}
            aria-label="Tela cheia"
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen().catch(fail)
                : document.documentElement.requestFullscreen().catch(fail)
            }
          >
            <Maximize2 />
          </button>
        </div>
      </div>
      {liveStatus === "offline" && (
        <p className="sync-notice" role="status">
          Conexão ao vivo interrompida. Reconectando…
        </p>
      )}
      {r.tour &&
        !accepted &&
        home.rooms.some(
          (room) => room.tour === r.tour && room.joined && room.id !== r.id,
        ) && (
          <button
            onClick={() =>
              nav(
                "/mesa/" +
                  home.rooms.find(
                    (room) =>
                      room.tour === r.tour && room.joined && room.id !== r.id,
                  ).id,
              )
            }
          >
            Ir para meu novo assento
          </button>
        )}
      <div className="studio-layout">
        <div className="table-stage">
          {r.own && !r.tour && !r.closed && (
            <div className="host-controls" aria-label="Controles do dono">
              {r.paused || (!r.count && !r.choiceStarted) ? (
                <button
                  disabled={busy || !!r.live || eligible.length < 2 || serverNow < (r.reviewUntil ?? 0)}
                  onClick={() => run("deal")}
                >
                  <Play size={16} />{" "}
                  {serverNow < (r.reviewUntil ?? 0)
                    ? `Analisando mão · ${Math.ceil(((r.reviewUntil ?? 0) - serverNow)/1000)}s`
                    : r.paused ? "Retomar mesa" : "Iniciar mesa"}
                </button>
              ) : (
                <button disabled={busy} onClick={() => run("pauseTable")}>
                  <Pause size={16} /> Pausar mesa
                </button>
              )}
            </div>
          )}
          {r.own && !r.tour && !r.count && !r.live && <div className="straddle-switch"><button type="button" disabled={busy} aria-pressed={!!r.straddleEnabled} onClick={()=>run("configureStraddle",{enabled:!r.straddleEnabled})}>Straddle 2× BB: {r.straddleEnabled?"Ativado":"Desativado"}</button><small>Configurável antes da primeira mão. O jogador na posição UTG decide se posta 2× BB.</small></div>}
          {false && isNextUtg && r.straddleEnabled && !r.tour && !r.closed && (
            <div className="utg-straddle-prompt" role="group" aria-label="Decisão de straddle para próximo UTG">
              <span className="utg-straddle-label">VOCÊ É O PRÓXIMO UTG</span>
              <button type="button" className="utg-straddle-button" disabled={busy || nextUtgSeat.stack < 2*r.blind}
                aria-pressed={!!nextUtgSeat.wantsStraddle}
                onClick={() => run("straddleOpt", { enabled: !nextUtgSeat.wantsStraddle })}>
                ♠ STRADDLE · {num(2*r.blind)} FICHAS
                <span>{nextUtgSeat.wantsStraddle ? "✓ Confirmado · tocar para cancelar" : "TOCAR PARA POSTAR 2× BB"}</span>
              </button>
              <small>Vale para a próxima mão. A opção some após a distribuição.</small>
            </div>
          )}
          {r.tour && accepted && !r.live && !r.roundDone && !r.count && (
            <div className="host-controls">
              <button
                disabled={busy || eligible.length < 2}
                onClick={() => run("deal")}
              >
                Iniciar mesa
              </button>
            </div>
          )}
          {r.game === "choice" &&
            !r.live && !r.paused &&
            (r.choiceStarted || r.count > 0) &&
            eligible.length >= 2 && (
              <div className="dealer-choice-spot royale-dealer-pot-anchored"
                style={{"--choice-progress": r.nextChoice?.selecting
                  ? `${Math.max(0, Math.min(100, (r.nextChoice.heldAt
                    ? r.nextChoice.remainingMs
                    : r.nextChoice.at - serverNow) / 5000 * 100))}%`
                  : "100%"} as React.CSSProperties}>
                {r.nextChoice?.confirmed ? (
                  <DealerModeAnnouncement mode={home.catalog.find((game) => game.id === r.nextChoice.id)} />
                ) : r.nextChoice?.selecting && r.nextChoice.dealer === me.id ? (
                  <button type="button" className="royale-choice-only-button" disabled={busy} onClick={openDealerChoice}>Escolher jogo</button>
                ) : r.nextChoice && serverNow < r.nextChoice.openedAt ? (
                  <span role="status" className="royale-choice-minimal-label">Próxima mão</span>
                ) : r.nextChoice ? (
                  <span role="status" className="royale-choice-minimal-label">Próximo jogo</span>
                ) : (
                  <span className="royale-choice-minimal-label">Próximo jogo</span>
                )}
              </div>
            )}
          {myturn && Array.isArray(f?.legal?.runout) && (
            <div className="royale-runout-overlay" role="dialog" aria-modal="false" aria-label="Votação de Run It Twice ou Three">
              <Actions
                key={r.rev}
                blind={r.blind}
                shortcuts={me.preferences.shortcuts}
                f={f}
                busy={busy || liveStatus === "offline"}
                limit={game.limit}
                send={submitAction}
              />
            </div>
          )}
          {r.preStraddle && !r.live && r.preStraddle.playerId === me.id && !r.paused && (
            <div className="royale-prestraddle" role="dialog" aria-label="Escolha pré-mão do UTG">
              <strong>VOCÊ É O UTG · DECIDA ANTES DAS CARTAS</strong>
              <span>Straddle opcional: {num(r.blind * 2)} fichas (2× BB). Sem decisão, segue CHECK.</span>
              <div className="royale-prestraddle-buttons">
                <button disabled={busy} onClick={() => run("preStraddle", { choice: "fold" })}>FOLD <small>Sit out</small></button>
                <button disabled={busy} onClick={() => run("preStraddle", { choice: "check" })}>CHECK <small>Sem straddle</small></button>
                <button disabled={busy} onClick={() => run("preStraddle", { choice: "straddle" })}>STRADDLE <small>2× BB</small></button>
              </div>
              <small>Tempo restante: {Math.max(0, Math.ceil((r.preStraddle.expiresAt - time)/1000))} s</small>
            </div>
          )}
          <Board
            {...{ h, f, r, me, game }}
            bb={bbView}
            handBelow
            onPlayer={setPlayer}
            onSeat={
              !accepted &&
              !r.tour &&
              !r.closed &&
              r.seats.length < r.capacity
                ? (position) => setEntry({ position, amount: r.buy })
                : undefined
            }
            revealing={revealing}
            runoutElapsed={runoutElapsed}
            choiceRemaining={r.nextChoice?.selecting ? Math.max(0, r.nextChoice.heldAt ? r.nextChoice.remainingMs : r.nextChoice.at - serverNow) : null}
            clockNow={time}
            secondsLeft={
              r.live
                ? Math.max(0, Math.ceil((r.deadline - time) / 1000))
                : undefined
            }
            turnSeconds={r.turnSeconds ?? r.seconds}
            selectedHeroCards={selectedRevealCards}
            onHeroCardClick={toggleRevealCard}
            heroCardBusy={busy}
            canSelectReveal={canSelectReveal}
          />
        </div>
        <div className={"console" + (!r.live ? " royale-between-hands" : "")}>
          {f?.hole[h.players.findIndex((p) => p.id === me.id)]?.some(
            Boolean,
          ) && (
            <div className="player-hand" aria-label="Suas cartas">
              {f.hole[h.players.findIndex((p) => p.id === me.id)].map(
                (c, j) => (
                  <button
                    key={h.id + ":" + j}
                    type="button"
                    className={"royale-own-card" + (selectedRevealCards.includes(j) ? " royale-card-marked" : "")}
                    aria-label={`Carta ${j+1}: ${c}. ${selectedRevealCards.includes(j) ? "Selecionada para revelar" : "Oculta aos adversários"}`}
                    aria-pressed={selectedRevealCards.includes(j)}
                    title={canSelectReveal ? "Selecionar carta para mostrar ao encerrar a mão" : "Janela de mostrar cartas encerrada"}
                    disabled={!canSelectReveal || busy}
                    onClick={() => toggleRevealCard(j)}
                    style={{ "--reveal-delay": j * 85 + "ms" } as React.CSSProperties}
                  >
                    <span className={showdownPresentation.resultsReady && f.awards?.some((pot) => pot.winners.some((winner) => winner.index === ownIndex && winner.cards.includes(c))) ? "winning-card" : undefined}>
                      <Card c={c} />
                    </span>
                    {selectedRevealCards.includes(j) && <span className="royale-card-reveal-check" aria-hidden="true">✓</span>}
                  </button>
                ),
              )}
            </div>
          )}
          {revealConfirmation && <small className="royale-reveal-confirmation" role="status" aria-live="polite">{revealConfirmation}</small>}
          {handLabel && !revealing && (
            <div className="hand-rank" role="status">
              <span key={handLabel}>{handLabel}</span>
            </div>
          )}
          <div className="panel actions">
            <div className="section">
              <b>
                {r.live
                  ? myturn
                    ? "Sua vez"
                    : h.players[f.actor]?.name + " está jogando"
                  : r.closed
                    ? "Mesa encerrada"
                    : r.paused
                      ? "Mesa pausada"
                      : r.count > 0 &&
                          eligible.length >= 2 &&
                          r.game !== "choice" &&
                          !r.roundDone
                        ? "Distribuição automática em instantes"
                        : "Intervalo entre mãos"}
              </b>
              <span>
                {r.live
                  ? Math.max(0, Math.ceil((r.deadline - time) / 1000)) + " s"
                  : "Mão " + r.count}
              </span>
            </div>
            {myturn && r.canExtend && (
              <button
                className="time-bank-button"
                disabled={busy}
                onClick={() => run("timeBank")}
              >
                Usar +{r.timeBank}s
              </button>
            )}
            {myturn && !Array.isArray(f?.legal?.runout) ? (
              <Actions
                key={r.rev}
                blind={r.blind}
                shortcuts={me.preferences.shortcuts}
                f={f}
                busy={busy || liveStatus === "offline"}
                limit={game.limit}
                send={submitAction}
              />
            ) : myturn && Array.isArray(f?.legal?.runout) ? (
              <p>Todos os envolvidos devem confirmar a quantidade de corridas no painel da mesa.</p>
            ) : r.live ? (
              <p>{pokerText(f.label)}</p>
            ) : (
              !r.closed && (
                <div className="row">
                  {!accepted && !r.tour && (
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        r.seats.length >= r.capacity ||
                        (r.queueLength > 0 && r.queuePosition !== 1)
                      }
                      onClick={() =>
                        setEntry({
                          position:
                            slots.find((slot) => !occupiedSlots.has(slot)) ?? 0,
                          amount: r.buy,
                        })
                      }
                    >
                      Sentar à mesa
                    </button>
                  )}
                  {!accepted && !r.tour && (
                    <button onClick={() => setInfo(true)}>
                      Regras da modalidade
                    </button>
                  )}
                  {accepted && (
                    <>
                      {!r.tour && (
                        <>

                        </>
                      )}
                    </>
                  )}
                </div>
              )
            )}
            {r.live &&
              !myturn &&
              ownIndex >= 0 &&
              f.active?.[ownIndex] !== false && (
                <div
                  className="preaction-buttons"
                  role="group"
                  aria-label="Pré-ação da próxima vez"
                >
                  {[
                    ["fold", "Desistir"],
                    ["check", "Passar"],
                    ["checkfold", "Passar ou desistir"],
                    ["call", "Pagar até…"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      data-preset={value}
                      aria-pressed={
                        preset === value && presetHand.current === h.id
                      }
                      onClick={() => {
                        const selected =
                          preset === value && presetHand.current === h.id;
                        presetHand.current = h.id;
                        presetStreet.current = f.street;
                        if (value === "call" && !selected)
                          Cap(
                            Math.min(
                              f.stacks[ownIndex],
                              Math.max(
                                r.blind,
                                Math.max(...f.bets) - f.bets[ownIndex],
                              ),
                            ),
                          );
                        Pre(selected ? "" : value);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  {preset === "call" && presetHand.current === h.id && (
                    <label className="preaction-cap">
                      Até{" "}
                      <input
                        aria-label="Limite de fichas para pagar"
                        type="number"
                        min="0"
                        step="1"
                        value={cap}
                        onChange={(e) =>
                          Cap(
                            Math.min(
                              f.stacks[ownIndex],
                              Math.max(0, Math.trunc(+e.target.value)),
                            ),
                          )
                        }
                      />{" "}
                      fichas
                    </label>
                  )}
                </div>
              )}
          </div>
          {revealing && (
            <p className="runout-summary">
              All-in ·{" "}
              {h.players
                .filter((_, index) =>
                  (f.potDetails ?? []).some((pot) =>
                    pot.eligible.includes(index),
                  ),
                )
                .map((player) => player.name)
                .join(" × ")}{" "}
              · Pote{" "}
              {num(
                f.grossPot ??
                  f.payouts.reduce((total, amount) => total + amount, 0),
              )}
              {f.paid > 0 && <> · Última ação: {num(f.paid)} fichas</>}
              {" · "}
              Carta{" "}
              {Math.min(
                f.board.length - f.runoutFrom,
                Math.max(
                  0,
                  1 +
                    Math.floor(
                      (runoutElapsed - (f.runoutDelay ?? 0)) /
                        (f.runoutStep ?? 530),
                    ),
                ),
              )}{" "}
              de {f.board.length - f.runoutFrom} na corrida
            </p>
          )}
          {f?.refunds?.length > 0 && (
            <p className="refund-summary">
              {f.refunds
                .map(
                  ({ index, amount }) =>
                    h.players[index].name +
                    " recebeu " +
                    num(amount) +
                    " de volta",
                )
                .join(" · ")}
            </p>
          )}
          {showdownPresentation.awardsReady && f?.finished && f.diamonds?.[ownIndex] > 0 && (
            <span key={h.id} className="diamond-prize">
              ◆ +{num(f.diamonds[ownIndex])} diamantes
            </span>
          )}
          {showdownPresentation.awardsReady && <Result {...{ h, f }} />}
          {!accepted && !r.closed && !r.tour && (
            <button disabled={busy} onClick={() => run("waitlist")}>
              {r.queuePosition ? "Sair da fila" : "Entrar na fila de espera"}
            </button>
          )}
          {(r.own || me.admin) && !!r.waitingPlayers?.length && (
            <details className="queue-status">
              <summary>Fila · {r.waitingPlayers.length} em espera</summary>
              {r.waitingPlayers.map((p) => (
                <button key={p.id} onClick={() => GrantTo(p)}>
                  {p.name} · Adicionar fichas
                </button>
              ))}
            </details>
          )}
          {r.queuePosition > 0 && (
            <p className="queue-status" role="status">
              {r.queuePosition === 1 && !r.live && r.seats.length < r.capacity
                ? "Sua vaga está disponível"
                : "Fila de espera · posição " + r.queuePosition}
            </p>
          )}
          {pinnedTool && (
            <button
              className="table-pinned-tool"
              onClick={() =>
                pinnedTool === "chat" ? setChatOpen(true) : setHistoryOpen(true)
              }
              disabled={pinnedTool === "history" && revealing}
            >
              {pinnedTool === "chat" ? (
                <MessageSquare size={17} />
              ) : (
                <History size={17} />
              )}
              <span>{pinnedTool === "chat" ? "Chat" : "Histórico"}</span>
            </button>
          )}
          {pendingAllIn && (
            <Modal
              title="Confirmar all-in"
              close={() => setPendingAllIn(undefined)}
            >
              <p>
                {pendingAllIn.rev === r.rev
                  ? "Esta jogada coloca todas as suas fichas da mesa em jogo."
                  : "A rodada avançou. Confira os novos comandos."}
              </p>
              <button
                className="primary"
                disabled={
                  busy || pendingAllIn.rev !== r.rev || liveStatus === "offline"
                }
                onClick={() => {
                  const { action, rev } = pendingAllIn;
                  setPendingAllIn(undefined);
                  run("move", { action, rev });
                }}
              >
                Confirmar all-in
              </button>
            </Modal>
          )}
          {tableOptions && (
            <Modal
              className="table-drawer"
              title="Opções da mesa"
              close={() => setTableOptions(false)}
            >
              <div
                aria-hidden="true"
                className="table-drawer-grip"
                onPointerDown={(e) => {
                  drawerStart.current = e.clientX;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerUp={(e) => {
                  if (e.clientX - drawerStart.current > 32)
                    setTableOptions(false);
                }}
              />
              <div className="table-options-list">
                <Field title="Intensidade dos efeitos">
                  <select value={visualEffects} onChange={(event) => {
                    setVisualEffects(event.target.value);
                    localStorage.setItem("royale-effects",event.target.value);
                  }}>
                    <option value="low">Discreta</option>
                    <option value="normal">Normal</option>
                    <option value="high">Intensa</option>
                  </select>
                </Field>
                <button onClick={() => {const next=!mobileDock;setMobileDock(next);localStorage.setItem("mesa-mobile-dock", next?"on":"off");}}>Controles mobile: {mobileDock?"ativados":"desativados"}</button>
                <button onClick={() => {const next=!bbView;setBbView(next);localStorage.setItem("mesa-bb-view",next?"on":"off");}}>Exibir valores em {bbView?"fichas":"BB"}</button>
                {r.myPendingEntry && <button onClick={() => run("cancelEntry")}>Cancelar entrada na próxima mão</button>}
                {(r.own || me.admin) && game.limit!=="PTS" && <button onClick={() => downloadText("fechamento-caixa-"+r.name+".csv", ["Jogador;Entradas;Fichas no encerramento;Resultado;Situação", ...(r.cashReport??[]).map((p:any) => [p.name,p.bought,p.cashedOut,p.cashedOut-p.bought,p.active?"Na mesa":"Saiu"].join(";"))].join("\n"))}>Exportar fechamento de caixa (.csv)</button>}
                {accepted && game.limit!=="PTS" && <div className="cash-request"><label>Solicitar fichas ao dono <input type="number" min="1" value={requestAmount} onChange={e=>setRequestAmount(+e.target.value)}/></label><button disabled={busy || requestAmount < 1} onClick={()=>run("requestChips",{amount:requestAmount})}>Enviar pedido</button></div>}
                {(r.own || me.admin) && (r.chipRequests??[]).map((q:any)=><div className="cash-request" key={q.id}><b>{q.name} pediu {num(q.amount)}</b><input type="number" min="1" aria-label={"Ajustar fichas para "+q.name} value={requestOverrides[q.id]??q.amount} onChange={e=>setRequestOverrides(old=>({...old,[q.id]:+e.target.value}))}/><button disabled={busy || (requestOverrides[q.id]??q.amount)<1} onClick={()=>run("resolveChips",{id:q.id,amount:requestOverrides[q.id]??q.amount})}>Aprovar</button><button disabled={busy} onClick={()=>run("resolveChips",{id:q.id,amount:0})}>Recusar</button></div>)}
                <Field title="Atalho fixado">
                  <select
                    value={pinnedTool}
                    onChange={(event) => {
                      setPinnedTool(event.target.value);
                      localStorage.setItem(
                        "mesa-pinned-tool",
                        event.target.value,
                      );
                    }}
                  >
                    <option value="">Nenhum</option>
                    <option value="chat">Chat</option>
                    <option value="history">Histórico</option>
                  </select>
                </Field>
                <button
                  onClick={() => {
                    setTableOptions(false);
                    setLookOpen(true);
                  }}
                >
                  Visual
                </button>
                {accepted &&
                  !r.tour &&
                  !r.closed &&
                  game.family !== "Chinês" && (
                    <button
                      className="add-chips"
                      onClick={() => {
                        setTableOptions(false);
                        setChipsAmount(undefined);
                        setChipRecipient(undefined);
                        setChipsOpen(true);
                      }}
                    >
                      + Adicionar fichas
                    </button>
                  )}

                {f?.finished && !revealing && (
                  <button
                    onClick={() => {
                      setTableOptions(false);
                      setResultHand({ hand: h, frame: f });
                    }}
                  >
                    Ver resultado
                  </button>
                )}

                <button
                  disabled={revealing}
                  onClick={() => {
                    setTableOptions(false);
                    setHistoryOpen(true);
                  }}
                >
                  <History size={15} aria-hidden="true" /> Histórico
                </button>
                <button
                  onClick={() => {
                    setTableOptions(false);
                    setChatOpen(true);
                  }}
                >
                  <MessageSquare size={15} aria-hidden="true" /> Chat
                </button>
                {(accepted || me.admin || r.own) && !r.tour && (
                  <button
                    onClick={() => {
                      setTableOptions(false);
                      setTableControls(true);
                    }}
                  >
                    Minha sessão
                  </button>
                )}

                <button
                  onClick={() => {
                    setTableOptions(false);
                    setInfo(true);
                  }}
                >
                  <CircleHelp size={15} aria-hidden="true" />{" "}
                  {f?.rows ? "Linhas e regras" : "Regras"}
                </button>
                {r.code && (
                  <button
                    onClick={() => {
                      setTableOptions(false);
                      I(true);
                    }}
                  >
                    <Link2 size={15} /> Convidar
                  </button>
                )}
                {accepted && !r.tour && r.live && !r.closed && (
                  <button disabled={busy} onClick={() => run("leaveAfterHand")}>
                    {r.session?.leaveAfterHand
                      ? "Cancelar saída programada"
                      : "Sair após esta mão"}
                  </button>
                )}
                {accepted && !r.tour && !r.live && !r.closed && (
                  <>
                    {r.seats.length < r.capacity && (
                      <select
                        aria-label="Mudar posição na mesa"
                        value={r.seats.find((p) => p.id === me.id)?.position}
                        onChange={(e) =>
                          run("seat", { position: +e.target.value })
                        }
                      >
                        {slots.map((j) => (
                          <option
                            key={j}
                            value={j}
                            disabled={
                              occupiedSlots.has(j) &&
                              r.seats.find((p) => p.id === me.id)?.position !==
                                j
                            }
                          >
                            Assento {j + 1}
                          </option>
                        ))}
                      </select>
                    )}
                    <button disabled={busy} onClick={() => run("leave")}>
                      Levantar da mesa
                    </button>
                  </>
                )}
                {r.own && !r.tour && !r.live && !r.closed && (
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => run("close")}
                  >
                    Encerrar mesa
                  </button>
                )}
              </div>
            </Modal>
          )}
          {entry && (
            <Modal title="Sentar na mesa" close={() => setEntry(undefined)}>
              <div className="entry-seats" role="group" aria-label="Assentos">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    disabled={occupiedSlots.has(slot) || (r.pendingPositions??[]).includes(slot) && r.myPendingEntry?.position !== slot}
                    aria-pressed={entry.position === slot}
                    onClick={() => setEntry({ ...entry, position: slot })}
                  >
                    {slot + 1}
                  </button>
                ))}
              </div>
              {game.family !== "Chinês" && (
                <>
                  <ChipAmount
                    label="Seu buy-in"
                    amount={Number.isFinite(entry.amount) ? entry.amount : 0}
                  />
                  <Field title="Fichas para entrar">
                    <input
                      type="number"
                      min={r.buy}
                      max={entryMax}
                      value={Number.isNaN(entry.amount) ? "" : entry.amount}
                      onChange={(e) =>
                        setEntry({ ...entry, amount: e.target.valueAsNumber })
                      }
                    />
                  </Field>
                  {entryMax >= r.buy && (
                    <input
                      type="range"
                      aria-label="Ajustar buy-in"
                      min={r.buy}
                      max={entryMax}
                      value={
                        Number.isFinite(entry.amount) ? entry.amount : r.buy
                      }
                      onChange={(e) =>
                        setEntry({ ...entry, amount: e.target.valueAsNumber })
                      }
                    />
                  )}
                  <p>
                    Entrada mínima {num(r.buy)} · Carteira {num(me.wallet)}
                  </p>
                </>
              )}
              <button
                className="primary"
                disabled={
                  busy ||
                  occupiedSlots.has(entry.position) ||
                  (r.pendingPositions??[]).some((position:number)=>position===entry.position && r.myPendingEntry?.position!==position) ||
                  (game.family !== "Chinês" &&
                    (!Number.isSafeInteger(entry.amount) ||
                      entry.amount < r.buy ||
                      entry.amount > entryMax))
                }
                onClick={() => run(r.live ? "queueEntry" : "sit", entry)}
              >
                {r.live ? "Reservar para próxima mão" : "Confirmar entrada"}
              </button>
            </Modal>
          )}
          {lookOpen && (
            <Modal title="Visual da mesa" close={() => setLookOpen(false)}>
              <div className="royale-look-presets" role="group" aria-label="Três experiências de mesa e baralho">
                {[
                  { theme: "wood", cards: "royale", name: "Arena Royale", detail: "Mesa dourada · Royal Premium" },
                  { theme: "blue", cards: "night", name: "Noite Imperial", detail: "Azul · cartas noturnas" },
                  { theme: "ruby", cards: "classic", name: "Salão Rubi", detail: "Vinho · baralho clássico" },
                ].map((preset) => (
                  <button key={preset.name} type="button" className="royale-look-preset"
                    aria-pressed={theme === preset.theme && cardStyle === preset.cards}
                    onClick={async () => {
                      setTheme(preset.theme);
                      setCardLook(preset.cards);
                      document.documentElement.dataset.cardStyle = preset.cards;
                      localStorage.setItem("mesa-table-theme", preset.theme);
                      localStorage.setItem("mesa-card-style", preset.cards);
                      try {
                        await api("appearance", { appearance: { theme: preset.theme, cards: preset.cards } });
                        await refresh();
                      } catch (error) { fail(error); }
                    }}>
                    <b>{preset.name}</b><small>{preset.detail}</small>
                  </button>
                ))}
              </div>
              <div className="table-look-options">
                {[
                  ["wood", "Clássica · madeira"],
                  ["blue", "Orbital · azul"],
                  ["violet", "Lounge · violeta"],
                  ["lagoon", "Lagoa · turquesa"],
                  ["ruby", "Rubi · vinho"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    data-look={value}
                    aria-pressed={theme === value}
                    onClick={() => {
                      setTheme(value);
                      api("appearance", {
                        appearance: { theme: value, cards: cardStyle },
                      })
                        .then(refresh)
                        .catch(fail);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Field title="Estilo das cartas">
                <select
                  value={cardStyle}
                  onChange={(e) => {
                    setCardLook(e.target.value);
                    document.documentElement.dataset.cardStyle = e.target.value;
                    api("appearance", {
                      appearance: { theme, cards: e.target.value },
                    })
                      .then(refresh)
                      .catch(fail);
                  }}
                >
                  {cardStyles.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="row">
                {["Ah", "Kc", "Qd", "Js"].map((card) => (
                  <Card key={card} c={card} />
                ))}
              </div>
            </Modal>
          )}
          {chooseGame && (
            <DealerChoice
              modes={r.rotation
                .map((key) => home.catalog.find((mode) => mode.id === key))
                .filter(Boolean)}
              active={eligible.length}
              busy={busy}
              close={closeDealerChoice}
              current={r.nextChoice?.id}
              confirm={(choice) => run("chooseNext", { choice })}
              extraUsed={!!r.nextChoice?.extraTimeUsed}
              extend={() => run("choiceExtend")}
            />
          )}
          {chipsOpen && (
            <Modal
              title={
                chipRecipient
                  ? "Enviar fichas para " + (chipSeat?.name ?? "jogador")
                  : "Adicionar fichas"
              }
              close={() => setChipsOpen(false)}
            >
              <div className="buyin-summary">
                <div>
                  <small>Na mesa</small>
                  <strong>{num(chipStack)}</strong>
                </div>
                <div>
                  <small>Na sua carteira</small>
                  <strong>{num(me.wallet)}</strong>
                </div>
                <div>
                  <small>Entrada mínima</small>
                  <strong>{num(r.buy)}</strong>
                </div>
              </div>
              {r.live ? (
                <p>Aguarde o fim da mão para adicionar fichas.</p>
              ) : !canAdd ? (
                <p>Saldo insuficiente para adicionar fichas.</p>
              ) : (
                <>
                  <ChipAmount
                    label="Fichas a adicionar"
                    amount={Number.isFinite(chipAmount) ? chipAmount : 0}
                  />
                  <Field title="Fichas a adicionar">
                    <input
                      type="number"
                      min={minChips}
                      max={maxChips}
                      step={1}
                      value={Number.isFinite(chipAmount) ? chipAmount : ""}
                      onChange={(e) => { rebuyReference.current = null; setChipsAmount(e.target.valueAsNumber); }}
                    />
                  </Field>
                  <input
                    className="buyin-slider"
                    aria-label="Ajustar quantidade de fichas"
                    type="range"
                    min={minChips}
                    max={maxChips}
                    step={1}
                    value={Number.isFinite(chipAmount) ? chipAmount : minChips}
                    onChange={(e) => { rebuyReference.current = null; setChipsAmount(+e.target.value); }}
                  />
                  <p className="buyin-range">
                    <small>Mín. {num(minChips)}</small>
                    <small>Máx. {num(maxChips)}</small>
                  </p>
                  <p>
                    Saldo na mesa após a reposição:{" "}
                    <b>
                      {num(
                        chipStack +
                          (Number.isFinite(chipAmount) ? chipAmount : 0),
                      )}
                    </b>
                  </p>
                </>
              )}
              <button
                className="primary"
                disabled={
                  busy ||
                  !canAdd ||
                  !Number.isSafeInteger(chipAmount) ||
                  chipAmount < minChips ||
                  chipAmount > maxChips
                }
                onClick={async () => {
                  B(true);
                  try {
                    const reference = rebuyReference.current ??
                      crypto.randomUUID().replaceAll("-", "");
                    rebuyReference.current = reference;
                    const confirmed = await api("rebuy", {
                      room: r.id,
                      reference,
                      amount: chipAmount,
                      expectedStack: chipStack,
                      recipient: chipRecipient,
                    });
                    rebuyReference.current = null;
                    setChipsOpen(false);
                    if (Number.isSafeInteger(confirmed?.credited)) setReceipt({
                      amount: confirmed.credited,
                      label: chipRecipient
                        ? "Fichas enviadas (confirmadas)"
                        : "Fichas adicionadas (confirmadas)",
                    });
                    await refresh();
                  } catch (e) {
                    fail(e);
                  } finally {
                    B(false);
                  }
                }}
              >
                {chipRecipient ? "Confirmar envio" : "Confirmar reposição"}
              </button>
            </Modal>
          )}
          {tableControls && (
            <Modal title="Minha sessão" close={() => setTableControls(false)}>
              {r.session && (
                <p>
                  {r.session.initialBuy != null && (
                    <>
                      Buy-in {num(r.session.initialBuy)} · Reposições{" "}
                      {num(r.session.bought - r.session.initialBuy)} ·{" "}
                    </>
                  )}
                  Entrada total: {num(r.session.bought)} · Fichas no assento:{" "}
                  {num(r.session.stack)} · Saldo:{" "}
                  <b
                    data-balance={balanceTone(
                      r.session.stack - r.session.bought,
                    )}
                  >
                    {signed(r.session.stack - r.session.bought)}
                  </b>
                </p>
              )}
              {r.session && (
                <button
                  onClick={() =>
                    downloadText(
                      "sessao-mesa-real.txt",
                      [
                        r.name,
                        "Entradas e reposições: " + num(r.session.bought),
                        "Fichas na mesa: " + num(r.session.stack),
                        "Resultado líquido: " +
                          signed(r.session.stack - r.session.bought),
                        ...(r.session.funding ?? []).map(
                          (item) =>
                            new Date(item.at).toLocaleString("pt-BR") +
                            " · " +
                            item.type +
                            " · " +
                            num(item.amount),
                        ),
                      ].join("\n"),
                    )
                  }
                >
                  Exportar sessão
                </button>
              )}
              {!!r.session?.funding?.length && (
                <details>
                  <summary>Movimentações recentes</summary>
                  <ul>
                    {r.session.funding
                      .slice()
                      .reverse()
                      .map((item, index) => (
                        <li key={index}>
                          {new Date(item.at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {item.type} · +{num(item.amount)}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
              {game.family !== "Chinês" && (
                <div className="row">
                  <button
                    disabled={busy || !!r.live}
                    onClick={() => run("rebuy")}
                  >
                    Completar entrada
                  </button>
                  <button disabled={busy} onClick={() => run("autoRefill")}>
                    {r.seats.find((seat) => seat.id === me.id)?.autoRefill
                      ? "Desativar reposição automática"
                      : "Ativar reposição automática"}
                  </button>
                </div>
              )}
              {(r.own || me.admin) && !!r.waitingPlayers?.length && (
                <div>
                  <h3>Em espera</h3>
                  {r.waitingPlayers.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setTableControls(false);
                        GrantTo(p);
                      }}
                    >
                      {i + 1}. {p.name} · Adicionar fichas
                    </button>
                  ))}
                </div>
              )}
              {r.own && (
                <div className="row">
                  <label>
                    Coanfitriões{" "}
                    <select
                      value=""
                      onChange={(e) =>
                        e.target.value && run("cohost", { id: e.target.value })
                      }
                    >
                      <option value="">Escolher jogador</option>
                      {r.seats
                        .filter((p) => p.id !== me.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {r.cohosts?.includes(p.id)
                              ? " · remover"
                              : " · adicionar"}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              )}
            </Modal>
          )}
          {resultHand && (
            <Modal
              title={"Resultado · mão #" + resultHand.hand.number}
              close={closeDealerReview}
            >
              <Result h={resultHand.hand} f={resultHand.frame} />
              {!!resultHand.frame.potDetails?.length && (
                <ul className="result-pot-details">
                  {resultHand.frame.potDetails.map((pot, index) => (
                    <li key={index}>
                      <b>
                        {index ? "Pote lateral " + index : "Pote principal"} ·{" "}
                        {num(pot.amount)}
                      </b>
                      <small>
                        Disputado por{" "}
                        {pot.eligible
                          .map(
                            (playerIndex) =>
                              resultHand.hand.players[playerIndex]?.name,
                          )
                          .filter(Boolean)
                          .join(", ")}
                      </small>
                    </li>
                  ))}
                </ul>
              )}

              {resultHand.hand.players.some((p) => p.id === me.id) && (
                <details>
                  <summary>Denunciar esta mão</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      run("report", {
                        hand: resultHand.hand.id,
                        id: data.get("target"),
                        text: data.get("reason"),
                      });
                    }}
                  >
                    <Field title="Jogador">
                      <select name="target" required>
                        {resultHand.hand.players
                          .filter((p) => p.id !== me.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field title="Motivo">
                      <input
                        name="reason"
                        required
                        minLength={3}
                        maxLength={400}
                      />
                    </Field>
                    <button disabled={busy}>Enviar denúncia</button>
                  </form>
                </details>
              )}
              {resultHand.frame.potDetails?.length > 1 && (
                <div className="summary-block">
                  <b>Quem disputou cada pote</b>
                  {resultHand.frame.potDetails.map((pot, i) => (
                    <p key={i}>
                      {i ? "Lateral " + i : "Principal"} · {num(pot.amount)} ·{" "}
                      {pot.eligible
                        .map((seat) => resultHand.hand.players[seat].name)
                        .join(", ")}
                    </p>
                  ))}
                </div>
              )}
              {resultHand.frame.awards?.map((award, index) => (
                <section className="award-detail" key={index}>
                  <h3>
                    {award.pot === 0
                      ? "Pote principal"
                      : "Pote lateral " + award.pot}
                  </h3>
                  {award.winners.length > 1 ? (
                    <p>Empate nesta parte do pote</p>
                  ) : (
                    award.uncontested && (
                      <p>Vitória sem disputa de combinação</p>
                    )
                  )}
                  {award.winners.map((winner) => (
                    <div key={winner.index}>
                      <strong>
                        {resultHand.hand.players[winner.index].name} ·{" "}
                        {num(winner.amount)} fichas
                      </strong>
                      {winner.label && <small>{pokerText(winner.label)}</small>}
                      <div className="row">
                        {winner.cards.map((card) => (
                          <Card key={card} c={card} />
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </Modal>
          )}
          {historyOpen && !historyReplay && (
            <Modal
              title="Histórico desta mesa"
              close={() => setHistoryOpen(false)}
            >
              <Field title="Buscar por número da mão">
                <input
                  inputMode="numeric"
                  value={handSearch}
                  onChange={(e) =>
                    setHandSearch(e.target.value.replace(/\D/g, ""))
                  }
                />
              </Field>
              <div className="row history-filters">
                <label>
                  Mostrar{" "}
                  <select
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value)}
                  >
                    <option value="all">Todas as mãos</option>
                    <option value="mine">Minhas mãos</option>
                    <option value="won">Minhas vitórias líquidas</option>
                    <option value="lost">Minhas perdas líquidas</option>
                    <option value="even">Minhas mãos no zero</option>
                    <option value="big">Maiores potes (1.000+ fichas)</option>
                  </select>
                </label>
                <small>{Math.min(100, listedHands.length)} mãos</small>
              </div>
              {listedHands.length > 0 && (
                <section className="royale-history-comparison" aria-label="Comparativo de participantes da sessão">
                  <h3>Comparativo de jogadores · mãos exibidas</h3>
                  <div className="royale-history-comparison-grid">
                    {Array.from(listedHands.reduce((totals: Map<string, any>, hand: any) => {
                      (hand.participants ?? []).forEach((participant: any) => {
                        const current = totals.get(participant.id) ?? { id: participant.id, name: participant.name, hands: 0, net: 0, invested: 0, received: 0 };
                        current.hands++;
                        current.net += Number(participant.net ?? 0);
                        current.invested += Number(participant.invested ?? 0);
                        current.received += Number(participant.received ?? 0);
                        totals.set(participant.id, current);
                      });
                      return totals;
                    }, new Map()).values()).sort((a: any, b: any) => b.net - a.net).slice(0, 20).map((p: any) => (
                      <div className="royale-history-comparison-player" key={p.id}>
                        <strong title={p.name}>{p.name}</strong>
                        <small>{p.hands} mãos · Apostou {num(p.invested)} · Recebeu {num(p.received)}</small>
                        <b data-balance={balanceTone(p.net)}>{signed(p.net)}</b>
                      </div>
                    ))}
                  </div>
                  <small>Totais referentes às mãos carregadas na seleção atual; não representam necessariamente toda a sessão.</small>
                </section>
              )}
              {listedHands.length ? (
                <ol className="royale-hand-history" aria-label="Mãos da sessão">
                  {listedHands.slice(0, 100).map((hand) => (
                    <li key={hand.id} className="royale-hand-entry">
                      <details>
                        <summary>
                          <span className="royale-hand-number">#{hand.number}</span>
                          <span className="royale-hand-meta">
                            <strong>{home.catalog.find((g) => g.id === hand.game)?.name ?? hand.game}</strong>
                            <small>{hand.participants.length} jogadores · {hand.ended ? new Date(hand.ended).toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"}) : "Horário indisponível"}</small>
                          </span>
                          <span className="royale-hand-pot">Pote <strong>{hand.totalPot == null ? "—" : num(hand.totalPot)}</strong></span>
                          <span className="royale-hand-net" data-balance={hand.net == null ? "none" : balanceTone(hand.net)}>
                            {hand.net == null ? "Não participou" : signed(hand.grossNet ?? hand.net)}
                          </span>
                          <span className="royale-hand-expand" aria-hidden="true">⌄</span>
                        </summary>
                        <div className="royale-hand-details">
                          <div className="royale-hand-topline">
                            <div><small>Vencedor(es)</small><strong>{hand.winners.join(", ") || "Sem vencedor"}</strong></div>
                            <div><small>Pote total</small><strong>{hand.totalPot == null ? "—" : num(hand.totalPot)}</strong></div>
                          </div>
                          <section className="royale-history-board-gallery">
                            <h4>Board e combinações vencedoras</h4>
                            {(hand.boards?.length ? hand.boards : [hand.board ?? []]).map((board, boardIndex) => {
                              const winning = new Set((hand.winningCombos ?? []).filter((combo) => combo.boardIndex === boardIndex).flatMap((combo) => combo.cards));
                              return <div className="royale-history-board-line" key={boardIndex}>
                                <small>{(hand.boards?.length ?? 1) > 1 ? `Board ${boardIndex + 1}` : "Cartas comunitárias"}</small>
                                <div className="royale-history-mini-cards">
                                  {board.map((card, i) => <span key={i} className={winning.has(card) ? "royale-history-winning-card" : ""}><Card c={card}/></span>)}
                                </div>
                              </div>;
                            })}
                            {!!hand.winningCombos?.length && <div className="royale-history-combo-legend">
                              {hand.winningCombos.map((combo, i) => <span key={i}>🏆 {hand.participants.find((player) => player.id === combo.playerId)?.name ?? "Jogador"} · {pokerText(combo.label ?? "Combinação vencedora")}</span>)}
                            </div>}
                          </section>
                          <section className="royale-hand-participants">
                            <h4>Todos os participantes · cartas, apostas e resultado</h4>
                            <div className="royale-history-player-list">
                              {hand.participants.map((player) => {
                                const comboCards = new Set((hand.winningCombos ?? []).filter((combo) => combo.playerId === player.id).flatMap((combo) => combo.cards));
                                return <div key={player.id} className="royale-history-player-row">
                                  <div className="royale-history-player-heading">
                                    <strong>{player.name}</strong>
                                    <small>{player.folded ? "FOLD" : player.won ? "Recebeu fichas" : "Participou"}</small>
                                  </div>
                                  <div className="royale-history-mini-cards" aria-label={`Cartas de ${player.name}`}>
                                    {(player.cards ?? []).map((card, i) => <span key={i} className={card && comboCards.has(card) ? "royale-history-winning-card" : ""}><Card c={card}/></span>)}
                                  </div>
                                  <div className="royale-history-player-money">
                                    <span>Apostou <b>{num(player.invested ?? 0)}</b></span>
                                    <span>Recebeu <b>{num(player.grossReceived ?? player.received ?? 0)}</b></span>
                                    <strong data-balance={balanceTone(player.net)}>{signed(player.grossNet ?? player.net)}</strong>
                                  </div>
                                </div>;
                              })}
                            </div>
                            <small className="royale-history-privacy-note">Cartas não reveladas permanecem viradas para baixo. As cartas da melhor combinação aparecem elevadas e iluminadas quando públicas.</small>
                          </section>
                          <button type="button" className="royale-hand-replay" onClick={() => setHistoryReplay(hand.id)}><Play size={15} /> Rever mão passo a passo</button>
                        </div>
                      </details>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Nenhuma mão encontrada nesta seleção.</p>
              )}
            </Modal>
          )}
          {historyReplay && (
            <Replay
              key={historyReplay}
              hand={historyReplay}
              close={() => setHistoryReplay("")}
            />
          )}
          {player &&
            (() => {
              const stats = r.results?.[player.id] ?? {
                won: 0,
                lost: 0,
                hands: 0,
              };
              const balance = stats.won - stats.lost;
              const unit = game.family === "Chinês" ? "pontos" : "fichas";
              return (
                <Modal title={player.name} close={() => setPlayer(undefined)}>
                  {(r.own || me.admin) && !r.tour && (
                    <button
                      onClick={() => {
                        GrantTo(player);
                        setPlayer(undefined);
                      }}
                    >
                      Adicionar fichas
                    </button>
                  )}
                  <PrivateNote
                    key={player.id}
                    storageKey={"mesa-note:" + me.id + ":player:" + player.id}
                    title="Nota privada neste dispositivo"
                  />
                  {player.id === me.id && !r.tour && (
                    <button type="button" className="royale-avatar-sitout" disabled={busy || !!r.live || !!r.hand}
                      onClick={() => { run("away"); setPlayer(undefined); }}>
                      {r.seats.find((seat) => seat.id === me.id)?.away ? "▶ Voltar ao jogo" : "⏸ Sit out"}
                    </button>
                  )}
                  <div className="royale-vip-player-stats">
                    <h3>Perfil do jogador {me.vip ? "· VIP" : ""}</h3>
                    <p>{stats.hands} mãos concluídas nesta mesa</p>
                    {vipLoading ? <small>Carregando estatísticas…</small> : vipStats ? (
                      <div className="royale-vip-grid">
                        <div><small>VPIP</small><strong>{vipStats.vpip == null ? "—" : vipStats.vpip + "%"}</strong></div>
                        <div><small>PFR</small><strong>{vipStats.pfr == null ? "—" : vipStats.pfr + "%"}</strong></div>
                        <div><small>3-Bet</small><strong>{vipStats.three == null ? "—" : vipStats.three + "%"}</strong></div>
                        <div><small>C-Bet</small><strong>{vipStats.cbet == null ? "—" : vipStats.cbet + "%"}</strong></div>
                        <div><small>Fator de agressividade</small><strong>{vipStats.af == null ? "—" : vipStats.af}</strong></div>
                        <div><small>Modalidade favorita</small><strong>{home.catalog.find(g => g.id === vipStats.favoriteGame)?.name ?? "—"}</strong></div>
                        <div><small>Mãos analisadas</small><strong>{vipStats.handsCount ?? stats.hands}</strong></div>
                      </div>
                    ) : <small>{player.id !== me.id && !me.vip ? "Estatísticas avançadas exclusivas para VIP." : "Estatísticas ainda não disponíveis."}</small>}
                    <small>Percentuais calculados a partir das mãos e ações registradas.</small>
                  </div>
                  <dl className="player-results">
                    <div>
                      <dt>Ganhou</dt>
                      <dd>
                        +{num(stats.won)} {unit}
                      </dd>
                    </div>
                    <div>
                      <dt>Perdeu</dt>
                      <dd data-balance={balanceTone(-stats.lost)}>
                        −{num(stats.lost)} {unit}
                      </dd>
                    </div>
                    <div>
                      <dt>Saldo</dt>
                      <dd data-balance={balanceTone(balance)}>
                        {balance > 0 ? "+" : ""}
                        {num(balance)} {unit}
                      </dd>
                    </div>
                  </dl>
                </Modal>
              );
            })()}
          {info && (
            <Modal title="Sobre a mesa" close={() => setInfo(false)}>
              <p>{game.rule}</p>{" "}
              {r.rotation.length > 0 && (
                <small>
                  Rotação ·{" "}
                  {r.rotation
                    .map((k) => home.catalog.find((g) => g.id === k).name)
                    .join(" → ")}
                </small>
              )}
              <Lines {...{ h, f }} />
            </Modal>
          )}
          {invite && (
            <Modal
              title="Convite da mesa"
              close={() => {
                I(false);
                Copy(false);
              }}
            >
              {r.own && (
                <button disabled={busy} onClick={() => run("rotateInvite")}>
                  Gerar novo convite
                </button>
              )}
              {r.codeExpires && (
                <p>
                  Válido até {new Date(r.codeExpires).toLocaleString("pt-BR")}
                </p>
              )}
              <div className="cash-shortcuts">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        location.origin + "/?convite=" + r.code,
                      );
                      Copy(true);
                    } catch {
                      fail(Error("Selecione e copie o link abaixo."));
                    }
                  }}
                >
                  {linkCopied ? "Link copiado" : "Copiar link"}
                </button>
                {!!navigator.share && (
                  <button
                    onClick={() =>
                      navigator
                        .share({
                          title: r.name,
                          url: location.origin + "/?convite=" + r.code,
                        })
                        .catch((e) => {
                          if (e.name !== "AbortError") fail(e);
                        })
                    }
                  >
                    Compartilhar
                  </button>
                )}
              </div>
              <Field title="Link para compartilhar">
                <input
                  readOnly
                  value={location.origin + "/?convite=" + r.code}
                  onFocus={(e) => e.target.select()}
                />
              </Field>
              <p>
                Código: <b>{r.code}</b>
              </p>
              <select
                defaultValue=""
                onChange={(e) =>
                  e.target.value && run("invite", { id: e.target.value })
                }
              >
                <option value="">Convidar jogador do clube</option>
                {home.people
                  .filter((p) => p.id !== me.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Modal>
          )}
          {(closingResults || (r.closed && r.closingSummary)) && (
            <TableClosingSummary summary={closingResults ?? r.closingSummary} onExit={() => nav("/")} />
          )}
          {chatOpen && (
            <Modal
              title={accepted ? "Chat da mesa" : "Chat de espectadores"}
              close={() => setChatOpen(false)}
            >
              <div className="panel studio-chat">
                {me.preferences.chatMuted ? (
                  <small>Conversa silenciada no perfil.</small>
                ) : (
                  <>
                    {r.chat.length ? (
                      r.chat.slice(-15).map((m) => (
                        <p key={m.id}>
                          <b>{m.name}</b> <time>{new Date(m.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time> · {m.text}
                        </p>
                      ))
                    ) : (
                      <small>A conversa aparece aqui.</small>
                    )}
                    <form
                      className="row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (chat.trim()) {
                          run("chat", { text: chat });
                          C("");
                        }
                      }}
                    >
                      <input
                        placeholder="Mensagem para a mesa"
                        maxLength={300}
                        value={chat}
                        onChange={(e) => C(e.target.value)}
                      />
                      <button aria-label="Enviar" disabled={busy}>
                        <Send size={17} />
                      </button>
                    </form>
                    <div className="quick">
                      {["Boa mão!", "Boa sorte!", "Bem jogado.", "👑", "👏", "🔥", "😎", "💥"].map((text) => (
                        <button
                          key={text}
                          disabled={busy}
                          onClick={() => run("chat", { text })}
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Modal>
          )}
        </div>
      </div>
    </div>
  );
}
/** Compact hand replay: never mount the full arena inside a dialog. */
function ReplayMiniature({ h, f, gameName, preview }: any) {
  const suits: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
  const validCard = (c: unknown) => typeof c === "string" && /^[2-9TJQKA][shdc]$/.test(c);
  const card = (value: unknown, key: string) => {
    const visible = validCard(value);
    const c = String(value || "");
    return <span key={key} className={"royale-replay-mini-card" + (visible ? "" : " royale-replay-mini-back") + (visible && "hd".includes(c[1]) ? " red" : "")}
      aria-label={visible ? `${c[0] === "T" ? "10" : c[0]} ${suits[c[1]]}` : "Carta oculta"}>
      {visible ? <><b>{c[0] === "T" ? "10" : c[0]}</b><i>{suits[c[1]]}</i></> : "♠"}
    </span>;
  };
  const boards: any[] = !preview && Array.isArray(f?.boards) && f.boards.length > 1
    ? f.boards : [f?.board ?? []];
  const totalPot = f?.finished
    ? (f.grossPot ?? (f.payouts ?? []).reduce((sum: number, v: number) => sum + (Number(v) || 0), 0))
    : (f?.pot ?? 0);
  return <section className="royale-replay-miniature" data-runs={boards.length} aria-label="Miniatura da mão">
    <div className="royale-replay-mini-top">
      <b>{gameName ?? h?.name ?? "Pôquer"}</b>
      <span>Pote {num(totalPot)}</span>
    </div>
    <div className="royale-replay-mini-boards" aria-label={`Cartas comunitárias: ${boards.length} corrida(s)`}>
      {boards.map((board: any, boardIndex: number) => <div className="royale-replay-mini-board" key={boardIndex}>
        <small>{boards.length > 1 ? `RUN ${boardIndex + 1}` : "BOARD"}</small>
        <div className="royale-replay-mini-cardline">
          {Array.from({length: 5}, (_, cardIndex) => card(board?.[cardIndex], `board-${boardIndex}-${cardIndex}`))}
        </div>
      </div>)}
    </div>
    <div className="royale-replay-mini-players" aria-label="Participantes da mão">
      {(h?.players ?? []).map((player: any, index: number) => <div className="royale-replay-mini-player" key={player.id ?? index}>
        <strong>{player.name}</strong>
        <div className="royale-replay-mini-cardline">{(f?.hole?.[index] ?? []).map((value: unknown, cardIndex: number) => card(value, `${index}-${cardIndex}`))}</div>
        {f?.finished && <b className={f?.payouts?.[index] > 0 ? "royale-replay-mini-gain" : ""}>{f?.payouts?.[index] > 0 ? `+${num(f.payouts[index])}` : "—"}</b>}
      </div>)}
    </div>
  </section>;
}

export function Replay({ hand, close }: any) {
  const me = useApp((s) => s.home.me),
    games = useApp((s) => s.home.catalog),
    [h, H] = useState<any>(),
    [i, setFrameIndex] = useState(0),
    [play, P] = useState(false),
    [boardPreview, setBoardPreview] = useState<number>(),
    [speed, S] = useState(1),
    [saved, setSaved] = useState(() =>
      JSON.parse(localStorage.getItem("mesa-hands") || "[]").includes(hand),
    );
  function I(index: number) {
    setBoardPreview(undefined);
    setFrameIndex(index);
  }
  useEffect(() => {
    api("replay", { hand }).then(H).catch(fail);
  }, [hand]);
  useEffect(() => {
    if (!play || !h) return;
    if (i >= h.frames.length - 1) {
      P(false);
      return;
    }
    const t = setTimeout(() => I(i + 1), 1200 / speed);
    return () => clearTimeout(t);
  }, [play, i, speed, h]);
  const f = h?.frames[i];
  const preview = boardPreview != null && f?.board.length > boardPreview;
  const replayFrame = preview
    ? { ...f, board: f.board.slice(0, boardPreview), runoutFrom: undefined }
    : f;
  return (
    <Modal title="Rever mão" close={close} className="royale-replay-dialog">
      {h && (
        <>
          <ReplayMiniature
            h={h}
            f={replayFrame}
            gameName={games.find((g: any) => g.id === h.game)?.name ?? h.name}
            preview={preview}
          />
          <div className="row royale-replay-tools">
            <button
              aria-pressed={saved}
              onClick={() => {
                const hands = JSON.parse(
                  localStorage.getItem("mesa-hands") || "[]",
                );
                localStorage.setItem(
                  "mesa-hands",
                  JSON.stringify(
                    saved
                      ? hands.filter((id) => id !== hand)
                      : [...hands, hand],
                  ),
                );
                setSaved(!saved);
              }}
            >
              {saved ? "Remover dos favoritos" : "Favoritar mão"}
            </button>
            <button
              onClick={() => {
                const end = h.frames.at(-1);
                const winners = h.players
                  .filter((_, index) => end.payouts[index] > 0)
                  .map((p) => p.name);
                navigator.clipboard
                  .writeText(
                    "Mão #" +
                      h.number +
                      " · " +
                      h.name +
                      "\nCartas da mesa: " +
                      end.board.join(" ") +
                      "\nVencedores: " +
                      winners.join(", "),
                  )
                  .catch(fail);
              }}
            >
              Copiar resumo
            </button>
          </div>
          <button className="royale-replay-export"
            onClick={() => {
              const final = h.frames.at(-1);
              const own = h.players.findIndex((player) => player.id === me.id);
              const net = final.rows
                ? final.payouts[own]
                : final.stacks[own] - h.players[own].stack;
              downloadText(
                "mao-" + h.id + ".txt",
                [
                  h.name,
                  "Resultado líquido: " + signed(net),
                  ...h.frames.map((frame) => pokerText(frame.label)),
                ].join("\n"),
              );
            }}
          >
            Exportar mão
          </button>
          {saved && (
            <PrivateNote
              storageKey={"mesa-note:" + me.id + ":hand:" + h.id}
              title="Nota privada neste dispositivo"
            />
          )}
          <Lines h={h} f={f} />
          {!preview && <Result h={h} f={f} />}
          <div className="royale-replay-action-header" aria-live="polite">
            <strong>Passo {i + 1} de {h.frames.length}</strong>
            <span>{f.by ? (h.players.find((player: any) => player.id === f.by)?.name ?? "Jogador") + " · " : ""}{pokerText(f.label)}</span>
            <small>{f.pot != null ? "Pote atual: " + num(f.pot) : ""}</small>
          </div>
          <div className="royale-replay-action-strip" aria-label="Últimas ações da mão">
            {h.frames.slice(Math.max(0,i-4),i+1).map((step: any, idx: number) => (
              <span className={idx === Math.min(4,i) ? "current" : ""} key={Math.max(0,i-4)+idx}>
                {step.by ? (h.players.find((player: any) => player.id === step.by)?.name ?? "Jogador") + ": " : ""}{pokerText(step.label ?? "Distribuição")}
              </span>
            ))}
          </div>
          <p className="royale-replay-help">Replay somente leitura · use a linha do tempo ou as setas para rever cada ação. As fichas da mesa real não são alteradas.</p>
          <div className="row replay-streets" aria-label="Ir para rodada">
            {(
              [
                [h.frames[0].board.length ? "Início" : "Pré-flop / início", 0],
                ["Flop", 3],
                ["Turn", 4],
                ["River", 5],
              ] as const
            ).flatMap(([label, count]) => {
              const index =
                count === 0
                  ? 0
                  : h.frames.findIndex((frame) => frame.board.length >= count);
              return index >= 0
                ? [
                    <button
                      key={label}
                      onClick={() => {
                        P(false);
                        setBoardPreview(count || undefined);
                        setFrameIndex(index);
                      }}
                    >
                      {label}
                    </button>,
                  ]
                : [];
            })}
            <button
              onClick={() => {
                P(false);
                I(h.frames.length - 1);
              }}
            >
              Resultado
            </button>
          </div>
          <input
            aria-label="Posição do replay"
            type="range"
            min={0}
            max={h.frames.length - 1}
            value={i}
            onChange={(e) => I(+e.target.value)}
          />
          <div className="row">
            <button onClick={() => {
              const before = h.frames.slice(0, i).map((step: any, at: number) => ({ step, at })).reverse().find(({step}: any) => step.street !== f.street || step.board.length !== f.board.length);
              P(false);
              I(before?.at ?? 0);
            }}>Rodada anterior</button>
            <button
              onClick={() => {
                const index = h.frames.findIndex(
                  (next, index) =>
                    index > i &&
                    (next.street !== f.street ||
                      next.board.length !== f.board.length),
                );
                I(index < 0 ? h.frames.length - 1 : index);
              }}
            >
              Próxima rodada
            </button>
            <button onClick={() => I(0)}>Reiniciar</button>
            <button aria-label="Voltar" disabled={!i} onClick={() => I(i - 1)}>
              <ChevronLeft />
            </button>
            <button
              aria-label="Reproduzir ou pausar"
              onClick={() => {
                if (i === h.frames.length - 1) I(0);
                P(!play);
              }}
            >
              {play ? <Pause /> : <Play />}
            </button>
            <button
              aria-label="Avançar"
              disabled={i === h.frames.length - 1}
              onClick={() => I(i + 1)}
            >
              <ChevronRight />
            </button>
            <select value={speed} onChange={(e) => S(+e.target.value)}>
              {[0.5, 1, 2, 4].map((v) => (
                <option key={v} value={v}>
                  {v}×
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </Modal>
  );
}
