// ============================================
// CONFIGURAÇÕES INICIAIS
// ============================================

// CLIENT_ID será injetado pelo GitHub Actions
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE'; // Será substituído automaticamente
const REDIRECT_URI = window.location.origin + window.location.pathname;
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

// Escopos por perfil
const SCOPES = {
    viewer: 'user-read-playback-state',
    manager: 'user-read-playback-state user-modify-playback-state'
};

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================

let accessToken = null; // Token de acesso (armazenado em memória)
let userProfile = 'viewer'; // Perfil do usuário (viewer ou manager)

// ============================================
// FUNÇÕES AUXILIARES DE SEGURANÇA
// ============================================

/**
 * Gera uma string aleatória para uso em PKCE e State
 * @param {number} length - Tamanho da string
 * @returns {string} String aleatória
 */
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Gera o SHA256 hash de uma string (para PKCE)
 * @param {string} plain - String para fazer hash
 * @returns {Promise<string>} Hash em base64url
 */
async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64urlencode(hash);
}

/**
 * Converte ArrayBuffer para base64url
 * @param {ArrayBuffer} buffer - Buffer para converter
 * @returns {string} String em base64url
 */
function base64urlencode(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';
    bytes.forEach(byte => str += String.fromCharCode(byte));
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// ============================================
// FLUXO DE AUTENTICAÇÃO
// ============================================

/**
 * Inicia o fluxo de autenticação OAuth 2.0 com PKCE
 */
async function login() {
    // 1. Obter perfil selecionado
    const selectedProfile = document.querySelector('input[name="profile"]:checked').value;
    userProfile = selectedProfile;
    
    // 2. Gerar code_verifier (segredo)
    const codeVerifier = generateRandomString(128);
    
    // 3. Gerar code_challenge (hash do verifier)
    const codeChallenge = await sha256(codeVerifier);
    
    // 4. Gerar state (proteção CSRF)
    const state = generateRandomString(16);
    
    // 5. Armazenar no sessionStorage (temporário)
    sessionStorage.setItem('pkce_verifier', codeVerifier);
    sessionStorage.setItem('auth_state', state);
    sessionStorage.setItem('user_profile', selectedProfile);
    
    // 6. Construir URL de autorização
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES[selectedProfile],
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        state: state
    });
    
    // 7. Redirecionar para Spotify
    window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/**
 * Processa o callback de autenticação
 */
async function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    
    // Verificar se houve erro
    if (error) {
        showError(`Erro na autenticação: ${error}`);
        return;
    }
    
    // Verificar se há código
    if (!code) {
        return; // Não é um callback
    }
    
    // PROTEÇÃO CSRF: Validar state
    const savedState = sessionStorage.getItem('auth_state');
    if (state !== savedState) {
        showError('Erro de segurança: State inválido (possível ataque CSRF)');
        sessionStorage.clear();
        return;
    }
    
    // Recuperar code_verifier
    const codeVerifier = sessionStorage.getItem('pkce_verifier');
    userProfile = sessionStorage.getItem('user_profile') || 'viewer';
    
    if (!codeVerifier) {
        showError('Erro: Code verifier não encontrado');
        return;
    }
    
    try {
        // Trocar código por token
        const response = await fetch(SPOTIFY_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                code_verifier: codeVerifier
            })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao trocar código por token');
        }
        
        const data = await response.json();
        accessToken = data.access_token;
        
        // Limpar sessionStorage (já não precisamos mais)
        sessionStorage.removeItem('pkce_verifier');
        sessionStorage.removeItem('auth_state');
        
        // Limpar URL (remover parâmetros)
        window.history.replaceState({}, document.title, REDIRECT_URI);
        
        // Mostrar dashboard
        showDashboard();
        
    } catch (error) {
        showError(`Erro na autenticação: ${error.message}`);
    }
}

/**
 * Faz logout do usuário
 */
function logout() {
    // Limpar token da memória
    accessToken = null;
    userProfile = 'viewer';
    
    // Limpar sessionStorage
    sessionStorage.clear();
    
    // Redirecionar para logout do Spotify (encerra sessão remota)
    window.location.href = 'https://www.spotify.com/logout/';
}

// ============================================
// CHAMADAS À API DO SPOTIFY
// ============================================

/**
 * Busca informações da música atual
 */
async function getCurrentTrack() {
    if (!accessToken) {
        showError('Erro: Não autenticado');
        return;
    }
    
    try {
        const response = await fetch(`${SPOTIFY_API_URL}/me/player/currently-playing`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.status === 204) {
            document.getElementById('current-track').innerHTML = 
                '<p class="no-track">Nenhuma música tocando no momento 🎵</p>' +
                '<p class="hint">Abra o Spotify e toque uma música</p>';
            return;
        }
        
        if (!response.ok) {
            if (response.status === 401) {
                showError('Token expirado. Faça login novamente.');
                logout();
                return;
            }
            throw new Error('Erro ao buscar música atual');
        }
        
        const data = await response.json();
        displayTrack(data);
        
    } catch (error) {
        showError(`Erro ao buscar música: ${error.message}`);
    }
}

/**
 * Exibe informações da música
 */
function displayTrack(data) {
    const trackDiv = document.getElementById('current-track');
    
    if (!data || !data.item) {
        trackDiv.innerHTML = '<p class="no-track">Nenhuma música tocando</p>';
        return;
    }
    
    const track = data.item;
    const artists = track.artists.map(artist => artist.name).join(', ');
    const isPlaying = data.is_playing;
    
    trackDiv.innerHTML = `
        <div class="track-details">
            ${track.album.images[0] ? 
                `<img src="${track.album.images[0].url}" alt="Album cover" class="album-cover">` 
                : ''}
            <div class="track-text">
                <h3>${track.name}</h3>
                <p class="artist">${artists}</p>
                <p class="album">${track.album.name}</p>
                <p class="status ${isPlaying ? 'playing' : 'paused'}">
                    ${isPlaying ? '▶️ Tocando' : '⏸️ Pausado'}
                </p>
            </div>
        </div>
    `;
    
    // Atualizar botão play/pause
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.textContent = isPlaying ? '⏸️ Pause' : '▶️ Play';
    }
}

/**
 * Controla playback (apenas para Manager)
 */
async function controlPlayback(action) {
    if (!accessToken) return;
    
    let endpoint = '';
    let method = 'PUT';
    
    switch(action) {
        case 'play':
        case 'pause':
            endpoint = `${SPOTIFY_API_URL}/me/player/${action}`;
            break;
        case 'next':
            endpoint = `${SPOTIFY_API_URL}/me/player/next`;
            method = 'POST';
            break;
        case 'previous':
            endpoint = `${SPOTIFY_API_URL}/me/player/previous`;
            method = 'POST';
            break;
    }
    
    try {
        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok && response.status !== 204) {
            if (response.status === 403) {
                showError('Você precisa de Spotify Premium para usar os controles');
                return;
            }
            throw new Error('Erro ao controlar playback');
        }
        
        // Aguardar um pouco e atualizar
        setTimeout(getCurrentTrack, 500);
        
    } catch (error) {
        showError(`Erro no controle: ${error.message}`);
    }
}

// ============================================
// CONTROLE DA INTERFACE
// ============================================

/**
 * Mostra a tela de dashboard
 */
function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    // Configurar interface baseada no perfil
    const profileType = document.getElementById('user-profile-type');
    const controlsSection = document.getElementById('controls-section');
    
    if (userProfile === 'manager') {
        profileType.textContent = '🎮 Manager';
        controlsSection.classList.remove('hidden');
    } else {
        profileType.textContent = '👁️ Viewer';
        controlsSection.classList.add('hidden');
    }
    
    // Buscar música atual
    getCurrentTrack();
}

/**
 * Mostra mensagem de erro
 */
function showError(message) {
    const errorBanner = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    errorText.textContent = message;
    errorBanner.classList.remove('hidden');
    
    // Auto-ocultar após 5 segundos
    setTimeout(() => {
        errorBanner.classList.add('hidden');
    }, 5000);
}

/**
 * Oculta mensagem de erro
 */
function hideError() {
    document.getElementById('error-message').classList.add('hidden');
}

// ============================================
// EVENTOS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Verificar se é callback
    handleCallback();
    
    // Botão de login
    document.getElementById('login-btn').addEventListener('click', login);
    
    // Botão de logout
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Botão de atualizar
    document.getElementById('refresh-btn').addEventListener('click', getCurrentTrack);
    
    // Botões de controle (Manager apenas)
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', async () => {
            const isPaused = playPauseBtn.textContent.includes('Play');
            await controlPlayback(isPaused ? 'play' : 'pause');
        });
    }
    
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => controlPlayback('next'));
    }
    
    const previousBtn = document.getElementById('previous-btn');
    if (previousBtn) {
        previousBtn.addEventListener('click', () => controlPlayback('previous'));
    }
});