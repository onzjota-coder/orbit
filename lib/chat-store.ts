const DB_NAME = "orbit-db";
const STORE_NAME = "chat";
const HISTORY_KEY = "orbit_chat_history";
const HISTORY_ID = "history";
const HISTORY_MAX = 50;

export type Message = {
  role: "user" | "orbit";
  text: string;
  image?: string;
  document?: { content: string; request: string };
  retry?: boolean;
};

type ChatDatabase = IDBDatabase;

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<ChatDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("IndexedDB indisponível"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir IndexedDB"));
    request.onblocked = () => reject(new Error("IndexedDB bloqueado"));
  });
}

function readLocalHistory(): Message[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Message[]).slice(-HISTORY_MAX) : [];
  } catch (error) {
    console.warn("[ORBIT] histórico local inválido:", error);
    return [];
  }
}

function saveLocalHistory(messages: Message[]): void {
  try {
    const trimmed = messages.slice(-HISTORY_MAX);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    try {
      window.localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(messages.slice(-HISTORY_MAX).map(({ role, text }) => ({ role, text }))),
      );
    } catch (error) {
      console.warn("[ORBIT] não foi possível salvar o histórico local:", error);
    }
  }
}

function requestStore<T>(
  database: ChatDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha no IndexedDB"));
    transaction.onerror = () => reject(transaction.error ?? new Error("Falha na transação IndexedDB"));
  });
}

export async function loadHistory(): Promise<Message[]> {
  try {
    const database = await openDatabase();
    const stored = await requestStore<unknown>(database, "readonly", (store) =>
      store.get(HISTORY_ID),
    );
    database.close();

    if (Array.isArray(stored)) return (stored as Message[]).slice(-HISTORY_MAX);

    const legacy = readLocalHistory();
    if (legacy.length > 0) {
      await saveHistoryToDatabase(legacy);
      window.localStorage.removeItem(HISTORY_KEY);
    }
    return legacy;
  } catch (error) {
    console.warn("[ORBIT] IndexedDB indisponível; usando localStorage:", error);
    return readLocalHistory();
  }
}

async function saveHistoryToDatabase(messages: Message[]): Promise<void> {
  const database = await openDatabase();
  await requestStore<IDBValidKey>(database, "readwrite", (store) =>
    store.put(messages.slice(-HISTORY_MAX), HISTORY_ID),
  );
  database.close();
}

export async function saveHistory(messages: Message[]): Promise<void> {
  const trimmed = messages.slice(-HISTORY_MAX);
  try {
    await saveHistoryToDatabase(trimmed);
  } catch (error) {
    console.warn("[ORBIT] IndexedDB indisponível; salvando histórico localmente:", error);
    saveLocalHistory(trimmed);
  }
}

export async function clearHistory(): Promise<void> {
  try {
    const database = await openDatabase();
    await requestStore<undefined>(database, "readwrite", (store) =>
      store.delete(HISTORY_ID),
    );
    database.close();
  } catch (error) {
    console.warn("[ORBIT] não foi possível limpar o IndexedDB:", error);
  }

  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.warn("[ORBIT] não foi possível limpar o histórico local:", error);
  }
}
