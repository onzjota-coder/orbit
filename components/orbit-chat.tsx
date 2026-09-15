"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "./logo";

const HISTORY_KEY = "orbit_chat_history";
const HISTORY_MAX = 50;

type Msg = { role: "user" | "orbit"; text: string; image?: string };

// Boas-vindas como constante estável: usada para NÃO enviar a saudação
// como histórico da IA nem reexibi-la quando há conversa salva.
const WELCOME: Msg = {
  role: "orbit",
  text: "Olá! Eu sou o Orbit 🪐 — o navegador inteligente que une TUDO em um só lugar.\n\n💬 Converse e pergunte qualquer coisa\n🎨 Pça: \"faça uma imagem de X\"\n🖼️ Anexe uma foto → imagem de vitrine para marketplace\n🛒 Monto anúncios completos (Mercado Livre, Shopee)\n📄 Gero documentos e textos estruturados\n🌐 Seus sites favoritos nas abas ao lado\n⚡ Execute fluxos que automatizam rotinas\n\nDica: digite /ajuda para ver os comandos 👇",
};

// Chips de sugestão (Tarefa 9.2) — exibidos enquanto a conversa está no início
const SUGGESTIONS: { label: string; fill: string }[] = [
  { label: "📸 Anunciar produto", fill: "Quero anunciar um produto no Mercado Livre: " },
  { label: "🎬 Fluxo UGC TikTok", fill: "Crie um roteiro de vídeo UGC para TikTok do meu produto: " },
  { label: "📄 Criar documento", fill: "Crie um documento estruturado sobre " },
  { label: "🎨 Gerar imagem", fill: "faça uma imagem de " },
  { label: "💡 Me ensine algo", fill: "Me ensine algo interessante sobre " },
];

function getUsage(): number {
  if (typeof window === "undefined") return 0;
  const today = new Date().toDateString();
  const raw = localStorage.getItem("orbit_usage");
  if (!raw) return 0;
  const data = JSON.parse(raw);
  return data.date === today ? data.count : 0;
}

function bumpUsage(): number {
  const count = getUsage() + 1;
  localStorage.setItem("orbit_usage", JSON.stringify({ date: new Date().toDateString(), count }));
  return count;
}

async function removeBgLocal(dataUrl: string): Promise<string> {
  const { removeBackground } = await import("@imgly/background-removal");
  const blob = await (await fetch(dataUrl)).blob();
  const resultBlob = await removeBackground(blob, { output: { format: "image/png" } });
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(resultBlob);
  });
}

function composeOnBackground(pngDataUrl: string, bgColor: string): Promise<string> {
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

export default function OrbitChat() {
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
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carrega a preferência premium ao montar
  useEffect(() => {
    try {
      setPremiumImage(localStorage.getItem("orbit_premium_image") === "true");
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
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUsed(getUsage());
  }, []);

  // Tarefa 3.1 — ao montar, carrega o histórico salvo (o usuário volta e a conversa está lá)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Tarefa 9.4 — histórico com a boas-vindas ANTIGA → descarta e mostra a atual
          const hasOldWelcome = parsed.some(
            (m) => m.role === "orbit" && typeof m.text === "string" && m.text.includes("Anexe a foto de um produto para gerar")
          );
          // Tarefa 3.3 — histórico válido → substitui o estado (a boas-vindas não reaparece)
          if (!hasOldWelcome) setMessages(parsed.slice(-HISTORY_MAX));
        }
      }
    } catch {
      // storage corrompido → segue com a conversa nova
    }
    setHistoryReady(true);
  }, []);

  // Tarefa 3.1 — persiste a cada mudança (máx 50 mensagens)
  useEffect(() => {
    if (!historyReady) return;
    const trimmed = messages.slice(-HISTORY_MAX);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {
      // Cota cheia (imagens grandes em base64) → salva apenas o texto
      try {
        localStorage.setItem(
          HISTORY_KEY,
          JSON.stringify(trimmed.map((m) => ({ role: m.role, text: m.text })))
        );
      } catch {}
    }
  }, [messages, historyReady]);

  // Tarefa 3.2 — limpa o histórico com confirmação
  function clearHistory() {
    if (!window.confirm("Limpar todo o histórico da conversa?")) return;
    setMessages([WELCOME]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
  }

  // Tarefa 9.1 — copia a resposta do Orbit para a área de transferência (✓ 1,5s)
  function copyMessage(i: number, text: string) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopiedIdx(i);
        window.setTimeout(() => setCopiedIdx((cur) => (cur === i ? null : cur)), 1500);
      })
      .catch(() => {});
  }

  // Tarefa 9.3 — exporta a conversa como .txt (VOCÊ:/ORBIT: + data)
  function exportConversation() {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    const lines = messages.map(
      (m) => `${m.role === "user" ? "VOCÊ" : "ORBIT"}: ${m.text}${m.image ? "\n(imagem anexada no chat)" : ""}`
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
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
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
  async function generateShowcase(dataUrl: string, style: string, productContext: string) {
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
      .replace(/fundo branco|fundo transparente|transparente|branco|cen[aá]rio|profissional|png/gi, " ")
      .replace(/[,.:;\-–]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && !image) || loading) return;

    // 💎 /config → abre as configurações do chat (inclui "Qualidade de imagem")
    if (text === "/config") {
      setMessages((m) => [...m, { role: "user", text }, { role: "orbit", text: "⚙️ Configurações abertas acima. Toque no interruptor 💎 para alternar a qualidade das imagens geradas por texto." }]);
      setInput("");
      setShowSettings(true);
      return;
    }

    // ── FLUXO 0: geração de imagem por TEXTO ("faça/gere/crie/desenhe uma imagem/foto de X") ──
    const imgCmd = text.match(/^(fa[çc]a|gere|crie|desenhe)\s+(uma\s+|um\s+)?(imagem|foto)\s+/i);
    if (imgCmd) {
      const theme =
        text
          .replace(/^(fa[çc]a|gere|crie|desenhe)\s+/i, "")
          .replace(/^(uma|um|o|a)\s+/i, "")
          .replace(/^(imagem|foto)\s+/i, "")
          .replace(/^(de|do|da|sobre|com)\s+/i, "")
          .replace(/^(uma|um|o|a)\s+/i, "")
          .trim() || "algo surpreendente";
      setMessages((m) => [...m, { role: "user", text }]);
      setInput("");
      setLoading(true);
      setMessages((m) => [...m, { role: "orbit", text: premiumImage ? "💎 Gerando sua imagem em qualidade premium…" : "🎨 Gerando sua imagem…" }]);
      try {
        const res = await fetch("/api/text-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: theme, premium: premiumImage }),
        });
        const data = await res.json();
        if (data.imageDataUrl) {
          const label = data.provider === "openai" ? "💎 GPT-Image" : "🌸 Pollinations (grátis)";
          setMessages((m) => [
            ...m,
            ...(data.notice ? [{ role: "orbit" as const, text: data.notice }] : []),
            { role: "orbit", text: `🎨 Aqui está sua imagem de ${theme}! (${label}) Clique nela para baixar.`, image: data.imageDataUrl },
          ]);
        } else {
          setMessages((m) => [
            ...m,
            ...(data.notice ? [{ role: "orbit" as const, text: data.notice }] : []),
            { role: "orbit", text: data.error ?? "Não consegui gerar a imagem agora. Tente novamente." },
          ]);
        }
      } catch {
        setMessages((m) => [...m, { role: "orbit", text: "Falha de conexão ao gerar a imagem." }]);
      }
      setUsed(bumpUsage());
      setLoading(false);
      return;
    }

    // ── FLUXO 1: existe produto pendente (ou foto original anterior) e o usuário escolheu o estilo ──
    if ((pendingProduct || lastOriginal) && text) {
      const choice = detectStyle(text);
      if (choice) {
        const labels: Record<string, string> = { "1": "fundo branco", "2": "fundo transparente", "3": "cenário profissional" };
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
            const final = choice === "1" ? await composeOnBackground(transparent, "#FFFFFF") : transparent;
            setMessages((m) => [
              ...m,
              { role: "orbit", text: "Estilo atualizado usando a SUA foto original.", image: final },
            ]);
          } catch {
            setMessages((m) => [...m, { role: "orbit", text: "Falha ao remover o fundo localmente. Tente novamente." }]);
          }
          setUsed(bumpUsage());
          setLoading(false);
          return;
        }

        // Sem foto em mãos (ex.: estilo 3 em clique repetido) → pede para anexar novamente
        if (!product) {
          setMessages((m) => [
            ...m,
            { role: "orbit", text: "Para o cenário profissional eu preciso processar a foto com IA — anexe a foto do produto novamente, por favor." },
          ]);
          setLoading(false);
          return;
        }

        // ── ATALHO LOCAL: estilos 1 e 2 não precisam de IA — remove o fundo da FOTO REAL ──
        if (choice === "1" || choice === "2") {
          try {
            setMessages((m) => [...m, { role: "orbit", text: "Removendo o fundo da sua foto… (o primeiro processamento baixa um modelo e pode demorar ~1 min; os próximos são rápidos)" }]);

            const transparent = await removeBgLocal(product);
            const final = choice === "1"
              ? await composeOnBackground(transparent, "#FFFFFF")
              : transparent;

            setMessages((m) => [
              ...m,
              { role: "orbit", text: choice === "1"
                  ? "Fundo branco aplicado na SUA foto. Baixe clicando nela. Quer o anúncio completo (títulos, descrição, preço)?"
                  : "Fundo removido (PNG transparente). Baixe clicando nela. Quer o anúncio completo (títulos, descrição, preço)?",
                image: final },
            ]);
          } catch {
            setMessages((m) => [...m, { role: "orbit", text: "Falha ao remover o fundo localmente. Tente novamente." }]);
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
            { role: "orbit", text: `Ainda não sei qual é o produto da foto. Me descreva ele junto com o estilo.\n\nEx.: "capacete de moto preto fosco, fundo branco"\nou "tênis nike branco, 1"` },
          ]);
          setPendingProduct(product);
          setAwaitingDesc(true);
          setLoading(false);
          return;
        }

        try {
          console.log("🔍 ENVIANDO productContext:", effectiveContext.slice(0, 120));

          const data = await generateShowcase(product, choice, effectiveContext);
          if (data.imageDataUrl) {
            setMessages((m) => [
              ...m,
              { role: "orbit", text: "Imagem de vitrine pronta. Baixe clicando nela. Quer que eu monte o anúncio completo (títulos, descrição, preço) com este produto?", image: data.imageDataUrl },
            ]);
          } else {
            setMessages((m) => [...m, { role: "orbit", text: data.error ?? "Não consegui gerar a imagem. Tente novamente." }]);
          }
        } catch {
          setMessages((m) => [...m, { role: "orbit", text: "Falha de conexão ao gerar a imagem." }]);
        }
        setUsed(bumpUsage());
        setLoading(false);
        return;
      }
      // não reconheceu o estilo → cancela o fluxo e segue como conversa normal
      setPendingProduct(null);
      setAwaitingDesc(false);
    }

    // ── FLUXO 2: anexou imagem agora → analisa e pergunta o estilo ──
    if (image) {
      setMessages((m) => [...m, { role: "user", text: `${text || "produto"} 📎 [imagem anexada]` }]);
      setInput("");
      setLoading(true);
      const dataUrl = image;
      setImage(null);

      const askStyle = `Qual estilo de imagem de vitrine você quer?\n\n1 — Fundo branco (padrão marketplace)\n2 — Fundo transparente (PNG)\n3 — Cenário profissional\n\nResponda com 1, 2, 3 — ou escreva: fundo branco, transparente ou cenário.`;

      try {
        const analysis = await analyzeAndAnnounce(dataUrl, "Que produto é este? Responda em uma frase curta.");
        const identified = (analysis.reply ?? "").trim();

        if (identified.length > 3 && !identified.includes("ocupada") && !identified.includes("indisponível")) {
          // ✅ Visão funcionou
          setProductName(identified);
          setAwaitingDesc(false);
          setMessages((m) => [
            ...m,
            { role: "orbit", text: `Identifiquei: ${identified}\n\n${askStyle}` },
          ]);
        } else {
          // ⚠️ Visão indisponível → pergunta ao usuário (fluxo sempre vivo!)
          setProductName("");
          setAwaitingDesc(true);
          setMessages((m) => [
            ...m,
            { role: "orbit", text: `Não consegui analisar a foto agora (IA com alta demanda). Sem problema — me descreva o produto junto com o estilo.\n\nEx.: "capacete de moto preto fosco, fundo branco"\nou "tênis nike branco, 1"\n\n${askStyle}` },
          ]);
        }
        setPendingProduct(dataUrl);
      } catch {
        // ❌ Erro de rede → mesmo fallback
        setProductName("");
        setAwaitingDesc(true);
        setMessages((m) => [
          ...m,
          { role: "orbit", text: `Falha ao analisar a foto (IA com alta demanda). Sem problema — me descreva o produto junto com o estilo.\n\nEx.: "capacete de moto preto fosco, fundo branco"\n\n${askStyle}` },
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

    try {
      const history = messages
        .filter((m) => m !== WELCOME)
        .map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "orbit", text: data.reply ?? data.error }]);
    } catch {
      setMessages((m) => [...m, { role: "orbit", text: "Falha de conexão. Tente novamente." }]);
    }
    setUsed(bumpUsage());
    setLoading(false);
  }

  return (
    <div className="mx-auto flex h-full max-h-[640px] w-full max-w-2xl flex-col border border-zinc-200 bg-white shadow-[0_30px_60px_-25px_rgba(0,0,0,0.15)] dark:border-white/10 dark:bg-[#0E0E11] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <Logo size={16} />
          <span className="font-display text-[13px] font-medium tracking-wide text-zinc-700 dark:text-zinc-300">Orbit</span>
          <span className="ml-1 flex items-center gap-1.5 text-[11px] tracking-wide text-zinc-400 dark:text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
            ao vivo
          </span>
        </div>
        <div className="flex items-center gap-3">
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
            onClick={clearHistory}
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
                Precisa de OPENAI_API_KEY no servidor. Sem ela, caímos no gerador gratuito.
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
        </div>
      )}

      {/* Mensagens */}
      <div ref={boxRef} className="scroll-slim min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6">
        {messages.map((m, i) => (
          <div key={i}>
            {m.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap bg-zinc-900 px-4 py-2.5 text-[13.5px] leading-relaxed text-white dark:bg-white/[0.07] dark:text-zinc-100">
                  {m.text}
                </div>
              </div>
            ) : (
              <div className="flex gap-3.5">
                <div className="mt-1 w-px self-stretch bg-zinc-200 dark:bg-white/15" />
                <div className="max-w-[88%]">
                  {m.image && (
                    <a href={m.image} download="orbit-vitrine.png" target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.image} alt="Imagem de vitrine gerada" className="mb-2 max-w-[280px] cursor-pointer rounded-lg border border-zinc-200 transition hover:opacity-90 dark:border-white/10" />
                    </a>
                  )}
                  {m.text && (
                    <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {m.text}
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
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-600 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-white/30 dark:hover:text-white"
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
              Você usa o Orbit intensivamente 🪐 — respostas podem ficar lentas em dias de pico. Amanhã volta ao
              normal.
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
      <form onSubmit={send} className="flex items-center gap-3 border-t border-zinc-200 px-4 py-3.5 dark:border-white/[0.06]">
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        {image && (
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="preview" className="h-9 w-9 rounded object-cover" />
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
          placeholder={awaitingDesc ? "Descreva o produto + estilo: ex.: capacete de moto preto, fundo branco" : pendingProduct ? "Responda: 1, 2, 3, fundo branco, transparente ou cenário…" : "Pergunte ou anexe a foto de um produto…"}
          className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-40 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
        <button
          type="submit"
          disabled={loading || (!input.trim() && !image)}
          aria-label="Enviar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:bg-zinc-300 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:disabled:bg-white/10 dark:disabled:text-zinc-600"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}