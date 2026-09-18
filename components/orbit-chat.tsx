"use client";

import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import Logo from "./logo";
import {
  ORBIT_MODEL_EVENT,
  chatSelectionFromModel,
  orbitModelFamily,
  readOrbitModel,
  setOrbitModel,
} from "@/lib/orbit-model";
import {
  clearHistory as clearStoredHistory,
  loadHistory,
  saveHistory,
  type Message,
} from "@/lib/chat-store";

const HISTORY_MAX = 50;

type Msg = Message;

function renderMessageText(text: string) {
  const trimmed = text.trim();
  const linkedImage = trimmed.match(
    /^\[!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)\]\((https?:\/\/[^\s)]+)\)$/i,
  );
  const image = trimmed.match(
    /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/i,
  );
  const match = linkedImage ?? image;

  if (!match) return text;

  const alt = match[1] || "Imagem gerada";
  const source = match[2];
  const href = linkedImage?.[3] ?? source;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={source}
        alt={alt}
        className="max-w-[280px] cursor-pointer rounded-2xl border border-zinc-200 transition hover:opacity-90 dark:border-white/10"
      />
    </a>
  );
}

// Boas-vindas como constante estável: usada para NÃO enviar a saudação
// como histórico da IA nem reexibi-la quando há conversa salva.
const WELCOME: Msg = {
  role: "orbit",
  text: "Olá! Eu sou o Orbit 🪐 — o navegador inteligente que une TUDO em um só lugar. Como posso ajudar?",
};

// Chips de sugestão (Tarefa 9.2) — exibidos enquanto a conversa está no início
const SUGGESTIONS: { label: string; fill: string }[] = [
  {
    label: "Anunciar produto",
    fill: "Quero anunciar um produto no Mercado Livre: ",
  },
  {
    label: "Fluxo UGC TikTok",
    fill: "Crie um roteiro de vídeo UGC para TikTok do meu produto: ",
  },
  { label: "Criar documento", fill: "Crie um documento estruturado sobre " },
  { label: "Gerar imagem", fill: "faça uma imagem de " },
  { label: "Me ensine algo", fill: "Me ensine algo interessante sobre " },
];

function getUsage(): number {
  if (typeof window === "undefined") return 0;
  const today = new Date().toDateString();
  const raw = localStorage.getItem("orbit_usage");
  if (!raw) return 0;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return 0;
    const { date, count } = data as { date?: unknown; count?: unknown };
    return date === today && typeof count === "number" && Number.isFinite(count) && count >= 0
      ? Math.floor(count)
      : 0;
  } catch {
    return 0;
  }
}

function bumpUsage(): number {
  const count = getUsage() + 1;
  localStorage.setItem(
    "orbit_usage",
    JSON.stringify({ date: new Date().toDateString(), count }),
  );
  return count;
}

function downloadDocumentPdf(content: string, request: string) {
  function sanitizePdfText(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[Ã¡Ã Ã£Ã¢Ã¤]/gi, "a")
      .replace(/[Ã©ÃªÃ«]/gi, "e")
      .replace(/[Ã­Ã¯]/gi, "i")
      .replace(/[Ã³ÃµÃ´Ã¶]/gi, "o")
      .replace(/[ÃºÃ¼]/gi, "u")
      .replace(/[Ã§]/gi, "c");
  }
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  const width = 210 - margin * 2;
  const height = 297 - margin;
  let y = 22;
  const lines = pdf.splitTextToSize(
    sanitizePdfText(content),
    width,
  ) as string[];
  for (const line of lines) {
    const isHeading =
      /^[A-ZÁÀÃÂÇÉÊÍÓÔÕÚÜ0-9][A-ZÁÀÃÂÇÉÊÍÓÔÕÚÜ0-9 .:/-]{3,}$/.test(line.trim());
    pdf.setFont("helvetica", isHeading ? "bold" : "normal");
    pdf.setFontSize(isHeading ? 14 : 11);
    if (y > height) {
      pdf.addPage();
      y = 22;
    }
    pdf.text(line, margin, y);
    y += isHeading ? 7 : 5.5;
  }
  if (y > height - 12) {
    pdf.addPage();
    y = 22;
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(130, 130, 130);
  pdf.text(
    `Gerado por Orbit 🪐 — ${new Date().toLocaleDateString("pt-BR")}`,
    margin,
    y + 4,
  );
  pdf.setTextColor(0, 0, 0);
  const slug =
    request
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "documento";
  pdf.save(`orbit-${slug}.pdf`);
}

function documentSlug(request: string) {
  return (
    request
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "documento"
  );
}

function documentHtml(content: string) {
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  return content
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "<p>&nbsp;</p>";
      if (
        /^#{1,2}\s|^[A-ZÁÀÃÂÇÉÊÍÓÔÕÚÜ0-9][A-ZÁÀÃÂÇÉÊÍÓÔÕÚÜ0-9 .:/-]{3,}$/.test(
          trimmed,
        )
      )
        return `<h2>${escape(trimmed.replace(/^#+\s*/, ""))}</h2>`;
      return `<p>${escape(line)}</p>`;
    })
    .join("\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadDocumentDocx(content: string, request: string) {
  const { AlignmentType, Document, Packer, Paragraph, TextRun } =
    await import("docx");
  const lines = content.split(/\r?\n/).map((line) => line.trim());
  const title = lines.shift() || request.trim();
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: title, bold: true, size: 32 })],
    }),
    ...lines.map(
      (line) =>
        new Paragraph({
          spacing: { after: 180 },
          children: [
            new TextRun({
              text: line,
              bold: /^[A-ZÁÀÃÂÇÉÊÍÓÔÕÚÜ0-9][A-ZÁÀÃÂÇÉÊÍÓÔÕÚÜ0-9 .:/-]{3,}$/.test(
                line,
              ),
            }),
          ],
        }),
    ),
  ];
  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  triggerDownload(blob, `orbit-${documentSlug(request)}.docx`);
}

function downloadDocumentTxt(content: string, request: string) {
  triggerDownload(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
    `orbit-${documentSlug(request)}.txt`,
  );
}

function downloadDocumentHtml(content: string, request: string) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${documentSlug(request)}</title><style>body{max-width:780px;margin:40px auto;font-family:system-ui;color:#18181b;line-height:1.6}h2{color:#4f46e5}p{white-space:pre-wrap}</style></head><body>${documentHtml(content)}</body></html>`;
  triggerDownload(
    new Blob([html], { type: "text/html;charset=utf-8" }),
    `orbit-${documentSlug(request)}.html`,
  );
}

async function removeBgLocal(dataUrl: string): Promise<string> {
  const { removeBackground } = await import("@imgly/background-removal");
  const blob = await (await fetch(dataUrl)).blob();
  const resultBlob = await removeBackground(blob, {
    output: { format: "image/png" },
  });
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(resultBlob);
  });
}

function composeOnBackground(
  pngDataUrl: string,
  bgColor: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = pngDataUrl;
  });
}

export default function OrbitChat({
  onToast,
  onOpenHub,
}: {
  onToast?: (message: string) => void;
  onOpenHub?: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  // Só persiste depois de carregar o histórico salvo (evita sobrescrever com o estado inicial)
  const [historyReady, setHistoryReady] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  // Guarda a foto do produto até o usuário escolher o estilo de vitrine
  const [pendingProduct, setPendingProduct] = useState<string | null>(null);
  // Nome do produto identificado pela visão — usado como contexto na geração da vitrine
  const [productName, setProductName] = useState<string>("");
  // Aguardando o usuário DESCREVER o produto (quando a visão falha)
  const [awaitingDesc, setAwaitingDesc] = useState(false);
  // Última foto original anexada — permite trocar o estilo localmente sem reanexar
  const [lastOriginal, setLastOriginal] = useState<string | null>(null);
  // Aviso de uso intenso (25+ consultas): mostrado UMA vez por sessão
  const [highUseDismissed, setHighUseDismissed] = useState(false);
  // Tarefa 9.1 — índice da mensagem recém-copiada (✓ por 1,5s)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  // 💎 BYOK — qualidade de imagem premium (preferência em localStorage "orbit_premium_image")
  const [premiumImage, setPremiumImage] = useState(false);
  const [enhancedImage, setEnhancedImage] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [model, setModel] = useState("");
  const skipHistorySaveRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setModel(readOrbitModel());
    function onModelChange(event: Event) {
      const value = (event as CustomEvent<string>).detail;
      setModel(typeof value === "string" ? value : "");
    }
    window.addEventListener(ORBIT_MODEL_EVENT, onModelChange);
    return () => window.removeEventListener(ORBIT_MODEL_EVENT, onModelChange);
  }, []);

  async function requestChat(message: string, history: unknown) {
    const selection = chatSelectionFromModel(model);
    const payload = {
      message,
      history,
      provider: selection.technicalProvider,
      logicalProvider: selection.logicalProvider,
      ...(model ? { model } : {}),
    };
    if (!model) {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return response.json();
    }
    try {
      const response = await fetch("/api/chat/openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) return data;
      const status = response.status || "erro";
      const detail =
        typeof data?.error === "string" ? data.error : "sem detalhe retornado";
      console.error(
        `[ORBIT] OpenRouter falhou para ${model} (HTTP ${status}): ${detail}`,
      );
      onToast?.(
        `⚠️ Modelo ${model} indisponível no momento (erro ${status}) — respondendo com Gemini como alternativa`,
      );
    } catch (error) {
      console.error(`[ORBIT] OpenRouter falhou para ${model}:`, error);
      onToast?.(
        `⚠️ Modelo ${model} indisponível no momento (erro de rede) — respondendo com Gemini como alternativa`,
      );
    }
    const fallback = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history,
        provider: "gemini",
        logicalProvider: "gemini",
      }),
    });
    const fallbackData = await fallback.json();
    return {
      ...fallbackData,
      requestedProvider: "openrouter",
      requestedModel: model,
      effectiveProvider: fallbackData.effectiveProvider ?? "gemini",
      fallbackUsed: true,
    };
  }

  async function streamChat(
    message: string,
    history: unknown,
    forceGemini = false,
  ): Promise<{
    ok: boolean;
    text: string;
    warning?: string;
    fallback?: boolean;
    requestedProvider?: string;
    effectiveProvider?: string;
    requestedModel?: string;
    effectiveModel?: string;
    fallbackUsed?: boolean;
  }> {
    const useOpenRouter = Boolean(model) && !forceGemini;
    const requestedModel = model;
    const requestedSelection = chatSelectionFromModel(useOpenRouter ? model : "");
    const originFromHeaders = (response: Response) => ({
      requestedProvider: response.headers.get("X-Orbit-Requested-Provider") ?? requestedSelection.technicalProvider,
      effectiveProvider: response.headers.get("X-Orbit-Effective-Provider") ?? requestedSelection.technicalProvider,
      requestedModel: response.headers.get("X-Orbit-Requested-Model") ?? requestedModel,
      effectiveModel: response.headers.get("X-Orbit-Effective-Model") ?? requestedModel,
      fallbackUsed: response.headers.get("X-Orbit-Fallback-Used") === "true",
    });
    async function tryOpenRouterFallback(): Promise<{
      ok: boolean;
      text: string;
      requestedProvider?: string;
      effectiveProvider?: string;
      requestedModel?: string;
      effectiveModel?: string;
      fallbackUsed?: boolean;
    }> {
      try {
        const response = await fetch("/api/chat/openrouter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history,
            model: requestedModel,
            provider: "openrouter",
            logicalProvider: requestedSelection.logicalProvider,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          reply?: string;
          requestedProvider?: string;
          effectiveProvider?: string;
          requestedModel?: string;
          effectiveModel?: string;
          fallbackUsed?: boolean;
        };
        if (response.ok && typeof data.reply === "string" && data.reply) {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "orbit") last.text = data.reply!;
            return next;
          });
          return {
            ok: true,
            text: data.reply,
            requestedProvider: data.requestedProvider ?? "openrouter",
            effectiveProvider: data.effectiveProvider ?? "openrouter",
            requestedModel: data.requestedModel ?? requestedModel,
            effectiveModel: data.effectiveModel ?? requestedModel,
            fallbackUsed: data.fallbackUsed === true,
          };
        }
      } catch {}
      return { ok: false, text: "" };
    }
    const payload = {
      message,
      history,
      stream: true,
      provider: requestedSelection.technicalProvider,
      logicalProvider: requestedSelection.logicalProvider,
      ...(useOpenRouter ? { model } : {}),
    };
    const endpoint = useOpenRouter ? "/api/chat/openrouter" : "/api/chat";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        await response.json().catch(() => ({}));
        if (useOpenRouter) {
          const alternate = await tryOpenRouterFallback();
          if (alternate.ok) return { ...alternate, fallback: alternate.fallbackUsed === true };
          setOrbitModel("");
          setModel("");
          const fallback = await streamChat(message, history, true);
          return fallback.ok
            ? {
                ...fallback,
                fallback: true,
                requestedProvider: "openrouter",
                requestedModel,
                fallbackUsed: true,
              }
            : fallback;
        }
        return { ok: false, text: "", warning: "Não consegui conectar ao Gemini agora." };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      let sawContent = false;

      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split(/\r?\n\r?\n/);
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split(/\r?\n/);
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload) as {
                  choices?: Array<{ delta?: { content?: string | null } }>;
                  candidates?: Array<{
                    content?: { parts?: Array<{ text?: string } | null> };
                  }>;
                };

                const openrouterText = json.choices?.[0]?.delta?.content;
                if (typeof openrouterText === "string") {
                  text += openrouterText;
                  sawContent = true;
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last && last.role === "orbit") {
                      last.text = text;
                    }
                    return next;
                  });
                  continue;
                }

                const geminiText =
                  json.candidates
                    ?.flatMap((candidate) => candidate.content?.parts ?? [])
                    .map((part) => part?.text ?? "")
                    .join("") ?? "";
                if (geminiText) {
                  text += geminiText;
                  sawContent = true;
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last && last.role === "orbit") {
                      last.text = text;
                    }
                    return next;
                  });
                }
              } catch {
                // Ignora payload parcial de SSE que ainda não terminou de chegar.
              }
            }
          }
        }

        if (done) break;
      }

      const finalTail = buffer.trim();
      if (finalTail) {
        const lines = finalTail.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string | null } }>;
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string } | null> };
              }>;
            };
            const openrouterText = json.choices?.[0]?.delta?.content;
            if (typeof openrouterText === "string") {
              text += openrouterText;
              sawContent = true;
            }
            const geminiText =
              json.candidates
                ?.flatMap((candidate) => candidate.content?.parts ?? [])
                .map((part) => part?.text ?? "")
                .join("") ?? "";
            if (geminiText) {
              text += geminiText;
              sawContent = true;
            }
          } catch {
            // Ignora payload final incompleto.
          }
        }
      }

      if (text) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "orbit") {
            last.text = text;
          }
          return next;
        });
      }

      if (!sawContent) {
        if (useOpenRouter) {
          const alternate = await tryOpenRouterFallback();
          if (alternate.ok) return { ...alternate, fallback: alternate.fallbackUsed === true };
          setOrbitModel("");
          setModel("");
          const fallback = await streamChat(message, history, true);
          return fallback.ok
            ? {
                ...fallback,
                fallback: true,
                requestedProvider: "openrouter",
                requestedModel,
                fallbackUsed: true,
              }
            : fallback;
        }
        return {
          ok: false,
          text: "",
          warning: "A resposta chegou vazia. Tente novamente.",
        };
      }

      return { ok: true, text, ...originFromHeaders(response) };
    } catch (error) {
      console.error("[ORBIT] Stream falhou:", error);
      if (useOpenRouter) {
        const alternate = await tryOpenRouterFallback();
        if (alternate.ok) return { ...alternate, fallback: alternate.fallbackUsed === true };
        setOrbitModel("");
        setModel("");
        const fallback = await streamChat(message, history, true);
        return fallback.ok
          ? {
              ...fallback,
              fallback: true,
              requestedProvider: "openrouter",
              requestedModel,
              fallbackUsed: true,
            }
          : fallback;
      }
      return {
        ok: false,
        text: "",
        warning:
          "A resposta foi interrompida antes de terminar. Tente novamente.",
      };
    }
  }

  // Carrega a preferência premium ao montar
  useEffect(() => {
    try {
      setPremiumImage(localStorage.getItem("orbit_premium_image") === "true");
      setEnhancedImage(localStorage.getItem("orbit_img_quality") !== "false");
    } catch {}
  }, []);

  function togglePremiumImage() {
    setPremiumImage((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("orbit_premium_image", String(next));
      } catch {}
      return next;
    });
  }

  function toggleImageQuality() {
    setEnhancedImage((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("orbit_img_quality", String(next));
      } catch {}
      return next;
    });
  }
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUsed(getUsage());
  }, []);

  // Tarefa 3.1 — carrega o histórico sem bloquear a saudação inicial
  useEffect(() => {
    let cancelled = false;
    void loadHistory().then((history) => {
      if (cancelled) return;
      // Tarefa 9.4 — histórico com a boas-vindas antiga é descartado.
      const hasOldWelcome = history.some(
        (m) =>
          m.role === "orbit" &&
          typeof m.text === "string" &&
          m.text.includes("Anexe a foto de um produto para gerar"),
      );
      if (!hasOldWelcome && history.length > 0)
        setMessages(history.slice(-HISTORY_MAX));
      setHistoryReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tarefa 3.1 — persiste a cada mudança (máx 50 mensagens)
  useEffect(() => {
    if (!historyReady) return;
    if (skipHistorySaveRef.current) {
      skipHistorySaveRef.current = false;
      return;
    }
    void saveHistory(messages);
  }, [messages, historyReady]);

  // Tarefa 3.2 — limpa o histórico com confirmação
  function clearHistory(skipConfirm = false) {
    if (!skipConfirm && !window.confirm("Limpar todo o histórico da conversa?"))
      return;
    skipHistorySaveRef.current = true;
    setMessages([WELCOME]);
    void clearStoredHistory();
  }

  // Tarefa 9.1 — copia a resposta do Orbit para a área de transferência (✓ 1,5s)
  function copyMessage(i: number, text: string) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopiedIdx(i);
        window.setTimeout(
          () => setCopiedIdx((cur) => (cur === i ? null : cur)),
          1500,
        );
      })
      .catch(() => {});
  }

  // Tarefa 9.3 — exporta a conversa como .txt (VOCÊ:/ORBIT: + data)
  function exportConversation() {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    const lines = messages.map(
      (m) =>
        `${m.role === "user" ? "VOCÊ" : "ORBIT"}: ${m.text}${m.image ? "\n(imagem anexada no chat)" : ""}`,
    );
    const content = `Conversa com o Orbit — ${now.toLocaleString("pt-BR")}\n\n${lines.join("\n\n")}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orbit-conversa-${iso}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    boxRef.current?.scrollTo({
      top: boxRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  // FIM DO LIMITE RÍGIDO: nunca negamos uma mensagem. O contador é apenas
  // informativo ("consultas hoje: X") e avisa sobre dias de pico.

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Gera a imagem de vitrine chamando /api/image (com contexto do produto)
  async function generateShowcase(
    dataUrl: string,
    style: string,
    productContext: string,
  ) {
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: dataUrl.split(",")[1],
        mimeType: dataUrl.slice(5, dataUrl.indexOf(";")),
        style,
        productContext,
      }),
    });
    return res.json();
  }

  // Análise + anúncio com a FOTO ORIGINAL (via /api/vision)
  async function analyzeAndAnnounce(dataUrl: string, prompt: string) {
    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: dataUrl.split(",")[1],
        mimeType: dataUrl.slice(5, dataUrl.indexOf(";")),
        prompt,
      }),
    });
    return res.json();
  }

  // Detecta a escolha do estilo aceitando número ou nome por extenso
  function detectStyle(text: string): string | null {
    const t = text.toLowerCase().trim();
    const terminalStyle = t.match(/,\s*([123])\s*$/);
    if (terminalStyle) return terminalStyle[1];
    const styleMap: [RegExp, string][] = [
      [/^(1|fundo branco|branco)/, "1"],
      [/^(2|fundo transparente|transparente|png)/, "2"],
      [/^(3|cen[aá]rio|profissional)/, "3"],
      [/,\s*(1|2|3)\s*$/, "1"], // "capacete de moto preto, 1" → pega o número no final
    ];
    const match = styleMap.find(([re]) => re.test(t));
    if (match) return match[1];
    // "capacete de moto preto, fundo branco" → estilo no final
    if (/fundo branco|branco/i.test(t)) return "1";
    if (/transparente|png/i.test(t)) return "2";
    if (/cen[aá]rio/i.test(t)) return "3";
    return null;
  }

  // Remove do texto as palavras de estilo — sobra a descrição do produto
  function stripStyle(text: string): string {
    return text
      .replace(/\b(1|2|3)\b/g, " ")
      .replace(
        /fundo branco|fundo transparente|transparente|branco|cen[aá]rio|profissional|png/gi,
        " ",
      )
      .replace(/[,.:;\-–]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    let text = input.trim();
    if ((!text && !image) || loading) return;

    // 💎 /config → abre as configurações do chat (inclui "Qualidade de imagem")
    if (text === "/config") {
      setMessages((m) => [
        ...m,
        { role: "user", text },
        {
          role: "orbit",
          text: "⚙️ Configurações abertas acima. Toque no interruptor 💎 para alternar a qualidade das imagens geradas por texto.",
        },
      ]);
      setInput("");
      setShowSettings(true);
      return;
    }

    const commandMatch = text.match(/^(\/\S+)(?:\s+([\s\S]*))?$/);
    const command = commandMatch?.[1].toLowerCase();
    const commandArgument = commandMatch?.[2]?.trim() ?? "";

    if (command === "/ajuda") {
      setMessages((m) => [
        ...m,
        { role: "user", text },
        {
          role: "orbit",
          text: "🧭 Comandos do Orbit:\n\n/ajuda — mostra esta ajuda\n/ia — verifica as IAs conectadas\n/limpar — limpa a conversa sem confirmação\n/pdf [tema] — gera um documento PDF sobre o tema\n/anuncio [produto] — ativa o Modo Vendedor\n/config — abre as configurações\n\nPrefixos da barra:\nyt: busca no YouTube\nw: busca na Wikipédia\nm: busca no Mercado Livre\ns: busca na Shopee\ng: busca no Google",
        },
      ]);
      setInput("");
      return;
    }

    if (command === "/ia") {
      setMessages((m) => [...m, { role: "user", text }]);
      setInput("");
      setLoading(true);
      try {
        const [aiStatusResponse, imageProvidersResponse] = await Promise.all([
          fetch("/api/status/ai"),
          fetch("/api/image/providers"),
        ]);
        const aiStatusData = (await aiStatusResponse.json()) as {
          gemini?: { configured?: boolean };
          openrouter?: { configured?: boolean };
        };
        const imageProvidersData = (await imageProvidersResponse.json()) as {
          providers?: { id?: string; configured?: boolean }[];
        };
        const openAi = imageProvidersData.providers?.find(
          (provider) => provider.id === "openai",
        );
        setMessages((m) => [
          ...m,
          {
            role: "orbit",
            text: `🤖 IAs conectadas:\n\nGemini ${aiStatusData.gemini?.configured ? "✅ conectado" : "⚪ não configurado"}\nOpenRouter ${aiStatusData.openrouter?.configured ? "✅ conectado" : "⚪ não configurado"}\nPollinations ✅\nGPT-Image ${openAi?.configured ? "✅" : "⚪ não configurado"}\n\n🧠 Dica: abra o Hub de Inteligências para explorar os modelos disponíveis.`,
          },
        ]);
      } catch {
        setMessages((m) => [
          ...m,
          {
            role: "orbit",
            text: "🤖 Não foi possível consultar os status das IAs agora. Pollinations continua disponível.\n\n🧠 Abra o Hub de Inteligências para explorar os modelos disponíveis.",
          },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (command === "/limpar") {
      clearHistory(true);
      skipHistorySaveRef.current = false;
      setMessages([
        WELCOME,
        { role: "orbit", text: "🧹 Conversa limpa localmente." },
      ]);
      setInput("");
      return;
    }

    if (command === "/pdf") {
      if (!commandArgument) {
        setMessages((m) => [
          ...m,
          { role: "user", text },
          { role: "orbit", text: "📄 Qual tema devo transformar em PDF?" },
        ]);
        setInput("");
        return;
      }
      text = `Crie um documento em PDF sobre ${commandArgument}`;
    }

    if (command === "/anuncio") {
      if (!commandArgument) {
        setMessages((m) => [
          ...m,
          { role: "user", text },
          { role: "orbit", text: "📣 Qual produto você quer anunciar?" },
        ]);
        setInput("");
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "user", text },
        { role: "orbit", text: "📣 Modo Vendedor ativado" },
      ]);
      text = `anuncie o produto: ${commandArgument}`;
    }

    if (
      command?.startsWith("/") &&
      command !== "/pdf" &&
      command !== "/anuncio"
    ) {
      setMessages((m) => [
        ...m,
        { role: "user", text },
        {
          role: "orbit",
          text: `🤔 Comando "${command}" não reconhecido. Digite /ajuda`,
        },
      ]);
      setInput("");
      return;
    }

    const docTrigger =
      /(curr[ií]culo|declarac[aã]o|relat[óo]rio|contrato|recibo|certid[ãa]o|or[çc]amento|cronograma|atestado|carta|of[ií]cio|procura[cç][aã]o)/i;
    const wantsFile =
      /(pdf|word|arquivo|documento|gerar|crie|fa[çc]a|monte|envie)/i;
    const wantsWord =
      /\b(word|docx|doc)\b/i.test(text) ||
      !/\b(pdf|html|txt|texto simples)\b/i.test(text);
    const wantsHtml = /\bhtml\b/i.test(text);
    const wantsTxt = /\b(txt|texto simples)\b/i.test(text);
    const wantsPdf = /\bpdf\b/i.test(text);
    if ((docTrigger.test(text) || command === "/pdf") && wantsFile.test(text)) {
      setMessages((m) => [
        ...m,
        { role: "user", text },
        { role: "orbit", text: "📝 Gerando seu documento..." },
      ]);
      setInput("");
      setLoading(true);
      try {
        const data = await requestChat(
          `Gere o conteúdo completo de ${text}. Responda apenas JSON válido no formato {"titulo":"TÍTULO","paragrafos":["parágrafo 1","Nome: ____________"]}. Inclua campos em branco para preenchimento manual quando fizer sentido. Português do Brasil.`,
          [],
        );
        const rawReply = typeof data.reply === "string" ? data.reply : "";
        const jsonStart = rawReply.indexOf("{");
        const jsonEnd = rawReply.lastIndexOf("}");
        let documentContent = rawReply;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          try {
            const parsed = JSON.parse(
              rawReply.slice(jsonStart, jsonEnd + 1),
            ) as { titulo?: unknown; paragrafos?: unknown };
            const paragraphs = Array.isArray(parsed.paragrafos)
              ? parsed.paragrafos.filter(
                  (item): item is string =>
                    typeof item === "string" && item.trim().length > 0,
                )
              : [];
            if (paragraphs.length > 0)
              documentContent = [
                typeof parsed.titulo === "string" ? parsed.titulo : text,
                ...paragraphs,
              ].join("\n\n");
          } catch {}
        }
        if (documentContent.trim().length >= 50) {
          if (wantsWord) await downloadDocumentDocx(documentContent, text);
          else if (wantsHtml) downloadDocumentHtml(documentContent, text);
          else if (wantsTxt) downloadDocumentTxt(documentContent, text);
          else if (wantsPdf) downloadDocumentPdf(documentContent, text);
          setMessages((m) => [
            ...m,
            {
              role: "orbit",
              text: "✅ Documento pronto! Baixe no formato que quiser:",
              document: { content: documentContent, request: text },
            },
          ]);
        } else {
          setMessages((m) => [
            ...m,
            {
              role: "orbit",
              text:
                data.error ??
                "Não consegui gerar o documento agora. Tente novamente.",
            },
          ]);
        }
      } catch {
        setMessages((m) => [
          ...m,
          { role: "orbit", text: "Falha de conexão ao gerar o documento." },
        ]);
      } finally {
        setUsed(bumpUsage());
        setLoading(false);
      }
      return;
    }

    // ── FLUXO 0: geração de imagem por TEXTO ("faça/gere/crie/desenhe uma imagem/foto de X") ──
    const imgCmd = text.match(
      /^(?:(?:fa[çc]a|gere|crie|desenhe)\s+(?:uma\s+|um\s+)?(?:imagem|foto)|(?:(?:me\s+)?(?:envie|envia|mande|manda|mostre|mostra)|(?:pode\s+)?(?:me\s+)?(?:enviar|mandar|mostrar))\s+(?:uma\s+|um\s+)?(?:imagem|foto))(?:\s+(?:de|do|da|sobre|com))?\s+/i,
    );
    const directProductCmd =
      /^(quero|preciso|me mostre|mostre|crie|fa[çc]a)\s+(uma?\s+)?(camiseta|camisa|tenis|t[êe]nis|bone|b[óo]ne|colar|anel|brinco|capacete|cal[çc]a|shorts|moletom|vestido|saia|bolsa|mochila|relogio|rel[óo]gio|fone|celular|notebook)/i.test(
        text,
      );
    if ((imgCmd || directProductCmd) && !image) {
      const theme = imgCmd
        ? text.slice(imgCmd[0].length).trim() || "algo surpreendente"
        : text;
      setMessages((m) => [...m, { role: "user", text }]);
      setInput("");
      setLoading(true);
      setMessages((m) => [
        ...m,
        {
          role: "orbit",
          text: premiumImage
            ? "💎 Gerando sua imagem em qualidade premium…"
            : "🎨 Gerando sua imagem…",
        },
      ]);
      try {
        const family = orbitModelFamily(model);
        const endpoint = family === "gemini" ? "/api/image" : "/api/text-image";
        const body =
          family === "gemini"
            ? { prompt: theme }
            : {
                prompt: theme,
                premium: family === "openai" || premiumImage,
                forcePollinations: family === "textonly",
                enhanced: enhancedImage,
              };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.imageDataUrl) {
          const label =
            data.provider === "openai"
              ? "💎 GPT-Image"
              : "🌸 Pollinations (grátis)";
          setMessages((m) => [
            ...m,
            ...(family === "textonly"
              ? [
                  {
                    role: "orbit" as const,
                    text: `ℹ️ ${model} é um modelo de texto e não gera imagens nativamente. O Orbit usou o motor padrão Pollinations/FLUX.`,
                  },
                ]
              : []),
            ...(data.notice
              ? [{ role: "orbit" as const, text: data.notice }]
              : []),
            {
              role: "orbit",
              text: directProductCmd
                ? "🎨 Aqui está! Quer variação? Diga o que mudar."
                : `🎨 Aqui está sua imagem de ${theme}! (${label}) Clique nela para baixar.`,
              image: data.imageDataUrl,
            },
          ]);
        } else {
          setMessages((m) => [
            ...m,
            ...(data.notice
              ? [{ role: "orbit" as const, text: data.notice }]
              : []),
            {
              role: "orbit",
              text:
                data.error ??
                "Não consegui gerar a imagem agora. Tente novamente.",
            },
          ]);
        }
      } catch {
        setMessages((m) => [
          ...m,
          { role: "orbit", text: "Falha de conexão ao gerar a imagem." },
        ]);
      } finally {
        setUsed(bumpUsage());
        setLoading(false);
      }
      return;
    }

    // ── FLUXO 1: existe produto pendente (ou foto original anterior) e o usuário escolheu o estilo ──
    if ((pendingProduct || lastOriginal) && text) {
      const choice = detectStyle(text) ?? "1";
      if (choice) {
        const labels: Record<string, string> = {
          "1": "fundo branco",
          "2": "fundo transparente",
          "3": "cenário profissional",
        };
        setMessages((m) => [...m, { role: "user", text }]);
        setInput("");
        setLoading(true);
        const product = pendingProduct;
        if (product) setLastOriginal(product);
        setPendingProduct(null);

        // ── TROCA DE ESTILO LOCAL: reprocessa a ÚLTIMA foto original, sem reanexar e sem IA ──
        if (!product && lastOriginal && (choice === "1" || choice === "2")) {
          try {
            const transparent = await removeBgLocal(lastOriginal);
            const final =
              choice === "1"
                ? await composeOnBackground(transparent, "#FFFFFF")
                : transparent;
            setMessages((m) => [
              ...m,
              {
                role: "orbit",
                text: "Estilo atualizado usando a SUA foto original.",
                image: final,
              },
            ]);
          } catch {
            setMessages((m) => [
              ...m,
              {
                role: "orbit",
                text: "Falha ao remover o fundo localmente. Tente novamente.",
              },
            ]);
          }
          setUsed(bumpUsage());
          setLoading(false);
          return;
        }

        // Sem foto em mãos (ex.: estilo 3 em clique repetido) → pede para anexar novamente
        if (!product) {
          try {
            setMessages((m) => [
              ...m,
              {
                role: "orbit",
                text: "Para o cenário profissional eu preciso processar a foto com IA — anexe a foto do produto novamente, por favor.",
              },
            ]);
          } catch {
            setMessages((m) => [
              ...m,
              {
                role: "orbit",
                text: "Não foi possível continuar com o produto selecionado.",
              },
            ]);
          } finally {
            setLoading(false);
          }
          return;
        }

        // ── ATALHO LOCAL: estilos 1 e 2 não precisam de IA — remove o fundo da FOTO REAL ──
        if (choice === "1" || choice === "2") {
          try {
            setMessages((m) => [
              ...m,
              {
                role: "orbit",
                text: "Removendo o fundo da sua foto… (o primeiro processamento baixa um modelo e pode demorar ~1 min; os próximos são rápidos)",
              },
            ]);

            const transparent = await removeBgLocal(product);
            const final =
              choice === "1"
                ? await composeOnBackground(transparent, "#FFFFFF")
                : transparent;

            setMessages((m) => [
              ...m,
              {
                role: "orbit",
                text:
                  choice === "1"
                    ? "Fundo branco aplicado — diga 'transparente' ou 'cenário' para mudar."
                    : "Fundo removido (PNG transparente). Baixe clicando nela. Quer o anúncio completo (títulos, descrição, preço)?",
                image: final,
              },
            ]);
          } catch {
            setMessages((m) => [
              ...m,
              {
                role: "orbit",
                text: "Falha ao remover o fundo localmente. Tente novamente.",
              },
            ]);
          }
          setUsed(bumpUsage());
          setLoading(false);
          return;
        }

        // Contexto efetivo: começa com o nome identificado pela visão
        let effectiveContext = productName;

        // Se estávamos aguardando a descrição do usuário, extrai ela do texto
        // e atribui a effectiveContext IMEDIATAMENTE (o estado só atualiza no próximo render)
        if (awaitingDesc) {
          const descOnly = stripStyle(text);
          if (descOnly.length > 3) {
            effectiveContext = descOnly;
            setProductName(descOnly);
            console.log("📝 Produto descrito pelo usuário:", descOnly);
          }
          setAwaitingDesc(false);
        }

        // Sem contexto nenhum → re-pergunta a descrição (não gera imagem genérica)
        if (!effectiveContext) {
          setMessages((m) => [
            ...m,
            {
              role: "orbit",
              text: `Ainda não sei qual é o produto da foto. Me descreva ele junto com o estilo.\n\nEx.: "capacete de moto preto fosco, fundo branco"\nou "tênis nike branco, 1"`,
            },
          ]);
          setPendingProduct(product);
          setAwaitingDesc(true);
          setLoading(false);
          return;
        }

        try {
          console.log(
            "🔍 ENVIANDO productContext:",
            effectiveContext.slice(0, 120),
          );

          const data = await generateShowcase(
            product,
            choice,
            effectiveContext,
          );
          if (data.imageDataUrl) {
            setMessages((m) => [
              ...m,
              {
                role: "orbit",
                text: "Imagem de vitrine pronta. Baixe clicando nela. Quer que eu monte o anúncio completo (títulos, descrição, preço) com este produto?",
                image: data.imageDataUrl,
              },
            ]);
          } else {
            setMessages((m) => [
              ...m,
              {
                role: "orbit",
                text:
                  data.error ?? "Não consegui gerar a imagem. Tente novamente.",
              },
            ]);
          }
        } catch {
          setMessages((m) => [
            ...m,
            { role: "orbit", text: "Falha de conexão ao gerar a imagem." },
          ]);
        }
        setUsed(bumpUsage());
        setLoading(false);
        return;
      }
      // não reconheceu o estilo → cancela o fluxo e segue como conversa normal
      setPendingProduct(null);
      setAwaitingDesc(false);
    }

    // FLUXO 2 revisado: a primeira vitrine é sempre entregue imediatamente.
    if (image) {
      setMessages((m) => [
        ...m,
        { role: "user", text: `${text || "produto"} 📎 [imagem anexada]` },
      ]);
      setInput("");
      setLoading(true);
      const dataUrl = image;
      setImage(null);
      try {
        let identified = "";
        try {
          const analysis = await analyzeAndAnnounce(
            dataUrl,
            "Que produto é este? Responda em uma frase curta.",
          );
          identified = (analysis.reply ?? "").trim();
        } catch {
          identified = "";
        }
        if (
          !identified ||
          identified.length < 3 ||
          /ocupada|indisponível/i.test(identified)
        )
          identified = stripStyle(text) || "produto";
        const style = detectStyle(text) ?? "1";
        setProductName(identified);
        setAwaitingDesc(false);
        setPendingProduct(dataUrl);
        setLastOriginal(dataUrl);
        if (style === "3") {
          const showcase = await generateShowcase(dataUrl, "3", identified);
          if (!showcase.imageDataUrl)
            throw new Error(showcase.error ?? "Falha ao gerar cenário");
          setMessages((m) => [
            ...m,
            {
              role: "orbit",
              text: "✅ Vitrine pronta com cenário! Baixe clicando. Quer fundo branco (diga '1') ou transparente (diga '2')?",
              image: showcase.imageDataUrl,
            },
          ]);
        } else {
          const transparent = await removeBgLocal(dataUrl);
          const final =
            style === "2"
              ? transparent
              : await composeOnBackground(transparent, "#FFFFFF");
          setMessages((m) => [
            ...m,
            {
              role: "orbit",
              text:
                style === "2"
                  ? "✅ Vitrine pronta com fundo transparente! Baixe clicando. Quer fundo branco (diga '1') ou cenário (diga '3')?"
                  : "✅ Vitrine pronta com fundo branco! Baixe clicando. Quer fundo transparente (diga '2') ou cenário (diga '3')?",
              image: final,
            },
          ]);
        }
      } catch {
        setMessages((m) => [
          ...m,
          {
            role: "orbit",
            text: "Não consegui processar a foto agora. Tente novamente em instantes.",
          },
        ]);
      } finally {
        setUsed(bumpUsage());
        setLoading(false);
      }
      return;
    }

    // ── FLUXO 2 legado (mantido como fallback de compatibilidade) ──
    if (image) {
      setMessages((m) => [
        ...m,
        { role: "user", text: `${text || "produto"} 📎 [imagem anexada]` },
      ]);
      setInput("");
      setLoading(true);
      const dataUrl = image;
      setImage(null);

      const askStyle = `Qual estilo de imagem de vitrine você quer?\n\n1 — Fundo branco (padrão marketplace)\n2 — Fundo transparente (PNG)\n3 — Cenário profissional\n\nResponda com 1, 2, 3 — ou escreva: fundo branco, transparente ou cenário.`;

      try {
        const analysis = await analyzeAndAnnounce(
          dataUrl,
          "Que produto é este? Responda em uma frase curta.",
        );
        const identified = (analysis.reply ?? "").trim();

        if (
          identified.length > 3 &&
          !identified.includes("ocupada") &&
          !identified.includes("indisponível")
        ) {
          // ✅ Visão funcionou
          setProductName(identified);
          setAwaitingDesc(false);
          setMessages((m) => [
            ...m,
            {
              role: "orbit",
              text: `Identifiquei: ${identified}\n\n${askStyle}`,
            },
          ]);
        } else {
          // ⚠️ Visão indisponível → pergunta ao usuário (fluxo sempre vivo!)
          setProductName("");
          setAwaitingDesc(true);
          setMessages((m) => [
            ...m,
            {
              role: "orbit",
              text: `Não consegui analisar a foto agora (IA com alta demanda). Sem problema — me descreva o produto junto com o estilo.\n\nEx.: "capacete de moto preto fosco, fundo branco"\nou "tênis nike branco, 1"\n\n${askStyle}`,
            },
          ]);
        }
        setPendingProduct(dataUrl);
      } catch {
        // ❌ Erro de rede → mesmo fallback
        setProductName("");
        setAwaitingDesc(true);
        setMessages((m) => [
          ...m,
          {
            role: "orbit",
            text: `Falha ao analisar a foto (IA com alta demanda). Sem problema — me descreva o produto junto com o estilo.\n\nEx.: "capacete de moto preto fosco, fundo branco"\n\n${askStyle}`,
          },
        ]);
        setPendingProduct(dataUrl);
      }
      setUsed(bumpUsage());
      setLoading(false);
      return;
    }

    // ── FLUXO 3: conversa normal / Modo Vendedor por texto ──
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);

    const history = messages
      .filter((m) => m !== WELCOME)
      .map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));

    setMessages((m) => [...m, { role: "orbit", text: "" }]);

    try {
      const result = await streamChat(text, history);
      if (!result.ok) {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === "orbit") {
            last.text = result.warning ?? "Não consegui responder agora.";
            last.retry = true;
          }
          return next;
        });
      } else if (result.fallback) {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === "orbit") {
            const provider = result.effectiveProvider === "gemini" ? "Gemini" : "OpenRouter";
            const model = result.effectiveModel ?? "alternativo";
            last.text += `\n\n(respondido via ${provider} — modelo ${model})`;
          }
          return next;
        });
      }
    } catch {
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === "orbit") {
          last.text = "Não consegui responder agora.";
          last.retry = true;
        }
        return next;
      });
    } finally {
      setUsed(bumpUsage());
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-h-[640px] w-full max-w-2xl flex-col border border-zinc-200 bg-white shadow-[0_30px_60px_-25px_rgba(0,0,0,0.15)] dark:border-white/10 dark:bg-[#0E0E11] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <Logo size={16} />
          <span className="font-display text-[13px] font-medium tracking-wide text-zinc-700 dark:text-zinc-300">
            Orbit
          </span>
          <span className="ml-1 flex items-center gap-1.5 text-[11px] tracking-wide text-zinc-400 dark:text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
            ao vivo
          </span>
          {model && (
            <>
              <span className="max-w-[180px] truncate rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                🧠 {model}
              </span>
              <button
                type="button"
                onClick={() => setOrbitModel("")}
                aria-label="Voltar para Gemini nativo"
                title="Voltar para Gemini nativo"
                className="flex h-6 w-6 items-center justify-center rounded text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                ↺
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onOpenHub && (
            <button
              type="button"
              onClick={onOpenHub}
              className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-300"
              title="Abrir Hub de Inteligências"
            >
              🧠 Inteligências
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            aria-expanded={showSettings}
            aria-label="Configurações do chat"
            title="Configurações (/config)"
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm transition ${
              showSettings
                ? "bg-zinc-100 text-zinc-900 dark:bg-white/10 dark:text-white"
                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
            }`}
          >
            ⚙️
          </button>
          <button
            type="button"
            onClick={exportConversation}
            aria-label="Exportar conversa"
            title="Exportar conversa (.txt)"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            💾
          </button>
          <button
            type="button"
            onClick={() => clearHistory()}
            aria-label="Limpar histórico"
            title="Limpar histórico do chat"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            🗑️
          </button>
          <span className="text-[11px] tracking-wide text-zinc-400 dark:text-zinc-600">
            consultas hoje: {used}
          </span>
          {used >= 15 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:border-amber-400/25 dark:text-amber-400">
              ⏳ alto uso hoje
            </span>
          )}
        </div>
      </div>

      {/* ⚙️ Configurações do chat (abre pelo botão ⚙️ ou comando /config) */}
      {showSettings && (
        <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">
            Configurações
          </p>
          {/* 💎 Qualidade de imagem */}
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
                💎 Qualidade de imagem — Usar API OpenAI (sua chave)
              </p>
              <p className="text-[11.5px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                Com OPENAI_API_KEY no servidor, GPT-Image é o motor padrão das
                imagens. Sem ela, usamos o gerador gratuito.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={premiumImage}
              onClick={togglePremiumImage}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                premiumImage ? "bg-violet-600" : "bg-zinc-300 dark:bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  premiumImage ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">🎨 Qualidade cinematográfica</p>
              <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500">Prompt aprimorado localmente, sem custo de IA.</p>
            </div>
            <button type="button" role="switch" aria-checked={enhancedImage} onClick={toggleImageQuality} className={`relative h-6 w-11 shrink-0 rounded-full transition ${enhancedImage ? "bg-violet-600" : "bg-zinc-300 dark:bg-white/15"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enhancedImage ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      )}

      {/* Mensagens */}
      <div
        ref={boxRef}
        className="scroll-slim min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6"
      >
        {messages.map((m, i) => (
          <div key={i}>
            {m.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-xl whitespace-pre-wrap bg-zinc-900 px-4 py-2.5 text-[13.5px] leading-relaxed text-white dark:bg-white/[0.07] dark:text-zinc-100">
                  {m.text}
                </div>
              </div>
            ) : (
              <div className="flex gap-3.5">
                <div className="mt-1 w-px self-stretch bg-zinc-200 dark:bg-white/15" />
                <div className="max-w-[88%]">
                  {m.image && (
                    <a
                      href={m.image}
                      download="orbit-vitrine.png"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.image}
                        alt="Imagem de vitrine gerada"
                        className="mb-2 max-w-[280px] cursor-pointer rounded-2xl border border-zinc-200 transition hover:opacity-90 dark:border-white/10"
                      />
                    </a>
                  )}
                  {m.text && (
                    <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {renderMessageText(m.text)}
                    </div>
                  )}
                  {m.retry && (
                    <button
                      type="button"
                      onClick={() => {
                        const previous = messages[i - 1];
                        if (previous?.role !== "user") return;
                        setInput(previous.text);
                        window.setTimeout(() => inputRef.current?.form?.requestSubmit(), 0);
                      }}
                      className="mt-2 rounded-lg border border-zinc-300 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
                    >
                      Tentar de novo
                    </button>
                  )}
                  {m.document && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          downloadDocumentPdf(
                            m.document!.content,
                            m.document!.request,
                          )
                        }
                        className="rounded-xl bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500"
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadDocumentDocx(
                            m.document!.content,
                            m.document!.request,
                          )
                        }
                        className="rounded-xl border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold dark:border-white/15"
                      >
                        Word
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadDocumentHtml(
                            m.document!.content,
                            m.document!.request,
                          )
                        }
                        className="rounded-xl border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold dark:border-white/15"
                      >
                        HTML
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadDocumentTxt(
                            m.document!.content,
                            m.document!.request,
                          )
                        }
                        className="rounded-xl border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold dark:border-white/15"
                      >
                        TXT
                      </button>
                    </div>
                  )}
                  {/* Tarefa 9.1 — copiar resposta (✓ por 1,5s) */}
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => copyMessage(i, m.text)}
                      className="rounded-md px-1.5 py-0.5 text-[10.5px] text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
                    >
                      {copiedIdx === i ? "✓ copiado" : "📋 copiar"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-1.5 pl-0.5">
            <span className="dot h-1 w-1 rounded-full bg-zinc-400" />
            <span className="dot h-1 w-1 rounded-full bg-zinc-400" />
            <span className="dot h-1 w-1 rounded-full bg-zinc-400" />
          </div>
        )}
        {/* Tarefa 9.2 — chips de sugestão no início da conversa */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setInput(s.fill);
                  inputRef.current?.focus();
                }}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-600 transition hover:-translate-y-0.5 hover:border-violet-500 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-violet-400 dark:hover:text-violet-300"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {/* Uso intenso (25+ hoje): aviso informativo — UMA vez por sessão, nunca bloqueia */}
        {used >= 25 && !highUseDismissed && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12.5px] leading-relaxed text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/[0.06] dark:text-amber-300">
            <span>
              Você usa o Orbit intensivamente 🪐 — respostas podem ficar lentas
              em dias de pico. Amanhã volta ao normal.
            </span>
            <button
              type="button"
              onClick={() => setHighUseDismissed(true)}
              className="shrink-0 rounded-lg border border-amber-500/40 px-2.5 py-1 text-[11px] font-semibold transition hover:bg-amber-500/20 dark:border-amber-400/30"
            >
              Entendi
            </button>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={send}
        className="flex items-center gap-3 border-t border-zinc-200 px-4 py-3.5 dark:border-white/[0.06]"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const dataUrl = await fileToDataUrl(file);
            setImage(dataUrl);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Anexar imagem"
          title="Anexar imagem do produto"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-900 dark:border-white/15 dark:text-zinc-500 dark:hover:border-white/30 dark:hover:text-white"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        {image && (
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt="preview"
              className="h-9 w-9 rounded object-cover"
            />
            <button
              type="button"
              onClick={() => setImage(null)}
              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[9px] text-white dark:bg-white dark:text-black"
            >
              ✕
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder={
            awaitingDesc
              ? "Descreva o produto + estilo: ex.: capacete de moto preto, fundo branco"
              : pendingProduct
                ? "Responda: 1, 2, 3, fundo branco, transparente ou cenário…"
                : "Pergunte ou anexe a foto de um produto…"
          }
          className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-40 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
        <button
          type="submit"
          disabled={loading || (!input.trim() && !image)}
          aria-label="Enviar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:bg-zinc-300 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:disabled:bg-white/10 dark:disabled:text-zinc-600"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 19V5m0 0l-6 6m6-6l6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}
