import { NextResponse } from "next/server";
import { getKeyCount, getNextKey } from "@/lib/openrouter_keys";
import {
  OPENROUTER_BASE,
  DEFAULT_MODEL,
  callOpenRouter,
  friendlyError,
  type OpenAiMessage,
} from "@/lib/ai/openrouter";
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

// ─────────────────────────────────────────────────────────────
// OPENROUTER_BASE, DEFAULT_MODEL, friendlyError e OpenAiMessage
// agora vivem em lib/ai/openrouter.ts (client reutilizável).
// ─────────────────────────────────────────────────────────────

// GET sem parâmetro de request seria pré-renderizado no build — forçamos
// execução dinâmica (o pool de chaves é lido em tempo de execução).
export const dynamic = "force-dynamic";

type HubModel = { id: string; name: string; family: string; context: number | null; free: boolean };

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