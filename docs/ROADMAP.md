# 🗺️ Orbit — Roadmap de Execução

> Baseado em `docs/IDEAS.md` (score [Impacto|Esforço]).
> **Fase 1** = quick wins (alto impacto, baixo esforço) · **Fase 2** = médio prazo · **Fase 3** = visão de longo prazo.

## ✅ Implementado AGORA (Missões 2 e 3)

- Imagem multi-provider com arquitetura unificada (11 provedores, fallback chain, Pollinations sempre por último)
- Modo Batalha (mesmo prompt em 3–4 providers lado a lado)
- Galeria das últimas 30 imagens
- Texto multi-modelo via OpenRouter (`lib/ai/openrouter.ts`) com fallback de modelo e seleção persistida
- Validação Zod em toda API route nova · README com todas as .env opcionais

## 🚀 Fase 1 — Quick Wins (Impacto ≥ 4, Esforço ≤ 2)

1. **#102** Corrigir cache do key-pool (pool vazio congelado → 502s)
2. **#101** Unificar pool de chaves na `/api/chat` (hoje lê `process.env` direto)
3. **#51** Rate limit por IP nas rotas de IA
4. **#52** Limite de payload em todas as rotas
5. **#89/90** ESLint + Prettier + script `typecheck`
6. **#21/22** Loading skeleton + toasts padronizados pt-BR
7. **#37** Botão "copiar resposta" com feedback visual
8. **#54** Env-gate nos `console.log` (não logar em produção)
9. **#39** Streaming padronizado no chat padrão (Gemini)
10. **#41** Lazy loading do browser-shell e imgly
11. **#79** Metadata completa por página
12. **#83** Sitemap + robots.txt
13. **#23** Modal próprio no lugar de `window.confirm`
14. **#40** Cache TTL nas rotas YouTube/ML
15. **#103** Remover código morto (wrappers `require()`, waitlist)

## 🏗️ Fase 2 — Médio Prazo

1. **#3** Modo Batalha avançado (voting, comparação de latência/custo)
2. **#7/15** Conversa com documentos + OCR
3. **#9/63/64** Busca full-text no histórico + galeria avançada
4. **#65** Export/import do perfil em JSON
5. **#16** Text-to-speech
6. **#5/67** Galeria de documentos gerados
7. **#71/72/76** Créditos + planos + paywall suave
8. **#73** BYOK como feature
9. **#92/93/94** Sentry + logs estruturados + health check
10. **#80** i18n pt-BR + en (next-intl)
11. **#82** Acessibilidade WCAG AA
12. **#25** Command Palette (Ctrl+K)
13. **#26/28** Split view + abas verticais
14. **#34** Onboarding tour guiado
15. **#91** Testes E2E Playwright (fluxos críticos)
16. **#96** CI/CD GitHub Actions
17. **#45** `output: "standalone"` + #56 headers de segurança

## 🌌 Fase 3 — Visão de Longo Prazo

1. **#10/11** Agentes autônomos (cadeia de ferramentas + navegação multi-aba)
2. **#17** Image-to-video (Runway/Luma)
3. **#66** Sincronização via Supabase (conta Orbit)
4. **#69/70** Sessões nomeadas + expiração de histórico
5. **#74** Marketplace de prompts da comunidade
6. **#77/78** White-label + afiliados
7. **#84** RTL + **#88** multilíngue nas respostas
8. **#19** Modo debate · **#12** comparador avançado de modelos
9. **#59** Cofre criptografado local (WebCrypto)
10. **#61** Container tabs isoladas
11. Orbit Desktop (Electron) — adblock de verdade
12. **#95** Dashboard de uso por provider/modelo
13. **#86** OG dinâmico para compartilhar conversas
14. **#35** Gamificação · **#36** central de atualizações

## 📐 Regras de execução

- Commits pequenos e descritivos, 1 recurso por commit
- `npm run build` verde antes de avançar fase
- Zero `any`; Zod em toda rota nova; chaves só server-side
- App SEMPRE funcional apenas com Pollinations (nenhuma chave obrigatória)
