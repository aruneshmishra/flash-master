/** Read cards aloud with the browser's built-in voices. */
export const LANGUAGES = [
  ['auto', 'Auto detect'], ['en-US', 'English'], ['es-ES', 'Spanish'], ['fr-FR', 'French'], ['de-DE', 'German'],
  ['it-IT', 'Italian'], ['pt-BR', 'Portuguese'], ['hi-IN', 'Hindi'], ['ja-JP', 'Japanese'], ['zh-CN', 'Chinese'],
  ['ko-KR', 'Korean'], ['ru-RU', 'Russian'], ['ar-SA', 'Arabic'],
];

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function detectLang(text) {
  const t = String(text);
  if (/[぀-ヿ]/.test(t)) return 'ja-JP';
  if (/[가-힯]/.test(t)) return 'ko-KR';
  if (/[一-鿿]/.test(t)) return 'zh-CN';
  if (/[ऀ-ॿ]/.test(t)) return 'hi-IN';
  if (/[Ѐ-ӿ]/.test(t)) return 'ru-RU';
  if (/[؀-ۿ]/.test(t)) return 'ar-SA';
  return '';
}

export function speak(text, lang = 'auto') {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(String(text));
  const code = lang && lang !== 'auto' ? lang : detectLang(text);
  if (code) {
    u.lang = code;
    const voice = synth.getVoices().find((v) => v.lang === code) || synth.getVoices().find((v) => v.lang.startsWith(code.slice(0, 2)));
    if (voice) u.voice = voice;
  }
  u.rate = 0.95;
  synth.speak(u);
}

export function stopSpeaking() { if (canSpeak()) window.speechSynthesis.cancel(); }
