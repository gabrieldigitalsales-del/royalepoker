import React, { useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "./ui";
import "./dealer-choice.css";

type Mode = {
  id: string;
  name: string;
  family: string;
  limit: string;
  rule: string;
  max: number;
};
const artwork: Record<string, [string, string, number]> = {
  texas: ["gold", "♠", 2],
  super: ["blue", "♣", 3],
  crazy: ["pink", "♥", 3],
  watermelon: ["green", "♥", 4],
  om3: ["blue", "♦", 3],
  om4: ["violet", "♦", 4],
  om5: ["gold", "♦", 5],
  om6: ["green", "♦", 6],
  om7: ["pink", "♦", 7],
  om5db: ["gold", "♦", 5],
  om6db: ["blue", "♦", 6],
  cour: ["blue", "♠", 5],
  draw: ["violet", "♣", 5],
};

function Illustration({ mode }: { mode: Mode }) {
  const [palette, suit, count] = artwork[mode.id] ?? ["gold", "♠", 3];
  return (
    <span className="dealer-art" data-palette={palette} aria-hidden="true">
      <span className="dealer-orbit" />
      <span className="dealer-sparkle dealer-sparkle-left">✦</span>
      <span className="dealer-sparkle dealer-sparkle-right">✦</span>
      <span className="dealer-chip dealer-chip-left">{suit}</span>
      <span className="dealer-chip dealer-chip-right">{suit}</span>
      <span className="dealer-fan">
        {Array.from({ length: count }, (_, i) => {
          const offset = i - (count - 1) / 2;
          return (
            <span
              className="dealer-paper"
              key={i}
              style={
                {
                  "--turn": offset * (count > 4 ? 11 : 17) + "deg",
                  "--shift": offset * (count > 4 ? 13 : 21) + "px",
                  "--lift": Math.abs(offset) * 4 + "px",
                  "--deal-delay": i * 28 + "ms",
                } as React.CSSProperties
              }
            >
              <b>{"AKQJT98"[i]}</b>
              <i>{suit}</i>
            </span>
          );
        })}
      </span>
    </span>
  );
}

export function DealerModeAnnouncement({ mode }: { mode?: Mode }) {
  if (!mode) return null;
  return (
    <div className="royale-choice-announcement" role="status" aria-live="polite">
      <div className="royale-choice-announcement-card">
        <span className="royale-choice-announcement-crest" aria-hidden="true">♛</span>
        <strong>{mode.name}</strong>
        <small>{mode.family} · {mode.limit}</small>
        <p>{mode.rule}</p>
      </div>
    </div>
  );
}

export function DealerChoice({
  modes,
  active,
  current,
  busy,
  close,
  confirm,
  extraUsed = false,
  extend,
}: {
  modes: Mode[];
  active: number;
  current?: string;
  busy: boolean;
  close: () => void;
  confirm: (id: string) => void;
  extraUsed?: boolean;
  extend?: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, x: 0, left: 0, moved: false, pointer: -1 });
  const blockClick = useRef(false);
  const [selection, setSelection] = useState(current ?? "");
  function scroll(direction: number) {
    const list = track.current;
    if (list) list.scrollBy({ left: direction * list.clientWidth * 0.72 });
  }
  return (
    <Modal title="Escolha do dealer" close={close}>
      <div className="dealer-gallery">
        <div className="dealer-gallery-nav">
          <span>{active} jogadores ativos</span>
          <button
            type="button"
            aria-label="Modalidades anteriores"
            onClick={() => scroll(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="Próximas modalidades"
            onClick={() => scroll(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div
          className="dealer-gallery-track"
          ref={track}
          role="group"
          aria-label="Modalidades disponíveis"
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            const el = track.current;
            if (!el) return;
            drag.current = { active: true, x: e.clientX, left: el.scrollLeft, moved: false, pointer: e.pointerId };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d.active || d.pointer !== e.pointerId || !track.current) return;
            if (Math.abs(e.clientX - d.x) > 7) d.moved = true;
            if (d.moved) {
              track.current.scrollLeft = d.left - (e.clientX - d.x);
              if (e.pointerType === "mouse") e.preventDefault();
            }
          }}
          onPointerUp={(e) => {
            if (drag.current.pointer === e.pointerId) {
              blockClick.current = drag.current.moved;
              drag.current.active = false;
            }
          }}
          onPointerCancel={() => { drag.current.active = false; }}
          onClickCapture={(e) => {
            if (blockClick.current) {
              e.preventDefault(); e.stopPropagation(); blockClick.current = false;
            }
          }}
        >
          {modes.map((mode, index) => (
            <button
              className="dealer-tile"
              type="button"
              key={mode.id}
              style={
                {
                  "--tile-delay": Math.min(index, 5) * 45 + "ms",
                } as React.CSSProperties
              }
              aria-pressed={selection === mode.id}
              disabled={busy || active > mode.max}
              onClick={() => {
                setSelection(mode.id);
                confirm(mode.id);
              }}
            >
              <Illustration mode={mode} />
              {selection === mode.id && (
                <span className="dealer-selected-mark">
                  <Check size={16} />
                </span>
              )}
              <span className="dealer-tile-copy">
                <small>
                  {mode.family} · {mode.limit}
                </small>
                <strong>{mode.name}</strong>
                {active > mode.max && <small>Indisponível: até {mode.max} jogadores ativos</small>}
              </span>
            </button>
          ))}
        </div>
        <div className="dealer-gallery-footer">
          <small>Toque na modalidade para confirmar. A seleção permanece sincronizada com a mesa.</small>
          {extend && <button type="button" className="dealer-extra-time" disabled={busy || extraUsed} onClick={extend}>
            {extraUsed ? "✓ Tempo extra utilizado" : "✋ +10 segundos"}
          </button>}
        </div>
      </div>
    </Modal>
  );
}
