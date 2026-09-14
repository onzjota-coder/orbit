// Rodízio de chaves do Gemini — distribui as chamadas entre várias chaves.
// Adicione no .env.local: GEMINI_API_KEY_2=..., GEMINI_API_KEY_3=... (opcional)
const KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter((k): k is string => typeof k === "string" && k.length > 10);

if (typeof window === "undefined") {
  console.log(`🔑 Pool de chaves Gemini: ${KEYS.length} chave(s) carregada(s)`);
}

let index = 0;

export function getNextKey(): string {
  if (KEYS.length === 0) return "";
  const key = KEYS[index % KEYS.length];
  const n = (index % KEYS.length) + 1;
  index++;
  console.log(`🔑 Usando chave #${n} (...${key.slice(-4)})`);
  return key;
}

export function getKeyCount(): number {
  return KEYS.length;
}