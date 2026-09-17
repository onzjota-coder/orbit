const CINEMATIC_TEMPLATE =
  "cinematic visual, intentional composition, professional lighting, photorealistic detail, rich textures, sharp focus, natural depth of field, high fidelity, 8k detail";

export function enhanceImagePrompt(prompt: string): string {
  const cleaned = prompt.trim();
  if (!cleaned) return CINEMATIC_TEMPLATE;
  return `${cleaned}, ${CINEMATIC_TEMPLATE}`;
}
