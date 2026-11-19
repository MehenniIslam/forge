// =============================================================
// Tests automatiques des calculs.  Lancer :  node --test tests/
// =============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bmr, nutritionTargets, refWeight, avg7, planTarget, weekIndex, heavySets, pullPlanForDate,
  heavyDaysFromProgram, progression, computeProposals, parseHealthText, planHealthImport, mealIdeas,
  e1rm, cleanJsonText, nightKey, canAdvance, exerciseStats, newRecords, isBanned, FINAL_TEST_OFFSET, applyHalal, mergeWords,
} from '../js/calc.js';
import { parseNum, addDays, dow, diffDays, fmt, mondayOf } from '../js/util.js';
import { DEFAULT_SETTINGS, SEED_FOODS, MEAL_IDEAS, seedProgram } from '../js/data.js';

// profil FICTIF pour les tests (le vrai profil n'est jamais dans le code)
const S = { ...DEFAULT_SETTINGS, sexe: 'homme', age: 25, taille: 180, poids: 80, planStart: '2026-11-23', pullStart: '2026-11-23', pullInitialMax: 10, pullGoal: 20, motsExclus: ['sardine', 'brocoli'] };
const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

// ---------- Utilitaires ----------
test('parseNum lit les nombres à la française', () => {
  assert.equal(parseNum('81,6'), 81.6);
  assert.equal(parseNum('81.6 kg'), 81.6);
  assert.equal(parseNum('8 500'), 8500);
  assert.equal(parseNum('8 500 pas'), 8500);
  assert.equal(parseNum('8 500,5'), 8500.5);
  assert.equal(parseNum(520), 520);
  assert.equal(parseNum(''), null);
  assert.equal(parseNum('abc'), null);
  assert.equal(parseNum(null), null);
});

test('dates : jours de la semaine et décalages', () => {
  assert.equal(dow('2026-11-23'), 1, 'le 23/11/2026 est un lundi');
  assert.equal(dow('2027-01-07'), 4, 'le 07/01/2027 est un jeudi');
  assert.equal(addDays('2026-11-23', FINAL_TEST_OFFSET), '2027-01-07');
  assert.equal(diffDays('2026-11-23', '2026-11-30'), 7);
  assert.equal(diffDays('2026-03-28', '2026-03-30'), 2, 'passage à l\'heure d\'été');
  assert.equal(mondayOf('2026-11-29'), '2026-11-23');
  assert.equal(fmt(2005.2), '2 005');
  assert.equal(fmt(81.65, 1), '81,7');
});

// ---------- Nutrition ----------
test('métabolisme Mifflin-St Jeor (homme 25 ans, 180 cm, 80 kg)', () => {
  assert.equal(bmr({ sexe: 'homme', poids: 80, taille: 180, age: 25 }), 1805);
  assert.equal(bmr({ sexe: 'femme', poids: 80, taille: 180, age: 25 }), 1639);
});

test('profil vide par défaut (rempli sur le téléphone au premier lancement)', () => {
  for (const k of ['age', 'taille', 'poids', 'planStart', 'pullStart', 'pullInitialMax', 'pullGoal']) assert.equal(DEFAULT_SETTINGS[k], null, k);
  assert.equal(DEFAULT_SETTINGS.sexe, '');
  assert.equal(DEFAULT_SETTINGS.profilOk, false);
  assert.equal(DEFAULT_SETTINGS.halal, false);
  assert.deepEqual(DEFAULT_SETTINGS.motsExclus, []);
});

test('objectifs : déficit 25 %, 2 g/kg de protéines, 0,8 g/kg de lipides', () => {
  const t = nutritionTargets(S, 80);
  assert.equal(t.bmr, 1805);
  assert.equal(t.tdee, 2644); // 1805 × 1,465
  assert.equal(t.kcal, 2000); // 2644,3 × 0,75 = 1983 → arrondi à 50
  assert.equal(t.p, 160); // 2 g × 80
  assert.equal(t.f, 64); // 0,8 × 80
  assert.equal(t.c, 196); // (2000 − 640 − 576) / 4
  assert.equal(t.floorHit, false);
});

test('plancher de 1800 kcal jamais dépassé vers le bas', () => {
  const t = nutritionTargets({ ...S, kcalAjust: -600 }, 80);
  assert.equal(t.kcal, 1800);
  assert.equal(t.floorHit, true);
  const t2 = nutritionTargets({ ...S, deficit: 40 }, 70);
  assert.equal(t2.kcal, 1800);
});

test('recalcul quand la moyenne de poids baisse', () => {
  const a = nutritionTargets(S, 80), b = nutritionTargets(S, 76);
  assert.ok(b.kcal < a.kcal);
  assert.equal(b.p, 150); // 2 × 76 = 152 → 150
});

test('bonus calories actives (désactivé par défaut)', () => {
  assert.equal(nutritionTargets(S, 80, 500).bonus, 0);
  const t = nutritionTargets({ ...S, actifsOn: true, actifsPct: 50 }, 80, 500);
  assert.equal(t.bonus, 250);
  assert.equal(t.kcal, 2250);
});

// ---------- Poids & plan ----------
test('moyenne 7 jours et poids de référence', () => {
  const w = [
    { date: '2026-11-10', kg: 84 },
    { date: '2026-11-18', kg: 79 },
    { date: '2026-11-19', kg: 78.6 },
    { date: '2026-11-20', kg: 78.8 },
  ];
  close(avg7(w, '2026-11-20'), 78.8, 0.001);
  const r = refWeight(w, 80);
  assert.equal(r.source, 'moyenne');
  assert.equal(r.kg, 78.8);
  assert.equal(r.n, 3, 'la pesée du 10/11 est trop ancienne');
  assert.deepEqual(refWeight([], 80), { kg: 80, source: 'profil', n: 0 });
});

test('plan : cible hebdomadaire entre 0,75 et 1 % de perte', () => {
  const p1 = planTarget(80, 1);
  close(p1.target, 79.3, 0.0001);
  close(p1.high, 79.4, 0.0001);
  close(p1.low, 79.2, 0.0001);
  const p12 = planTarget(80, 12);
  assert.ok(p12.low < p12.target && p12.target < p12.high);
  assert.equal(weekIndex('2026-11-23', '2026-11-23'), 1);
  assert.equal(weekIndex('2026-11-23', '2026-11-29'), 1);
  assert.equal(weekIndex('2026-11-23', '2026-11-30'), 2);
  assert.equal(weekIndex('2026-11-23', '2026-11-20'), 0);
});

// ---------- Programme tractions ----------
const cfg = { start: '2026-11-23', initialMax: 10 };
const HD = heavyDaysFromProgram(seedProgram());

test('jours lourds = mardi et vendredi (séances Pull et Haut)', () => {
  assert.deepEqual(HD, [2, 5]);
});

test('séries lourdes : 60-70 % du max, +1 rep sur 2 séries par semaine, plafond 80 %', () => {
  assert.deepEqual(heavySets(10, 0), [7, 6, 6, 6, 6]);
  assert.deepEqual(heavySets(10, 1), [7, 7, 7, 6, 6]);
  assert.deepEqual(heavySets(10, 2), [7, 7, 7, 7, 7]);
  assert.deepEqual(heavySets(10, 20), [8, 8, 8, 8, 8]);
  assert.deepEqual(heavySets(15, 0), [11, 9, 9, 9, 9]);
});

test('semaine 1 : lourd mar/ven, GTG mer/sam/dim, rien la veille d\'une séance lourde', () => {
  const p = (d, tests = []) => pullPlanForDate(cfg, tests, d, HD);
  assert.equal(p('2026-11-20').type, 'avant');
  assert.equal(p('2026-11-23').type, 'repos'); // lundi = veille de mardi
  assert.deepEqual(p('2026-11-24').sets, [7, 6, 6, 6, 6]);
  const wed = p('2026-11-25');
  assert.equal(wed.type, 'gtg');
  assert.equal(wed.gtgTarget, 5);
  assert.equal(wed.gtgReps, 4);
  assert.equal(p('2026-11-26').type, 'repos'); // jeudi = veille de vendredi
  assert.equal(p('2026-11-27').type, 'lourde');
  assert.equal(p('2026-11-28').type, 'gtg');
  assert.equal(p('2026-11-29').type, 'gtg');
});

test('tests de max fin S2 et S4, recalcul, décharge S6, test final le 07/01/2027', () => {
  const p = (d, tests) => pullPlanForDate(cfg, tests, d, HD);
  assert.deepEqual(p('2026-12-01', []).sets, [7, 7, 7, 6, 6]); // S2 mardi
  assert.equal(p('2026-12-04', []).type, 'test'); // S2 vendredi
  const t1 = [{ date: '2026-12-04', reps: 12 }];
  assert.equal(p('2026-12-05', t1).gtgTarget, 6);
  assert.deepEqual(p('2026-12-08', t1).sets, [8, 7, 7, 7, 7]); // S3 : recalculé sur 12
  assert.deepEqual(p('2026-12-15', t1).sets, [8, 8, 8, 7, 7]); // S4 : +1 sur 2 séries
  assert.equal(p('2026-12-18', t1).type, 'test');
  const t2 = [...t1, { date: '2026-12-18', reps: 15 }];
  assert.deepEqual(p('2026-12-22', t2).sets, [11, 9, 9, 9, 9]); // S5 sur 15
  const deload = p('2026-12-29', t2);
  assert.equal(deload.deload, true);
  assert.deepEqual(deload.sets, [6, 5, 5, 5, 5]); // S6 : moitié
  assert.equal(p('2026-12-30', t2).gtgTarget, 4);
  assert.equal(p('2027-01-05', t2).type, 'leger');
  assert.deepEqual(p('2027-01-05', t2).sets, [8, 8, 8]);
  assert.equal(p('2027-01-06', t2).type, 'repos');
  assert.equal(p('2027-01-07', t2).type, 'test_final');
  assert.equal(p('2027-01-08', t2).type, 'fini');
});

test('sans test saisi, le volume continue d\'augmenter ; test fait plus tôt = séance normale', () => {
  assert.deepEqual(pullPlanForDate(cfg, [], '2026-12-08', HD).sets, [7, 7, 7, 7, 7]);
  const early = [{ date: '2026-12-03', reps: 11 }];
  assert.equal(pullPlanForDate(cfg, early, '2026-12-04', HD).type, 'lourde');
});

// ---------- Musculation ----------
const bench = { name: 'Développé couché', type: 'poids', sets: 4, repMin: 6, repMax: 8, small: false };
const mk = (date, name, sets, id = date + name) => ({ id, date, status: 'terminee', finishedAt: 1, exercises: [{ name, type: 'poids', sets: sets.map(([kg, reps]) => ({ kg: String(kg), reps: String(reps), done: true })) }] });

test('double progression : +2,5 kg quand toutes les séries sont au haut de la fourchette', () => {
  const top = { sets: [8, 8, 8, 8].map((r) => ({ kg: '60', reps: String(r), done: true })) };
  assert.deepEqual([progression(bench, top).kg, progression(bench, top).up], [62.5, true]);
  const notYet = { sets: [8, 8, 7, 6].map((r) => ({ kg: '60', reps: String(r), done: true })) };
  assert.deepEqual([progression(bench, notYet).kg, progression(bench, notYet).up], [60, false]);
  const few = { sets: [8, 8, 8].map((r) => ({ kg: '60', reps: String(r), done: true })) };
  assert.equal(progression(bench, few).up, false, '3 séries sur 4 seulement');
  const lat = { name: 'Élévations latérales', type: 'poids', sets: 3, repMin: 12, repMax: 15, small: true };
  const latTop = { sets: [15, 15, 15].map((r) => ({ kg: '8', reps: String(r), done: true })) };
  assert.equal(progression(lat, latTop).kg, 9, '+1 kg pour les petits muscles');
  assert.equal(progression(bench, null), null);
});

test('1RM estimé, records et nouveaux records', () => {
  close(e1rm(100, 5), 116.67);
  assert.equal(e1rm(100, 1), 100);
  const ws = [mk('2026-11-23', 'Développé couché', [[60, 8], [60, 7]]), mk('2026-11-27', 'Développé couché', [[62.5, 8]])];
  const st = exerciseStats(ws, 'developpe couche');
  assert.equal(st.sessions.length, 2);
  assert.equal(st.pr.topKg.topKg, 62.5);
  const w3 = mk('2026-11-30', 'Développé couché', [[65, 6]]);
  assert.deepEqual(newRecords(w3, ws), ['Développé couché']);
});

// ---------- Ajustements proposés ----------
function weightsFor(weekAvgs, start = '2026-11-23') {
  const out = [];
  weekAvgs.forEach((kg, i) => { for (let d = 0; d < 7; d++) out.push({ date: addDays(start, i * 7 + d), kg }); });
  return out;
}
const base = { settings: S, workouts: [], decisions: [] };

test('stagnation 2 semaines → −150 kcal (sans passer sous 1800)', () => {
  const weights = weightsFor([79.5, 79.45, 79.4]);
  const p = computeProposals({ ...base, weights, today: '2026-12-14', currentKcal: 2000 });
  assert.equal(p.length, 1);
  assert.equal(p[0].delta, -150);
  assert.equal(p[0].id, 'S3-moins');
  const p2 = computeProposals({ ...base, weights, today: '2026-12-14', currentKcal: 1900 });
  assert.equal(p2[0].delta, -100);
  const p3 = computeProposals({ ...base, weights, today: '2026-12-14', currentKcal: 1800 });
  assert.equal(p3.length, 0);
});

test('perte > 1,25 %/semaine → +150 kcal ; décision déjà prise = plus proposée', () => {
  const weights = weightsFor([80, 79.2, 78]);
  const p = computeProposals({ ...base, weights, today: '2026-12-14', currentKcal: 2000 });
  assert.equal(p[0].delta, 150);
  const done = computeProposals({ ...base, weights, decisions: [{ id: 'S3-plus' }], today: '2026-12-14', currentKcal: 2000 });
  assert.equal(done.length, 0);
});

test('perte normale → aucune proposition ; trop tôt → aucune', () => {
  const weights = weightsFor([80, 79.4, 78.8]);
  assert.equal(computeProposals({ ...base, weights, today: '2026-12-14', currentKcal: 2000 }).length, 0);
  assert.equal(computeProposals({ ...base, weights, today: '2026-12-01', currentKcal: 2000 }).length, 0);
});

test('charges en baisse 2 semaines de suite → +150 kcal (et pas de −150)', () => {
  const weights = weightsFor([79.5, 79.45, 79.4]); // stagnation…
  const workouts = [
    mk('2026-11-23', 'Développé couché', [[70, 8]]), mk('2026-11-25', 'Squat', [[100, 8]]),
    mk('2026-11-30', 'Développé couché', [[67.5, 8]]), mk('2026-12-02', 'Squat', [[95, 8]]),
    mk('2026-12-07', 'Développé couché', [[65, 8]]), mk('2026-12-09', 'Squat', [[90, 8]]),
  ];
  const p = computeProposals({ ...base, weights, workouts, today: '2026-12-14', currentKcal: 2000 });
  assert.equal(p.length, 1);
  assert.equal(p[0].delta, 150);
  assert.match(p[0].reasons.join(' '), /charges baissent/);
});

test('tractions en baisse 2 semaines de suite → +150 kcal', () => {
  const weights = weightsFor([80, 79.4, 78.8]);
  const pull = (date, reps) => ({ id: 'p' + date, date, status: 'terminee', exercises: [{ name: 'Tractions (programme)', type: 'pullup', mode: 'lourde', sets: reps.map((r) => ({ reps: String(r), done: true })) }] });
  const workouts = [pull('2026-11-24', [7, 6, 6, 6, 6]), pull('2026-12-01', [7, 6, 5, 5, 5]), pull('2026-12-08', [6, 5, 5, 4, 4])];
  const p = computeProposals({ ...base, weights, workouts, today: '2026-12-14', currentKcal: 2000 });
  assert.equal(p[0]?.delta, 150);
  assert.match(p[0].reasons.join(' '), /tractions/);
});

// ---------- Import Santé ----------
test('import : exemple du cahier des charges', () => {
  const r = parseHealthText('{"source":"sante","jours":[{"date":"2026-11-20","pas":8500,"poids":81.6,"sommeil":7.5,"kcal_actives":520}]}');
  assert.equal(r.ok, true);
  assert.deepEqual(r.days, [{ date: '2026-11-20', pas: 8500, kcal_actives: 520, poids: 81.6, sommeil: 7.5 }]);
});

test('import : virgules françaises, guillemets typographiques, virgules en trop, texte autour', () => {
  const a = parseHealthText('{"source":"sante","jours":[{"date":"2026-11-20","pas":8500,"poids":81,6,"sommeil":7,5,"kcal_actives":520}]}');
  assert.equal(a.days[0].poids, 81.6);
  assert.equal(a.days[0].sommeil, 7.5);
  const b = parseHealthText('{“source”:“sante”,“jours”:[{“date”:“2026-11-20”,“pas”:“8 500”},]}');
  assert.equal(b.days[0].pas, 8500);
  const c = parseHealthText('{« source » : « sante », « jours » : [{« date » : « 20/11/2026 », « poids » : « 81,6 kg »}]}');
  assert.equal(c.ok, true);
  assert.deepEqual(c.days[0], { date: '2026-11-20', poids: 81.6 });
  const d = parseHealthText('Voici : {"jours":[{"date":"2026-11-20","pas":"1200"}]} merci');
  assert.equal(d.days[0].pas, 1200);
  assert.equal(cleanJsonText('[{"a":1},]'), '[{"a":1}]');
});

test('import : données manquantes ou invalides ne font jamais planter', () => {
  const a = parseHealthText('{"source":"sante","jours":[{"date":"2026-11-20","pas":"","poids":null,"sommeil":"7,5"},{"date":"2026-11-21","pas":,"poids":"81,2"}]}');
  assert.equal(a.ok, true);
  assert.deepEqual(a.days, [{ date: '2026-11-20', sommeil: 7.5 }, { date: '2026-11-21', poids: 81.2 }]);
  const b = parseHealthText('{"jours":[{"date":"pas une date","pas":100},{"date":"2026-11-20","poids":900},{"date":"2026-11-21","pas":"4000"}]}');
  assert.equal(b.days.length, 1);
  assert.equal(b.warnings.length, 2);
  for (const bad of ['', '   ', 'bonjour', '{"jours":"x"}', '{"autre":[]}', '{"jours":[{"date":"2026-11-20"}]}', 'null', '[1,2', '{{{{']) {
    const r = parseHealthText(bad);
    assert.equal(r.ok, false, `doit refuser : ${bad}`);
    assert.ok(r.error);
  }
});

test('import : plusieurs lignes pour un même jour (format du raccourci) sont fusionnées', () => {
  const txt = JSON.stringify({ source: 'sante', jours: [
    { date: '2026-11-19', pas: '7 000' }, { date: '2026-11-20', pas: '8500' },
    { date: '2026-11-20', kcal_actives: '520,4' }, { date: '2026-11-20', poids: '81,6' }, { date: '2026-11-20', poids: '82,4' },
  ] });
  const r = parseHealthText(txt);
  assert.deepEqual(r.days, [{ date: '2026-11-19', pas: 7000 }, { date: '2026-11-20', pas: 8500, kcal_actives: 520, poids: 81.6 }]);
});

test('import : sommeil à partir des phases, chevauchements Watch + iPhone fusionnés', () => {
  const seg = (debut, fin, valeur) => ({ debut, fin, valeur });
  const r = parseHealthText(JSON.stringify({ jours: [
    seg('2026-11-19 23:00', '2026-11-20 02:00', 'Sommeil essentiel'),
    seg('2026-11-20 01:30', '2026-11-20 06:30', 'Sommeil profond'), // chevauche de 30 min
    seg('2026-11-19 22:30', '2026-11-20 07:00', 'Au lit'), // ignoré : on a des phases "endormi"
    seg('2026-11-20 03:00', '2026-11-20 03:10', 'Éveillé'),
    seg('2026-11-20T23:15:00+01:00', '2026-11-21T06:45:00+01:00', 'Au lit'), // nuit suivante : seulement "au lit"
  ] }));
  assert.equal(r.ok, true);
  const n20 = r.days.find((d) => d.date === '2026-11-20');
  const n21 = r.days.find((d) => d.date === '2026-11-21');
  assert.equal(n20.sommeil, 7.5);
  assert.equal(n21.sommeil, 7.5);
  assert.equal(nightKey(new Date(2026, 10, 19, 23, 30)), '2026-11-20', 'un segment qui finit à 23 h compte pour la nuit');
  assert.equal(nightKey(new Date(2026, 10, 20, 15, 0)), '2026-11-20', 'une sieste compte pour le jour même');
});

test('import : mise à jour sans doublon, poids manuel prioritaire, 1er jour partiel protégé', () => {
  const days = [
    { date: '2026-11-14', pas: 300 }, // 1er jour d'une fenêtre de 7 jours : peut être incomplet
    { date: '2026-11-18', pas: 6000 },
    { date: '2026-11-19', pas: 9000, poids: 81.9 },
    { date: '2026-11-20', pas: 8500, poids: 81.6, sommeil: 7.5 },
  ];
  const health = [{ date: '2026-11-14', pas: 9100 }, { date: '2026-11-18', pas: 6000 }, { date: '2026-11-19', pas: 5000 }];
  const weights = [{ date: '2026-11-19', kg: 80, source: 'manuel' }, { date: '2026-11-20', kg: 81, source: 'sante' }];
  const plan = planHealthImport(days, health, weights);
  const row = (d) => plan.rows.find((r) => r.date === d);
  assert.equal(row('2026-11-14').rec.pas, 9100, 'jour partiel : on garde la plus grande valeur');
  assert.equal(row('2026-11-14').status, 'identique');
  assert.equal(row('2026-11-18').status, 'identique');
  assert.equal(row('2026-11-19').status, 'mis à jour');
  assert.equal(row('2026-11-19').weightAction, 'ignore');
  assert.equal(row('2026-11-20').weightAction, 'maj');
  assert.deepEqual(plan.weightPuts, [{ date: '2026-11-20', kg: 81.6, source: 'sante' }]);
  assert.equal(plan.healthPuts.length, 2);
  assert.equal(new Set(plan.healthPuts.map((h) => h.date)).size, plan.healthPuts.length, 'pas de doublon');
  // réimporter les mêmes données ne change rien
  const merged = [...health.filter((h) => !plan.healthPuts.some((p) => p.date === h.date)), ...plan.healthPuts];
  const again = planHealthImport(days, merged, [...weights.filter((w) => w.date !== '2026-11-20'), ...plan.weightPuts]);
  assert.equal(again.healthPuts.length, 0);
  assert.equal(again.weightPuts.length, 0);
});

// ---------- Aliments & suggestions ----------
test('base préremplie : aliments demandés, macros cohérentes, rien de porc', () => {
  for (const f of SEED_FOODS) {
    assert.ok(!/porc|lardon|jambon/i.test(f.name), f.name);
    const calc = f.p * 4 + f.c * 4 + f.f * 9;
    assert.ok(Math.abs(calc - f.kcal) / f.kcal < 0.12 || f.kcal < 60, `${f.name} : macros cohérentes`);
  }
  assert.deepEqual(SEED_FOODS.filter((f) => f.meat).map((f) => f.id), ['f_poulet', 'f_poulet_cuit', 'f_steak']);
  const ids = new Set(SEED_FOODS.map((f) => f.id));
  for (const idea of MEAL_IDEAS) for (const it of idea.items) assert.ok(ids.has(it.foodId), `${idea.name} → ${it.foodId}`);
  const names = SEED_FOODS.map((f) => f.name).join(' ');
  for (const needed of ['Fromage blanc', 'Œuf', 'avoine', 'Thon', 'Potatoes', 'Riz', 'poulet', 'Steak haché 5', 'Banane', 'Légumes', 'Pain complet', 'Huile d\'olive']) assert.ok(names.includes(needed), needed);
});

test('option halal : viandes renommées « halal », réversible, aliments perso intacts', () => {
  const foods = SEED_FOODS.map((f) => ({ halal: false, custom: false, ...f })).concat([{ id: 'u1', name: 'Merguez maison', custom: true, halal: false, meat: true }]);
  const on = applyHalal(foods, true);
  const byId = Object.fromEntries(on.map((f) => [f.id, f]));
  assert.equal(byId.f_poulet.name, 'Blanc de poulet halal (cru)');
  assert.equal(byId.f_steak.name, 'Steak haché 5 % halal (cru)');
  assert.ok(on.every((f) => f.halal));
  assert.ok(!byId.u1, 'aliment créé par l\'utilisateur : pas touché');
  const merged = foods.map((f) => byId[f.id] || f);
  assert.equal(applyHalal(merged, true).length, 0, 'déjà appliqué : rien à changer');
  const off = Object.fromEntries(applyHalal(merged, false).map((f) => [f.id, f]));
  assert.equal(off.f_poulet.name, 'Blanc de poulet (cru)');
  assert.deepEqual(mergeWords(['olives'], ['porc', 'alcool'], true), ['olives', 'porc', 'alcool']);
  assert.deepEqual(mergeWords(['olives', 'porc', 'alcool'], ['porc', 'alcool'], false), ['olives']);
  assert.deepEqual(mergeWords(['Porc'], ['porc'], true), ['porc'], 'pas de doublon');
});

test('suggestions : jamais d\'aliment « à éviter » ni de mot exclu', () => {
  const foods = SEED_FOODS.map((f) => ({ ...f, avoid: f.id === 'f_banane' })).concat([{ id: 'u1', name: 'Sardines à l\'huile', kcal: 200, p: 24, c: 0, f: 12 }]);
  const saved = [{ name: 'Mon dîner sardines', items: [{ foodId: 'u1', name: 'Sardines à l\'huile', per100: { kcal: 200, p: 24, c: 0, f: 12 }, grams: 100 }] },
    { name: 'Brocoli vapeur', items: [{ foodId: 'x', name: 'Brocoli', per100: { kcal: 34, p: 2.8, c: 7, f: 0.4 }, grams: 200 }] },
    { name: 'Mon petit-déj', items: [{ foodId: 'f_fromage_blanc', name: 'Fromage blanc 0 %', per100: { kcal: 47, p: 7.7, c: 3.9, f: 0.1 }, grams: 200 }] }];
  const ideas = mealIdeas({ ideas: MEAL_IDEAS, saved, foods, remaining: { kcal: 2000, p: 150 }, banned: S.motsExclus });
  const all = ideas.map((x) => x.name + ' ' + x.items.map((i) => i.name).join(' ')).join(' | ');
  assert.ok(!/sardine|brocoli/i.test(all), all);
  assert.ok(!/Banane/.test(all), 'banane marquée à éviter');
  assert.ok(ideas.some((x) => x.name === 'Mon petit-déj'));
  assert.ok(isBanned('SARDINES fraîches', ['sardine']));
  const tight = mealIdeas({ ideas: MEAL_IDEAS, saved: [], foods: SEED_FOODS, remaining: { kcal: 200, p: 30 }, banned: [] });
  assert.ok(tight[0].fits && tight[0].kcal <= 250, 'les idées qui rentrent passent en premier');
});

test('skills : étape suivante après 3 maintiens à l\'objectif', () => {
  assert.equal(canAdvance([15, 15.2, 16], 15), true);
  assert.equal(canAdvance([15, 14.9, 16], 15), false);
  assert.equal(canAdvance([], 15), false);
});

test('import : la sortie exacte du raccourci décrite dans GUIDE-RACCOURCI.md', async () => {
  const { readFile } = await import('node:fs/promises');
  const guide = await readFile(new URL('../GUIDE-RACCOURCI.md', import.meta.url), 'utf8');
  const sample = guide.split('\n').find((l) => l.startsWith('{"source":"sante","jours":[{"date":"2026-11-20","pas":"8500"}'));
  assert.ok(sample, 'exemple trouvé dans le guide');
  const r = parseHealthText(sample);
  assert.equal(r.ok, true);
  const { _firstNight, ...day } = r.days[0];
  assert.equal(r.days.length, 1);
  assert.deepEqual(day, { date: '2026-11-20', pas: 8500, kcal_actives: 520, poids: 81.6, sommeil: 7.58 });
  // codes numériques de phase de sommeil (0 = au lit, 2 = éveillé)
  const codes = parseHealthText('{"jours":[{"debut":"2026-11-19 23:00","fin":"2026-11-20 07:00","valeur":"0"},{"debut":"2026-11-20 00:00","fin":"2026-11-20 06:00","valeur":"4"}]}');
  assert.equal(codes.days[0].sommeil, 6);
});
