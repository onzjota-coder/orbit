import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────
// Geração de imagem por TEXTO — Pollinations (FLUX) direto.
// SEM depender de Gemini: sempre disponível, zero cota de API paga.
// ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Descreva a imagem que você quer gerar." }, { status: 400 });
    }
    if (prompt.length > 500) {
      return NextResponse.json({ error: "Descrição muito longa (máx. 500 caracteres)." }, { status: 400 });
    }

    const seed = Math.floor(Math.random() * 1_000_000);
    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim() + ", high quality, detailed")}` +
      `?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) {
      console.error("ERRO POLLINATIONS TEXT-IMAGE:", res.status, (await res.text()).slice(0, 300));
      return NextResponse.json(
        { error: "O gerador de imagens está indisponível agora. Tente novamente em instantes." },
        { status: 502 }
      );
    }

    // Binário → base64 → data URL
    const buffer = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type")?.startsWith("image/") ? res.headers.get("content-type")! : "image/jpeg";
    return NextResponse.json({ imageDataUrl: `data:${mime};base64,${buffer.toString("base64")}` });
  } catch {
    return NextResponse.json({ error: "Erro inesperado ao gerar a imagem." }, { status: 500 });
  }
}