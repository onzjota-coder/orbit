import { NextResponse } from "next/server";

// Negative prompt automático — anatomia, texto e qualidade (mesmo padrão de /api/text-image)
const NEGATIVE =
  "evite: mãos deformadas, dedos extras, membros extras, texto borrado, marca d'água, watermark, assinatura, low quality, blurry, deformed hands, extra fingers, distorted anatomy, jpeg artifacts";

// ─────────────────────────────────────────────────────────────
// RODÍZIO DE CHAVES (embutido)
// Suporta: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3
// ─────────────────────────────────────────────────────────────
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter((k): k is string => typeof k === "string" && k.length > 10);

if (typeof window === "undefined") {
  console.log(`🔑 Pool de chaves Gemini: ${GEMINI_KEYS.length} chave(s) carregada(s)`);
}

let keyIndex = 0;

function getNextKey(): string {
  if (GEMINI_KEYS.length === 0) return "";
  const key = GEMINI_KEYS[keyIndex % GEMINI_KEYS.length];
  const n = (keyIndex % GEMINI_KEYS.length) + 1;
  keyIndex++;
  console.log(`🔑 Usando chave #${n} (...${key.slice(-4)})`);
  return key;
}

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────
const IMAGE_MODELS = [
  "gemini-2.5-flash-image", // Nano Banana
  "gemini-3.1-flash-image", // Nano Banana 2
  // gemini-3-pro-image removido: não existe no plano gratuito (limit: 0)
];

const STYLES: Record<string, string> = {
  "1": "pure white seamless background, studio lighting, soft shadow below the product, e-commerce catalog photo, product centered, high resolution",
  "2": "isolated on fully transparent-like clean background, perfect clean edges, clean lighting, e-commerce catalog photo, product centered",
  "3": "premium advertising scene: elegant harmonious environment related to the product's use, cinematic lighting, depth of field, product as the hero",
};

let lastGeminiError = "";

function extractImage(data: unknown): { dataUrl: string } | null {
  const d = data as {
    candidates?: {
      content?: {
        parts?: {
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }[];
      };
    }[];
  };

  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      return { dataUrl: `data:${p.inlineData.mimeType ?? "image/png"};base64,${p.inlineData.data}` };
    }
    if (p.inline_data?.data) {
      return { dataUrl: `data:${p.inline_data.mime_type ?? "image/png"};base64,${p.inline_data.data}` };
    }
  }
  return null;
}

// ── Provedor 1: Google (edita a foto original — mantém o produto real) ──
async function tryGemini(imageBase64: string, mimeType: string, styleText: string): Promise<string | null> {
  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Recrie esta foto de produto como imagem de vitrine de e-commerce: ${styleText}. Mantenha o produto EXATAMENTE igual ao da foto original (mesmo formato, cor, detalhes e marca). Retorne a imagem gerada.`,
          },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });

  for (const model of IMAGE_MODELS) {
    for (let k = 0; k < GEMINI_KEYS.length; k++) {
      const key = getNextKey();
      console.log(`🖼️ Gemini: modelo=${model} chave=#${k + 1}`);
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": key,
            },
            body,
          }
        );

        if (res.ok) {
          const data = await res.json();
          const image = extractImage(data);
          if (image) {
            console.log(`✅ Gemini gerou a imagem (${model})`);
            return image.dataUrl;
          }
          lastGeminiError = "resposta sem imagem";
          continue;
        }

        const errText = await res.text();
        console.error(`❌ Gemini ${model} chave=#${k + 1}: ${res.status}`, errText.slice(0, 200));
        lastGeminiError = `${res.status}`;
        if (res.status === 400 || res.status === 403) break;
      } catch (e) {
        console.error(`❌ Gemini ${model}: erro de rede`, e);
        lastGeminiError = "erro de rede";
      }
    }
  }
  return null;
}

// ── Provedor 2: Pollinations (100% grátis, sem chave, SEM COTA) ──
// Recebe productHint = descrição do produto (em inglês) para o prompt nunca ficar genérico
async function tryPollinations(productHint: string, styleText: string): Promise<string | null> {
  let prompt = productHint && productHint.trim().length > 3 ? productHint.trim() : "";
  if (!prompt) prompt = "professional product photography";
  // Negative prompt automático — mesmo padrão da rota text-image
  prompt = `${prompt}, ${styleText}. ${NEGATIVE}`;

  console.log("🎨 Pollinations prompt:", prompt);

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true&enhance=true&seed=${Math.floor(Math.random() * 1000000)}`;

  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    console.error(`❌ Pollinations (${res.status}):`, (await res.text()).slice(0, 200));
    return null;
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength < 1000) {
    console.error("❌ Pollinations: resposta muito pequena (provável erro)");
    return null;
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = Buffer.from(binary, "binary").toString("base64");
  console.log("✅ Pollinations gerou a imagem");
  return `data:image/png;base64,${b64}`;
}

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, style, productContext } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "Imagem ausente." }, { status: 400 });
    }

    const styleKey = typeof style === "string" && STYLES[style] ? style : "1";
    const styleText = STYLES[styleKey];

    // Estratégia 1: Google edita a foto original (ideal — mantém o produto real)
    const geminiResult = await tryGemini(imageBase64, mimeType ?? "image/png", styleText);
    if (geminiResult) {
      return NextResponse.json({ imageDataUrl: geminiResult, provider: "gemini" });
    }

    // Estratégia 2: Pollinations (grátis, sempre disponível)
    console.log(`↪️ Gemini indisponível (${lastGeminiError}). Tentando Pollinations...`);

    // Descrição do produto — da fonte mais barata para a mais cara:
    // Camada 1: contexto da conversa (GRÁTIS — o Orbit já identificou o produto!)
    // Camada 2: Gemini texto resumindo o contexto (cota leve)
    // Camada 3: extração de palavras do contexto SEM IA (zero custo)
    let productHint = "";

    if (typeof productContext === "string" && productContext.trim().length > 20) {
      // Camada 2: Gemini resume o contexto da conversa
      try {
        const hintRes = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": getNextKey(),
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `Based on this conversation excerpt, what PRODUCT should appear in a product photo? Answer in English, under 30 words, format: 'professional product photography of [product], [color], [key details]'. Reply with the sentence only. If no product is mentioned, reply only: none\n\nCONVERSATION:\n${productContext}`,
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (hintRes.ok) {
          const hd = await hintRes.json();
          const reply =
            hd?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
          if (reply && !reply.toLowerCase().includes("none")) {
            productHint = reply.trim();
          }
        }
      } catch {
        // segue para a camada 3
      }

      // Camada 3: extração SEM IA — palavras do final do contexto (mais recentes)
      if (!productHint) {
        const words = productContext
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(-12)
          .join(" ");
        if (words.length > 10) productHint = words;
      }
    }

    console.log("📦 Produto identificado:", productHint || "(não identificado — usando genérico)");

    const polliResult = await tryPollinations(productHint, styleText);
    if (polliResult) {
      return NextResponse.json({ imageDataUrl: polliResult, provider: "pollinations" });
    }

    return NextResponse.json(
      {
        error: `Os geradores de imagem estão indisponíveis agora (Google: ${lastGeminiError}). Aguarde alguns minutos e tente novamente.`,
      },
      { status: 502 }
    );
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}