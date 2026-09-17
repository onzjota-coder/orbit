"use client";

import { useState } from "react";

export default function OrbitExternal({
  url,
  title,
  onOpenOutside,
  onTryInside,
  onBack,
}: {
  url: string;
  title: string;
  onOpenOutside: () => void;
  onTryInside: () => void;
  onBack: () => void;
}) {
  const [inside, setInside] = useState(false);

  if (inside) {
    return (
      <iframe
        src={url}
        title={title}
        className="h-full w-full border-0 bg-white"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-zinc-50 p-8 dark:bg-[#0E0E11]">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-xl dark:border-white/10 dark:bg-white/[0.03]">
        <p className="text-4xl">🛰️</p>
        <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">Órbita Externa</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Este site não permite abrir dentro do Orbit (decisão de segurança DELES). Abrimos fora com segurança.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={onOpenOutside} className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200">Abrir fora</button>
          <button type="button" onClick={() => { setInside(true); onTryInside(); }} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/[0.06]">Tentar dentro mesmo assim</button>
          <button type="button" onClick={onBack} className="rounded-xl px-4 py-2.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/[0.06]">Voltar ao início</button>
        </div>
      </div>
    </div>
  );
}
