// ─────────────────────────────────────────────────────────────
// TAREFA 7 — Blocklist de trackers/ads conhecidos.
// Bloqueio por URL (navegação do iframe): se o destino for um destes
// domínios, o Orbit recusa carregar e mostra o toast "🛡️ Orbit bloqueou X".
// ⚠️ Bloqueio por URL; sub-recursos exigem proxy — roadmap.
// ─────────────────────────────────────────────────────────────
export const BLOCKED_TRACKERS: string[] = [
  "google-analytics.com",
  "googletagmanager.com",
  "facebook.net",
  "doubleclick.net",
  "hotjar.com",
  "mixpanel.com",
  "scorecardresearch.com",
  "quantserve.com",
  "adnxs.com",
  "taboola.com",
  "outbrain.com",
  "criteo.com",
  "amplitude.com",
  "segment.io",
  "clarity.ms",
  "yandex-metrica.com",
  "amazon-adsystem.com",
  "pubmatic.com",
  "rubiconproject.com",
  "openx.net",
  "casalemedia.com",
  "moatads.com",
];
