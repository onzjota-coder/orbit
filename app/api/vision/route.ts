import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, prompt } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "Imagem ausente." }, { status: 400 });
    }

    const userText =
      typeof prompt === "string" && prompt.trim().length > 0
        ? prompt.trim()
        : "Analise este produto para anúncio em marketplace.";

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: userText },
                {
                  inline_data: {
                    mime_type: mimeType ?? "image/png",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          systemInstruction: {
            parts: [
              {
                text: "Você é o Orbit, especialista em e-commerce. Analise a imagem do produto e descreva: o que é, características visuais (cor, material aparente, estado), público-alvo e palavras-chave de busca. Depois crie título para Mercado Livre (máx 60 caracteres) e Shopee (máx 120). Português do Brasil, sem emojis, direto ao ponto.",
              },
            ],
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("ERRO GEMINI VISION:", res.status, errText);
      return NextResponse.json(
        { error: "A IA está com alta demanda. Tente novamente em instantes." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "Não consegui analisar a imagem.";

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}