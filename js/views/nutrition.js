// =============================================================
// Onglet NUTRITION : journal du jour, aliments, repas enregistrés, idées de repas.
// =============================================================
import { S, put, del, putMany } from '../db.js';
import { MEALS, MEAL_IDEAS } from '../data.js';
import { today, addDays, fmt, fmtDateLong, esc, uid, norm, parseNum } from '../util.js';
import { macros, totals, mealIdeas, proteinBoosters } from '../calc.js';
import { on, openSheet, closeSheet, toast, confirmBox, bar, empty, rerender } from '../ui.js';
import { UI, targetsFor, entriesFor, dayTotals } from '../logic.js';

const mealLabel = (id) => MEALS.find((m) => m.id === id)?.label || id;

export function defaultMeal() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return 'petitdej';
  if (h < 15) return 'dejeuner';
  if (h < 18) return 'collation';
  return 'diner';
}

/** Bloc "calories / protéines restantes" (réutilisé sur l'accueil). */
export function summaryBlock(date, { compact = false } = {}) {
  const t = targetsFor(date), tot = dayTotals(date);
  const kRest = Math.round(t.kcal - tot.kcal), pRest = Math.round(t.p - tot.p);
  return `
    <div class="macro-line">
      <div class="macro-head"><span class="lbl">Calories</span><span><b>${fmt(tot.kcal)}</b> / ${fmt(t.kcal)} kcal</span></div>
      ${bar(tot.kcal, t.kcal, 'kcal')}
      <div class="macro-sub ${kRest < 0 ? 'warn' : ''}">${kRest >= 0 ? `Reste <b>${fmt(kRest)} kcal</b>` : `Dépassé de ${fmt(-kRest)} kcal`}</div>
    </div>
    <div class="macro-line">
      <div class="macro-head"><span class="lbl">Protéines</span><span><b>${fmt(tot.p)}</b> / ${fmt(t.p)} g</span></div>
      ${bar(tot.p, t.p, 'prot')}
      <div class="macro-sub">${pRest > 0 ? `Reste <b>${fmt(pRest)} g</b>` : 'Objectif atteint ✓'}</div>
    </div>
    ${compact ? '' : `
    <div class="row gap mini-macros">
      <div class="grow"><div class="macro-head"><span class="lbl">Glucides</span><span>${fmt(tot.c)} / ${fmt(t.c)} g</span></div>${bar(tot.c, t.c, 'carb')}</div>
      <div class="grow"><div class="macro-head"><span class="lbl">Lipides</span><span>${fmt(tot.f)} / ${fmt(t.f)} g</span></div>${bar(tot.f, t.f, 'fat')}</div>
    </div>
    ${t.bonus ? `<p class="hint">Dont +${t.bonus} kcal grâce à tes calories actives (Réglages).</p>` : ''}`}`;
}

/** Alerte douce du soir si les protéines manquent. */
export function proteinAlert(date) {
  if (date !== today() || new Date().getHours() < S.settings.alerteProtHeure) return '';
  const t = targetsFor(date), tot = dayTotals(date);
  const miss = Math.round(t.p - tot.p);
  if (miss < 10) return '';
  const boost = proteinBoosters(S.foods, S.settings.motsExclus, 2)
    .map((f) => { const g = Math.min(400, Math.ceil(((miss / f.p) * 100) / 25) * 25); return `${esc(f.name)} ${g} g`; });
  return `<div class="alert soft">🥛 Il te manque <b>${miss} g de protéines</b> aujourd'hui.${boost.length ? ` Idée : ${boost.join(' ou ')}.` : ''}
    <button class="link" data-act="nut-ideas">Voir des idées</button></div>`;
}

export function render() {
  const date = UI.nutDate;
  const isToday = date === today();
  const entries = entriesFor(date);
  return `
  <header class="page-head"><h1>Nutrition</h1></header>
  <div class="date-nav">
    <button class="icon-btn" data-act="nut-day" data-d="-1" aria-label="Jour précédent">‹</button>
    <button class="date-label" data-act="nut-today">${isToday ? 'Aujourd\'hui' : esc(fmtDateLong(date))}</button>
    <button class="icon-btn" data-act="nut-day" data-d="1" aria-label="Jour suivant">›</button>
  </div>
  <section class="card">${summaryBlock(date)}</section>
  ${proteinAlert(date)}
  <div class="quick-grid">
    <button class="btn ghost" data-act="nut-copy">📋 Copier hier</button>
    <button class="btn ghost" data-act="nut-saved">⭐ Repas enregistrés</button>
    <button class="btn ghost" data-act="nut-ideas">💡 Idées de repas</button>
    <button class="btn ghost" data-act="nut-foods">🥫 Mes aliments</button>
  </div>
  ${MEALS.map((m) => mealCard(m, entries.filter((e) => e.meal === m.id))).join('')}`;
}

function mealCard(m, list) {
  const t = totals(list);
  return `
  <section class="card meal">
    <div class="card-head">
      <h2>${m.label}</h2>
      <span class="muted">${list.length ? `${fmt(t.kcal)} kcal · ${fmt(t.p)} g P` : ''}</span>
    </div>
    ${list.length ? `<ul class="entries">${list.map((e) => {
      const mm = macros(e.per100, e.grams);
      return `<li><button class="entry" data-act="nut-edit-entry" data-id="${e.id}">
        <span class="e-name">${esc(e.name)}<small>${e.unit === 'u' ? `${fmt(e.qty, 2)} ${esc(e.unitName || 'unité')}${e.qty > 1 ? 's' : ''} (${fmt(e.grams)} g)` : `${fmt(e.grams)} g`}</small></span>
        <span class="e-val">${fmt(mm.kcal)} kcal<small>${fmt(mm.p)} g P</small></span>
      </button></li>`;
    }).join('')}</ul>` : ''}
    <div class="row gap">
      <button class="btn primary grow" data-act="nut-add" data-meal="${m.id}">+ Ajouter</button>
      ${list.length ? `<button class="btn ghost" data-act="nut-save-meal" data-meal="${m.id}" title="Enregistrer ce repas">⭐ Enregistrer</button>` : ''}
    </div>
  </section>`;
}

// ---------- Navigation par jour ----------
on('nut-day', (el) => { UI.nutDate = addDays(UI.nutDate, Number(el.dataset.d)); rerender(); });
on('nut-today', () => { UI.nutDate = today(); rerender(); });

// ---------- Choix d'un aliment ----------
let picker = { meal: null, mode: 'add', q: '' };

function foodRow(f) {
  return `<li class="food-row">
    <button class="food-main" data-act="${picker.mode === 'manage' ? 'food-edit' : 'food-pick'}" data-id="${f.id}">
      <span>${esc(f.name)}${f.avoid ? ' <span class="tag bad">à éviter</span>' : ''}${f.halal ? ' <span class="tag ok">halal</span>' : ''}</span>
      <small>${fmt(f.kcal)} kcal · P ${fmt(f.p, 1)} · G ${fmt(f.c, 1)} · L ${fmt(f.f, 1)} <em>/100 g</em></small>
    </button>
    <button class="star ${f.fav ? 'on' : ''}" data-act="food-fav" data-id="${f.id}" aria-label="Favori">${f.fav ? '★' : '☆'}</button>
  </li>`;
}

function foodListHtml() {
  const q = norm(picker.q);
  const list = S.foods.filter((f) => !q || norm(f.name).includes(q));
  const favs = list.filter((f) => f.fav).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const rest = list.filter((f) => !f.fav).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (!list.length) return empty(`Aucun aliment trouvé. <button class="link" data-act="food-new">Créer « ${esc(picker.q)} »</button>`);
  return `${favs.length ? `<h3 class="list-title">Favoris</h3><ul class="food-list">${favs.map(foodRow).join('')}</ul>` : ''}
    ${rest.length ? `<h3 class="list-title">${favs.length ? 'Tous les aliments' : 'Aliments'}</h3><ul class="food-list">${rest.map(foodRow).join('')}</ul>` : ''}`;
}

export function openFoodPicker(meal, mode = 'add') {
  picker = { meal, mode, q: '' };
  const body = openSheet(mode === 'manage' ? 'Mes aliments' : `Ajouter · ${mealLabel(meal)}`, `
    <input class="input search" type="search" placeholder="Rechercher un aliment…" data-input="food-search" autocomplete="off" autocapitalize="off" spellcheck="false">
    <button class="btn ghost full" data-act="food-new">+ Créer un nouvel aliment</button>
    <div id="food-list">${foodListHtml()}</div>`);
  body.querySelector('input')?.focus({ preventScroll: true });
}
const refreshList = () => { const el = document.getElementById('food-list'); if (el) el.innerHTML = foodListHtml(); };

on('nut-add', (el) => openFoodPicker(el.dataset.meal));
on('nut-foods', () => openFoodPicker(null, 'manage'));
on('food-search', (el) => { picker.q = el.value; refreshList(); });
on('food-fav', async (el) => {
  const f = S.foods.find((x) => x.id === el.dataset.id);
  if (!f) return;
  await put('foods', { ...f, fav: !f.fav });
  refreshList();
});
on('food-pick', (el) => openQty({ foodId: el.dataset.id, meal: picker.meal }));

// ---------- Quantité ----------
let qtyState = null;

function qtyPreview() {
  const s = qtyState;
  const grams = s.unit === 'u' ? (parseNum(s.qty) || 0) * s.unitWeight : parseNum(s.qty) || 0;
  const m = macros(s.per100, grams);
  return `<div class="preview">
    <div><b>${fmt(m.kcal)}</b><small>kcal</small></div>
    <div><b>${fmt(m.p, 1)}</b><small>prot. (g)</small></div>
    <div><b>${fmt(m.c, 1)}</b><small>gluc. (g)</small></div>
    <div><b>${fmt(m.f, 1)}</b><small>lip. (g)</small></div>
  </div>${s.unit === 'u' ? `<p class="hint center">= ${fmt(grams)} g</p>` : ''}`;
}

function openQty({ foodId, meal, entryId }) {
  let base;
  if (entryId) {
    const e = S.journal.find((x) => x.id === entryId);
    if (!e) return;
    base = { entryId, foodId: e.foodId, name: e.name, per100: e.per100, unitWeight: e.unitWeight || 0, unitName: e.unitName || '', unit: e.unit, qty: e.qty, meal: e.meal };
  } else {
    const f = S.foods.find((x) => x.id === foodId);
    if (!f) return;
    const unit = f.unitWeight && f.defaultUnit ? 'u' : 'g';
    base = { foodId, name: f.name, per100: { kcal: f.kcal, p: f.p, c: f.c, f: f.f }, unitWeight: f.unitWeight || 0, unitName: f.unitName || '', unit, qty: unit === 'u' ? 1 : 100, meal: meal || defaultMeal() };
  }
  qtyState = base;
  renderQty();
}

function renderQty() {
  const s = qtyState;
  const quick = s.unit === 'u' ? [0.5, 1, 2, 3, 4] : [30, 50, 100, 150, 200, 250];
  const body = openSheet(s.entryId ? 'Modifier' : s.name, `
    ${s.entryId ? `<p class="strong">${esc(s.name)}</p>` : ''}
    ${s.unitWeight ? `<div class="seg small">
      <button class="${s.unit === 'g' ? 'on' : ''}" data-act="qty-unit" data-u="g">Grammes</button>
      <button class="${s.unit === 'u' ? 'on' : ''}" data-act="qty-unit" data-u="u">${esc(s.unitName || 'Unités')} (${fmt(s.unitWeight)} g)</button>
    </div>` : ''}
    <label class="field big-field">
      <span>Quantité (${s.unit === 'u' ? esc(s.unitName || 'unités') : 'g'})</span>
      <input class="input xl" inputmode="decimal" value="${esc(String(s.qty).replace('.', ','))}" data-input="qty-input" data-enter="qty-save" autocomplete="off">
    </label>
    <div class="chips">${quick.map((q) => `<button class="chip" data-act="qty-quick" data-q="${q}">${fmt(q, 1)}${s.unit === 'u' ? '' : ' g'}</button>`).join('')}</div>
    <div id="qty-preview">${qtyPreview()}</div>
    <div class="field"><span>Repas</span><div class="chips">${MEALS.map((m) => `<button class="chip ${m.id === s.meal ? 'on' : ''}" data-act="qty-meal" data-m="${m.id}">${m.label}</button>`).join('')}</div></div>
    <button class="btn primary full big" data-act="qty-save">${s.entryId ? 'Enregistrer' : 'Ajouter'}</button>
    <div class="row gap">
      ${s.entryId ? `<button class="btn danger grow" data-act="qty-delete">Supprimer</button>` : `<button class="btn ghost grow" data-act="qty-back">← Retour à la liste</button>`}
    </div>`);
  const inp = body.querySelector('input');
  if (inp) { inp.focus({ preventScroll: true }); inp.select(); }
}

on('qty-input', (el) => { qtyState.qty = el.value; document.getElementById('qty-preview').innerHTML = qtyPreview(); });
on('qty-quick', (el) => { qtyState.qty = Number(el.dataset.q); renderQty(); });
on('qty-unit', (el) => {
  const s = qtyState;
  const u = el.dataset.u;
  if (u === s.unit) return;
  const q = parseNum(s.qty) || 0;
  s.qty = u === 'u' ? Math.max(0.5, Math.round((q / s.unitWeight) * 2) / 2) : Math.round(q * s.unitWeight);
  s.unit = u;
  renderQty();
});
on('qty-meal', (el) => { qtyState.meal = el.dataset.m; renderQty(); });
on('qty-back', () => openFoodPicker(qtyState.meal));
on('qty-save', async () => {
  const s = qtyState;
  const qty = parseNum(s.qty);
  if (!qty || qty <= 0) { toast('Indique une quantité', 'warn'); return; }
  const grams = s.unit === 'u' ? qty * s.unitWeight : qty;
  const old = s.entryId ? S.journal.find((x) => x.id === s.entryId) : null;
  const entry = {
    id: s.entryId || uid(), date: old ? old.date : UI.nutDate, meal: s.meal, foodId: s.foodId, name: s.name,
    per100: s.per100, unit: s.unit, qty, grams, unitWeight: s.unitWeight, unitName: s.unitName, createdAt: old?.createdAt || Date.now(),
  };
  await put('journal', entry);
  closeSheet();
  toast(s.entryId ? 'Modifié' : `${s.name} ajouté`, 'ok');
  rerender();
});
on('qty-delete', async () => {
  await del('journal', qtyState.entryId);
  closeSheet();
  toast('Supprimé');
  rerender();
});
on('nut-edit-entry', (el) => openQty({ entryId: el.dataset.id }));

// ---------- Créer / modifier un aliment ----------
function openFoodEditor(id, presetName = '') {
  const f = id ? S.foods.find((x) => x.id === id) : { name: presetName, kcal: '', p: '', c: '', f: '', unitName: '', unitWeight: '', halal: false, avoid: false, fav: false };
  if (!f) return;
  const v = (x) => (x === '' || x === undefined || x === null ? '' : String(x).replace('.', ','));
  openSheet(id ? 'Modifier l\'aliment' : 'Nouvel aliment', `
    <form id="food-form" class="form" onsubmit="return false">
      <label class="field"><span>Nom</span><input class="input" name="name" value="${esc(f.name)}" required></label>
      <p class="hint">Valeurs pour 100 g (regarde l'étiquette).</p>
      <div class="grid2">
        <label class="field"><span>Calories (kcal)</span><input class="input" name="kcal" inputmode="decimal" value="${v(f.kcal)}"></label>
        <label class="field"><span>Protéines (g)</span><input class="input" name="p" inputmode="decimal" value="${v(f.p)}"></label>
        <label class="field"><span>Glucides (g)</span><input class="input" name="c" inputmode="decimal" value="${v(f.c)}"></label>
        <label class="field"><span>Lipides (g)</span><input class="input" name="f" inputmode="decimal" value="${v(f.f)}"></label>
      </div>
      <p class="hint">Facultatif : saisir en unités (ex. « tranche » de 35 g).</p>
      <div class="grid2">
        <label class="field"><span>Nom de l'unité</span><input class="input" name="unitName" value="${esc(f.unitName || '')}" placeholder="tranche, pot…"></label>
        <label class="field"><span>Poids d'une unité (g)</span><input class="input" name="unitWeight" inputmode="decimal" value="${v(f.unitWeight)}"></label>
      </div>
      ${S.settings.halal ? `<label class="switch"><input type="checkbox" name="halal" ${f.halal ? 'checked' : ''}><span>Halal</span></label>` : ''}
      <label class="switch"><input type="checkbox" name="avoid" ${f.avoid ? 'checked' : ''}><span>À éviter (jamais dans les suggestions)</span></label>
      <label class="switch"><input type="checkbox" name="fav" ${f.fav ? 'checked' : ''}><span>Favori</span></label>
      <button class="btn primary full big" data-act="food-save" data-id="${id || ''}">Enregistrer</button>
      ${id ? `<button class="btn danger full" data-act="food-delete" data-id="${id}">Supprimer cet aliment</button>` : ''}
    </form>`);
}
on('food-new', () => openFoodEditor(null, picker.q));
on('food-edit', (el) => openFoodEditor(el.dataset.id));
on('food-save', async (el) => {
  const form = document.getElementById('food-form');
  const d = Object.fromEntries(new FormData(form).entries());
  const name = (d.name || '').trim();
  const kcal = parseNum(d.kcal);
  if (!name) { toast('Donne un nom à l\'aliment', 'warn'); return; }
  if (kcal === null || kcal < 0) { toast('Indique les calories pour 100 g', 'warn'); return; }
  const id = el.dataset.id;
  const old = id ? S.foods.find((x) => x.id === id) : null;
  const unitWeight = parseNum(d.unitWeight) || 0;
  const food = {
    ...(old || {}), id: id || 'u_' + uid(), name, kcal, p: parseNum(d.p) || 0, c: parseNum(d.c) || 0, f: parseNum(d.f) || 0,
    unitName: unitWeight ? (d.unitName || 'unité').trim() : '', unitWeight, halal: form.halal ? form.halal.checked : !!old?.halal, avoid: form.avoid.checked, fav: form.fav.checked,
    custom: old ? old.custom : true,
  };
  if (!unitWeight) delete food.defaultUnit;
  await put('foods', food);
  toast('Aliment enregistré', 'ok');
  if (picker.mode === 'manage' || !picker.meal) openFoodPicker(null, 'manage');
  else openQty({ foodId: food.id, meal: picker.meal });
});
on('food-delete', async (el) => {
  const f = S.foods.find((x) => x.id === el.dataset.id);
  if (!f) return;
  if (!(await confirmBox(`Supprimer « ${esc(f.name)} » ? Ton historique déjà saisi reste intact.`, { ok: 'Supprimer', danger: true }))) return;
  await del('foods', f.id);
  toast('Aliment supprimé');
  openFoodPicker(null, 'manage');
});

// ---------- Copier le jour d'hier ----------
on('nut-copy', async () => {
  const date = UI.nutDate;
  const src = entriesFor(addDays(date, -1));
  if (!src.length) { toast('Rien à copier : la veille est vide', 'warn'); return; }
  const existing = entriesFor(date).length;
  if (existing && !(await confirmBox(`Ajouter les ${src.length} aliments de la veille en plus des ${existing} déjà saisis ?`, { ok: 'Copier' }))) return;
  const now = Date.now();
  await putMany('journal', src.map((e, i) => ({ ...e, id: uid() + i, date, createdAt: now + i })));
  toast(`${src.length} aliments copiés`, 'ok');
  rerender();
});

// ---------- Repas enregistrés ----------
let savedTarget = 'petitdej';

function itemsFromEntries(list) {
  return list.map((e) => ({ foodId: e.foodId, name: e.name, per100: e.per100, unit: e.unit, qty: e.qty, grams: e.grams, unitWeight: e.unitWeight, unitName: e.unitName }));
}

on('nut-save-meal', (el) => {
  const meal = el.dataset.meal;
  const list = entriesFor(UI.nutDate).filter((e) => e.meal === meal);
  openSheet('Enregistrer ce repas', `
    <p class="hint">Tu pourras l'ajouter en un clic plus tard (${list.length} aliments).</p>
    <label class="field"><span>Nom du repas</span><input class="input" id="meal-name" value="Mon ${esc(mealLabel(meal).toLowerCase())} habituel" data-enter="meal-create"></label>
    <button class="btn primary full big" data-act="meal-create" data-meal="${meal}">Enregistrer</button>`);
});
on('meal-create', async () => {
  const name = document.getElementById('meal-name').value.trim() || 'Mon repas';
  const meal = document.querySelector('[data-act="meal-create"]')?.dataset.meal;
  const list = entriesFor(UI.nutDate).filter((e) => e.meal === meal);
  await put('meals', { id: uid(), name, items: itemsFromEntries(list), createdAt: Date.now() });
  closeSheet();
  toast('Repas enregistré ⭐', 'ok');
});

function mealChooser(act) {
  return `<div class="field"><span>Ajouter dans</span><div class="chips">${MEALS.map((m) => `<button class="chip ${m.id === savedTarget ? 'on' : ''}" data-act="${act}" data-m="${m.id}">${m.label}</button>`).join('')}</div></div>`;
}

function renderSaved() {
  const list = [...S.meals].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  openSheet('Repas enregistrés', `
    ${mealChooser('saved-target')}
    ${list.length ? `<ul class="card-list">${list.map((m) => {
      const t = totals(m.items);
      return `<li class="saved-meal">
        <div class="grow"><b>${esc(m.name)}</b><small>${fmt(t.kcal)} kcal · ${fmt(t.p)} g P · ${m.items.length} aliments</small>
          <small class="muted">${m.items.map((i) => esc(i.name)).join(', ')}</small></div>
        <div class="col">
          <button class="btn primary small" data-act="saved-add" data-id="${m.id}">Ajouter</button>
          <button class="btn ghost small" data-act="saved-edit" data-id="${m.id}">Modifier</button>
        </div></li>`;
    }).join('')}</ul>` : empty('Aucun repas enregistré. Dans le journal, ajoute tes aliments puis touche « ⭐ Enregistrer » sous un repas.')}`);
}
on('nut-saved', () => { savedTarget = defaultMeal(); renderSaved(); });
on('saved-target', (el) => { savedTarget = el.dataset.m; renderSaved(); });

async function addItems(items, meal) {
  const now = Date.now();
  await putMany('journal', items.map((it, i) => ({
    id: uid() + i, date: UI.nutDate, meal, foodId: it.foodId, name: it.name, per100: it.per100,
    unit: it.unit || (it.units ? 'u' : 'g'), qty: it.qty ?? (it.units || it.grams), grams: it.grams, unitWeight: it.unitWeight || 0, unitName: it.unitName || '', createdAt: now + i,
  })));
}

on('saved-add', async (el) => {
  const m = S.meals.find((x) => x.id === el.dataset.id);
  if (!m) return;
  await addItems(m.items, savedTarget);
  closeSheet();
  toast(`« ${m.name} » ajouté au ${mealLabel(savedTarget).toLowerCase()}`, 'ok');
  rerender();
});

let editingMeal = null;
function renderMealEditor() {
  const m = editingMeal;
  openSheet('Modifier le repas', `
    <label class="field"><span>Nom</span><input class="input" id="em-name" value="${esc(m.name)}"></label>
    <ul class="card-list">${m.items.map((it, i) => `<li class="row between"><span>${esc(it.name)} <small class="muted">${it.unit === 'u' ? `${fmt(it.qty, 2)} ${esc(it.unitName || 'u.')}` : `${fmt(it.grams)} g`}</small></span>
      <button class="icon-btn" data-act="em-remove" data-i="${i}" aria-label="Retirer">✕</button></li>`).join('')}</ul>
    <button class="btn primary full big" data-act="em-save">Enregistrer</button>
    <button class="btn danger full" data-act="em-delete">Supprimer ce repas</button>`);
}
on('saved-edit', (el) => { const m = S.meals.find((x) => x.id === el.dataset.id); if (m) { editingMeal = JSON.parse(JSON.stringify(m)); renderMealEditor(); } });
on('em-remove', (el) => { editingMeal.name = document.getElementById('em-name').value; editingMeal.items.splice(Number(el.dataset.i), 1); renderMealEditor(); });
on('em-save', async () => {
  editingMeal.name = document.getElementById('em-name').value.trim() || editingMeal.name;
  await put('meals', editingMeal);
  toast('Repas modifié', 'ok');
  renderSaved();
});
on('em-delete', async () => {
  const id = editingMeal.id, name = editingMeal.name;
  if (!(await confirmBox(`Supprimer le repas « ${esc(name)} » ?`, { ok: 'Supprimer', danger: true }))) { renderMealEditor(); return; }
  await del('meals', id);
  toast('Repas supprimé');
  renderSaved();
});

// ---------- Idées de repas ----------
let ideasCache = [];
function renderIdeas() {
  const t = targetsFor(UI.nutDate), tot = dayTotals(UI.nutDate);
  const remaining = { kcal: t.kcal - tot.kcal, p: t.p - tot.p };
  ideasCache = mealIdeas({ ideas: MEAL_IDEAS, saved: S.meals, foods: S.foods, remaining, banned: S.settings.motsExclus });
  openSheet('Idées de repas', `
    <p class="hint">Il te reste <b>${fmt(Math.max(0, remaining.kcal))} kcal</b> et <b>${fmt(Math.max(0, remaining.p))} g de protéines</b>. Classées des plus riches en protéines aux moins riches. Jamais d'aliment « à éviter » ni de mot exclu (${esc(S.settings.motsExclus.join(', '))}).</p>
    ${mealChooser('idea-target')}
    ${ideasCache.length ? `<ul class="card-list">${ideasCache.map((x, i) => `<li class="saved-meal ${x.fits ? '' : 'dim'}">
      <div class="grow"><b>${esc(x.name)}</b> ${x.origin === 'enregistre' ? '<span class="tag">à toi</span>' : ''} ${x.fits ? '' : '<span class="tag bad">trop calorique</span>'}
        <small>${fmt(x.kcal)} kcal · ${fmt(x.p)} g P · ${fmt(x.c)} g G · ${fmt(x.f)} g L</small>
        <small class="muted">${x.items.map((it) => `${esc(it.name)} ${it.units ? `×${fmt(it.units, 1)}` : `${fmt(it.grams)} g`}`).join(' · ')}</small></div>
      <button class="btn primary small" data-act="idea-add" data-i="${i}">Ajouter</button></li>`).join('')}</ul>` : empty('Aucune idée disponible (aliments supprimés ou marqués « à éviter »).')}`);
}
on('nut-ideas', () => { savedTarget = defaultMeal(); renderIdeas(); });
on('idea-target', (el) => { savedTarget = el.dataset.m; renderIdeas(); });
on('idea-add', async (el) => {
  const x = ideasCache[Number(el.dataset.i)];
  if (!x) return;
  await addItems(x.items.map((it) => ({ ...it, unit: it.units ? 'u' : 'g', qty: it.units || it.grams })), savedTarget);
  closeSheet();
  toast(`${x.name} ajouté`, 'ok');
  rerender();
});

