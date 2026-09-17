# 🪐 Orbit

Navegador + assistente de IA brasileiro. Chat multi-modelo, geração de imagem multi-provider, anúncios de marketplace, documentos e mais.

## 🚀 Rodando

```bash
npm install
npm run dev
```

**O app FUNCIONA SEM NENHUMA CHAVE** — geração de imagem e parte das funções usam o Pollinations (grátis). As chaves abaixo são **opcionais** e desbloqueiam provedores/qualidades extras. Nenhuma chave vai para o client: tudo lido server-side via API routes.

## 🔑 Variáveis `.env.local` (todas OPCIONAIS)

| Variável | Provedor / Uso | Custo | Efeito sem ela |
|---|---|---|---|
| *(nenhuma)* | **Pollinations (FLUX)** — imagem padrão | grátis | — (sempre ativo, último do fallback) |
| `GEMINI_API_KEY` | Google Gemini — chat padrão, visão e imagem | free tier AI Studio | Chat cai no modo limitado; rota `/api/chat` sem IA |
| `GEMINI_API_KEY_2/3` | Chaves extras do pool Gemini (rodízio) | free tier | Só 1 chave no rodízio |
| `OPENROUTER_API_KEY` (+`_2/_3`) | GPT-4o, Claude, DeepSeek, GLM via OpenRouter | pago/free tier | Chat multi-IA do Hub indisponível |
| `OPENAI_API_KEY` | GPT-Image / DALL·E 3 (imagem premium) | pago | 💎 GPT-Image indisponível |
| `HF_TOKEN` | Hugging Face (FLUX.1-schnell, SDXL) | free tier | Provedor HF desativado |
| `TOGETHER_API_KEY` | Together.ai (FLUX.1-schnell-Free) | free tier | Provedor Together desativado |
| `DEEPINFRA_API_KEY` | DeepInfra (FLUX Schnell) | barato | Provedor desativado |
| `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Workers AI (flux-1-schnell) | free diário | Provedor desativado |
| `STABILITY_API_KEY` | Stability AI (core) | créditos | Provedor desativado |
| `REPLICATE_API_TOKEN` | Replicate (FLUX Schnell) | trial/pago | Provedor desativado |
| `FAL_KEY` | Fal.ai (flux/schnell) | créditos | Provedor desativado |
| `YOUTUBE_API_KEY` | YouTube Data API (busca real) | free | Busca cai no fallback |
| `MELI_ACCESS_TOKEN` | Mercado Livre (preços reais no anúncio) | free | Estimativas de preço |

## 🎨 Estúdio de Imagem

Em `/image-studio`: 11 provedores com **fallback chain automático** (escolhido → demais configurados → Pollinations sempre por último), modo **Batalha** (mesmo prompt em 3–4 providers lado a lado), galeria das últimas 30 imagens e download.

Endpoint: `POST /api/image/generate` `{ prompt, provider?, model?, aspectRatio: "1:1"|"16:9"|"9:16", seed? }` · `GET /api/image/providers` (status de cada provedor, sem expor chaves).

## 🧠 Chat multi-modelo

- **Gemini nativo** (pool round-robin, `GEMINI_API_KEY_1..3`) — padrão
- **OpenRouter** — dropdown no Hub de Inteligências (🧠); seleção persistida em `localStorage` (`orbit_model`); se o modelo falhar, 1 tentativa com o padrão + aviso

## 📁 Estrutura

```
app/api/            rotas server-side (chat, imagem, visão, youtube)
app/image-studio/   estúdio de imagem multi-provider
lib/image-providers/ 11 provedores + registry + fallback chain
lib/ai/openrouter.ts  client OpenRouter reutilizável
lib/key-pool.ts     pool round-robin de chaves (server)
lib/orbit-model.ts  seleção de modelo (localStorage)
docs/IDEAS.md       catálogo com 104 ideias pontuadas
docs/ROADMAP.md     fases de execução
```
