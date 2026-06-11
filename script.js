'use strict';

// ─── Estado ───────────────────────────────────────────────────────────────────
const state = {
    hymns: [],       // array carregado de hinos.json
    fontLevel: 0,    // -3 … +5 passos de 2px
    theme: 'light',
    query: '',
};

const FONT_BASE = 16;
const FONT_STEP = 2;
const FONT_MIN  = -3;
const FONT_MAX  = 5;

// ─── Utilitários ──────────────────────────────────────────────────────────────
function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalize(str) {
    return String(str)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();
}

// Destaca ocorrências de `query` dentro de `text` (case/accent-insensitive)
function highlight(text, query) {
    if (!query) return esc(text);
    const nt = normalize(text);
    const nq = normalize(query);
    let out = '';
    let i = 0;
    while (i < text.length) {
        const pos = nt.indexOf(nq, i);
        if (pos === -1) { out += esc(text.slice(i)); break; }
        out += esc(text.slice(i, pos));
        out += `<mark>${esc(text.slice(pos, pos + query.length))}</mark>`;
        i = pos + query.length;
    }
    return out;
}

// ─── Renderizador de conteúdo ─────────────────────────────────────────────────
// Linhas em branco → novo parágrafo. Todo o resto (incluindo CORO:) é texto normal.
function renderContent(content) {
    const lines = content.split('\n');
    let html = '';
    let buf = [];

    function flush() {
        if (!buf.length) return;
        html += `<p class="verse">${buf.join('<br>')}</p>`;
        buf = [];
    }

    for (const line of lines) {
        const t = line.trim();
        if (t === '') {
            flush();
        } else {
            buf.push(esc(t));
        }
    }
    flush();
    return html;
}

// ─── Dados ────────────────────────────────────────────────────────────────────
async function loadHymns() {
    const resp = await fetch('hinos.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
}

// ─── Views ────────────────────────────────────────────────────────────────────
const $app = () => document.getElementById('app');

function showLoading(msg = 'Carregando...') {
    $app().innerHTML = `<div class="loading-state"><p>${esc(msg)}</p></div>`;
}

function showSetup() {
    $app().innerHTML = `
        <div class="setup-state">
            <h2>Hinário ainda não gerado</h2>
            <p>O arquivo <code>hinos.json</code> não foi encontrado.</p>
            <p>Execute o script de extração:</p>
            <pre>pip install pdfplumber
python extract_hinos.py "Hinário Junco.pdf"</pre>
            <p>Depois inicie um servidor local para testar:</p>
            <pre>python -m http.server 8080</pre>
            <p>Acesse <code>http://localhost:8080</code> no navegador.</p>
        </div>`;
}

// Renderiza a lista completa (ou filtrada por busca)
function renderIndex(query = '') {
    const nq = normalize(query);

    const filtered = nq
        ? state.hymns.filter(h =>
            String(h.number).includes(nq) ||
            normalize(h.title).includes(nq) ||
            (h.search && h.search.includes(nq))
          )
        : state.hymns;

    const countMsg = nq
        ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} para "${esc(query)}"`
        : `${state.hymns.length} hinos`;

    const items = filtered.map(h => {
        const num = String(h.number).padStart(3, '0');
        const titleHTML = query ? highlight(h.title, query) : esc(h.title);
        return `<li>
            <a href="#${h.id}" class="hymn-item">
                <span class="hymn-num">${num}</span>
                <span class="hymn-title">${titleHTML}</span>
            </a>
        </li>`;
    }).join('');

    $app().innerHTML = `
        <div class="index-header">
            <h2>Sumário</h2>
            <span class="index-count">${countMsg}</span>
        </div>
        ${items
            ? `<ul class="hymn-list">${items}</ul>`
            : `<p class="no-results">Nenhum hino encontrado para "<em>${esc(query)}</em>".</p>`
        }`;
}

// Renderiza um hino pelo id (ex: "042")
function renderHymn(id) {
    const idx = state.hymns.findIndex(h => h.id === id);
    if (idx === -1) {
        $app().innerHTML = `
            <div class="error-state">
                <p>Hino <strong>${esc(id)}</strong> não encontrado.</p>
                <br>
                <a href="#" class="btn">← Voltar ao sumário</a>
            </div>`;
        return;
    }

    const h    = state.hymns[idx];
    const prev = state.hymns[idx - 1] || null;
    const next = state.hymns[idx + 1] || null;
    const pos  = `${idx + 1} de ${state.hymns.length}`;

    const atMin = state.fontLevel <= FONT_MIN;
    const atMax = state.fontLevel >= FONT_MAX;

    // Barra de navegação (reutilizada no topo e no rodapé)
    const nav = (showPos) => `
        <nav class="hymn-nav${showPos ? ' hymn-nav--top' : ''}">
            <div class="nav-left">
                <a href="#" class="btn">← Sumário</a>
                <button class="btn js-font-dec" title="Diminuir fonte"${atMin ? ' disabled' : ''}>A−</button>
                <button class="btn js-font-inc" title="Aumentar fonte"${atMax ? ' disabled' : ''}>A+</button>
            </div>
            ${showPos ? `<span class="hymn-pos">${pos}</span>` : '<span></span>'}
            <div class="nav-arrows">
                ${prev
                    ? `<a href="#${prev.id}" class="btn" title="${esc(prev.title)}">‹ Anterior</a>`
                    : `<button class="btn" disabled>‹ Anterior</button>`}
                ${next
                    ? `<a href="#${next.id}" class="btn btn-primary" title="${esc(next.title)}">Próximo ›</a>`
                    : `<button class="btn" disabled>Próximo ›</button>`}
            </div>
        </nav>`;

    $app().innerHTML = `
        ${nav(true)}
        <article class="hymn-card">
            <h1 class="hymn-card-title">${h.number}.</h1>
            <div class="hymn-body">${renderContent(h.content)}</div>
        </article>
        ${nav(false)}`;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Tema ─────────────────────────────────────────────────────────────────────
function applyTheme(t) {
    state.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('btn-theme').textContent = t === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('hinario-theme', t);
}

function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// ─── Tamanho de fonte ─────────────────────────────────────────────────────────
function applyFont(level) {
    state.fontLevel = Math.max(FONT_MIN, Math.min(FONT_MAX, level));
    const px = FONT_BASE + state.fontLevel * FONT_STEP;
    document.documentElement.style.setProperty('--hymn-font', `${px}px`);
    localStorage.setItem('hinario-font', state.fontLevel);
    // Atualiza disabled nos botões dinâmicos dentro da página do hino
    document.querySelectorAll('.js-font-dec').forEach(b => { b.disabled = state.fontLevel <= FONT_MIN; });
    document.querySelectorAll('.js-font-inc').forEach(b => { b.disabled = state.fontLevel >= FONT_MAX; });
}

// ─── Roteador ─────────────────────────────────────────────────────────────────
// Usa o hash da URL: '#042' → hino 042; '#' ou vazio → índice
function router() {
    const hash = window.location.hash.slice(1); // remove o '#'
    if (hash && hash !== '/') {
        renderHymn(hash);
    } else {
        renderIndex(state.query);
    }
}

// ─── Busca ────────────────────────────────────────────────────────────────────
function handleSearch(e) {
    const q = e.target.value.trim();
    state.query = q;

    // Se estiver num hino, volta ao índice sem adicionar entrada no histórico
    if (window.location.hash.length > 1) {
        history.replaceState(null, '', '#');
    }
    renderIndex(q);
}

// ─── Inicialização ────────────────────────────────────────────────────────────
async function init() {
    // Restaura preferências salvas
    applyTheme(localStorage.getItem('hinario-theme') || 'light');
    applyFont(parseInt(localStorage.getItem('hinario-font') || '0', 10));

    // Botão home (logo)
    document.getElementById('btn-home').addEventListener('click', () => {
        state.query = '';
        document.getElementById('search-input').value = '';
        history.replaceState(null, '', '#');
        renderIndex('');
    });

    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('search-input').addEventListener('input', handleSearch);

    // Delegação para os botões de fonte (ficam dentro do hino, gerados dinamicamente)
    document.getElementById('app').addEventListener('click', e => {
        if (e.target.classList.contains('js-font-dec')) applyFont(state.fontLevel - 1);
        if (e.target.classList.contains('js-font-inc')) applyFont(state.fontLevel + 1);
    });

    // Navegação pelo hash da URL
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(1);
        if (!hash || hash === '/') {
            renderIndex(state.query);
        } else {
            document.getElementById('search-input').value = '';
            state.query = '';
            renderHymn(hash);
        }
    });

    // Carrega dados
    showLoading('Carregando hinário...');
    try {
        state.hymns = await loadHymns();
        router();
    } catch {
        showSetup();
    }
}

document.addEventListener('DOMContentLoaded', init);
