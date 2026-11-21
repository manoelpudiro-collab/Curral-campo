# Curral Digital — app de campo

App para o celular (fica na tela de início) com a ficha de cada animal das fazendas MD e 3C.
Funciona **sem internet**: guarda no celular uma cópia do rebanho e atualiza sozinho quando pega sinal.

- Entrada: no Telegram, mande `/app` ao bot do Curral Digital e digite o código de 6 dígitos.
- Os dados ficam no Supabase; este repositório só tem as telas. Nenhuma senha ou chave fica aqui.
- A conversa com o banco passa pela função `app-campo` do Supabase, que confere a chave de cada aparelho.

Arquivos: `index.html` (tela), `app.css` (visual), `app.js` (funcionamento), `sw.js` (guarda o app para abrir sem internet),
`manifest.webmanifest` e `icones/` (ícone da tela de início).
