// ─── StrategyGravity Frontend App ───

let currentStrategy = null;
let eventSource = null;
const sessionId = crypto.randomUUID();

// ─── View Management ───
function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

  if (viewName === 'history') loadHistory();
  if (viewName === 'strategy' && currentStrategy) renderStrategy(currentStrategy);
}

// ─── Tab Switching ───
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
}

// ─── Start Strategy Generation ───
async function startStrategy(type) {
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
    if (!desc) return alert('Ingresa una descripcion');
    body = { description: desc, sessionId };
    endpoint = '/api/strategy/description';
  }

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

// ─── SSE Connection ───
function connectSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`/api/progress/${sessionId}`);

  const stepsContainer = document.getElementById('progress-steps');
  const stepLabels = [
    'Descripcion ejecutiva',
    'Investigacion de competidores',
    'Analisis comparativo',
    'Keywords estrategicas',
    'Conclusiones estrategicas',
    'Propuestas de diferenciacion',
    'Diseno de marca',
    'Estrategia de contenido',
    'Pilares de contenido',
    'Grilla de contenido',
    'KPIs',
    'Cronograma y conclusiones'
  ];

  // Initialize steps display
  stepsContainer.innerHTML = stepLabels.map((label, i) =>
    `<div class="step-item" id="step-${i+1}"><span class="step-dot"></span>${i+1}. ${label}</div>`
  ).join('');

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'progress') {
      const pct = Math.round((data.step / data.total) * 100);
      document.getElementById('progress-percent').textContent = `${pct}%`;
      document.getElementById('progress-fill').style.width = `${pct}%`;
      document.getElementById('progress-message').textContent = data.message;

      // Update steps
      for (let i = 1; i <= data.total; i++) {
        const el = document.getElementById(`step-${i}`);
        if (!el) continue;
        el.className = 'step-item';
        if (i < data.step) el.classList.add('done');
        else if (i === data.step) el.classList.add('active');
      }
    }

    if (data.type === 'complete') {
      document.getElementById('progress-percent').textContent = '100%';
      document.getElementById('progress-fill').style.width = '100%';
      document.getElementById('progress-message').textContent = 'Estrategia completada!';
      document.getElementById('progress-title').textContent = 'Estrategia generada exitosamente';

      // Mark all steps done
      document.querySelectorAll('.step-item').forEach(el => {
        el.className = 'step-item done';
      });

      // Load strategy
      setTimeout(() => loadStrategy(data.data.id), 1500);
      eventSource.close();
      document.querySelectorAll('.btn-primary').forEach(b => b.disabled = false);
    }

    if (data.type === 'error') {
      showError(data.error);
      eventSource.close();
      document.querySelectorAll('.btn-primary').forEach(b => b.disabled = false);
    }
  };

  eventSource.onerror = () => {
    console.log('SSE connection lost, will auto-reconnect');
  };
}

function showError(msg) {
  document.getElementById('progress-title').textContent = 'Error';
  document.getElementById('progress-message').textContent = msg;
  document.getElementById('progress-fill').style.width = '0%';
  document.querySelectorAll('.btn-primary').forEach(b => b.disabled = false);
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
        <button class="btn-secondary" onclick="downloadPptx(${s.id})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar PPTX
        </button>
      </div>
    </div>

    ${renderSection(1, 'Descripcion', renderDescription(s))}
    ${renderSection(2, 'Analisis de Competencia', renderCompetitors(s))}
    ${renderSection(3, 'Analisis Comparativo', renderComparative(s))}
    ${renderSection(4, 'Keywords Estrategicas', renderKeywords(s))}
    ${renderSection(5, 'Conclusiones Estrategicas', renderConclusions(s))}
    ${renderSection(6, 'Propuestas de Diferenciacion', renderDifferentiation(s))}
    ${renderSection(7, 'Servicios & Diseno de Marca', renderBrand(s))}
    ${renderSection(8, 'Estrategia de Contenido', renderContentStrategy(s))}
    ${renderSection(9, 'Pilares de Contenido', renderPillars(s))}
    ${renderSection(10, 'Grilla de Contenido', renderGrid(s))}
    ${renderSection(11, 'KPIs', renderKPIs(s))}
    ${renderSection(12, 'Cronograma & Conclusiones', renderTimeline(s))}
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
      <h4 style="font-size:13px;color:var(--accent);margin-bottom:8px;">Objetivo Estrategico</h4>
      <p style="margin:0;">${s.description.objective || ''}</p>
    </div>
  `;
}

function renderCompetitors(s) {
  if (!s.competitors || !s.competitors.length) return '<p>No disponible</p>';
  return s.competitors.map(c => `
    <div class="competitor-card">
      <h4>${c.name}</h4>
      <a class="website" href="${c.website}" target="_blank">${c.website}</a>
      <p class="analysis">${c.detailedAnalysis || ''}</p>
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
    </div>
  `).join('');
}

function renderComparative(s) {
  return `<p>${s.comparativeAnalysis || 'No disponible'}</p>`;
}

function renderKeywords(s) {
  if (!s.keywordGroups || !s.keywordGroups.length) return '<p>No disponible</p>';
  return s.keywordGroups.map(g => `
    <div style="margin-bottom:20px;">
      <h4 style="font-size:14px;margin-bottom:12px;">${g.category}</h4>
      <table class="strategy-table">
        <thead>
          <tr><th>Keyword</th><th>Intencion</th><th>Volumen</th><th>Dificultad</th></tr>
        </thead>
        <tbody>
          ${(g.keywords || []).map(k => `
            <tr><td>${k.term}</td><td>${k.intent || '-'}</td><td>${k.volume || '-'}</td><td>${k.difficulty || '-'}</td></tr>
          `).join('')}
        </tbody>
      </table>
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
  return `
    <h4 style="margin-bottom:12px;">Servicios</h4>
    <table class="strategy-table">
      <thead><tr><th>Servicio</th><th>Descripcion</th></tr></thead>
      <tbody>${services.map(sv => `<tr><td style="font-weight:600;">${sv.name}</td><td>${sv.description}</td></tr>`).join('')}</tbody>
    </table>
    <div style="margin-top:20px;">
      <h4 style="margin-bottom:12px;">Personalidad de Marca</h4>
      <p>${bd.personality || ''}</p>
      <div style="margin-top:12px;">
        <h5 style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Valores</h5>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${(bd.values || []).map(v => `<span class="topic-tag">${v}</span>`).join('')}
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
      <h4 style="font-size:13px;color:var(--warning);margin-bottom:8px;">Tono de Comunicacion</h4>
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
    <table class="strategy-table">
      <thead><tr><th>Dia</th><th>Plataforma</th><th>Tipo</th><th>Tema</th><th>Pilar</th></tr></thead>
      <tbody>
        ${s.contentGrid.map(g => `
          <tr><td>${g.day}</td><td>${g.platform}</td><td>${g.contentType}</td><td>${g.topic}</td><td>${g.pillar || '-'}</td></tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderKPIs(s) {
  if (!s.kpis || !s.kpis.length) return '<p>No disponible</p>';
  const catColors = {
    'atraccion': 'attraction',
    'seo': 'attraction',
    'conversion': 'conversion',
    'venta': 'conversion',
    'retencion': 'retention',
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

  return `
    <table class="strategy-table">
      <thead><tr><th>Categoria</th><th>Metrica</th><th>Descripcion</th><th>Target</th></tr></thead>
      <tbody>
        ${s.kpis.map(k => `
          <tr>
            <td><span class="kpi-badge ${getBadgeClass(k.category)}">${k.category}</span></td>
            <td style="font-weight:600;">${k.metric}</td>
            <td>${k.description || ''}</td>
            <td style="font-family:var(--mono);color:var(--accent);">${k.target || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderTimeline(s) {
  const timeline = s.implementationTimeline || [];
  const conclusions = s.conclusions || [];
  const recs = s.recommendations || [];

  return `
    <h4 style="margin-bottom:16px;">Cronograma de Implementacion</h4>
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
    alert('Error al descargar PPTX: ' + err.message);
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
          <p>Las estrategias generadas apareceran aqui.</p>
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
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading history:', err);
  }
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  // Try to load existing strategy
  loadHistory();
});
