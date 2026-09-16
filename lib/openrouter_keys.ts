// PRIORIDADE 1 — Rodízio de chaves do OpenRouter: distribui as chamadas entre
// várias chaves (mesmo padrão de lib/gemini_keys.ts).
// Adicione no .env.local: OPENROUTER_API_KEY=..., OPENROUTER_API_KEY_2=..., OPENROUTER_API_KEY_3=... (opcional)
// Sem hardcode: tudo lido do ambiente do servidor.
const KEYS = [
  process.env.OPENROUTER_API_KEY,
  process.env.OPENROUTER_API_KEY_2,
  process.env.OPENROUTER_API_KEY_3,
].filter((k): k is string => typeof k === "string" && k.length > 10);

if (typeof window === "undefined") {
  console.log(`🔑 Pool de chaves OpenRouter: ${KEYS.length} chave(s) carregada(s)`);
}

let index = 0;

export function getNextKey(): string {
  if (KEYS.length === 0) return "";
  const key = KEYS[index % KEYS.length];
  const n = (index % KEYS.length) + 1;
  index++;
  console.log(`🔑 Usando chave OpenRouter #${n} (...${key.slice(-4)})`);
  return key;
}

export function getKeyCount(): number {
  return KEYS.length;
}