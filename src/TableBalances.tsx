import React, { useRef, useState } from "react";
import { TrendingUp, GripHorizontal, X } from "lucide-react";
import { Modal } from "./ui";
import { num } from "./api";
import "./table-balances.css";

export function TableBalances({ rows, me, history = [], onReplay }: { rows: any[]; me: string; history?: any[]; onReplay?: (id: string) => void }) {
  const [open, show] = useState(false);
  const [offset, setOffset] = useState(0);
  const onlineCount = rows.filter((player) => player.online).length;
  const offlineCount = rows.length - onlineCount;
  const start = useRef<number | null>(null);
  function close() {
    show(false);
    start.current = null;
    setOffset(0);
  }
  return (
    <>
      <button
        className="icon balances-toggle"
        aria-label="Ganhos e perdas da mesa"
        title="Ganhos e perdas"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => show(true)}
      >
        <TrendingUp size={21} /><span className="balances-badge">PLACAR</span><span className="balances-count" aria-hidden="true">{rows.length}</span>
      </button>
      {open && (
        <Modal title="Placar · Online e Offline" close={close} className="balances-sheet">
          <div
            className="balances-handle"
            aria-hidden="true"
            onPointerDown={(e) => {
              start.current = e.clientY;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (start.current !== null) {
                const d = Math.max(0, e.clientY - start.current);
                setOffset(d);
                e.currentTarget
                  .closest("dialog")
                  ?.style.setProperty("--pull", d + "px");
              }
            }}
            onPointerUp={(e) => {
              const dismiss =
                start.current !== null && e.clientY - start.current > 70;
              start.current = null;
              setOffset(0);
              e.currentTarget.closest("dialog")?.style.removeProperty("--pull");
              if (dismiss) close();
            }}
            onPointerCancel={(e) => {
              start.current = null;
              setOffset(0);
              e.currentTarget.closest("dialog")?.style.removeProperty("--pull");
            }}
          >
            <GripHorizontal />
          </div>
          <p className="balances-explainer">Jogadores que estão ou já passaram por esta mesa. Resultado acumulado nas mãos concluídas.</p>
          <div className="balances-overview" aria-label="Jogadores online e offline"><span><i data-online="true" /> {onlineCount} online</span><span><i data-online="false" /> {offlineCount} offline</span></div>
          <div className="balances-list" data-dragging={offset !== 0}>
            {[true, false].map((online) => {
              const group = rows.filter((p) => p.online === online);
              if (!group.length) return null;
              return (
                <section key={String(online)}>
                  <h3>
                    <i data-online={online} />
                    {online ? "Online" : "Offline"} · {group.length}
                  </h3>
                  {group.map((p) => (
                    <details key={p.id}>
                      <summary>
                        <span>
                          <b>{p.name}</b>
                          {p.id === me && <small>Você</small>}
                          <small>{p.seated ? "Na mesa" : "Já jogou"}</small>
                        </span>
                        <strong data-sign={Math.sign(p.net)}>
                          {p.net > 0 ? "+" : ""}
                          {num(p.net)}
                        </strong>
                      </summary>
                      {(() => {
                        const hands = history.filter(h => h.participants?.some((v:any) => v.id === p.id)).slice().sort((a,b) => a.number-b.number);
                        const totals = hands.reduce((a:any[],h:any) => [...a, a[a.length-1]+(h.participants.find((v:any)=>v.id===p.id)?.net??0)], [0]);
                        const low = Math.min(...totals), high = Math.max(...totals);
                        const points = totals.map((v:number,i:number) => `${(i / Math.max(1, totals.length-1))*100},${40-(v-low)/Math.max(1,high-low)*35}`).join(" ");
                        return hands.length > 0 && <div className="balance-timeline"><svg viewBox="0 0 100 44" preserveAspectRatio="none" aria-label="Evolução do saldo mão a mão"><polyline points={points} fill="none" stroke={p.net>=0?"#53dc95":"#ff7b80"} strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><div className="timeline-actions">{hands.slice().sort((a:any,b:any)=>Math.abs(b.participants.find((v:any)=>v.id===p.id)?.net??0)-Math.abs(a.participants.find((v:any)=>v.id===p.id)?.net??0)).slice(0,2).map((hand:any)=><button key={hand.id} onClick={()=>{close();onReplay?.(hand.id)}}>Mão #{hand.number}: {num(hand.participants.find((v:any)=>v.id===p.id)?.net??0)} · Replay</button>)}</div></div>;
                      })()}
                      <p>
                        {p.hands}{" "}
                        {p.hands === 1 ? "mão concluída" : "mãos concluídas"} ·
                        Ganhos{" "}
                        <em data-sign={Math.sign(p.won)}>+{num(p.won)}</em> ·
                        Perdas{" "}
                        <em data-sign={-Math.sign(p.lost)}>
                          {p.lost ? "−" : ""}
                          {num(p.lost)}
                        </em>
                      </p>
                    </details>
                  ))}
                </section>
              );
            })}
            {!rows.length && (
              <p>A lista aparece quando jogadores entram na mesa.</p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
