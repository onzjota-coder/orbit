export function getNextKey(service = "openrouter"): string {
  return require("./key-pool").getNextKey(service);
}

export function getKeyCount(service = "openrouter"): number {
  return require("./key-pool").getKeyCount(service);
}

// Compatibilidade: imports antigos continuam funcionando e o pool unificado
// mantém a mesma lógica de round-robin para OpenRouter.
