import React, { useEffect, useState } from "react";

type SplashProps = {
  ready: boolean;
  title?: string;
  onComplete?: () => void;
};

export function ProgressSplash({ ready, title = "PREPARANDO O JOGO", onComplete }: SplashProps) {
  const [percent, setPercent] = useState(0);
  const [minimumReached, setMinimumReached] = useState(false);

  useEffect(() => {
    const begin = Date.now();
    const tick = window.setInterval(() => {
      setPercent((previous) => {
        if (ready && Date.now() - begin >= 850) return Math.min(100, previous + Math.max(2, Math.ceil((100 - previous) / 3)));
        // Visual estimate only: never display 100% until all required data is ready.
        return Math.min(92, previous + Math.max(1, Math.round((92 - previous) / 11)));
      });
    }, 65);
    const minimum = window.setTimeout(() => setMinimumReached(true), 850);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(minimum);
    };
  }, [ready]);

  useEffect(() => {
    if (percent !== 100 || !ready || !minimumReached) return;
    const finish = window.setTimeout(() => onComplete?.(), 180);
    return () => window.clearTimeout(finish);
  }, [percent, ready, minimumReached, onComplete]);

  return (
    <div className="royale-loading-screen" role="status" aria-live="polite" aria-label={title}>
      <div className="royale-loading-glow" aria-hidden="true" />
      <div className="royale-loading-inner">
        <img src="/poker-royale-logo.svg" className="royale-loading-logo" alt="Poker Royale" />
        <div className="royale-loading-line" aria-hidden="true" />
        <p className="royale-loading-title">{title}</p>
        <div className="royale-loading-progress" aria-hidden="true"><span style={{ width: percent + "%" }} /></div>
        <strong className="royale-loading-number">{percent}<small>%</small></strong>
        <small className="royale-loading-caption">{percent === 100 ? "PRONTO PARA JOGAR" : ready ? "FINALIZANDO..." : "CONECTANDO AOS JOGADORES..."}</small>
      </div>
    </div>
  );
}

export function LoadingGate({ ready, title, children }: SplashProps & { children: React.ReactNode }) {
  const [complete, setComplete] = useState(false);
  const finish = React.useCallback(() => setComplete(true), []);
  return complete && ready ? <>{children}</> : <ProgressSplash ready={ready} title={title} onComplete={finish} />;
}
