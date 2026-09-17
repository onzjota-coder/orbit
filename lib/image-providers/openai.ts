import { type ImageProvider, requireEnv } from "./types";
import { openAiCompatibleGenerate } from "./together";

export const openai: ImageProvider = {
  id: "openai",
  label: "OpenAI (GPT-Image)",
  envKeys: ["OPENAI_API_KEY"],
  models: [
    { id: "gpt-image-1", label: "GPT-Image 1", costHint: "pago" },
    { id: "dall-e-3", label: "DALL·E 3", costHint: "pago" },
  ],
  isConfigured: () => Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10),
  generate: (p) =>
    openAiCompatibleGenerate("openai", "https://api.openai.com/v1", requireEnv("OPENAI_API_KEY"), "gpt-image-1", p),
};
