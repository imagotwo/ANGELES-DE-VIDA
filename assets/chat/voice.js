/* Lectura de preguntas con la Web Speech API (solo síntesis; sin reconocimiento de voz). */
export class VoiceReader {
  constructor({ lang = 'es-CO', rate = 0.95 } = {}) {
    this.lang = lang;
    this.rate = rate;
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.supported = !!this.synth && 'SpeechSynthesisUtterance' in window;
    this.enabled = false;
    this.voices = [];
    this.voiceURI = null;
    this.speaking = false;
    this.lastText = '';
    this.onchange = () => {};
    this._token = 0;
  }

  init() {
    if (!this.supported) return;
    const load = () => {
      this.voices = rankSpanish(this.synth.getVoices(), this.lang);
      if (!this.voices.some((v) => v.voiceURI === this.voiceURI)) this.voiceURI = this.voices[0]?.voiceURI ?? null;
      this.onchange();
    };
    load();
    this.synth.addEventListener?.('voiceschanged', load);
  }

  setEnabled(on) { this.enabled = !!on && this.supported; if (!this.enabled) this.stop(); this.onchange(); }
  setVoice(uri) { this.voiceURI = uri; this.onchange(); }
  get paused() { return !!this.synth?.paused; }

  speak(text) {
    if (!this.enabled || !text) return;
    this.lastText = text;
    this.stop(); // nunca dos lecturas a la vez
    const token = this._token;
    const u = new SpeechSynthesisUtterance(text);
    const voice = this.voices.find((v) => v.voiceURI === this.voiceURI);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = this.lang;
    u.rate = this.rate;
    u.onstart = () => { if (token === this._token) { this.speaking = true; this.onchange(); } };
    const done = () => { if (token === this._token) { this.speaking = false; this.onchange(); } };
    u.onend = done; u.onerror = done;
    setTimeout(() => { if (token === this._token) this.synth.speak(u); }, 60); // Chrome pierde el speak() inmediato tras cancel()
  }

  repeat() { this.speak(this.lastText); }
  pause() { if (this.supported && this.speaking) { this.synth.pause(); this.onchange(); } }
  resume() { if (this.supported) { this.synth.resume(); this.onchange(); } }
  stop() {
    this._token += 1;
    if (this.supported) this.synth.cancel();
    this.speaking = false;
    this.onchange();
  }
}

/** Voces en español: es-CO primero, luego otras latinoamericanas, luego el resto. */
export function rankSpanish(list, preferred = 'es-CO') {
  const es = list.filter((v) => /^es\b|^es[-_]/i.test(v.lang));
  const score = (v) => {
    const l = v.lang.replace('_', '-').toLowerCase();
    if (l === preferred.toLowerCase()) return 0;
    if (/^es-(419|mx|us|ar|cl|pe|ve|ec|uy)/.test(l)) return 1;
    return 2;
  };
  return es.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}
