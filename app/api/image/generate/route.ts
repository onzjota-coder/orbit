import { NextResponse } from "next/server";
import { z } from "zod";
import { IMAGE_PROVIDERS, fallbackChain, getProvider, providersStatus } from "@/lib/image-providers/registry";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────
// POST /api/image/generate
// { prompt, provider?, model?, aspectRatio?, seed? } → imagem base64
// Timeout 25s por provedor · 1 retry · fallback chain → Pollinations
// sempre por último (grátis, nunca exige chave).
// ─────────────────────────────────────────────────────────────

const BodySchema = z.object({
  prompt: z.string().trim().min(3, "Descreva a imagem (mín. 3 caracteres).").max(800, "Prompt muito longo (máx. 800)."),
  provider: z.string().trim().max(40).optional(),
  model: z.string().trim().max(120).optional(),
  aspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("1:1"),
  seed: z.number().int().nonnegative().max(2_147_483_647).optional(),
});

const ASPECT_SIZE: Record<"1:1" | "16:9" | "9:16", { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
};

const NEGATIVE =
  "evite: mãos deformadas, dedos extras, membros extras, texto borrado, marca d'água, watermark, assinatura, low quality, blurry, deformed hands, extra fingers, distorted anatomy, jpeg artifacts";

type Attempt = { provider: string; ok: boolean; status?: number; ms: number };

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requisição inválida." },
      { status: 400 },
    );
  }

  const { prompt, provider, model, aspectRatio, seed } = parsed.data;
  const { width, height } = ASPECT_SIZE[aspectRatio];
  const fullPrompt = `${prompt}, high quality, detailed. ${NEGATIVE}`;

  // Provedor pedido existe? (se não existir ou não configurado → chain padrão)
  const requested = provider ? getProvider(provider) : undefined;
  const chain = requested ? fallbackChain(requested.id) : fallbackChain("");

  const attempts: Attempt[] = [];
  for (const p of chain) {
    if (!p.isConfigured()) continue;
    // 1 tentativa + 1 retry por provedor
    for (let attempt = 0; attempt < 2; attempt++) {
      const started = Date.now();
      try {
        const image = await p.generate({
          prompt: fullPrompt,
          model: model && requested?.id === p.id ? model : undefined,
          width,
          height,
          seed,
        });
        attempts.push({ provider: p.id, ok: true, ms: Date.now() - started });
        const dataUrl = image.base64
          ? `data:${image.mime ?? "image/png"};base64,${image.base64}`
          : image.url;
        if (dataUrl) {
          return NextResponse.json({
            imageDataUrl: dataUrl,
            provider: image.provider,
            model: image.model,
            latencyMs: image.latencyMs,
            fallbackUsed: p.id !== (provider ?? p.id),
            attempts,
          });
        }
      } catch (error) {
        const status = error instanceof Error && "status" in error ? (error as { status?: number }).status : undefined;
        console.error(
          `[IMG-GEN] ${p.id} tentativa ${attempt + 1} falhou${status ? ` (HTTP ${status})` : ""}:`,
          error instanceof Error ? error.message : error,
        );
        attempts.push({ provider: p.id, ok: false, status, ms: Date.now() - started });
      }
    }
  }

  return NextResponse.json(
    {
      error: "Nenhum provedor conseguiu gerar a imagem agora. Tente novamente em instantes.",
      attempts,
    },
    { status: 502 },
  );
}

// GET /api/image/generate → status dos provedores (conveniência)
export async function GET() {
  return NextResponse.json({ providers: providersStatus(), total: IMAGE_PROVIDERS.length });
}
