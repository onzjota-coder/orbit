// PRIORIDADE 1 — modelo de chat selecionado no Hub de Inteligências.
// "" (vazio) = Orbit padrão (pool Gemini). String = modelo OpenRouter
// (ex.: "deepseek/deepseek-chat-v4.1-flash:free"). O Hub grava via
// setOrbitModel(); o orbit-chat.tsx escuta o evento e troca o backend.

export const ORBIT_MODEL_KEY = "orbit_model";
export const ORBIT_MODEL_EVENT = "orbit-model";
export function readOrbitModel(): string {
  if (typeof window === "undefined") return "";
  try {
    const model = localStorage.getItem(ORBIT_MODEL_KEY) ?? "";
    if (!model || !model.includes("/") || model.length > 120) {
      if (model) localStorage.removeItem(ORBIT_MODEL_KEY);
      return "";
    }
    return model;
  } catch {
    return ""; // storage corrompido/bloqueado → Orbit padrão
  }
}

export function setOrbitModel(model: string): void {
  const nextModel = model.trim().slice(0, 120);
  try {
    if (nextModel && nextModel.includes("/")) {
      localStorage.setItem(ORBIT_MODEL_KEY, nextModel);
    } else {
      localStorage.removeItem(ORBIT_MODEL_KEY);
    }
  } catch {
    // storage cheio → segue só com o evento em memória
  }
  window.dispatchEvent(
    new CustomEvent<string>(ORBIT_MODEL_EVENT, { detail: nextModel }),
  );
}

// ─────────────────────────────────────────────────────────────
// MELHORIA 1 — capacidade REAL do modelo ativo, para rotear imagens:
//  • "openai"   → prioriza GPT-Image (rota /api/text-image, motor OpenAI)
//  • "gemini"   → prioriza Gemini (rota /api/image, Nano Banana do servidor)
//  • "textonly" → Claude/DeepSeek/Z.ai/GLM/Qwen etc. NÃO geram imagem —
//                 Orbit usa o motor padrão (Pollinations) e explica ao usuário
// ─────────────────────────────────────────────────────────────
export type OrbitModelFamily = "openai" | "gemini" | "textonly";

export function orbitModelFamily(model: string): OrbitModelFamily {
  if (!model) return "gemini"; // sem modelo custom = pool Gemini do Orbit
  const vendor = model.replace(/^~/, "").split("/")[0].toLowerCase();
  if (vendor === "openai") return "openai";
  if (vendor === "google" || vendor === "gemini" || vendor === "openrouter")
    return "gemini";
  return "textonly"; // anthropic, deepseek, z-ai, qwen, meta… só texto
}
