import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────
// Geração de imagem por TEXTO — padrão: Pollinations (FLUX) grátis.
// Com OPENAI_API_KEY no servidor (BYOK), GPT-Image vira o motor padrão.
// ─────────────────────────────────────────────────────────────

// Negative prompt automático — anatomia, texto e qualidade (aplicado a todos os motores)
const NEGATIVE =
  "evite: mãos deformadas, dedos extras, membros extras, texto borrado, marca d'água, watermark, assinatura, low quality, blurry, deformed hands, extra fingers, distorted anatomy, jpeg artifacts";

export async function POST(req: Request) {
  try {
    const { prompt, premium, forcePollinations } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Descreva a imagem que você quer gerar." },
        { status: 400 },
      );
    }
    if (prompt.length > 500) {
      return NextResponse.json(
        { error: "Descrição muito longa (máx. 500 caracteres)." },
        { status: 400 },
      );
    }

    const fullPrompt = `${prompt.trim()}, high quality, detailed. ${NEGATIVE}`;

    // ─────────────────────────────────────────────────────────
    // BYOK — Bring Your Own Key. Configure no .env.local (OPCIONAL):
    //   OPENAI_API_KEY=sk-...   (chave do usuário da OpenAI → 💎 GPT-Image)
    // Com a chave presente, GPT-Image é o MOTOR PADRÃO; se falhar
    // (401/429/rede), cai para o Pollinations gratuito com retry.
    // ─────────────────────────────────────────────────────────
    const openaiKey = process.env.OPENAI_API_KEY;
    const wantOpenai = typeof openaiKey === "string" && openaiKey.length > 10;
    let notice: string | undefined;

    // PRIORIDADE 1: GPT-Image (motor padrão quando o servidor tem a chave)
    if (wantOpenai && forcePollinations !== true) {
      console.log("[ORBIT-IMG] provedor=openai");
      try {
        const res = await fetch(
          "https://api.openai.com/v1/images/generations",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-image-1",
              prompt: fullPrompt,
              size: "1024x1024",
              n: 1,
              quality: "high",
            }),
            signal: AbortSignal.timeout(120_000),
          },
        );

        if (res.ok) {
          const data = await res.json();
          const b64 = data?.data?.[0]?.b64_json;
          if (b64) {
            console.log(
              "[ORBIT-IMG] ✅ imagem gerada pela OpenAI (gpt-image-1)",
            );
            return NextResponse.json({
              imageDataUrl: `data:image/png;base64,${b64}`,
              provider: "openai",
            });
          }
          console.error(
            "[ORBIT-IMG] OpenAI respondeu sem b64_json → caindo para Pollinations",
          );
        } else {
          // 401 = chave inválida · 429 = cota esgotada → fallback automático
          console.error(
            `[ORBIT-IMG] OpenAI falhou (status ${res.status}) → caindo para Pollinations`,
          );
        }
      } catch (e) {
        console.error(
          "[ORBIT-IMG] OpenAI indisponível (rede/timeout) → caindo para Pollinations",
          e,
        );
      }
    } else if (premium === true) {
      notice =
        "⚠️ Nenhuma OPENAI_API_KEY configurada no servidor — usando gerador gratuito";
      console.log(
        "[ORBIT-IMG] premium pedido, mas sem OPENAI_API_KEY no servidor → Pollinations",
      );
    }

    // PRIORIDADE 2 (grátis/ fallback): Pollinations com retry
    console.log("[ORBIT-IMG] provedor=pollinations");

    // RETRY: 3 tentativas — o Pollinations é instável
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🖼️ Pollinations tentativa ${attempt}/3`);
      const res = await fetch(
        `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&model=flux&nologo=true&enhance=true&seed=${Math.floor(
          Math.random() * 1000000,
        )}`,
        { method: "GET", signal: AbortSignal.timeout(90_000) },
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
          return NextResponse.json({
            imageDataUrl: `data:${mime};base64,${b64}`,
            provider: "pollinations",
            ...(notice ? { notice } : {}),
          });
        }
        console.warn(
          `⚠️ Tentativa ${attempt}: resposta curta (${buffer.byteLength} bytes) — repetindo`,
        );
      } else {
        console.error(`❌ Tentativa ${attempt}: status ${res.status}`);
      }

      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    return NextResponse.json(
      {
        error: "O gerador está ocupado. Tente novamente em 1 minuto.",
        ...(notice ? { notice } : {}),
      },
      { status: 502 },
    );
  } catch {
    return NextResponse.json(
      { error: "Erro inesperado ao gerar a imagem." },
      { status: 500 },
    );
  }
}
