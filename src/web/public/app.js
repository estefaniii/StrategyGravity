// ─── StrategyGravity Frontend App ───

let currentStrategy = null;
let eventSource = null;
const sessionId = crypto.randomUUID();

// ─── Provider Diagnostics Panel ───
const PROVIDER_LABELS = {
  claude: 'Claude',
  gemini: 'Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

function renderProviderPanel(data) {
  const list = document.getElementById('provider-list');
  if (!list || !data?.providers) return;

  const providers = data.providers;
  const order = ['claude', 'gemini', 'groq', 'openrouter'];

  list.innerHTML = order.map(name => {
    const p = providers[name];
    if (!p) return '';

    const dotClass = p.working ? 'dot-ok' : 'dot-fail';
    const label = PROVIDER_LABELS[name] || name;
    const hint = p.working ? '' : (p.error ? '⚠' : '');
    const hasLink = !p.working && p.dashboardUrl;

    let tooltip = '';
    if (!p.working) {
      const errorText = p.error ? `<div class="tooltip-error">${escapeHtml(p.error.slice(0, 150))}</div>` : '';
      const suggestionText = p.suggestion ? `<div class="tooltip-suggestion">${escapeHtml(p.suggestion)}</div>` : '';
      const linkText = p.dashboardUrl ? `<a class="tooltip-link" href="${p.dashboardUrl}" target="_blank" rel="noopener">Abrir dashboard →</a>` : '';
      tooltip = `<div class="provider-tooltip">${errorText}${suggestionText}${linkText}</div>`;
    } else if (p.suggestion) {
      tooltip = `<div class="provider-tooltip"><div class="tooltip-suggestion">${escapeHtml(p.suggestion)}</div></div>`;
    }

    const onClick = hasLink ? `onclick="window.open('${p.dashboardUrl}','_blank')"` : '';
    const linkClass = hasLink ? 'has-link' : '';

    return `<div class="provider-item ${linkClass}" ${onClick}>
      <span class="provider-dot ${dotClass}"></span>
      <span class="provider-name">${label}</span>
      ${hint ? `<span class="provider-hint">${hint}</span>` : ''}
      ${tooltip}
    </div>`;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function refreshDiagnostics(forceRefresh = false) {
  const btn = document.querySelector('.provider-refresh-btn');
  if (btn) btn.classList.add('spinning');

  const list = document.getElementById('provider-list');
  if (list) {
    list.innerHTML = '<div class="provider-item loading"><span class="provider-dot dot-loading"></span><span class="provider-name">Diagnosticando...</span></div>';
  }

  try {
    const url = forceRefresh ? '/api/diagnose?refresh=true' : '/api/diagnose';
    const resp = await fetch(url);
    const data = await resp.json();
    renderProviderPanel(data);

    const working = data.summary?.totalWorking || 0;
    if (working === 0) {
      showToast('Ningún proveedor LLM funcional', 'error');
    } else {
      showToast(`${working} proveedor${working > 1 ? 'es' : ''} activo${working > 1 ? 's' : ''}`, 'success');
    }
  } catch (err) {
    if (list) {
      list.innerHTML = '<div class="provider-item"><span class="provider-dot dot-fail"></span><span class="provider-name">Error al diagnosticar</span></div>';
    }
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
}

// Auto-load diagnostics on page load (uses cached results from server startup)
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => refreshDiagnostics(false), 3000);
});

// ─── Toast Notifications ───
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── View Management ───
function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

  if (viewName === 'history') loadHistory();
  if (viewName === 'strategy' && currentStrategy) renderStrategy(currentStrategy);
}

// ─── New Strategy (reset and go home) ───
function newStrategy() {
  document.getElementById('progress-section').classList.add('hidden');
  document.getElementById('input-url').value = '';
  document.getElementById('input-instagram').value = '';
  document.getElementById('input-description').value = '';
  document.querySelectorAll('.btn-primary').forEach(b => b.disabled = false);
  showView('home');
}

// ─── Go Back to History ───
function goBack() {
  showView('history');
}

// ─── Tab Switching ───
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
}

// ─── Questionnaire State ───
let pendingStrategyType = null;
let pendingStrategyBody = {};
let pendingStrategyEndpoint = '';

// ─── Start Strategy Generation (shows questionnaire first) ───
function startStrategy(type) {
  let body = {};
  let endpoint = '';

  if (type === 'url') {
    const url = document.getElementById('input-url').value.trim();
    if (!url) return alert('Ingresa una URL');
    body = { url, sessionId };
    endpoint = '/api/strategy/url';
  } else if (type === 'instagram') {
    const handle = document.getElementById('input-instagram').value.trim();
    if (!handle) return alert('Ingresa un handle de Instagram');
    body = { handle, sessionId };
    endpoint = '/api/strategy/instagram';
  } else {
    const desc = document.getElementById('input-description').value.trim();
    if (!desc) return alert('Ingresa una descripción');
    body = { description: desc, sessionId };
    endpoint = '/api/strategy/description';
  }

  // Store pending data and show questionnaire
  pendingStrategyType = type;
  pendingStrategyBody = body;
  pendingStrategyEndpoint = endpoint;
  showQuestionnaire(type, body);
}

// ─── Show Questionnaire Modal ───
function showQuestionnaire(type, inputData) {
  // Reset form defaults
  document.getElementById('q-country').value = '';
  document.getElementById('q-style').value = 'Moderno y Minimalista';
  document.getElementById('q-heading-font').value = 'Montserrat';
  document.getElementById('q-body-font').value = 'Inter';
  document.getElementById('q-color-primary').value = '#7C5CFC';
  document.getElementById('q-color-secondary').value = '#C084FC';
  document.getElementById('q-color-accent').value = '#F472B6';

  // Show the overlay
  document.getElementById('questionnaire-overlay').classList.remove('hidden');
}

// ─── Close Questionnaire Modal ───
function closeQuestionnaire() {
  document.getElementById('questionnaire-overlay').classList.add('hidden');
  pendingStrategyType = null;
  pendingStrategyBody = {};
  pendingStrategyEndpoint = '';
}

// ─── Submit Questionnaire & Proceed with API Call ───
async function submitQuestionnaire() {
  const country = document.getElementById('q-country').value.trim();
  if (!country) return alert('Por favor ingresa un país o ubicación');

  const preferences = {
    country: country,
    style: document.getElementById('q-style').value,
    headingFont: document.getElementById('q-heading-font').value,
    bodyFont: document.getElementById('q-body-font').value,
    colors: {
      primary: document.getElementById('q-color-primary').value,
      secondary: document.getElementById('q-color-secondary').value,
      accent: document.getElementById('q-color-accent').value
    }
  };

  // Add preferences to the pending body
  const body = { ...pendingStrategyBody, preferences };
  const endpoint = pendingStrategyEndpoint;

  // Close modal
  document.getElementById('questionnaire-overlay').classList.add('hidden');

  // Show progress
  document.getElementById('progress-section').classList.remove('hidden');
  document.getElementById('progress-title').textContent = 'Iniciando...';
  document.getElementById('progress-percent').textContent = '0%';
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-message').textContent = 'Conectando con el servidor...';
  document.getElementById('progress-steps').innerHTML = '';

  // Disable buttons
  document.querySelectorAll('.btn-primary').forEach(b => b.disabled = true);

  // Connect SSE
  connectSSE();

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.error) {
      showError(data.error);
      return;
    }

    document.getElementById('progress-title').textContent = `Generando estrategia para ${data.companyName}...`;
  } catch (err) {
    showError(err.message);
  }
}

// ─── Sidebar Toggle (Mobile) ───
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
  document.body.classList.toggle('sidebar-open');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
  document.body.classList.remove('sidebar-open');
}

// ─── SSE Connection with auto-reconnect and timeout ───
let sseReconnectAttempts = 0;
const SSE_MAX_RECONNECTS = 3;
const SSE_RECONNECT_DELAY = 3000;
let generationTimeout = null;
const GENERATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const stepLabels = [
  'Descripción ejecutiva',
  'Investigación de competidores',
  'Análisis comparativo',
  'Keywords estratégicas',
  'Conclusiones estratégicas',
  'Propuestas de diferenciación',
  'Servicios',
  'Estrategia de contenido',
  'Pilares de contenido',
  'Grilla de contenido',
  'KPIs',
  'Cronograma y conclusiones'
];

function connectSSE() {
  if (eventSource) eventSource.close();
  sseReconnectAttempts = 0;
  eventSource = new EventSource(`/api/progress/${sessionId}`);

  // Set overall generation timeout
  clearTimeout(generationTimeout);
  generationTimeout = setTimeout(() => {
    if (eventSource) eventSource.close();
    showError('La generación está tomando demasiado tiempo. Por favor intenta nuevamente.');
  }, GENERATION_TIMEOUT_MS);

  const stepsContainer = document.getElementById('progress-steps');
  stepsContainer.innerHTML = stepLabels.map((label, i) =>
    `<div class="step-item" id="step-${i+1}"><span class="step-dot"></span>${i+1}. ${label}</div>`
  ).join('');

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    sseReconnectAttempts = 0; // Reset on successful message

    if (data.type === 'progress') {
      const pct = Math.round((data.step / data.total) * 100);
      document.getElementById('progress-percent').textContent = `${pct}%`;
      document.getElementById('progress-fill').style.width = `${pct}%`;
      document.getElementById('progress-message').textContent = data.message;

      // Reset timeout on each progress update
      clearTimeout(generationTimeout);
      generationTimeout = setTimeout(() => {
        if (eventSource) eventSource.close();
        showError('La generación está tomando demasiado tiempo. Por favor intenta nuevamente.');
      }, GENERATION_TIMEOUT_MS);

      for (let i = 1; i <= data.total; i++) {
        const el = document.getElementById(`step-${i}`);
        if (!el) continue;
        el.className = 'step-item';
        if (i < data.step) el.classList.add('done');
        else if (i === data.step) el.classList.add('active');
      }
    }

    if (data.type === 'complete') {
      clearTimeout(generationTimeout);
      document.getElementById('progress-percent').textContent = '100%';
      document.getElementById('progress-fill').style.width = '100%';
      document.getElementById('progress-message').textContent = '¡Estrategia completada!';
      document.getElementById('progress-title').textContent = 'Estrategia generada exitosamente';

      document.querySelectorAll('.step-item').forEach(el => {
        el.className = 'step-item done';
      });

      showToast('¡Estrategia generada exitosamente!');

      // Clear pending data on success
      pendingStrategyType = null;
      pendingStrategyBody = {};
      pendingStrategyEndpoint = '';

      setTimeout(() => {
        document.getElementById('progress-section').classList.add('hidden');
        loadStrategy(data.data.id);
      }, 2000);

      eventSource.close();
      document.querySelectorAll('.btn-primary').forEach(b => b.disabled = false);
    }

    if (data.type === 'error') {
      clearTimeout(generationTimeout);
      showError(data.error);
      showToast(data.error, 'error');
      eventSource.close();
    }
  };

  eventSource.onerror = () => {
    sseReconnectAttempts++;
    console.log(`SSE error, intento de reconexion ${sseReconnectAttempts}/${SSE_MAX_RECONNECTS}`);

    if (sseReconnectAttempts <= SSE_MAX_RECONNECTS) {
      eventSource.close();
      document.getElementById('progress-message').textContent =
        `Reconectando... (intento ${sseReconnectAttempts}/${SSE_MAX_RECONNECTS})`;
      setTimeout(() => connectSSE(), SSE_RECONNECT_DELAY * sseReconnectAttempts);
    } else {
      eventSource.close();
      clearTimeout(generationTimeout);
      showError('Se perdió la conexión con el servidor. La generación puede seguir en proceso — recarga la página en unos minutos.');
    }
  };
}

function showRetryButton() {
  // Only add if not already present
  if (document.getElementById('retry-btn-container')) return;
  const progressSteps = document.getElementById('progress-steps');
  const retryHtml = `
    <div id="retry-btn-container" style="text-align:center;margin-top:20px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
      <button class="btn-primary" onclick="retryGeneration()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Reintentar
      </button>
      <button class="btn-secondary" onclick="newStrategy()">Volver al inicio</button>
    </div>
  `;
  progressSteps.insertAdjacentHTML('beforeend', retryHtml);
}

function retryGeneration() {
  if (!pendingStrategyEndpoint) {
    newStrategy();
    return;
  }
  // Reset UI
  document.getElementById('progress-title').textContent = 'Reintentando...';
  document.getElementById('progress-percent').textContent = '0%';
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-message').textContent = 'Reconectando con el servidor...';
  const retryContainer = document.getElementById('retry-btn-container');
  if (retryContainer) retryContainer.remove();
  // Re-submit with same data
  submitQuestionnaire();
}

function showError(msg) {
  document.getElementById('progress-title').textContent = 'Error';
  document.getElementById('progress-message').textContent = msg;
  document.getElementById('progress-fill').style.width = '0%';
  document.querySelectorAll('.btn-primary').forEach(b => b.disabled = false);
  showRetryButton();
}

// ─── Load Strategy ───
async function loadStrategy(id) {
  try {
    const res = await fetch(id ? `/api/strategy/${id}` : '/api/strategy');
    if (!res.ok) return;
    currentStrategy = await res.json();
    showView('strategy');
    renderStrategy(currentStrategy);
  } catch (err) {
    console.error('Error loading strategy:', err);
  }
}

// ─── Delete Strategy ───
async function handleDeleteStrategy(id, companyName) {
  if (!confirm(`¿Eliminar la estrategia de "${companyName}"? Esta acción no se puede deshacer.`)) return;

  try {
    const res = await fetch(`/api/strategy/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`Estrategia de "${companyName}" eliminada`);
      if (currentStrategy?.id === id) {
        currentStrategy = null;
        document.getElementById('strategy-content').innerHTML = `
          <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <h2>No hay estrategia cargada</h2>
            <p>Ve a Inicio para generar una nueva estrategia.</p>
          </div>
        `;
      }
      loadHistory();
    } else {
      showToast(data.error || 'Error al eliminar', 'error');
    }
  } catch (err) {
    showToast('Error al eliminar: ' + err.message, 'error');
  }
}

// ─── Render Strategy ───
function renderStrategy(s) {
  const container = document.getElementById('strategy-content');
  container.innerHTML = `
    <div class="strategy-header">
      <div>
        <h2>${s.companyName}</h2>
        <p style="color:var(--text-muted);font-size:13px;">Generada: ${new Date(s.createdAt).toLocaleDateString('es-ES', {day:'numeric',month:'long',year:'numeric'})}</p>
      </div>
      <div class="strategy-actions">
        <button class="btn-back" onclick="goBack()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Volver
        </button>
        <button class="btn-secondary" onclick="newStrategy()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva Estrategia
        </button>
        <button class="btn-secondary" onclick="downloadPptx(${s.id})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar PPTX
        </button>
      </div>
    </div>

    ${renderSection(1, 'Descripción', renderDescription(s))}
    ${renderSection(2, 'Análisis de Competencia', renderCompetitors(s))}
    ${renderSection(3, 'Análisis Comparativo', renderComparative(s))}
    ${renderSection(4, 'Keywords Estratégicas', renderKeywords(s))}
    ${renderSection(5, 'Conclusiones Estratégicas', renderConclusions(s))}
    ${renderSection(6, 'Propuestas de Diferenciación', renderDifferentiation(s))}
    ${renderSection(7, 'Servicios', renderBrand(s))}
    ${renderSection(8, 'Estrategia de Contenido', renderContentStrategy(s))}
    ${renderSection(9, 'Pilares de Contenido', renderPillars(s))}
    ${renderSection(10, 'Grilla de Contenido', renderGrid(s))}
    ${renderSection(11, 'KPIs', renderKPIs(s))}
    ${renderSection(12, 'Cronograma y Conclusiones', renderTimeline(s))}
  `;
}

function renderSection(num, title, content) {
  return `
    <div class="strategy-section">
      <div class="section-header" onclick="toggleSection(this)">
        <span class="section-number">${num}</span>
        <h3>${title}</h3>
        <svg class="section-toggle" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="section-body">${content}</div>
    </div>
  `;
}

function toggleSection(header) {
  const body = header.nextElementSibling;
  const toggle = header.querySelector('.section-toggle');
  body.classList.toggle('open');
  toggle.classList.toggle('open');
}

// ─── Section Renderers ───
function renderDescription(s) {
  if (!s.description) return '<p>No disponible</p>';
  return `
    <p>${s.description.summary || ''}</p>
    <div style="margin-top:16px;padding:16px;background:var(--bg-input);border-radius:8px;border-left:3px solid var(--accent);">
      <h4 style="font-size:13px;color:var(--accent);margin-bottom:8px;">Objetivo</h4>
      <p style="margin:0;">${s.description.objective || ''}</p>
    </div>
  `;
}

function renderCompetitors(s) {
  if (!s.competitors || !s.competitors.length) return '<p>No disponible</p>';
  return s.competitors.map(c => {
    const seoKeywords = (c.seoAnalysis && c.seoAnalysis.topKeywords) || [];
    const opportunities = c.opportunitiesForUs || [];
    return `
    <div class="competitor-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <h4 style="margin-bottom:0;">${c.name}</h4>
        <a class="competitor-website" href="${c.website}" target="_blank">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          ${c.website}
        </a>
      </div>
      <p class="analysis">${c.detailedAnalysis || ''}</p>
      ${seoKeywords.length ? `
        <div style="margin-bottom:14px;">
          ${seoKeywords.map(kw => `<span class="seo-tag">${kw}</span>`).join('')}
        </div>
      ` : ''}
      <div class="sw-grid">
        <div class="sw-col strengths">
          <h5>Fortalezas</h5>
          <ul>${(c.strengths || []).map(s => `<li>${s}</li>`).join('')}</ul>
        </div>
        <div class="sw-col weaknesses">
          <h5>Debilidades</h5>
          <ul>${(c.weaknesses || []).map(w => `<li>${w}</li>`).join('')}</ul>
        </div>
      </div>
      ${opportunities.length ? `
        <div class="opp-section">
          <h5>Oportunidades</h5>
          <ul>${opportunities.map(o => `<li>${o}</li>`).join('')}</ul>
        </div>
      ` : ''}
    </div>
  `;
  }).join('');
}

function renderComparative(s) {
  return `<p>${s.comparativeAnalysis || 'No disponible'}</p>`;
}

function renderKeywords(s) {
  if (!s.keywordGroups || !s.keywordGroups.length) return '<p>No disponible</p>';
  return s.keywordGroups.map(g => `
    <div style="margin-bottom:20px;">
      <h4 style="font-size:14px;margin-bottom:12px;">${g.category}</h4>
      <div class="table-scroll">
        <table class="strategy-table">
          <thead>
            <tr><th>Keyword</th><th>Intención</th><th>Volumen</th><th>Dificultad</th></tr>
          </thead>
          <tbody>
            ${(g.keywords || []).map(k => `
              <tr><td>${k.term}</td><td>${k.intent || '-'}</td><td>${k.volume || '-'}</td><td>${k.difficulty || '-'}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');
}

function renderConclusions(s) {
  if (!s.strategicConclusions || !s.strategicConclusions.length) return '<p>No disponible</p>';
  return `<ul>${s.strategicConclusions.map(c => `<li>${c}</li>`).join('')}</ul>`;
}

function renderDifferentiation(s) {
  if (!s.differentiationProposals || !s.differentiationProposals.length) return '<p>No disponible</p>';
  return `<ul>${s.differentiationProposals.map(d => `<li>${d}</li>`).join('')}</ul>`;
}

function renderBrand(s) {
  const services = s.services || [];
  const bd = s.brandDesign || {};
  const colors = bd.colorPalette || bd.colors || [];

  function renderColorSwatches(colorList) {
    if (!colorList || !colorList.length) return '';
    return `
      <div style="margin-top:12px;">
        <h5 style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Paleta de Colores</h5>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          ${colorList.map(c => {
            const hex = typeof c === 'string' ? c : (c.hex || c.value || c.color || '');
            const label = typeof c === 'string' ? c : (c.name || c.label || hex);
            return `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:var(--bg-input);border-radius:20px;font-size:11px;color:var(--text-secondary);">
              <span class="color-swatch" style="background:${hex};"></span>${label}
            </span>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  return `
    <h4 style="margin-bottom:12px;">Servicios</h4>
    <div class="table-scroll">
      <table class="strategy-table">
        <thead><tr><th>Servicio</th><th>Descripción</th></tr></thead>
        <tbody>${services.map(sv => `<tr><td style="font-weight:600;">${sv.name}</td><td>${sv.description}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div style="margin-top:20px;">
      <h4 style="margin-bottom:12px;">Personalidad de Marca</h4>
      <p>${bd.personality || ''}</p>
      ${renderColorSwatches(colors)}
      <div style="margin-top:12px;">
        <h5 style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Valores</h5>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${(bd.values || []).map(v => `<span class="brand-tag">${v}</span>`).join('')}
        </div>
      </div>
      <div style="margin-top:12px;">
        <h5 style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Lineamientos</h5>
        <p>${bd.guidelines || ''}</p>
      </div>
    </div>
  `;
}

function renderContentStrategy(s) {
  const cs = s.contentStrategy || {};
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div>
        <h4 style="font-size:13px;color:var(--accent);margin-bottom:10px;">Audiencia Objetivo</h4>
        <ul>${(cs.targetAudience || []).map(a => `<li>${a}</li>`).join('')}</ul>
      </div>
      <div>
        <h4 style="font-size:13px;color:var(--error);margin-bottom:10px;">Puntos de Dolor</h4>
        <ul>${(cs.painPoints || []).map(p => `<li>${p}</li>`).join('')}</ul>
      </div>
    </div>
    <div style="margin-top:16px;">
      <h4 style="font-size:13px;color:var(--success);margin-bottom:10px;">Canales</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${(cs.channels || []).map(c => `<span class="topic-tag">${c}</span>`).join('')}
      </div>
    </div>
    <div style="margin-top:16px;padding:12px;background:var(--bg-input);border-radius:8px;">
      <h4 style="font-size:13px;color:var(--warning);margin-bottom:8px;">Tono de Comunicación</h4>
      <p style="margin:0;">${cs.tone || ''}</p>
    </div>
  `;
}

function renderPillars(s) {
  if (!s.contentPillars || !s.contentPillars.length) return '<p>No disponible</p>';
  return s.contentPillars.map(p => `
    <div class="pillar-item">
      <div class="pillar-header">
        <h4>${p.name}</h4>
        <span class="percent">${p.percentage}%</span>
      </div>
      <div class="pillar-bar"><div class="pillar-bar-fill" style="width:${p.percentage}%"></div></div>
      <p class="pillar-desc">${p.description || ''}</p>
      <div class="pillar-topics">
        ${(p.topics || []).map(t => `<span class="topic-tag">${t}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

function renderGrid(s) {
  if (!s.contentGrid || !s.contentGrid.length) return '<p>No disponible</p>';
  return `
    <div class="table-scroll">
      <table class="strategy-table">
        <thead><tr><th>Día</th><th>Plataforma</th><th>Tipo</th><th>Tema</th><th>Pilar</th></tr></thead>
        <tbody>
          ${s.contentGrid.map(g => `
            <tr><td>${g.day}</td><td>${g.platform}</td><td>${g.contentType}</td><td>${g.topic}</td><td>${g.pillar || '-'}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderKPIs(s) {
  if (!s.kpis || !s.kpis.length) return '<p>No disponible</p>';
  const catColors = {
    'atraccion': 'attraction', 'atracción': 'attraction',
    'seo': 'attraction',
    'conversion': 'conversion', 'conversión': 'conversion',
    'venta': 'conversion',
    'retencion': 'retention', 'retención': 'retention',
    'lealtad': 'retention',
    'marca': 'brand',
    'engagement': 'brand',
  };

  function getBadgeClass(category) {
    const lower = (category || '').toLowerCase();
    for (const [key, val] of Object.entries(catColors)) {
      if (lower.includes(key)) return val;
    }
    return 'attraction';
  }

  // Group KPIs by category
  const grouped = {};
  s.kpis.forEach(k => {
    const cat = k.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(k);
  });

  let rows = '';
  for (const [category, kpis] of Object.entries(grouped)) {
    const badgeClass = getBadgeClass(category);
    rows += `<tr><td colspan="3" class="kpi-category-header ${badgeClass}">${category}</td></tr>`;
    rows += kpis.map(k => `
      <tr>
        <td style="font-weight:600;">${k.metric}</td>
        <td>${k.description || ''}</td>
        <td style="font-family:var(--mono);color:var(--accent);">${k.target || '-'}</td>
      </tr>
    `).join('');
  }

  return `
    <div class="table-scroll">
      <table class="strategy-table">
        <thead><tr><th>Métrica</th><th>Descripción</th><th>Target</th></tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function renderTimeline(s) {
  const timeline = s.implementationTimeline || [];
  const conclusions = s.conclusions || [];
  const recs = s.recommendations || [];

  return `
    <h4 style="margin-bottom:16px;">Cronograma de Implementación</h4>
    ${timeline.map(t => `
      <div style="margin-bottom:16px;padding:16px;background:var(--bg-input);border-radius:8px;border-left:3px solid var(--accent);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h5 style="font-size:14px;font-weight:600;">${t.phase}</h5>
          <span style="font-size:12px;color:var(--accent);font-family:var(--mono);">${t.weeks}</span>
        </div>
        <ul>${(t.tasks || []).map(task => `<li>${task}</li>`).join('')}</ul>
      </div>
    `).join('')}

    ${conclusions.length ? `
      <h4 style="margin:24px 0 12px;">Conclusiones</h4>
      <ul>${conclusions.map(c => `<li>${c}</li>`).join('')}</ul>
    ` : ''}

    ${recs.length ? `
      <h4 style="margin:24px 0 12px;">Recomendaciones</h4>
      <ul>${recs.map(r => `<li>${r}</li>`).join('')}</ul>
    ` : ''}
  `;
}

// ─── Download PPTX ───
async function downloadPptx(id) {
  try {
    window.open(`/api/pptx/download/${id}`, '_blank');
  } catch (err) {
    showToast('Error al descargar PPTX: ' + err.message, 'error');
  }
}

// ─── Load History ───
async function loadHistory() {
  try {
    const res = await fetch('/api/strategies');
    const strategies = await res.json();
    const container = document.getElementById('history-list');

    if (!strategies.length) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <h2>Sin historial</h2>
          <p>Las estrategias generadas aparecerán aquí.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = strategies.map(s => `
      <div class="history-item" onclick="loadStrategy(${s.id})">
        <div class="history-item-info">
          <h3>${s.companyName}</h3>
          <p>ID: ${s.id} &mdash; ${new Date(s.createdAt).toLocaleDateString('es-ES', {day:'numeric',month:'short',year:'numeric'})}</p>
        </div>
        <div class="history-item-actions">
          <button class="btn-secondary" onclick="event.stopPropagation();downloadPptx(${s.id})">
            PPTX
          </button>
          <button class="btn-secondary" onclick="event.stopPropagation();loadStrategy(${s.id})">
            Ver
          </button>
          <button class="btn-danger" onclick="event.stopPropagation();handleDeleteStrategy(${s.id}, '${s.companyName.replace(/'/g, "\\'")}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Eliminar
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading history:', err);
  }
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
});
