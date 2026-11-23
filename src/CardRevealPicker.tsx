import React, { useEffect, useRef, useState } from 'react';
import { Card } from './ui';
/** Click or swipe across cards to select the exact subset to expose after showdown. */
export function CardRevealPicker({ cards, revealed, onChange, disabled }: {cards:string[];revealed:number[];onChange:(indices:number[])=>void;disabled?:boolean}) {
  const [draft, setDraft] = useState<number[]>(revealed);
  const gesture = useRef<{active:boolean;value:Set<number>;target:boolean;visited:Set<number>}>({active:false,value:new Set(),target:true,visited:new Set()});
  useEffect(()=>{if(!gesture.current.active)setDraft(revealed)},[revealed.join(',')]);
  function begin(index:number, el:HTMLElement, pointerId:number){
    if(disabled)return;
    const value = new Set(draft);
    const target = !value.has(index);
    target ? value.add(index) : value.delete(index);
    gesture.current={active:true,value,target,visited:new Set([index])};
    setDraft([...value].sort((a,b)=>a-b));
    el.setPointerCapture(pointerId);
  }
  function move(clientX:number,clientY:number){
    const g=gesture.current;
    if(!g.active)return;
    const element=document.elementFromPoint(clientX,clientY)?.closest<HTMLElement>('[data-reveal-index]');
    const raw=element?.dataset.revealIndex;
    if(raw===undefined)return;
    const index=Number(raw);
    if(!Number.isInteger(index)||index<0||index>=cards.length||g.visited.has(index))return;
    g.visited.add(index);
    g.target?g.value.add(index):g.value.delete(index);
    setDraft([...g.value].sort((a,b)=>a-b));
  }
  function end(){
    if(!gesture.current.active)return;
    const values=[...gesture.current.value].sort((a,b)=>a-b);
    gesture.current.active=false;
    onChange(values);
  }
  return <div className="show-my-cards"><strong>Mostrar cartas após a mão</strong><p>Toque em uma carta ou deslize o dedo sobre várias. Só as selecionadas ficarão visíveis aos outros jogadores.</p><div className="row reveal-picker" onPointerMove={e=>move(e.clientX,e.clientY)} onPointerUp={end} onPointerCancel={end}>
    {cards.map((c,i)=><button key={i} type="button" data-reveal-index={i} className={'reveal-own-card'+(draft.includes(i)?' reveal-selected':'')} aria-pressed={draft.includes(i)} disabled={disabled} onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;begin(i,e.currentTarget,e.pointerId)}} onClick={e=>{if(e.detail===0){const v=new Set(draft);v.has(i)?v.delete(i):v.add(i);const a=[...v].sort((a,b)=>a-b);setDraft(a);onChange(a)}}}><Card c={c}/><small>{draft.includes(i)?'Visível':'Oculta'}</small></button>)}
  </div></div>;
}
