import React, { useEffect, useId, useRef } from "react";
import { useApp } from "./api";
import { X, Spade } from "lucide-react";
export function Brand() {
  return <span className="brand poker-royale-brand" aria-label="Poker Royale">
    <img src="/poker-royale-logo.svg" alt="Poker Royale" className="poker-royale-logo" />
  </span>;
}
export const cardStyles = [
  ["royale", "Royal Premium · branco e quatro naipes"],
  ["vivid", "Quatro cores intensas"],
  ["ivory", "Marfim · quatro naipes"],
  ["classic", "Tradicional · vermelho e preto"],
  ["night", "Noturno · naipes luminosos"],
];
export function setCardStyle(style: string) {
  document.documentElement.dataset.cardStyle = style;
  localStorage.setItem("mesa-card-style", style);
}
document.documentElement.dataset.cardStyle =
  localStorage.getItem("mesa-card-style") ?? "royale";

export function Card({ c, selected = false, onClick }: any) {
  const suits = { s: "♠", h: "♥", d: "♦", c: "♣" };
  const value = c?.[0] === "T" ? "10" : c?.[0];
  const Component = onClick ? "button" : "span";
  return (
    <Component
      type={onClick ? "button" : undefined}
      data-suit={c?.[1]}
      data-rank={value || undefined}
      data-royale-card={c ? "face" : "back"}
      aria-label={
        c
          ? ({ A: "Ás", K: "Rei", Q: "Dama", J: "Valete" }[c[0]] ?? value) +
            " de " +
            { s: "espadas", c: "paus", d: "ouros", h: "copas" }[c[1]]
          : "Carta oculta"
      }
      aria-pressed={onClick ? selected : undefined}
      onClick={onClick}
      className={
        "card " +
        (!c ? "back" : "hd".includes(c[1]) ? "red" : "") +
        (selected ? " selected" : "")
      }
    >
      {c ? (
        <>
          <strong>{value}</strong>
          <span className="card-emblem" aria-hidden="true">
            {suits[c[1]]}
          </span>
          {/* Royal Deck V4: one rank and one suit, hand-drawn at a fixed
              64 x 90 aspect ratio. No nested SVG or giant suit overlap. */} 
          <svg
            className="royale-card-face-art"
            viewBox="0 0 64 90"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            focusable="false"
          >
            <text className="royale-card-vector-rank" x="7" y="28">{value}</text>
            <g className="royale-card-vector-suit" transform="translate(19 42) scale(1.14)">
              {c[1] === "h" ? (
                <path d="M12 21.1 3.6 12.5C-1 7.5 3.5 1.7 8.4 3.4c1.6.5 2.8 1.7 3.6 3.1.8-1.4 2-2.6 3.6-3.1 4.9-1.7 9.4 4.1 4.8 9.1Z" />
              ) : c[1] === "d" ? (
                <path d="M12 1.1 21 12 12 22.9 3 12Z" />
              ) : c[1] === "c" ? (
                <g><circle cx="12" cy="7.4" r="5.1"/><circle cx="7.2" cy="13.4" r="5.1"/><circle cx="16.8" cy="13.4" r="5.1"/><path d="M10.2 13h3.6l-.4 6h3.2v2.3H7.4V19h3.2Z"/></g>
              ) : (
                <path d="M12 1.4C9.7 5.5 3 9.7 2.3 14.3c-.5 3.3 1.7 5.7 4.6 5.7 2 0 3.5-1.2 4.2-2.7l-.4 2.7H7.8v2h8.4v-2h-2.9l-.4-2.7c.7 1.5 2.2 2.7 4.2 2.7 2.9 0 5.1-2.4 4.6-5.7C21 9.7 14.3 5.5 12 1.4Z" />
              )}
            </g>
            <g className="royale-card-crest" transform="translate(39 72) scale(.042)" aria-hidden="true">
              <path d="M303 102 340 32 391 77 410 14 429 77 480 32 517 102 500 144 320 144Z" />
              <path d="M410 89 C376 62 350 101 376 125 L410 156 444 125 C470 101 444 62 410 89Z" />
            </g>
          </svg>
        </>
      ) : (
        <span className="royale-card-back-symbol" aria-hidden="true"><Spade size={12} /></span>
      )}
    </Component>
  );
}
export function Art() {
  return (
    <div className="art" aria-hidden="true">
      <div className="orbit" />
      <div className="fan">
        <Card c="Ks" />
        <Card c="Ah" />
        <Card c="As" />
      </div>
      <div className="chip c1" />
      <div className="chip c2" />
      <div className="chip c3" />
    </div>
  );
}
export function Modal({ title, close, children, className }: any) {
  const error = useApp((s) => s.error);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className={className}
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal">
        <div className="section">
          <h2 id={titleId}>{title}</h2>
          <button className="icon" onClick={close} aria-label="Fechar">
            <X />
          </button>
        </div>
        {error && (
          <p role="alert" className="danger">
            {error}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}
export function Empty({ children }: any) {
  return (
    <div className="empty">
      <Spade size={20} />
      {children}
    </div>
  );
}
export function Field({ title, children }: any) {
  return (
    <label className="field">
      <span>{title}</span>
      {children}
    </label>
  );
}
