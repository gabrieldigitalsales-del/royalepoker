import React, { useEffect, useId, useRef } from "react";
import { useApp } from "./api";
import { X, Spade } from "lucide-react";
export function Brand() {
  return <span className="brand poker-royale-brand" aria-label="Poker Royale">
    <img src="/poker-royale-logo.svg" alt="Poker Royale" className="poker-royale-logo" />
  </span>;
}
export const cardStyles = [
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
  localStorage.getItem("mesa-card-style") ?? "vivid";

export function Card({ c, selected = false, onClick }: any) {
  const suits = { s: "♠", h: "♥", d: "♦", c: "♣" };
  const value = c?.[0] === "T" ? "10" : c?.[0];
  const Component = onClick ? "button" : "span";
  return (
    <Component
      type={onClick ? "button" : undefined}
      data-suit={c?.[1]}
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
          <i>{suits[c[1]]}</i>
          <span className="card-emblem" aria-hidden="true">
            {suits[c[1]]}
          </span>
        </>
      ) : (
        <Spade size={12} />
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
