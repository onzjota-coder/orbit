"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "./logo";
import { ThemeToggle } from "./theme-toggle";
import OrbitChat from "./orbit-chat";

type TabType = "home" | "iframe" | "orbit-chat" | "youtube";

type Tab = {
  id: string;
  title: string;
  type: TabType;
  url?: string;
  ghost?: boolean; // MODO FANTASMA: nunca persistida
};

type Favorite = { title: string; url: string };

const ORBIT_TAB_ID = "orbit";
const HOME_TAB_ID = "home";

// Playlist embed do YouTube permitida fora do iframe (youtube-nocookie)
const YOUTUBE_PLAYLIST_EMBED =
  "https://www.youtube-nocookie.com/embed/videoseries?list=PLFgquLnL59amXB0-e43CUn39fhv7U3CGv";

// Favoritos pré-instalados (persistidos em orbit_favorites; removíveis)
const DEFAULT_FAVORITES: Favorite[] = [
  { title: "YouTube", url: "https://www.youtube.com" },
  { title: "Google", url: "https://www.google.com" },
  { title: "Mercado Livre", url: "https://www.mercadolivre.com.br" },
  { title: "Shopee", url: "https://shopee.com.br" },
  { title: "Instagram", url: "https://www.instagram.com" },
  { title: "WhatsApp Web", url: "https://web.whatsapp.com" },
];

// Atalhos grandes da aba home (inclui Amazon, que não é favorito)
const HOME_SHORTCUTS: Favorite[] = [
  { title: "YouTube", url: "https://www.youtube.com" },
  { title: "Google", url: "https://www.google.com" },
  { title: "Mercado Livre", url: "https://www.mercadolivre.com.br" },
  { title: "Shopee", url: "https://shopee.com.br" },
  { title: "Amazon", url: "https://www.amazon.com.br" },
  { title: "Instagram", url: "https://www.instagram.com" },
  { title: "WhatsApp Web", url: "https://web.whatsapp.com" },
];

// Sites conhecidos que bloqueiam exibição em iframe → mensagem "abrir fora"
const BLOCKED_FRAMES = ["netflix.com", "amazon.com", "google.com/search"];

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isBlockedFrame(url: string): boolean {
  const lower = url.toLowerCase();
  return BLOCKED_FRAMES.some((b) => lower.includes(b));
}

function faviconFor(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainOf(url))}&sz=32`;
}

// Home do YouTube (sem vídeo específico) → página especial com buscador interno
function isYouTubeHome(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/?(\?.*)?|youtu\.be\/?)$/i.test(url.trim());
}

// YouTube: converte URLs comuns em embeds que funcionam dentro do shell
function toEmbeddableUrl(url: string): string {
  const watch = url.match(/youtube\.com\/watch\?v=([\w-]+)/i);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`;
  const short = url.match(/youtu\.be\/([\w-]+)/i);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  return url;
}

function resolveUrlInput(raw: string): { url: string; title: string } | null {
  const input = raw.trim();
  if (!input) return null;

  // "yt: termo" → busca oficial do YouTube em embed (funciona 100% no shell)
  if (input.toLowerCase().startsWith("yt:")) {
    const term = input.slice(3).trim();
    if (!term) return null;
    return {
      url: `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(term)}`,
      title: `YouTube: ${term}`,
    };
  }

  // URL completa ou domínio solto
  const looksLikeUrl = /^https?:\/\//i.test(input) || (input.includes(".") && !/\s/.test(input));
  if (looksLikeUrl) {
    const url = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    return { url, title: domainOf(url) };
  }

  // Texto livre → busca no Google (se bloquear, o shell mostra o fallback "abrir fora")
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(input)}`,
    title: `Busca: ${input}`,
  };
}

// ─────────────────────────────────────────────────────────────
// MELHORIA 2 — Fundo dinâmico estilo Brave (crossfade a cada 30s)
// ─────────────────────────────────────────────────────────────
function picsumUrl(n: number): string {
  return `https://picsum.photos/1920/1080?random=${n}`;
}

function DynamicBackground() {
  const [urls, setUrls] = useState<[string, string | null]>([picsumUrl(1), null]);
  const [visible, setVisible] = useState<0 | 1>(0);
  const visibleRef = useRef<0 | 1>(0);
  const counter = useRef(1);

  useEffect(() => {
    // prefers-reduced-motion → fundo estático (sem carrossel)
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      const nextUrl = picsumUrl(++counter.current);
      // Pré-carrega a próxima imagem antes de trocar (evita flash)
      const img = new Image();
      img.onload = () => {
        const hidden: 0 | 1 = visibleRef.current === 0 ? 1 : 0;
        setUrls((prev) => {
          const copy: [string, string | null] = [prev[0], prev[1]];
          copy[hidden] = nextUrl;
          return copy;
        });
        requestAnimationFrame(() => {
          visibleRef.current = hidden;
          setVisible(hidden);
        });
      };
      img.src = nextUrl;
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0">
      {urls.map((u, i) =>
        u ? (
          <div
            key={i}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-[2000ms] ease-in-out"
            style={{ backgroundImage: `url(${u})`, opacity: visible === i ? 1 : 0 }}
          />
        ) : null
      )}
      {/* Overlay escuro (estilo Brave: permanece escuro também no tema claro) */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 to-black/75" />
    </div>
  );
}

function HomeGrid({ onOpen }: { onOpen: (url: string, title: string) => void }) {
  return (
    <div className="relative h-full overflow-hidden">
      <DynamicBackground />
      <div className="scroll-slim relative z-10 flex h-full items-center justify-center overflow-y-auto p-8">
        <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {HOME_SHORTCUTS.map((s) => (
            <button
              key={s.url}
              type="button"
              onClick={() => onOpen(s.url, s.title)}
              className="group flex flex-col items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={faviconFor(s.url)} alt="" className="h-10 w-10 rounded" />
              <span className="text-sm font-medium text-white">{s.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockedNotice({ url }: { url: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
        <p className="text-4xl">🔒</p>
        <p className="mt-4 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-200">
          Este site bloqueia exibição interna.
        </p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-4 transition hover:decoration-zinc-900 dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
          >
            Abrir em nova aba →
          </a>
        ) : null}
      </div>
    </div>
  );
}

function FrameSpinner() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-[#0E0E11]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-white/20 dark:border-t-white" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MELHORIA 3 — iframe com spinner + timeout de 4s → fallback
// ─────────────────────────────────────────────────────────────
function GuardedFrame({
  url,
  title,
  reloadKey,
  ghost,
}: {
  url: string;
  title: string;
  reloadKey: number;
  ghost?: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "ok" | "blocked">("loading");

  useEffect(() => {
    setStatus("loading");
    const timer = window.setTimeout(() => {
      setStatus((s) => (s === "loading" ? "blocked" : s));
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [url, reloadKey]);

  if (status === "blocked") return <BlockedNotice url={url} />;

  return (
    <div className="relative h-full w-full bg-white">
      {status === "loading" && <FrameSpinner />}
      <iframe
        key={`${url}-${reloadKey}`}
        src={url}
        title={title}
        onLoad={() => setStatus("ok")}
        className="h-full w-full border-0"
        sandbox={ghost ? "allow-scripts" : "allow-scripts allow-same-origin allow-forms allow-popups"}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MELHORIA 3 — Página especial do YouTube (buscador interno)
// ─────────────────────────────────────────────────────────────
function YouTubeHome({ onNavigate }: { onNavigate: (url: string, title: string) => void }) {
  const [term, setTerm] = useState("");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-[#0F0F0F] p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-14 items-center justify-center rounded-lg bg-red-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="text-2xl font-semibold text-white">YouTube</span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = term.trim();
          if (!t) return;
          onNavigate(
            `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(t)}`,
            `YouTube: ${t}`
          );
        }}
        className="flex w-full max-w-xl gap-2"
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar vídeos no YouTube…"
          className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/40"
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-500"
        >
          Buscar
        </button>
      </form>

      <button
        type="button"
        onClick={() => onNavigate(YOUTUBE_PLAYLIST_EMBED, "YouTube: Playlist em destaque")}
        className="text-sm text-zinc-400 underline decoration-zinc-600 underline-offset-4 transition hover:text-white"
      >
        Ou assista à playlist em destaque →
      </button>
    </div>
  );
}

export default function BrowserShell() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: ORBIT_TAB_ID, title: "Orbit", type: "orbit-chat" },
    { id: HOME_TAB_ID, title: "Início", type: "home" },
  ]);
  const [activeId, setActiveId] = useState<string>(ORBIT_TAB_ID);
  const [favorites, setFavorites] = useState<Favorite[]>(DEFAULT_FAVORITES);
  const [urlInput, setUrlInput] = useState("");
  const [histories, setHistories] = useState<Record<string, { stack: string[]; index: number }>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [ghostMode, setGhostMode] = useState(false); // MODO FANTASMA: apenas state, NUNCA persistir
  const hydrated = useRef(false);

  // MELHORIA 1 — formulário inline de novo favorito
  const [showFavForm, setShowFavForm] = useState(false);
  const [favName, setFavName] = useState("");
  const [favUrl, setFavUrl] = useState("");

  // Carrega abas e favoritos salvos no localStorage
  useEffect(() => {
    try {
      const rawTabs = localStorage.getItem("orbit_tabs");
      if (rawTabs) {
        const parsed = JSON.parse(rawTabs) as Tab[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // A aba Orbit é fixa: reinsere se ausente
          const withOrbit = parsed.some((t) => t.id === ORBIT_TAB_ID)
            ? parsed
            : [{ id: ORBIT_TAB_ID, title: "Orbit", type: "orbit-chat" as TabType }, ...parsed];
          setTabs(withOrbit);
        }
      }
      const rawFavs = localStorage.getItem("orbit_favorites");
      if (rawFavs) {
        const parsedFavs = JSON.parse(rawFavs) as Favorite[];
        if (Array.isArray(parsedFavs) && parsedFavs.length > 0) setFavorites(parsedFavs);
      }
    } catch {
      // storage corrompido → segue com os padrões
    }
    hydrated.current = true;
  }, []);

  // Persiste as abas
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      // Abas fantasma jamais são persistidas
      localStorage.setItem("orbit_tabs", JSON.stringify(tabs.filter((t) => !t.ghost)));
    } catch {}
  }, [tabs]);

  // Persiste os favoritos
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem("orbit_favorites", JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const activeHistory = activeTab ? histories[activeTab.id] : undefined;
  const canBack =
    !!activeTab && activeTab.type === "iframe" && !activeTab.ghost && !!activeHistory && activeHistory.index > 0;
  const canForward =
    !!activeTab &&
    activeTab.type === "iframe" &&
    !activeTab.ghost &&
    !!activeHistory &&
    activeHistory.index < activeHistory.stack.length - 1;

  function updateTab(id: string, patch: Partial<Tab>) {
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function openYouTubeTab() {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setTabs((ts) => [...ts, { id, title: "YouTube", type: "youtube", ...(ghostMode ? { ghost: true } : {}) }]);
    setActiveId(id);
  }

  // Aba nova abre IMEDIATAMENTE com o título do site (spinner cobre o carregamento)
  function openIframeTab(url: string, title: string) {
    if (isYouTubeHome(url)) {
      openYouTubeTab();
      return;
    }
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const embedUrl = toEmbeddableUrl(url);
    // MODO FANTASMA: aba marcada como fantasma e histórico NÃO gravado
    setTabs((ts) => [...ts, { id, title, type: "iframe", url: embedUrl, ...(ghostMode ? { ghost: true } : {}) }]);
    if (!ghostMode) setHistories((h) => ({ ...h, [id]: { stack: [embedUrl], index: 0 } }));
    setActiveId(id);
  }

  function newTab() {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setTabs((ts) => [...ts, { id, title: "Nova aba", type: "home", ...(ghostMode ? { ghost: true } : {}) }]);
    setActiveId(id);
  }

  // MODO FANTASMA — liga/desliga. Ao desligar, TODAS as abas fantasma fecham automaticamente.
  function toggleGhost() {
    if (ghostMode) {
      const activeIsGhost = tabs.find((t) => t.id === activeId)?.ghost ?? false;
      setTabs((ts) => ts.filter((t) => !t.ghost));
      if (activeIsGhost) setActiveId(ORBIT_TAB_ID);
    }
    setGhostMode((g) => !g);
  }

  function closeTab(id: string) {
    if (id === ORBIT_TAB_ID) return; // a aba Orbit é fixa
    setTabs((ts) => ts.filter((t) => t.id !== id));
    setActiveId((cur) => (cur === id ? ORBIT_TAB_ID : cur));
  }

  // Logo → volta para a aba home (recria se foi fechada)
  function goHome() {
    setTabs((ts) => {
      if (ts.some((t) => t.id === HOME_TAB_ID)) return ts;
      const orbitIdx = ts.findIndex((t) => t.id === ORBIT_TAB_ID);
      const next = [...ts];
      next.splice(orbitIdx + 1, 0, { id: HOME_TAB_ID, title: "Início", type: "home" });
      return next;
    });
    setActiveId(HOME_TAB_ID);
  }

  // Navegação dentro da própria aba (empilha no histórico interno)
  function navigateInTab(tabId: string, url: string, title: string) {
    const embedUrl = toEmbeddableUrl(url);
    // MODO FANTASMA: navega SEM gravar histórico (voltar/avançar ficam desabilitados)
    if (tabs.find((t) => t.id === tabId)?.ghost) {
      updateTab(tabId, { type: "iframe", url: embedUrl, title });
      return;
    }
    updateTab(tabId, { type: "iframe", url: embedUrl, title });
    setHistories((h) => {
      const cur = h[tabId] ?? { stack: [], index: -1 };
      const stack = [...cur.stack.slice(0, cur.index + 1), embedUrl];
      return { ...h, [tabId]: { stack, index: stack.length - 1 } };
    });
  }

  // Navegação pelo campo de URL
  function navigate(url: string, title: string) {
    if (!activeTab) return;
    if (isYouTubeHome(url)) {
      if (activeTab.type === "iframe" || activeTab.type === "youtube") {
        updateTab(activeTab.id, { type: "youtube", url: undefined, title: "YouTube" });
      } else {
        openYouTubeTab();
      }
      return;
    }
    if (activeTab.type === "iframe") {
      navigateInTab(activeTab.id, url, title);
      return;
    }
    openIframeTab(url, title);
  }

  function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    const resolved = resolveUrlInput(urlInput);
    if (!resolved) return;
    navigate(resolved.url, resolved.title);
    setUrlInput("");
  }

  // MELHORIA 1 — adiciona favorito pelo formulário inline
  function addFavorite(e: React.FormEvent) {
    e.preventDefault();
    const rawUrl = favUrl.trim();
    if (!rawUrl) return;
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const title = favName.trim() || domainOf(url);
    setFavorites((fs) => (fs.some((f) => f.url === url) ? fs : [...fs, { title, url }]));
    setFavName("");
    setFavUrl("");
    setShowFavForm(false);
  }

  // MELHORIA 1 — remove favorito com confirmação
  function removeFavorite(fav: Favorite) {
    if (window.confirm(`Remover o favorito "${fav.title}"?`)) {
      setFavorites((fs) => fs.filter((f) => f.url !== fav.url));
    }
  }

  function goBack() {
    if (!activeTab || !activeHistory || activeHistory.index <= 0) return;
    const index = activeHistory.index - 1;
    const url = activeHistory.stack[index];
    setHistories((h) => ({ ...h, [activeTab.id]: { ...activeHistory, index } }));
    updateTab(activeTab.id, { url });
  }

  function goForward() {
    if (!activeTab || !activeHistory || activeHistory.index >= activeHistory.stack.length - 1) return;
    const index = activeHistory.index + 1;
    const url = activeHistory.stack[index];
    setHistories((h) => ({ ...h, [activeTab.id]: { ...activeHistory, index } }));
    updateTab(activeTab.id, { url });
  }

  function reload() {
    setReloadKey((k) => k + 1);
  }

  function renderContent() {
    if (!activeTab) return null;
    if (activeTab.type === "orbit-chat") {
      return (
        <div className="scroll-slim h-full overflow-y-auto px-4 py-6">
          <OrbitChat />
        </div>
      );
    }
    if (activeTab.type === "home") {
      return <HomeGrid onOpen={openIframeTab} />;
    }
    if (activeTab.type === "youtube") {
      return <YouTubeHome onNavigate={(url, title) => navigateInTab(activeTab.id, url, title)} />;
    }
    const url = activeTab.url ?? "";
    if (!url || isBlockedFrame(url)) {
      return <BlockedNotice url={url} />;
    }
    return <GuardedFrame url={url} title={activeTab.title} reloadKey={reloadKey} ghost={activeTab.ghost} />;
  }

  const iconBtn =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white";

  return (
    <section className="flex h-screen w-full flex-col overflow-hidden border-y border-zinc-200 bg-white dark:border-white/10 dark:bg-[#0E0E11]">
      {/* Barra superior estilo navegador */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 px-3 py-2 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={goHome}
          title="Voltar ao início do Orbit"
          className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-900 transition hover:bg-zinc-100 dark:text-white dark:hover:bg-white/[0.06]"
        >
          <Logo size={18} />
          <span className="font-display text-[15px] font-semibold tracking-tight">Orbit</span>
        </button>

        <button type="button" onClick={goBack} disabled={!canBack} aria-label="Voltar" title="Voltar" className={iconBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5m0 0l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button type="button" onClick={goForward} disabled={!canForward} aria-label="Avançar" title="Avançar" className={iconBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
          </svg>
        </button>
        <button type="button" onClick={reload} aria-label="Recarregar" title="Recarregar" className={iconBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
          </svg>
        </button>

        <form onSubmit={submitUrl} className="flex min-w-0 flex-1 items-center">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Busque ou digite um URL — ex.: yt: lofi hip hop"
            className="h-9 w-full rounded-full border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-white/30"
          />
        </form>

        <a
          href="#acesso"
          className="hidden shrink-0 items-center gap-1.5 px-2 text-[13px] tracking-wide text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white sm:flex"
        >
          Acesso antecipado <span>→</span>
        </a>
        {ghostMode && (
          <span className="hidden shrink-0 items-center gap-1 rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-2.5 py-1 text-[11px] font-semibold text-[#a78bfa] sm:flex">
            👻 Fantasma
          </span>
        )}
        <button
          type="button"
          onClick={toggleGhost}
          aria-pressed={ghostMode}
          aria-label="Modo Fantasma"
          title="Modo Fantasma — nada fica salvo"
          className={`${iconBtn} ${
            ghostMode
              ? "bg-[#7c3aed]/20 text-[#a78bfa] hover:bg-[#7c3aed]/30 hover:text-[#c4b5fd] dark:text-[#a78bfa]"
              : ""
          }`}
        >
          👻
        </button>
        <ThemeToggle />
      </div>

      {/* Barra de favoritos (MELHORIA 1: gerenciáveis) */}
      <div className="scroll-slim flex items-center gap-1 overflow-x-auto border-b border-zinc-200 px-3 py-1.5 dark:border-white/[0.06]">
        {favorites.map((f) => (
          <div key={f.url} className="group relative flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => openIframeTab(f.url, f.title)}
              title={f.url}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={faviconFor(f.url)} alt="" className="h-4 w-4 rounded-sm" />
              <span>{f.title}</span>
            </button>
            <button
              type="button"
              onClick={() => removeFavorite(f)}
              aria-label={`Remover ${f.title}`}
              title={`Remover ${f.title}`}
              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-zinc-400 text-[9px] leading-none text-white transition hover:bg-red-500 group-hover:flex dark:bg-zinc-600 dark:hover:bg-red-500"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setShowFavForm((s) => !s)}
          aria-label="Adicionar favorito"
          title="Adicionar favorito"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          +
        </button>
      </div>

      {/* MELHORIA 1 — formulário inline de novo favorito */}
      {showFavForm && (
        <form
          onSubmit={addFavorite}
          className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]"
        >
          <input
            value={favName}
            onChange={(e) => setFavName(e.target.value)}
            placeholder="Nome (ex.: GitHub)"
            className="h-8 w-40 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <input
            value={favUrl}
            onChange={(e) => setFavUrl(e.target.value)}
            required
            placeholder="URL (ex.: github.com)"
            className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-100 dark:placeholder:text-zinc-500 sm:min-w-[220px]"
          />
          <button
            type="submit"
            className="h-8 rounded-lg bg-zinc-900 px-4 text-[13px] font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Adicionar
          </button>
          <button
            type="button"
            onClick={() => setShowFavForm(false)}
            className="h-8 rounded-lg px-3 text-[13px] text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Abas */}
      <div className="flex items-end gap-1 overflow-x-auto border-b border-zinc-200 px-2 pt-1.5 dark:border-white/[0.06]">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              className={`group flex shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 text-[12.5px] transition ${
                active
                  ? "border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
                  : "border-transparent text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/[0.04]"
              }`}
            >
              <button type="button" onClick={() => setActiveId(t.id)} className="max-w-[160px] truncate">
                {t.title}
              </button>
              {t.id !== ORBIT_TAB_ID && (
                <button
                  type="button"
                  onClick={() => closeTab(t.id)}
                  aria-label={`Fechar ${t.title}`}
                  className="flex h-4 w-4 items-center justify-center rounded text-[10px] text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={newTab}
          aria-label="Nova aba"
          title="Nova aba"
          className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          +
        </button>
      </div>

      {/* MODO FANTASMA — banner no topo */}
      {ghostMode && (
        <div className="border-b border-[#7c3aed]/30 bg-[#7c3aed]/10 px-4 py-1.5 text-center text-[12.5px] font-medium text-[#a78bfa]">
          👻 Modo Fantasma — nada fica salvo.
        </div>
      )}

      {/* Conteúdo da aba ativa */}
      <div className="min-h-0 flex-1 overflow-hidden">{renderContent()}</div>
    </section>
  );
}