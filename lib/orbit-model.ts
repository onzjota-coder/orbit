// PRIORIDADE 1 — modelo de chat selecionado no Hub de Inteligências.
// "" (vazio) = Orbit padrão (pool Gemini). String = modelo OpenRouter
// (ex.: "deepseek/deepseek-chat-v4.1-flash:free"). O Hub grava via
// setOrbitModel(); o orbit-chat.tsx escuta o evento e troca o backend.

export const ORBIT_MODEL_KEY = "orbit_model";
export const ORBIT_MODEL_EVENT = "orbit-model";

/**
 * Chat keeps the historical `orbit_model` string for persistence, but uses an
 * explicit selection when it crosses the client/server boundary.  The logical
 * provider identifies the model family; the technical provider identifies the
 * API that actually serves the request.
 */
export type ChatTechnicalProvider = "gemini" | "openrouter";
export type ChatLogicalProvider =
  | "gemini"
  | "openrouter"
  | "openai"
  | "anthropic"
  | "deepseek"
  | "z-ai"
  | "other";

export type ChatSelection = {
  model: string;
  logicalProvider: ChatLogicalProvider;
  technicalProvider: ChatTechnicalProvider;
};

export function chatSelectionFromModel(
  model: string,
  logicalProviderHint?: string,
): ChatSelection {
  const normalizedModel = model.trim();
  if (!normalizedModel) {
    return { model: "", logicalProvider: "gemini", technicalProvider: "gemini" };
  }

  const vendor = (logicalProviderHint || normalizedModel.replace(/^~/, "").split("/")[0]).toLowerCase();
  const logicalProvider: ChatLogicalProvider =
    vendor === "openai" || vendor === "anthropic" || vendor === "deepseek" || vendor === "z-ai" || vendor === "openrouter"
      ? vendor
      : vendor === "google" || vendor === "gemini"
        ? "gemini"
        : "other";

  return { model: normalizedModel, logicalProvider, technicalProvider: "openrouter" };
}

export function chatLogicalProviderLabel(provider: ChatLogicalProvider): string {
  switch (provider) {
    case "gemini":
      return "Gemini";
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic / Claude";
    case "deepseek":
      return "DeepSeek";
    case "z-ai":
      return "Z.ai";
    case "openrouter":
      return "OpenRouter";
    default:
      return "Outro modelo";
  }
}

export function readOrbitModel(): string {
  if (typeof window === "undefined") return "";
  try {
    const model = localStorage.getItem(ORBIT_MODEL_KEY) ?? "";
    if (!model || !model.includes("/") || model.length > 120) {
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
