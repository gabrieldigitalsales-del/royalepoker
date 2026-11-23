# Base NEXOR — Poker Royale

## Publicação e SEO
- Página pública / indexável: `/` (homepage e lobby público).
- `robots.txt` e `sitemap.xml` anunciam apenas a homepage; áreas de conta, mesas e administração **não devem ser indexadas**.
- `index.html`: título, descrição, canonical, Open Graph, Twitter Card, idioma, mobile, theme-color, JSON-LD WebApplication e noscript.
- `manifest.webmanifest`, favicon e Apple Touch Icon identificam o PWA em Android e iOS.
- `public/sw.js` mantém o modo PWA; validar atualização do cache a cada versão.

## Proteção
- Cabeçalhos HTTP no servidor: X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Content-Security-Policy de enquadramento e recursos ativos, Permissions-Policy e HSTS sobre HTTPS.
- Resposta HTML de rotas de perfil, admin, mesa e histórico com `X-Robots-Tag: noindex, nofollow, noarchive`.
- Acesso ao banco reservado ao serviço; não disponibilizar senhas no código, manifesto ou `.env.example`.
- API administrativa exige conta `admin` **e** segundo fator por senha com sessão limitada (Render: `POKER_ROYALE_ADMIN_CODE`). Nenhuma senha em texto puro no GitHub.
- Regras monetárias, Dealer Choice e congelamento de cronômetros validados no servidor.
- `robots.txt` **não é mecanismo de segurança**: rotas privadas permanecem protegidas por autorização de API.

## Navegação
- Erros, desconexões e manutenção exibidos com avisos personalizados, evitando `window.alert`, `window.confirm` ou `window.prompt`.
- Acessibilidade: avisos com `role=status`/`alertdialog`; contraste e visual mobile.

## Implantação
- `npm ci`, `npm run build`, `npm run test:smoke`, e testes de integração pelo GitHub Actions.
- Deploy automático do branch `main` no Render.
- Não indexar nem divulgar dados das mesas privadas, saldo, usuários e administração.
- Revisar canonical e sitemap ao migrar para domínio próprio.
