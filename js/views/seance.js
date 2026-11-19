// =============================================================
// Onglet SÉANCE : séance du jour, saisie des séries, minuteur, historique, édition du programme.
// =============================================================
import { S, put, del, setKV } from '../db.js';
import { seedProgram } from '../data.js';
import { today, fmt, fmtDateCourt, fmtDateLong, esc, uid, parseNum, JOURS, SEMAINE, dow } from '../util.js';
import { exKey, lastPerformance, progression, newRecords, heavySets } from '../calc.js';
import { on, openSheet, closeSheet, toast, confirmBox, empty, rerender, unlockAudio, keepAwake } from '../ui.js';
import { startTimer, stopTimer } from '../timer.js';
import { UI, program, templateById, templateForDate, activeWorkout, doneToday, pullPlan, currentMax } from '../logic.js';

let mode = 'jour'; // 'jour' | 'programme'

const repsTarget = (e) => (e.type === 'max' ? 'max' : e.repMin && e.repMax && e.repMin !== e.repMax ? `${e.repMin}-${e.repMax}` : `${e.repMax || e.repMin || '?'}`);
const restOf = (e) => e.rest || (e.big ? S.settings.restBig : S.settings.restSmall);
const setsSummary = (sets) => sets.map((s) => (parseNum(s.kg) ? `${fmt(parseNum(s.kg), 2)}×${s.reps}` : `${s.reps}`)).join(' · ');

export function pullPlanText(pp) {
  switch (pp.type) {
    case 'lourde': return `Séance lourde${pp.deload ? ' (décharge)' : ''} : ${pp.sets.join(' · ')} reps, 2-3 min de repos`;
    case 'test': return 'Test de max : 1 série au maximum, propre';
    case 'test_final': return 'TEST FINAL : 1 série au maximum 🎯';
    case 'leger': return `Séance légère : ${pp.sets.join(' · ')} reps`;
    case 'gtg': return `Grease the groove : ${pp.gtgTarget} séries de ${pp.gtgReps} reps dans la journée`;
    case 'repos': return pp.note;
    case 'avant': return `Le programme démarre le ${fmtDateLong(S.settings.pullStart)}`;
    default: return 'Programme terminé : relance un cycle dans Calisthénie';
  }
}

// ---------- Création d'une séance à partir d'un modèle ----------
function buildExercise(e, pp) {
  const base = { id: uid(), name: e.name, type: e.type, repMin: e.repMin, repMax: e.repMax, rest: restOf(e), small: !!e.small, big: !!e.big, note: e.note || '', plannedSets: e.sets };
  if (e.type === 'pullup') {
    let modeP = 'libre', targets, note;
    if (pp.type === 'lourde') { modeP = 'lourde'; targets = pp.sets; note = `Semaine ${pp.week}${pp.deload ? ' – décharge' : ''} du programme tractions · max actuel ${pp.max}`; }
    else if (pp.type === 'test' || pp.type === 'test_final') { modeP = 'test'; targets = ['max']; note = 'Test de max : échauffe-toi, puis 1 série au maximum (menton au-dessus de la barre, bras tendus en bas).'; }
    else if (pp.type === 'leger') { modeP = 'leger'; targets = pp.sets; note = 'Semaine 7 : séance légère pour arriver frais au test.'; }
    else { targets = heavySets(currentMax().max, 0); note = 'Hors programme aujourd\'hui : séries à ~60-70 % de ton max.'; }
    return { ...base, mode: modeP, rest: modeP === 'test' ? 180 : 150, note, sets: targets.map((t) => ({ target: String(t), reps: '', kg: '', done: false })) };
  }
  const last = lastPerformance(S.workouts, exKey(e.name));
  const sug = progression(e, last);
  const sets = Array.from({ length: Math.max(1, e.sets) }, () => ({ target: repsTarget(e), reps: '', kg: sug ? String(sug.kg).replace('.', ',') : '', done: false }));
  return { ...base, sug: sug ? { text: sug.text, up: sug.up } : null, sets };
}

async function startWorkout(templateId) {
  const t = templateById(templateId);
  if (!t) return;
  const date = today();
  const pp = pullPlan(date);
  const w = { id: uid(), date, templateId, name: t.name, status: 'en_cours', startedAt: Date.now(), exercises: t.exercises.map((e) => buildExercise(e, pp)) };
  await put('workouts', w);
  await setKV('activeWorkout', w.id);
  unlockAudio();
  if (S.settings.ecranAllume) keepAwake(true);
  location.hash = '#seance';
  mode = 'jour';
  rerender();
}

// ---------- Affichage ----------
export function render() {
  const editing = UI.editingWorkout ? S.workouts.find((w) => w.id === UI.editingWorkout) : null;
  if (editing) return workoutEditor(editing, true);
  const w = activeWorkout();
  if (w) return workoutEditor(w, false);
  if (mode === 'programme') return programEditor();
  return dayView();
}

function dayView() {
  const t = templateForDate();
  const done = doneToday();
  const pp = pullPlan();
  const restNote = program().restNotes?.[dow(today())] || 'Repos';
  const others = program().templates.filter((x) => !t || x.id !== t.id);
  const history = S.workouts.filter((w) => w.status === 'terminee').sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.finishedAt || 0) - (a.finishedAt || 0))).slice(0, 20);
  return `
  <header class="page-head"><h1>Séance</h1><button class="btn ghost small" data-act="prog-open">✎ Programme</button></header>
  <section class="card hero">
    <p class="eyebrow">${esc(JOURS[dow(today())])} · séance du jour</p>
    ${t ? `<h2 class="hero-title">${esc(t.name)}</h2>
      <ul class="ex-preview">${t.exercises.map((e) => `<li><span>${esc(e.name)}</span><span class="muted">${e.type === 'pullup' ? 'programme' : `${e.sets}×${repsTarget(e)}`}</span></li>`).join('')}</ul>
      ${done.length ? `<p class="ok-line">✓ Séance faite aujourd'hui (${done.map((d) => esc(d.name)).join(', ')})</p>` : ''}
      <button class="btn primary full big" data-act="w-start" data-id="${t.id}">${done.length ? 'Refaire une séance' : 'Commencer'}</button>`
    : `<h2 class="hero-title">Repos</h2><p class="muted">${esc(restNote)}</p>`}
    ${t?.exercises.some((e) => e.type === 'pullup') ? `<p class="hint">Tractions : ${esc(pullPlanText(pp))}</p>` : ''}
  </section>
  <section class="card">
    <h2>Choisir une autre séance</h2>
    <div class="chips wrap">${others.map((x) => `<button class="chip big" data-act="w-start" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>
  </section>
  <section class="card">
    <h2>Historique</h2>
    ${history.length ? `<ul class="card-list">${history.map((w) => {
      const nSets = w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
      return `<li><button class="list-btn" data-act="w-open" data-id="${w.id}"><span><b>${esc(w.name)}</b><small>${esc(fmtDateCourt(w.date))} · ${nSets} séries</small></span><span class="chev">›</span></button></li>`;
    }).join('')}</ul>` : empty('Tes séances terminées apparaîtront ici.')}
  </section>`;
}

function exerciseCard(w, ex, i, editingPast) {
  const last = lastPerformance(S.workouts, exKey(ex.name), w.id);
  const isPull = ex.type === 'pullup';
  const target = isPull ? (ex.mode === 'test' ? 'test de max' : `${ex.sets.length} séries`) : `${ex.plannedSets || ex.sets.length}×${repsTarget(ex)}`;
  return `
  <section class="card ex-card" id="ex-${i}">
    <div class="card-head">
      <h2>${esc(ex.name)}</h2>
      <span class="muted">${esc(target)} · repos ${fmt(ex.rest / 60, 1)} min</span>
    </div>
    ${ex.note ? `<p class="hint">${esc(ex.note)}</p>` : ''}
    ${last ? `<p class="last">Dernière fois (${esc(fmtDateCourt(last.date))}) : <b>${esc(setsSummary(last.sets))}</b></p>` : '<p class="last muted">Première fois sur cet exercice</p>'}
    ${ex.sug ? `<p class="sug ${ex.sug.up ? 'up' : ''}">${ex.sug.up ? '⬆️ ' : ''}${esc(ex.sug.text)}</p>` : ''}
    <div class="sets">
      <div class="set-row head"><span>#</span><span>${ex.type === 'poids' ? 'kg' : 'lest kg'}</span><span>reps</span><span></span></div>
      ${ex.sets.map((s, j) => `
      <div class="set-row ${s.done ? 'done' : ''}">
        <span class="set-n">${j + 1}</span>
        <input class="input set-in" inputmode="decimal" placeholder="${ex.type === 'poids' ? 'kg' : 'PDC'}" value="${esc(s.kg)}" data-input="set-field" data-change="set-kg-change" data-ex="${i}" data-set="${j}" data-f="kg" aria-label="Kilos série ${j + 1}">
        <input class="input set-in" inputmode="numeric" pattern="[0-9]*" placeholder="${esc(s.target)}" value="${esc(s.reps)}" data-input="set-field" data-ex="${i}" data-set="${j}" data-f="reps" aria-label="Reps série ${j + 1}">
        <button class="check ${s.done ? 'on' : ''}" data-act="set-done" data-ex="${i}" data-set="${j}" aria-label="Série faite">${s.done ? '✓' : ''}</button>
      </div>`).join('')}
    </div>
    <div class="row gap">
      <button class="btn ghost small" data-act="set-add" data-ex="${i}">+ série</button>
      ${ex.sets.length > 1 ? `<button class="btn ghost small" data-act="set-remove" data-ex="${i}">− série</button>` : ''}
      <span class="grow"></span>
      <button class="btn ghost small" data-act="ex-remove" data-ex="${i}">Retirer</button>
    </div>
  </section>`;
}

function workoutEditor(w, editingPast) {
  const total = w.exercises.reduce((a, e) => a + e.sets.length, 0);
  const done = w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  return `
  <header class="page-head">
    <div><h1>${esc(w.name)}</h1><p class="muted">${editingPast ? `Modification · ${esc(fmtDateLong(w.date))}` : `${done}/${total} séries faites`}</p></div>
    ${editingPast ? `<button class="btn ghost small" data-act="w-close-edit">Fermer</button>` : `<button class="btn primary small" data-act="w-finish">Terminer</button>`}
  </header>
  ${editingPast ? `<section class="card"><label class="field"><span>Date de la séance</span><input class="input" type="date" value="${w.date}" data-change="w-date"></label></section>` : ''}
  ${w.exercises.map((ex, i) => exerciseCard(w, ex, i, editingPast)).join('')}
  <button class="btn ghost full" data-act="ex-add-session">+ Ajouter un exercice à cette séance</button>
  ${editingPast
    ? `<button class="btn danger full" data-act="w-delete">Supprimer cette séance</button>`
    : `<button class="btn primary full big" data-act="w-finish">Terminer la séance</button>
       <button class="btn ghost full" data-act="w-abandon">Abandonner (supprimer)</button>`}`;
}

// ---------- Sauvegarde automatique pendant la saisie ----------
let saveTimer = null;
const currentWorkout = () => (UI.editingWorkout ? S.workouts.find((w) => w.id === UI.editingWorkout) : activeWorkout());
function saveSoon(w) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => put('workouts', w), 300);
}
export function flushWorkout() {
  const w = currentWorkout();
  if (w) { clearTimeout(saveTimer); return put('workouts', w); }
}

on('w-start', async (el) => {
  const a = activeWorkout();
  if (a) { toast('Une séance est déjà en cours', 'warn'); rerender(); return; }
  await startWorkout(el.dataset.id);
});
on('set-field', (el) => {
  const w = currentWorkout();
  if (!w) return;
  const s = w.exercises[+el.dataset.ex].sets[+el.dataset.set];
  s[el.dataset.f] = el.value.trim();
  saveSoon(w);
});
on('set-kg-change', (el) => {
  // recopie la charge dans les séries suivantes encore vides
  const w = currentWorkout();
  if (!w) return;
  const ex = w.exercises[+el.dataset.ex];
  const j = +el.dataset.set;
  let changed = false;
  for (let k = j + 1; k < ex.sets.length; k++) if (!ex.sets[k].kg && !ex.sets[k].done) { ex.sets[k].kg = el.value.trim(); changed = true; }
  if (changed) {
    saveSoon(w);
    document.querySelectorAll(`input[data-ex="${el.dataset.ex}"][data-f="kg"]`).forEach((inp) => { inp.value = ex.sets[+inp.dataset.set].kg; });
  }
});
on('set-done', async (el) => {
  const w = currentWorkout();
  if (!w) return;
  const i = +el.dataset.ex, j = +el.dataset.set;
  const ex = w.exercises[i];
  const s = ex.sets[j];
  if (!s.done) {
    if (!s.reps) {
      if (/^\d+$/.test(s.target)) s.reps = s.target;
      else {
        toast('Indique d\'abord le nombre de reps', 'warn');
        document.querySelector(`input[data-ex="${i}"][data-set="${j}"][data-f="reps"]`)?.focus();
        return;
      }
    }
    if (ex.type === 'poids' && !s.kg && j > 0 && ex.sets[j - 1].kg) s.kg = ex.sets[j - 1].kg;
    s.done = true;
    if (!UI.editingWorkout) startTimer(ex.rest, `Repos · ${ex.name}`);
    if (ex.type === 'pullup' && ex.mode === 'test' && parseNum(s.reps) > 0) {
      await put('pullLogs', { id: 'test-' + w.date, date: w.date, type: 'test', reps: parseNum(s.reps) });
      toast(`Test enregistré : ${s.reps} tractions. Programme recalculé !`, 'ok');
    }
  } else {
    s.done = false;
  }
  clearTimeout(saveTimer);
  await put('workouts', w);
  rerender();
});
on('set-add', async (el) => {
  const w = currentWorkout();
  const ex = w.exercises[+el.dataset.ex];
  const last = ex.sets[ex.sets.length - 1];
  ex.sets.push({ target: last?.target || repsTarget(ex), reps: '', kg: last?.kg || '', done: false });
  await put('workouts', w);
  rerender();
});
on('set-remove', async (el) => {
  const w = currentWorkout();
  const ex = w.exercises[+el.dataset.ex];
  ex.sets.pop();
  await put('workouts', w);
  rerender();
});
on('ex-remove', async (el) => {
  const w = currentWorkout();
  const ex = w.exercises[+el.dataset.ex];
  if (!(await confirmBox(`Retirer « ${esc(ex.name)} » de cette séance ?`, { ok: 'Retirer', danger: true }))) return;
  w.exercises.splice(+el.dataset.ex, 1);
  await put('workouts', w);
  rerender();
});
on('ex-add-session', () => openExerciseEditor({ forSession: true }));
on('w-finish', async () => {
  const w = activeWorkout();
  if (!w) return;
  await flushWorkout();
  const notDone = w.exercises.reduce((a, e) => a + e.sets.filter((s) => !s.done).length, 0);
  const doneN = w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  if (!doneN) { toast('Aucune série cochée : coche tes séries faites', 'warn'); return; }
  if (notDone && !(await confirmBox(`${notDone} série(s) non cochée(s) ne compteront pas. Terminer quand même ?`, { ok: 'Terminer' }))) return;
  w.status = 'terminee';
  w.finishedAt = Date.now();
  const prs = newRecords(w, S.workouts);
  await put('workouts', w);
  await setKV('activeWorkout', null);
  stopTimer();
  keepAwake(false);
  toast(prs.length ? `Séance terminée 💪 Nouveau record : ${prs.join(', ')} !` : 'Séance terminée, bravo 💪', 'ok');
  rerender();
});
on('w-abandon', async () => {
  const w = activeWorkout();
  if (!w) return;
  if (!(await confirmBox('Supprimer cette séance en cours ? Tout ce qui a été saisi sera perdu.', { ok: 'Supprimer', danger: true }))) return;
  await del('workouts', w.id);
  await setKV('activeWorkout', null);
  stopTimer();
  keepAwake(false);
  rerender();
});
on('w-open', (el) => { UI.editingWorkout = el.dataset.id; rerender(); window.scrollTo(0, 0); });
on('w-close-edit', async () => { await flushWorkout(); UI.editingWorkout = null; rerender(); });
on('w-date', async (el) => {
  const w = currentWorkout();
  if (!w || !el.value) return;
  w.date = el.value;
  await put('workouts', w);
  toast('Date modifiée', 'ok');
});
on('w-delete', async () => {
  const w = currentWorkout();
  if (!w) return;
  if (!(await confirmBox(`Supprimer la séance « ${esc(w.name)} » du ${esc(fmtDateCourt(w.date))} ?`, { ok: 'Supprimer', danger: true }))) return;
  await del('workouts', w.id);
  UI.editingWorkout = null;
  toast('Séance supprimée');
  rerender();
});

// ---------- Édition du programme ----------
function programEditor() {
  const p = program();
  return `
  <header class="page-head"><h1>Programme</h1><button class="btn primary small" data-act="prog-close">OK</button></header>
  <section class="card">
    <h2>Jours d'entraînement</h2>
    ${SEMAINE.map((d) => `<label class="field inline"><span>${JOURS[d]}</span>
      <select class="input" data-change="prog-day" data-d="${d}">
        <option value="">Repos</option>
        ${p.templates.map((t) => `<option value="${t.id}" ${p.schedule[d] === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select></label>`).join('')}
    <p class="hint">Les séances lourdes de tractions tombent les jours dont la séance contient « Tractions (programme) ». Le GTG se place automatiquement les autres jours, jamais la veille d'une séance lourde.</p>
  </section>
  ${p.templates.map((t) => `
  <section class="card">
    <div class="card-head"><h2>${esc(t.name)}</h2>
      <div class="row gap"><button class="btn ghost small" data-act="tpl-rename" data-t="${t.id}">Renommer</button><button class="btn ghost small" data-act="tpl-delete" data-t="${t.id}">Supprimer</button></div></div>
    <ul class="tpl-list">${t.exercises.map((e, i) => `<li>
      <button class="list-btn" data-act="tpl-ex-edit" data-t="${t.id}" data-i="${i}"><span><b>${esc(e.name)}</b><small>${e.type === 'pullup' ? 'programme tractions' : `${e.sets} × ${repsTarget(e)}`} · repos ${fmt(restOf(e) / 60, 1)} min${e.small ? ' · petit muscle' : ''}</small></span></button>
      <div class="mini-actions">
        <button class="icon-btn" data-act="tpl-ex-move" data-t="${t.id}" data-i="${i}" data-d="-1" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-act="tpl-ex-move" data-t="${t.id}" data-i="${i}" data-d="1" aria-label="Descendre" ${i === t.exercises.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon-btn" data-act="tpl-ex-del" data-t="${t.id}" data-i="${i}" aria-label="Supprimer">✕</button>
      </div></li>`).join('')}</ul>
    <button class="btn ghost full" data-act="tpl-ex-add" data-t="${t.id}">+ Ajouter un exercice</button>
  </section>`).join('')}
  <button class="btn ghost full" data-act="tpl-new">+ Nouvelle séance type</button>
  <button class="btn danger full" data-act="prog-reset">Remettre le programme d'origine</button>`;
}

const saveProgram = () => setKV('program', S.kv.program);

on('prog-open', () => { mode = 'programme'; rerender(); window.scrollTo(0, 0); });
on('prog-close', () => { mode = 'jour'; rerender(); window.scrollTo(0, 0); });
on('prog-day', async (el) => { program().schedule[el.dataset.d] = el.value || null; await saveProgram(); toast('Jours mis à jour', 'ok'); });
on('tpl-ex-move', async (el) => {
  const t = templateById(el.dataset.t), i = +el.dataset.i, d = +el.dataset.d;
  const [x] = t.exercises.splice(i, 1);
  t.exercises.splice(i + d, 0, x);
  await saveProgram(); rerender();
});
on('tpl-ex-del', async (el) => {
  const t = templateById(el.dataset.t), i = +el.dataset.i;
  if (!(await confirmBox(`Retirer « ${esc(t.exercises[i].name)} » de la séance ${esc(t.name)} ?`, { ok: 'Retirer', danger: true }))) return;
  t.exercises.splice(i, 1);
  await saveProgram(); rerender();
});
on('tpl-ex-add', (el) => openExerciseEditor({ templateId: el.dataset.t }));
on('tpl-ex-edit', (el) => openExerciseEditor({ templateId: el.dataset.t, index: +el.dataset.i }));
on('tpl-rename', (el) => {
  const t = templateById(el.dataset.t);
  openSheet('Renommer la séance', `<label class="field"><span>Nom</span><input class="input" id="tpl-name" value="${esc(t.name)}" data-enter="tpl-rename-ok"></label>
    <button class="btn primary full big" data-act="tpl-rename-ok" data-t="${t.id}">Enregistrer</button>`);
});
on('tpl-rename-ok', async () => {
  const id = document.querySelector('[data-act="tpl-rename-ok"]').dataset.t;
  const t = templateById(id);
  t.name = document.getElementById('tpl-name').value.trim() || t.name;
  await saveProgram(); closeSheet(); rerender();
});
on('tpl-delete', async (el) => {
  const t = templateById(el.dataset.t);
  if (!(await confirmBox(`Supprimer la séance type « ${esc(t.name)} » ? Les jours qui l'utilisaient passeront en repos. L'historique est conservé.`, { ok: 'Supprimer', danger: true }))) return;
  const p = program();
  p.templates = p.templates.filter((x) => x.id !== t.id);
  for (const d of Object.keys(p.schedule)) if (p.schedule[d] === t.id) p.schedule[d] = null;
  await saveProgram(); rerender();
});
on('tpl-new', async () => {
  const p = program();
  const t = { id: 't' + uid(), name: 'Nouvelle séance', exercises: [] };
  p.templates.push(t);
  await saveProgram(); rerender();
  toast('Séance créée : ajoute des exercices et choisis son jour', 'ok');
});
on('prog-reset', async () => {
  if (!(await confirmBox('Remettre le programme PPL + Haut/Bas d\'origine ? Tes modifications du programme seront perdues (pas ton historique).', { ok: 'Remettre', danger: true }))) return;
  await setKV('program', seedProgram());
  rerender();
});

// ---------- Fenêtre d'édition d'un exercice ----------
let exEdit = null;
function openExerciseEditor({ templateId = null, index = null, forSession = false }) {
  const t = templateId ? templateById(templateId) : null;
  const e = t && index !== null ? t.exercises[index] : { name: '', type: 'poids', sets: 3, repMin: 8, repMax: 12, big: false, small: false, note: '', rest: null };
  exEdit = { templateId, index, forSession };
  openSheet(index !== null ? 'Modifier l\'exercice' : 'Nouvel exercice', `
    <form id="ex-form" class="form" onsubmit="return false">
      <label class="field"><span>Nom</span><input class="input" name="name" value="${esc(e.name)}" placeholder="ex. Pompes" list="ex-names"></label>
      <datalist id="ex-names">${[...new Set(program().templates.flatMap((x) => x.exercises.map((y) => y.name)))].map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <label class="field"><span>Type</span><select class="input" name="type">
        <option value="poids" ${e.type === 'poids' ? 'selected' : ''}>Charge + reps (double progression)</option>
        <option value="max" ${e.type === 'max' ? 'selected' : ''}>Max de reps (poids du corps)</option>
        <option value="pullup" ${e.type === 'pullup' ? 'selected' : ''}>Tractions (programme 7 semaines)</option>
      </select></label>
      <div class="grid3">
        <label class="field"><span>Séries</span><input class="input" name="sets" inputmode="numeric" value="${e.sets}"></label>
        <label class="field"><span>Reps min</span><input class="input" name="repMin" inputmode="numeric" value="${e.repMin ?? ''}"></label>
        <label class="field"><span>Reps max</span><input class="input" name="repMax" inputmode="numeric" value="${e.repMax ?? ''}"></label>
      </div>
      <label class="field"><span>Repos (secondes) — vide = automatique</span><input class="input" name="rest" inputmode="numeric" value="${e.rest ?? ''}" placeholder="${e.big ? S.settings.restBig : S.settings.restSmall}"></label>
      <label class="switch"><input type="checkbox" name="big" ${e.big ? 'checked' : ''}><span>Gros mouvement (repos ${fmt(S.settings.restBig / 60, 1)} min)</span></label>
      <label class="switch"><input type="checkbox" name="small" ${e.small ? 'checked' : ''}><span>Petit muscle (+1 kg au lieu de +2,5 kg)</span></label>
      <label class="field"><span>Note (facultatif)</span><input class="input" name="note" value="${esc(e.note || '')}"></label>
      <button class="btn primary full big" data-act="ex-save">Enregistrer</button>
    </form>`);
}
on('ex-save', async () => {
  const f = document.getElementById('ex-form');
  const d = Object.fromEntries(new FormData(f).entries());
  const name = (d.name || '').trim();
  if (!name) { toast('Donne un nom à l\'exercice', 'warn'); return; }
  const repMin = parseNum(d.repMin), repMax = parseNum(d.repMax);
  const e = {
    name, type: d.type, sets: Math.max(1, Math.min(10, parseNum(d.sets) || 3)),
    repMin: d.type === 'poids' ? (repMin || repMax || 10) : null,
    repMax: d.type === 'poids' ? Math.max(repMax || repMin || 10, repMin || 0) : null,
    big: f.big.checked, small: f.small.checked, note: (d.note || '').trim(), rest: parseNum(d.rest) || null,
  };
  if (exEdit.forSession) {
    const w = currentWorkout();
    w.exercises.push(buildExercise({ ...e, id: uid() }, pullPlan(w.date)));
    await put('workouts', w);
  } else {
    const t = templateById(exEdit.templateId);
    if (exEdit.index !== null) t.exercises[exEdit.index] = { ...t.exercises[exEdit.index], ...e };
    else t.exercises.push({ id: uid(), ...e });
    await saveProgram();
  }
  closeSheet();
  rerender();
});
