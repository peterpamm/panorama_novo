# Como publicar no servidor da empresa

Este app é uma SPA (Vite + React) que fala direto com o Supabase (banco,
login e storage já ficam na nuvem) — o servidor só precisa **servir arquivos
estáticos**. Não precisa de Node.js instalado lá, não precisa rodar nada em
background, não é um "site com backend".

Hoje ele já é publicado assim automaticamente no Netlify (ver
`netlify.toml` na raiz do projeto) — o passo a passo abaixo é o mesmo
processo, só que manual, pro servidor interno.

## 1. Gerar o build (na sua máquina, antes de mandar pro servidor)

```
npm install
npm run build
```

Isso cria a pasta `dist/` com só HTML/CSS/JS otimizado — é **só essa
pasta** que deve ser zipada e mandada pro servidor. Não mande a pasta do
projeto inteira: `node_modules/` (não é usado em runtime), `dados/`
(CSVs financeiros reais, não sai da sua máquina) e `.env.local` (as chaves
já ficam embutidas dentro do JS gerado pelo build — não precisa do arquivo
cru no servidor) não têm nada a fazer lá.

O build usa o `.env.local` que estiver na sua máquina no momento de rodar
`npm run build` — confirma que ele aponta pro projeto Supabase certo antes
de gerar o zip.

## 2. Configurar o servidor pra SPA (rota interna do React)

O app usa rotas internas (`/area-financeira/rotinas`, `/sdg-corporativo`
etc.) controladas pelo React, não pelo servidor. Um servidor de arquivos
"cru" só conhece o `index.html` — se alguém der F5 numa dessas rotas, ou
acessar o link direto, o servidor tenta achar um arquivo físico com aquele
nome e devolve 404. Precisa configurar um "fallback": qualquer rota que não
bate com um arquivo real cai de volta pro `index.html`.

O arquivo certo pra usar já está pronto nesta pasta, conforme o servidor
que o pessoal for usar:

- **IIS** (mais comum em infra Windows) → `web.config` — copia pra dentro
  de `dist/` antes de zipar. Exige o módulo *URL Rewrite* instalado no IIS.
- **Nginx** → `nginx.conf.snippet` — cola dentro do `server { ... }` deles,
  ajustando `root` e `server_name`.
- **Apache** → `.htaccess` — copia pra dentro de `dist/` antes de zipar.
  Exige `mod_rewrite` habilitado.

## 3. Outros pontos pra confirmar com o pessoal de infra

- **HTTPS**: o ideal é rodar atrás de TLS (o login/Supabase funciona sobre
  HTTP também, mas HTTPS é o padrão esperado por navegadores modernos).
- **Domínio na raiz**: hoje o app espera ser servido na raiz do domínio
  (`empresa.com/`, sem subpasta tipo `empresa.com/panorama/`). Se for
  hospedar num subcaminho, avisa que precisa de um ajuste no
  `vite.config.ts` (`base`) antes do build — não é automático.
