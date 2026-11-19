// =============================================================
// Écran de BIENVENUE : affiché au premier lancement pour remplir le profil.
// Rien n'est préenregistré dans le code : tout reste sur le téléphone.
// =============================================================
import { S, saveSettings, putMany } from '../db.js';
import { HALAL_EXCLUS } from '../data.js';
import { today, addDays, dow, fmt, esc, parseNum, isValidDateStr } from '../util.js';
import { ACTIVITY, nutritionTargets, applyHalal, mergeWords } from '../calc.js';
import { on, toast, rerender } from '../ui.js';

const nextMonday = () => { const t = today(); const d = dow(t); return d === 1 ? t : addDays(t, (8 - d) % 7); };

let form = null;
function initForm() {
  const s = S.settings;
  form = {
    sexe: s.sexe || '', age: s.age ?? '', taille: s.taille ?? '', poids: s.poids ?? '', activite: s.activite || 'modere',
    planStart: s.planStart || nextMonday(), pullMax: s.pullInitialMax ?? '', pullGoal: s.pullGoal ?? '',
    halal: !!s.halal, exclus: (s.motsExclus || []).filter((w) => !HALAL_EXCLUS.includes(w)).join(', '),
  };
}

function preview() {
  const age = parseNum(form.age), taille = parseNum(form.taille), poids = parseNum(form.poids);
  if (!form.sexe || !age || !taille || !poids) return '<p class="hint">Remplis sexe, âge, taille et poids pour voir tes objectifs.</p>';
  const t = nutritionTargets({ ...S.settings, sexe: form.sexe, age, taille, poids, activite: form.activite }, poids);
  return `<div class="calc-box">
    <div><span>Objectif de départ</span><b>${fmt(t.kcal)} kcal / jour</b></div>
    <div><span>Protéines · Lipides · Glucides</span><b>${t.p} · ${t.f} · ${t.c} g</b></div>
  </div>`;
}

export function render() {
  if (!form) initForm();
  const f = form;
  return `
  <header class="page-head"><div><p class="eyebrow">Premier lancement</p><h1>Bienvenue 👋</h1></div></header>
  <section class="card">
    <p>Remplis ton profil (1 minute). Il sert à calculer tes calories, ton plan de poids et ton programme de tractions.</p>
    <p class="hint">🔒 Tout reste sur ton téléphone : aucun compte, aucun envoi. Tu pourras tout modifier dans Réglages.</p>
  </section>
  <section class="card">
    <h2>Toi</h2>
    <div class="field"><span>Sexe</span><div class="seg small">
      <button class="${f.sexe === 'homme' ? 'on' : ''}" data-act="ob-sexe" data-v="homme">Homme</button>
      <button class="${f.sexe === 'femme' ? 'on' : ''}" data-act="ob-sexe" data-v="femme">Femme</button></div></div>
    <div class="grid3">
      <label class="field"><span>Âge</span><input class="input" inputmode="numeric" value="${esc(f.age)}" data-input="ob-field" data-k="age" placeholder="ans"></label>
      <label class="field"><span>Taille (cm)</span><input class="input" inputmode="numeric" value="${esc(f.taille)}" data-input="ob-field" data-k="taille" placeholder="cm"></label>
      <label class="field"><span>Poids (kg)</span><input class="input" inputmode="decimal" value="${esc(String(f.poids).replace('.', ','))}" data-input="ob-field" data-k="poids" placeholder="kg"></label>
    </div>
    <label class="field"><span>Niveau d'activité</span><select class="input" data-change="ob-field" data-k="activite">
      ${Object.entries(ACTIVITY).map(([k, v]) => `<option value="${k}" ${f.activite === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
    <div id="ob-preview">${preview()}</div>
  </section>
  <section class="card">
    <h2>Ton plan</h2>
    <label class="field"><span>Date de début (plan de poids et programme tractions)</span><input class="input" type="date" value="${f.planStart}" data-change="ob-field" data-k="planStart"></label>
    <div class="grid2">
      <label class="field"><span>Max de tractions actuel</span><input class="input" inputmode="numeric" value="${esc(f.pullMax)}" data-input="ob-field" data-k="pullMax" placeholder="reps"></label>
      <label class="field"><span>Objectif tractions</span><input class="input" inputmode="numeric" value="${esc(f.pullGoal)}" data-input="ob-field" data-k="pullGoal" placeholder="le double"></label>
    </div>
    <p class="hint">Max = le plus de tractions propres d'affilée que tu sais faire aujourd'hui.</p>
  </section>
  <section class="card">
    <h2>Alimentation</h2>
    <label class="switch"><input type="checkbox" ${f.halal ? 'checked' : ''} data-change="ob-halal"><span>Je mange halal (viandes de la base marquées « halal », porc, alcool et gélatine exclus des suggestions)</span></label>
    <label class="field"><span>Aliments à ne jamais me suggérer (séparés par des virgules)</span><input class="input" value="${esc(f.exclus)}" data-input="ob-field" data-k="exclus" placeholder="ex. olives, champignons"></label>
  </section>
  <button class="btn primary full big" data-act="ob-save">C'est parti</button>
  <button class="btn ghost full" data-act="ob-restore">J'ai déjà une sauvegarde : la restaurer</button>
  <input type="file" id="ob-file" accept=".json,application/json" hidden data-change="backup-file">`;
}

const refreshPreview = () => { const el = document.getElementById('ob-preview'); if (el) el.innerHTML = preview(); };
on('ob-field', (el) => { form[el.dataset.k] = el.value; refreshPreview(); });
on('ob-sexe', (el) => { form.sexe = el.dataset.v; rerender(); });
on('ob-halal', (el) => { form.halal = el.checked; });
on('ob-restore', () => document.getElementById('ob-file').click());

on('ob-save', async () => {
  const age = parseNum(form.age), taille = parseNum(form.taille), poids = parseNum(form.poids), max = parseNum(form.pullMax);
  const errors = [];
  if (!form.sexe) errors.push('ton sexe');
  if (!age || age < 12 || age > 100) errors.push('ton âge');
  if (!taille || taille < 120 || taille > 230) errors.push('ta taille en cm');
  if (!poids || poids < 30 || poids > 300) errors.push('ton poids en kg');
  if (max === null || max < 0 || max > 100) errors.push('ton max de tractions (0 si aucune)');
  if (!isValidDateStr(form.planStart)) errors.push('la date de début');
  if (errors.length) { toast(`Indique ${errors.join(', ')}`, 'warn'); return; }
  const goal = parseNum(form.pullGoal) || Math.max(5, Math.round(max * 2));
  const perso = form.exclus.split(',').map((w) => w.trim()).filter(Boolean);
  Object.assign(S.settings, {
    sexe: form.sexe, age, taille, poids: Math.round(poids * 10) / 10, activite: form.activite,
    planStart: form.planStart, pullStart: form.planStart, pullInitialMax: Math.round(max), pullGoal: Math.round(goal),
    halal: form.halal, motsExclus: mergeWords(perso, HALAL_EXCLUS, form.halal), profilOk: true,
  });
  await saveSettings();
  await putMany('foods', applyHalal(S.foods, form.halal));
  form = null;
  toast('Profil enregistré, bon courage 💪', 'ok');
  location.hash = '#accueil';
  rerender();
});
