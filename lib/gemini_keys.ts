export function getNextKey(): string {
  return require("./key-pool").getNextKey("gemini");
}

export function getKeyCount(): number {
  return require("./key-pool").getKeyCount("gemini");
}

// Compatibilidade: imports antigos continuam funcionando em qualquer arquivo
// que use lib/gemini_keys.ts, mantendo a mesma API do pool unificado.
