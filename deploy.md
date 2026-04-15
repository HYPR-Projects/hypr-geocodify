# 🚀 Guia de Deploy — HYPR Geocodify

## O que você vai precisar
- Conta no [Netlify](https://netlify.com) (gratuito)
- Conta no [Google Cloud Console](https://console.cloud.google.com) (gratuito)
- Chave HERE API (você já tem)
- Chave Google Places API (New) — para Places Discovery

---

## PASSO 1 — Criar o OAuth App no Google Cloud

1. Acesse https://console.cloud.google.com
2. Crie um novo projeto (ex: "HYPR Geocodify")
3. No menu lateral: **APIs & Services → Credentials**
4. Clique em **+ CREATE CREDENTIALS → OAuth client ID**
5. Tipo: **Web application**
6. Nome: `HYPR Geocodify`
7. Em **Authorized JavaScript origins**, adicione:
   - `http://localhost:8888` (para testar localmente)
   - `https://SEU-SITE.netlify.app` (após deploy)
8. Clique em **CREATE**
9. Copie o **Client ID** (formato: `xxxx.apps.googleusercontent.com`)

---

## PASSO 2 — Habilitar a Google Places API (New)

1. No mesmo projeto do Google Cloud Console
2. Vá em **APIs & Services → Library**
3. Busque **"Places API (New)"** e clique em **Enable**
4. Vá em **Credentials → + CREATE CREDENTIALS → API Key**
5. Copie a API Key gerada
6. (Recomendado) Restrinja a key: **Application restrictions → HTTP referrers** → adicione `https://SEU-SITE.netlify.app/*`
7. (Recomendado) Restrinja a key: **API restrictions → Restrict key** → selecione apenas "Places API (New)"

---

## PASSO 3 — Inserir o Client ID no index.html

Abra o `index.html` e localize esta linha:

```js
const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || 'SEU_CLIENT_ID_AQUI.apps.googleusercontent.com';
```

Substitua `SEU_CLIENT_ID_AQUI.apps.googleusercontent.com` pelo Client ID que você copiou.

---

## PASSO 4 — Deploy no Netlify

### Opção A: Via interface (mais fácil)

1. Acesse https://netlify.com e faça login
2. Clique em **Add new site → Deploy manually**
3. Arraste a pasta `hypr-geocodify` inteira para a área indicada
4. Aguarde o deploy (menos de 1 minuto)
5. Anote a URL gerada (ex: `https://amazing-name-123.netlify.app`)

### Opção B: Via GitHub (recomendado para atualizações futuras)

1. Suba a pasta `hypr-geocodify` para um repositório GitHub
2. No Netlify: **Add new site → Import from Git**
3. Conecte o repositório
4. Build settings: deixe em branco (site estático)
5. Clique em **Deploy**

---

## PASSO 5 — Configurar variáveis de ambiente no Netlify

1. No painel do Netlify, vá em **Site configuration → Environment variables**
2. Adicione as seguintes variáveis:

| Key | Value |
|-----|-------|
| `HERE_API_KEY` | (copie da variável existente no Vercel — não commitar no repo) |
| `GOOGLE_PLACES_API_KEY` | Sua API Key do Google Cloud (passo 2) |

3. Clique em **Save**
4. Vá em **Deploys → Trigger deploy** para o site usar as novas variáveis

---

## PASSO 6 — Atualizar o Google OAuth com a URL do Netlify

1. Volte ao Google Cloud Console → **Credentials**
2. Edite o OAuth client que você criou
3. Em **Authorized JavaScript origins**, adicione a URL do seu site Netlify
   (ex: `https://amazing-name-123.netlify.app`)
4. Salve

---

## PASSO 7 — Testar

1. Acesse a URL do seu site Netlify
2. Clique em **Sign in with Google**
3. Entre com uma conta `@hypr.mobi`
4. Teste cada modo:
   - **Gerar Lat/Lon** — upload CSV com endereços
   - **Gerar Endereços** — upload CSV com lat/lon
   - **Varejo 360** — upload base Kantar
   - **Places Discovery** — selecione estados + tipo de estabelecimento

---

## Estrutura de arquivos

```
hypr-geocodify/
├── index.html                       ← Site principal
├── netlify.toml                     ← Configuração Netlify
├── deploy.md                        ← Este guia
└── netlify/
    └── functions/
        ├── geocode.js               ← Proxy HERE API (placeholder)
        └── places-search.js         ← Proxy Google Places API (New)
```

---

## Custos da Google Places API

O Places Discovery usa a estratégia de menor custo possível:

| Fase | SKU | Custo |
|------|-----|-------|
| Busca de IDs | Text Search Essentials (IDs Only) | **Grátis e ilimitado** |
| Enriquecimento | Place Details Essentials | **$5/1.000 chamadas** · 10.000 free/mês |

Na prática, até ~10.000 places por mês saem **de graça**. Acima disso, cada 1.000 places extras custam $5.

---

## Solução de problemas

**"Acesso negado" no login**
→ Verifique se o email é `@hypr.mobi`

**"HERE_API_KEY não configurada"**
→ Verifique se adicionou a variável de ambiente no Netlify e fez redeploy

**"GOOGLE_PLACES_API_KEY not configured"**
→ Adicione a variável `GOOGLE_PLACES_API_KEY` nas env vars do Netlify e faça redeploy

**Botão Google não aparece**
→ Verifique se o Client ID está correto no `index.html`

**Places Discovery retorna poucos resultados**
→ A API retorna no máximo 60 resultados por ponto de busca. Para áreas grandes, o sistema faz grid automático. Se a rede buscada é pequena, é normal ter poucos resultados.

**"Token inválido"**
→ Verifique se a URL do site está na lista de "Authorized JavaScript origins" no Google Cloud

---

## Adicionar novos usuários

Qualquer pessoa com email `@hypr.mobi` consegue acessar automaticamente.
Não é necessário convidar individualmente.
