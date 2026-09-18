import { NextResponse } from "next/server";
import { getKeyCount, getNextKey } from "@/lib/openrouter_keys";
import { OPENROUTER_BASE } from "@/lib/ai/openrouter";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────
// Estado do OpenRouter com 4 níveis, sem expor segredos:
//   "nao_configurado"          → nenhuma chave no pool
//   "configurado_nao_validado" → há chave, mas ainda não houve resposta da API
//   "rejeitado"                → a API recusou a chave (401/403)
//   "operacional"              → a API respondeu com sucesso
// A validação é leve: GET /key (endpoint barato da OpenRouter), 1 chamada
// por cache válido (30 min). Falha de rede NUNCA degrada para "rejeitado"
// — volta a "configurado_nao_validado" com um aviso.
// ─────────────────────────────────────────────────────────────

type OpenRouterState =
  | "nao_configurado"
  | "configurado_nao_validado"
  | "rejeitado"
  | "operacional";

type Probe = { state: OpenRouterState; at: number; checkedAt: string | null };

const PROBE_TTL = 30 * 60 * 1000; // 30 min — evita chamadas excessivas
let cachedProbe: Probe = { state: "configurado_nao_validado", at: 0, checkedAt: null };

function keyCount(): number {
  try {
    return getKeyCount();
  } catch {
    return 0;
  }
}

async function probeKey(): Promise<Probe> {
  const key = getNextKey();
  if (!key) return { state: "nao_configurado", at: Date.now(), checkedAt: new Date().toISOString() };
  try {
    const res = await fetch(`${OPENROUTER_BASE}/key`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      return { state: "operacional", at: Date.now(), checkedAt: new Date().toISOString() };
    }
    if (res.status === 401 || res.status === 403) {
      return { state: "rejeitado", at: Date.now(), checkedAt: new Date().toISOString() };
    }
    // Erro do provedor (429/5xx etc.) → chave pode ser boa; não rejeita.
    return { state: "configurado_nao_validado", at: Date.now(), checkedAt: new Date().toISOString() };
  } catch {
    // Rede/timeout → NÃO valida nem rejeita.
    return { state: "configurado_nao_validado", at: Date.now(), checkedAt: new Date().toISOString() };
  }
}

export async function GET() {
  const keys = keyCount();
  if (keys === 0) {
    cachedProbe = { state: "nao_configurado", at: 0, checkedAt: null };
    return NextResponse.json({
      connected: false,
      state: "nao_configurado",
      keys: 0,
      checkedAt: null,
      note: "Nenhuma OPENROUTER_API_KEY configurada no servidor.",
    });
  }

  const stale = cachedProbe.at <= 0 || Date.now() - cachedProbe.at > PROBE_TTL;
  if (stale) {
    cachedProbe = await probeKey();
  }

  const { state, checkedAt } = cachedProbe;
  return NextResponse.json({
    connected: state === "operacional",
    state,
    keys,
    checkedAt,
    note:
      state === "operacional"
        ? "Chave aceita pela API."
        : state === "rejeitado"
          ? "A API recusou a chave — troque-a no .env.local."
          : state === "configurado_nao_validado"
            ? "Chave presente no servidor, mas ainda não validada pela API."
            : "Não configurado.",
  });
}
