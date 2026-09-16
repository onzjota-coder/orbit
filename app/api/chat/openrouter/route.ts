import { NextResponse } from "next/server";
import { getNextKey, getKeyCount } from "@/lib/openrouter_keys";
import { SYSTEM_TEXT, extractSearchQuery, searchMercadoLivre } from "@/lib/chat-system";

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────
// PRIORIDADE 1 — Chat multi-IA via OpenRouter (openrouter.ai/api/v1).
// UM endpoint no formato OpenAI expõe ChatGPT, Claude, DeepSeek e Z.ai:
// trocar de modelo = trocar a string ("openai/gpt-5",
// "anthropic/claude-opus-5", "~deepseek/deepseek-pro-latest", …).
// As chaves vêm do pool round-robin (lib/openrouter_keys.ts) — lidas do
// .env.local, sem hardcode.
//
// GET  → { available, keys, models } — catálogo REAL do OpenRouter
//        (endpoint público /models, cache de 10 min) para o Hub listar
//        IDs vigentes em vez de IDs congelados no código.
// POST → { message, history, model } → { reply } | { error, recoverable }.
// 402 (sem crédito) e 429 (rate limit) voltam com mensagem clara para a
// UI exibir — o chat NUNCA trava. Chave 401/402/429 → tenta a próxima
// do pool antes de falhar.
// ─────────────────────────────────────────────────────────────

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openrouter/auto";

// GET sem parâmetro de request seria pré-renderizado no build — forçamos
// execução dinâmica (o pool de chaves é lido em tempo de execução).
export const dynamic = "force-dynamic";

type HubModel = { id: string; name: string; family: string; context: number | null; free: boolean };
type OpenAiMessage = { role: "system" | "user" | "assistant"; content: string };

// ── Catálogo público de modelos (não exige chave) ──
const CATALOG_FAMILIES = ["openai", "anthropic", "deepseek", "z-ai"];
const CATALOG_TTL = 10 * 60 * 1000;
const CATALOG_MAX = 150;
let catalogCache: { at: number; models: HubModel[] } | null = null;

// Fallback offline — usado apenas se o catálogo público estiver inacessível.
const FALLBACK_CATALOG: HubModel[] = [
  { id: "openrouter/auto", name: "Auto — OpenRouter escolhe", family: "openrouter", context: null, free: false },
  { id: "openai/gpt-5", name: "GPT-5 (OpenAI)", family: "openai", context: null, free: false },
  { id: "anthropic/claude-opus-5", name: "Claude Opus 5", family: "anthropic", context: null, free: false },
  { id: "~deepseek/deepseek-pro-latest", name: "DeepSeek Pro Latest", family: "deepseek", context: null, free: false },
  { id: "~z-ai/glm-flash-latest", name: "GLM Flash Latest (Z.ai)", family: "z-ai", context: null, free: false },
];

// Alguns IDs oficiais do catálogo usam "~"; a família é o vendor sem o prefixo.
function modelFamily(id: string): string {
  return id.replace(/^~/, "").split("/")[0].toLowerCase();
}

async function fetchCatalog(): Promise<HubModel[]> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL) return catalogCache.models;

  const res = await fetch(`${OPENROUTER_BASE}/models`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`catálogo indisponível (HTTP ${res.status})`);

  const body = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      created?: number;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
    }>;
  };

  const models = (body.data ?? [])
    .filter(
      (m): m is { id: string; name?: string; created?: number; context_length?: number; pricing?: { prompt?: string; completion?: string } } =>
        typeof m.id === "string" &&
        m.id.includes("/") &&
        // Somente chat/texto: fora variantes de lote, imagem, transcrição e embeddings
        !/(batch|transcribe|image|embed|rerank|whisper|tts)/i.test(m.id)
    )
    .filter((m) => CATALOG_FAMILIES.includes(modelFamily(m.id)) || m.id === DEFAULT_MODEL)
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .slice(0, CATALOG_MAX)
    .map<HubModel>((m) => ({
      id: m.id,
      name: (m.name ?? m.id).replace(/^[^:]+:\s*/, ""),
      family: modelFamily(m.id),
      context: typeof m.context_length === "number" ? m.context_length : null,
      free: m.pricing?.prompt === "0" && m.pricing?.completion === "0",
    }));

  if (models.length === 0) throw new Error("catálogo vazio");

  catalogCache = { at: Date.now(), models };
  return models;
}

// ── GET / POST ──

export async function GET() {
  const keys = getKeyCount();
  if (keys === 0) {
    return NextResponse.json({ available: false, keys: 0, models: [] });
  }
  let models: HubModel[];
  try {
    models = await fetchCatalog();
  } catch (e) {
    console.error("[ORBIT-OR] catálogo falhou → usando fallback:", e);
    models = FALLBACK_CATALOG;
  }
  return NextResponse.json({ available: true, keys, models });
}

type OpenRouterResult = { ok: true; reply: string } | { ok: false; status: number; message: string };

async function callOpenRouter(
  key: string,
  model: string,
  messages: OpenAiMessage[],
  origin: string
): Promise<OpenRouterResult> {
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // Atribuição opcional do app nos rankings do OpenRouter
        "HTTP-Referer": origin || "https://orbit.app",
        "X-Title": "Orbit",
      },
      body: JSON.stringify({ model, messages }),
      signal: AbortSignal.timeout(120_000),
    });

    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const apiMessage =
        (data as { error?: { message?: string } } | null)?.error?.message?.slice(0, 300) ?? "";
      console.error(`[ORBIT-OR] modelo ${model} falhou com HTTP ${res.status}: ${apiMessage}`);
      return { ok: false, status: res.status, message: apiMessage };
    }

    const reply =
      (data as { choices?: Array<{ message?: { content?: string | null } }> } | null)?.choices?.[0]
        ?.message?.content ?? "";
    if (!reply.trim()) {
      return { ok: false, status: 502, message: "resposta vazia do modelo" };
    }
    return { ok: true, reply };
  } catch (e) {
    console.error("[ORBIT-OR] erro de rede/timeout:", e);
    return { ok: false, status: 0, message: e instanceof Error ? e.message : "falha de rede" };
  }
}

// ── erros amigáveis + POST ──

// 402/429/401 com texto claro — a UI só exibe; o chat continua utilizável.
function friendlyError(status: number, apiMessage: string, model: string): string {
  if (status === 402) {
    return `💳 O modelo ${model} está sem crédito na conta OpenRouter (402 — Payment Required). Adicione créditos em openrouter.ai/credits ou escolha outro modelo no Hub 🧠. O chat continua funcionando normalmente.`;
  }
  if (status === 429) {
    return `⏳ O modelo ${model} atingiu o limite de uso agora (429 — rate limit). Aguarde alguns segundos, troque de modelo no Hub 🧠 ou continue no Orbit (Gemini).`;
  }
  if (status === 401) {
    return "🔑 A chave OpenRouter do servidor foi recusada (401 — inválida). Confira a OPENROUTER_API_KEY no .env.local.";
  }
  if (status === 404 || status === 400) {
    return `❓ O modelo ${model} não está disponível via OpenRouter (${status}). Escolha outro modelo no Hub 🧠.${apiMessage ? ` Detalhe: ${apiMessage}` : ""}`;
  }
  if (status === 0) {
    return "🌐 Não consegui falar com o OpenRouter agora (rede/timeout). Tente novamente ou continue no Orbit (Gemini).";
  }
  return `⚠️ O modelo ${model} falhou (${status || "erro"}). Tente outro modelo no Hub 🧠 ou continue no Orbit (Gemini).${apiMessage ? ` Detalhe: ${apiMessage}` : ""}`;
}

// Histórico no formato Gemini da UI ({role: "user"|"model", parts:[{text}]})
// → formato OpenAI. A mesma UI serve aos dois backends sem mudança de payload.
function toOpenAiMessages(history: unknown, message: string): OpenAiMessage[] {
  const msgs: OpenAiMessage[] = [{ role: "system", content: SYSTEM_TEXT }];
  const hist = Array.isArray(history) ? history.slice(-8) : [];
  for (const item of hist) {
    const role = typeof (item as { role?: unknown })?.role === "string" ? (item as { role: string }).role : "";
    const parts = (item as { parts?: unknown })?.parts;
    const text = Array.isArray(parts)
      ? parts
          .map((p) => (typeof (p as { text?: unknown })?.text === "string" ? (p as { text: string }).text : ""))
          .join("\n")
          .trim()
      : "";
    if (!text) continue;
    if (role === "user") msgs.push({ role: "user", content: text });
    else if (role === "model" || role === "assistant") msgs.push({ role: "assistant", content: text });
  }
  msgs.push({ role: "user", content: message });
  return msgs;
}

export async function POST(req: Request) {
  try {
    const keys = getKeyCount();
    if (keys === 0) {
      return NextResponse.json(
        {
          error:
            "OpenRouter não configurado no servidor. Adicione OPENROUTER_API_KEY no .env.local e reinicie — ou continue no Orbit (Gemini).",
          code: "sem_chave",
        },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      message?: unknown;
      history?: unknown;
      model?: unknown;
      stream?: unknown;
    } | null;

    const message = typeof body?.message === "string" ? body.message : "";
    const stream = body?.stream === true;
    if (!message || message.length > 2000) {
      return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
    }
    const model =
      typeof body?.model === "string" && body.model.trim().length > 0
        ? body.model.trim().slice(0, 120)
        : DEFAULT_MODEL;

    // Mesma pesquisa de mercado da rota padrão (modo Vendedor com preços reais)
    const query = extractSearchQuery(message);
    let marketContext = "";
    if (query) {
      const results = await searchMercadoLivre(query);
      marketContext = results
        ? "\n\n[PESQUISA REAL — Mercado Livre Brasil. Use estes preços como base e informe ao usuário que a pesquisa foi em tempo real]:\n" +
          results.map((r) => `- ${r.title}: R$ ${r.price}`).join("\n")
        : "\n\n[A pesquisa de preços em tempo real está indisponível neste momento. Estime a faixa de preço com base no varejo brasileiro e rotule como (ESTIMATIVA). Não afirme que pesquisou em tempo real.]";
    }

    const messages = toOpenAiMessages(body?.history, message + marketContext);
    const origin = req.headers.get("origin") ?? "";

    if (stream) {
      const key = getNextKey();
      const streamRes = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": origin || "https://orbit.app",
          "X-Title": "Orbit",
        },
        body: JSON.stringify({ model, messages, stream: true }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!streamRes.ok || !streamRes.body) {
        const apiMessage = await streamRes.text().catch(() => "");
        return NextResponse.json(
          {
            error: friendlyError(streamRes.status, apiMessage, model),
            code: streamRes.status === 402 ? "sem_credito" : streamRes.status === 429 ? "rate_limit" : "openrouter_erro",
            recoverable: streamRes.status === 402 || streamRes.status === 429,
            model,
          },
          { status: streamRes.status || 502 }
        );
      }

      return new Response(streamRes.body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Rodízio: 401/402/429 em uma chave → tenta a próxima do pool antes de falhar
    let lastStatus = 0;
    let lastMessage = "";
    for (let attempt = 0; attempt < keys; attempt++) {
      const result = await callOpenRouter(getNextKey(), model, messages, origin);
      if (result.ok) {
        return NextResponse.json({ reply: result.reply, model });
      }
      lastStatus = result.status;
      lastMessage = result.message;
      if (![401, 402, 429].includes(result.status)) break;
    }

    const httpStatus = [400, 401, 402, 404, 429].includes(lastStatus) ? lastStatus : 502;
    return NextResponse.json(
      {
        error: friendlyError(lastStatus, lastMessage, model),
        code: lastStatus === 402 ? "sem_credito" : lastStatus === 429 ? "rate_limit" : "openrouter_erro",
        recoverable: lastStatus === 402 || lastStatus === 429,
        model,
      },
      { status: httpStatus }
    );
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}