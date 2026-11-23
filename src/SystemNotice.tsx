import React, { useEffect, useState } from "react";
import { WifiOff, ShieldAlert, RefreshCw, X, Wifi } from "lucide-react";
import { refresh, useApp } from "./api";

// Poker Royale never shows native browser alerts. Server, reconnection
// and maintenance messages share this branded, accessible notification layer.
export function SystemNotice() {
  const status = useApp(s => s.liveStatus);
  const error = useApp(s => s.error);
  const set = useApp(s => s.set);
  const token = useApp(s => s.token);
  const [offlineVisible, setOfflineVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    if (!token || status !== "offline") {
      setOfflineVisible(false);
      setMinimized(false);
      return;
    }
    const t = window.setTimeout(() => setOfflineVisible(true), 2300);
    return () => window.clearTimeout(t);
  }, [token, status]);
  const maintenance = /atualizando|atualização|503|indisponível|reiniciando/i.test(error || "");
  const disconnected = offlineVisible && !!token;
  const visible = !!error || disconnected;
  if (!visible) return null;
  if (minimized && disconnected && !error)
    return <button className="royale-connection-minimized" type="button" onClick={()=>setMinimized(false)}
      aria-label="Ver estado da conexão"><WifiOff size={17}/> Reconectando…</button>;
  const title = maintenance ? "Estamos atualizando o servidor" : disconnected ? "Reconectando ao Poker Royale" : "Aviso do Poker Royale";
  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await refresh();
      window.dispatchEvent(new Event("online"));
      set({error:""});
    } catch { /* Keep the notice while connection is unavailable. */ }
    finally {setRetrying(false);}
  }
  return <div className="royale-notice-backdrop" role="presentation">
    <div className="royale-notice-dialog" role="alertdialog" aria-modal="true"
      aria-labelledby="royale-notice-title" aria-describedby="royale-notice-description">
      <img src="/poker-royale-logo.svg" alt="Poker Royale" />
      <span className="royale-notice-icon">{disconnected ? <WifiOff/> : <ShieldAlert/>}</span>
      <h2 id="royale-notice-title">{title}</h2>
      <p id="royale-notice-description">{error || "A conexão com a mesa foi interrompida. Estamos tentando reconectar sem perder sua sessão ou suas fichas."}</p>
      <div className="royale-notice-actions">
        <button className="royale-notice-primary" type="button" onClick={retry} disabled={retrying}>
          <RefreshCw size={17}/> {retrying ? "Verificando…" : "Tentar reconectar"}
        </button>
        <button type="button" onClick={()=>{
          set({error:""});
          if (disconnected) setMinimized(true);
        }}><X size={16}/> {disconnected?"Minimizar":"Fechar"}</button>
      </div>
      {disconnected && <small><Wifi size={13}/> A reconexão automática continua ativa.</small>}
    </div>
  </div>;
}
