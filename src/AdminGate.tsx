import React, { useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { api, useApp, fail } from "./api";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const me = useApp(s => s.home?.me);
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    setChecking(true);
    api("adminAuthStatus").then(r => {
      if (active) setUnlocked(!!r.unlocked);
    }).catch(err => { if (active) { setUnlocked(false); setMessage(err.message); } })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [me?.id]);
  if (!me?.admin) return <section className="royale-admin-gate"><LockKeyhole/><h2>Acesso reservado</h2><p>Apenas a administração autorizada pode acessar este painel.</p></section>;
  if (checking) return <section className="royale-admin-gate"><ShieldCheck/><p>Verificando acesso seguro...</p></section>;
  if (unlocked) return <>{children}</>;
  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await api("adminUnlock", { password });
      setUnlocked(true);
      setPassword("");
    } catch (err: any) {
      setMessage(err.message || "Acesso não autorizado.");
    } finally { setBusy(false); }
  }
  return <section className="royale-admin-gate">
    <img src="/poker-royale-logo.svg" alt="Poker Royale" />
    <LockKeyhole size={36}/>
    <h2>Administração protegida</h2>
    <p>Digite a senha administrativa para acessar o caixa, rake e controles do Poker Royale.</p>
    <form onSubmit={unlock}>
      <label htmlFor="royale-admin-password">Senha administrativa</label>
      <input id="royale-admin-password" type="password" autoComplete="off"
        value={password} onChange={e=>setPassword(e.target.value)} required maxLength={128}
        placeholder="Digite a senha" />
      {message && <p className="royale-admin-error" role="alert">{message}</p>}
      <button type="submit" disabled={busy || !password}> {busy ? "Verificando…" : "Desbloquear painel"} </button>
    </form>
    <small>O desbloqueio expira em 30 minutos. A senha não é salva no navegador.</small>
  </section>;
}
