"use client";

import { useState } from "react";
import BrowserShell from "@/components/browser-shell";
import Logo from "@/components/logo";

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

export default function Home() {
  return (
    <main className="relative">
      <div className="ambient pointer-events-none absolute inset-x-0 top-0 h-[500px]" />

      {/* SHELL — a página passa a SER o navegador (logo volta para a aba home) */}
      <BrowserShell />

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
            { fase: "I", titulo: "Agora", desc: "Foto do produto vira imagem de vitrine + anúncio completo." },
            { fase: "II", titulo: "Próximo", desc: "Publicação direta: Bling, Tiny, Olist, Mercado Livre e Shopee." },
            { fase: "III", titulo: "Ecossistema", desc: "Todas as IAs no mesmo chat, Recall, Echo e os demais módulos." },
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