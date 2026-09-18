import { NextResponse } from "next/server";
import { getKeyCount as getGeminiKeyCount } from "@/lib/gemini_keys";
import { getKeyCount as getOpenRouterKeyCount } from "@/lib/openrouter_keys";

export const dynamic = "force-dynamic";

/**
 * Estado seguro dos provedores de chat. Nunca inclui chaves, nomes de
 * variáveis preenchidas ou qualquer dado que permita identificar um segredo.
 * `configured` = há chave no pool (presença, não validade).
 * `state` = "configurado" | "nao_configurado" (apenas presença).
 * A validação real contra a API do OpenRouter (com cache de 30 min) vive em
 * /api/status/openrouter — chame-a quando precisar distinguir
 * rejeitado/operacional. */
export async function GET() {
  const openRouterKeys = getOpenRouterKeyCount();
  return NextResponse.json({
    gemini: { configured: getGeminiKeyCount() > 0 },
    openrouter: {
      configured: openRouterKeys > 0,
      // Sem validar aqui: validação real (com cache) vive em /api/status/openrouter.
      state: openRouterKeys > 0 ? "configurado" : "nao_configurado",
    },
  });
}
