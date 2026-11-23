import React from 'react';
/** Vector artwork intentionally lives in React: sharp at every mobile size, no downloaded assets. */
export default function GameHero(){return <div className="game-hero" aria-hidden="true">
  <span className="hero-spark spark-a">✦</span><span className="hero-spark spark-b">✧</span><span className="hero-spark spark-c">✦</span>
  <div className="hero-table"><div className="hero-table-inner"><span>♠</span><small>MESA REAL</small></div></div>
  <div className="hero-hand hero-hand-left"><span className="hero-playing-card first"><b>A</b><i>♠</i></span><span className="hero-playing-card second"><b>K</b><i>♠</i></span></div>
  <div className="hero-hand hero-hand-right"><span className="hero-playing-card third"><b>Q</b><i>♥</i></span><span className="hero-playing-card fourth"><b>J</b><i>♦</i></span></div>
  <div className="hero-chip-group chip-left"><span className="hero-chip gold"/><span className="hero-chip red"/><span className="hero-chip gold"/></div>
  <div className="hero-chip-group chip-right"><span className="hero-chip blue"/><span className="hero-chip green"/><span className="hero-chip blue"/></div>
  <div className="hero-crown">♛</div>
</div>}
