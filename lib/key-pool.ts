type KeyPool = { keys: string[]; index: number };

const pools = new Map<string, KeyPool>();

const SERVICE_KEYS: Record<string, string[]> = {
  gemini: ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"],
  openrouter: ["OPENROUTER_API_KEY", "OPENROUTER_API_KEY_2", "OPENROUTER_API_KEY_3"],
};

function normalizeService(service: string): string {
  return (service || "gemini").trim().toLowerCase();
}

function loadKeys(service: string): string[] {
  const keys = SERVICE_KEYS[service] ?? [];
  return keys
    .map((name) => process.env[name])
    .filter((value): value is string => typeof value === "string" && value.length > 10);
}

function getPool(service: string): KeyPool {
  const normalized = normalizeService(service);
  const current = pools.get(normalized);
  if (current) return current;

  const next: KeyPool = { keys: loadKeys(normalized), index: 0 };
  pools.set(normalized, next);
  return next;
}

export function getNextKey(service = "gemini"): string {
  const normalized = normalizeService(service);
  const pool = getPool(normalized);
  if (pool.keys.length === 0) return "";

  const key = pool.keys[pool.index % pool.keys.length];
  const n = (pool.index % pool.keys.length) + 1;
  pool.index += 1;

  if (typeof window === "undefined") {
    console.log(`🔑 Pool de chaves ${normalized}: usando chave #${n} (...${key.slice(-4)})`);
  }

  return key;
}

export function getKeyCount(service = "gemini"): number {
  const normalized = normalizeService(service);
  return getPool(normalized).keys.length;
}
