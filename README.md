# Manual Completo: Implementação OAuth 2.0 com Spotify

## 📋 Índice
1. [Configuração Inicial no Spotify](#1-configuração-inicial-no-spotify)
2. [Estrutura do Projeto](#2-estrutura-do-projeto)
3. [Implementação do Código](#3-implementação-do-código)
4. [Configuração do GitHub](#4-configuração-do-github)
5. [Configuração do GitHub Actions](#5-configuração-do-github-actions)
6. [Como Funciona (Explicação Técnica)](#6-como-funciona-explicação-técnica)
7. [Testando a Aplicação](#7-testando-a-aplicação)

---

## 1. Configuração Inicial no Spotify

### 1.1 Criar Conta de Desenvolvedor
1. Acesse: https://developer.spotify.com/dashboard
2. Faça login com sua conta Spotify (ou crie uma)
3. Aceite os termos de desenvolvedor

### 1.2 Criar Aplicação
1. Clique em "Create app"
2. Preencha:
   - **App name**: Spotify OAuth Player
   - **App description**: Aplicação de controle de player do Spotify
   - **Redirect URI**: `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`
   - **Which API/SDKs are you planning to use**: Web API
3. Marque a caixa de aceite dos termos
4. Clique em "Save"

### 1.3 Obter Credenciais
1. Na página da sua aplicação, clique em "Settings"
2. Copie o **Client ID** (você vai precisar dele depois)
3. **NÃO use o Client Secret** (não é necessário para PKCE)

---

## 2. Estrutura do Projeto

Crie um repositório no GitHub com a seguinte estrutura:

```
spotify-oauth-app/
├── index.html
├── app.js
├── styles.css
├── .github/
│   └── workflows/
│       └── deploy.yml
└── README.md
```

---

## 3. Implementação do Código

### 3.1 Arquivo: index.html
Este é o arquivo principal da aplicação.

**O que ele faz:**
- Define a estrutura visual da página
- Mostra botão de login quando não autenticado
- Mostra dashboard quando autenticado
- Divide funcionalidades entre Viewer (ver) e Manager (controlar)

### 3.2 Arquivo: app.js
Este é o cérebro da aplicação.

**O que ele faz:**
1. **Geração PKCE**: Cria códigos de segurança
2. **Login**: Redireciona para Spotify
3. **Callback**: Recebe autorização e troca por token
4. **Validação de Escopo**: Verifica permissões do usuário
5. **Chamadas API**: Busca e controla música no Spotify

### 3.3 Arquivo: styles.css
Define o visual da aplicação.

---

## 4. Configuração do GitHub

### 4.1 Criar Repositório
1. Acesse GitHub: https://github.com
2. Clique em "New repository"
3. Nome: `spotify-oauth-app` (ou outro nome)
4. Marque como **Público**
5. Clique em "Create repository"

### 4.2 Adicionar Client ID como Secret
1. No seu repositório, vá em **Settings**
2. Na barra lateral, clique em **Secrets and variables** → **Actions**
3. Clique em "New repository secret"
4. Nome: `SPOTIFY_CLIENT_ID`
5. Value: Cole o Client ID que você copiou do Spotify
6. Clique em "Add secret"

### 4.3 Habilitar GitHub Pages
1. No repositório, vá em **Settings**
2. Na barra lateral, clique em **Pages**
3. Em "Source", selecione **GitHub Actions**

---

## 5. Configuração do GitHub Actions

### 5.1 Criar Workflow
O arquivo `.github/workflows/deploy.yml` automatiza o deploy.

**O que ele faz:**
1. **Trigger**: Executa quando você faz push ou manualmente
2. **Injeta CLIENT_ID**: Pega o secret e coloca no código
3. **Deploy**: Publica automaticamente no GitHub Pages

### 5.2 Como Funciona a Injeção
```bash
sed -i "s/YOUR_CLIENT_ID_HERE/${{ secrets.SPOTIFY_CLIENT_ID }}/g" app.js
```
Esta linha substitui o texto `YOUR_CLIENT_ID_HERE` pelo Client ID real.

---

## 6. Como Funciona (Explicação Técnica)

### 6.1 O que é OAuth 2.0?
OAuth 2.0 é um protocolo que permite que sua aplicação acesse dados do Spotify **sem** precisar da senha do usuário.

**Analogia:** É como um "vale" temporário que o Spotify dá para você, permitindo acesso limitado.

### 6.2 O que é PKCE?
PKCE (Proof Key for Code Exchange) adiciona segurança extra para aplicações públicas.

**Como funciona:**
1. **code_verifier**: Uma string aleatória secreta (43-128 caracteres)
2. **code_challenge**: SHA256 hash do verifier
3. Você envia o **challenge** ao Spotify
4. Depois, envia o **verifier** para provar que é você

**Por que é seguro?**
- Mesmo que alguém intercepte o código de autorização, não consegue trocar por token sem o verifier
- O verifier nunca é transmitido na URL, só o challenge

### 6.3 Proteção contra CSRF (State)
**O que é CSRF?** Um ataque onde alguém tenta fazer você autenticar sem querer.

**Como protegemos:**
1. Geramos um `state` aleatório antes do login
2. Enviamos para o Spotify
3. Spotify devolve o mesmo `state`
4. Validamos se é o mesmo → se não for, pode ser ataque!

### 6.4 Fluxo Completo

```
1. Usuário clica "Login"
   ↓
2. App gera code_verifier e code_challenge
   ↓
3. App redireciona para Spotify com challenge
   ↓
4. Usuário autoriza no Spotify
   ↓
5. Spotify redireciona de volta com código
   ↓
6. App troca código + verifier por access_token
   ↓
7. App usa token para acessar API do Spotify
```

### 6.5 Escopos (Scopes)

**Perfil Viewer:**
- `user-read-playback-state`: Ver o que está tocando
- Mostra: Nome da música, artista, álbum

**Perfil Manager:**
- `user-read-playback-state`: Ver o que está tocando
- `user-modify-playback-state`: Controlar player
- Mostra: Nome da música + botões Play/Pause/Skip

### 6.6 Segurança do Token

**Onde NÃO armazenar:**
- ❌ localStorage (persiste mesmo após fechar o navegador)
- ❌ Cookies sem flags de segurança

**Onde armazenar:**
- ✅ sessionStorage (é limpo ao fechar o navegador)
- ✅ Variável em memória (ainda mais seguro)

**Por quê?**
- Tokens em localStorage podem ser roubados por scripts maliciosos (XSS)
- sessionStorage limita o tempo de exposição

---

## 7. Testando a Aplicação

### 7.1 Teste como Viewer
1. No código, mantenha apenas: `user-read-playback-state`
2. Faça login
3. Você verá: Informações da música atual
4. Você NÃO verá: Botões de controle

### 7.2 Teste como Manager
1. No código, adicione: `user-modify-playback-state`
2. Faça login
3. Você verá: Informações + Botões de controle
4. Teste clicar em Play/Pause/Skip

### 7.3 Teste de Segurança

**Teste 1 - State (CSRF Protection):**
1. Faça login normalmente
2. Na URL de retorno, altere o parâmetro `state`
3. A aplicação deve rejeitar e mostrar erro

**Teste 2 - Token Storage:**
1. Faça login
2. Abra DevTools → Application → Session Storage
3. Você deve ver apenas `pkce_verifier` e `auth_state`
4. NÃO deve ver `access_token` no localStorage

**Teste 3 - Logout:**
1. Faça login
2. Clique em "Logout"
3. Verifique que o token foi removido
4. Você deve ser redirecionado para logout do Spotify

---

## 8. Resolução de Problemas

### Erro: "Invalid redirect URI"
**Causa:** A URL de redirecionamento não está configurada no Spotify
**Solução:** Adicione a URL exata do GitHub Pages no Dashboard do Spotify

### Erro: "Invalid client"
**Causa:** CLIENT_ID incorreto
**Solução:** Verifique se o secret no GitHub está correto

### Música não aparece
**Causa:** Você precisa estar com Spotify tocando música
**Solução:** Abra o Spotify (app ou web) e toque uma música

### Botões não funcionam
**Causa:** Você precisa do Spotify Premium para controlar playback
**Solução:** A API de controle requer Premium

---

## 9. Conceitos Importantes para o Vídeo

### 9.1 Destaque Estes Pontos

**1. Segurança:**
- "PKCE adiciona uma camada extra de segurança"
- "State protege contra ataques CSRF"
- "Token nunca fica exposto em localStorage"

**2. OAuth vs Senha:**
- "Nunca pedimos a senha do Spotify"
- "Usuário autoriza diretamente no site do Spotify"
- "Podemos revogar acesso a qualquer momento"

**3. Escopos:**
- "Princípio do menor privilégio"
- "Viewer só lê, Manager controla"
- "Interface muda baseado nas permissões"

### 9.2 Demonstrações Visuais

1. **Mostrar o Dashboard do Spotify** (criar app)
2. **Mostrar o GitHub Secrets** (adicionar CLIENT_ID)
3. **Mostrar o fluxo de login** (redirecionamento)
4. **Mostrar DevTools** (Network e Storage)
5. **Mostrar diferença Viewer vs Manager**

---

## 10. Checklist Final



- [ ] Aplicação criada no Spotify Developer Dashboard
- [ ] Client ID copiado
- [ ] Repositório criado no GitHub
- [ ] Client ID adicionado como Secret
- [ ] GitHub Pages habilitado
- [ ] Código commitado e push feito
- [ ] Workflow executado com sucesso
- [ ] Aplicação acessível pela URL do GitHub Pages
- [ ] Login funcionando
- [ ] API retornando dados
- [ ] Logout funcionando
- [ ] Documentação README.md criada

---

## 11. Comandos Git Importantes

```bash
# Criar repositório local
git init

# Adicionar todos os arquivos
git add .

# Fazer commit
git commit -m "Implementação OAuth 2.0 com PKCE"

# Adicionar repositório remoto
git remote add origin https://github.com/SEU-USUARIO/spotify-oauth-app.git

# Enviar para GitHub
git push -u origin main

# Ver status do workflow
# Acesse: https://github.com/SEU-USUARIO/spotify-oauth-app/actions
```

---


## Recursos Adicionais

- **Documentação Spotify:** https://developer.spotify.com/documentation/web-api
- **RFC PKCE:** https://datatracker.ietf.org/doc/html/rfc7636
- **OAuth 2.0:** https://oauth.net/2/

---

**Criado por:** Iran  
**Data:** Dezembro 2025  
**Versão:** 1.0