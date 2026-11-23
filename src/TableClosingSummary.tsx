import React from 'react';
import { Crown, Trophy, LogOut } from 'lucide-react';
import { Modal } from './ui';
import { num } from './api';
import './poker-royale-closing.css';

export function TableClosingSummary({ summary, onExit }: {summary:any;onExit:()=>void}) {
  if (!summary) return null;
  const ranking = [...(summary.players ?? [])].sort((a:any,b:any)=>b.net-a.net || String(a.name).localeCompare(String(b.name)));
  const positives = ranking.filter((player:any)=>player.net>0).length;
  const negatives = ranking.filter((player:any)=>player.net<0).length;
  return <Modal title="Mesa encerrada" close={onExit} className="royale-closing-dialog">
    <div className="royale-closing-screen">
      <div className="royale-closing-header"><Crown size={30} /><strong>RESULTADO FINAL</strong><span>{summary.name}</span></div>
      <p className="royale-closing-description">Entradas, saídas e saldo líquido acumulado de todos que participaram desta mesa.</p>
      <div className="royale-closing-totals"><span>👑 {positives} positivo(s)</span><span>⚔️ {negatives} negativo(s)</span><span>♠ {ranking.length} participantes</span></div>
      <div className="royale-closing-players" aria-label="Ranking final da sessão">
        {ranking.map((player:any,i:number)=><div className="royale-closing-player" key={player.id} data-result={player.net>0?'win':player.net<0?'loss':'draw'}>
          <div className="royale-closing-position">{i===0&&player.net>0?<Trophy size={18}/>:i+1}</div>
          <div className="royale-closing-avatar">{player.photo?<img src={`/avatar/${player.photo}`} alt=""/>:<span>{player.avatar||'♠'}</span>}</div>
          <div className="royale-closing-name"><strong title={player.name}>{player.name}</strong><small>Entradas {num(player.bought)} · Retiradas {num(player.cashedOut)}</small></div>
          <strong className="royale-closing-net">{player.net>0?'+':player.net<0?'−':''}{num(Math.abs(player.net))}</strong>
        </div>)}
        {!summary.players.length&&<p className="royale-closing-empty">Nenhum jogador participou da sessão.</p>}
      </div>
      <div className="royale-closing-footer"><span>{ranking.length} jogador(es) · Saldo total: {num(summary.net)}</span><button type="button" onClick={onExit}><LogOut size={17}/> Voltar ao lobby</button></div>
    </div>
  </Modal>;
}
