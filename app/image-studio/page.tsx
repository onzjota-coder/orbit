"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// ─────────────────────────────────────────────────────────────
// Estúdio de Imagem Orbit — multi-provider com fallback chain.
// Funciona SEM nenhuma chave (Pollinations). Modo Batalha gera
// o mesmo prompt em 3–4 provedores lado a lado. Galeria das
// últimas 30 imagens em localStorage.
// ─────────────────────────────────────────────────────────────

import { type GalleryItem, addToGallery, clearGallery, loadGallery } from "@/lib/image-gallery";

type ProviderStatus = {
  id: string;
  label: string;
  models: { id: string; label: string; costHint?: string }[];
  configured: boolean;
  missingEnv: string[];
};

type GenerateResponse = {
  imageDataUrl?: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  fallbackUsed?: boolean;
  error?: string;
};

type AspectRatio = "1:1" | "16:9" | "9:16";

const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: "1:1", label: "Quadrada 1:1" },
  { value: "16:9", label: "Paisagem 16:9" },
  { value: "9:16", label: "Retrato 9:16" },
];

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)
      .replace(/(^-|-$)/g, "") || "orbit"
  );
}

type BattleSlot = {
  providerId: string;
  imageDataUrl: string | null;
  loading: boolean;
  error: string | null;
  provider?: string;
  latencyMs?: number;
};

export default function ImageStudio() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<AspectRatio>("1:1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [showGallery, setShowGallery] = useState(true);
  const [battleMode, setBattleMode] = useState(false);
  const [battleSlots, setBattleSlots] = useState<BattleSlot[]>([]);

  // Carrega provedores + galeria
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/image/providers");
        const data = (await res.json()) as { providers?: ProviderStatus[] };
        const list = data.providers ?? [];
        setProviders(list);
        const firstConfigured = list.find((p) => p.configured);
        if (firstConfigured) {
          setSelected(firstConfigured.id);
          setModel(firstConfigured.models[0]?.id ?? "");
        }
      } catch {
        setError("Não foi possível carregar os provedores de imagem.");
      }
    })();
    setGallery(loadGallery());
  }, []);

  const selectedProvider = useMemo(() => providers.find((p) => p.id === selected), [providers, selected]);

  useEffect(() => {
    if (selectedProvider) setModel(selectedProvider.models[0]?.id ?? "");
  }, [selectedProvider]);

  const saveToGallery = useCallback(
    (dataUrl: string, promptText: string, providerId: string, modelId: string) => {
      setGallery(
        addToGallery({
          imageDataUrl: dataUrl,
          prompt: promptText,
          provider: providerId,
          model: modelId,
          aspectRatio: aspect,
        }),
      );
    },
    [aspect],
  );

  async function requestImage(providerId: string | undefined, promptText: string): Promise<GenerateResponse> {
    const res = await fetch("/api/image/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: promptText,
        provider: providerId || undefined,
        model: providerId === selected ? model || undefined : undefined,
        aspectRatio: aspect,
      }),
    });
    return (await res.json()) as GenerateResponse;
  }

  async function generate() {
    if (prompt.trim().length < 3) {
      setError("Descreva a imagem que você quer gerar (mín. 3 caracteres).");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    setResult(null);
    try {
      const data = await requestImage(selected || undefined, prompt.trim());
      if (data.error || !data.imageDataUrl) {
        setError(data.error ?? "Falha ao gerar a imagem. Tente novamente.");
      } else {
        setResult(data);
        if (data.fallbackUsed && data.provider && selected) {
          setNotice(
            `⚠️ "${selectedProvider?.label ?? selected}" falhou — imagem gerada por ${data.provider} (fallback automático).`,
          );
        }
        saveToGallery(data.imageDataUrl, prompt.trim(), data.provider ?? "desconhecido", data.model ?? "");
      }
    } catch {
      setError("Erro de conexão com o servidor. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function regenerateWith(providerId: string) {
    const target = providers.find((p) => p.id === providerId);
    if (!target?.configured) {
      setError(`"${target?.label ?? providerId}" não está configurado no servidor (faltam chaves).`);
      return;
    }
    setSelected(providerId);
    setLoading(true);
    setError(null);
    setNotice(null);
    setResult(null);
    try {
      const data = await requestImage(providerId, prompt.trim());
      if (data.error || !data.imageDataUrl) {
        setError(data.error ?? "Falha ao regenerar. Tente outro provedor.");
      } else {
        setResult(data);
        saveToGallery(data.imageDataUrl, prompt.trim(), data.provider ?? providerId, data.model ?? "");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function runBattle() {
    if (prompt.trim().length < 3) {
      setError("Escreva o prompt antes da batalha.");
      return;
    }
    const configured = providers.filter((p) => p.configured && p.id !== "pollinations").slice(0, 3);
    const chosen = [{ id: "pollinations" }, ...configured];
    setBattleMode(true);
    setBattleSlots(chosen.map((p) => ({ providerId: p.id, imageDataUrl: null, loading: true, error: null })));
    setError(null);
    await Promise.all(
      chosen.map(async (p, idx) => {
        try {
          const data = await requestImage(p.id, prompt.trim());
          setBattleSlots((slots) =>
            slots.map((slot, i) =>
              i === idx
                ? {
                    ...slot,
                    loading: false,
                    imageDataUrl: data.imageDataUrl ?? null,
                    error: data.error ?? (data.imageDataUrl ? null : "Falhou"),
                    provider: data.provider,
                    latencyMs: data.latencyMs,
                  }
                : slot,
            ),
          );
          if (data.imageDataUrl) {
            saveToGallery(data.imageDataUrl, prompt.trim(), data.provider ?? p.id, data.model ?? "");
          }
        } catch {
          setBattleSlots((slots) =>
            slots.map((slot, i) => (i === idx ? { ...slot, loading: false, error: "Erro de conexão" } : slot)),
          );
        }
      }),
    );
  }


  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">🎨 Estúdio de Imagem</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          11 provedores com fallback automático. Funciona sem chave (Pollinations grátis).
        </p>
      </header>

      {/* Prompt */}
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Descreva a imagem: ex. fone de ouvido bluetooth preto flutuando em fundo roxo, iluminação de estúdio"
        rows={3}
        maxLength={800}
        className="w-full rounded-xl border border-zinc-300 bg-white p-4 text-sm outline-none transition focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* Provedor */}
        <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          Provedor
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.configured ? "✅" : "⚪"} {p.label}
              </option>
            ))}
          </select>
        </label>
        {/* Modelo */}
        {selectedProvider && selectedProvider.models.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            Modelo
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {selectedProvider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.costHint ? ` (${m.costHint})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {/* Proporção */}
        <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          Proporção
          <select
            value={aspect}
            onChange={(event) => setAspect(event.target.value as AspectRatio)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {ASPECT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? "⏳ Gerando…" : "✨ Gerar"}
        </button>
        <button
          onClick={runBattle}
          disabled={loading}
          className="rounded-xl border border-violet-400 px-5 py-2.5 text-sm font-semibold text-violet-600 transition hover:bg-violet-50 disabled:opacity-50 dark:text-violet-300 dark:hover:bg-violet-950"
        >
          ⚔️ Modo Batalha
        </button>
        {battleMode && (
          <button
            onClick={() => {
              setBattleMode(false);
              setBattleSlots([]);
            }}
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm dark:border-zinc-700"
          >
            ✕ Sair da batalha
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {notice}
        </p>
      )}

      {/* Resultado único */}
      {!battleMode && (
        <section className="mt-6">
          {loading && <Skeleton />}
          {!loading && result?.imageDataUrl && (
            <figure className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.imageDataUrl}
                alt={prompt}
                className="w-full rounded-2xl border border-zinc-200 shadow-lg dark:border-zinc-800"
              />
              <figcaption className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span>
                  {result.provider} · {result.model}
                  {result.latencyMs ? ` · ${(result.latencyMs / 1000).toFixed(1)}s` : ""}
                </span>
                <button
                  onClick={() => downloadDataUrl(result.imageDataUrl!, `${slugify(prompt)}-orbit.png`)}
                  className="rounded-lg border border-zinc-300 px-3 py-1 font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  ⬇️ Baixar
                </button>
                {providers
                  .filter((p) => p.configured && p.id !== result.provider)
                  .slice(0, 4)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => regenerateWith(p.id)}
                      className="rounded-lg border border-zinc-300 px-3 py-1 font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      🔄 {p.id}
                    </button>
                  ))}
              </figcaption>
            </figure>
          )}
        </section>
      )}

      {/* Modo Batalha */}
      {battleMode && (
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {battleSlots.map((slot) => {
            const providerLabel = providers.find((p) => p.id === slot.providerId)?.label ?? slot.providerId;
            return (
              <div key={slot.providerId} className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <span>{providerLabel}</span>
                  {slot.latencyMs && <span>{(slot.latencyMs / 1000).toFixed(1)}s</span>}
                </div>
                {slot.loading && <Skeleton compact />}
                {!slot.loading && slot.imageDataUrl && (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slot.imageDataUrl} alt={prompt} className="w-full rounded-xl" />
                    <button
                      onClick={() => downloadDataUrl(slot.imageDataUrl!, `${slugify(prompt)}-${slot.providerId}.png`)}
                      className="w-full rounded-lg border border-zinc-300 py-1.5 text-xs font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      ⬇️ Baixar
                    </button>
                  </div>
                )}
                {!slot.loading && slot.error && (
                  <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950 dark:text-red-300">
                    ❌ {slot.error}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Galeria */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            🖼️ Galeria ({gallery.length}/30)
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowGallery((value) => !value)}
              className="text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              {showGallery ? "ocultar" : "mostrar"}
            </button>
            {gallery.length > 0 && (
              <button
                onClick={() => {
                  clearGallery();
                  setGallery([]);
                }}
                className="text-xs text-red-500 underline-offset-2 hover:underline"
              >
                limpar
              </button>
            )}
          </div>
        </div>
        {showGallery && gallery.length === 0 && (
          <p className="text-xs text-zinc-400">Nenhuma imagem ainda — gere a primeira acima ✨</p>
        )}
        {showGallery && gallery.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {gallery.map((item) => (
              <figure key={item.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageDataUrl}
                  alt={item.prompt}
                  className="aspect-square w-full cursor-pointer rounded-lg border border-zinc-200 object-cover transition group-hover:opacity-80 dark:border-zinc-800"
                  onClick={() => downloadDataUrl(item.imageDataUrl, `${slugify(item.prompt)}-${item.provider}.png`)}
                  title={`${item.prompt}\n${item.provider} · ${new Date(item.createdAt).toLocaleString("pt-BR")}`}
                />
                <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-black/60 px-1 py-0.5 text-[9px] text-white opacity-0 transition group-hover:opacity-100">
                  {item.provider}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Skeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800 ${
        compact ? "aspect-square w-full rounded-xl" : "aspect-square w-full"
      }`}
    />
  );
}

