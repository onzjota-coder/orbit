"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import Logo from "./logo";
import { ThemeToggle } from "./theme-toggle";
import OrbitChat from "./orbit-chat";
import IntelligenceHub from "./intelligence-hub";
import OrbitExternal from "./orbit-external";
import StarfieldBackground from "./starfield-background";
import { BLOCKED_TRACKERS } from "@/lib/blocklist";
import { resolveFavicon } from "@/lib/favicon";
import { type Tab, type TabType, normalizeTabs } from "@/lib/browser-tabs";
import { domainOf, normalizeFavoriteUrl } from "@/lib/browser-url";
import {
  type Favorite,
  type UrlHistoryItem,
  readFavorites,
  readUrlHistory,
  writeFavorites,
  writeUrlHistory,
  URL_HISTORY_MAX,
} from "@/lib/browser-storage";

// TAREFA 20 — atalhos da home com anel (ring) da cor da marca
type HomeShortcut = Favorite & { ring: string; shadow: string };
type HomeApp = { category: string; icon: string; title: string; url: string };

// TAREFA 18 — item do histórico de navegação local
const ORBIT_TAB_ID = "orbit";
const HOME_TAB_ID = "home";
const ARENA_TAB_ID = "arena";
const PRIVACY_TAB_ID = "privacidade";

const SIDEBAR_KEY = "orbit_sidebar"; // TAREFA 12 — sidebar persistente
const TRUSTED_KEY = "orbit_trusted"; // TAREFA 25 — zona de confiança
const ACTIVE_TAB_KEY = "orbit_active_tab";

// TAREFA 2 — YouTube: domínio normal (youtube-nocookie causava Erro 153) + origin
// TAREFA 2 — origin da app + playsinline (sem origin o YouTube devolve Erro 153)
function ytOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

function ytParams(base: string): string {
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}origin=${encodeURIComponent(ytOrigin())}&playsinline=1`;
}

// TAREFA 16 — é um vídeo do YouTube (para o resumo via oEmbed)?
function isYouTubeVideoUrl(url: string): boolean {
  return /youtube\.com\/embed\/[\w-]{6,}/i.test(url);
}

// Vídeo fixo de destaque — fallback quando a busca completa do YouTube
// (embed listType=search, descontinuada pelo Google) não está disponível
const YOUTUBE_FALLBACK_VIDEO =
  "https://www.youtube.com/embed/jfKfPfyJRdk?playsinline=1&rel=0";

function youtubeEmbedUrl(id: string, mode: "normal" | "nolads") {
  return mode === "nolads"
    ? `https://${Number.parseInt(id.slice(-1), 36) % 2 === 0 ? "pipe.yt" : "inv.nadeko.net"}/watch/${id}`
    : `https://www.youtube.com/embed/${id}?playsinline=1&rel=0`;
}

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
// TAREFA 20 — cada um traz o anel (ring) e a sombra da cor da marca
const HOME_SHORTCUTS: HomeShortcut[] = [
  {
    title: "YouTube",
    url: "https://www.youtube.com",
    ring: "ring-red-500",
    shadow: "hover:shadow-red-500/40",
  },
  {
    title: "Google",
    url: "https://www.google.com",
    ring: "ring-blue-500",
    shadow: "hover:shadow-blue-500/40",
  },
  {
    title: "Mercado Livre",
    url: "https://www.mercadolivre.com.br",
    ring: "ring-yellow-400",
    shadow: "hover:shadow-yellow-400/40",
  },
  {
    title: "Shopee",
    url: "https://shopee.com.br",
    ring: "ring-orange-500",
    shadow: "hover:shadow-orange-500/40",
  },
  {
    title: "Amazon",
    url: "https://www.amazon.com.br",
    ring: "ring-amber-500",
    shadow: "hover:shadow-amber-500/40",
  },
  {
    title: "Instagram",
    url: "https://www.instagram.com",
    ring: "ring-pink-500",
    shadow: "hover:shadow-pink-500/40",
  },
  {
    title: "WhatsApp Web",
    url: "https://web.whatsapp.com",
    ring: "ring-green-500",
    shadow: "hover:shadow-green-500/40",
  },
];

const HOME_APPS: HomeApp[] = [
  {
    category: "Vendas",
    icon: "🛒",
    title: "OLX",
    url: "https://www.olx.com.br",
  },
  {
    category: "Vendas",
    icon: "🌐",
    title: "AliExpress",
    url: "https://www.aliexpress.com",
  },
  {
    category: "Vendas",
    icon: "🛍️",
    title: "Magazine Luiza",
    url: "https://www.magazineluiza.com.br",
  },
  {
    category: "Vendas",
    icon: "🎓",
    title: "Hotmart",
    url: "https://www.hotmart.com",
  },
  {
    category: "Vendas",
    icon: "⚡",
    title: "Kiwify",
    url: "https://kiwify.com.br",
  },
  {
    category: "Vendas",
    icon: "📚",
    title: "Eduzz",
    url: "https://www.eduzz.com",
  },
  {
    category: "Criativo",
    icon: "🖌️",
    title: "Canva",
    url: "https://www.canva.com",
  },
  {
    category: "Criativo",
    icon: "📸",
    title: "PhotoRoom",
    url: "https://www.photoroom.com",
  },
  {
    category: "Criativo",
    icon: "✂️",
    title: "CapCut",
    url: "https://www.capcut.com",
  },
  {
    category: "Criativo",
    icon: "◈",
    title: "Figma",
    url: "https://www.figma.com",
  },
  {
    category: "Criativo",
    icon: "🪄",
    title: "Remove.bg",
    url: "https://www.remove.bg",
  },
  {
    category: "Criativo",
    icon: "🖼️",
    title: "Pixlr",
    url: "https://pixlr.com",
  },
  {
    category: "Criativo",
    icon: "🧩",
    title: "Freepik",
    url: "https://www.freepik.com",
  },
  { category: "IA", icon: "🤖", title: "ChatGPT", url: "https://chatgpt.com" },
  { category: "IA", icon: "🧠", title: "Claude", url: "https://claude.ai" },
  {
    category: "IA",
    icon: "✨",
    title: "Gemini",
    url: "https://gemini.google.com",
  },
  {
    category: "IA",
    icon: "💠",
    title: "Copilot",
    url: "https://copilot.microsoft.com",
  },
  {
    category: "IA",
    icon: "🔎",
    title: "Perplexity",
    url: "https://www.perplexity.ai",
  },
  { category: "IA", icon: "⚡", title: "Grok", url: "https://grok.com" },
  { category: "IA", icon: "🌐", title: "Meta AI", url: "https://www.meta.ai" },
  {
    category: "IA",
    icon: "🐋",
    title: "DeepSeek",
    url: "https://chat.deepseek.com",
  },
  { category: "IA", icon: "🦁", title: "Leonardo", url: "https://leonardo.ai" },
  { category: "IA", icon: "📝", title: "Ideogram", url: "https://ideogram.ai" },
  {
    category: "IA",
    icon: "🤗",
    title: "HuggingFace",
    url: "https://huggingface.co",
  },
  {
    category: "Social",
    icon: "🎵",
    title: "TikTok",
    url: "https://www.tiktok.com",
  },
  {
    category: "Social",
    icon: "👥",
    title: "Facebook",
    url: "https://www.facebook.com",
  },
  {
    category: "Social",
    icon: "📌",
    title: "Pinterest",
    url: "https://br.pinterest.com",
  },
  { category: "Social", icon: "𝕏", title: "X", url: "https://x.com" },
  {
    category: "Social",
    icon: "💼",
    title: "LinkedIn",
    url: "https://www.linkedin.com",
  },
  {
    category: "Social",
    icon: "✈️",
    title: "Telegram",
    url: "https://web.telegram.org",
  },
  {
    category: "Social",
    icon: "🎬",
    title: "Kwai",
    url: "https://www.kwai.com",
  },
  {
    category: "Produtividade",
    icon: "📓",
    title: "Notion",
    url: "https://www.notion.so",
  },
  {
    category: "Produtividade",
    icon: "📄",
    title: "Google Docs",
    url: "https://docs.google.com",
  },
  {
    category: "Produtividade",
    icon: "✉️",
    title: "Gmail",
    url: "https://mail.google.com",
  },
  {
    category: "Produtividade",
    icon: "🗂️",
    title: "Google Drive",
    url: "https://drive.google.com",
  },
  {
    category: "Produtividade",
    icon: "📋",
    title: "Trello",
    url: "https://trello.com",
  },
  {
    category: "Produtividade",
    icon: "📑",
    title: "iLovePDF",
    url: "https://www.ilovepdf.com",
  },
  {
    category: "Produtividade",
    icon: "🗜️",
    title: "TinyPNG",
    url: "https://tinypng.com",
  },
];

// Sites conhecidos que bloqueiam exibição em iframe (X-Frame-Options/CSP) →
// mostramos a mensagem elegante "abrir fora" IMEDIATAMENTE (sem tela branca).
// Correspondência por DOMÍNIO (host + caminho opcional) — nunca substring da URL.
const FRAME_BLOCKERS: { host: string; path?: string }[] = [
  { host: "netflix.com" },
  { host: "amazon.com" },
  { host: "amazon.com.br" },
  { host: "google.com" },
  { host: "mercadolivre.com.br" },
  { host: "mercadolibre.com" },
  { host: "shopee.com.br" },
  { host: "instagram.com" },
  { host: "whatsapp.com" },
  { host: "facebook.com" },
  { host: "x.com" },
  { host: "twitter.com" },
  { host: "chatgpt.com" },
  { host: "chat.z.ai" },
  { host: "z.ai" },
  { host: "gemini.google.com" },
  { host: "claude.ai" },
  { host: "chat.deepseek.com" },
  { host: "openai.com" },
  { host: "linkedin.com" },
  { host: "discord.com" },
  { host: "tiktok.com" },
];

const CURATED_IFRAME_HOSTS = [
  "web.whatsapp.com",
  "telegram.org",
  "web.telegram.org",
  "canva.com",
  "notion.so",
  "trello.com",
  "ilovepdf.com",
  "tinypng.com",
  "remove.bg",
  "pixlr.com",
  "docs.google.com",
  "mail.google.com",
  "drive.google.com",
];

function isCuratedIframeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return CURATED_IFRAME_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}

function isBlockedFrame(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return FRAME_BLOCKERS.some((b) => {
      const hostMatch = host === b.host || host.endsWith(`.${b.host}`);
      if (!hostMatch) return false;
      if (b.path && !u.pathname.startsWith(b.path)) return false;
      return true;
    });
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// TAREFA 6 — Detector de golpes por DOMÍNIO (não por conhecimento de
// produtos): o domínio usa o nome de uma marca oficial mas NÃO É o domínio
// oficial → provável falsificação (caso real: página imitando a OpenAI
// anunciou "GPT-6 Astra" com preço).
// ─────────────────────────────────────────────────────────────
const OFFICIAL_SITES: { domain: string; brand: string }[] = [
  { domain: "openai.com", brand: "openai" },
  { domain: "chatgpt.com", brand: "chatgpt" },
  { domain: "google.com", brand: "google" },
  { domain: "youtube.com", brand: "youtube" },
  { domain: "mercadolivre.com.br", brand: "mercadolivre" },
  { domain: "shopee.com.br", brand: "shopee" },
  { domain: "amazon.com.br", brand: "amazon" },
  { domain: "instagram.com", brand: "instagram" },
  { domain: "whatsapp.com", brand: "whatsapp" },
  { domain: "notion.so", brand: "notion" },
  { domain: "z.ai", brand: "z.ai" },
];

// Domínios que CONTÊM nomes de marca mas são infraestrutura legítima
const BRAND_EXEMPTS = [
  "youtube-nocookie.com",
  "ytimg.com",
  "googleapis.com",
  "googleusercontent.com",
  "gstatic.com",
];

// ─────────────────────────────────────────────────────────────
// MÓDULO ORBIT UX PRO — TAREFA 1: WHITELIST de sites oficiais.
// Se o domínio da URL é (ou termina com) um item da whitelist, o check de
// golpe é PULADO COMPLETAMENTE: abre direto, sem modal, sem cadeado.
// O alerta de golpe SÓ existe para domínios que imitam marcas e NÃO estão
// na whitelist (ex.: "youtube.com" abre direto; "openai-promo.xyz" alerta).
// A correspondência é por HOST (igual ou subdomínio) + caminho quando o
// item o define — substring solta ficaria vulnerável a bypass
// (ex.: "youtube.com.evil.xyz" NÃO é whitelisted).
// ─────────────────────────────────────────────────────────────
const WHITELIST = [
  "youtube.com",
  "youtube.com/embed",
  "google.com",
  "mercadolivre.com.br",
  "shopee.com.br",
  "amazon.com.br",
  "instagram.com",
  "whatsapp.com",
  "web.whatsapp.com",
  "notion.so",
  "z.ai",
  "chat.deepseek.com",
  "capcut.com",
  "tiktok.com",
  "notion.site",
  "github.com",
];

function getTrustedHosts(): string[] {
  try {
    const raw = localStorage.getItem("orbit_trusted");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isTrustedHost(url: string): boolean {
  const host = domainOf(url);
  if (!host) return false;
  return getTrustedHosts().some((t) => host === t || host.endsWith(`.${t}`));
}

function trustHost(url: string): void {
  const host = domainOf(url);
  if (!host) return;
  const trusted = getTrustedHosts();
  if (!trusted.includes(host)) {
    try {
      localStorage.setItem("orbit_trusted", JSON.stringify([...trusted, host]));
    } catch {}
  }
}

function isWhitelisted(url: string): boolean {
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase().replace(/^www\./, "");
    path = (u.pathname + u.search).toLowerCase();
  } catch {
    // Sem URL válida (ex.: "orbit-yt-search:") → sem check de golpe a pular
    return false;
  }
  return WHITELIST.some((w) => {
    const [wHost, ...wPathParts] = w.split("/");
    const wPath = wPathParts.length > 0 ? "/" + wPathParts.join("/") : "";
    const hostOk = host === wHost || host.endsWith(`.${wHost}`);
    if (!hostOk) return false;
    if (wPath && !path.startsWith(wPath)) return false;
    return true;
  });
}

function suspiciousBrand(
  url: string,
): { brand: string; official: string } | null {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  if (BRAND_EXEMPTS.some((e) => host === e || host.endsWith(`.${e}`)))
    return null;
  for (const s of OFFICIAL_SITES) {
    const isOfficial = host === s.domain || host.endsWith(`.${s.domain}`);
    if (isOfficial) return null;
    if (host.includes(s.brand)) return { brand: s.brand, official: s.domain };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// TAREFA 7 — Blocklist de trackers: se o destino da navegação for um
// domínio rastreador, o Orbit recusa carregar (toast + contador).
// ⚠️ Bloqueio por URL; sub-recursos exigem proxy — roadmap.
// ─────────────────────────────────────────────────────────────
function matchedTracker(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return (
      BLOCKED_TRACKERS.find((b) => host === b || host.endsWith(`.${b}`)) ?? null
    );
  } catch {
    return null;
  }
}

function faviconFor(url: string): string {
  return resolveFavicon(url);
}

// Home do YouTube (sem vídeo específico) → página especial com buscador interno
function isYouTubeHome(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/?(\?.*)?|youtu\.be\/?)$/i.test(
    url.trim(),
  );
}

// URL especial orbit-yt-search:<termo> → aba de busca do YouTube dentro do shell
function ytSearchTerm(url: string): string | null {
  return url.startsWith("orbit-yt-search:")
    ? url.slice("orbit-yt-search:".length)
    : null;
}

// YouTube: converte URLs comuns em embeds que funcionam dentro do shell
// (TAREFA 2 — sempre com origin+playsinline para evitar o Erro 153)
function toEmbeddableUrl(url: string): string {
  const watch = url.match(/youtube\.com\/watch\?v=([\w-]+)/i);
  if (watch) return ytParams(`https://www.youtube.com/embed/${watch[1]}`);
  const short = url.match(/youtu\.be\/([\w-]+)/i);
  if (short) return ytParams(`https://www.youtube.com/embed/${short[1]}`);
  if (/youtube\.com\/embed\//i.test(url) && !/[?&]origin=/.test(url))
    return ytParams(url);
  return url;
}

function smartBarAnswer(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  const percent = text.match(/^(\d+(?:[.,]\d+)?)%\s+de\s+(\d+(?:[.,]\d+)?)$/);
  if (percent) {
    const result =
      (Number(percent[1].replace(",", ".")) / 100) *
      Number(percent[2].replace(",", "."));
    return `Resultado: ${result.toLocaleString("pt-BR")}`;
  }
  const currency = text.match(
    /^(\d+(?:[.,]\d+)?)\s+d[oó]lares?\s+em\s+reais?$/,
  );
  if (currency)
    return `Resultado: R$ ${(Number(currency[1].replace(",", ".")) * 5.2).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (taxa fixa R$ 5,20)`;
  if (/^[\d\s+*\-/.(),]+$/.test(text) && /[+*\-/]/.test(text)) {
    try {
      const safe = text.replace(/,/g, ".");
      if (/^[\d\s+*\-/.]+$/.test(safe))
        return `Resultado: ${Function(`"use strict"; return (${safe})`)()}`;
    } catch {}
  }
  return null;
}

// TAREFA 1 — resolução do campo de URL. Texto livre NUNCA vira iframe bloqueado:
// vai direto para o Google numa nova aba do sistema (external: true).
function resolveUrlInput(raw: string): { url: string; title: string; external?: boolean } | null {
  const input = raw.trim();
  if (!input) return null;

  const command = input.match(/^(w|m|s|g):\s*(.+)$/i);
  if (command) {
    const term = command[2].trim();
    const targets: Record<string, string> = {
      w: `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(term)}`,
      m: `https://lista.mercadolivre.com.br/${encodeURIComponent(term)}`,
      s: `https://shopee.com.br/search?keyword=${encodeURIComponent(term)}`,
      g: `https://www.google.com/search?q=${encodeURIComponent(term)}`,
    };
    return {
      url: targets[command[1].toLowerCase()],
      title: `${command[1].toUpperCase()}: ${term}`,
    };
  }

  // "yt: termo" → busca do YouTube dentro do shell (o embed listType=search do
  // Google foi descontinuado e falha → a aba mostra o fallback com vídeo fixo)
  if (input.toLowerCase().startsWith("yt:")) {
    const term = input.slice(3).trim();
    if (!term) return null;
    return {
      url: `orbit-yt-search:${term}`,
      title: `YouTube: ${term}`,
    };
  }

  // URL completa ou domínio solto
  const looksLikeUrl =
    /^https?:\/\//i.test(input) || (input.includes(".") && !/\s/.test(input));
  if (looksLikeUrl) {
    const url = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    // TAREFA 1 — domínio que bloqueia iframe (google, instagram, ML…) → abre
    // DIRETO em nova aba do sistema: o usuário nunca vê cadeado para sites comuns
    return { url, title: domainOf(url) };
  }

  // TAREFA 1 — texto livre → busca no Google numa nova aba do sistema
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(input)}`,
    title: `Busca: ${input}`,
  };
}

// ─────────────────────────────────────────────────────────────
// MELHORIA 2 — Fundo dinâmico estilo Brave (crossfade a cada 30s)
// ─────────────────────────────────────────────────────────────
function cosmosBackground(n: number): string {
  void n;
  return "#09090B";
}

function DynamicBackgroundLegacy({
  mode = "cosmos",
}: {
  mode?: "cosmos" | "simple";
}) {
  const [urls, setUrls] = useState<[string, string | null]>([
    cosmosBackground(1),
    null,
  ]);
  const [visible, setVisible] = useState<0 | 1>(0);
  const visibleRef = useRef<0 | 1>(0);
  const counter = useRef(1);

  useEffect(() => {
    // prefers-reduced-motion → fundo estático (sem carrossel)
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      const nextUrl = cosmosBackground(++counter.current);
      // Pré-carrega a próxima imagem antes de trocar (evita flash)
      {
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
      }
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`absolute inset-0 ${mode === "simple" ? "bg-black" : ""}`}>
      {urls.map((u, i) =>
        u ? (
          <div
            key={i}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-[2000ms] ease-in-out"
            style={{
              backgroundImage: u,
              opacity: visible === i ? 1 : 0,
              // Tarefa 8: nível Brave — imagem visível, porém sóbria em ambos os temas
            }}
          />
        ) : null,
      )}
      {/* Overlay escuro (estilo Brave: permanece escuro também no tema claro) */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 to-black/75" />
    </div>
  );
}

function isBackgroundImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

function nextBackgroundIndex(length: number, currentIndex: number): number {
  if (length <= 1) return 0;
  if (currentIndex < 0 || currentIndex >= length)
    return Math.floor(Math.random() * length);
  return (currentIndex + 1 + Math.floor(Math.random() * (length - 1))) % length;
}

function DynamicBackground({
  mode = "cosmos",
  ghost = false,
}: {
  mode?: "cosmos" | "simple";
  ghost?: boolean;
}) {
  const { theme } = useTheme();
  const [images, setImages] = useState<string[]>([]);
  const [imageSlots, setImageSlots] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [visibleSlot, setVisibleSlot] = useState<0 | 1>(0);
  const [imageFailed, setImageFailed] = useState(false);
  const imageSlotRef = useRef<0 | 1>(0);
  const imageIndexRef = useRef(-1);
  const isLight = theme === "light";
  const isSimple = mode === "simple";

  useEffect(() => {
    if (isSimple || ghost) return;
    let cancelled = false;
    fetch("/api/pixabay", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Pixabay indisponível");
        return (await response.json()) as { enabled?: boolean; images?: unknown };
      })
      .then((data) => {
        const validImages = Array.isArray(data.images)
          ? data.images.filter(isBackgroundImageUrl)
          : [];
        if (!cancelled && data.enabled && validImages.length) {
          setImageFailed(false);
          setImages(validImages);
        }
      })
      .catch(() => {
        // O canvas continua sendo o fundo principal quando a API falha.
      });
    return () => {
      cancelled = true;
    };
  }, [ghost, isSimple]);

  useEffect(() => {
    if (!images.length || isSimple || ghost) return;
    let cancelled = false;
    let sessionIndex = -1;
    try {
      const saved = sessionStorage.getItem("orbit_pixabay_index");
      sessionIndex = saved ? Number.parseInt(saved, 10) : -1;
    } catch {}
    const previousIndex =
      Number.isInteger(sessionIndex) && sessionIndex >= 0
        ? sessionIndex % images.length
        : -1;
    const nextIndex = nextBackgroundIndex(images.length, previousIndex);
    imageIndexRef.current = nextIndex;

    function preloadAndShow(index: number, attempted = new Set<number>()) {
      const url = images[index];
      if (!url || attempted.has(index)) {
        setImageFailed(true);
        return;
      }
      attempted.add(index);
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        const hiddenSlot: 0 | 1 = imageSlotRef.current === 0 ? 1 : 0;
        setImageSlots((current) => {
          const next: [string | null, string | null] = [current[0], current[1]];
          next[hiddenSlot] = url;
          return next;
        });
        imageSlotRef.current = hiddenSlot;
        setVisibleSlot(hiddenSlot);
        setImageFailed(false);
        imageIndexRef.current = index;
        try {
          sessionStorage.setItem("orbit_pixabay_index", String(index));
        } catch {}
      };
      image.onerror = () => {
        const fallbackIndex = images.findIndex(
          (_, candidate) => !attempted.has(candidate),
        );
        if (fallbackIndex >= 0) preloadAndShow(fallbackIndex, attempted);
        else setImageFailed(true);
      };
      image.src = url;
    }

    preloadAndShow(nextIndex);
    const timer = window.setInterval(
      () => {
        preloadAndShow(nextBackgroundIndex(images.length, imageIndexRef.current));
      },
      10 * 60 * 1000,
    );
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ghost, images, isSimple]);

  const showPhoto =
    !imageFailed && imageSlots.some(Boolean) && !isSimple && !ghost;
  const overlay = ghost
    ? "bg-black/95"
    : isLight
      ? "bg-gradient-to-b from-white/35 via-white/30 to-white/50"
      : "bg-gradient-to-b from-black/48 via-black/45 to-black/65";

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${isLight ? "bg-[#dbe5f4]" : "bg-[#050816]"}`}
      aria-hidden="true"
    >
      <StarfieldBackground
        opacity={isLight ? 0.24 : ghost ? 0.42 : 0.78}
        minimal={ghost || isSimple}
      />
      {showPhoto &&
        imageSlots.map((url, index) =>
          url ? (
            <div
              key={`${url}-${index}`}
              className="absolute inset-0 bg-cover bg-center opacity-0 transition-opacity duration-[1800ms]"
              style={{
                backgroundImage: `url(${JSON.stringify(url)})`,
                opacity: visibleSlot === index ? (isLight ? 0.42 : 0.52) : 0,
              }}
            />
          ) : null,
        )}
      <div className={`absolute inset-0 ${overlay}`} />
    </div>
  );
}

function HomeGrid({
  onOpen,
  onIntelligence,
  username,
  history = [],
  background = "cosmos",
  ghost = false,
}: {
  onOpen: (url: string, title: string) => void;
  onIntelligence: () => void;
  username?: string;
  history?: UrlHistoryItem[];
  background?: "cosmos" | "simple";
  ghost?: boolean;
}) {
  const [connectedIas, setConnectedIas] = useState(1);

  useEffect(() => {
    fetch("/api/status/openrouter")
      .then((response) => response.json())
      .then((data: { connected?: boolean }) =>
        setConnectedIas(data.connected ? 2 : 1),
      )
      .catch(() => setConnectedIas(1));
  }, []);

  return (
    <div className="relative h-full overflow-hidden">
      <DynamicBackground mode={background} ghost={ghost} />
      <div className="scroll-slim relative z-10 flex h-full items-center justify-center overflow-y-auto p-8">
        {username && (
          <p className="absolute left-6 top-6 text-sm font-medium text-white/80">
            {new Date().getHours() < 12
              ? "Bom dia"
              : new Date().getHours() < 18
                ? "Boa tarde"
                : "Boa noite"}
            , {username} 🌤️
          </p>
        )}
        <div className="grid w-full max-w-6xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {/* Card em destaque — HUB DE INTELIGÊNCIAS (borda degradê violeta) */}
          <div className="col-span-2 min-h-[150px] rounded-3xl border border-violet-300/30 bg-zinc-900 p-[1.5px] shadow-lg shadow-black/25 transition hover:-translate-y-1 sm:col-span-2">
            <button
              type="button"
              onClick={onIntelligence}
              className="flex h-[150px] w-full flex-col items-center justify-center gap-2 rounded-[10.5px] bg-black/85 backdrop-blur-md transition hover:bg-zinc-900/85"
            >
              <span className="text-3xl">🧠</span>
              <span className="text-[13px] font-semibold text-white">
                Inteligências
              </span>
              <span className="text-[11px] text-violet-200/80">
                {connectedIas} IAs conectadas
              </span>
            </button>
          </div>
          <div className="col-span-2 grid grid-cols-2 justify-center gap-4 sm:col-span-3 sm:grid-cols-3 lg:col-span-4 lg:grid-cols-4">
            {HOME_SHORTCUTS.map((s) => (
              <button
                key={s.url}
                type="button"
                onClick={() => onOpen(s.url, s.title)}
                className="group flex h-[120px] w-full flex-col items-center justify-center gap-3 rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-md transition hover:-translate-y-1 hover:border-white/40 hover:bg-white/20 hover:shadow-lg hover:shadow-black/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={faviconFor(s.url)}
                  alt=""
                  className="h-10 w-10 rounded"
                />
                <span className="text-sm font-medium text-white">
                  {s.title}
                </span>
                <span className="text-[10px] text-white/60">
                  ·{" "}
                  {
                    history.filter(
                      (h) =>
                        h.url === s.url && Date.now() - h.at < 7 * 86400000,
                    ).length
                  }{" "}
                  visitas na semana
                </span>
              </button>
            ))}
          </div>
          {Array.from(new Set(HOME_APPS.map((app) => app.category))).map(
            (category) => (
              <section
                key={category}
                className="col-span-2 mt-8 sm:col-span-3 lg:col-span-4"
              >
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                  {category}
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {HOME_APPS.filter((app) => app.category === category).map(
                    (app) => (
                      <button
                        key={app.url}
                        type="button"
                        onClick={() => onOpen(app.url, app.title)}
                        className="group flex h-[108px] w-full flex-col items-center justify-center gap-2 rounded-3xl border border-white/15 bg-black/25 p-3 text-white backdrop-blur-md transition hover:-translate-y-1 hover:border-white/35 hover:bg-white/10 hover:shadow-lg hover:shadow-black/25"
                      >
                        <span
                          className="text-3xl leading-none"
                          aria-hidden="true"
                        >
                          {app.icon}
                        </span>
                        <span className="text-xs font-medium">{app.title}</span>
                      </button>
                    ),
                  )}
                </div>
              </section>
            ),
          )}
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

// TAREFA 2 — Card de golpe DENTRO da aba (nunca modal antes dela):
// elegante, com gradiente da marca Cosmos, e o site só carrega se o
// usuário decidir continuar.
function ScamGateCard({
  url,
  brand,
  official,
  onProceed,
  onCancel,
}: {
  url: string;
  brand: string;
  official: string;
  onProceed: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-2xl border border-red-500/30 bg-white p-8 text-center shadow-xl shadow-red-500/10 dark:border-red-400/25 dark:bg-zinc-900">
        <p className="text-4xl">🛡️</p>
        <p className="mt-4 text-[15px] font-semibold leading-relaxed text-zinc-900 dark:text-white">
          Alerta de segurança
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
          O domínio{" "}
          <span className="font-mono font-semibold text-zinc-900 dark:text-white">
            {domainOf(url)}
          </span>{" "}
          usa o nome{" "}
          <span className="font-semibold text-zinc-900 dark:text-white">
            “{brand}”
          </span>{" "}
          sem ser o site oficial{" "}
          <span className="font-mono text-zinc-900 dark:text-white">
            {official}
          </span>
          . Golpes comuns: produtos falsos e roubo de login.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onProceed}
            className="rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-black shadow-lg shadow-black/20 transition hover:bg-zinc-200"
          >
            Continuar por minha conta
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-zinc-300 px-5 py-2 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/[0.06]"
          >
            Voltar ao início
          </button>
        </div>
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
// MELHORIA 3 — iframe com spinner + timeout de 8s → fallback elegante
// ─────────────────────────────────────────────────────────────
function GuardedFrame({
  tabId,
  url,
  title,
  reloadKey,
  ghost,
  knownBlocked = false,
  onOpenOutside,
  onBack,
}: {
  tabId: string;
  url: string;
  title: string;
  reloadKey: number;
  ghost?: boolean;
  knownBlocked?: boolean;
  onOpenOutside: () => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ok" | "blocked">(
    knownBlocked ? "blocked" : "loading",
  );
  // TAREFA 2 — o spinner só aparece DENTRO da aba se o conteúdo NÃO carregar
  // em 1,5s (nunca antes): o clique parece instantâneo.
  const [spinnerVisible, setSpinnerVisible] = useState(false);
  useEffect(() => {
    setStatus(knownBlocked ? "blocked" : "loading");
    setSpinnerVisible(false);
    // 1,5s: só então o spinner entra em cena (se ainda estiver carregando)
    const spinnerTimer = window.setTimeout(() => setSpinnerVisible(true), 1500);
    // 8s: sites pesados (Shopee, Mercado Livre) demoram a sinalizar; só depois
    // disso trocamos pela mensagem elegante de "abrir fora".
    const timer = window.setTimeout(() => {
      setStatus((s) => (s === "loading" ? "blocked" : s));
    }, 8000);
    return () => {
      window.clearTimeout(spinnerTimer);
      window.clearTimeout(timer);
    };
  }, [knownBlocked, url, reloadKey]);

  if (status === "blocked") {
    return (
      <OrbitExternal
        url={url}
        title={title}
        onOpenOutside={onOpenOutside}
        onTryInside={() => setStatus("loading")}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="relative h-full w-full bg-white">
      {status === "loading" && spinnerVisible && <FrameSpinner />}
      <iframe
        key={`${tabId}-${url}-${reloadKey}`}
        src={url}
        title={title}
        onLoad={() => setStatus("ok")}
        onError={() => setStatus("blocked")}
        className="h-full w-full border-0"
        // MODO FANTASMA: sandbox reforçado — nada de cookies, origem ou formulários
        sandbox={ghost ? "allow-scripts" : undefined}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MELHORIA 3 — Página especial do YouTube (buscador + vídeos NO shell)
// ─────────────────────────────────────────────────────────────
function YouTubeHome({
  onSearch,
  onToast,
}: {
  onSearch: (term: string) => void;
  onToast: (message: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [mode, setMode] = useState<"normal" | "nolads">("normal");
  const [videoInput, setVideoInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  useEffect(() => {
    try {
      setMode(
        localStorage.getItem("orbit_yt_mode") === "nolads"
          ? "nolads"
          : "normal",
      );
    } catch {}
  }, []);
  function toggleMode(next: "normal" | "nolads") {
    setMode(next);
    try {
      localStorage.setItem("orbit_yt_mode", next);
    } catch {}
  }
  function extractVideoId(value: string) {
    try {
      const url = new URL(value.trim());
      return (
        url.searchParams.get("v") ||
        url.pathname.split("/").filter(Boolean).pop() ||
        null
      );
    } catch {
      return null;
    }
  }
  return (
    <div className="scroll-slim flex h-full flex-col items-center gap-5 overflow-y-auto bg-[#0F0F0F] p-8">
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
          onSearch(t);
        }}
        className="flex w-full max-w-xl gap-2"
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar vídeos no YouTube… (abre resultados reais)"
          className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/40"
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-500"
        >
          Buscar
        </button>
      </form>

      {/* Vídeos DENTRO do shell — playlist em destaque tocando direto aqui */}
      <div className="w-full max-w-5xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-zinc-300">
            Assistir um vídeo dentro do Orbit
          </span>
          <button
            type="button"
            onClick={() => {
              toggleMode("nolads");
              window.open(
                "https://piped.video/",
                "_blank",
                "noopener,noreferrer",
              );
              onToast("🧪 Frontend alternativo da comunidade — sem anúncios");
            }}
            className="shrink-0 text-[12px] text-zinc-400 underline decoration-zinc-600 underline-offset-4 transition hover:text-white"
          >
            {mode === "normal"
              ? "🧪 Sem anúncios (experimental)"
              : "Voltar ao YouTube normal"}
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const id = extractVideoId(videoInput);
            if (id) setVideoId(id);
            else onToast("Cole um link válido do YouTube (watch?v=...)");
          }}
          className="mt-5 flex w-full max-w-2xl gap-2"
        >
          <input
            value={videoInput}
            onChange={(event) => setVideoInput(event.target.value)}
            placeholder="Cole um link do YouTube (watch?v=...)"
            className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/40"
          />
          <button
            type="submit"
            className="rounded-xl bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/20"
          >
            Assistir
          </button>
        </form>
        {videoId ? (
          <div className="mt-5 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10">
            <iframe
              key={`${videoId}-${mode}`}
              src={youtubeEmbedUrl(videoId, mode)}
              title="Vídeo do YouTube"
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="no-referrer"
              onError={() => {
                if (mode === "nolads") {
                  toggleMode("normal");
                  onToast(
                    "Frontend experimental indisponível; voltando ao YouTube normal.",
                  );
                }
              }}
            />
          </div>
        ) : (
          <p className="mt-5 text-center text-xs text-zinc-500">
            💡 Dica: cole o link de qualquer vídeo para assistir dentro do
            Orbit. Buscas abrem no YouTube real.
          </p>
        )}
        {mode === "nolads" && (
          <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
            🧪 Experimental — servidores da comunidade, podem ficar instáveis.
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
type YoutubeSearchResult = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  publishedAt: string;
};

function YouTubeRealHome({ onToast }: { onToast: (message: string) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<YoutubeSearchResult[]>([]);
  const [selectedVideo, setSelectedVideo] =
    useState<YoutubeSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchYouTube(event: React.FormEvent) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    setSelectedVideo(null);
    try {
      const response = await fetch(
        "/api/youtube?q=" + encodeURIComponent(query),
      );
      const data = await response.json();
      if (data.error === "sem_chave") {
        setError(
          data.instrucoes ?? "Configure YOUTUBE_API_KEY para pesquisar.",
        );
        setResults([]);
      } else if (!response.ok) {
        setError(data.error ?? "Não foi possível buscar vídeos agora.");
        setResults([]);
      } else {
        setResults(data.results ?? []);
      }
    } catch {
      setError("Falha de conexão com a busca do YouTube.");
    } finally {
      setLoading(false);
    }
  }

  const relativeDate = (date: string) => {
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(date).getTime()) / 86400000),
    );
    if (days < 1) return "hoje";
    if (days < 30) return "há " + days + (days === 1 ? " dia" : " dias");
    const months = Math.floor(days / 30);
    return "há " + months + (months === 1 ? " mês" : " meses");
  };

  return (
    <div className="scroll-slim h-full overflow-y-auto bg-[#0F0F0F] p-6 text-white sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-14 items-center justify-center rounded-xl bg-red-600">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="text-2xl font-semibold">YouTube</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                window.open(
                  "https://www.youtube.com",
                  "_blank",
                  "noopener,noreferrer",
                );
                onToast("🌐 YouTube real aberto em nova aba");
              }}
              className="rounded-xl border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"
            >
              Abrir no YouTube ↗
            </button>
            <button
              type="button"
              onClick={() => {
                window.open(
                  "https://piped.video",
                  "_blank",
                  "noopener,noreferrer",
                );
                onToast("🧪 Frontend alternativo da comunidade — sem anúncios");
              }}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:bg-white/10"
            >
              🧪 Zero anúncios
            </button>
          </div>
        </div>
        <form
          onSubmit={searchYouTube}
          className="mx-auto mb-8 flex w-full max-w-2xl gap-2"
        >
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar vídeos no YouTube…"
            className="h-12 min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm outline-none placeholder:text-zinc-500 focus:border-white/40"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-red-600 px-5 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </form>
        {selectedVideo ? (
          <div>
            <button
              type="button"
              onClick={() => setSelectedVideo(null)}
              className="mb-4 rounded-xl border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"
            >
              ← Voltar aos resultados
            </button>
            <h2 className="text-xl font-semibold">{selectedVideo.title}</h2>
            <p className="mb-4 text-sm text-zinc-400">
              {selectedVideo.channel}
            </p>
            <div className="overflow-hidden rounded-3xl border border-white/10">
              <iframe
                src={
                  "https://www.youtube.com/embed/" +
                  selectedVideo.videoId +
                  "?playsinline=1&rel=0"
                }
                title={selectedVideo.title}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-amber-400/30 bg-amber-400/10 p-6 text-sm text-amber-100">
            <h2 className="mb-3 text-lg font-semibold">
              Configure a busca do YouTube
            </h2>
            <p className="mb-4 leading-relaxed">{error}</p>
            <a
              href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline"
            >
              Abrir console.cloud.google.com →
            </a>
          </div>
        ) : results.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((video) => (
              <button
                key={video.videoId}
                type="button"
                onClick={() => setSelectedVideo(video)}
                className="group text-left"
              >
                <div className="overflow-hidden rounded-xl bg-zinc-900">
                  <img
                    src={video.thumbnail}
                    alt=""
                    className="aspect-video w-full object-cover transition group-hover:scale-105"
                  />
                </div>
                <h2 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug">
                  {video.title}
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  {video.channel} · {relativeDate(video.publishedAt)}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-zinc-500">
            Pesquise um vídeo para ver thumbnails e assistir dentro do Orbit.
          </p>
        )}
      </div>
    </div>
  );
}

// Busca do YouTube: o embed listType=search foi descontinuado pelo Google e
// falha sempre. Fallback honesto: vídeo fixo em destaque + nota ao usuário.
// ─────────────────────────────────────────────────────────────
function YouTubeSearchFallback({ term }: { term: string }) {
  return (
    <div className="scroll-slim flex h-full flex-col items-center gap-5 overflow-y-auto bg-[#0F0F0F] p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-14 items-center justify-center rounded-lg bg-red-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="max-w-[320px] truncate text-xl font-semibold text-white">
          YouTube: {term}
        </span>
      </div>
      <p className="max-w-md text-center text-[13px] leading-relaxed text-zinc-400">
        🔍 A busca completa está em breve. Enquanto isso, curta o vídeo em
        destaque:
      </p>
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-white/10">
        <iframe
          src={YOUTUBE_FALLBACK_VIDEO}
          title={`YouTube: ${term}`}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}

export default function BrowserShell() {
  const { setTheme } = useTheme();
  const [tabs, setTabs] = useState<Tab[]>([
    { id: ORBIT_TAB_ID, title: "Orbit", type: "orbit-chat" },
    { id: HOME_TAB_ID, title: "Início", type: "home" },
  ]);
  const [activeId, setActiveId] = useState<string>(ORBIT_TAB_ID);
  const [favorites, setFavorites] = useState<Favorite[]>(DEFAULT_FAVORITES);
  const [urlInput, setUrlInput] = useState("");
  const [histories, setHistories] = useState<
    Record<string, { stack: string[]; index: number }>
  >({});
  const [reloadKey, setReloadKey] = useState(0);
  const [ghostMode, setGhostMode] = useState(false); // MODO FANTASMA: apenas state, NUNCA persistir
  // TAREFA 2 — o modal de golpe pré-abertura foi REMOVIDO: o aviso agora vive
  // dentro da aba (ScamGateCard), então o clique nunca é bloqueado antes.
  // 🛡️ Tarefa 7 — contadores de bloqueio (por sessão) e toast
  const [blockedCount, setBlockedCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  // TAREFA 5/18 — sugestões e histórico no campo de URL
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIdx, setSuggestIdx] = useState(-1);
  const [urlHistory, setUrlHistory] = useState<UrlHistoryItem[]>([]);
  // TAREFA 6/7 — Ctrl+Tab (alternar) e Ctrl+Shift+T (reabrir aba fechada)
  const [lastActiveId, setLastActiveId] = useState<string>(ORBIT_TAB_ID);
  const [closedTab, setClosedTab] = useState<{
    tab: Tab;
    index: number;
  } | null>(null);
  // TAREFA 12 — sidebar de IA persistente (orbit_sidebar)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // TAREFA 3 — favoritos colapsáveis no mobile
  const [favExpanded, setFavExpanded] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const prevActiveId = useRef(ORBIT_TAB_ID);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplash(false), 600);
    return () => window.clearTimeout(timer);
  }, []);

  // Toast some sozinho após 3,5s
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);
  const hydrated = useRef(false);

  // MELHORIA 1 — formulário inline de novo favorito
  const [showFavForm, setShowFavForm] = useState(false);
  const [favName, setFavName] = useState("");
  const [favUrl, setFavUrl] = useState("");
  const [editingFavoriteUrl, setEditingFavoriteUrl] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    homepage: "home",
    locale: "pt-BR",
    premium: false,
    username: "",
    background: "cosmos" as "cosmos" | "simple",
  });
  const [splash, setSplash] = useState(true);

  // Carrega abas e favoritos salvos no localStorage
  useEffect(() => {
    try {
      const rawTabs = localStorage.getItem("orbit_tabs");
      if (rawTabs) {
        const parsed = normalizeTabs(JSON.parse(rawTabs) as unknown);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // A aba Orbit é fixa: reinsere se ausente
          const withOrbit = parsed.some((t) => t.id === ORBIT_TAB_ID)
            ? parsed
            : [
                {
                  id: ORBIT_TAB_ID,
                  title: "Orbit",
                  type: "orbit-chat" as TabType,
                },
                ...parsed,
              ];
          setTabs(withOrbit);
          const savedActiveId = localStorage.getItem(ACTIVE_TAB_KEY);
          setActiveId(
            typeof savedActiveId === "string" && withOrbit.some((tab) => tab.id === savedActiveId)
              ? savedActiveId
              : withOrbit[0].id,
          );
        }
      }
      const savedFavorites = readFavorites();
      if (savedFavorites.length > 0) setFavorites(savedFavorites);
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
      localStorage.setItem(
        "orbit_tabs",
        JSON.stringify(normalizeTabs(tabs.filter((t) => !t.ghost))),
      );
    } catch {}
  }, [tabs]);

  useEffect(() => {
    if (!hydrated.current || !tabs.some((tab) => tab.id === activeId)) return;
    try {
      localStorage.setItem(ACTIVE_TAB_KEY, activeId);
    } catch {}
  }, [activeId, tabs]);

  // Persiste os favoritos
  useEffect(() => {
    if (!hydrated.current) return;
    writeFavorites(favorites);
  }, [favorites]);

  // TAREFA 12/18 — carrega preferências locais (sidebar + histórico de URLs)
  useEffect(() => {
    try {
      setSidebarOpen(localStorage.getItem(SIDEBAR_KEY) === "true");
      const savedSettings = localStorage.getItem("orbit_settings");
      if (savedSettings)
        setSettings((current) => ({
          ...current,
          ...JSON.parse(savedSettings),
        }));
    } catch {}
    setUrlHistory(readUrlHistory());
  }, []);

  // TAREFA 12 — persiste a sidebar aberta/fechada
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen));
    } catch {}
  }, [sidebarOpen]);

  useEffect(() => {
    try {
      localStorage.setItem("orbit_settings", JSON.stringify(settings));
      localStorage.setItem("orbit_premium_image", String(settings.premium));
      localStorage.setItem("orbit_locale", settings.locale);
    } catch {}
  }, [settings]);

  // TAREFA 6 — guarda a aba anterior para o Ctrl+Tab
  useEffect(() => {
    if (activeId !== prevActiveId.current) {
      setLastActiveId(prevActiveId.current);
      prevActiveId.current = activeId;
    }
  }, [activeId]);

  // TAREFAS 6, 7, 11 — atalhos de teclado globais do shell
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "Tab") {
        e.preventDefault();
        switchToLastTab();
        return;
      }
      if (mod && e.shiftKey && (e.key === "T" || e.key === "t")) {
        e.preventDefault();
        reopenClosedTab();
        return;
      }
      if (mod && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        newTab();
        return;
      }
      if (mod && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        closeTab(activeId);
        return;
      }
      if (
        mod &&
        (e.key === "l" || e.key === "L" || e.key === "k" || e.key === "K")
      ) {
        e.preventDefault();
        urlRef.current?.focus();
        urlRef.current?.select();
        setSuggestOpen(true);
        return;
      }
      if (e.key === "Escape") {
        setSuggestOpen(false);
        setSuggestIdx(-1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, tabs, closedTab, lastActiveId]);

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const activeHistory = activeTab ? histories[activeTab.id] : undefined;
  const canBack =
    !!activeTab &&
    activeTab.type === "iframe" &&
    !activeTab.ghost &&
    !!activeHistory &&
    activeHistory.index > 0;
  const canForward =
    !!activeTab &&
    activeTab.type === "iframe" &&
    !activeTab.ghost &&
    !!activeHistory &&
    activeHistory.index < activeHistory.stack.length - 1;

  function updateTab(id: string, patch: Partial<Tab>) {
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function openYouTubeTab(background = false) {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setTabs((ts) => [
      ...ts,
      {
        id,
        title: "YouTube",
        type: "youtube",
        ...(ghostMode ? { ghost: true } : {}),
      },
    ]);
    if (!background) setActiveId(id);
  }

  // Aba especial do HUB DE INTELIGÊNCIAS (id fixo → reabrir só a ativa)
  function openIntelligenceTab() {
    const existing = tabs.find((t) => t.type === "inteligencias");
    if (existing) {
      setActiveId(existing.id);
      return;
    }
    setTabs((ts) => [
      ...ts,
      { id: "inteligencias", title: "🧠 Inteligências", type: "inteligencias" },
    ]);
    setActiveId("inteligencias");
  }

  // TAREFA 17 — aba especial da Arena Multi-IA (id fixo → reabre só a ativa)
  function openArenaTab() {
    if (tabs.some((t) => t.id === ARENA_TAB_ID)) {
      setActiveId(ARENA_TAB_ID);
      return;
    }
    setTabs((ts) => [
      ...ts,
      { id: ARENA_TAB_ID, title: "⚖️ Arena de IAs", type: "arena" },
    ]);
    setActiveId(ARENA_TAB_ID);
  }

  // TAREFA 23 — aba especial do dashboard de privacidade (100% local)
  function openPrivacyTab() {
    if (tabs.some((t) => t.id === PRIVACY_TAB_ID)) {
      setActiveId(PRIVACY_TAB_ID);
      return;
    }
    setTabs((ts) => [
      ...ts,
      { id: PRIVACY_TAB_ID, title: "📊 Privacidade", type: "privacidade" },
    ]);
    setActiveId(PRIVACY_TAB_ID);
  }

  // 🛡️ Tarefa 7 — porta de entrada do blocklist: recusa tracker e conta
  function blockTracker(url: string): boolean {
    const tracker = matchedTracker(url);
    if (!tracker) return false;
    setBlockedCount((n) => n + 1);
    setToast(`🛡️ Orbit bloqueou ${tracker}`);
    return true;
  }

  // TAREFA 2 — clique = AÇÃO IMEDIATA: a aba é criada e ativada NA HORA
  // (sem delay, sem processamento visível). O aviso de golpe — apenas para
  // domínios suspeitos fora da whitelist — aparece DENTRO da aba.
  // TAREFA 1 — abre um URL em NOVA ABA DO SISTEMA (nunca cadeado para sites comuns)
  function openExternal(url: string, message?: string) {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
      setToast(message ?? `${domainOf(url)} aberta em nova aba`);
    } catch {
      setToast(
        "Não foi possível abrir a nova aba — verifique o bloqueador de pop-ups.",
      );
    }
  }

  // TAREFA 18 — registra a URL no histórico local (título + timestamp)
  function rememberUrl(url: string, title: string) {
    if (!url || url.startsWith("orbit-yt-search:")) return;
    try {
      const entry: UrlHistoryItem = {
        title: title || domainOf(url),
        url,
        at: Date.now(),
      };
      const rest = readUrlHistory().filter((h) => h.url !== url);
      const next = [entry, ...rest].slice(0, URL_HISTORY_MAX);
      writeUrlHistory(next);
      setUrlHistory(next);
    } catch {}
  }

  function openIframeTab(url: string, title: string, background = false) {
    // 🛡️ Tarefa 7: tracker → toast + contador, sem abrir a aba
    if (blockTracker(url)) return;
    // Sites bloqueados entram na aba e exibem a tela Órbita Externa.
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // TAREFA 1/25 — whitelist e zona de confiança PULAM o check de golpe
    const scam =
      isWhitelisted(url) || isTrustedHost(url) ? null : suspiciousBrand(url);
    if (scam) {
      const embedUrl = toEmbeddableUrl(url);
      setTabs((ts) => [
        ...ts,
        {
          id,
          title,
          type: "iframe",
          url: embedUrl,
          unverified: true,
          scamBrand: scam.brand,
          scamOfficial: scam.official,
          ...(ghostMode ? { ghost: true } : {}),
        },
      ]);
      if (!ghostMode)
        setHistories((h) => ({ ...h, [id]: { stack: [embedUrl], index: 0 } }));
      if (!background) setActiveId(id);
      rememberUrl(embedUrl, title);
      return;
    }
    // Busca do YouTube ("yt: termo") → aba especial com vídeo fixo + nota
    const ytTerm = ytSearchTerm(url);
    if (ytTerm) {
      const ytId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setTabs((ts) => [
        ...ts,
        {
          id: ytId,
          title,
          type: "youtube-search",
          url: ytTerm,
          ...(ghostMode ? { ghost: true } : {}),
        },
      ]);
      if (!background) setActiveId(ytId);
      return;
    }
    if (isYouTubeHome(url)) {
      openYouTubeTab();
      return;
    }
    const embedUrl = toEmbeddableUrl(url);
    // MODO FANTASMA: aba marcada como fantasma e histórico NÃO gravado
    setTabs((ts) => [
      ...ts,
      {
        id,
        title,
        type: "iframe",
        url: embedUrl,
        ...(ghostMode ? { ghost: true } : {}),
      },
    ]);
    if (!ghostMode)
      setHistories((h) => ({ ...h, [id]: { stack: [embedUrl], index: 0 } }));
    if (!background) setActiveId(id);
    rememberUrl(embedUrl, title);
  }

  function newTab() {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setTabs((ts) => [
      ...ts,
      {
        id,
        title: "Nova aba",
        type: "home",
        ...(ghostMode ? { ghost: true } : {}),
      },
    ]);
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
    // TAREFA 7 — guarda a aba fechada para o undo (Ctrl+Shift+T)
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx >= 0) setClosedTab({ tab: tabs[idx], index: idx });
    setTabs((ts) => ts.filter((t) => t.id !== id));
    setActiveId((cur) => (cur === id ? ORBIT_TAB_ID : cur));
  }

  // TAREFA 7 — reabre a última aba fechada NA MESMA POSIÇÃO
  function reopenClosedTab() {
    if (!closedTab) return;
    const { tab, index } = closedTab;
    setTabs((ts) => {
      if (ts.some((t) => t.id === tab.id)) return ts;
      const next = [...ts];
      next.splice(Math.min(index, next.length), 0, tab);
      return next;
    });
    setActiveId(tab.id);
    setClosedTab(null);
    setToast(`↩️ Aba "${tab.title}" reaberta`);
  }

  // TAREFA 6 — Ctrl+Tab alterna entre as 2 últimas abas
  function switchToLastTab() {
    if (!lastActiveId || lastActiveId === activeId) return;
    if (!tabs.some((t) => t.id === lastActiveId)) return;
    setActiveId(lastActiveId);
  }

  // Logo → volta para a aba home (recria se foi fechada)
  function goHome() {
    setTabs((ts) => {
      if (ts.some((t) => t.id === HOME_TAB_ID)) return ts;
      const orbitIdx = ts.findIndex((t) => t.id === ORBIT_TAB_ID);
      const next = [...ts];
      next.splice(orbitIdx + 1, 0, {
        id: HOME_TAB_ID,
        title: "Início",
        type: "home",
      });
      return next;
    });
    setActiveId(HOME_TAB_ID);
  }

  // Navegação dentro da própria aba (empilha no histórico interno)
  function navigateInTab(tabId: string, url: string, title: string) {
    // 🛡️ Tarefa 7: tracker → toast + contador, sem navegar
    if (blockTracker(url)) return;
    const embedUrl = toEmbeddableUrl(url);
    // MODO FANTASMA: navega SEM gravar histórico (voltar/avançar ficam desabilitados)
    if (tabs.find((t) => t.id === tabId)?.ghost) {
      updateTab(tabId, { type: "iframe", url: embedUrl, title });
      return;
    }
    updateTab(tabId, { type: "iframe", url: embedUrl, title });
    rememberUrl(embedUrl, title);
    setHistories((h) => {
      const cur = h[tabId] ?? { stack: [], index: -1 };
      const stack = [...cur.stack.slice(0, cur.index + 1), embedUrl];
      return { ...h, [tabId]: { stack, index: stack.length - 1 } };
    });
  }

  // Navegação pelo campo de URL
  function navigate(url: string, title: string) {
    if (!activeTab) return;
    // TAREFA 1 — tracker → recusa; site que bloqueia iframe → abre em nova aba
    if (blockTracker(url)) return;
    if (isBlockedFrame(url)) {
      // Preserve an Orbit tab and offer an explicit external-navigation
      // fallback; do not attempt to bypass the site's frame policy.
      openIframeTab(url, title);
      return;
    }
    // TAREFA 1/25 — whitelist e zona de confiança nunca alertam
    const scam =
      isWhitelisted(url) || isTrustedHost(url) ? null : suspiciousBrand(url);
    if (scam && activeTab.type === "iframe") {
      // TAREFA 2 — navegação suspeita: entra NA HORA, aviso DENTRO da aba
      navigateInTab(activeTab.id, url, title);
      updateTab(activeTab.id, {
        unverified: true,
        scamBrand: scam.brand,
        scamOfficial: scam.official,
        scamDismissed: false,
      });
      return;
    }
    if (scam) {
      // TAREFA 2 — fora de um iframe: abre a aba imediatamente (aviso dentro dela)
      openIframeTab(url, title);
      return;
    }
    // Busca do YouTube ("yt: termo") → reutiliza a aba do YouTube quando possível
    const ytTerm = ytSearchTerm(url);
    if (ytTerm) {
      if (activeTab.type === "youtube" || activeTab.type === "youtube-search") {
        updateTab(activeTab.id, { type: "youtube-search", url: ytTerm, title });
      } else {
        openIframeTab(url, title);
      }
      return;
    }
    if (isYouTubeHome(url)) {
      if (activeTab.type === "iframe" || activeTab.type === "youtube") {
        updateTab(activeTab.id, {
          type: "youtube",
          url: undefined,
          title: "YouTube",
        });
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
    const answer = smartBarAnswer(urlInput);
    if (answer) {
      setToast(answer);
      setUrlInput("");
      setSuggestOpen(false);
      return;
    }
    const resolved = resolveUrlInput(urlInput);
    if (!resolved) return;
    // TAREFA 1 — texto livre / domínio bloqueador → nova aba do sistema (nunca 🔒)
    if (resolved.external) {
      openExternal(
        resolved.url,
        resolved.title.startsWith("Busca:")
          ? "🌐 Busca do Google aberta em nova aba"
          : `🌐 ${resolved.title} aberta em nova aba`,
      );
      setUrlInput("");
      setSuggestOpen(false);
      return;
    }
    navigate(resolved.url, resolved.title);
    setUrlInput("");
    setSuggestOpen(false);
  }

  // MELHORIA 1 — adiciona favorito pelo formulário inline
  function addFavorite(e: React.FormEvent) {
    e.preventDefault();
    const url = normalizeFavoriteUrl(favUrl);
    if (!url) {
      setToast("URL de favorito inválida.");
      return;
    }
    const title = favName.trim() || domainOf(url);
    setFavorites((fs) => {
      const duplicate = fs.some((f) => f.url === url && f.url !== editingFavoriteUrl);
      if (duplicate) {
        setToast("Esse favorito já existe.");
        return fs;
      }
      return editingFavoriteUrl
        ? fs.map((f) => f.url === editingFavoriteUrl ? { ...f, title, url } : f)
        : [...fs, { title, url, folder: "Geral" }];
    });
    setFavName("");
    setFavUrl("");
    setEditingFavoriteUrl(null);
    setShowFavForm(false);
  }

  function editFavorite(favorite: Favorite) {
    setFavName(favorite.title);
    setFavUrl(favorite.url);
    setEditingFavoriteUrl(favorite.url);
    setShowFavForm(true);
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
    setHistories((h) => ({
      ...h,
      [activeTab.id]: { ...activeHistory, index },
    }));
    updateTab(activeTab.id, { url });
  }

  function goForward() {
    if (
      !activeTab ||
      !activeHistory ||
      activeHistory.index >= activeHistory.stack.length - 1
    )
      return;
    const index = activeHistory.index + 1;
    const url = activeHistory.stack[index];
    setHistories((h) => ({
      ...h,
      [activeTab.id]: { ...activeHistory, index },
    }));
    updateTab(activeTab.id, { url });
  }

  function reload() {
    setReloadKey((k) => k + 1);
  }

  // TAREFA 13 — contexto da página ativa (enviado à IA na sidebar)
  const pageContext: { title: string; url: string } | null =
    activeTab && (activeTab.type === "iframe" || activeTab.type === "youtube")
      ? {
          title: activeTab.title,
          url: activeTab.url ?? "https://www.youtube.com",
        }
      : null;

  // TAREFA 5 — sugestões do campo de URL (favoritos filtrados + busca no Google)
  const suggestions = useMemo(() => {
    const q = urlInput.trim().toLowerCase();
    const list = (
      q
        ? favorites.filter(
            (f) =>
              f.title.toLowerCase().includes(q) ||
              f.url.toLowerCase().includes(q),
          )
        : favorites
    )
      .slice(0, 5)
      .map((f) => ({ label: f.title, sub: f.url, url: f.url, title: f.title }));
    const term = urlInput.trim();
    if (term && !/^https?:\/\//i.test(term)) {
      list.push({
        label: `Buscar "${term}" no Google`,
        sub: "abre em nova aba",
        url: `https://www.google.com/search?q=${encodeURIComponent(term)}`,
        title: `Busca: ${term}`,
      });
    }
    return list;
  }, [urlInput, favorites]);
  const smartResult = smartBarAnswer(urlInput);

  // TAREFA 5 — executa a sugestão escolhida (Enter, setas + Enter, ou clique)
  function runSuggestion(item: {
    label: string;
    sub: string;
    url: string;
    title: string;
  }) {
    setSuggestOpen(false);
    setSuggestIdx(-1);
    setUrlInput("");
    if (item.sub === "abre em nova aba") {
      openExternal(item.url, "🌐 Busca do Google aberta em nova aba");
      return;
    }
    navigate(item.url, item.title);
  }

  function renderContent() {
    if (!activeTab) return null;
    if (activeTab.type === "orbit-chat") {
      return (
        <div className="h-full px-4 py-4">
          <OrbitChat onToast={setToast} onOpenHub={openIntelligenceTab} />
        </div>
      );
    }
    if (activeTab.type === "home") {
      return (
        <HomeGrid
          onOpen={openIframeTab}
          onIntelligence={openIntelligenceTab}
          username={settings.username}
          history={urlHistory}
          background={settings.background}
          ghost={activeTab.ghost}
        />
      );
    }
    if (activeTab.type === "inteligencias") {
      return <IntelligenceHub onOpenOrbit={() => setActiveId(ORBIT_TAB_ID)} />;
    }
    if (activeTab.type === "youtube") {
      return <YouTubeRealHome key={activeTab.id} onToast={setToast} />;
    }
    if (activeTab.type === "youtube-search") {
      return (
        <YouTubeSearchFallback key={activeTab.id} term={activeTab.url ?? ""} />
      );
    }
    // TAREFA 17 — Arena Multi-IA
    if (activeTab.type === "arena") {
      return (
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
          🏟️ Arena Multi-IA — em desenvolvimento
        </div>
      );
    }
    // TAREFA 23 — Dashboard de privacidade (100% local, estilo Brave)
    if (activeTab.type === "privacidade") {
      return (
        <>
          {/* <PrivacyDashboard blockedCount={blockedCount} tabsCount={tabs.length} historyCount={urlHistory.length} /> */}
        </>
      );
    }
    const url = activeTab.url ?? "";
    if (!url) {
      return <BlockedNotice url={url} />;
    }
    // TAREFA 2 — aviso de golpe DENTRO da aba (nunca modal antes): o site só
    // carrega depois de o usuário decidir continuar.
    if (activeTab.scamBrand && !activeTab.scamDismissed) {
      return (
        <ScamGateCard
          url={url}
          brand={activeTab.scamBrand}
          official={activeTab.scamOfficial ?? ""}
          onProceed={() => {
            // TAREFA 25 — "Sempre permitir este site" → zona de confiança
            trustHost(url);
            updateTab(activeTab.id, { scamDismissed: true, unverified: false });
          }}
          onCancel={() => closeTab(activeTab.id)}
        />
      );
    }
    // TAREFA 22 — erro estilizado (🛰️ Sinal perdido) com Recarregar / Abrir fora
    return (
      <GuardedFrame
        key={activeTab.id}
        tabId={activeTab.id}
        url={url}
        title={activeTab.title}
        reloadKey={reloadKey}
        ghost={activeTab.ghost}
        knownBlocked={isBlockedFrame(url) && !isCuratedIframeUrl(url)}
        onOpenOutside={() =>
          openExternal(url, `🌐 ${activeTab.title} aberto em nova aba`)
        }
        onBack={() => setActiveId(HOME_TAB_ID)}
      />
    );
  }

  const iconBtn =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.12] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent";

  if (splash) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-black">
        <div className="animate-spin">
          <Logo size={42} />
        </div>
      </div>
    );
  }

  return (
    <section className="flex h-dvh w-full flex-col overflow-hidden border-y border-zinc-200 bg-white dark:border-white/10 dark:bg-[#0E0E11]">
      {/* Barra superior estilo navegador */}
      <div className="flex items-center gap-1.5 border-b border-white/[0.12] bg-black px-3 py-2 text-white">
        <button
          type="button"
          onClick={goHome}
          title="Voltar ao início do Orbit"
          className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-white transition hover:bg-white/[0.12]"
        >
          <Logo size={18} />
          <span className="font-display text-[15px] font-semibold tracking-tight">
            Orbit
          </span>
        </button>

        <button
          type="button"
          onClick={goBack}
          disabled={!canBack}
          aria-label="Voltar"
          title="Voltar"
          className={iconBtn}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5m0 0l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goForward}
          disabled={!canForward}
          aria-label="Avançar"
          title="Avançar"
          className={iconBtn}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={reload}
          aria-label="Recarregar"
          title="Recarregar"
          className={iconBtn}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
          </svg>
        </button>

        <form onSubmit={submitUrl} className="flex min-w-0 flex-1 items-center">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="URL, cálculo ou comandos: yt: / w: / m: / s: / g:"
            className="h-9 w-full rounded-full border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-white/30"
          />
        </form>
        {smartResult && (
          <div className="absolute left-1/2 top-[54px] z-50 -translate-x-1/2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 shadow-xl dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-100">
            {smartResult} · Enter para usar
          </div>
        )}

        {ghostMode && (
          <span className="hidden shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 sm:flex">
            👻 Fantasma
          </span>
        )}
        {/* 🛡️ Tarefa 7 — contador de bloqueios da sessão */}
        {blockedCount > 0 && (
          <span className="hidden shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 sm:flex dark:text-emerald-400">
            🛡️ {blockedCount} bloqueados
          </span>
        )}
        <button
          type="button"
          onClick={toggleGhost}
          aria-pressed={ghostMode}
          aria-label="Modo Fantasma"
          title="Modo Fantasma — nada fica salvo"
          className={`${iconBtn} ${
            ghostMode ? "bg-white/15 text-white hover:bg-white/25" : ""
          }`}
        >
          👻
        </button>
        <ThemeToggle />
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Configurações"
          title="Configurações"
          className={iconBtn}
        >
          ☰
        </button>
      </div>

      {settingsOpen && (
        <aside className="absolute inset-y-0 left-0 z-[80] w-80 overflow-y-auto rounded-r-2xl border-r border-zinc-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0E0E11]">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold">☰ Configurações</h2>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className={iconBtn}
            >
              ×
            </button>
          </div>
          <div className="space-y-5 text-sm">
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                openIntelligenceTab();
              }}
              className="flex w-full items-center justify-between rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-left font-semibold text-violet-700 dark:text-violet-300"
            >
              <span>🧠 Inteligências</span>
              <span>→</span>
            </button>
            <label className="block">
              Seu nome
              <input
                value={settings.username}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, username: e.target.value }))
                }
                placeholder="Como quer ser chamado?"
                className="mt-1 w-full rounded border bg-transparent px-2 py-1"
              />
            </label>
            <label className="block">
              Fundo{" "}
              <select
                value={settings.background}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    background: e.target.value as "cosmos" | "simple",
                  }))
                }
                className="ml-2 rounded border bg-transparent p-1"
              >
                <option value="cosmos">Cosmos animado</option>
                <option value="simple">Simples</option>
              </select>
            </label>
            <section>
              <h3 className="mb-2 font-semibold">Geral</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme("light")}
                  className="rounded border px-2 py-1"
                >
                  Claro
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className="rounded border px-2 py-1"
                >
                  Escuro
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className="rounded border px-2 py-1"
                >
                  Sistema
                </button>
              </div>
              <label className="mt-2 block">
                Página inicial{" "}
                <select
                  value={settings.homepage}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, homepage: e.target.value }))
                  }
                  className="ml-2 rounded border bg-transparent p-1"
                >
                  <option value="home">Início</option>
                  <option value="orbit">Orbit</option>
                </select>
              </label>
              <label className="mt-2 block">
                Idioma{" "}
                <select
                  value={settings.locale}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, locale: e.target.value }))
                  }
                  className="ml-2 rounded border bg-transparent p-1"
                >
                  <option value="pt-BR">pt-BR</option>
                  <option value="en" disabled>
                    EN (em breve)
                  </option>
                </select>
              </label>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Favoritos</h3>
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(
                    new Blob([JSON.stringify(favorites, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  a.download = "orbit-favoritos.json";
                  a.click();
                }}
                className="rounded border px-2 py-1"
              >
                Exportar JSON
              </button>
              <label className="ml-2 cursor-pointer rounded border px-2 py-1">
                Importar JSON
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    file
                      .text()
                      .then((raw) => {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed))
                          setFavorites(
                            parsed.filter(
                              (f): f is Favorite =>
                                typeof f?.title === "string" &&
                                typeof f?.url === "string",
                            ),
                          );
                      })
                      .catch(() => setToast("Arquivo de favoritos inválido"));
                  }}
                />
              </label>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Privacidade</h3>
              <button
                onClick={toggleGhost}
                className="rounded border px-2 py-1"
              >
                {ghostMode ? "Desativar" : "Ativar"} Fantasma
              </button>
              <p className="mt-2 text-zinc-500">
                {blockedCount} rastreadores bloqueados
              </p>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Limpar dados do Orbit? Esta ação não pode ser desfeita.",
                    )
                  ) {
                    if (
                      window.confirm(
                        "Confirmar limpeza de histórico, abas e favoritos?",
                      )
                    ) {
                      [
                        "orbit_history",
                        "orbit_chat_history",
                        "orbit_tabs",
                      ].forEach((k) => localStorage.removeItem(k));
                      setUrlHistory([]);
                      setTabs([
                        {
                          id: ORBIT_TAB_ID,
                          title: "Orbit",
                          type: "orbit-chat",
                        },
                      ]);
                    }
                  }
                }}
                className="mt-2 rounded border border-red-400 px-2 py-1 text-red-600"
              >
                Limpar dados
              </button>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">IA</h3>
              <label>
                <input
                  type="checkbox"
                  checked={settings.premium}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, premium: e.target.checked }))
                  }
                />{" "}
                💎 Imagem premium
              </label>
              <p className="mt-2 text-zinc-500">Gemini ✓ · OpenRouter ⚪</p>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Sobre</h3>
              <p>Orbit 0.1.0 · feito no Brasil 🇧🇷</p>
              <a
                className="text-zinc-900 underline dark:text-white"
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </section>
          </div>
        </aside>
      )}

      {/* Barra de favoritos (MELHORIA 1: gerenciáveis) */}
      <div className="scroll-slim flex items-center gap-4 overflow-x-auto border-b border-zinc-200 px-3 py-1.5 dark:border-white/[0.06]">
        {favorites.map((f) => (
          <div
            key={f.url}
            className="group relative flex shrink-0 items-center"
          >
            <button
              type="button"
              onClick={() => openIframeTab(f.url, f.title)}
              title={f.url}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={faviconFor(f.url)}
                alt=""
                onError={(event) => { event.currentTarget.src = "/icon.svg"; }}
                className="h-4 w-4 rounded-sm"
              />
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
            <button
              type="button"
              onClick={() => editFavorite(f)}
              aria-label={`Editar ${f.title}`}
              title={`Editar ${f.title}`}
              className="absolute -right-1 bottom-0 hidden h-4 w-4 items-center justify-center rounded-full bg-zinc-400 text-[9px] leading-none text-white transition hover:bg-zinc-600 group-hover:flex dark:bg-zinc-600"
            >
              Editar
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            setShowFavForm((s) => !s);
            setEditingFavoriteUrl(null);
            setFavName("");
            setFavUrl("");
          }}
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
            {editingFavoriteUrl ? "Salvar" : "Adicionar"}
          </button>
          <button
            type="button"
            onClick={() => { setShowFavForm(false); setEditingFavoriteUrl(null); }}
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
              className={`group flex h-9 shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 text-[12.5px] transition ${
                active
                  ? "border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
                  : "border-transparent text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/[0.04]"
              }`}
            >
              {t.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={faviconFor(t.url)}
                  alt=""
                  onError={(event) => { event.currentTarget.src = "/icon.svg"; }}
                  className="h-3.5 w-3.5 shrink-0 rounded-sm"
                />
              )}
              <button
                type="button"
                onClick={() => setActiveId(t.id)}
                className="max-w-[160px] truncate"
              >
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
          className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          +
        </button>
      </div>

      {/* MODO FANTASMA — banner no topo */}
      {ghostMode && (
        <div className="border-b border-white/10 bg-zinc-900 px-4 py-1.5 text-center text-[12.5px] font-medium text-zinc-300">
          👻 Modo Fantasma — nada fica salvo.
        </div>
      )}

      {/* 🛡️ Tarefa 6 — badge da aba ativa em domínio não verificado */}
      {activeTab?.unverified && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1 text-center text-[12px] font-medium text-amber-700 dark:text-amber-300">
          🛡️ não verificado — confira sempre o endereço dentro do site aberto
        </div>
      )}

      {/* Conteúdo da aba ativa */}
      <div className="min-h-0 flex-1 overflow-hidden">{renderContent()}</div>

      {/* 🛡️ Tarefa 7 — toast de bloqueio de tracker */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full border px-5 py-2.5 text-[13px] font-semibold shadow-2xl ${
            toast.startsWith("⚠️ Modelo")
              ? "border-amber-500/50 bg-[#2a1d08] text-amber-200"
              : "border-emerald-500/40 bg-[#0d1f16] text-emerald-300"
          }`}
        >
          {toast}
        </div>
      )}
    </section>
  );
}
