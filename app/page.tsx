"use client";

import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const DAILY_LIMIT = 10;

type Msg = { role: "user" | "orbit"; text: string };

function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="10.5" ry="3.4" stroke="currentColor" strokeWidth="1.2" transform="rotate(-16 12 12)" />
    </svg>
  );
}

const modules = [
  { n: "01", icon: "☀️", name: "Orbit Core", desc: "Todas as IAs respondendo no mesmo chat. Compare. Escolha a melhor resposta.", hot: true },
  { n: "02", icon: "🧠", name: "Recall", desc: "Sua memória infinita. Salve tudo hoje, pergunte à IA depois." },
  { n: "03", icon: "🔍", name: "Findly", desc: "Busca unificada na sua vida digital. Privacidade total, no seu dispositivo." },
  { n: "04", icon: "🎬", name: "Streamly", desc: "Todos os streamings em uma busca e uma lista única." },
  { n: "05", icon: "📢", name: "Echo", desc: "Escreva uma vez. Publique em todas as redes, no tom certo de cada uma." },
  { n: "06", icon: "💜", name: "Fanhub", desc: "A página única do criador: link, pagamentos, loja e newsletter." },
  { n: "07", icon: "📊", name: "Mylo", desc: "Assinaturas, contas e vencimentos sob controle — com alertas inteligentes." },
  { n: "08", icon: "🏘️", name: "Hoodly", desc: "Tudo do seu bairro em um só lugar, com confiança real." },
  { n: "09", icon: "🔧", name: "Servly", desc: "Agendamento de serviços locais sem trocas infinitas de mensagem." },
  { n: "10", icon: "🔄", name: "SkillSwap", desc: "Troque conhecimento, não dinheiro." },
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

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setDone(true);
  }

  if (done)
    return (
      <p className="mx-auto max-w-md border border-zinc-300 bg-zinc-50 px-6 py-4 text-center text-sm tracking-wide text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200">
        Solicitação registrada. Você será contemplado no primeiro lote.
      </p>
    );

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-xl flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        className="w-full flex-1 border border-zinc-300 bg-white px-5 py-3.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-white/30"
      />
      <button
        type="submit"
        className="bg-zinc-900 px-7 py-3.5 text-sm font-semibold tracking-wide text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        Acesso antecipado
      </button>
    </form>
  );
}

function ChatDemo() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "orbit", text: "Boa tarde. Sou o Orbit — assistente do que virá. Pergunte o que quiser, sem cadastro. Anexe a foto de um produto e eu monto o anúncio." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUsed(getUsage());
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const blocked = used >= DAILY_LIMIT;

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && !image) || loading || blocked) return;

    setMessages((m) => [
      ...m,
      { role: "user", text: image ? `${text || "anuncia esse"} 📎 [imagem anexada]` : text },
    ]);
    setInput("");
    setLoading(true);
    const sentImage = image;
    setImage(null);

    try {
      if (sentImage) {
        const res = await fetch("/api/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: sentImage.split(",")[1],
            mimeType: sentImage.slice(5, sentImage.indexOf(";")),
            prompt: text || "Analise este produto e crie o anúncio.",
          }),
        });
        const data = await res.json();
        setMessages((m) => [...m, { role: "orbit", text: data.reply ?? data.error }]);
      } else {
        const history = messages
          .filter((m) => m !== messages[0])
          .map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] }));
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history }),
        });
        const data = await res.json();
        setMessages((m) => [...m, { role: "orbit", text: data.reply ?? data.error }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "orbit", text: "Falha de conexão. Tente novamente." }]);
    }
    setUsed(bumpUsage());
    setLoading(false);
  }

  return (
    <div className="mx-auto mt-14 w-full max-w-2xl border border-zinc-200 bg-white shadow-[0_30px_60px_-25px_rgba(0,0,0,0.15)] dark:border-white/10 dark:bg-[#0E0E11] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
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
        <span className="text-[11px] tracking-wide text-zinc-400 dark:text-zinc-600">
          {blocked ? "limite diário atingido" : `${DAILY_LIMIT - used} consultas restantes hoje`}
        </span>
      </div>

      {/* Mensagens */}
      <div ref={boxRef} className="scroll-slim h-[380px] space-y-6 overflow-y-auto px-5 py-6">
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
                <div className="max-w-[88%] whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {m.text}
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
        {blocked && (
          <div className="border border-zinc-200 bg-zinc-50 p-5 text-center text-[13px] leading-relaxed text-zinc-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">
            Suas {DAILY_LIMIT} consultas de hoje foram utilizadas.
            <br />
            <a href="#acesso" className="mt-2 inline-block text-zinc-900 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-900 dark:text-white dark:decoration-white/30 dark:hover:decoration-white">
              Garanta acesso ilimitado no lançamento →
            </a>
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
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setImage(reader.result as string);
            reader.readAsDataURL(file);
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={blocked || loading}
          placeholder={blocked ? "Disponível novamente amanhã." : "Pergunte ou anexe a foto de um produto…"}
          className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-40 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
        <button
          type="submit"
          disabled={blocked || loading || (!input.trim() && !image)}
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

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <div className="ambient pointer-events-none absolute inset-x-0 top-0 h-[500px]" />

      {/* NAV */}
      <nav className="fade-up mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <div className="flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
          <Logo />
          <span className="font-display text-[17px] font-semibold tracking-tight">Orbit</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#acesso" className="group flex items-center gap-2 text-[13px] tracking-wide text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            Acesso antecipado
            <span className="transition group-hover:translate-x-0.5">→</span>
          </a>
          <ThemeToggle />
        </div>
      </nav>

      {/* HERO */}
      <section className="mx-auto max-w-3xl px-6 pt-14 text-center sm:pt-20">
        <p className="fade-up d1 text-[11px] font-medium uppercase tracking-[0.3em] text-zinc-500">
          Prévia pública · Sem cadastro
        </p>

        <h1 className="fade-up d2 mt-6 font-display text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.03em] text-zinc-900 dark:text-white sm:text-4xl md:text-[3rem]">
          A inteligência que conecta
          <span className="block bg-gradient-to-b from-zinc-900 to-zinc-500 bg-clip-text text-transparent dark:from-white dark:via-white dark:to-zinc-600">
            toda a sua vida digital.
          </span>
        </h1>

        <p className="fade-up d3 mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Pergunte agora, sem barreiras. Anexe a foto de um produto e receba o anúncio pronto. Em breve:
          <span className="text-zinc-800 dark:text-zinc-200"> ChatGPT · Gemini · Claude · Grok</span> em um único chat.
        </p>

        <div className="fade-up d4">
          <ChatDemo />
        </div>
      </section>

      {/* ACESSO */}
      <section id="acesso" className="mx-auto max-w-3xl px-6 pt-24 text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
          Acesso antecipado
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-500">
          O primeiro lote terá acesso completo e ilimitado, sem custo.
          Cadastre-se para reservar sua posição.
        </p>
        <div className="mt-8">
          <WaitlistForm />
        </div>
      </section>

      {/* VISÃO */}
      <section className="mx-auto max-w-6xl px-6 py-28">
        <div className="mb-14 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-600">A visão</p>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            Um produto. Um ecossistema.
          </h2>
        </div>

        <div className="grid gap-px overflow-hidden border border-zinc-200 bg-zinc-200 dark:border-white/[0.07] dark:bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div
              key={m.n}
              className={`group p-7 transition-colors ${
                m.hot
                  ? "bg-zinc-50 dark:bg-white/[0.05] sm:col-span-2 lg:col-span-3"
                  : "bg-white hover:bg-zinc-50 dark:bg-[#0C0C0F] dark:hover:bg-[#121216]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] opacity-50 saturate-0 transition group-hover:opacity-90 dark:opacity-40 dark:group-hover:opacity-80">
                  {m.icon}
                </span>
                <div className="flex items-center gap-4">
                  {m.hot && (
                    <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-500">
                      Lançamento
                    </span>
                  )}
                  <span className="text-[11px] tracking-[0.2em] text-zinc-300 dark:text-zinc-600">{m.n}</span>
                </div>
              </div>
              <h3 className={`mt-4 font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 ${m.hot ? "text-2xl" : "text-lg"}`}>
                {m.name}
              </h3>
              <p className={`mt-2 leading-relaxed text-zinc-500 dark:text-zinc-500 ${m.hot ? "max-w-lg text-[15px]" : "text-sm"}`}>
                {m.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FRASE MESTRE */}
      <section className="border-y border-zinc-200 bg-zinc-50 dark:border-white/[0.07] dark:bg-white/[0.015]">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="font-display text-xl font-medium leading-snug tracking-tight text-zinc-800 dark:text-zinc-200 sm:text-[1.8rem]">
            “O Google não conhece sua vida. O ChatGPT não conhece suas contas.
            <span className="mt-2 block bg-gradient-to-b from-zinc-900 to-zinc-500 bg-clip-text text-transparent dark:from-white dark:to-zinc-500">
              O Orbit é o único que conecta tudo.”
            </span>
          </p>
        </div>
      </section>

      {/* TRAJETÓRIA */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <div className="grid gap-10 sm:grid-cols-3">
          {[
            { fase: "I", titulo: "Agora", desc: "Assistente com Modo Vendedor: foto do produto vira anúncio pronto." },
            { fase: "II", titulo: "Próximo", desc: "Orbit Core completo — todas as IAs, um só chat, grátis para os primeiros." },
            { fase: "III", titulo: "Ecossistema", desc: "Recall, Streamly, Echo e os demais módulos integrados ao núcleo." },
          ].map((s) => (
            <div key={s.fase} className="border-t border-zinc-200 pt-6 dark:border-white/10">
              <span className="font-display text-sm tracking-[0.2em] text-zinc-400 dark:text-zinc-600">{s.fase}</span>
              <h3 className="mt-3 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">{s.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-200 dark:border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-10 text-[12px] tracking-wide text-zinc-400 dark:text-zinc-600 sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo size={14} />
            <span className="font-display text-zinc-600 dark:text-zinc-400">Orbit</span>
          </div>
          <p>Feito no Brasil, para o mundo. {new Date().getFullYear()}</p>
        </div>
      </footer>
    </main>
  );
}