import { exportCsv } from "./export-csv";
import React, { useState, useEffect } from "react";
import { api, date, fail, num, useApp } from "./api";
import { Modal, Card } from "./ui";

export function Sparring({ close }) {
  const [hand, H] = useState<any>(),
    [game, G] = useState("texas"),
    [busy, B] = useState(false),
    [size, S] = useState(0);
  const previous = useApp((s) => s.home.practiceAvailable);
  const frame = hand?.frames[0],
    index = hand?.players.findIndex((p) => p.id === "hero"),
    legal = frame?.legal;
  async function play(action?, resume = false) {
    B(true);
    try {
      const result = action
        ? await api("practiceMove", { hand: hand.id, rev: hand.rev, action })
        : await api(resume ? "practiceResume" : "practiceStart", { game });
      H(result);
      G(result.game);
      S(result.frames[0].legal.min ?? 0);
    } catch (e) {
      fail(e);
    } finally {
      B(false);
    }
  }
  return (
    <Modal title="Mesa de treino" close={close}>
      <p>Heads-up contra o computador · 1.000 fichas de treino por jogador.</p>
      {!frame && previous && (
        <button disabled={busy} onClick={() => play(undefined, true)}>
          Retomar último treino
        </button>
      )}
      {(!frame || frame.finished) && (
        <div className="row">
          <select
            aria-label="Jogo de treino"
            value={game}
            onChange={(e) => G(e.target.value)}
          >
            <option value="texas">Texas Hold’em</option>
            <option value="om4">Omaha 4</option>
          </select>
          <button className="primary" disabled={busy} onClick={() => play()}>
            {frame ? "Nova mão" : "Distribuir"}
          </button>
        </div>
      )}
      {frame && (
        <div className="sparring">
          <small>Rival · {num(frame.stacks[1 - index])} fichas</small>
          <div className="row">
            {frame.hole[1 - index].map((c, i) => (
              <Card key={i} c={c} />
            ))}
          </div>
          <b>
            Pote{" "}
            {num(
              frame.finished
                ? frame.payouts.reduce((a, b) => a + b, 0)
                : frame.pot,
            )}
          </b>
          <div className="row">
            {frame.board.map((c) => (
              <Card key={c} c={c} />
            ))}
          </div>
          <div className="row">
            {frame.hole[index].map((c) => (
              <Card key={c} c={c} />
            ))}
          </div>
          <small>Você · {num(frame.stacks[index])} fichas</small>
          <p role="status">{frame.label}</p>
          {frame.finished ? (
            <strong>
              Seu resultado ·{" "}
              {num(frame.stacks[index] - hand.players[index].stack)} fichas
            </strong>
          ) : (
            <>
              <div className="row">
                <button
                  disabled={busy || !legal.fold}
                  onClick={() => play({ type: "fold" })}
                >
                  Fold
                </button>
                <button disabled={busy} onClick={() => play({ type: "pass" })}>
                  {legal.call ? "Call " + num(legal.call) : "Check"}
                </button>
              </div>
              {legal.min != null && (
                <div className="row">
                  <input
                    aria-label="Valor do aumento no treino"
                    type="range"
                    min={legal.min}
                    max={legal.max}
                    value={size}
                    onChange={(e) => S(+e.target.value)}
                  />
                  <button
                    disabled={busy}
                    onClick={() => play({ type: "raise", amount: size })}
                  >
                    Apostar {num(size)}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
export function Wallet({ close }) {
  const wallet = useApp((s) => s.home.me.wallet);
  const [rows, R] = useState<any[]>(),
    [scope, S] = useState("all");
  useEffect(() => {
    let active = true;
    api("walletHistory")
      .then((r) => {
        if (active) R(r.entries);
      })
      .catch(fail);
    return () => {
      active = false;
    };
  }, [wallet]);
  const filtered = rows?.filter(
    (r) => scope === "all" || (scope === "in" ? r.amount > 0 : r.amount < 0),
  );
  return (
    <Modal title="Minha carteira" close={close}>
      <h3>{num(wallet)} fichas disponíveis</h3>
      <select
        aria-label="Movimentos"
        value={scope}
        onChange={(e) => S(e.target.value)}
      >
        <option value="all">Todas as movimentações</option>
        <option value="in">Entradas</option>
        <option value="out">Saídas</option>
      </select>
      <button
        disabled={!filtered?.length}
        onClick={() =>
          exportCsv("extrato-mesa-real.csv", [
            ["Data", "Movimento", "Valor", "Saldo"],
            ...filtered.map((r) => [
              new Date(r.at).toISOString(),
              r.reason,
              r.amount,
              r.balance,
            ]),
          ])
        }
      >
        Exportar extrato filtrado
      </button>
      <section className="cash-records">
        {filtered?.map((r, i) => (
          <article key={i}>
            <div>
              <b>{r.reason==="Rake administrativo"?"Receita administrativa":r.reason}</b>
              <small>
                {date(r.at)} · Saldo após {num(r.balance)}
              </small>
            </div>
            <strong data-balance={r.amount < 0 ? "loss" : "gain"}>
              {r.amount > 0 ? "+" : ""}
              {num(r.amount)}
            </strong>
          </article>
        ))}
        {!filtered?.length && (
          <p>
            {rows
              ? "Nenhuma movimentação neste filtro."
              : "Carregando extrato…"}
          </p>
        )}
      </section>
      <small>Até 200 movimentações registradas desde esta versão.</small>
    </Modal>
  );
}
export function Feedback({ close }) {
  const [text, T] = useState(""),
    [busy, B] = useState(false),
    [sent, S] = useState(false);
  return (
    <Modal title="Feedback do clube" close={close}>
      {sent ? (
        <p role="status">
          Recebido. Sua mensagem está na administração do clube.
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            B(true);
            try {
              await api("feedback", { text });
              S(true);
            } catch (err) {
              fail(err);
            } finally {
              B(false);
            }
          }}
        >
          <label>
            O que aconteceu?
            <textarea
              required
              minLength={5}
              maxLength={400}
              value={text}
              onChange={(e) => T(e.target.value)}
            />
          </label>
          <button disabled={busy || text.trim().length < 5}>
            Enviar ao administrador
          </button>
        </form>
      )}
    </Modal>
  );
}
