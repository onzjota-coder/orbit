"use client";

import { useEffect, useState } from "react";
import { readOrbitModel, setOrbitModel } from "@/lib/orbit-model";

// ─────────────────────────────────────────────────────────────
// HUB DE INTELIGÊNCIAS — conexão com TODAS as IAs.
// Sites de IAs (ChatGPT, Copilot, Claude…) enviam X-Frame-Options/CSP
// frame-ancestors bloqueando embed — "conexão recusada" é decisão deles,
// sem workaround client-side. Por isso NÃO testamos iframe: cards de
// provedores SEM integração API abrem window.open() direto.
// ─────────────────────────────────────────────────────────────

const NOTIFY_KEY = "orbit_notify";

type HubModel = {
  id: string;
  name: string;
  family: string;
  context: number | null;
  free: boolean;
};
type ExternalSite = {
  id: string;
  icon: string;
  name: string;
  spec: string;
  url: string;
  integrated?: boolean;
  candidates?: string[];
};

// integrated = true → o Orbit já conversa com esse provedor via API no backend
// (Gemini via lib/gemini_keys.ts; OpenAI BYOK → 💎 GPT-Image; Pollinations → 🌸)
const EXTERNAL_SITES: ExternalSite[] = [
  {
    id: "chatgpt",
    icon: "🤖",
    name: "ChatGPT (OpenAI)",
    spec: "responde dentro do Orbit via OpenRouter",
    url: "https://chatgpt.com",
    candidates: ["openai/gpt-5", "openai/gpt-4.1"],
  },
  {
    id: "gemini",
    icon: "✨",
    name: "Google Gemini",
    spec: "multimodal, 1M contexto — já responde no chat via API",
    url: "https://gemini.google.com",
    integrated: true,
  },
  {
    id: "claude",
    icon: "🧠",
    name: "Claude",
    spec: "textos longos e raciocínio via OpenRouter",
    url: "https://claude.ai",
    candidates: ["anthropic/claude-opus-5", "anthropic/claude-sonnet-4"],
  },
  {
    id: "deepseek",
    icon: "🐋",
    name: "DeepSeek",
    spec: "raciocínio e código via OpenRouter",
    url: "https://chat.deepseek.com",
    candidates: [
      "deepseek/deepseek-chat-v4.1-flash:free",
      "deepseek/deepseek-v3.2",
    ],
  },
  {
    id: "zai",
    icon: "⚡",
    name: "Z.ai (GLM)",
    spec: "agente e código via OpenRouter",
    url: "https://chat.z.ai",
    candidates: ["z-ai/glm-5.3-flash:free", "z-ai/glm-4.5"],
  },
  {
    id: "copilot",
    icon: "💠",
    name: "Microsoft Copilot",
    spec: "IA da Microsoft",
    url: "https://copilot.microsoft.com",
  },
];

const EM_BREVE = [
  { id: "video", icon: "🎬", name: "Vídeo", spec: "Sora / Veo" },
  { id: "music", icon: "🎵", name: "Música", spec: "Suno" },
  { id: "agents", icon: "🤝", name: "Agentes", spec: "n8n" },
];

const cardBase =
  "flex flex-col rounded-xl border bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg dark:bg-[#101014] dark:shadow-none dark:hover:bg-[#14141a]";

// Badges fixos — sem "teste de compatibilidade" que gera erro feio
const badgeApi = (
  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
    ✅ Integrado via API
  </span>
);
const badgeOpen = (
  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:border-sky-400/25 dark:text-sky-400">
    🔗 Abre em nova aba
  </span>
);

export default function IntelligenceHub({
  onOpenOrbit,
}: {
  onOpenOrbit: () => void;
}) {
  const [notify, setNotify] = useState<string[]>([]);
  const [openrouter, setOpenrouter] = useState<{
    keys: number;
    models: HubModel[];
  } | null>(null);
  const [activeModel, setActiveModel] = useState("");
  const [openrouterConnected, setOpenrouterConnected] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIFY_KEY);
      if (raw) setNotify(JSON.parse(raw) as string[]);
    } catch {
      // storage corrompido → começa vazio
    }
  }, []);

  useEffect(() => {
    setActiveModel(readOrbitModel());
    let alive = true;
    fetch("/api/chat/openrouter")
      .then((response) => response.json())
      .then(
        (data: { available?: boolean; keys?: number; models?: HubModel[] }) => {
          if (alive && data.available && Array.isArray(data.models)) {
            setOpenrouter({ keys: data.keys ?? 1, models: data.models });
          }
        },
      )
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    fetch("/api/status/openrouter")
      .then((response) => response.json())
      .then((data: { connected?: boolean }) =>
        setOpenrouterConnected(data.connected === true),
      )
      .catch(() => setOpenrouterConnected(false));
  }, []);

  function modelForSite(site: ExternalSite): string {
    if (!openrouter || !site.candidates) return "";
    const available = new Set(openrouter.models.map((model) => model.id));
    return site.candidates.find((candidate) => available.has(candidate)) ?? "";
  }

  function chooseModel(model: string, open = false) {
    setOrbitModel(model);
    setActiveModel(model);
    if (open) onOpenOrbit();
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

  return (
    <div className="scroll-slim h-full overflow-y-auto bg-zinc-50 px-6 py-8 dark:bg-[#0C0C0F]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            🧠 Inteligências
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Provedores com API respondem dentro do Orbit. Os demais abrem em
            nova aba — sem testes de iframe que os sites bloqueiam de propósito.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 🪐 Orbit (eu mesmo) */}
          <div className={`${cardBase} border-violet-500/40`}>
            <div className="flex items-start justify-between">
              <span className="text-3xl">🪐</span>
              {badgeApi}
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

          {/* Cards de sites de IA — SEM iframe/teste: window.open direto */}
          {EXTERNAL_SITES.map((site) => {
            const model = modelForSite(site);
            const integrated = Boolean(site.integrated) || Boolean(model);
            return (
              <div
                key={site.id}
                className={`${cardBase} border-zinc-200 dark:border-white/10`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{site.icon}</span>
                  {integrated ? badgeApi : badgeOpen}
                </div>
                <h3 className="mt-3 font-display text-[15px] font-semibold text-zinc-900 dark:text-white">
                  {site.name}
                </h3>
                <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {site.spec}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    integrated
                      ? site.integrated
                        ? onOpenOrbit()
                        : chooseModel(model, true)
                      : window.open(site.url, "_blank", "noopener,noreferrer")
                  }
                  className="mt-4 rounded-lg bg-zinc-900 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {integrated
                    ? site.integrated
                      ? "Falar no chat →"
                      : `Usar no chat (${model.split("/").pop()}) →`
                    : "🔗 Abrir em nova aba →"}
                </button>
              </div>
            );
          })}

          {/* 🖼️ Nano Banana — já fala com nossa API (visão + imagem) */}
          <div className={`${cardBase} border-zinc-200 dark:border-white/10`}>
            <div className="flex items-start justify-between">
              <span className="text-3xl">🖼️</span>
              {badgeApi}
            </div>
            <h3 className="mt-3 font-display text-[15px] font-semibold text-zinc-900 dark:text-white">
              Nano Banana
            </h3>
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

          {/* 🌸 FLUX/Pollinations — integração real no backend (rota text-image) */}
          <div className={`${cardBase} border-zinc-200 dark:border-white/10`}>
            <div className="flex items-start justify-between">
              <span className="text-3xl">🌸</span>
              {badgeApi}
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
              {badgeApi}
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
          <div
            className={`flex flex-col rounded-xl border p-5 dark:bg-[#101014] ${
              openrouterConnected === true
                ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                : "border-dashed border-zinc-300 bg-white dark:border-white/15"
            }`}
          >
            <span className="text-3xl">⚙️</span>
            <h3 className="mt-3 font-display text-[15px] font-semibold text-zinc-900 dark:text-white">
              Conectar OpenRouter
            </h3>
            <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {openrouterConnected === true ? (
                "OpenRouter conectado. Os modelos disponíveis aparecem no seletor do chat."
              ) : (
                <>
                  Adicione{" "}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-white/10">
                    OPENROUTER_API_KEY
                  </code>{" "}
                  no{" "}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-white/10">
                    .env
                  </code>{" "}
                  para liberar DeepSeek, Llama e Qwen via API dentro do chat do
                  Orbit.
                </>
              )}
            </p>
            {openrouterConnected === true ? (
              <button
                type="button"
                onClick={() =>
                  document.getElementById("orbit-model-select")?.focus()
                }
                className="mt-4 rounded-lg bg-zinc-900 px-3 py-2 text-center text-[12px] font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Conectado — escolher modelo →
              </button>
            ) : (
              <span className="mt-4 rounded-full border border-zinc-300 px-2 py-0.5 text-center text-[10px] font-medium text-zinc-400 dark:border-white/10 dark:text-zinc-500">
                integração planejada
              </span>
            )}
          </div>
        </div>

        {openrouter && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#101014]">
            <label
              htmlFor="orbit-model-select"
              className="text-[13px] font-semibold text-zinc-900 dark:text-white"
            >
              🧠 Modelo do chat
            </label>
            <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">
              Vale para as próximas mensagens do Orbit.
            </p>
            <select
              id="orbit-model-select"
              value={activeModel}
              onChange={(event) => chooseModel(event.target.value)}
              className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-900 dark:border-white/15 dark:bg-[#0C0C0F] dark:text-zinc-100"
            >
              <option value="">🪐 Gemini nativo (grátis)</option>
              {openrouter.models
                .filter((model) =>
                  ["openai", "anthropic", "deepseek", "z-ai"].includes(
                    model.family,
                  ),
                )
                .map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                    {model.free ? " · grátis" : ""}
                  </option>
                ))}
            </select>
            <p className="mt-2 text-[11.5px] text-zinc-400 dark:text-zinc-500">
              {activeModel
                ? `Ativo: ${activeModel} — via OpenRouter.`
                : "Gemini nativo — padrão."}
            </p>
          </div>
        )}

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
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
                  {s.spec}
                </p>
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
    </div>
  );
}
