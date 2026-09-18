import { NextResponse } from "next/server";
import { z } from "zod";
import { getNextKey } from "@/lib/gemini_keys";
import { rateLimit } from "@/lib/api/rate-limit";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "vision", 10, 60_000);
    if (limited) return limited;
    const body = await req.json().catch(() => null);
    const parsed = z.object({
      imageBase64: z.string().min(32).max(8_000_000),
      mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
      prompt: z.string().trim().max(1200).optional(),
    }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Imagem ou dados inválidos." }, { status: 400 });
    const { imageBase64, mimeType, prompt } = parsed.data;

    if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
    const key = getNextKey();
    if (!key) return NextResponse.json({ error: "IA não configurada no servidor." }, { status: 503 });

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
          "x-goog-api-key": key,
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
      console.error("ERRO GEMINI VISION:", res.status);
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
