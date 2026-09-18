import { NextResponse } from "next/server";
import { getKeyCount as getGeminiKeyCount } from "@/lib/gemini_keys";
import { getKeyCount as getOpenRouterKeyCount } from "@/lib/openrouter_keys";

export const dynamic = "force-dynamic";

/**
 * Estado seguro dos provedores de chat. Nunca inclui chaves, nomes de
 * variáveis preenchidas ou qualquer dado que permita identificar um segredo.
 */
export async function GET() {
  return NextResponse.json({
    gemini: { configured: getGeminiKeyCount() > 0 },
    openrouter: { configured: getOpenRouterKeyCount() > 0 },
  });
}
