// =============================================================
// Onglet ACCUEIL : le tableau de bord du jour.
// =============================================================
import { S } from '../db.js';
import { today, addDays, fmt, fmtDateLong, fmtDateCourt, esc, diffDays, dow } from '../util.js';
import { on, bar, rerender } from '../ui.js';
import { UI, planWeek, weekTarget, todayAvg, weightOn, templateForDate, activeWorkout, doneToday, healthOn, skills, bestHold, bestPullMax, backupDue, proposals, program, pullPlan } from '../logic.js';
import { summaryBlock, proteinAlert } from './nutrition.js';
import { gtgBlock } from './calis.js';
import { quickWeight } from './progres.js';

function goalsBlock() {
  const sk = skills();
  const best = bestPullMax();
  const row = (label, sub, pct) => `<div class="goal-row"><div class="macro-head"><span class="lbl">${label}</span><span>${sub}</span></div>${bar(pct, 100, 'prot')}</div>`;
  const skillRow = (key) => {
    const s = sk[key];
    const st = s.stages[s.stage];
    const b = bestHold(key, s.stage);
    const pct = ((s.stage + Math.min(1, b / st.goal)) / s.stages.length) * 100;
    return row(esc(s.name), `étape ${s.stage + 1}/${s.stages.length} · ${esc(st.name)} · ${fmt(b, 1)}/${st.goal} s`, pct);
  };
  return row('Tractions', `${best} / ${S.settings.pullGoal}`, (best / S.settings.pullGoal) * 100) + skillRow('lsit') + skillRow('atr');
}

export function render() {
  const t = today();
  const pw = planWeek();
  const start = S.settings.planStart;
  const avg = todayAvg();
  const wt = weekTarget();
  const tw = weightOn(t);
  const tpl = templateForDate(t);
  const active = activeWorkout();
  const done = doneToday();
  const y = healthOn(addDays(t, -1));
  const night = healthOn(t)?.sommeil != null ? healthOn(t) : y;
  const props = proposals();
  const restNote = program().restNotes?.[dow(t)] || 'Repos';
  const pp = pullPlan();
  return `
  <header class="page-head home-head">
    <div>
      <p class="eyebrow">${esc(fmtDateLong(t))}</p>
      <h1>Salut 👋</h1>
      <p class="muted">${pw >= 1 ? `Semaine ${pw} du plan` : `Le plan démarre le ${fmtDateCourt(start)} (J-${diffDays(t, start)})`}</p>
    </div>
    <button class="btn ghost small" data-act="sante-import">⤓ Santé</button>
  </header>

  ${backupDue() ? `<div class="alert soft">💾 ${dow(t) === 0 ? 'C\'est dimanche :' : 'Ça fait un moment :'} pense à sauvegarder tes données (iOS peut effacer les données d'une app web).
    <button class="btn primary full" data-act="backup-export">Sauvegarder maintenant</button></div>` : ''}
  ${props.length ? `<a class="alert good block" href="#progres">⚖️ ${props.length} ajustement de calories à valider → Progrès</a>` : ''}

  <section class="card">
    <div class="card-head"><h2>Nutrition du jour</h2><a class="link" href="#nutrition">Journal ›</a></div>
    ${summaryBlock(t, { compact: true })}
  </section>
  ${proteinAlert(t)}

  <section class="card">
    <div class="card-head"><h2>Poids</h2><a class="link" href="#progres">Courbe ›</a></div>
    <div class="stats3">
      <div><small>Moyenne 7 j</small><b>${avg ? fmt(avg, 1) : '–'}</b><small>kg</small></div>
      <div><small>${pw >= 1 ? `Cible sem. ${wt.n}` : 'Poids de départ'}</small><b>${pw >= 1 ? fmt(wt.target, 1) : fmt(S.settings.poids, 1)}</b><small>kg</small></div>
      <div><small>Écart</small><b class="${avg && pw >= 1 ? (avg <= wt.high ? 'ok' : 'late') : ''}">${avg && pw >= 1 ? `${avg - wt.target > 0 ? '+' : ''}${fmt(avg - wt.target, 1)}` : '–'}</b><small>kg</small></div>
    </div>
    ${tw ? `<p class="ok-line">✓ Pesée du jour : ${fmt(tw.kg, 1)} kg</p>` : `
    <div class="row gap"><input class="input grow" id="home-kg" inputmode="decimal" placeholder="Poids de ce matin (kg)" data-enter="home-weight"><button class="btn primary" data-act="home-weight">OK</button></div>`}
  </section>

  <section class="card">
    <div class="card-head"><h2>Séance du jour</h2><a class="link" href="#seance">Séance ›</a></div>
    ${active ? `<p><b>${esc(active.name)}</b> en cours</p><a class="btn primary full big" href="#seance">Reprendre la séance</a>`
      : tpl ? `<p class="big-name">${esc(tpl.name)} <small class="muted">· ${tpl.exercises.length} exercices</small></p>
        ${done.length ? '<p class="ok-line">✓ Séance faite, bien joué !</p>' : `<button class="btn primary full big" data-act="w-start" data-id="${tpl.id}">Commencer</button>`}`
      : `<p class="big-name">Repos</p><p class="muted">${esc(restNote)}</p>`}
  </section>

  <section class="card">
    <div class="card-head"><h2>Tractions</h2><a class="link" href="#calis">Programme ›</a></div>
    ${gtgBlock({ home: true })}
  </section>

  <section class="card">
    <div class="card-head"><h2>Santé</h2><a class="link" href="#progres" data-act="home-health">Graphiques ›</a></div>
    <div class="stats3">
      <div><small>Pas hier</small><b>${y?.pas != null ? fmt(y.pas) : '–'}</b><small>pas</small></div>
      <div><small>Sommeil${night && night.date === t ? ' (nuit)' : ' hier'}</small><b>${night?.sommeil != null ? fmt(night.sommeil, 1) : '–'}</b><small>heures</small></div>
      <div><small>Actives hier</small><b>${y?.kcal_actives != null ? fmt(y.kcal_actives) : '–'}</b><small>kcal</small></div>
    </div>
    <button class="btn ghost full" data-act="sante-import">Importer depuis Santé</button>
  </section>

  <section class="card">
    <div class="card-head"><h2>Mes 3 objectifs</h2><a class="link" href="#calis">Détails ›</a></div>
    ${goalsBlock()}
    ${pp.type === 'test' || pp.type === 'test_final' ? '<p class="alert good">🎯 Aujourd\'hui : test de max de tractions !</p>' : ''}
  </section>`;
}

on('home-weight', async () => {
  const ok = await quickWeight(document.getElementById('home-kg')?.value);
  if (ok) rerender();
});
on('home-health', () => { UI.progTab = 'sante'; location.hash = '#progres'; rerender(); });
