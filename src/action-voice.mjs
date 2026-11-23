/** Frases pronunciadas somente após uma ação confirmada pelo servidor. */
export function actionVoicePhrase(frame, precedingFrame) {
  if (!frame?.action) return null;
  if (frame.action === 'runout') {
    // Enquanto ainda houver jogadores votando, o resultado é provisório.
    if (frame.legal?.runout) return null;
    const count = Number(frame.runoutCount || 1);
    if (count === 3) return 'VAMOS LÁ, BATER 3';
    if (count === 2) return 'VAMOS LÁ, BATER DUAS';
    return 'É CÔCO';
  }
  if (frame.action === 'fold' || frame.action === 'timeoutFold') return 'FOLD';
  if (frame.action === 'pass') {
    return Number(frame.paid || 0) > 0 || /^.+ · Call\b/i.test(frame.label || '') ? 'CALL' : 'CHECK';
  }
  if (frame.action === 'raise') {
    const label = String(frame.label || '');
    return / · Bet\b/i.test(label) ? 'BET' : 'RAISE';
  }
  if (frame.action === 'bring') return 'BET';
  return null;
}

export function speakPokerAction(phrase, volume = 0.8) {
  if (!phrase || typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const synth = window.speechSynthesis;
  try {
    synth.cancel();
    const message = new SpeechSynthesisUtterance(phrase);
    message.lang = phrase === 'CALL' || phrase === 'FOLD' || phrase === 'CHECK' || phrase === 'BET' || phrase === 'RAISE' ? 'en-US' : 'pt-BR';
    const available = synth.getVoices();
    const lang = message.lang.toLowerCase();
    const matching = available.filter(v => v.lang?.toLowerCase().startsWith(lang.slice(0,2)));
    const preferred = matching.find(v => /natural|neural|premium|google|microsoft/i.test(v.name)) || matching[0];
    if (preferred) message.voice = preferred;
    message.rate = phrase.length > 8 ? 1.05 : 0.95;
    message.pitch = 0.88;
    message.volume = Math.min(1, Math.max(0, Number(volume) || 0));
    synth.speak(message);
    return true;
  } catch { return false; }
}
