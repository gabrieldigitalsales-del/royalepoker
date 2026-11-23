// Wait for the authoritative game server before starting Vite's WebSocket proxy.
// Node >= 24; no third-party dependencies required.
const url = process.env.POKER_BACKEND_HEALTH || 'http://127.0.0.1:4190/health';
const tries = Number(process.env.POKER_BACKEND_RETRIES || 30);
for (let n = 1; n <= tries; n++) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
    const data = await response.json();
    if (response.ok && data?.ok === true) {
      console.log(`[Poker Royale] Servidor confirmado: ${url}`);
      process.exit(0);
    }
  } catch { /* Backend may still be booting or may have crashed. */ }
  if (n < tries) await new Promise(resolve => setTimeout(resolve, 900));
}
console.error(`\n[ERRO] O servidor de jogo nao respondeu em ${url}.`);
console.error('Confira a janela SERVIDOR: ela deve mostrar "Mesa Real em http://127.0.0.1:4190".');
console.error('Se encerrou, verifique npm install, Node.js >=24, Python e a mensagem de erro nessa janela.');
console.error('Nao inicie apenas o Vite: o jogo precisa do servidor WebSocket na porta 4190.\n');
process.exit(1);
