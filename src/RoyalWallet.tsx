import React, { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Clock3, RefreshCcw, ShieldCheck, WalletCards } from "lucide-react";
import { api, fail, refresh, num, date, useApp } from "./api";

const stateLabel: Record<string,string> = {
  pending:"Em análise",approved:"Aprovada (reserva mantida)",
  rejected:"Rejeitada · saldo devolvido",completed:"Concluída (fichas virtuais)",
  awaiting_provider:"Aguardando integração",
};
const formatter=(value:number)=>num(value??0);
export default function RoyalWallet() {
  const home=useApp(s=>s.home);
  const [data,setData]=useState<any>();
  const [loadError,setLoadError]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [amount,setAmount]=useState("100");
  const [message,setMessage]=useState("");
  const [tab,setTab]=useState<"withdraw"|"deposit">("withdraw");
  const [entries,setEntries]=useState<any[]>([]);
  const [requestId,setRequestId]=useState<string>();
  async function load() {
    setLoading(true);setLoadError("");
    try {
      const [wallet,history]=await Promise.all([api("royalWallet"),api("walletHistory")]);
      setData(wallet);setEntries(history.entries??[]);
    } catch(error:any) {
      setLoadError(error?.message||"Não foi possível consultar sua carteira.");
      throw error;
    } finally { setLoading(false); }
  }
  useEffect(()=>{
    let active=true;setLoading(true);setLoadError("");
    Promise.all([api("royalWallet"),api("walletHistory")])
      .then(([wallet,history])=>{if(active){setData(wallet);setEntries(history.entries??[]);}})
      .catch((error:any)=>{if(active)setLoadError(error?.message||"Falha ao carregar a carteira.");})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[home?.me?.wallet,home?.me?.walletReserved]);
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy)return;
    const value=Number(amount);
    if(!Number.isSafeInteger(value)||value<1){setMessage("Informe uma quantidade inteira de fichas.");return;}
    setBusy(true);setMessage("");
    const ref=requestId??crypto.randomUUID();setRequestId(ref);
    try {
      const result=await api(tab==="withdraw"?"royalWithdrawalRequest":"royalDepositIntent",
        {amount:value,reference:ref});
      setRequestId(undefined);
      setMessage(tab==="withdraw"
        ?"Solicitação registrada. As fichas foram reservadas e não poderão entrar em mesas."
        :"Solicitação registrada para futura integração. Nenhuma cobrança ou crédito foi efetuado.");
      await refresh();await load();
    }catch(e:any){setMessage(e.message??"Não foi possível registrar a solicitação.");}
    finally{setBusy(false);}
  }
  return <div className="royal-wallet-page">
    <header className="royal-wallet-intro">
      <div><small>POKER ROYALE · FICHAS VIRTUAIS</small><h1>Carteira Royal</h1>
        <p>Organize suas fichas, reservas e movimentações com registro de cada solicitação.</p></div>
      <WalletCards size={38}/>
    </header>
    {loadError && <div className="royal-wallet-feedback" role="alert">
      <strong>Não foi possível carregar a carteira.</strong>
      <p>{loadError}</p>
      <button type="button" onClick={()=>load().catch(()=>{})}>Tentar novamente</button>
    </div>}
    <div className="royal-wallet-metrics" role="group" aria-label="Saldos de fichas">
      <div><span>Disponíveis</span><strong>{formatter(data?.available??home?.me?.wallet)}</strong><small>Para mesas e torneios</small></div>
      <div><span>Reservadas</span><strong>{formatter(data?.reserved??0)}</strong><small>Solicitações em análise</small></div>
      <div><span>Nas mesas</span><strong>{formatter(data?.chipsInPlay??0)}</strong><small>Fichas em jogo</small></div>
    </div>
    <div className="royal-wallet-body">
      <section className="royal-wallet-panel">
        <div className="royal-wallet-tabs">
          <button type="button" className={tab==="withdraw"?"selected":""} onClick={()=>{setTab("withdraw");setRequestId(undefined);setMessage("");}}><ArrowUpCircle size={17}/> Solicitar resgate</button>
          <button type="button" className={tab==="deposit"?"selected":""} onClick={()=>{setTab("deposit");setRequestId(undefined);setMessage("");}}><ArrowDownCircle size={17}/> Depósito</button>
        </div>
        <h2>{tab==="withdraw"?"Reservar fichas para análise":"Preparação para depósitos"}</h2>
        <p>{tab==="withdraw"
          ?"A solicitação reserva as fichas imediatamente. A administração pode aprovar ou rejeitar; pedidos rejeitados devolvem o saldo."
          :"O Pix automático ainda não está conectado. Registrar interesse não gera QR Code, cobrança, confirmação ou crédito."}</p>
        <form onSubmit={submit} className="royal-wallet-form">
          <label htmlFor="royal-wallet-amount">Quantidade de fichas</label>
          <input id="royal-wallet-amount" type="number" inputMode="numeric" min={1} step={1}
            max={tab==="withdraw"?(data?.available??home?.me?.wallet):1000000}
            value={amount} onChange={e=>{setAmount(e.target.value);setRequestId(undefined);}} required/>
          <button type="submit" disabled={busy || loading || !!loadError}>{busy?"Registrando…":
            tab==="withdraw"?"Reservar e solicitar":"Registrar interesse no depósito"}</button>
          {message&&<p role="status" className="royal-wallet-feedback">{message}</p>}
        </form>
        <small className="royal-wallet-disclaimer">Esta versão opera somente com fichas virtuais. Não executa pagamentos, saques bancários nem conversão para reais.</small>
      </section>
      <section className="royal-wallet-panel">
        <div className="royal-wallet-section-head"><h2>Solicitações</h2><button type="button" onClick={()=>load().catch(fail)} aria-label="Atualizar"><RefreshCcw size={17}/></button></div>
        {!data?<p>{loading?"Carregando carteira…":"Não foi possível consultar as solicitações. Use Tentar novamente acima."}</p>:!data.requests?.length?<p>Nenhuma solicitação até agora.</p>:
          <div className="royal-wallet-requests">{data.requests.map((request:any)=>
            <div className="royal-wallet-request" key={request.id}>
              <span>{request.kind==="withdrawal"?"Reserva":"Depósito futuro"}<small>{date(request.createdAt)}</small></span>
              <span><b>{formatter(request.amount)} fichas</b><small>{stateLabel[request.status]??request.status}</small></span>
            </div>)}</div>}
      </section>
    </div>
    <section className="royal-wallet-panel">
      <h2>Extrato de fichas</h2>
      <div className="royal-wallet-requests">{entries.length?entries.slice(0,40).map((entry,index)=>
        <div key={index} className="royal-wallet-request">
          <span>{entry.reason}<small>{date(entry.at)}</small></span>
          <span><b className={entry.amount>=0?"royal-gain":"royal-loss"}>{entry.amount>0?"+":""}{formatter(entry.amount)}</b><small>Saldo {formatter(entry.balance)}</small></span>
        </div>):<p>Nenhuma movimentação registrada.</p>}</div>
    </section>
  </div>;
}

export function RoyalWalletAdmin() {
  const [requests,setRequests]=useState<any[]>([]);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  async function load(){const r=await api("royalWalletAdmin");setRequests(r.requests??[]);}
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  async function change(id:string,action:"approve"|"reject"|"complete"){
    if(busy)return;setBusy(id);setError("");
    try{await api("royalWalletDecision",{id,action});await load();await refresh();}
    catch(e:any){setError(e.message??"Não foi possível atualizar.");}
    finally{setBusy("");}
  }
  return <div className="royal-wallet-page">
    <header className="royal-wallet-intro"><div><small>ADMINISTRAÇÃO · CONTROLE RESERVADO</small>
      <h1>Solicitações da Carteira Royal</h1>
      <p>Aprovação manual de fichas virtuais, com reserva e estorno auditáveis.</p></div><ShieldCheck size={37}/></header>
    <p className="royal-wallet-disclaimer">Não existe transferência Pix real. “Concluir” encerra somente o resgate interno das fichas reservadas.</p>
    {error&&<p role="alert" className="royal-wallet-feedback">{error}</p>}
    <div className="royal-wallet-requests">{requests.length?requests.map(r=>
      <div key={r.id} className="royal-wallet-admin-request">
        <div><b>{r.playerName}</b><small>{r.kind==="withdrawal"?"Solicitação de reserva":"Depósito pendente de integração"} · {date(r.createdAt)}</small></div>
        <div><strong>{formatter(r.amount)} fichas</strong><small>{stateLabel[r.status]??r.status}</small></div>
        <div className="royal-wallet-admin-actions">
          {r.kind==="withdrawal"&&r.status==="pending"&&<button disabled={!!busy} onClick={()=>change(r.id,"approve")}>Aprovar</button>}
          {r.kind==="withdrawal"&&["pending","approved"].includes(r.status)&&
            <button disabled={!!busy} onClick={()=>change(r.id,"reject")}>Rejeitar e devolver</button>}
          {r.kind==="withdrawal"&&r.status==="approved"&&
            <button disabled={!!busy} onClick={()=>change(r.id,"complete")}>Concluir resgate interno</button>}
        </div>
      </div>):<p>Nenhuma solicitação registrada.</p>}</div>
  </div>;
}
