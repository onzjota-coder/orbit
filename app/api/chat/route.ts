import { NextResponse } from "next/server";

const DAILY_LIMIT = 10;

const MODELS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
];

const SYSTEM_TEXT = `Você é o Orbit, assistente executivo com MODO VENDEDOR especializado em e-commerce brasileiro.

Sempre que o usuário falar sobre anunciar, vender ou pesquisar um produto, responda OBRIGATORIAMENTE neste formato, com estas seções exatas e nesta ordem:

PRODUTO: <nome curto do produto>
TÍTULO MERCADO LIVRE (máx. 60 caracteres, palavra-chave no início): <título>
TÍTULO SHOPEE (máx. 120 caracteres, mais descritivo): <título>
DESCRIÇÃO: <texto de venda com palavras-chave de busca, 2 a 4 parágrafos curtos>
CATEGORIA: <categoria padrão de marketplace>
PREÇO SUGERIDO: <valor ou faixa — se houver PESQUISA REAL no contexto, baseie-se nela e cite isso; se não houver, estime pelo varejo brasileiro e escreva (ESTIMATIVA) ao lado>

Regras:
- Se o pedido for genérico (ex.: "capacetes de motos"), escolha o modelo mais vendido como exemplo, entregue o formato completo e, ao final, pergunte se ele quer personalizar para um modelo específico ou enviar uma foto do produto.
- Se faltarem informações (marca, tamanho, cor), entregue mesmo assim usando [colchetes] para o que falta e liste o que precisa completar.
- Nunca invente pesquisa real. Só cite preços reais se estiverem no contexto.
- Português do Brasil. Direto. Sem emojis.`;

async function callGemini(contents: object[]) {
  let lastError = "";

  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
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
      if (reply) return { ok: true as const, reply };
      lastError = "resposta vazia";
      continue;
    }

    const errText = await res.text();
    console.error(`ERRO GEMINI (${model}):`, res.status, errText);
    lastError = `${res.status}`;
    if (res.status !== 503 && res.status !== 429) break;
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
    const { message, history } = await req.json();

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

    const contents = [
      ...(Array.isArray(history) ? history.slice(-8) : []),
      { role: "user", parts: [{ text: message + marketContext }] },
    ];

    const result = await callGemini(contents);

    if (!result.ok) {
      return NextResponse.json(
        { error: "A IA está com alta demanda agora. Aguarde alguns segundos e tente novamente." },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply: result.reply, limit: DAILY_LIMIT });
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}