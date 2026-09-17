# 💡 Orbit — Catálogo de Ideias

> Score: **[Impacto 1–5 | Esforço 1–5]** — impacto pro usuário/produto × esforço de implementação.
> Priorização no `docs/ROADMAP.md`. Referência histórica: `ROADMAP.md` na raiz.

## 🤖 Funcionalidades de IA

1. [5|3] Chat multi-modelo via OpenRouter (GPT-4o, Claude, Gemini, DeepSeek, GLM) com seleção persistida
2. [5|2] Geração de imagem multi-provider com fallback chain automático (Pollinations sempre por último)
3. [4|2] Modo Batalha: mesmo prompt em 3–4 provedores lado a lado
4. [4|2] Modo Vendedor: anúncio ML/Shopee com pesquisa de preços real no Mercado Livre
5. [4|2] Documentos prontos (currículo, declaração) gerados por IA e baixáveis em PDF/Word/HTML/TXT
6. [4|3] Análise de imagens (visão) para vitrines de e-commerce
7. [4|3] Conversa com documentos (upload PDF → RAG local no dispositivo)
8. [4|2] Memória do chat persistida em IndexedDB com fallback localStorage
9. [3|3] RAG local: indexar favoritos/histórico do navegador e perguntar sobre eles
10. [4|3] Agentes: "pesquise X, resuma e salve no Recall" (cadeia de ferramentas server-side)
11. [3|3] Agentes de navegação: descreva uma tarefa, o Orbit executa multi-aba
12. [4|2] Comparador de modelos: mesma pergunta em 2 modelos, resposta lado a lado
13. [3|2] Detecção automática de intenção (pergunta vs. venda vs. documento) no server
14. [3|2] Detector de golpes/golpes financeiros nas respostas e links
15. [3|3] OCR foto→texto via Gemini visão
16. [3|3] Geração de áudio/text-to-speech a partir de texto (Edge TTS / OpenAI TTS)
17. [3|4] Image-to-video curto (Runway/Luma via API) para anúncios
18. [3|3] Prompt assistido: IA sugere melhorias no prompt antes de gerar imagem
19. [2|3] Modo debate: 2 modelos debatem e um 3º resume o consenso
20. [3|3] Geração de variações da mesma imagem (4 seeds por prompt)

## 🎨 UX/UI e Design System

21. [4|2] Loading skeleton em todas as operações de IA (nunca tela travada)
22. [4|1] Toasts padronizados de sucesso/erro em pt-BR
23. [3|2] Modal próprio substituindo `window.confirm` (limpar histórico etc.)
24. [4|2] Modo escuro/claro com `next-themes` já integrado — expandir tokens no Tailwind
25. [3|2] Command Palette (Ctrl+K) para ações do app
26. [3|2] Split view: chat + navegador/YouTube lado a lado
27. [3|3] Picture-in-picture flutuante para vídeo
28. [3|2] Abas verticais opcionais no navegador
29. [2|3] Grupos de abas com workspaces salvos
30. [3|2] Autocompletar e histórico na barra de endereço
31. [2|4] Mini-mapa de abas
32. [3|2] Barra de progresso de carregamento de página
33. [2|3] Gestos de mouse para navegação
34. [3|2] Onboarding interativo (tour guiado na 1ª visita)
35. [2|2] Sistema de conquistas/gamificação leve
36. [3|2] Central de atualizações (changelog dentro do app)
37. [3|1] Botão "copiar resposta" com feedback visual em todas as mensagens
38. [3|2] Regenerar resposta com outro modelo em 1 clique

## ⚡ Performance

39. [4|2] Streaming de respostas de chat (SSE já parcial na rota OpenRouter — padronizar)
40. [4|2] Cache server-side com TTL para respostas de APIs externas (YouTube, ML)
41. [3|2] Lazy loading de componentes pesados (`next/dynamic` no browser-shell, imgly)
42. [4|2] Edge runtime nas rotas de chat simples (latência menor)
43. [3|2] Debounce na persistência de abas/favoritos (evita write storm no localStorage)
44. [3|2] Compressão de imagens base64 antes de salvar no IndexedDB
45. [3|2] `output: "standalone"` no next.config para deploy menor
46. [3|1] Prefetch de rotas com `<Link>` onde aplicável
47. [3|2] Web Worker para remoção de fundo (imgly) não travar a UI
48. [2|3] Prefetch de DNS/conn para apis externas (`<link rel="preconnect">`)
49. [3|2] Limitar histórico de abas/favoritos persistidos (slice antes do stringify)
50. [2|3] Virtualização de listas longas (histórico, galeria)

## 🔒 Segurança

51. [5|2] Rate limit por IP nas rotas de IA (janela deslizante em memória ou Upstash)
52. [5|1] Limite de payload/tamanho de mensagem em TODAS as rotas
53. [4|1] Sanitização de HTML/markdown nas respostas de IA (XSS)
54. [4|2] Nunca logar chaves ou prompts sensíveis em produção (env-gate nos console.log)
55. [4|2] Abuso: contagem diária por IP + captcha leve após N requisições
56. [3|2] CSP e headers de segurança no next.config
57. [3|2] Google Safe Browsing no navegador para links suspeitos
58. [3|2] Alerta antes de colar dados sensíveis no chat
59. [3|3] Cofre de documentos criptografado local (WebCrypto)
60. [3|2] Blocklist de prompts/keywords abusivos (já existe `lib/blocklist.ts` — expandir)
61. [2|3] Container tabs (sessões isoladas por cookie jar)
62. [3|2] Verificação de link suspeito antes de abrir em nova aba

## 💾 Persistência

63. [4|2] Galeria de imagens geradas (últimas 30) com prompt/provider/data
64. [4|2] Histórico de chat em IndexedDB (já feito — expor UI de busca/limpeza)
65. [3|2] Export/import completo do perfil (abas, favoritos, chat) em JSON
66. [3|3] Favoritos sincronizados via Supabase quando o usuário logar
67. [3|2] Galeria de documentos gerados com re-download
68. [3|2] Busca full-text no histórico de conversas
69. [2|3] Sessões nomeadas do navegador (salvar/restaurar conjuntos de abas)
70. [3|2] Exclusão automática de histórico após X dias (configurável)

## 💰 Monetização

71. [4|3] Sistema de créditos: N gerações de imagem premium por mês
72. [4|2] Planos Free/Pro/Team com limites por tier (rate limit diferenciado)
73. [3|2] BYOK como feature Pro: usuário traz a própria chave e não consome quota
74. [3|3] Marketplace de prompts da comunidade
75. [3|3] Marca d'água removível no plano pago
76. [3|2] Paywall suave: X usos grátis/dia, depois sugere plano
77. [2|3] Revenda white-label para agências
78. [3|3] Afiliados: comissão por indicação

## 🌐 SEO/PWA/Acessibilidade/i18n

79. [4|1] Metadata completa (title, description, OG) em todas as páginas
80. [4|2] i18n pt-BR + en com `next-intl` (UI + mensagens de erro)
81. [3|2] PWA: manifest + service worker (já existe — auditar offline mode)
82. [3|2] Acessibilidade: aria-labels, foco visível, contraste WCAG AA
83. [2|2] Sitemap.xml + robots.txt
84. [3|3] RTL ready para expansão futura
85. [3|2] Lighthouse CI no pipeline com score mínimo
86. [2|2] Open Graph dinâmico para compartilhar conversas
87. [3|2] Instalação PWA com prompt customizado (já existe — melhorar)
88. [2|3] Multilíngue nas respostas da IA (detectar idioma do usuário)

## 🔧 DevOps

89. [4|1] ESLint + Prettier configurados
90. [4|1] Script `typecheck` e validação no CI
91. [4|3] Testes E2E com Playwright nos fluxos críticos (chat, imagem)
92. [3|2] Monitoramento de erros (Sentry)
93. [3|2] Logs estruturados (JSON) com nível por ambiente
94. [3|2] Health check endpoint (`/api/health`) com status dos providers
95. [3|2] Dashboard de uso: quantas chamadas por provider/modelo
96. [3|3] CI/CD GitHub Actions (lint + typecheck + build)
97. [2|3] Feature flags simples via env
98. [3|2] Alertas de quota/chave esgotada
99. [2|2] Changelog automatizado via Conventional Commits
100. [3|3] Staging environment no Vercel preview branches

## 🧭 Extras (além das 100)

101. [4|2] Unificar pool de chaves na rota /api/chat (hoje lê env direto)
102. [4|1] Corrigir cache do key-pool que congela pool vazio
103. [3|2] Remover código morto (wrappers `require()`, waitlist)
104. [3|2] Erros de IA diferenciados por código (401/429/timeout) na UI
