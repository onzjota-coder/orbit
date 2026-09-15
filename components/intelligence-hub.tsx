"use client";

import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
// HUB DE INTELIGÊNCIAS — conexão com TODAS as IAs.
// O Orbit orquestra: teste dentro do shell, abra fora, ou converse comigo.
// Status de compatibilidade permanente em localStorage "orbit_compat".
// ─────────────────────────────────────────────────────────────

type CompatMap = Record<string, "ok" | "fail">;

const COMPAT_KEY = "orbit_compat";
const NOTIFY_KEY = "orbit_notify";
const TEST_TIMEOUT = 8000; // 8s, igual ao GuardedFrame do shell

type ExternalSite = { id: string; icon: string; name: string; spec: string; url: string };

const EXTERNAL_SITES: ExternalSite[] = [
  { id: "chatgpt", icon: "🤖", name: "ChatGPT (OpenAI)", spec: "GPT-6 Astra e família", url: "https://chatgpt.com" },
  { id: "gemini", icon: "✨", name: "Google Gemini", spec: "multimodal, 1M contexto", url: "https://gemini.google.com" },
  { id: "claude", icon: "🧠", name: "Claude", spec: "textos longos e raciocínio", url: "https://claude.ai" },
  { id: "deepseek", icon: "🐋", name: "DeepSeek", spec: "raciocínio e código FREE", url: "https://chat.deepseek.com" },
  { id: "zai", icon: "⚡", name: "Z.ai (GLM)", spec: "agente e código", url: "https://chat.z.ai" },
];

const EM_BREVE = [
  { id: "video", icon: "🎬", name: "Vídeo", spec: "Sora / Veo" },
  { id: "music", icon: "🎵", name: "Música", spec: "Suno" },
  { id: "agents", icon: "🤝", name: "Agentes", spec: "n8n" },
];

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function readCompat(): CompatMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(COMPAT_KEY) ?? "{}") as CompatMap;
  } catch {
    return {};
  }
}

function writeCompat(map: CompatMap) {
  try {
    localStorage.setItem(COMPAT_KEY, JSON.stringify(map));
  } catch {
    // storage cheio → ignora
  }
}

const cardBase =
  "flex flex-col rounded-xl border bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg dark:bg-[#101014] dark:shadow-none dark:hover:bg-[#14141a]";

export default function IntelligenceHub({
  onOpenOrbit,
  onOpenSite,
}: {
  onOpenOrbit: () => void;
  onOpenSite: (url: string, title: string) => void;
}) {
  const [compat, setCompat] = useState<CompatMap>({});
  const [notify, setNotify] = useState<string[]>([]);
  const [testing, setTesting] = useState<ExternalSite | null>(null);
  const [testStatus, setTestStatus] = useState<"loading" | "ok" | "fail">("loading");
  const testDone = useRef(false);

  useEffect(() => {
    setCompat(readCompat());
    try {
      const raw = localStorage.getItem(NOTIFY_KEY);
      if (raw) setNotify(JSON.parse(raw) as string[]);
    } catch {
      // storage corrompido → começa vazio
    }
  }, []);

  // Teste de compatibilidade: 8s para o iframe sinalizar load → ✓; senão → ✗
  useEffect(() => {
    if (!testing) return;
    testDone.current = false;
    setTestStatus("loading");
    const site = testing;
    const timer = window.setTimeout(() => {
      if (testDone.current) return;
      testDone.current = true;
      setTestStatus("fail");
      const map = { ...readCompat(), [domainOf(site.url)]: "fail" } as CompatMap;
      writeCompat(map);
      setCompat(map);
    }, TEST_TIMEOUT);
    return () => window.clearTimeout(timer);
  }, [testing]);

  function finishTest(ok: boolean) {
    if (!testing || testDone.current) return;
    testDone.current = true;
    setTestStatus(ok ? "ok" : "fail");
    const map = { ...readCompat(), [domainOf(testing.url)]: ok ? "ok" : "fail" } as CompatMap;
    writeCompat(map);
    setCompat(map);
  }

  function notifyMe(id: string) {
    if (notify.includes(id)) return;
    const next = [...notify, id];
    setNotify(next);
    try {
      localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
    } catch {
      // storage cheio → ignora
    }
  }

  function compatBadge(site: ExternalSite) {
    const status = compat[domainOf(site.url)];
    if (status === "ok")
      return (
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          ✓ funciona aqui
        </span>
      );
    if (status === "fail")
      return (
        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
          ✗ bloqueia iframe
        </span>
      );
    return (
      <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] font-medium text-zinc-400 dark:border-white/10 dark:text-zinc-500">
        ⏳ não testado
      </span>
    );
  }

  return (
    <div className="scroll-slim h-full overflow-y-auto bg-zinc-50 px-6 py-8 dark:bg-[#0C0C0F]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            🧠 Inteligências
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Todas as IAs em um só lugar. O Orbit orquestra: teste dentro do shell ou abra fora.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 🪐 Orbit (eu mesmo) */}
          <div className={`${cardBase} border-violet-500/40`}>
            <div className="flex items-start justify-between">
              <span className="text-3xl">🪐</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ orquestra
              </span>
            </div>
            <h3 className="mt-3 font-display text-[15px] font-semibold text-zinc-900 dark:text-white">
              Orbit (eu mesmo)
            </h3>
            <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Orquestra tudo — pergunta e eu roteio
            </p>
            <button
              type="button"
              onClick={onOpenOrbit}
              className="mt-4 rounded-lg bg-zinc-900 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Falar com o Orbit →
            </button>
          </div>

          {/* Cards externos com teste de compatibilidade */}
          {EXTERNAL_SITES.map((site) => {
            const inside = compat[domainOf(site.url)] === "ok";
            return (
              <div key={site.id} className={`${cardBase} border-zinc-200 dark:border-white/10`}>
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{site.icon}</span>
                  {compatBadge(site)}
                </div>
                <h3 className="mt-3 font-display text-[15px] font-semibold text-zinc-900 dark:text-white">
                  {site.name}
                </h3>
                <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {site.spec}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  {inside ? (
                    <button
                      type="button"
                      onClick={() => onOpenSite(site.url, site.name)}
                      className="rounded-lg bg-zinc-900 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                      Abrir dentro →
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setTesting(site)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-[12.5px] font-semibold text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/[0.06]"
                    >
                      Testar dentro
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => window.open(site.url, "_blank", "noopener,noreferrer")}
                    className="rounded-lg px-2 py-2 text-[12.5px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    Abrir fora →
                  </button>
                </div>
              </div>
            );
          })}

          {/* 🖼️ Nano Banana — ação no chat do Orbit */}
          <div className={`${cardBase} border-zinc-200 dark:border-white/10`}>
            <div className="flex items-start justify-between">
              <span className="text-3xl">🖼️</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ✓
              </span>
            </div>
            <h3 className="mt-3 font-display text-[15px] font-semibold text-zinc-900 dark:text-white">Nano Banana</h3>
            <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              edição de imagens
            </p>
            <button
              type="button"
              onClick={onOpenOrbit}
              className="mt-4 rounded-lg bg-zinc-900 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Anexar foto no chat →
            </button>
          </div>

          {/* 🌸 FLUX/Pollinations — ação no chat do Orbit */}
          <div className={`${cardBase} border-zinc-200 dark:border-white/10`}>
            <div className="flex items-start justify-between">
              <span className="text-3xl">🌸</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ✓
              </span>
            </div>
            <h3 className="mt-3 font-display text-[15px] font-semibold text-zinc-900 dark:text-white">
              FLUX / Pollinations
            </h3>
            <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              cria imagens do zero — grátis ✓
            </p>
            <button
              type="button"
              onClick={onOpenOrbit}
              className="mt-4 rounded-lg bg-zinc-900 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              “faça uma imagem de X” →
            </button>
          </div>

          {/* 💎 GPT-Image (OpenAI) — BYOK: máxima qualidade com a chave do usuário */}
          <div className={`${cardBase} border-violet-500/40`}>
            <div className="flex items-start justify-between">
              <span className="text-3xl">💎</span>
              <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:border-violet-400/30 dark:text-violet-400">
                BYOK
              </span>
            </div>
            <h3 className="mt-3 font-display text-[15px] font-semibold text-zinc-900 dark:text-white">
              GPT-Image (OpenAI)
            </h3>
            <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              máxima qualidade — conecte sua chave ⚙️
            </p>
            <button
              type="button"
              onClick={onOpenOrbit}
              className="mt-4 rounded-lg bg-zinc-900 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Ativar no chat (/config) →
            </button>
          </div>

          {/* ⚙️ Conectar OpenRouter */}
          <div className="flex flex-col rounded-xl border border-dashed border-zinc-300 bg-white p-5 dark:border-white/15 dark:bg-[#101014]">
            <span className="text-3xl">⚙️</span>
            <h3 className="mt-3 font-display text-[15px] font-semibold text-zinc-900 dark:text-white">
              Conectar OpenRouter
            </h3>
            <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Adicione{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-white/10">OPENROUTER_API_KEY</code> no{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-white/10">.env</code> para liberar
              DeepSeek, Llama e Qwen via API dentro do chat do Orbit.
            </p>
            <span className="mt-4 rounded-full border border-zinc-300 px-2 py-0.5 text-center text-[10px] font-medium text-zinc-400 dark:border-white/10 dark:text-zinc-500">
              integração planejada
            </span>
          </div>
        </div>

        {/* EM BREVE */}
        <div className="mt-10">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-600">
            Em breve
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {EM_BREVE.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-zinc-200 bg-zinc-100/60 p-5 opacity-80 dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <span className="text-2xl saturate-0">{s.icon}</span>
                <h4 className="mt-2 font-display text-[14px] font-semibold text-zinc-600 dark:text-zinc-300">
                  {s.name}
                </h4>
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500">{s.spec}</p>
                <button
                  type="button"
                  onClick={() => notifyMe(s.id)}
                  disabled={notify.includes(s.id)}
                  className="mt-3 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[11.5px] font-medium text-zinc-500 transition hover:bg-white dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/[0.06] disabled:cursor-default disabled:opacity-70"
                >
                  {notify.includes(s.id) ? "🔔 Avise-me salvo" : "🔔 Avise-me"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay do teste de compatibilidade — iframe com timeout de 8s */}
      {testing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-8" onClick={() => setTesting(null)}>
          <div
            className="flex h-full max-h-[560px] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#101014]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 dark:border-white/[0.06]">
              <span className="min-w-0 truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
                Teste de compatibilidade — {testing.name}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {testStatus === "loading" && <span className="text-[11px] text-zinc-400">carregando (máx. 8s)…</span>}
                {testStatus === "ok" && (
                  <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">✓ funciona dentro</span>
                )}
                {testStatus === "fail" && (
                  <span className="text-[12px] font-semibold text-red-600 dark:text-red-400">✗ bloqueia iframe</span>
                )}
                <button
                  type="button"
                  onClick={() => setTesting(null)}
                  aria-label="Fechar teste"
                  className="flex h-6 w-6 items-center justify-center rounded text-[11px] text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="relative min-h-0 flex-1">
              {testStatus === "loading" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-[#0E0E11]">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-white/20 dark:border-t-white" />
                </div>
              )}
              {testStatus === "fail" ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <p className="text-3xl">🔒</p>
                  <p className="max-w-sm text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {testing.name} não abre dentro do shell. O Orbit orquestra mesmo assim:
                  </p>
                  <button
                    type="button"
                    onClick={() => window.open(testing.url, "_blank", "noopener,noreferrer")}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  >
                    Abrir fora →
                  </button>
                </div>
              ) : (
                <iframe
                  src={testing.url}
                  title={`Teste ${testing.name}`}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                  onLoad={() => finishTest(true)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
