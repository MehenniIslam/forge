// =============================================================
// Onglet CALISTHÉNIE : programme tractions 7 semaines, GTG, tests, L-sit et ATR.
// =============================================================
import { S, put, del, setKV, saveSettings } from '../db.js';
import { today, addDays, fmt, fmtDateCourt, fmtDateMini, esc, uid, parseNum, JOURS_COURTS, mondayOf, dow } from '../util.js';
import { pullPlanForDate, canAdvance, holdsAtGoal, weekMonday, FINAL_TEST_OFFSET } from '../calc.js';
import { on, openSheet, closeSheet, toast, confirmBox, bar, segmented, empty, rerender, lineChart, beep, unlockAudio, vibrate } from '../ui.js';
import { UI, pullPlan, pullCfg, pullTests, heavyDays, currentMax, gtgCount, skills, skillLogsFor, skillDaysThisWeek, bestHold, bestPullMax } from '../logic.js';
import { pullPlanText } from './seance.js';

const COLORS = { blue: '#3987e5', orange: '#d95926', aqua: '#199e70', muted: '#6b7385' };

export function render() {
  return `
  <header class="page-head"><h1>Calisthénie</h1></header>
  ${segmented('cal-tab', [['tractions', 'Tractions'], ['lsit', 'L-sit'], ['atr', 'ATR']], UI.calTab)}
  ${UI.calTab === 'tractions' ? pullView() : skillView(UI.calTab)}`;
}
on('cal-tab', (el) => { UI.calTab = el.dataset.val; stopHold(true); rerender(); });

// ---------- Compteur GTG (réutilisé sur l'accueil) ----------
export function gtgBlock({ home = false } = {}) {
  const pp = pullPlan();
  const n = gtgCount();
  const isGtg = pp.type === 'gtg';
  const target = isGtg ? pp.gtgTarget : 0;
  return `
  <div class="gtg ${isGtg ? '' : 'off'}">
    <div class="gtg-count"><b>${n}</b>${isGtg ? `<span>/ ${target} séries</span>` : '<span>séries</span>'}</div>
    <div class="gtg-info">
      <b>${isGtg ? `GTG : séries de ${pp.gtgReps} reps` : 'Tractions du jour'}</b>
      <small>${esc(isGtg ? 'Réparties dans la journée, jamais jusqu\'à l\'échec' : pullPlanText(pp))}</small>
      ${isGtg ? bar(n, target, 'prot') : ''}
    </div>
    <div class="gtg-btns">
      <button class="btn primary gtg-plus" data-act="gtg-plus">+1 série</button>
      ${n ? `<button class="btn ghost small" data-act="gtg-minus" aria-label="Annuler la dernière série">−1</button>` : ''}
    </div>
  </div>
  ${!home && !isGtg && n === 0 ? '' : ''}`;
}
on('gtg-plus', async () => {
  const pp = pullPlan();
  await put('pullLogs', { id: uid(), date: today(), type: 'gtg', reps: pp.gtgReps, at: Date.now() });
  vibrate(40);
  const n = gtgCount();
  if (pp.type === 'gtg' && n === pp.gtgTarget) toast('Objectif GTG du jour atteint 🎉', 'ok');
  else toast(`Série ${n} notée`, 'ok');
  rerender();
});
on('gtg-minus', async () => {
  const list = S.pullLogs.filter((l) => l.type === 'gtg' && l.date === today()).sort((a, b) => (a.at || 0) - (b.at || 0));
  if (list.length) await del('pullLogs', list[list.length - 1].id);
  rerender();
});

// ---------- Tractions ----------
function pullView() {
  const pp = pullPlan();
  const cm = currentMax();
  const best = bestPullMax();
  const tests = pullTests().sort((a, b) => (a.date < b.date ? -1 : 1));
  const cfg = pullCfg();
  const finalTest = addDays(cfg.start, FINAL_TEST_OFFSET);
  const weekLabel = pp.week >= 1 && pp.week <= 7 ? `Semaine ${pp.week} / 7` : pp.type === 'avant' ? `Début le ${fmtDateCourt(cfg.start)}` : 'Cycle terminé';
  const isTestDay = pp.type === 'test' || pp.type === 'test_final';
  const todayTest = tests.find((t) => t.date === today());
  // graphique : tests + trajectoire visée
  const chart = lineChart({
    series: [
      { name: 'Max testé', color: COLORS.blue, dots: true, points: [{ x: cfg.start, y: cfg.initialMax }, ...tests.filter((t) => t.date >= cfg.start).map((t) => ({ x: t.date, y: t.reps }))] },
      { name: 'Trajectoire vers ' + S.settings.pullGoal, color: COLORS.muted, dashed: true, points: [{ x: cfg.start, y: cfg.initialMax }, { x: finalTest, y: S.settings.pullGoal }] },
    ], unit: 'reps', dec: 0,
  });
  return `
  <section class="card hero">
    <p class="eyebrow">${esc(weekLabel)} · objectif ${S.settings.pullGoal} tractions vers le ${fmtDateCourt(finalTest)}</p>
    <h2 class="hero-title">${esc(pullPlanText(pp))}</h2>
    ${pp.type === 'lourde' || pp.type === 'leger' ? `<p class="hint">Les séries sont déjà préparées dans ta séance du jour (exercice « Tractions (programme) »).</p><a class="btn primary full" href="#seance">Ouvrir la séance</a>` : ''}
    ${isTestDay ? `<p class="hint">Échauffe-toi bien (2-3 séries faciles), puis une seule série au maximum, propre.</p>
      ${todayTest ? `<p class="ok-line">✓ Test du jour : ${todayTest.reps} tractions</p>` : ''}
      <button class="btn primary full big" data-act="pull-test">${todayTest ? 'Modifier mon test' : 'Saisir mon test'}</button>` : ''}
  </section>
  <section class="card">${gtgBlock()}</section>
  <section class="card">
    <div class="card-head"><h2>Mon max</h2><button class="btn ghost small" data-act="pull-test">+ Test</button></div>
    <div class="big-stat"><b>${cm.max}</b><span>tractions (max en vigueur${cm.initial ? ', de départ' : `, testé le ${fmtDateCourt(cm.date)}`})</span></div>
    ${bar(best, S.settings.pullGoal, 'prot')}
    <p class="hint">Meilleur : ${best} / ${S.settings.pullGoal}. Les tests de fin de semaines 2 et 4 recalculent le programme.</p>
    ${chart}
  </section>
  <section class="card">
    <h2>Le programme semaine par semaine</h2>
    ${programTable()}
  </section>
  <section class="card">
    <h2>Historique des tests</h2>
    ${tests.length ? `<ul class="card-list">${tests.slice().reverse().map((t) => `<li class="row between"><span>${esc(fmtDateCourt(t.date))}</span><span><b>${t.reps}</b> tractions <button class="icon-btn" data-act="pull-test-del" data-id="${t.id}" aria-label="Supprimer">✕</button></span></li>`).join('')}</ul>` : empty('Aucun test pour l\'instant (max de départ : ' + cfg.initialMax + ').')}
    ${gtgHistory()}
  </section>
  ${pp.type === 'fini' ? `<button class="btn primary full big" data-act="pull-new-cycle">Relancer un cycle de 7 semaines</button>` : ''}`;
}

function programTable() {
  const cfg = pullCfg();
  const hd = heavyDays();
  const tests = pullTests();
  const cur = pullPlan().week;
  let html = '<div class="weeks">';
  for (let w = 1; w <= 7; w++) {
    const mon = weekMonday(cfg.start, w);
    const items = [];
    let gtg = null;
    const gtgDays = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i);
      const p = pullPlanForDate(cfg, tests, d, hd);
      const day = JOURS_COURTS[dow(d)];
      if (p.type === 'lourde') items.push(`<li><b>${day}</b> ${p.sets.join('·')}${p.deload ? ' <span class="tag">décharge</span>' : ''}</li>`);
      if (p.type === 'leger') items.push(`<li><b>${day}</b> léger ${p.sets.join('·')}</li>`);
      if (p.type === 'test') items.push(`<li><b>${day}</b> <span class="tag ok">test de max</span></li>`);
      if (p.type === 'test_final') items.push(`<li><b>${day}</b> <span class="tag ok">TEST FINAL</span></li>`);
      if (p.type === 'gtg') { gtg = `${p.gtgTarget}×${p.gtgReps}`; gtgDays.push(day.replace('.', '')); }
    }
    html += `<div class="week ${w === cur ? 'current' : ''}">
      <div class="week-h"><b>S${w}</b><small>${fmtDateMini(mon)} → ${fmtDateMini(addDays(mon, 6))}</small></div>
      <ul>${items.join('')}${gtg ? `<li><b>GTG</b> ${gtg} (${gtgDays.join(', ')})</li>` : ''}</ul></div>`;
  }
  return html + '</div><p class="hint">Les séries des semaines à venir sont recalculées automatiquement après chaque test.</p>';
}

function gtgHistory() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today(), -i);
    days.push({ d, n: gtgCount(d) });
  }
  if (!days.some((x) => x.n)) return '';
  return `<h3 class="list-title">GTG des 7 derniers jours</h3><div class="mini-days">${days.map((x) => `<div><b>${x.n || '·'}</b><small>${fmtDateMini(x.d)}</small></div>`).join('')}</div>`;
}

on('pull-test', () => {
  const t = pullTests().find((x) => x.date === today());
  openSheet('Test de max (tractions)', `
    <label class="field"><span>Date</span><input class="input" type="date" id="pt-date" value="${today()}"></label>
    <label class="field big-field"><span>Nombre de tractions (1 série, propre)</span><input class="input xl" id="pt-reps" inputmode="numeric" pattern="[0-9]*" value="${t ? t.reps : ''}" data-enter="pull-test-save"></label>
    <button class="btn primary full big" data-act="pull-test-save">Enregistrer</button>`).querySelector('#pt-reps').focus();
});
on('pull-test-save', async () => {
  const date = document.getElementById('pt-date').value || today();
  const reps = parseNum(document.getElementById('pt-reps').value);
  if (!reps || reps < 1 || reps > 100) { toast('Indique un nombre de tractions', 'warn'); return; }
  const existing = S.pullLogs.find((l) => l.type === 'test' && l.date === date);
  await put('pullLogs', { id: existing ? existing.id : 'test-' + date, date, type: 'test', reps: Math.round(reps) });
  closeSheet();
  toast(`Test enregistré : ${Math.round(reps)}. Programme recalculé !`, 'ok');
  rerender();
});
on('pull-test-del', async (el) => {
  if (!(await confirmBox('Supprimer ce test ? Le programme sera recalculé.', { ok: 'Supprimer', danger: true }))) return;
  await del('pullLogs', el.dataset.id);
  rerender();
});
on('pull-new-cycle', async () => {
  const best = Math.max(currentMax().max, ...pullTests().map((t) => t.reps));
  const d = today();
  const nextMon = addDays(mondayOf(d), 7);
  if (!(await confirmBox(`Nouveau cycle de 7 semaines à partir du lundi ${fmtDateCourt(nextMon)}, calculé sur ton max de ${best} ?`, { ok: 'Lancer' }))) return;
  S.settings.pullStart = nextMon;
  S.settings.pullInitialMax = best;
  S.settings.pullGoal = Math.round(best * 1.5);
  await saveSettings();
  rerender();
});

// ---------- Skills (L-sit / ATR) ----------
let hold = { running: false, phase: null, t0: 0, prepEnd: 0, goalBeeped: false, iv: null, skill: null };

function todayLog(skill) {
  const sk = skills()[skill];
  return S.skillLogs.find((l) => l.skill === skill && l.date === today() && l.stage === sk.stage);
}

function skillView(skill) {
  const sk = skills()[skill];
  const st = sk.stages[sk.stage];
  const log = todayLog(skill);
  const holds = log?.holds || [];
  const okCount = holdsAtGoal(holds, st.goal);
  const isLast = sk.stage === sk.stages.length - 1;
  const propose = canAdvance(holds, st.goal) && !isLast && !log?.dismissed;
  const logs = skillLogsFor(skill);
  const stageLogs = logs.filter((l) => l.stage === sk.stage && (l.holds || []).length);
  const chart = lineChart({
    series: [
      { name: 'Meilleur maintien', color: COLORS.blue, dots: true, points: stageLogs.map((l) => ({ x: l.date, y: Math.max(...l.holds) })) },
      ...(stageLogs.length ? [{ name: `Objectif ${st.goal} s`, color: COLORS.muted, dashed: true, points: [{ x: stageLogs[0].date, y: st.goal }, { x: stageLogs[stageLogs.length - 1].date === stageLogs[0].date ? addDays(stageLogs[0].date, 1) : stageLogs[stageLogs.length - 1].date, y: st.goal }] }] : []),
    ], unit: 's', dec: 1,
  });
  return `
  <section class="card hero">
    <p class="eyebrow">${esc(sk.name)} · étape ${sk.stage + 1} / ${sk.stages.length}</p>
    <h2 class="hero-title">${esc(st.name)}</h2>
    <p class="muted">Objectif : 3 maintiens propres de ${st.goal} s dans la même séance</p>
    <ol class="stages">${sk.stages.map((s, i) => `<li class="${i < sk.stage ? 'done' : i === sk.stage ? 'cur' : ''}"><span>${i < sk.stage ? '✓' : i + 1}</span>${esc(s.name)} <small>${s.goal} s · record ${fmt(bestHold(skill, i), 1)} s</small></li>`).join('')}</ol>
  </section>
  ${propose ? `<div class="alert good">🎉 Bravo : ${okCount} maintiens ≥ ${st.goal} s ! Passer à « ${esc(sk.stages[sk.stage + 1].name)} » ?
    <div class="row gap"><button class="btn primary grow" data-act="sk-advance">Passer à l'étape suivante</button><button class="btn ghost" data-act="sk-dismiss">Pas encore</button></div></div>` : ''}
  <section class="card">
    <div class="hold-display" id="hold-display" data-goal="${st.goal}">${hold.running && hold.skill === skill ? '…' : '0,0'}<small>secondes</small></div>
    <div class="row gap">
      <button class="btn primary grow big" data-act="hold-start" id="hold-btn">${hold.running && hold.skill === skill ? 'Stop et enregistrer' : 'Démarrer le maintien'}</button>
      ${hold.running && hold.skill === skill ? '<button class="btn ghost" data-act="hold-cancel">Annuler</button>' : ''}
    </div>
    <p class="hint">Décompte de 3 s pour te placer, puis le chrono tourne. Un bip sonne à ${st.goal} s.</p>
    <div class="row gap manual"><input class="input" id="hold-manual" inputmode="decimal" placeholder="ou saisis un temps (s)" data-enter="hold-add"><button class="btn ghost" data-act="hold-add">Ajouter</button></div>
    <h3 class="list-title">Aujourd'hui (${okCount} / 3 à ${st.goal} s)</h3>
    ${holds.length ? `<div class="chips wrap">${holds.map((h, i) => `<button class="chip ${h >= st.goal ? 'on' : ''}" data-act="hold-del" data-i="${i}" aria-label="Supprimer ${fmt(h, 1)} s">${fmt(h, 1)} s ✕</button>`).join('')}</div>` : empty('Aucun maintien aujourd\'hui.')}
    <p class="hint">Skill cette semaine : <b>${skillDaysThisWeek()} / 6 jours</b> (objectif 5 à 6 jours, 10-15 min).</p>
  </section>
  <section class="card">
    <h2>Progression – ${esc(st.name)}</h2>
    <p class="muted">Record de l'étape : <b>${fmt(bestHold(skill, sk.stage), 1)} s</b></p>
    ${chart}
  </section>
  <section class="card">
    <div class="card-head"><h2>Historique</h2><button class="btn ghost small" data-act="sk-stage">Changer d'étape</button></div>
    ${logs.length ? `<ul class="card-list">${logs.slice().reverse().slice(0, 30).map((l) => `<li class="row between"><span>${esc(fmtDateCourt(l.date))}<small class="muted"> · ${esc(sk.stages[l.stage]?.name || '')}</small></span>
      <span>${(l.holds || []).map((h) => fmt(h, 1)).join(' · ')} s <button class="icon-btn" data-act="sk-log-del" data-id="${l.id}" aria-label="Supprimer">✕</button></span></li>`).join('')}</ul>` : empty('Tes séances de skill apparaîtront ici.')}
  </section>`;
}

async function addHold(skill, secs) {
  const sk = skills()[skill];
  const date = today();
  const id = `${skill}-${date}-${sk.stage}`;
  const log = S.skillLogs.find((l) => l.id === id) || { id, date, skill, stage: sk.stage, holds: [] };
  log.holds = [...(log.holds || []), Math.round(secs * 10) / 10];
  await put('skillLogs', log);
}

function updateHoldDisplay() {
  const el = document.getElementById('hold-display');
  if (!el || !hold.running) return;
  const now = Date.now();
  if (hold.phase === 'prep') {
    const r = Math.ceil((hold.prepEnd - now) / 1000);
    if (r <= 0) {
      hold.phase = 'hold'; hold.t0 = now; beep(1); vibrate(60);
    } else {
      el.innerHTML = `${r}<small>prépare-toi…</small>`;
      el.className = 'hold-display prep';
      return;
    }
  }
  const s = (now - hold.t0) / 1000;
  const goal = Number(el.dataset.goal);
  el.className = `hold-display running ${s >= goal ? 'reached' : ''}`;
  el.innerHTML = `${fmt(s, 1)}<small>secondes</small>`;
  if (s >= goal && !hold.goalBeeped) { hold.goalBeeped = true; beep(2); vibrate(); }
}

function stopHold(silent) {
  clearInterval(hold.iv);
  const wasRunning = hold.running;
  const secs = hold.running && hold.phase === 'hold' ? (Date.now() - hold.t0) / 1000 : 0;
  const skill = hold.skill;
  hold = { running: false, phase: null, t0: 0, prepEnd: 0, goalBeeped: false, iv: null, skill: null };
  return silent || !wasRunning ? 0 : { secs, skill };
}

on('hold-start', async () => {
  if (hold.running) {
    const r = stopHold(false);
    if (r && r.secs >= 1) { await addHold(r.skill, r.secs); toast(`${fmt(r.secs, 1)} s enregistrées`, 'ok'); }
    rerender();
    return;
  }
  unlockAudio();
  hold = { running: true, phase: 'prep', prepEnd: Date.now() + 3000, t0: 0, goalBeeped: false, skill: UI.calTab, iv: setInterval(updateHoldDisplay, 100) };
  rerender();
  updateHoldDisplay();
});
on('hold-cancel', () => { stopHold(true); rerender(); });
on('hold-add', async () => {
  const v = parseNum(document.getElementById('hold-manual').value);
  if (!v || v <= 0 || v > 600) { toast('Indique un temps en secondes', 'warn'); return; }
  await addHold(UI.calTab, v);
  rerender();
});
on('hold-del', async (el) => {
  const log = todayLog(UI.calTab);
  if (!log) return;
  log.holds.splice(Number(el.dataset.i), 1);
  if (log.holds.length) await put('skillLogs', log); else await del('skillLogs', log.id);
  rerender();
});
on('sk-advance', async () => {
  const all = skills();
  const sk = all[UI.calTab];
  sk.stage = Math.min(sk.stage + 1, sk.stages.length - 1);
  await setKV('skills', all);
  toast(`Nouvelle étape : ${sk.stages[sk.stage].name} 💪`, 'ok');
  rerender();
});
on('sk-dismiss', async () => {
  const log = todayLog(UI.calTab);
  if (log) { log.dismissed = true; await put('skillLogs', log); }
  rerender();
});
on('sk-stage', () => {
  const sk = skills()[UI.calTab];
  openSheet(`Étape actuelle – ${sk.name}`, `<div class="card-list">${sk.stages.map((s, i) => `<button class="btn ${i === sk.stage ? 'primary' : 'ghost'} full" data-act="sk-stage-set" data-i="${i}">${i + 1}. ${esc(s.name)} (${s.goal} s)</button>`).join('')}</div>
    <p class="hint">Les objectifs en secondes se modifient dans Réglages.</p>`);
});
on('sk-stage-set', async (el) => {
  const all = skills();
  all[UI.calTab].stage = Number(el.dataset.i);
  await setKV('skills', all);
  closeSheet();
  rerender();
});
on('sk-log-del', async (el) => {
  if (!(await confirmBox('Supprimer cette séance de skill ?', { ok: 'Supprimer', danger: true }))) return;
  await del('skillLogs', el.dataset.id);
  rerender();
});

