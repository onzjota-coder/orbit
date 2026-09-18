import { NextResponse } from "next/server";
import { getKeyCount, getNextKey } from "@/lib/gemini_keys";
import { rateLimit } from "@/lib/api/rate-limit";

export const maxDuration = 60;

const DAILY_LIMIT = 10;

const MODELS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
];

const GEMINI_PROVIDER_METADATA = {
  requestedProvider: "gemini",
  effectiveProvider: "gemini",
  requestedModel: MODELS[0],
  fallbackUsed: false,
} as const;

function streamHeaders(effectiveModel: string): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Orbit-Requested-Provider": GEMINI_PROVIDER_METADATA.requestedProvider,
    "X-Orbit-Effective-Provider": GEMINI_PROVIDER_METADATA.effectiveProvider,
    "X-Orbit-Requested-Model": GEMINI_PROVIDER_METADATA.requestedModel,
    "X-Orbit-Effective-Model": effectiveModel,
    "X-Orbit-Fallback-Used": "false",
    "X-Orbit-Logical-Provider": "gemini",
    "X-Orbit-Technical-Provider": "gemini",
  };
}

const SYSTEM_TEXT = `REGRA ABSOLUTA DE FORMATO: sua resposta NUNCA deve começar ou conter rótulos internos como "CLASSIFICAÇÃO:", "INTENÇÃO:", "PERGUNTA" ou "VENDA" — decisões internas são invisíveis ao usuário. Comece diretamente com a resposta.

IDENTIDADE TÉCNICA: você orquestra 4 motores de IA: (1) Gemini Flash — conversas, análises e visão; (2) GPT-Image/OpenAI — imagens premium se o usuário configurou chave; (3) FLUX via Pollinations — criação de imagens gratuita; (4) remoção de fundo local imgly — processa no dispositivo. O navegador Orbit ainda dá acesso a 1 clique para ChatGPT, Gemini, Claude, DeepSeek e Z.ai. Em perguntas sobre quantas IAs você usa, responda com esses números reais, orgulhoso mas humilde.

QUANDO o usuário pedir documentos (currículo, declaração, relatório etc.), gere o conteúdo COMPLETO imediatamente com campos [COLCHETES] — NUNCA peça os dados antes e NUNCA diga que não pode gerar arquivos. O sistema converte automaticamente em PDF, Word, HTML ou TXT baixável.

Você é o Orbit, a inteligência central de um navegador brasileiro que une IAs, sites e automações. VOCÊ TEM PODERES REAIS: geração de imagens por texto (oriente: 'faça uma imagem de X'), análise de fotos (vitrines), anúncios completos, documentos estruturados. NUNCA diga que não pode gerar imagens ou anúncios.

REGRA DE HUMILDADE TEMPORAL: seu conhecimento tem data de corte. Se perguntarem sobre produto que você não conhece, NUNCA afirme que 'não existe' — diga: 'Meu conhecimento pode estar desatualizado, verifique o site oficial.' (Caso real: negamos GPT-6 Astra, lançado depois do treino e confirmado em openai.com.)

ANTES DE RESPONDER, CLASSIFIQUE A INTENÇÃO do usuário:

REGRAS DE CLASSIFICAÇÃO:
1. PERGUNTA (não use modo vendedor): o usuário pergunta sobre algo — sinais: "o que é", "me fale sobre", "existe", "como funciona", "quem criou", "vale a pena?", "?" interrogando um conceito. Nesses casos RESPONDA a pergunta como assistente normal. Se for sobre um produto que você não conhece, aplique a REGRA DE HUMILDADE TEMPORAL (nunca afirme que não existe — diga que seu conhecimento pode estar desatualizado e sugira verificar o site oficial), e peça mais contexto se ajudar. NUNCA invente características, preços ou disponibilidade de produtos que não conhece.
2. VENDA (ative o modo vendedor): o usuário pede explicitamente para vender/anunciar — sinais: "anuncie", "anunciar", "quero vender", "monte o anúncio", "crie o anúncio", "publique". Só então entregue o formato completo abaixo.
3. AMBÍGUO (ex.: o usuário só cita o nome de um produto): responda explicando o que sabe sobre ele e PERGUNTE se deseja criar um anúncio. Nunca gere anúncio sem pedido explícito.

QUANDO O MODO VENDEDOR FOR ATIVADO, responda OBRIGATORIAMENTE neste formato:

PRODUTO: <nome curto>
TÍTULO MERCADO LIVRE (máx. 60 caracteres, palavra-chave no início): <título>
TÍTULO SHOPEE (máx. 120 caracteres, mais descritivo): <título>
DESCRIÇÃO: <texto de venda com palavras-chave, 2-4 parágrafos curtos>
CATEGORIA: <categoria padrão de marketplace>
PREÇO SUGERIDO: <valor ou faixa — se houver PESQUISA REAL no contexto, baseie-se nela; senão estime pelo varejo brasileiro e escreva (ESTIMATIVA)>

Regras do modo vendedor:
- Use EXATAMENTE o produto descrito na conversa (mesma marca/cor). PROIBIDO substituir por "modelo mais vendido". Marca faltando = [MARCA] como placeholder + perguntar.
- Campos faltantes = [colchetes] + lista do que completar.
- Nunca invente pesquisa em tempo real.
- Português do Brasil. Direto. Sem emojis.`;

async function callGemini(contents: object[]) {
  let lastError = "";

  for (const model of MODELS) {
    const keys = getKeyCount();
    for (let attempt = 0; attempt < Math.max(keys, 1); attempt++) {
      const key = getNextKey();
      if (!key) return { ok: false as const, error: "sem_chave" };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_TEXT }] },
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("");
      if (reply) return { ok: true as const, reply, model };
      lastError = "resposta vazia";
      continue;
    }

    const errText = await res.text();
    console.error(`ERRO GEMINI (${model}):`, res.status);
    lastError = `${res.status}`;
    if (res.status !== 503 && res.status !== 429) break;
    }
  }

  return { ok: false as const, error: lastError };
}

type MlItem = { title: string; price: number; link: string };

async function searchMercadoLivre(query: string): Promise<MlItem[] | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    // Quando criarmos o app no ML (Etapa 2), basta colar o token no .env.local
    // e os preços passam a ser reais automaticamente.
    if (process.env.MELI_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.MELI_ACCESS_TOKEN}`;
    }

    const res = await fetch(
      `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=5`,
      { headers }
    );

    if (!res.ok) {
      console.error(
        "ERRO MERCADO LIVRE:",
        res.status,
        (await res.text()).slice(0, 300)
      );
      return null;
    }

    const data = await res.json();
    const items: MlItem[] = (data.results ?? [])
      .slice(0, 5)
      .map((r: { title?: string; price?: number; permalink?: string }) => ({
        title: r.title ?? "",
        price: r.price ?? 0,
        link: r.permalink ?? "",
      }))
      .filter((i: MlItem) => i.price > 0);

    return items.length ? items : null;
  } catch (e) {
    console.error("ERRO MERCADO LIVRE (fetch):", e);
    return null;
  }
}

function extractSearchQuery(message: string): string | null {
  const m = message.toLowerCase();
  const triggers = ["anuncia", "vender", "venda", "preço", "quanto custa", "pesquisa", "anúncio"];
  if (!triggers.some((t) => m.includes(t))) return null;

  const cleaned = message
    .replace(
      /anunci[ae]r?|anúncio|vender|venda|pesquis[ae]r?|preços? de mercado|quanto custa|no mercado livre|mercado livre/gi,
      ""
    )
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();

  return cleaned.length > 2 ? cleaned : null;
}

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "chat", 30, 60_000);
    if (limited) return limited;
    const body = (await req.json().catch(() => null)) as {
      message?: unknown;
      history?: unknown;
      stream?: unknown;
      provider?: unknown;
      logicalProvider?: unknown;
    } | null;

    const message = typeof body?.message === "string" ? body.message : "";
    const stream = body?.stream === true;

    if (!message || typeof message !== "string" || message.length > 2000) {
      return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
    }

    const query = extractSearchQuery(message);
    let marketContext = "";

    if (query) {
      const results = await searchMercadoLivre(query);
      if (results) {
        marketContext =
          "\n\n[PESQUISA REAL — Mercado Livre Brasil. Use estes preços como base e informe ao usuário que a pesquisa foi em tempo real]:\n" +
          results.map((r) => `- ${r.title}: R$ ${r.price}`).join("\n");
      } else {
        marketContext =
          "\n\n[A pesquisa de preços em tempo real está indisponível neste momento. Estime a faixa de preço com base no varejo brasileiro e rotule como (ESTIMATIVA). Não afirme que pesquisou em tempo real.]";
      }
    }

    const historyItems = Array.isArray(body?.history)
      ? ((body.history as unknown[]) as object[]).slice(-8)
      : [];
    const contents: object[] = [
      ...historyItems,
      { role: "user", parts: [{ text: message + marketContext }] },
    ];

    if (stream) {
      const key = getNextKey();
      if (!key) return NextResponse.json({ error: "IA não configurada no servidor." }, { status: 503 });
      const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS[0]}:streamGenerateContent?alt=sse`;
      const upstream = await fetch(streamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_TEXT }] },
        }),
      });

      if (!upstream.ok || !upstream.body) {
        console.error("ERRO GEMINI STREAM:", upstream.status);
        return NextResponse.json(
          { error: "A IA está com alta demanda agora. Aguarde alguns segundos e tente novamente." },
          { status: 502 }
        );
      }

      return new Response(upstream.body, { headers: streamHeaders(MODELS[0]) });
    }

    const result = await callGemini(contents);

    if (!result.ok) {
      return NextResponse.json(
        { error: "A IA está com alta demanda agora. Aguarde alguns segundos e tente novamente." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      reply: result.reply,
      limit: DAILY_LIMIT,
      ...GEMINI_PROVIDER_METADATA,
      effectiveModel: result.model,
      logicalProvider: "gemini",
      technicalProvider: "gemini",
    });
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}
