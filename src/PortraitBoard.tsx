import { Face } from "./PlayerIdentity";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card } from "./ui";
import { num } from "./api";
import { seatPerspective } from "./seat-view.mjs";
import { revealAt } from "./runout-reveal.mjs";
import { boardResults } from "./board-results.mjs";
import { showdownFlow } from "./showdown-flow.mjs";

type Point = [number, number];
const pot: Point = [50, 35];
// All seats are normalized to the *entire stage*, not a narrow side column.
// Bottom hero, four along the top/shoulders and the remaining seats on the oval.
// Seats follow the golden oval rail, leaving the purple felt for boards.
// Values are percentages of the fixed stage (NOT the viewport).
const layouts: Record<number, Point[]> = {
  2: [[50, 80], [50, 24]],
  3: [[50, 80], [6, 51], [94, 51]],
  4: [[50, 80], [6, 51], [50, 24], [94, 51]],
  5: [[50, 80], [12, 72], [26, 26], [74, 26], [88, 72]],
  6: [[50, 80], [14, 73], [8, 36], [50, 24], [92, 36], [86, 73]],
  7: [[50, 80], [15, 73], [6, 51], [27, 26], [73, 26], [94, 51], [85, 73]],
  8: [[50, 80], [19, 74], [6, 54], [21, 27], [50, 24], [79, 27], [94, 54], [81, 74]],
  9: [[50, 80], [19, 74], [6, 54], [17, 30], [38, 24], [62, 24], [83, 30], [94, 54], [81, 74]],
  10: [[50, 80], [19, 74], [6, 54], [10, 36], [31, 25], [50, 24], [69, 25], [90, 36], [94, 54], [81, 74]],
};
const denom = [
  [1000, "#9b73d2"],
  [500, "#413f49"],
  [100, "#e9ad4a"],
  [25, "#409d79"],
  [5, "#c34a49"],
  [1, "#648caa"],
] as const;
function chips(value: number) {
  const result: string[] = [];
  let remaining = Math.max(0, Math.floor(value));
  for (const [unit, color] of denom) {
    const count = Math.floor(remaining / unit);
    remaining %= unit;
    for (let j = 0; j < Math.min(count, 3); j++) result.push(color);
  }
  return result.slice(0, 6);
}
const position = ([x, y]: Point) => ({ left: x + "%", top: y + "%" });
function betAt([x, y]: Point): Point {
  // Keep each wager next to its owner, just inside the golden rail.
  // The old 34% inward shift pushed chips toward the middle of the board.
  // Top/bottom-center seats need a small sideways offset to keep the stack
  // clear of the avatar, nameplate and the community cards.
  const centeredSeat = Math.abs(x - 50) < 1;
  return [
    x + (50 - x) * 0.17 + (centeredSeat ? (y < 50 ? 8 : -7) : 0),
    y + (49 - y) * 0.18,
  ];
}
function Pile({ amount }: { amount: number }) {
  return (
    <span aria-hidden className="pile">
      {chips(amount).map((color, i) => (
        <i
          key={i}
          className="token-disc"
          style={{ "--ink": color, "--n": i } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

export function Board({
  h,
  f,
  r,
  me,
  game,
  bb = false,
  handBelow = false,
  onPlayer,
  onSeat,
  revealing = false,
  runoutElapsed,
  secondsLeft,
  turnSeconds,
  choiceRemaining = null,
  clockNow = Date.now(),
  selectedHeroCards = [],
  onHeroCardClick,
  heroCardBusy = false,
  canSelectReveal = false,
}: any) {
  const [selectedPot, setSelectedPot] = useState<number | null>(null);
  // Never keep a side-pot selection from the previous hand.
  useEffect(() => setSelectedPot(null), [h?.id]);
  const layer = useRef<HTMLDivElement>(null),
    previous = useRef<any>(null),
    revealClock = useRef<{ key: string; elapsed: number }>(),
    awardedHand = useRef<string>("");
  const handPlayers = h?.players ?? [];
  const order = h
      ? [
          ...handPlayers,
          ...(r.seats ?? []).filter(
            (seat) => !handPlayers.some((p) => p.id === seat.id),
          ),
        ]
      : (r.seats ?? []),
    self = Math.max(
      0,
      order.findIndex((p) => p.id === me.id),
    );
  const finishFlow = showdownFlow(f, handBelow ? (runoutElapsed ?? 0) : Infinity, !!me.preferences?.motion);
  const resultsReady = !!f?.finished && finishFlow.resultsReady;
  const awardsReady = !!f?.finished && finishFlow.awardsReady;
  const settledBoards = resultsReady
    ? boardResults(f.awards ?? [], handPlayers, Math.max(1, f.boards?.length ?? 0, f.runoutCount ?? 0))
    : [];
  // End-of-hand score belongs to the live table only. Replay retains its
  // results until the viewer changes frames, while the live score fades away.
  const [scoreVisibility, setScoreVisibility] = useState<"visible" | "leaving" | "hidden">("visible");
  const manualDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (manualDismissTimer.current !== null) clearTimeout(manualDismissTimer.current);
    manualDismissTimer.current = null;
    if (!resultsReady) {
      setScoreVisibility("visible");
      return;
    }
    setScoreVisibility("visible");
    if (!handBelow) return; // Keep the full result available in hand replay.
    const fadeTimer = setTimeout(() => setScoreVisibility("leaving"), 5600);
    const removeTimer = setTimeout(() => setScoreVisibility("hidden"), 6150);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
      if (manualDismissTimer.current !== null) clearTimeout(manualDismissTimer.current);
    };
  }, [h?.id, resultsReady, handBelow]);
  const dismissScore = () => {
    if (!handBelow || !awardsReady || scoreVisibility !== "visible") return;
    setScoreVisibility("leaving");
    // A click is immediate, but the exit animation is still allowed to play.
    manualDismissTimer.current = setTimeout(() => setScoreVisibility("hidden"), 550);
  };
  const uncontestedFinish = !!f?.awards?.length && f.awards.every((award: any) => award.uncontested);
  const boardWinningCards = (boardIndex: number) => new Set<string>(
    resultsReady ? (settledBoards[boardIndex]?.winningCards ?? []) : [],
  );
  const boardCardsForSummary = (boardIndex: number) =>
    boardIndex === 0 ? (f?.board ?? []) : (f?.boards?.[boardIndex] ?? []);
  const comboCardsForWinner = (winner: any) => {
    const best: string[] = (winner.bestCards?.length === 5 ? winner.bestCards : (winner.cards ?? [])).filter((card: string) => /^[2-9TJQKA][shdc]$/.test(card)).slice(0, 5);
    // A-2-3-4-5 straight is easier to read left-to-right as A 2 3 4 5.
    const ranks = best.map(card => card[0]);
    if (best.length === 5 && ['A','2','3','4','5'].every(rank => ranks.includes(rank))) {
      return [...best].sort((a, b) => ['A','2','3','4','5'].indexOf(a[0]) - ['A','2','3','4','5'].indexOf(b[0]));
    }
    return best;
  };
  const capacity = handBelow
    ? (r.capacity ?? Math.max(2, order.length))
    : Math.max(2, order.length);
  const places = layouts[capacity] || [[50, 91] as Point];
  const seatPosition = ([x, y]: Point): Point => [x,y];
  const slots = new Map<string, number>();
  const assigned = new Set<number>();
  if (handBelow) {
    for (const seat of r.seats ?? []) {
      slots.set(seat.id, seat.position);
      assigned.add(seat.position);
    }
  }
  const perspective = seatPerspective(capacity, slots.get(me.id) ?? 0);
  // A player who left after this hand can still be shown if their chair is free.
  for (const player of handBelow && !onSeat ? order : []) {
    if (
      !slots.has(player.id) &&
      Number.isInteger(player.position) &&
      player.position >= 0 &&
      player.position < capacity &&
      !assigned.has(player.position)
    ) {
      slots.set(player.id, player.position);
      assigned.add(player.position);
    }
  }
  const seatIndex = (i: number) => {
    if (!handBelow) return (i - self + capacity) % capacity;
    const slot = slots.get(order[i]?.id);
    return slot == null ? -1 : perspective.visual(slot);
  };
  const point = (i: number): Point =>
    seatPosition(places[seatIndex(i)] || [50, 91]);
  const occupied = new Set(order.map((_, i) => seatIndex(i)));
  const label = (v: number) =>
    bb && r.blind && !f?.rows
      ? (v / r.blind).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) +
        " BB"
      : num(v);
  const frameIndex =
    f?.sequence ?? (h?.frames.length > 1 ? h.frames.indexOf(f) : 0);
  const id = h?.id || "",
    key = id + ":" + frameIndex;
  if (revealClock.current?.key !== key) {
    revealClock.current = { key, elapsed: runoutElapsed ?? 0 };
  }
  const elapsedAtArrival = revealClock.current.elapsed;
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = { id, idx: frameIndex, f };
    if (
      !f ||
      f.rows ||
      !layer.current ||
      me.preferences?.motion ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const surface = layer.current,
      box = surface.getBoundingClientRect(),
      speed = me.preferences?.speed === "rapida" ? 0.58 : 1;
    function fly(
      start: Point,
      end: Point,
      value: number,
      delay: number,
      kind: string,
    ) {
      const dx = ((end[0] - start[0]) * box.width) / 100,
        dy = ((end[1] - start[1]) * box.height) / 100;
      const isAward = kind === "award";
      chips(value).forEach((color, j) => {
        const el = document.createElement("i");
        el.className = "flying-token token-disc";
        el.dataset.flight = kind;
        Object.assign(el.style, position(start));
        el.style.setProperty("--ink", color);
        surface.append(el);
        const finishX = dx + ((j % 3) - 1) * 3,
          finishY = dy - Math.floor(j / 3) * 2;
        const animation = el.animate(
          [
            { transform: "translate(-50%,-50%) scale(.76)", opacity: 0 },
            { offset: 0.14, opacity: 1 },
            {
              offset: 0.6,
              transform:
                "translate(calc(-50% + " +
                dx * 0.63 +
                "px),calc(-50% + " +
                (dy * 0.59 - (isAward ? 78 : 12)) +
                "px)) rotate(-25deg) scale(" +
                (isAward ? 1.56 : 1.12) +
                ")",
            },
            { offset: 0.91, opacity: 1 },
            {
              transform:
                "translate(calc(-50% + " +
                finishX +
                "px),calc(-50% + " +
                finishY +
                "px)) rotate(8deg)",
              opacity: 0,
            },
          ],
          {
            duration: (isAward ? 650 : 410) * speed,
            // Keep the time-to-payout synchronized with the board/reveal clock;
            // changing animation speed must not accelerate the award itself.
            delay: isAward ? delay + j * 32 : (delay + j * 32) * speed,
            easing: "cubic-bezier(.21,.67,.28,1)",
            fill: "both",
          },
        );
        animation.onfinish = () => el.remove();
        animation.oncancel = () => el.remove();
      });
    }
    if (old?.id !== id) {
      surface.replaceChildren();
      if (frameIndex === 0 && !f.finished)
        f.bets.forEach((v, i) => {
          if (v) fly(point(i), betAt(point(i)), v, 80, "blind");
        });
      return;
    }
    if (frameIndex !== old.idx + 1 || !old.f) {
      surface.replaceChildren();
      return;
    }
    const actor = order.findIndex((p) => p.id === f.by),
      paid = f.paid ?? 0;
    if (actor >= 0 && seatIndex(actor) >= 0 && paid > 0)
      fly(point(actor), betAt(point(actor)), paid, 0, "bet");
    const collect = f.finished || f.street !== old.f.street;
    f.refunds?.forEach(({ index, amount }) => {
      if (seatIndex(index) >= 0)
        fly(betAt(point(index)), point(index), amount, 150, "refund");
    });
    if (collect) {
      old.f.bets.forEach((v, i) => {
        const stake =
          v +
          (i === actor ? paid : 0) -
          (f.refunds?.find((refund) => refund.index === i)?.amount ?? 0);
        if (stake > 0 && seatIndex(i) >= 0)
          fly(betAt(point(i)), pot, stake, paid ? 330 : 40, "collect");
      });

    }
  }, [key]);
  // All prize flights are triggered by the presentation phase, never by the
  // engine's finished flag. This cannot race ahead of run 3's last river card.
  useLayoutEffect(() => {
    if (!handBelow || !f?.finished || !awardsReady || !layer.current) return;
    if (awardedHand.current === id) return;
    awardedHand.current = id;
    const surface = layer.current;
    if (me.preferences?.motion || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const box = surface.getBoundingClientRect();
    const flights: Animation[] = [];
    const launch = (seat: number, amount: number, order: number) => {
      if (!Number.isFinite(amount) || amount <= 0 || seatIndex(seat) < 0) return;
      const destination = point(seat);
      const dx = (destination[0] - pot[0]) * box.width / 100;
      const dy = (destination[1] - pot[1]) * box.height / 100;
      chips(amount).forEach((color, index) => {
        const chip = document.createElement("i");
        chip.className = "flying-token token-disc royale-final-award-token";
        chip.dataset.flight = "award";
        Object.assign(chip.style, position(pot));
        chip.style.setProperty("--ink", color);
        surface.append(chip);
        const flight = chip.animate([
          {transform:"translate(-50%,-50%) scale(.68)",opacity:0},
          {offset:.12,transform:"translate(-50%,-50%) scale(1.24)",opacity:1},
          {offset:.55,transform:`translate(calc(-50% + ${dx*.56}px),calc(-50% + ${dy*.45-55}px)) rotate(-22deg) scale(1.52)`,opacity:1},
          {offset:.87,opacity:1},
          {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(9deg) scale(.84)`,opacity:0}
        ], {duration:950,delay:order*125+index*48,easing:"cubic-bezier(.2,.67,.23,1)",fill:"both"});
        flights.push(flight);
        flight.onfinish=()=>chip.remove();
        flight.oncancel=()=>chip.remove();
      });
    };
    if (f.awards?.length) {
      f.awards.forEach((potAward: any, order: number) =>
        potAward.winners?.forEach((winner: any) => launch(winner.index,winner.amount,order)));
    } else {
      f.payouts?.forEach((amount: number, seat: number) => launch(seat,amount,seat));
    }
    return () => {
      for (const flight of flights) flight.cancel();
    };
  }, [id, awardsReady, handBelow]);
  const code = game?.id?.startsWith("om")
    ? "PLO " + game.id[2] + (game.id.endsWith("lo") ? " HI/LO" : "")
    : game?.name;
  const boardGameTitle = game?.id?.endsWith("db")
    ? `${code} Double Board`
    : null;
  const runoutSelections = (h?.frames ?? [])
    .filter((frame: any) => frame.action === "runout")
    .map((frame: any) => ({
      name: h?.players?.find((player: any) => player.id === frame.by)?.name ?? String(frame.label ?? "Jogador").split(" · ")[0],
      count: Number(String(frame.label ?? "").match(/Escolheu (\d+)/)?.[1] ?? 1),
    }));
  const finalRunout = Math.max(1, Number(f?.runoutCount ?? 1));
  // Run It Twice and Three use the same owner-anchored card fan. This also
  // keeps the hero's normal console cards off the community board corridor.
  const tripleRunActive = finalRunout >= 2 && (f?.boards?.length ?? 0) >= 2 && f?.runoutFrom != null;
  const heroSeatIndex = order.findIndex((player: any) => player.id === me.id);
  const heroSeatPoint = heroSeatIndex >= 0 && seatIndex(heroSeatIndex) >= 0 ? point(heroSeatIndex) : null;
  const heroCards = heroSeatIndex >= 0 ? (f?.hole?.[heroSeatIndex] ?? []) : [];

  // Card progression follows the authoritative reveal clock even with reduced motion.
  const runoutAnimates = f?.finished && f?.runoutFrom != null;
  const showRunoutCard = (boardIndex: number, cardIndex: number) =>
    !runoutAnimates || revealAt({
      runIndex: boardIndex, cardIndex,
      from: f.runoutFrom,
      elapsed: runoutElapsed ?? Infinity,
      delay: f.runoutDelay ?? 650,
      step: f.runoutStep ?? 530,
    });
  const runoutBanner = runoutSelections.length > 0
    ? f?.finished
      ? (finalRunout === 3 ? "VAMOS LÁ, BATER 3!" : finalRunout === 2 ? "VAMOS LÁ, BATER DUAS!" : "É CÔCO!")
      : `${runoutSelections.at(-1)?.name} selecionou ${runoutSelections.at(-1)?.count}× · DEAL`
    : null;
  const Avatar = onPlayer ? "button" : "div";
  // Showdown cards live at table level, never inside an avatar stacking context.
  const publicOpponentHands = f?.finished && finishFlow.cardsVisible
    ? order.flatMap((player: any, index: number) => {
        if (player.id === me.id || seatIndex(index) < 0) return [];
        const cards: string[] = (f?.hole?.[index] ?? []).filter((card: unknown) =>
          typeof card === "string" && /^[2-9TJQKA][shdc]$/.test(card),
        );
        if (!cards.length) return [];
        const [seatX, seatY] = point(index);
        // Anchor the fan to its owner's avatar along the GOLDEN RAIL.
        // Top seats open toward the side, lower seats open above the avatar.
        // Never use the centre of the community-board area as an anchor.
        const isTop = seatY <= 34;
        const isBottom = seatY >= 65;
        const side = seatX < 50 ? "left" : "right";
        const x = isTop
          ? Math.max(12, Math.min(88, seatX + (seatX < 50 ? -4 : 4)))
          : Math.max(12, Math.min(88, seatX));
        const y = isTop ? seatY + 9 : isBottom ? seatY - 12 : seatY - 13;
        return [{ player, index, cards, x, y, side }];
      })
    : [];
  return (
    <div
      className={"portrait-table" + (game?.id?.endsWith("db") ? " royale-double-mode" : "") + " cloth-" + (me.preferences?.felt || "verde") + (f?.boards?.length > 1 ? " royale-multiple-boards royale-boards-" + Math.min(3, f.boards.length) + (game?.id?.endsWith("db") ? " royale-double-board" : "") : "") + (handBelow && f?.finished && f?.runoutFrom != null && (f?.boards?.length ?? 0) > 1 ? (!resultsReady ? " royale-ceremony-dealing" : !awardsReady ? " royale-ceremony-showdown" : " royale-ceremony-payout") : "")}
      data-capacity={capacity}
      aria-label="Mesa de poker"
    >
      {h?.cucurucho && <div className="royale-cucu-banner" role="status">
        👑 CUCURUCHO · {f?.finished
          ? (f.awards?.some((award: any) => !award.uncontested) ? "SHOWDOWN" : "VITÓRIA POR DESISTÊNCIA")
          : f?.cucuruchoPhase === "decision"
            ? `${f.cucuruchoAccepted?.length ?? 0} confirmaram · FICAR & PAGAR`
            : `${label(h.cucuruchoAnte)} ANTE · FLOP`}
      </div>}
      {h?.bomb && <div key={h.id} className="royale-bomb-alert" aria-label="Bomb Pot da rodada">
        <span className="royale-bomb-icon">💣<i className="royale-bomb-shockwave" />{Array.from({length:10},(_,i)=><i key={i} className="royale-bomb-spark" style={{"--spark":i} as React.CSSProperties}/>)}</span>
        <strong>BOMB POT!</strong>
        <small>Ante {label(h.bombAnte)} · Direto ao flop</small>
      </div>}
      <div className={"table-rail" + (choiceRemaining !== null ? " royal-choice-active" : "")} aria-hidden="true" />
      <div className="table-wordmark">
        <img className="royale-table-watermark" src="/poker-royale-logo.svg" alt="" aria-hidden="true" />
        <strong>{code}</strong>
        <span>{r.name || h?.name}</span>
        <small>
          {game?.limit === "PTS"
            ? "Pontos"
            : game?.family === "Stud"
              ? "Aposta " + r.blind
              : "Blinds " + r.blind / 2 + " / " + r.blind}
        </small>
      </div>
      {handBelow && f?.finished && f?.runoutFrom != null && (f?.boards?.length ?? 0) > 1 && (
        <div className="royale-ceremony-banner" aria-live="polite" aria-label={awardsReady ? "Prêmio entregue" : resultsReady ? "Mão vencedora revelada" : "Revelação das cartas"}>
          {awardsReady ? "POTE ENTREGUE" : resultsReady ? "MÃO VENCEDORA" : "REVELANDO OS BORDOS"}
        </div>
      )}
      <div className="royale-board-cluster">
      {f && !f.rows && (
        <div className="pot-tag" style={position(pot)}>
          <div className="center-chips" aria-hidden>
            {(!f.finished || !awardsReady) &&
              Array.from(
                {
                  length: Math.min(
                    5,
                    Math.max(
                      0,
                      Math.ceil(
                        (f.finished
                          ? f.payouts.reduce((a, b) => a + b, 0)
                          : f.pot) / Math.max(1, r.blind * 2),
                      ),
                    ),
                  ),
                },
                (_, i) => (
                  <Pile
                    key={i}
                    amount={Math.max(1, Math.floor(f.pot / (i + 1)))}
                  />
                ),
              )}
          </div>
          <span className="royale-pot-value-bubble">
            <small className="royale-pot-inside-label">POT</small>
            <strong className="royale-pot-main-number">
              {label(
                f.finished
                  ? (f.grossPot ?? f.payouts.reduce((a, b) => a + b, 0))
                  : f.pot,
              )}
            </strong>
          </span>
          {!!f.potDetails?.length && (
            <div className="pot-parts">
              {f.potDetails.map((part, index) => (
                <button
                  type="button"
                  key={index}
                  className={selectedPot === index ? "royale-pot-selected" : ""}
                  onClick={() => setSelectedPot(selectedPot === index ? null : index)}
                  aria-expanded={selectedPot === index}
                  title={part.eligible
                    .map((seatIndex) => handPlayers[seatIndex]?.name)
                    .filter(Boolean)
                    .join(", ")}
                >
                  {index === 0 ? "Principal" : "Lateral " + index} ·{" "}
                  {label(part.amount)}
                </button>
              ))}
            </div>
          )}
          {selectedPot !== null && f.potDetails?.[selectedPot] && (
            <div className="royale-pot-eligibility" role="status">
              <b>{selectedPot ? `Pote lateral ${selectedPot}` : "Pote principal"}</b>
              <span>Disputado por {f.potDetails[selectedPot].eligible.map((seat: number) => handPlayers[seat]?.name).filter(Boolean).join(", ")}</span>
            </div>
          )}
        </div>
      )}
      {boardGameTitle && <div className="royale-board-game-name" aria-label="Modalidade atual na mesa">{boardGameTitle}</div>}
      {(["Hold’em", "Omaha"].includes(game?.family) ||
        game?.id === "drawmaha" ||
        !!f?.board.length) && (
        <div className="portrait-board royale-board-row" aria-label={game?.id?.endsWith("db") ? "Primeiro bordo do Double Board" : "Bordo principal"}>
          {(!game?.id?.endsWith("db") && (f?.boards?.length ?? 0) > 1) && <small className="double-board-first-label">RUN 1</small>}
          {Array.from({ length: Math.max(5, f?.board.length ?? 0) }, (_, i) => {
            const card = f?.board[i];
            return card && showRunoutCard(0, i) ? (
              <span
                key={id + card}
                className={
                  i >= 3 ? "community-reveal street-reveal" : "community-reveal"
                }
                style={
                  {
                    "--reveal-delay":
                      runoutAnimates
                        ? "0ms"
                        : i < 3
                          ? i * 160 + "ms"
                          : "0ms",
                  } as React.CSSProperties
                }
              >
                <span
                  className={
                    boardWinningCards(0).has(card) ? "winning-card royale-winning-community" : undefined
                  }
                >
                  <Card c={card} />
                </span>
              </span>
            ) : (
              <span key={i} className="board-slot" aria-hidden />
            );
          })}
        </div>
      )}
      {!!f?.boards?.length && f.boards.length > 1 && (
        <div className="extra-runout-boards" aria-label="Bordos adicionais">
          {f.boards.slice(1).map((cards: string[], index: number) => (
            <div className="extra-board royale-board-row" key={index} aria-label={game?.id?.endsWith("db") ? `Segundo bordo do Double Board` : `Run ${index + 2}`}>
              {!game?.id?.endsWith("db") && <small>{"RUN " + (index + 2)}</small>}
              <span className="extra-board-cards">
                {Array.from({length:5}, (_, i) => {
                  const card = cards[i];
                  const visible = !!card && showRunoutCard(index + 1, i);
                  return <span className={"mini-board-card " + (visible ? "runout-card-visible" : "runout-card-pending")} key={i}>
                    {visible ? <span className={boardWinningCards(index + 1).has(card) ? "winning-card royale-winning-community" : undefined}><Card c={card} /></span> : <span className="board-slot" aria-label="Carta ainda não revelada" />}
                  </span>;
                })}
              </span>
            </div>
          ))}
        </div>
      )}
      </div>
      {resultsReady && settledBoards.length > 0 && scoreVisibility !== "hidden" && (
        <div
          className={"royale-showdown-results royale-run-score royale-score-" + scoreVisibility}
          role="region"
          aria-label="Resultado final das corridas"
          aria-live="polite"
          onClick={handBelow ? dismissScore : undefined}
          title={handBelow ? "Toque para fechar o resultado" : undefined}
        >
          <div className="royale-run-score-title">
            <span>RESULTADO DA MÃO</span>
            {handBelow && <button className="royale-score-dismiss" type="button" aria-label="Fechar resultado da mão" onClick={(event) => { event.stopPropagation(); dismissScore(); }}>×</button>}
          </div>
          {settledBoards.map((entry: any) => (
            <section className={"royale-run-score-item" + (entry.tied ? " royale-run-score-tie" : "")} key={entry.boardIndex}>
              <div className="royale-run-score-heading">
                <strong>{game?.id?.endsWith("db") ? "BOARD" : "RUN"} {entry.boardIndex + 1}</strong>
                <small>{entry.tied ? "EMPATE" : entry.winners.length > 1 ? "POTES DIVIDIDOS" : entry.winners.length ? (uncontestedFinish ? "SEM SHOWDOWN" : "VENCEDOR") : (uncontestedFinish ? "NÃO DISPUTADO" : "SEM PREMIAÇÃO")}</small>
              </div>
              {entry.winners.length ? entry.winners.map((winner: any) => {
                const combo = comboCardsForWinner(winner);
                return <div key={winner.index} className="royale-run-score-player">
                  <div className="royale-run-score-identity">
                    <b><span aria-hidden="true">{entry.tied ? "🤝" : "👑"}</span> {winner.name}</b>
                    {awardsReady ? <strong>+{label(winner.amount)}</strong> : <strong className="royale-award-pending">MÃO VENCEDORA</strong>}
                  </div>
                  <small>{winner.label ?? (combo.length ? "Melhor combinação" : "Mão não revelada")}</small>
                  {combo.length === 5 && <div className="royale-run-score-five" aria-label={`Cinco cartas da combinação de ${winner.name}`}>
                    {combo.map((card: string, i: number) => (
                      <span key={`${card}-${i}`} className="royale-run-score-card" data-suit={card[1]} aria-label={`${card[0] === 'T' ? '10' : card[0]} de ${{s:'espadas',h:'copas',d:'ouros',c:'paus'}[card[1]]}`}>
                        <b>{card[0] === 'T' ? '10' : card[0]}</b><i>{{s:'♠',h:'♥',d:'♦',c:'♣'}[card[1]]}</i>
                      </span>
                    ))}
                  </div>}
                </div>;
              }) : <p className="royale-run-score-empty">{uncontestedFinish ? "Pote decidido sem disputa; não há prêmio separado neste run." : "Sem premiação registrada nesta corrida."}</p>}
            </section>
          ))}
        </div>
      )}
      {runoutBanner && !resultsReady && (
        <div className="royale-runout-announcement" role="status">
          <strong>{runoutBanner}</strong>
          <span>{runoutSelections.map((v: any) => `${v.name}: ${v.count}×`).join("  ·  ")}</span>
          <small>{!f?.finished ? "Aguardando os demais jogadores" : finalRunout === 1 ? "Votos diferentes: uma corrida" : `Todos confirmaram ${finalRunout}×`}</small>
        </div>
      )}
      {handBelow &&
        places.map(
          (place, index) =>
            !occupied.has(index) &&
            (onSeat ? (
              <button
                type="button"
                className="empty-chair seat-option"
                key={index}
                aria-label={
                  "Sentar no assento " + (perspective.physical(index) + 1)
                }
                style={position(seatPosition(place))}
                onClick={() => onSeat(perspective.physical(index))}
              >
                {perspective.physical(index) + 1}
              </button>
            ) : (
              <span
                key={index}
                className="empty-chair"
                aria-hidden="true"
                style={position(seatPosition(place))}
              />
            )),
        )}
      {order.map((p, i) => {
        if (seatIndex(i) < 0) return null;
        const pt = point(i),
          won = awardsReady && f.payouts[i] > 0,
          latest =
            f?.by === p.id ? f.label?.split(" · ").slice(1).join(" · ") : "",
          net = won && !f.rows ? f.stacks[i] - h.players[i].stack : 0,
          badge = won
            ? net > 0
              ? "+" + num(net)
              : "Venceu"
            : latest
              ? ({
                  Passou: "Passou",
                  Pagou: "Pagou",
                  Raise: "Aumentou",
                  Bet: "Apostou",
                  Fold: "Desistiu",
                }[latest.split(" ")[0]] ?? latest.split(" ")[0])
              : f?.blinds?.[i]
                ? f.blinds[i] >= h.blind * 2
                  ? "STRADDLE 2×"
                  : f.blinds[i] >= h.blind
                    ? "BB"
                    : "SB"
                : "";
        return (
          <React.Fragment key={p.id}>
            <div
              data-player-id={p.id}
              className={
                "portrait-seat " +
                (pt[0] > 55 ? "right " : "") +
                (f?.actor === i ? "acting " : "") +
                (won ? "winner " : "") +
                (publicOpponentHands.some((entry: any) => entry.index === i) ? " has-public-showdown " : "") +
                (latest === "Fold" ? "folded " : "") +
                (r.seats?.find((seat) => seat.id === p.id)?.away ? " seat-sitout" : "")
              }
              style={
                {
                  ...position(pt),
                  "--clock-progress":
                    (secondsLeft == null
                      ? 0
                      : Math.max(
                          0,
                          Math.min(100, (secondsLeft / turnSeconds) * 100),
                        )) + "%",
                  "--avatar-color": [
                    "#6a807d",
                    "#846257",
                    "#6c6791",
                    "#887349",
                    "#485e7d",
                    "#6e7450",
                  ][i % 6],
                } as React.CSSProperties
              }
            >
              <Avatar
                className="portrait-avatar"
                aria-label={onPlayer ? "Resultado de " + p.name : undefined}
                onClick={onPlayer ? () => onPlayer(p) : undefined}
              >
                <Face player={r.seats?.find((seat) => seat.id === p.id) ?? p} />
              </Avatar>
              {r.seats?.find((seat) => seat.id === p.id)?.away && (
                <span className="sitout-badge">Sit out</span>
              )}
              {r.chat?.filter((message:any) => message.by===p.id && clockNow>=message.at && clockNow-message.at<2000).slice(-1).map((message:any)=>(
                <div key={message.id} className="seat-chat-bubble" role="status" aria-label={p.name+': '+message.text}>{message.text}</div>
              ))}
              {i === f?.actor && secondsLeft != null && (
                <span
                  className={"turn-clock" + (secondsLeft <= 5 ? " urgent" : "")}
                  style={
                    {
                      "--clock-progress":
                        Math.max(
                          0,
                          Math.min(100, (secondsLeft / turnSeconds) * 100),
                        ) + "%",
                    } as React.CSSProperties
                  }
                  aria-label={secondsLeft + " segundos restantes"}
                >
                  {secondsLeft}s
                </span>
              )}
              <div
                className={"pocket " + (p.id === me.id ? "faceup" : "")}
                hidden={handBelow && p.id === me.id}
                style={
                  { "--count": f?.hole[i]?.length || 0 } as React.CSSProperties
                }
              >
                {f?.hole[i]?.map((c, j) => (
                  <span
                    key={id + ":" + j}
                    style={{ "--j": j } as React.CSSProperties}
                  >
                    <Card c={c} />
                  </span>
                ))}
              </div>
              {badge && (
                <strong
                  className={
                    "seat-badge b-" + (won ? "venceu" : badge.toLowerCase())
                  }
                >
                  {badge}
                </strong>
              )}
              {r.cucuruchoEnabled && r.cucuruchoMarker === p.id && <span className="royale-cucu-marker" title="Marcador Cucurucho">CUCU</span>}
              <div className="nameplate">{p.name}</div>
              {r.seats?.find((seat) => seat.id === p.id)?.connected ===
                false && <small className="offline-seat">Offline</small>}
              <b className="stackplate">
                {f?.rows
                  ? num(f.payouts[i] ?? p.points ?? 0) + " pts"
                  : !awardsReady && f?.finished && f?.runoutFrom != null && handBelow
                    ? "—"
                    : label(f?.stacks[i] ?? p.stack)}
              </b>
              {(h?.button || r.button) === p.id && (
                <i className="dealer-marker">D</i>
              )}
            </div>
            {f?.bets[i] > 0 && (
              <div className="felt-stake" style={position(betAt(pt))}>
                <Pile amount={f.bets[i]} />
                <span>{label(f.bets[i])}</span>
              </div>
            )}
          </React.Fragment>
        );
      })}
      {tripleRunActive && heroSeatPoint && heroCards.some(Boolean) && (
        <div
          className="royale-triple-hero-cards"
          style={{
            left: `calc(${heroSeatPoint[0]}% + clamp(56px, 5.8vw, 108px))`,
            top: `${Math.max(14, heroSeatPoint[1] - 4)}%`,
            "--hero-card-count": heroCards.length,
          } as React.CSSProperties}
          aria-label="Suas cartas ao lado do avatar durante múltiplas corridas"
        >
          {heroCards.map((card: string, j: number) => (
            <button
              type="button"
              key={`${h?.id}:triple:${j}`}
              aria-label={`Carta ${j + 1}: ${card}. ${selectedHeroCards.includes(j) ? "Selecionada para revelar" : "Oculta aos adversários"}`}
              aria-pressed={selectedHeroCards.includes(j)}
              disabled={!canSelectReveal || heroCardBusy || !onHeroCardClick}
              onClick={() => onHeroCardClick?.(j)}
              className={"royale-triple-hero-card" + (selectedHeroCards.includes(j) ? " royale-card-marked" : "")}
              style={{ "--card-index": j, "--fan-angle": `${(j - (heroCards.length - 1) / 2) * 7}deg` } as React.CSSProperties}
            >
              <Card c={card} />
              {selectedHeroCards.includes(j) && <i aria-hidden="true">✓</i>}
            </button>
          ))}
        </div>
      )}
      {publicOpponentHands.map(({player, index, cards, x, y, side}: any) => (
        <div
          key={player.id + ":showdown:" + id}
          className={"royale-opponent-showdown royale-showdown-fan-" + side + (awardsReady && f?.payouts?.[index] > 0 ? " royale-opponent-showdown-win" : "")}
          style={{left: x + "%", top: y + "%", "--showdown-count": cards.length} as React.CSSProperties}
          aria-label={"Cartas reveladas de " + player.name}
        >
          <small>{player.name}</small>
          <div className="royale-opponent-showdown-cards">
            {cards.map((card: string, j: number) => <span key={j} className={"royale-opponent-showdown-card" + (resultsReady && settledBoards.some((board: any) => board.winners.some((winner: any) => winner.index === index && winner.cards.includes(card))) ? " royale-showdown-best-card" : "")} style={{"--fan-rotation": `${(j - (cards.length - 1) / 2) * 8}deg`, "--fan-lift": `${Math.pow(j - (cards.length - 1) / 2, 2) * 1.4}px`} as React.CSSProperties}><Card c={card}/></span>)}
          </div>
          {awardsReady && f?.payouts?.[index] > 0 && <span className="royale-showdown-crown" aria-hidden="true">👑</span>}
        </div>
      ))}
      <div ref={layer} className="flight-layer" aria-hidden />
    </div>
  );
}
