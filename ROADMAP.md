# 🪐 ORBIT — 100 MELHORES IDEIAS (roadmap executável)

## ✅ JÁ FEITO

- [x] Shell navegador com abas/favoritos/fundo dinâmico
- [x] Chat IA com rodízio de chaves
- [x] Vitrine com foto real (imgly)
- [x] Imagem por texto
- [x] Modo Vendedor com detector
- [x] Hub de IAs
- [x] Detector de golpes
- [x] Humildade temporal
- [x] PWA
- [x] Modo Fantasma
- [x] Memória do chat
- [x] Multi-formato PDF/Word/HTML/TXT
- [x] YouTube real com API, thumbnails e player interno

## 🔴 P0 — ESTABILIDADE (próxima sessão)

- [ ] Unificar pool de chaves nas 4 rotas
- [ ] Rate limit + limite de payload
- [ ] IndexedDB no lugar do localStorage (histórico com imagens)
- [ ] try/catch no getUsage + finally nos loadings
- [ ] Corrigir detectStyle (número real)
- [ ] Remover código morto (waitlist, supabase.ts)
- [ ] ESLint + scripts typecheck

## 🟠 P1 — NAVEGADOR NÍVEL MUNDIAL

- [ ] AI Sidebar com contexto da página
- [ ] Split view (YouTube + chat lado a lado)
- [ ] Picture-in-picture flutuante
- [x] Autocompletar na barra
- [ ] Command Palette (Ctrl+Shift+P)
- [x] Ctrl+Tab/Ctrl+W/Ctrl+L
- [ ] Abas verticais opcionais
- [ ] Grupos de abas com workspaces
- [ ] Pinned tabs
- [ ] Suspensão de abas pesadas
- [ ] Busca em abas abertas
- [ ] Mini-mapa de abas
- [ ] Sessões nomeadas
- [ ] Gestos de mouse
- [x] Undo de aba fechada
- [ ] Barra de progresso violeta
- [ ] Zoom por site
- [x] 🏠 + 🏞️ botões rápidos

## 🧠 P2 — INTELIGÊNCIA PROFUNDA

- [ ] Memória de longo prazo por usuário
- [ ] Perfil automático (vendedor/estudante/dev)
- [ ] Conversa com documentos
- [ ] OCR foto→texto
- [ ] Simulador de entrevista
- [ ] Análise de contratos com cláusulas de risco
- [ ] Explicação incremental
- [ ] Modo debate
- [ ] Análise de sentimento de avaliações
- [ ] Gerador de plano de negócios
- [ ] IA de precificação psicológica
- [ ] Detecção de tendências
- [ ] Corretor de tom
- [ ] A/B de respostas
- [ ] Tradução com tom

## 📄 P3 — DOCUMENTOS EMPRESARIAIS

- [ ] Modelos BR prontos (declaração de residência — o mais pedido!)
- [ ] Assinatura digital salva
- [ ] Logotipo nos PDFs
- [ ] PDF→texto editável
- [ ] Mesclar PDFs
- [ ] Export .docx real
- [ ] Gerador de EAN/código de barras
- [ ] Simulador de frete
- [ ] Carnê de cobrança
- [ ] QR do Orbit nos documentos

## 🛒 P4 — E-COMMERCE VENDEDOR

- [ ] API do Bling
- [ ] Monitor de perguntas ML/Shopee com resposta sugerida
- [ ] Comparador de preços vs concorrentes
- [ ] Calculadora de margem real
- [ ] Alerta de estoque zerado
- [ ] Relatório semanal por IA
- [ ] Banners nos tamanhos oficiais
- [ ] Importar planilha → anúncios em lote
- [ ] Gerador de cupons
- [ ] Histórico de preços em gráfico

## 🛡️ P5 — SEGURANÇA AVANÇADA

- [ ] Google Safe Browsing integrado
- [ ] Selo de idade do domínio
- [ ] Termos de Uso resumidos por IA
- [ ] Alerta antes de colar dados sensíveis
- [ ] Cofre de documentos criptografado
- [ ] Container tabs (sessões isoladas)
- [ ] Alerta de preço absurdo (golpe)
- [ ] 2FA no perfil
- [ ] Scanner de links do WhatsApp
- [ ] Zero-rastreamento auditável

## 🌍 P6 — GLOBAL

- [ ] 6 idiomas (PT/EN/ES/DE/FR/IT)
- [ ] Busca regional
- [ ] Moedas do mundo
- [ ] Fuso múltiplo
- [ ] RTL
- [ ] LGPD/GDPR/CCPA
- [ ] Product Hunt global
- [ ] Fluxos globais traduzidos

## 🎨 P7 — PERSONALIZAÇÃO SUPREMA

- [x] Temas Cosmos/Simples
- [ ] Temas Oceano/Floresta/Neon
- [ ] Wallpaper próprio
- [ ] Widgets editáveis drag&drop
- [ ] Clima (Open-Meteo)
- [ ] Dólar/euro (AwesomeAPI)
- [ ] Frase do dia por IA
- [ ] Timer de bem-estar
- [ ] Modo e-ink
- [ ] Sons de interface
- [x] Splash animado
- [ ] Favicon com progresso

## 🚀 P8 — FUTURO CÓSMICO (premium)

- [ ] Orbit Desktop (Electron) — adblock de verdade estilo Brave+
- [ ] Agentes autônomos (Playwright)
- [ ] n8n integrado
- [ ] GPT-6 Astra via API premium
- [ ] IA offline WebLLM
- [ ] Orbit TV/Auto/Kids
- [ ] Colaboração em tempo real
- [ ] Whitelabel
- [ ] API pública/SDK
- [ ] Marketplace de Fluxos monetizado
- [ ] Orbit Space
- [ ] Auto-programação

## BACKLOG — 100 ideias avançadas de funcionalidades

### 🧠 Orquestração multi-IA (10)

1. Roteador automático de modelo por tipo de pergunta (código→DeepSeek, texto longo→Claude, geral→Gemini)
2. Modo "comparar respostas": mesma pergunta em 2-3 modelos lado a lado
3. Fallback automático em cascata se o modelo principal falhar
4. Indicador de custo estimado por resposta (tokens × preço do modelo)
5. Histórico unificado de conversas entre todos os provedores
6. Modo "conselho de IAs": 3 modelos respondem e um 4º resume o consenso
7. Seleção de modelo por orçamento (econômico/balanceado/premium)
8. Cache de respostas repetidas para economizar chamadas
9. Streaming de resposta token-a-token na UI (percepção de velocidade)
10. Detecção automática de idioma da pergunta para ajustar o modelo

### 💾 Memória e personalização (10)

11. Perfil de usuário com preferências salvas (tom de voz, formalidade)
12. Memória de longo prazo entre sessões (fatos que o usuário já contou)
13. Pastas/espaços de trabalho separados (pessoal, trabalho, vendas)
14. Templates de prompt salvos e reutilizáveis pelo usuário
15. Histórico pesquisável por palavra-chave
16. Exportar conversa inteira em PDF/Word (usando jspdf já instalado)
17. Modo "continuar de onde parei" com resumo automático de contexto
18. Tags manuais em conversas importantes
19. Favoritar respostas específicas dentro de uma conversa longa
20. Atalhos de teclado personalizáveis

### ⚙️ Produtividade e automação (10)

21. Comandos de barra "/" para ações rápidas (resumir, traduzir, explicar)
22. Integração com Google Calendar para criar eventos via chat
23. Integração com Gmail para rascunhar e-mails direto do Orbit
24. Lembretes/tarefas geradas a partir de conversas
25. Modo "pipeline": encadear 2+ prompts automaticamente (ex: pesquisar → resumir → traduzir)
26. Upload de planilha com análise automática (usando lib de parsing CSV)
27. OCR de imagem colada no chat (extrair texto de print)
28. Geração de apresentação simples a partir de um resumo de texto
29. Modo reunião: transcrição + ata automática de áudio
30. Agendamento de prompts recorrentes (ex: resumo diário de notícias)

### 🛡️ Segurança e privacidade (10)

31. Modo incógnito de chat (não salva histórico)
32. Criptografia local do histórico sensível
33. Alerta automático quando o usuário cola número de cartão/CPF no chat
34. Verificação de link suspeito antes de abrir em nova aba
35. Log de auditoria de quais IAs tiveram acesso a quais dados
36. Exclusão automática de histórico após X dias (configurável)
37. Autenticação de 2 fatores na conta Orbit
38. Aviso visual quando uma resposta de IA cita fonte não verificada
39. Sandbox de teste de link (preview seguro sem abrir de verdade)
40. Exportação/portabilidade de dados do usuário (LGPD)

### 🖥️ Navegação e UX do "browser" (10)

41. Abas fixadas (pinned tabs) para sites usados com frequência
42. Modo leitura (remove distração de páginas de artigo)
43. Bloqueador de anúncios nativo (estilo Brave Shields)
44. Grupos de abas coloridos
45. Busca universal na barra (histórico + abas abertas + web)
46. Modo escuro automático por horário
47. Zoom de página persistente por site
48. Captura de tela de página inteira (scroll completo)
49. Leitor de PDF embutido sem sair do Orbit
50. Sincronização de abas entre dispositivos (se expandir pra mobile)

### 🎨 Geração de mídia avançada (10)

51. Edição de imagem com máscara (apagar/redesenhar área específica)
52. Geração de variações da mesma imagem (4 opções por prompt)
53. Conversão de imagem para diferentes estilos (anime→realista etc.)
54. Geração de ícones/logo em lote com paleta consistente
55. Remoção de fundo automática
56. Geração de áudio/narração a partir de texto (text-to-speech)
57. Geração de vídeo curto a partir de imagem estática (image-to-video)
58. Biblioteca pessoal de imagens geradas (galeria organizada)
59. Prompt assistido: IA sugere melhorias no prompt antes de gerar
60. Marca d'água personalizada opcional (nome/logo da loja do usuário)

### 🛒 Modo Vendedor avançado (10)

61. Análise automática de concorrência (compara preço com anúncios similares)
62. Gerador de calendário de postagens (30 dias de conteúdo)
63. Resposta automática sugerida para avaliações negativas
64. Calculadora de margem de lucro por produto
65. Gerador de nota fiscal simplificada (modelo, não substitui emissor oficial)
66. Análise de sentimento dos comentários do produto
67. Sugestão de kit/combo baseado em produtos frequentemente comprados juntos
68. Rastreador de tendências de busca por categoria
69. Gerador de roteiro de vídeo de unboxing
70. Alertas de estoque baixo com sugestão de reposição

### 🔎 Pesquisa e conhecimento (10)

71. Modo pesquisa profunda: várias buscas encadeadas + relatório final
72. Comparador de preços em tempo real entre marketplaces
73. Resumo automático de reviews de produto (prós/contras)
74. Verificador de fake news com checagem cruzada de fontes
75. Explicador de documentos jurídicos em linguagem simples
76. Assistente de estudo com quiz gerado do material enviado
77. Tradutor de documento completo mantendo formatação
78. Monitor de preço (avisa quando um produto baixar)
79. Resumo de canal do YouTube (últimos vídeos + temas recorrentes)
80. Busca por imagem (enviar foto e encontrar produto parecido)

### 🤝 Colaboração e compartilhamento (10)

81. Compartilhar conversa via link público (somente leitura)
82. Espaço de equipe com histórico compartilhado
83. Comentários em respostas específicas (estilo Google Docs)
84. Exportar prompt como "receita" reutilizável por outros usuários
85. Marketplace interno de prompts criados pela comunidade
86. Modo apresentação (exibir conversa em tela cheia pra reunião)
87. Convite de colega para colaborar em tempo real na mesma conversa
88. Permissões por papel (admin/editor/visualizador) em espaços de equipe
89. Notificação quando alguém responde numa conversa compartilhada
90. Integração com Slack/WhatsApp para receber alertas do Orbit

### 📊 Inteligência do produto (10)

91. Painel de uso pessoal (quantas mensagens, qual IA mais usada)
92. Sugestão proativa de prompt baseada no histórico recente
93. Detecção de perguntas repetidas (sugere reusar resposta anterior)
94. Métricas de satisfação (👍👎 rápido em cada resposta)
95. Relatório semanal de produtividade gerado automaticamente
96. A/B testing interno de qual modelo dá resposta melhor por categoria
97. Onboarding interativo para novos usuários (tour guiado)
98. Modo "atalho do dia" (sugestão diferente a cada login)
99. Central de atualizações (changelog visível dentro do app)
100.  Sistema de conquistas/gamificação leve para engajamento
