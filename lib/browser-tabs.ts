import { domainOf, isHttpUrl } from "./browser-url";

export type TabType =
  | "home"
  | "iframe"
  | "orbit-chat"
  | "youtube"
  | "youtube-search"
  | "inteligencias"
  | "arena"
  | "privacidade";

export type Tab = {
  id: string;
  title: string;
  type: TabType;
  url?: string;
  ghost?: boolean;
  unverified?: boolean;
  scamBrand?: string;
  scamOfficial?: string;
  scamDismissed?: boolean;
};

const TAB_TYPES: TabType[] = [
  "home", "iframe", "orbit-chat", "youtube", "youtube-search", "inteligencias", "arena", "privacidade",
];

function defaultTabs(): Tab[] {
  return [
    { id: "orbit", title: "Orbit", type: "orbit-chat" },
    { id: "home", title: "Início", type: "home" },
  ];
}

/** Restores persisted tabs while discarding malformed or ghost entries. */
export function normalizeTabs(value: unknown): Tab[] {
  if (!Array.isArray(value)) return defaultTabs();
  const tabs = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const tab = item as Partial<Tab>;
    if (typeof tab.id !== "string" || !tab.id.trim() || !TAB_TYPES.includes(tab.type as TabType) || tab.ghost) return [];
    if (tab.type === "iframe" && !isHttpUrl(tab.url)) return [];
    const url = typeof tab.url === "string" ? tab.url : undefined;
    const title = typeof tab.title === "string" && tab.title.trim() ? tab.title.trim() : url ? domainOf(url) : "Orbit";
    return [{
      id: tab.id,
      title,
      type: tab.type as TabType,
      ...(url ? { url } : {}),
      ...(typeof tab.unverified === "boolean" ? { unverified: tab.unverified } : {}),
      ...(typeof tab.scamBrand === "string" ? { scamBrand: tab.scamBrand } : {}),
      ...(typeof tab.scamOfficial === "string" ? { scamOfficial: tab.scamOfficial } : {}),
      ...(typeof tab.scamDismissed === "boolean" ? { scamDismissed: tab.scamDismissed } : {}),
    }];
  }).filter((tab, index, all) => all.findIndex((candidate) => candidate.id === tab.id) === index);
  if (tabs.length === 0) return defaultTabs();
  return [{ id: "orbit", title: "Orbit", type: "orbit-chat" }, ...tabs.filter((tab) => tab.id !== "orbit")];
}
