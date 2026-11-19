// =============================================================
// calc.js — TOUS les calculs de l'app (sans affichage).
// Séparé de l'interface pour pouvoir être testé automatiquement (dossier tests/).
// =============================================================
import {
  addDays, diffDays, dow, dateStr, isValidDateStr, parseNum, norm, roundTo, mean, sum, fmt, pad,
} from './util.js';

// -------------------------------------------------------------
// 1. NUTRITION
// -------------------------------------------------------------

/** Niveaux d'activité (multiplicateurs classiques des calculateurs en ligne). */
export const ACTIVITY = {
  sedentaire: { f: 1.2, label: 'Sédentaire (peu ou pas de sport)' },
  leger: { f: 1.375, label: 'Léger (1 à 3 séances / semaine)' },
  modere: { f: 1.465, label: 'Modéré (4 à 5 séances / semaine)' },
  actif: { f: 1.55, label: 'Actif (sport tous les jours)' },
  tres_actif: { f: 1.725, label: 'Très actif (sport intense 6-7 j / semaine)' },
};

/** Métabolisme de base, formule de Mifflin-St Jeor (kcal / jour). */
export function bmr({ sexe, poids, taille, age }) {
  const base = 10 * poids + 6.25 * taille - 5 * age;
  return sexe === 'femme' ? base - 161 : base + 5;
}

/**
 * Objectifs du jour.
 * - kcal = dépense (BMR × activité) × (1 − déficit), arrondi à 50, + ajustements validés,
 *   jamais sous le plancher (1 800 par défaut)
 * - protéines = 2 g/kg (arrondi à 5), lipides = 0,8 g/kg minimum, glucides = le reste
 * - bonus optionnel : une partie des calories actives importées de Santé
 */
export function nutritionTargets(s, refKg, activeKcal = 0) {
  const b = bmr({ sexe: s.sexe, poids: refKg, taille: s.taille, age: s.age });
  const factor = (ACTIVITY[s.activite] || ACTIVITY.modere).f;
  const tdee = b * factor;
  const base = roundTo(tdee * (1 - s.deficit / 100), 50);
  const withAdj = base + (s.kcalAjust || 0);
  const kcalPlan = Math.max(s.kcalMin, withAdj);
  const bonus = s.actifsOn && activeKcal > 0 ? Math.round((activeKcal * s.actifsPct) / 100) : 0;
  const kcal = kcalPlan + bonus;
  const p = roundTo(s.protG * refKg, 5);
  const f = Math.ceil(s.lipG * refKg);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  return { bmr: Math.round(b), tdee: Math.round(tdee), base, kcalPlan, bonus, kcal, p, f, c, floorHit: withAdj < s.kcalMin };
}

/** Valeurs nutritionnelles pour une quantité (les aliments sont stockés "pour 100 g"). */
export function macros(per100, grams) {
  const k = (Number(grams) || 0) / 100;
  return { kcal: per100.kcal * k, p: per100.p * k, c: per100.c * k, f: per100.f * k };
}

export function totals(entries) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const e of entries) {
    const m = macros(e.per100, e.grams);
    t.kcal += m.kcal; t.p += m.p; t.c += m.c; t.f += m.f;
  }
  return t;
}

/**
 * Option halal : renomme les viandes de la base (« Blanc de poulet halal (cru) ») et marque
 * les aliments de base comme halal. Renvoie seulement les aliments modifiés.
 */
export function applyHalal(foods, on) {
  const out = [];
  for (const f of foods) {
    if (f.custom) continue; // les aliments créés par l'utilisateur gardent ses propres choix
    let name = f.name;
    if (f.meat) {
      const has = /\bhalal\b/i.test(name);
      if (on && !has) name = /\s\(/.test(name) ? name.replace(/\s\(/, ' halal (') : `${name} halal`;
      if (!on && has) name = name.replace(/\s*\bhalal\b/i, '');
    }
    if (name !== f.name || !!f.halal !== on) out.push({ ...f, name, halal: on });
  }
  return out;
}

/** Ajoute des mots à la liste d'exclusion (sans doublon) ou les retire. */
export function mergeWords(list, words, add) {
  const set = new Map((list || []).map((w) => [norm(w), w]));
  for (const w of words) { if (add) set.set(norm(w), w); else set.delete(norm(w)); }
  return [...set.values()];
}

/** Un nom contient-il un mot exclu ? */
export function isBanned(name, words) {
  const n = norm(name);
  return (words || []).some((w) => norm(w) && n.includes(norm(w)));
}

/** Un aliment peut-il apparaître dans les suggestions ? (jamais « à éviter », jamais un mot exclu) */
export function suggestible(food, banned) {
  return food && !food.avoid && !isBanned(food.name, banned);
}

/**
 * Idées de repas qui rentrent dans ce qu'il reste à manger aujourd'hui.
 * ideas : modèles de data.js ; saved : repas enregistrés de l'utilisateur.
 */
export function mealIdeas({ ideas, saved, foods, remaining, banned }) {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const out = [];
  const build = (name, rawItems, origin) => {
    const items = [];
    for (const it of rawItems) {
      const food = byId.get(it.foodId);
      if (origin === 'idee' && !food) return; // aliment supprimé → on saute l'idée
      if (food && !suggestible(food, banned)) return;
      if (!food && isBanned(it.name, banned)) return;
      const per100 = food ? { kcal: food.kcal, p: food.p, c: food.c, f: food.f } : it.per100;
      const unitWeight = food?.unitWeight || it.unitWeight || 0;
      const grams = it.units ? it.units * unitWeight : it.grams;
      items.push({ foodId: it.foodId, name: food ? food.name : it.name, per100, grams, units: it.units || null, unitWeight, unitName: food?.unitName || it.unitName || '' });
    }
    const t = totals(items);
    out.push({ name, items, origin, ...t });
  };
  for (const idea of ideas) build(idea.name, idea.items, 'idee');
  for (const m of saved) build(m.name, m.items, 'enregistre');
  const fits = (x) => x.kcal <= remaining.kcal + 50;
  return out
    .map((x) => ({ ...x, fits: fits(x) }))
    .sort((a, b) => (b.fits - a.fits) || (b.p / Math.max(b.kcal, 1) - a.p / Math.max(a.kcal, 1)));
}

/** Aliments les plus riches en protéines par calorie (pour l'alerte du soir). */
export function proteinBoosters(foods, banned, max = 3) {
  return foods
    .filter((f) => suggestible(f, banned) && f.p >= 10)
    .sort((a, b) => b.p / b.kcal - a.p / a.kcal)
    .slice(0, max);
}

// -------------------------------------------------------------
// 2. POIDS & PLAN
// -------------------------------------------------------------

export const LOSS_LOW = 0.75; // % par semaine
export const LOSS_HIGH = 1.0;
export const LOSS_MID = (LOSS_LOW + LOSS_HIGH) / 2;
export const STAGNATION_PCT = 0.2; // < 0,2 % de perte sur une semaine = stagnation
export const FAST_PCT = 1.25;

/** Moyenne des pesées sur les 7 jours qui finissent à `date` (null si aucune). */
export function avg7(weights, date) {
  const from = addDays(date, -6);
  const vals = weights.filter((w) => w.date >= from && w.date <= date).map((w) => w.kg);
  return vals.length ? mean(vals) : null;
}

/** Poids utilisé pour les calculs : moyenne 7 j autour de la dernière pesée, sinon le poids du profil. */
export function refWeight(weights, profileKg) {
  if (!weights.length) return { kg: profileKg, source: 'profil', n: 0 };
  const last = weights.reduce((a, b) => (b.date > a.date ? b : a)).date;
  const from = addDays(last, -6);
  const vals = weights.filter((w) => w.date >= from && w.date <= last).map((w) => w.kg);
  return { kg: Math.round(mean(vals) * 10) / 10, source: 'moyenne', n: vals.length, last };
}

/** Série lissée (moyenne 7 j) pour le graphique. */
export function smoothed(weights) {
  const sorted = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((w) => ({ x: w.date, y: avg7(sorted, w.date) }));
}

/** Semaine du plan : 1 = semaine qui commence le jour de départ. 0 ou moins = avant. */
export function weekIndex(start, date) {
  return Math.floor(diffDays(start, date) / 7) + 1;
}
export const weekMonday = (start, n) => addDays(start, (n - 1) * 7);

export function weeklyAvg(weights, start, n) {
  const a = weekMonday(start, n);
  const b = addDays(a, 6);
  const vals = weights.filter((w) => w.date >= a && w.date <= b).map((w) => w.kg);
  return vals.length ? mean(vals) : null;
}

/** Poids cible à la fin de la semaine n (fourchette 0,75 % → 1 % par semaine). */
export function planTarget(startKg, n) {
  return {
    target: startKg * Math.pow(1 - LOSS_MID / 100, n),
    high: startKg * Math.pow(1 - LOSS_LOW / 100, n),
    low: startKg * Math.pow(1 - LOSS_HIGH / 100, n),
  };
}

export function planTable(settings, weights) {
  const rows = [];
  for (let n = 1; n <= settings.dureePlan; n++) {
    const mon = weekMonday(settings.planStart, n);
    rows.push({ n, mon, sun: addDays(mon, 6), ...planTarget(settings.poids, n), avg: weeklyAvg(weights, settings.planStart, n) });
  }
  return rows;
}

// -------------------------------------------------------------
// 3. MUSCULATION
// -------------------------------------------------------------

export const exKey = (name) => norm(name);
const num = (v) => parseNum(v) ?? 0;

/** 1RM estimé (formule d'Epley). */
export function e1rm(kg, reps) {
  kg = num(kg); reps = num(reps);
  if (kg <= 0 || reps <= 0) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

const doneSets = (ex) => (ex?.sets || []).filter((s) => s.done && num(s.reps) > 0);

/** Dernière séance terminée qui contient cet exercice (avec au moins une série cochée). */
export function lastPerformance(workouts, key, excludeId = null) {
  const list = workouts
    .filter((w) => w.status === 'terminee' && w.id !== excludeId)
    .sort((a, b) => (a.date === b.date ? (a.finishedAt || 0) - (b.finishedAt || 0) : a.date < b.date ? -1 : 1));
  for (let i = list.length - 1; i >= 0; i--) {
    const ex = list[i].exercises.find((e) => exKey(e.name) === key && doneSets(e).length);
    if (ex) return { date: list[i].date, workoutId: list[i].id, sets: doneSets(ex), ex };
  }
  return null;
}

/**
 * Double progression : si la dernière fois TOUTES les séries prévues ont atteint le haut
 * de la fourchette, on propose +2,5 kg (+1 kg pour les petits muscles). Sinon même charge.
 */
export function progression(ex, last) {
  if (!last || ex.type !== 'poids') return null;
  const done = last.sets.filter((s) => num(s.kg) > 0);
  if (!done.length) return null;
  const kg = Math.max(...done.map((s) => num(s.kg)));
  const inc = ex.small ? 1 : 2.5;
  const top = ex.repMax || ex.repMin;
  const allTop = top && done.length >= ex.sets && done.every((s) => num(s.reps) >= top);
  if (allTop) {
    return { kg: Math.round((kg + inc) * 100) / 100, up: true, text: `Toutes les séries à ${top} reps la dernière fois → passe à ${fmt(kg + inc, 2)} kg` };
  }
  return { kg, up: false, text: `Garde ${fmt(kg, 2)} kg et vise ${top ? top + ' reps sur chaque série' : 'plus de reps'}` };
}

/** Statistiques et records d'un exercice. */
export function exerciseStats(workouts, key) {
  const sessions = [];
  for (const w of workouts) {
    if (w.status !== 'terminee') continue;
    for (const ex of w.exercises) {
      if (exKey(ex.name) !== key) continue;
      const sets = doneSets(ex);
      if (!sets.length) continue;
      let best = 0, topKg = 0, topReps = 0, maxReps = 0, volume = 0;
      for (const s of sets) {
        const k = num(s.kg), r = num(s.reps);
        best = Math.max(best, e1rm(k, r));
        if (k > topKg || (k === topKg && r > topReps)) { topKg = k; topReps = r; }
        maxReps = Math.max(maxReps, r);
        volume += k * r;
      }
      sessions.push({ date: w.date, best, topKg, topReps, maxReps, volume, totalReps: sum(sets.map((s) => num(s.reps))) });
    }
  }
  sessions.sort((a, b) => (a.date < b.date ? -1 : 1));
  const pr = { best: null, topKg: null, maxReps: null };
  for (const s of sessions) {
    if (s.best > 0 && (!pr.best || s.best > pr.best.best)) pr.best = s;
    if (s.topKg > 0 && (!pr.topKg || s.topKg > pr.topKg.topKg || (s.topKg === pr.topKg.topKg && s.topReps > pr.topKg.topReps))) pr.topKg = s;
    if (!pr.maxReps || s.maxReps > pr.maxReps.maxReps) pr.maxReps = s;
  }
  return { sessions, pr };
}

/** Exercices de cette séance qui battent un record (1RM estimé ou reps au poids du corps). */
export function newRecords(workout, workouts) {
  const others = workouts.filter((w) => w.id !== workout.id);
  const out = [];
  for (const ex of workout.exercises) {
    const sets = doneSets(ex);
    if (!sets.length) continue;
    const prev = exerciseStats(others, exKey(ex.name));
    if (!prev.sessions.length) continue;
    if (ex.type === 'poids') {
      // record = meilleur 1RM estimé OU charge la plus lourde jamais soulevée
      const best = Math.max(...sets.map((s) => e1rm(s.kg, s.reps)));
      const heaviest = Math.max(...sets.map((s) => num(s.kg)));
      if ((best > 0 && best > (prev.pr.best?.best || 0) + 0.01) || heaviest > (prev.pr.topKg?.topKg || 0)) out.push(ex.name);
    } else {
      const reps = Math.max(...sets.map((s) => num(s.reps)));
      if (reps > (prev.pr.maxReps?.maxReps || 0)) out.push(ex.name);
    }
  }
  return out;
}

/** Meilleur 1RM estimé par exercice sur une semaine du plan. */
function weekLiftBest(workouts, start, n) {
  const a = weekMonday(start, n), b = addDays(a, 6);
  const best = new Map();
  for (const w of workouts) {
    if (w.status !== 'terminee' || w.date < a || w.date > b) continue;
    for (const ex of w.exercises) {
      if (ex.type !== 'poids') continue;
      for (const s of doneSets(ex)) {
        const v = e1rm(s.kg, s.reps);
        if (v > 0) best.set(exKey(ex.name), Math.max(best.get(exKey(ex.name)) || 0, v));
      }
    }
  }
  return best;
}

/** Variation moyenne des charges entre deux semaines (null si pas assez de données). */
export function liftChange(workouts, start, a, b) {
  const A = weekLiftBest(workouts, start, a), B = weekLiftBest(workouts, start, b);
  const ratios = [];
  for (const [k, v] of A) if (B.has(k)) ratios.push(B.get(k) / v);
  if (ratios.length < 2) return null;
  return mean(ratios) - 1;
}

/** Moyenne des reps de tractions par séance lourde sur une semaine. */
export function pullWeekAvg(workouts, start, n) {
  const a = weekMonday(start, n), b = addDays(a, 6);
  const totalsArr = [];
  for (const w of workouts) {
    if (w.status !== 'terminee' || w.date < a || w.date > b) continue;
    for (const ex of w.exercises) {
      if (ex.type !== 'pullup' || ex.mode !== 'lourde') continue;
      const sets = doneSets(ex);
      if (sets.length) totalsArr.push(sum(sets.map((s) => num(s.reps))));
    }
  }
  return totalsArr.length ? mean(totalsArr) : null;
}

/** Baisse de performance 2 semaines d'affilée (semaines L-2 → L-1 → L). */
export function performanceDrop(workouts, start, L) {
  const c1 = liftChange(workouts, start, L - 2, L - 1);
  const c2 = liftChange(workouts, start, L - 1, L);
  const lifts = c1 !== null && c2 !== null && c1 < -0.01 && c2 < -0.01;
  let pull = false;
  if (L - 2 >= 1 && L <= 5) { // semaines 6 (décharge) et 7 (test) exclues
    const p0 = pullWeekAvg(workouts, start, L - 2), p1 = pullWeekAvg(workouts, start, L - 1), p2 = pullWeekAvg(workouts, start, L);
    pull = p0 !== null && p1 !== null && p2 !== null && p1 < p0 && p2 < p1;
  }
  return { lifts, pull };
}

/**
 * Ajustements proposés (à valider ou refuser), calculés sur les semaines TERMINÉES.
 * - perte > 1,25 % la dernière semaine, ou perfs en baisse 2 semaines → +150 kcal
 * - moyenne qui stagne 2 semaines → −150 kcal (sans passer sous le plancher)
 */
export function computeProposals({ settings, weights, workouts, decisions, today, currentKcal }) {
  const start = settings.planStart;
  const L = weekIndex(start, today) - 1; // dernière semaine complète
  if (L < 2) return [];
  const W = (n) => (n === 0 ? weeklyAvg(weights, start, 0) ?? settings.poids : weeklyAvg(weights, start, n));
  const w0 = W(L - 2), w1 = W(L - 1), w2 = W(L);
  const decided = new Set((decisions || []).map((d) => d.id));
  const props = [];
  const plus = [];
  if (w1 && w2) {
    const loss = ((w1 - w2) / w1) * 100;
    if (loss > FAST_PCT) plus.push(`Tu as perdu ${fmt(loss, 2)} % la semaine dernière (plus de ${fmt(FAST_PCT, 2)} %).`);
  }
  const perf = performanceDrop(workouts, start, L);
  if (perf.lifts) plus.push('Tes charges baissent depuis 2 semaines : le déficit est sûrement trop fort.');
  if (perf.pull) plus.push('Tes tractions baissent depuis 2 semaines : le déficit est sûrement trop fort.');
  if (plus.length) {
    props.push({ id: `S${L}-plus`, week: L, delta: 150, title: 'Proposition : +150 kcal', reasons: plus });
  } else if (w0 && w1 && w2) {
    const l1 = ((w0 - w1) / w0) * 100, l2 = ((w1 - w2) / w1) * 100;
    if (l1 < STAGNATION_PCT && l2 < STAGNATION_PCT) {
      const target = Math.max(settings.kcalMin, currentKcal - 150);
      const delta = target - currentKcal;
      if (delta < 0) {
        props.push({
          id: `S${L}-moins`, week: L, delta, title: `Proposition : ${delta} kcal`,
          reasons: [`Ta moyenne stagne depuis 2 semaines (${fmt(w0, 1)} → ${fmt(w1, 1)} → ${fmt(w2, 1)} kg).`,
            ...(delta > -150 ? [`Limité à ${delta} kcal pour ne pas passer sous ${settings.kcalMin} kcal.`] : [])],
        });
      }
    }
  }
  return props.filter((p) => !decided.has(p.id));
}

// -------------------------------------------------------------
// 4. PROGRAMME TRACTIONS (7 semaines)
// -------------------------------------------------------------

export const GTG_TARGET = [5, 6, 7, 7, 8, 4]; // séries GTG par jour, semaines 1 → 6
export const FINAL_TEST_OFFSET = 45; // jeudi de la semaine 7 (23/11/2026 + 45 j = 07/01/2027)

/** Jours de séance lourde = jours dont la séance contient l'exercice "Tractions (programme)". */
export function heavyDaysFromProgram(program) {
  const days = [];
  for (let wd = 0; wd < 7; wd++) {
    const t = program.templates.find((x) => x.id === program.schedule[wd]);
    if (t && t.exercises.some((e) => e.type === 'pullup')) days.push(wd);
  }
  return days.length ? days : [2, 5];
}

/** Max en vigueur à une date : le dernier test saisi, sinon le max de départ. */
export function effectiveMax(cfg, tests, date) {
  const past = tests.filter((t) => t.date <= date && t.reps > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!past.length) return { max: cfg.initialMax, date: cfg.start, blockStart: 1, initial: true };
  const t = past[past.length - 1];
  return { max: t.reps, date: t.date, blockStart: Math.max(1, weekIndex(cfg.start, t.date) + 1), initial: false };
}

/** 5 séries : la 1re à ~70 % du max, les 4 autres à ~60 %. +1 rep sur 2 séries par semaine (plafond 80 %). */
export function heavySets(M, k) {
  const top = Math.max(1, Math.round((M * 70) / 100));
  const base = Math.max(1, Math.round((M * 60) / 100));
  const cap = Math.max(top, Math.round((M * 80) / 100));
  const sets = [top, base, base, base, base];
  const order = [1, 2, 3, 4, 0];
  for (let i = 0; i < 2 * k; i++) {
    const idx = order[i % 5];
    sets[idx] = Math.min(cap, sets[idx] + 1);
  }
  return sets;
}

export const gtgReps = (M) => (M >= 10 ? 4 : 3);

/**
 * Ce que le programme tractions prévoit pour un jour donné.
 * type : avant | lourde | test | gtg | repos | leger | test_final | fini
 */
export function pullPlanForDate(cfg, tests, date, heavyDays) {
  const start = cfg.start;
  const d = diffDays(start, date);
  const finalTest = addDays(start, FINAL_TEST_OFFSET);
  const em = effectiveMax(cfg, tests, date);
  const M = em.max;
  const base = { date, max: M, maxInfo: em, gtgReps: gtgReps(M), finalTest };
  if (d < 0) return { ...base, type: 'avant', week: 0 };
  const week = Math.floor(d / 7) + 1;
  if (date === finalTest) return { ...base, type: 'test_final', week };
  if (date > finalTest) return { ...base, type: 'fini', week };
  const wd = dow(date);
  const isHeavy = heavyDays.includes(wd);
  const isEve = heavyDays.includes((wd + 1) % 7);
  if (week === 7) {
    if (isHeavy) {
      const r = Math.max(1, Math.round((M * 50) / 100));
      return { ...base, type: 'leger', week, sets: [r, r, r] };
    }
    return { ...base, type: 'repos', week, note: 'Repos : le test final arrive.' };
  }
  if (isHeavy) {
    const lastHeavy = [...heavyDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).pop();
    const mon = weekMonday(start, week);
    const testedThisWeek = tests.some((t) => t.date >= mon && t.date < date);
    if ((week === 2 || week === 4) && wd === lastHeavy && !testedThisWeek) {
      return { ...base, type: 'test', week };
    }
    let sets;
    if (week === 6) {
      const k5 = Math.max(0, 5 - em.blockStart);
      sets = heavySets(M, k5).map((r) => Math.max(1, Math.round(r / 2)));
    } else {
      sets = heavySets(M, Math.max(0, week - em.blockStart));
    }
    return { ...base, type: 'lourde', week, sets, deload: week === 6 };
  }
  if (!isEve) return { ...base, type: 'gtg', week, gtgTarget: GTG_TARGET[week - 1] };
  return { ...base, type: 'repos', week, note: 'Pas de GTG aujourd\'hui : demain c\'est séance lourde.' };
}

// -------------------------------------------------------------
// 5. SKILLS (L-sit, ATR)
// -------------------------------------------------------------

export const holdsAtGoal = (holds, goal) => (holds || []).filter((h) => h >= goal).length;
/** On propose l'étape suivante quand on a tenu 3 fois l'objectif dans la même séance. */
export const canAdvance = (holds, goal) => holdsAtGoal(holds, goal) >= 3;

// -------------------------------------------------------------
// 6. IMPORT APPLE SANTÉ (texte du presse-papiers → données propres)
// -------------------------------------------------------------

const FIELD_ALIASES = {
  pas: 'pas', steps: 'pas', nombre_de_pas: 'pas',
  poids: 'poids', weight: 'poids', masse: 'poids', masse_corporelle: 'poids',
  sommeil: 'sommeil', sleep: 'sommeil', sommeil_h: 'sommeil', heures_sommeil: 'sommeil',
  kcal_actives: 'kcal_actives', calories_actives: 'kcal_actives', energie_active: 'kcal_actives', active_energy: 'kcal_actives', kcal: 'kcal_actives',
};
const LIMITS = { pas: [0, 150000], poids: [25, 350], sommeil: [0, 24], kcal_actives: [0, 15000] };

const keyName = (k) => norm(k).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Nettoie le texte copié : guillemets typographiques (iOS), virgules en trop, texte autour du JSON. */
export function cleanJsonText(t) {
  let s = String(t ?? '')
    .replace(/^﻿/, '')
    .replace(/«[\s  ]*/g, '"')
    .replace(/[\s  ]*»/g, '"')
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[  ]/g, ' ');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  const a2 = s.indexOf('[');
  if (a >= 0 && b > a && !(a2 >= 0 && a2 < a && s.lastIndexOf(']') > b)) s = s.slice(a, b + 1);
  else if (a2 >= 0) s = s.slice(a2, s.lastIndexOf(']') + 1);
  return s.replace(/,\s*([\]}])/g, '$1').trim();
}

function tryParse(s) {
  try { return JSON.parse(s); } catch { return undefined; }
}

/** "2026-11-20", "20/11/2026", "2026-11-20T08:00…" → "2026-11-20" (ou null). */
export function parseDay(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const d = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`; return isValidDateStr(d) ? d : null; }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) { const d = `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`; return isValidDateStr(d) ? d : null; }
  return null;
}

/** Date + heure souple : "2026-11-19 23:10", ISO avec fuseau, "19/11/2026 23:10"… → Date (ou null). */
export function parseDateTime(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\s]+(\d{1,2})[:h](\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\D+(\d{1,2})[:h](\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));
  return null;
}

/** Heures de sommeil : 7.5 · "7,5" · "7:30" · "7 h 30" · 450 (minutes) → 7.5 */
export function parseSleepHours(v) {
  if (typeof v === 'string') {
    const m = v.match(/(\d{1,2})\s*(?:h|:)\s*(\d{1,2})/i);
    if (m) return +m[1] + +m[2] / 60;
  }
  const n = parseNum(v);
  if (n === null) return null;
  return n > 24 ? n / 60 : n;
}

function classifySleep(valeur) {
  const v = norm(valeur);
  // certaines versions donnent un code : 0 = au lit, 2 = éveillé, 1/3/4/5 = endormi
  if (/^\d$/.test(v)) return v === '0' ? 'lit' : v === '2' ? 'eveil' : 'dort';
  if (v.includes('au lit') || v.includes('in bed') || v.includes('inbed')) return 'lit';
  if (v.includes('eveill') || v.includes('awake') || v.includes('reveil')) return 'eveil';
  return 'dort';
}

/** Additionne des intervalles en fusionnant ceux qui se chevauchent (évite de compter 2 fois Watch + iPhone). */
function mergedMinutes(intervals) {
  const arr = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0, cs = null, ce = null;
  for (const [a, b] of arr) {
    if (cs === null) { cs = a; ce = b; continue; }
    if (a <= ce) ce = Math.max(ce, b);
    else { total += ce - cs; cs = a; ce = b; }
  }
  if (cs !== null) total += ce - cs;
  return total / 60000;
}

/** Nuit rattachée à la date du réveil : fin du segment + 6 h (un segment qui finit à 23 h compte pour le lendemain matin). */
export const nightKey = (end) => dateStr(new Date(end.getTime() + 6 * 3600 * 1000));

/**
 * Lit le texte du presse-papiers. Ne plante jamais : renvoie { ok, error?, days, warnings }.
 * days = [{ date, pas?, poids?, sommeil?, kcal_actives? }] triés par date.
 */
export function parseHealthText(text) {
  const warnings = [];
  if (!text || !String(text).trim()) return { ok: false, error: 'Le presse-papiers est vide. Lance d\'abord le raccourci « Export Santé ».', days: [], warnings };
  let s = cleanJsonText(text);
  let data = tryParse(s);
  if (data === undefined) {
    // nombres à virgule non entre guillemets ("poids":81,6) et valeurs vides ("poids":,)
    const fixed = s
      .replace(/("[^"]+"\s*:\s*-?\d+),(\d+)(?=\s*[,}\]])/g, '$1.$2')
      .replace(/:\s*(?=[,}\]])/g, ': null');
    data = tryParse(fixed);
  }
  if (data === undefined || data === null || typeof data !== 'object') {
    return { ok: false, error: 'Le texte copié n\'est pas au bon format (JSON illisible). Relance le raccourci puis réessaie.', days: [], warnings };
  }
  if (!Array.isArray(data) && data.source !== undefined && norm(data.source) !== 'sante') {
    warnings.push(`Source inattendue « ${data.source} » : import quand même.`);
  }
  const items = Array.isArray(data) ? data : Array.isArray(data.jours) ? data.jours : Array.isArray(data.days) ? data.days : null;
  if (!items) return { ok: false, error: 'Format inconnu : il manque la liste « jours ».', days: [], warnings };
  const segments = [...items.filter((x) => x && typeof x === 'object' && (x.debut || x.start) && (x.fin || x.end)), ...(Array.isArray(data.sommeil_segments) ? data.sommeil_segments : [])];

  const byDate = new Map();
  const get = (d) => { if (!byDate.has(d)) byDate.set(d, { date: d }); return byDate.get(d); };
  let invalid = 0, outOfRange = 0;

  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || raw.debut || raw.start) continue;
    const date = parseDay(raw.date ?? raw.jour ?? raw.day);
    if (!date) { invalid++; continue; }
    const rec = get(date);
    for (const [k, v] of Object.entries(raw)) {
      const field = FIELD_ALIASES[keyName(k)];
      if (!field) continue;
      const n = field === 'sommeil' ? parseSleepHours(v) : parseNum(v);
      if (n === null) continue; // donnée manquante : on l'ignore simplement
      const [lo, hi] = LIMITS[field];
      if (n < lo || n > hi) { outOfRange++; continue; }
      if (field === 'pas' || field === 'kcal_actives') rec[field] = (rec[field] || 0) + n; // plusieurs lignes le même jour → somme
      else if (field === 'poids') { if (rec.poids === undefined) rec.poids = n; } // on garde la 1re pesée (le matin)
      else rec[field] = n;
    }
  }

  // Sommeil à partir des segments (début / fin / valeur)
  const nights = new Map();
  let badSeg = 0;
  for (const sg of segments) {
    const a = parseDateTime(sg.debut ?? sg.start), b = parseDateTime(sg.fin ?? sg.end);
    if (!a || !b || b <= a) { badSeg++; continue; }
    const kind = classifySleep(sg.valeur ?? sg.value ?? '');
    if (kind === 'eveil') continue;
    const key = nightKey(b);
    if (!nights.has(key)) nights.set(key, { dort: [], lit: [], first: a });
    const n = nights.get(key);
    n[kind].push([a.getTime(), b.getTime()]);
    if (a < n.first) n.first = a;
  }
  const nightKeys = [...nights.keys()].sort();
  for (const key of nightKeys) {
    const n = nights.get(key);
    const minutes = n.dort.length ? mergedMinutes(n.dort) : mergedMinutes(n.lit);
    if (minutes <= 0) continue;
    const rec = get(key);
    if (rec.sommeil === undefined) { rec.sommeil = Math.round((minutes / 60) * 100) / 100; rec._sleepFromSegments = true; }
  }
  if (nightKeys.length) byDate.forEach((r) => { if (r.date === nightKeys[0] && r._sleepFromSegments) r._firstNight = true; });

  if (invalid) warnings.push(`${invalid} ligne(s) sans date valide ignorée(s).`);
  if (outOfRange) warnings.push(`${outOfRange} valeur(s) impossible(s) ignorée(s).`);
  if (badSeg) warnings.push(`${badSeg} segment(s) de sommeil illisible(s) ignoré(s).`);

  const days = [...byDate.values()]
    .filter((r) => ['pas', 'poids', 'sommeil', 'kcal_actives'].some((f) => r[f] !== undefined))
    .map((r) => {
      const o = { date: r.date };
      if (r.pas !== undefined) o.pas = Math.round(r.pas);
      if (r.kcal_actives !== undefined) o.kcal_actives = Math.round(r.kcal_actives);
      if (r.poids !== undefined) o.poids = Math.round(r.poids * 10) / 10;
      if (r.sommeil !== undefined) o.sommeil = Math.round(r.sommeil * 100) / 100;
      if (r._firstNight) o._firstNight = true;
      return o;
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!days.length) return { ok: false, error: 'Aucune donnée utilisable trouvée dans le texte copié.', days: [], warnings };
  return { ok: true, days, warnings };
}

/**
 * Prépare l'enregistrement SANS doublon : une date déjà présente est mise à jour.
 * - Le 1er jour d'une période de 7 jours peut être incomplet → on garde la plus grande valeur.
 * - Le poids importé ne remplace jamais une pesée saisie à la main.
 */
export function planHealthImport(days, healthList, weightList) {
  const health = new Map(healthList.map((h) => [h.date, h]));
  const weights = new Map(weightList.map((w) => [w.date, w]));
  const oldest = days.length >= 3 ? days[0].date : null;
  const rows = [], healthPuts = [], weightPuts = [];
  for (const d of days) {
    const old = health.get(d.date);
    const rec = { ...(old || {}), date: d.date };
    const changes = [];
    for (const f of ['pas', 'sommeil', 'kcal_actives']) {
      if (d[f] === undefined) continue;
      let v = d[f];
      const partial = (d.date === oldest && f !== 'sommeil') || (f === 'sommeil' && d._firstNight);
      if (partial && old && old[f] != null) v = Math.max(old[f], v);
      if (!old || old[f] !== v) changes.push(f);
      rec[f] = v;
    }
    let weightAction = null;
    if (d.poids !== undefined) {
      rec.poids = d.poids;
      const w = weights.get(d.date);
      if (w && w.source === 'manuel') weightAction = 'ignore';
      else if (!w || w.kg !== d.poids) { weightAction = w ? 'maj' : 'ajout'; weightPuts.push({ date: d.date, kg: d.poids, source: 'sante' }); }
      else weightAction = 'identique';
      if (!old || old.poids !== d.poids) changes.push('poids');
    }
    const status = !old ? 'nouveau' : changes.length ? 'mis à jour' : 'identique';
    if (status !== 'identique') healthPuts.push(rec);
    rows.push({ date: d.date, rec, status, weightAction });
  }
  return { rows, healthPuts, weightPuts };
}
