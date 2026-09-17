import { type ImageProvider, requireEnv } from "./types";
import { openAiCompatibleGenerate } from "./together";

export const deepinfra: ImageProvider = {
  id: "deepinfra",
  label: "DeepInfra",
  envKeys: ["DEEPINFRA_API_KEY"],
  models: [
    { id: "black-forest-labs/FLUX-1-schnell", label: "FLUX.1 Schnell", costHint: "barato" },
  ],
  isConfigured: () => Boolean(process.env.DEEPINFRA_API_KEY && process.env.DEEPINFRA_API_KEY.length > 10),
  generate: (p) =>
    openAiCompatibleGenerate(
      "deepinfra",
      "https://api.deepinfra.com/v1/openai",
      requireEnv("DEEPINFRA_API_KEY"),
      "black-forest-labs/FLUX-1-schnell",
      p,
    ),
};
