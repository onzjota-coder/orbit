import { getNextKey, getKeyCount } from "@/lib/openrouter_keys";

// ─────────────────────────────────────────────────────────────
// Cliente OpenRouter padrão (formato OpenAI-compatible).
// Usado pela rota /api/chat/openrouter. Chaves SOMENTE server-side
// via pool round-robin (lib/key-pool.ts). Zero any.
// ─────────────────────────────────────────────────────────────

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "openrouter/auto";

export type OpenAiMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatResult =
  | { ok: true; reply: string; model: string; latencyMs: number }
  | { ok: false; status: number; message: string; model: string };

/** Modelos recomendados no dropdown da UI (o catálogo vivo pode trazer mais). */
export const RECOMMENDED_MODELS = [
  { id: "openrouter/auto", label: "Auto — OpenRouter escolhe" },
  { id: "openai/gpt-4o", label: "GPT-4o (OpenAI)" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (Anthropic)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Google)" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
  { id: "z-ai/glm-4.5-flash", label: "GLM 4.5 Flash (Z.ai)" },
] as const;

function headers(apiKey: string, origin: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": origin || "https://orbit.app",
    "X-Title": "Orbit",
  };
}

type ChatChoice = { message?: { content?: string } };

/** Uma chamada não-streaming ao OpenRouter. */
export async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: OpenAiMessage[],
  origin: string,
  timeoutMs = 60_000,
): Promise<ChatResult> {
  const started = Date.now();
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: headers(apiKey, origin),
      body: JSON.stringify({ model, messages }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[OR] HTTP ${res.status} (${model}):`, detail.slice(0, 300));
      return { ok: false, status: res.status, message: detail.slice(0, 400), model };
    }
    const data = (await res.json()) as { choices?: ChatChoice[] };
    const reply = data.choices?.[0]?.message?.content ?? "";
    if (!reply) {
      return { ok: false, status: 502, message: "resposta vazia do modelo", model };
    }
    return { ok: true, reply, model, latencyMs: Date.now() - started };
  } catch (error) {
    console.error(`[OR] falha (${model}):`, error instanceof Error ? error.message : error);
    return { ok: false, status: 502, message: "falha de rede/timeout", model };
  }
}

/**
 * Chama o modelo pedido; se falhar com erro recuperável (401/402/429/5xx),
 * tenta os FALLBACK_MODELS configurados. Rodízio de chave do pool em cada tentativa.
 */
export const FALLBACK_MODELS = ["openrouter/auto", "google/gemini-2.5-flash"];

export async function chatWithFallback(
  model: string,
  messages: OpenAiMessage[],
  origin: string,
): Promise<ChatResult> {
  const chain = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let last: ChatResult = { ok: false, status: 502, message: "nenhuma tentativa", model };

  for (const candidate of chain) {
    const keys = Math.max(getKeyCount(), 1);
    for (let attempt = 0; attempt < keys; attempt++) {
      const key = getNextKey();
      if (!key) break;
      const result = await callOpenRouter(key, candidate, messages, origin);
      if (result.ok) return result;
      last = result;
      // só itera de chave em erros de chave/quota; outros erros → próximo modelo
      if (![401, 402, 429].includes(result.status)) break;
    }
    if (last.ok) break;
  }
  return last;
}

/** Mensagens de erro amigáveis em pt-BR (igual ao padrão da rota existente). */
export function friendlyError(status: number, apiMessage: string, model: string): string {
  if (status === 402) {
    return `💳 O modelo ${model} está sem crédito na conta OpenRouter (402 — Payment Required). Adicione créditos em openrouter.ai/credits ou escolha outro modelo. O chat continua funcionando normalmente.`;
  }
  if (status === 429) {
    return `⏳ Limite de uso atingido no modelo ${model} (429). Aguarde alguns segundos ou escolha outro modelo no Hub 🧠.`;
  }
  if (status === 401) {
    return `🔑 Chave OpenRouter inválida ou expirada (401). Verifique OPENROUTER_API_KEY no servidor.`;
  }
  if (status === 404) {
    return `🔎 O modelo ${model} não foi encontrado. Escolha outro no Hub 🧠.`;
  }
  return `A IA (${model}) está indisponível agora. Tente novamente em instantes. ${apiMessage.slice(0, 120)}`;
}
