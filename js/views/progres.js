// =============================================================
// Onglet PROGRÈS : poids & plan, ajustements proposés, exercices & records, données Santé.
// =============================================================
import { S, put, del, saveSettings } from '../db.js';
import { today, addDays, fmt, fmtDateCourt, esc, parseNum } from '../util.js';
import { smoothed, planTable, exKey, exerciseStats, avg7 } from '../calc.js';
import { on, openSheet, closeSheet, toast, confirmBox, segmented, empty, rerender, lineChart, barChart } from '../ui.js';
import { UI, proposals, targetsFor, ref, weekTarget, planWeek } from '../logic.js';

const C = { blue: '#3987e5', orange: '#d95926', aqua: '#199e70', yellow: '#c98500', violet: '#9085e9', muted: '#6b7385' };

export function render() {
  return `
  <header class="page-head"><h1>Progrès</h1></header>
  ${segmented('prog-tab', [['poids', 'Poids & plan'], ['exos', 'Exercices'], ['sante', 'Santé']], UI.progTab)}
  ${UI.progTab === 'poids' ? weightView() : UI.progTab === 'exos' ? exosView() : healthView()}`;
}
on('prog-tab', (el) => { UI.progTab = el.dataset.val; rerender(); });

// ---------- Ajustements proposés (aussi utilisés sur l'accueil) ----------
export function proposalCards() {
  const props = proposals();
  if (!props.length) return '';
  return props.map((p) => `
  <div class="alert ${p.delta > 0 ? 'good' : 'soft'}">
    <b>${esc(p.title)}</b> (bilan de la semaine ${p.week})
    <ul>${p.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    <p>Ton objectif passerait de ${fmt(targetsFor().kcalPlan)} à <b>${fmt(targetsFor().kcalPlan + p.delta)} kcal</b>.</p>
    <div class="row gap"><button class="btn primary grow" data-act="prop-yes" data-id="${p.id}" data-delta="${p.delta}">Accepter</button><button class="btn ghost grow" data-act="prop-no" data-id="${p.id}" data-delta="${p.delta}">Refuser</button></div>
  </div>`).join('');
}
on('prop-yes', async (el) => {
  const delta = Number(el.dataset.delta);
  S.settings.kcalAjust = (S.settings.kcalAjust || 0) + delta;
  await saveSettings();
  await put('decisions', { id: el.dataset.id, accepted: true, delta, date: today() });
  toast(`Objectif ajusté de ${delta > 0 ? '+' : ''}${delta} kcal`, 'ok');
  rerender();
});
on('prop-no', async (el) => {
  await put('decisions', { id: el.dataset.id, accepted: false, delta: Number(el.dataset.delta), date: today() });
  toast('Proposition refusée');
  rerender();
});

// ---------- Poids ----------
function weightView() {
  const t = today();
  const r = ref();
  const avg = avg7(S.weights, t);
  const wt = weekTarget();
  const tg = targetsFor();
  const pw = planWeek();
  const weights = [...S.weights].sort((a, b) => (a.date < b.date ? -1 : 1));
  const rows = planTable(S.settings, S.weights);
  const start = S.settings.planStart;
  // le graphique montre le plan jusqu'à 4 semaines après aujourd'hui (le tableau, lui, montre tout)
  const lastW = weights.length ? weights[weights.length - 1].date : t;
  const horizon = addDays(lastW > t ? lastW : t < start ? start : t, 28);
  const shown = rows.filter((row) => row.sun <= horizon);
  const band = [{ x: start, lo: S.settings.poids, hi: S.settings.poids }, ...shown.map((row) => ({ x: row.sun, lo: row.low, hi: row.high }))];
  const chart = lineChart({
    series: [
      { name: 'Pesées', color: C.muted, dots: true, line: false, points: weights.map((w) => ({ x: w.date, y: w.kg })) },
      { name: 'Moyenne 7 j', color: C.blue, points: smoothed(weights) },
      { name: 'Cible du plan', color: C.aqua, dashed: true, points: [{ x: start, y: S.settings.poids }, ...shown.map((row) => ({ x: row.sun, y: row.target }))] },
    ],
    band: { name: 'Fourchette 0,75-1 %/sem.', color: C.aqua, points: band },
    unit: 'kg', dec: 1, height: 220,
  });
  const existing = S.weights.find((w) => w.date === t);
  return `
  ${proposalCards()}
  <section class="card">
    <h2>Pesée du matin</h2>
    <div class="grid2">
      <label class="field"><span>Date</span><input class="input" type="date" id="w-date" value="${t}" data-change="w-date-change"></label>
      <label class="field"><span>Poids (kg)</span><input class="input strong" id="w-kg" inputmode="decimal" placeholder="81,5" value="${existing ? String(existing.kg).replace('.', ',') : ''}" data-enter="w-save"></label>
    </div>
    <button class="btn primary full big" data-act="w-save">Enregistrer</button>
    <p class="hint">Pèse-toi le matin, après les toilettes, avant de manger. Une seule pesée par jour (une nouvelle saisie remplace l'ancienne).</p>
  </section>
  <section class="card">
    <div class="stats3">
      <div><small>Moyenne 7 j</small><b>${avg ? fmt(avg, 1) : '–'}</b><small>kg</small></div>
      <div><small>${pw >= 1 ? `Cible sem. ${wt.n}` : 'Départ'}</small><b>${pw >= 1 ? fmt(wt.target, 1) : fmt(S.settings.poids, 1)}</b><small>${pw >= 1 ? `${fmt(wt.low, 1)}–${fmt(wt.high, 1)}` : 'kg'}</small></div>
      <div><small>Objectif kcal</small><b>${fmt(tg.kcalPlan)}</b><small>${S.settings.kcalAjust ? `ajust. ${S.settings.kcalAjust > 0 ? '+' : ''}${S.settings.kcalAjust}` : 'kcal'}</small></div>
    </div>
    <p class="hint">Les calculs utilisent ${r.source === 'moyenne' ? `ta moyenne de ${fmt(r.kg, 1)} kg (${r.n} pesée(s) sur 7 jours)` : `ton poids de profil (${fmt(r.kg, 1)} kg) en attendant tes pesées`}.</p>
    ${chart}
  </section>
  <section class="card">
    <h2>Plan semaine par semaine</h2>
    <p class="hint">Perte visée : 0,75 à 1 % du poids par semaine, à partir de ${fmt(S.settings.poids, 1)} kg le ${fmtDateCourt(start)}</p>
    <div class="table-wrap"><table class="table">
      <tr><th>Sem.</th><th>Du</th><th>Cible</th><th>Fourchette</th><th>Réel</th></tr>
      ${rows.map((row) => {
        const status = row.avg == null ? '' : row.avg <= row.high ? 'ok' : 'late';
        return `<tr class="${row.n === pw ? 'current' : ''}"><td>${row.n}</td><td>${fmtDateCourt(row.mon)}</td><td><b>${fmt(row.target, 1)}</b></td><td class="muted">${fmt(row.low, 1)}–${fmt(row.high, 1)}</td><td class="${status}">${row.avg == null ? '–' : fmt(row.avg, 1)}${status === 'ok' ? ' ✓' : status === 'late' ? ' ↑' : ''}</td></tr>`;
      }).join('')}
    </table></div>
  </section>
  <section class="card">
    <h2>Mes pesées</h2>
    ${weights.length ? `<ul class="card-list">${weights.slice().reverse().slice(0, 40).map((w) => `<li><button class="list-btn" data-act="w-edit" data-date="${w.date}"><span>${esc(fmtDateCourt(w.date))} <small class="muted">${w.source === 'sante' ? 'Santé' : 'manuel'}</small></span><span><b>${fmt(w.kg, 1)} kg</b></span></button></li>`).join('')}</ul>` : empty('Aucune pesée pour l\'instant.')}
  </section>`;
}
on('w-date-change', (el) => {
  const w = S.weights.find((x) => x.date === el.value);
  document.getElementById('w-kg').value = w ? String(w.kg).replace('.', ',') : '';
});
on('w-save', async () => {
  const date = document.getElementById('w-date').value || today();
  const kg = parseNum(document.getElementById('w-kg').value);
  if (!kg || kg < 30 || kg > 300) { toast('Indique ton poids en kg', 'warn'); return; }
  await put('weights', { date, kg: Math.round(kg * 10) / 10, source: 'manuel' });
  toast('Pesée enregistrée', 'ok');
  rerender();
});
export async function quickWeight(kgText) {
  const kg = parseNum(kgText);
  if (!kg || kg < 30 || kg > 300) { toast('Indique ton poids en kg', 'warn'); return false; }
  await put('weights', { date: today(), kg: Math.round(kg * 10) / 10, source: 'manuel' });
  toast('Pesée enregistrée', 'ok');
  return true;
}
on('w-edit', (el) => {
  const w = S.weights.find((x) => x.date === el.dataset.date);
  if (!w) return;
  openSheet(`Pesée du ${fmtDateCourt(w.date)}`, `
    <label class="field big-field"><span>Poids (kg)</span><input class="input xl" id="we-kg" inputmode="decimal" value="${String(w.kg).replace('.', ',')}"></label>
    <button class="btn primary full big" data-act="we-save" data-date="${w.date}">Enregistrer</button>
    <button class="btn danger full" data-act="we-del" data-date="${w.date}">Supprimer</button>`);
});
on('we-save', async (el) => {
  const kg = parseNum(document.getElementById('we-kg').value);
  if (!kg || kg < 30 || kg > 300) { toast('Poids invalide', 'warn'); return; }
  await put('weights', { date: el.dataset.date, kg: Math.round(kg * 10) / 10, source: 'manuel' });
  closeSheet(); rerender();
});
on('we-del', async (el) => {
  await del('weights', el.dataset.date);
  closeSheet(); toast('Pesée supprimée'); rerender();
});

// ---------- Exercices & records ----------
function allExerciseNames() {
  const names = new Map();
  for (const w of S.workouts) if (w.status === 'terminee') for (const e of w.exercises) if (e.sets.some((s) => s.done)) names.set(exKey(e.name), { name: e.name, type: e.type });
  return [...names.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

function exosView() {
  const list = allExerciseNames();
  if (!list.length) return `<section class="card">${empty('Termine ta première séance pour voir tes graphiques et records ici.')}</section>`;
  if (!UI.selEx || !list.some((x) => x.key === UI.selEx)) UI.selEx = list[0].key;
  const sel = list.find((x) => x.key === UI.selEx);
  const st = exerciseStats(S.workouts, sel.key);
  const isWeight = sel.type === 'poids';
  const chart = isWeight
    ? lineChart({ series: [
      { name: '1RM estimé', color: C.blue, dots: true, points: st.sessions.map((s) => ({ x: s.date, y: Math.round(s.best * 10) / 10 })) },
      { name: 'Charge max', color: C.orange, dots: true, points: st.sessions.map((s) => ({ x: s.date, y: s.topKg })) },
    ], unit: 'kg', dec: 1 })
    : lineChart({ series: [
      { name: 'Meilleure série', color: C.blue, dots: true, points: st.sessions.map((s) => ({ x: s.date, y: s.maxReps })) },
      { name: 'Total reps', color: C.orange, dots: true, points: st.sessions.map((s) => ({ x: s.date, y: s.totalReps })) },
    ], unit: 'reps', dec: 0 });
  return `
  <section class="card">
    <label class="field"><span>Exercice</span><select class="input" data-change="ex-select">
      ${list.map((x) => `<option value="${esc(x.key)}" ${x.key === sel.key ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
    </select></label>
    ${chart}
    ${isWeight ? '<p class="hint">1RM estimé = charge × (1 + reps / 30) : permet de comparer des séries avec des reps différentes.</p>' : ''}
  </section>
  <section class="card">
    <h2>Records personnels</h2>
    <div class="table-wrap"><table class="table">
      <tr><th>Exercice</th><th>Meilleure série</th><th>1RM est.</th></tr>
      ${list.map((x) => {
        const s = exerciseStats(S.workouts, x.key).pr;
        return x.type === 'poids'
          ? `<tr><td>${esc(x.name)}</td><td>${s.topKg ? `${fmt(s.topKg.topKg, 2)} kg × ${s.topKg.topReps}` : '–'}<small class="muted"> ${s.topKg ? fmtDateCourt(s.topKg.date) : ''}</small></td><td><b>${s.best ? fmt(s.best.best, 1) : '–'}</b></td></tr>`
          : `<tr><td>${esc(x.name)}</td><td>${s.maxReps ? `${s.maxReps.maxReps} reps` : '–'}<small class="muted"> ${s.maxReps ? fmtDateCourt(s.maxReps.date) : ''}</small></td><td class="muted">–</td></tr>`;
      }).join('')}
    </table></div>
  </section>`;
}
on('ex-select', (el) => { UI.selEx = el.value; rerender(); });

// ---------- Santé ----------
function healthView() {
  const from = addDays(today(), -29);
  const h = S.health.filter((x) => x.date >= from).sort((a, b) => (a.date < b.date ? -1 : 1));
  const pts = (f) => h.filter((x) => x[f] != null).map((x) => ({ x: x.date, y: x[f] }));
  return `
  <section class="card">
    <div class="card-head"><h2>Apple Santé</h2><button class="btn primary small" data-act="sante-import">Importer</button></div>
    <p class="hint">30 derniers jours. Touche un graphique pour voir la valeur du jour.</p>
    <h3 class="list-title">Pas</h3>${barChart({ points: pts('pas'), color: C.blue, unit: 'pas', goal: 8000, name: 'Pas' })}
    <h3 class="list-title">Sommeil (heures)</h3>${barChart({ points: pts('sommeil'), color: C.violet, unit: 'h', dec: 1, goal: 8, name: 'Sommeil' })}
    <h3 class="list-title">Calories actives</h3>${barChart({ points: pts('kcal_actives'), color: C.orange, unit: 'kcal', name: 'Calories actives' })}
  </section>
  <section class="card">
    <h2>Données importées</h2>
    ${S.health.length ? `<div class="table-wrap"><table class="table">
      <tr><th>Date</th><th>Pas</th><th>Sommeil</th><th>kcal act.</th><th></th></tr>
      ${[...S.health].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30).map((x) => `<tr><td>${fmtDateCourt(x.date)}</td><td>${x.pas != null ? fmt(x.pas) : '–'}</td><td>${x.sommeil != null ? fmt(x.sommeil, 1) + ' h' : '–'}</td><td>${x.kcal_actives != null ? fmt(x.kcal_actives) : '–'}</td><td><button class="icon-btn" data-act="h-del" data-date="${x.date}" aria-label="Supprimer">✕</button></td></tr>`).join('')}
    </table></div>` : empty('Rien d\'importé pour l\'instant. Suis le guide « Raccourci Santé » dans Réglages.')}
  </section>`;
}
on('h-del', async (el) => {
  if (!(await confirmBox(`Supprimer les données Santé du ${fmtDateCourt(el.dataset.date)} ?`, { ok: 'Supprimer', danger: true }))) return;
  await del('health', el.dataset.date);
  rerender();
});

