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

    const fullPrompt = `${prompt.trim()}, high quality, detailed`;

    // RETRY: 3 tentativas — o Pollinations é instável
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🖼️ Pollinations tentativa ${attempt}/3`);
      const res = await fetch(
        `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${Math.floor(
          Math.random() * 1000000
        )}`,
        { method: "GET", signal: AbortSignal.timeout(90_000) }
      );

      if (res.ok) {
        const buffer = await res.arrayBuffer();
        if (buffer.byteLength > 1000) {
          let binary = "";
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < bytes.length; i += 8192) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          }
          const b64 = Buffer.from(binary, "binary").toString("base64");
          console.log(`✅ Imagem gerada na tentativa ${attempt}`);
          // Mime real da resposta (Pollinations costuma devolver image/jpeg)
          const mime = res.headers.get("content-type")?.startsWith("image/")
            ? res.headers.get("content-type")!
            : "image/jpeg";
          return NextResponse.json({ imageDataUrl: `data:${mime};base64,${b64}` });
        }
        console.warn(`⚠️ Tentativa ${attempt}: resposta curta (${buffer.byteLength} bytes) — repetindo`);
      } else {
        console.error(`❌ Tentativa ${attempt}: status ${res.status}`);
      }

      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    return NextResponse.json(
      { error: "O gerador está ocupado. Tente novamente em 1 minuto." },
      { status: 502 }
    );
  } catch {
    return NextResponse.json({ error: "Erro inesperado ao gerar a imagem." }, { status: 500 });
  }
}