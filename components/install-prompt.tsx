"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

const DISMISS_KEY = "orbit_install_dismissed";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Já instalado como app? Não mostrar.
      if (window.matchMedia("(display-mode: standalone)").matches) return;
      // Dispensado recentemente (< 7 dias)? Não mostrar.
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
      if (dismissed && Date.now() - dismissed < SEVEN_DAYS_MS) return;
      // Sem o evento capturado, não há como instalar via banner.
      if (!deferredPrompt) return;
      setVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [deferredPrompt]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-white/10 dark:bg-[#121216]">
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        🪐 Instale o Orbit — janela própria, como um app de verdade
      </p>
      <button
        onClick={install}
        className="rounded-md bg-[#7c3aed] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#6d28d9]"
      >
        Instalar
      </button>
      <button
        onClick={dismiss}
        aria-label="Dispensar"
        className="text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-200"
      >
        ✕
      </button>
    </div>
  );
}