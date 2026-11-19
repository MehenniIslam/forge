// =============================================================
// ui.js — briques d'interface : actions, fenêtres (sheets), messages, graphiques,
// son / vibration, mini-lecteur Markdown pour les guides.
// =============================================================
import { esc, fmt, fmtDateMini, fmtDateCourt, diffDays, addDays } from './util.js';

// ---------- Actions (un seul écouteur pour toute l'app) ----------
// Dans le HTML : <button data-act="nom" data-id="…">. Dans le code : on('nom', (el, ev) => …)
const actions = {};
export const on = (name, fn) => { actions[name] = fn; };

export function initActions() {
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.act];
    if (fn) { ev.preventDefault(); fn(el, ev); }
  });
  for (const type of ['input', 'change']) {
    document.addEventListener(type, (ev) => {
      const el = ev.target.closest(`[data-${type}]`);
      if (!el) return;
      const fn = actions[el.dataset[type]];
      if (fn) fn(el, ev);
    });
  }
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeSheet();
    if (ev.key === 'Enter' && ev.target.matches('input[data-enter]')) {
      const fn = actions[ev.target.dataset.enter];
      if (fn) { ev.preventDefault(); fn(ev.target, ev); }
    }
  });
}

// ---------- Messages ----------
export function toast(msg, type = '') {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

// ---------- Fenêtre du bas (sheet) ----------
let sheetClose = null;
export function openSheet(title, body, { onClose, wide } = {}) {
  const root = document.getElementById('sheet-root');
  root.innerHTML = `
    <div class="sheet-bg" data-act="sheet-close"></div>
    <div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="sheet-close" aria-label="Fermer">✕</button></div>
      <div class="sheet-body">${body}</div>
    </div>`;
  root.classList.add('open');
  document.body.classList.add('no-scroll');
  sheetClose = onClose || null;
  return root.querySelector('.sheet-body');
}
export function closeSheet() {
  const root = document.getElementById('sheet-root');
  if (!root.classList.contains('open')) return;
  root.classList.remove('open');
  root.innerHTML = '';
  document.body.classList.remove('no-scroll');
  const fn = sheetClose; sheetClose = null;
  if (fn) fn();
}
on('sheet-close', () => closeSheet());

/** Demande de confirmation. Renvoie une promesse true / false. */
export function confirmBox(message, { ok = 'Confirmer', danger = false, title = 'Confirmation' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet(title, `
      <p class="confirm-msg">${message}</p>
      <div class="row gap">
        <button class="btn ghost grow" data-act="confirm-no">Annuler</button>
        <button class="btn ${danger ? 'danger' : 'primary'} grow" data-act="confirm-yes">${esc(ok)}</button>
      </div>`, { onClose: () => { if (!answered) resolve(false); } });
    on('confirm-yes', () => { answered = true; closeSheet(); resolve(true); });
    on('confirm-no', () => { answered = true; closeSheet(); resolve(false); });
  });
}

// ---------- Petits composants ----------
/** Barre de progression. */
export function bar(value, max, cls = '') {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const over = max > 0 && value > max * 1.02;
  return `<div class="bar ${cls} ${over ? 'over' : ''}"><span style="width:${pct.toFixed(1)}%"></span></div>`;
}

export function segmented(name, options, current) {
  return `<div class="seg" role="tablist">${options
    .map(([val, label]) => `<button role="tab" class="${val === current ? 'on' : ''}" aria-selected="${val === current}" data-act="${name}" data-val="${esc(val)}">${esc(label)}</button>`)
    .join('')}</div>`;
}

export function empty(text) {
  return `<p class="empty">${text}</p>`;
}

// ---------- Graphiques SVG (faits main, fonctionnent hors ligne) ----------
const charts = new Map();
let chartSeq = 0;

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { lo, hi, ticks };
}

/**
 * Courbes dans le temps.
 * series : [{ name, color, points:[{x:'AAAA-MM-JJ', y}], dashed, dots, line }]
 * band : { name, color, points:[{x, lo, hi}] } (zone du plan, optionnelle)
 */
export function lineChart({ series, band = null, height = 190, unit = '', dec = 1, zeroBased = false, legend = true }) {
  const id = 'c' + (++chartSeq);
  const all = [...series.flatMap((s) => s.points.filter((p) => p.y !== null && p.y !== undefined)), ...(band ? band.points : [])];
  if (!all.length) return `<div class="chart-empty">Pas encore de données pour ce graphique.</div>`;
  const dates = all.map((p) => p.x).sort();
  let x0 = dates[0], x1 = dates[dates.length - 1];
  if (x0 === x1) { x0 = addDays(x0, -3); x1 = addDays(x1, 3); }
  const span = Math.max(1, diffDays(x0, x1));
  const ys = [];
  for (const s of series) for (const p of s.points) if (p.y !== null && p.y !== undefined) ys.push(p.y);
  if (band) for (const p of band.points) ys.push(p.lo, p.hi);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  if (zeroBased) yMin = Math.min(0, yMin);
  const pad = (yMax - yMin) * 0.08 || 1;
  const t = niceTicks(zeroBased ? yMin : yMin - pad, yMax + pad);
  const W = 340, H = height, L = 38, R = 10, T = 10, B = 24;
  const X = (d) => L + (diffDays(x0, d) / span) * (W - L - R);
  const Y = (v) => T + (1 - (v - t.lo) / (t.hi - t.lo)) * (H - T - B);
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Graphique">`;
  for (const v of t.ticks) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid"/>`;
    svg += `<text x="${L - 6}" y="${(Y(v) + 3.5).toFixed(1)}" class="axis" text-anchor="end">${fmt(v, Math.abs(t.ticks[1] - t.ticks[0]) < 1 ? 1 : 0)}</text>`;
  }
  const nX = Math.min(3, span);
  for (let i = 0; i <= nX; i++) {
    const d = addDays(x0, Math.round((span * i) / nX));
    svg += `<text x="${X(d).toFixed(1)}" y="${H - 6}" class="axis" text-anchor="${i === 0 ? 'start' : i === nX ? 'end' : 'middle'}">${fmtDateMini(d)}</text>`;
  }
  if (band && band.points.length) {
    const pts = [...band.points].sort((a, b) => (a.x < b.x ? -1 : 1));
    const top = pts.map((p) => `${X(p.x).toFixed(1)},${Y(p.hi).toFixed(1)}`).join(' ');
    const bot = [...pts].reverse().map((p) => `${X(p.x).toFixed(1)},${Y(p.lo).toFixed(1)}`).join(' ');
    svg += `<polygon points="${top} ${bot}" fill="${band.color}" opacity="0.18"/>`;
  }
  for (const s of series) {
    const pts = s.points.filter((p) => p.y !== null && p.y !== undefined).sort((a, b) => (a.x < b.x ? -1 : 1));
    if (s.line !== false && pts.length > 1) {
      svg += `<polyline points="${pts.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dashed ? 'stroke-dasharray="5 4"' : ''}/>`;
    }
    if (s.dots || pts.length === 1) {
      for (const p of pts) svg += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4" fill="${s.color}" stroke="var(--card)" stroke-width="2"/>`;
    }
  }
  svg += `<line class="xhair" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/></svg>`;
  // données pour l'info-bulle
  const xs = [...new Set(series.flatMap((s) => s.points.filter((p) => p.y != null).map((p) => p.x)))].sort();
  charts.set(id, {
    W, xs: xs.map((x) => ({ x, px: X(x), vals: series.map((s) => { const p = s.points.find((q) => q.x === x); return p && p.y != null ? p.y : null; }) })),
    series: series.map((s) => ({ name: s.name, color: s.color })), unit, dec,
  });
  const leg = legend && series.length > 1
    ? `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}" class="${s.dashed ? 'dash' : ''}"></i>${esc(s.name)}</span>`).join('')}${band ? `<span><i style="background:${band.color};opacity:.35"></i>${esc(band.name)}</span>` : ''}</div>`
    : '';
  return `${leg}<div class="chart" data-chart="${id}">${svg}<div class="tip" hidden></div></div>`;
}

/** Barres par jour (pas, sommeil…). */
export function barChart({ points, color, height = 160, unit = '', dec = 0, goal = null, name = '' }) {
  const id = 'c' + (++chartSeq);
  const pts = points.filter((p) => p.y != null).sort((a, b) => (a.x < b.x ? -1 : 1));
  if (!pts.length) return `<div class="chart-empty">Pas encore de données. Importe depuis Santé.</div>`;
  const W = 340, H = height, L = 38, R = 8, T = 10, B = 24;
  const yMax = Math.max(...pts.map((p) => p.y), goal || 0);
  const t = niceTicks(0, yMax * 1.05);
  const n = pts.length;
  const slot = (W - L - R) / n;
  const bw = Math.max(3, Math.min(22, slot - 2));
  const Y = (v) => T + (1 - (v - t.lo) / (t.hi - t.lo)) * (H - T - B);
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="${esc(name)}">`;
  for (const v of t.ticks) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid"/>`;
    svg += `<text x="${L - 6}" y="${(Y(v) + 3.5).toFixed(1)}" class="axis" text-anchor="end">${fmt(v, t.ticks[1] - t.ticks[0] < 1 ? 1 : 0)}</text>`;
  }
  const xsMeta = [];
  pts.forEach((p, i) => {
    const cx = L + slot * i + slot / 2;
    const y = Y(p.y), h = Y(0) - y;
    const r = Math.min(4, bw / 2, h);
    // barre aux coins arrondis seulement en haut
    svg += `<path d="M${(cx - bw / 2).toFixed(1)},${Y(0).toFixed(1)} V${(y + r).toFixed(1)} Q${(cx - bw / 2).toFixed(1)},${y.toFixed(1)} ${(cx - bw / 2 + r).toFixed(1)},${y.toFixed(1)} H${(cx + bw / 2 - r).toFixed(1)} Q${(cx + bw / 2).toFixed(1)},${y.toFixed(1)} ${(cx + bw / 2).toFixed(1)},${(y + r).toFixed(1)} V${Y(0).toFixed(1)} Z" fill="${color}"/>`;
    xsMeta.push({ x: p.x, px: cx, vals: [p.y] });
  });
  if (goal) svg += `<line x1="${L}" x2="${W - R}" y1="${Y(goal).toFixed(1)}" y2="${Y(goal).toFixed(1)}" class="goal"/>`;
  const step = Math.max(1, Math.ceil(n / 5));
  pts.forEach((p, i) => { if (i % step === 0 || i === n - 1) svg += `<text x="${(L + slot * i + slot / 2).toFixed(1)}" y="${H - 6}" class="axis" text-anchor="middle">${fmtDateMini(p.x)}</text>`; });
  svg += `<line class="xhair" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/></svg>`;
  charts.set(id, { W, xs: xsMeta, series: [{ name, color }], unit, dec });
  return `<div class="chart" data-chart="${id}">${svg}<div class="tip" hidden></div></div>`;
}

/** Info-bulle : touche ou survole un graphique pour voir les valeurs du jour le plus proche. */
export function initChartTips() {
  const handler = (ev) => {
    const box = ev.target.closest('.chart');
    if (!box) return;
    const meta = charts.get(box.dataset.chart);
    if (!meta || !meta.xs.length) return;
    const svg = box.querySelector('svg');
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * meta.W;
    let best = meta.xs[0];
    for (const x of meta.xs) if (Math.abs(x.px - px) < Math.abs(best.px - px)) best = x;
    const line = svg.querySelector('.xhair');
    line.setAttribute('x1', best.px); line.setAttribute('x2', best.px); line.style.display = '';
    const tip = box.querySelector('.tip');
    tip.hidden = false;
    tip.innerHTML = `<b>${fmtDateCourt(best.x)}</b>${meta.series.map((s, i) => best.vals[i] == null ? '' : `<div><i style="background:${s.color}"></i>${esc(s.name)} : ${fmt(best.vals[i], meta.dec)}${meta.unit ? ' ' + meta.unit : ''}</div>`).join('')}`;
    const leftPct = (best.px / meta.W) * 100;
    tip.style.left = leftPct > 60 ? '' : `calc(${leftPct}% + 8px)`;
    tip.style.right = leftPct > 60 ? `calc(${100 - leftPct}% + 8px)` : '';
  };
  document.addEventListener('pointerdown', handler);
  document.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse' || ev.buttons) handler(ev); });
  document.addEventListener('pointerleave', () => {}, true);
}

// ---------- Son, vibration, écran allumé ----------
let actx = null;
/** À appeler pendant un toucher de l'utilisateur : iOS n'autorise le son qu'après un geste. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!actx) actx = new AC();
    if (actx.state === 'suspended') actx.resume();
    const b = actx.createBuffer(1, 1, 22050);
    const s = actx.createBufferSource();
    s.buffer = b; s.connect(actx.destination); s.start(0);
  } catch { /* pas de son, tant pis */ }
}
export function beep(n = 3) {
  try {
    if (!actx) return;
    if (actx.state === 'suspended') actx.resume();
    const t0 = actx.currentTime + 0.03;
    for (let i = 0; i < n; i++) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine';
      o.frequency.value = i === n - 1 ? 1320 : 880;
      const t = t0 + i * 0.32;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + 0.26);
    }
  } catch { /* ignore */ }
}
/** La vibration n'existe pas dans Safari sur iPhone : sans effet là-bas, mais sans erreur. */
export function vibrate(p = [250, 120, 250]) {
  try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* ignore */ }
}

let wakeLock = null, wantWake = false;
export async function keepAwake(onOff) {
  wantWake = onOff;
  try {
    if (onOff && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!onOff && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantWake) keepAwake(true);
});

// ---------- Mini Markdown (pour afficher GUIDE-RACCOURCI.md dans l'app) ----------
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
export function md(src) {
  const lines = String(src).replace(/\r/g, '').split('\n');
  let out = '';
  let i = 0;
  const isList = (l) => /^\s*([-*]|\d+\.)\s+/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out += `<pre><code>${esc(buf.join('\n'))}</code></pre>`;
      continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out += `<h${h[1].length + 1} class="md-h">${inline(h[2])}</h${h[1].length + 1}>`; i++; continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out += '<hr>'; i++; continue; }
    if (/^>\s?/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out += `<blockquote>${md(buf.join('\n'))}</blockquote>`;
      continue;
    }
    if (/^\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r));
      out += `<div class="md-table"><table>${body.map((r, k) => `<tr>${cells(r).map((c) => (k === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('')}</tr>`).join('')}</table></div>`;
      continue;
    }
    if (isList(l)) {
      // listes (avec un niveau d'imbrication)
      const ordered = /^\s*\d+\./.test(l);
      let html = ordered ? '<ol>' : '<ul>';
      let open = false;
      while (i < lines.length && (isList(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && open))) {
        const cur = lines[i];
        const indent = cur.match(/^\s*/)[0].length;
        if (indent >= 2) {
          const sub = [];
          while (i < lines.length && /^\s{2,}\S/.test(lines[i])) sub.push(lines[i++].replace(/^\s{2,4}/, ''));
          html = html.replace(/<\/li>$/, '') + md(sub.join('\n')) + '</li>';
          continue;
        }
        html += `<li>${inline(cur.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`;
        open = true;
        i++;
      }
      out += html + (ordered ? '</ol>' : '</ul>');
      continue;
    }
    if (!l.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\||\s*([-*]|\d+\.)\s+)/.test(lines[i])) buf.push(lines[i++]);
    out += `<p>${inline(buf.join(' '))}</p>`;
  }
  return out;
}

// ---------- Ré-affichage de l'écran courant ----------
let renderFn = () => {};
export const setRender = (fn) => { renderFn = fn; };
export const rerender = () => renderFn();
