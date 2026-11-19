// =============================================================
// data.js — données de départ (profil, aliments, programme, idées de repas, skills).
// Ces valeurs sont copiées dans la base locale au tout premier lancement,
// ensuite TOUT est modifiable dans l'app.
// =============================================================

export const APP_VERSION = '1.0.0';

// Le profil est VIDE dans le code : il est rempli sur le téléphone, au premier lancement
// (écran de bienvenue), et ne quitte jamais l'appareil.
export const DEFAULT_SETTINGS = {
  profilOk: false, // passe à true quand l'écran de bienvenue est validé
  // Profil
  sexe: '',
  age: null,
  taille: null, // cm
  poids: null, // kg (poids de départ du plan)
  activite: 'modere',
  halal: false, // option « alimentation halal »
  // Nutrition
  deficit: 25, // %
  kcalMin: 1800,
  protG: 2.0, // g par kg
  lipG: 0.8, // g par kg (minimum)
  kcalAjust: 0, // somme des ajustements validés (+150 / −150)
  actifsOn: false, // ajouter une partie des calories actives
  actifsPct: 50,
  // mots qui excluent un aliment des suggestions, quoi qu'il arrive (modifiable dans Réglages)
  motsExclus: [],
  alerteProtHeure: 18,
  // Plan
  planStart: null, // date de début (choisie au premier lancement)
  dureePlan: 12, // semaines
  // Tractions
  pullStart: null, // début du programme tractions (7 semaines)
  pullInitialMax: null,
  pullGoal: null,
  // Séance
  restBig: 150, // secondes (2 min 30)
  restSmall: 90,
  son: true,
  ecranAllume: true,
  // Sauvegarde
  rappelDimanche: true,
};

// Valeurs pour 100 g (moyennes de tables nutritionnelles type CIQUAL / étiquettes).
// unitName / unitWeight : permet de saisir en unités (1 œuf ≈ 50 g sans coquille).
// meat : viande → nommée « halal » si l'option halal est activée (voir applyHalal dans calc.js).
export const SEED_FOODS = [
  { id: 'f_fromage_blanc', name: 'Fromage blanc 0 %', kcal: 47, p: 7.7, c: 3.9, f: 0.1 },
  { id: 'f_oeuf', name: 'Œuf entier', kcal: 143, p: 12.6, c: 0.7, f: 9.5, unitName: 'œuf', unitWeight: 50, defaultUnit: true },
  { id: 'f_avoine', name: 'Flocons d\'avoine', kcal: 372, p: 13.5, c: 58.7, f: 7 },
  { id: 'f_thon', name: 'Thon au naturel (égoutté)', kcal: 116, p: 26, c: 0, f: 1, unitName: 'boîte (égouttée)', unitWeight: 112 },
  { id: 'f_potatoes', name: 'Potatoes surgelées', kcal: 145, p: 2.4, c: 20.5, f: 5.5 },
  { id: 'f_riz_cru', name: 'Riz blanc (cru)', kcal: 355, p: 7, c: 79, f: 0.6 },
  { id: 'f_riz_cuit', name: 'Riz blanc (cuit)', kcal: 130, p: 2.7, c: 28.5, f: 0.3 },
  { id: 'f_poulet', name: 'Blanc de poulet (cru)', kcal: 110, p: 23.5, c: 0, f: 1.5, meat: true },
  { id: 'f_poulet_cuit', name: 'Blanc de poulet (cuit)', kcal: 151, p: 31, c: 0, f: 3, meat: true },
  { id: 'f_steak', name: 'Steak haché 5 % (cru)', kcal: 126, p: 21, c: 0, f: 5, unitName: 'steak', unitWeight: 100, meat: true },
  { id: 'f_banane', name: 'Banane', kcal: 90, p: 1.1, c: 20.5, f: 0.3, unitName: 'banane', unitWeight: 120 },
  { id: 'f_legumes', name: 'Légumes surgelés (mélange)', kcal: 42, p: 2.4, c: 6, f: 0.4 },
  { id: 'f_pain_complet', name: 'Pain complet', kcal: 245, p: 9.5, c: 42, f: 3, unitName: 'tranche', unitWeight: 35 },
  { id: 'f_huile_olive', name: 'Huile d\'olive', kcal: 900, p: 0, c: 0, f: 100, unitName: 'c. à soupe', unitWeight: 10 },
];

// Mots ajoutés aux exclusions quand l'option halal est activée.
export const HALAL_EXCLUS = ['porc', 'lardon', 'alcool', 'vin rouge', 'vin blanc', 'bière', 'gélatine'];

// Idées de repas (suggestions), construites uniquement avec les aliments de base.
export const MEAL_IDEAS = [
  { name: 'Fromage blanc + avoine + banane', items: [{ foodId: 'f_fromage_blanc', grams: 250 }, { foodId: 'f_avoine', grams: 40 }, { foodId: 'f_banane', units: 1 }] },
  { name: 'Omelette 3 œufs + pain complet', items: [{ foodId: 'f_oeuf', units: 3 }, { foodId: 'f_pain_complet', units: 2 }] },
  { name: 'Poulet + riz + légumes', items: [{ foodId: 'f_poulet', grams: 150 }, { foodId: 'f_riz_cru', grams: 70 }, { foodId: 'f_legumes', grams: 200 }, { foodId: 'f_huile_olive', units: 1 }] },
  { name: 'Steak haché 5 % + potatoes + légumes', items: [{ foodId: 'f_steak', units: 1 }, { foodId: 'f_potatoes', grams: 150 }, { foodId: 'f_legumes', grams: 200 }] },
  { name: 'Thon + riz + légumes', items: [{ foodId: 'f_thon', units: 1 }, { foodId: 'f_riz_cuit', grams: 150 }, { foodId: 'f_legumes', grams: 150 }] },
  { name: 'Collation fromage blanc (300 g)', items: [{ foodId: 'f_fromage_blanc', grams: 300 }] },
  { name: 'Tartines thon (collation)', items: [{ foodId: 'f_thon', units: 1 }, { foodId: 'f_pain_complet', units: 2 }] },
  { name: '2 œufs + banane', items: [{ foodId: 'f_oeuf', units: 2 }, { foodId: 'f_banane', units: 1 }] },
];

export const MEALS = [
  { id: 'petitdej', label: 'Petit-déj' },
  { id: 'dejeuner', label: 'Déjeuner' },
  { id: 'diner', label: 'Dîner' },
  { id: 'collation', label: 'Collation' },
];

// ---- Programme muscu ----
// type : 'poids' (charge + reps), 'max' (reps max, poids du corps), 'pullup' (programme tractions)
// big : gros mouvement (repos long) ; small : petit muscle (+1 kg au lieu de +2,5 kg)
const ex = (name, sets, repMin, repMax, opts = {}) => ({ name, sets, repMin, repMax, type: 'poids', big: false, small: false, note: '', ...opts });

export function seedProgram() {
  let n = 0;
  const id = () => 'e' + (++n);
  const withIds = (list) => list.map((e) => ({ id: id(), ...e }));
  const PULL = { name: 'Tractions (programme)', type: 'pullup', sets: 5, repMin: null, repMax: null, big: true, small: false, note: 'Séries calculées par le programme tractions (onglet Calisthénie)' };
  return {
    templates: [
      {
        id: 'push', name: 'Push', exercises: withIds([
          ex('Développé couché', 4, 6, 8, { big: true }),
          ex('Développé militaire', 3, 8, 10, { big: true }),
          ex('Développé incliné haltères', 3, 8, 10),
          ex('Élévations latérales', 3, 12, 15, { small: true }),
          ex('Dips', 2, null, null, { type: 'max', note: 'Max de reps propres' }),
          ex('Extensions triceps', 2, 12, 12, { small: true }),
        ]),
      },
      {
        id: 'pull', name: 'Pull', exercises: withIds([
          PULL,
          ex('Rowing barre', 4, 6, 8, { big: true }),
          ex('Tirage horizontal', 3, 10, 10),
          ex('Face pull', 3, 15, 15, { small: true }),
          ex('Curl biceps', 3, 10, 12, { small: true }),
        ]),
      },
      {
        id: 'legs', name: 'Legs', exercises: withIds([
          ex('Squat', 4, 6, 8, { big: true }),
          ex('Soulevé de terre roumain', 3, 8, 10, { big: true }),
          ex('Presse à cuisses', 3, 10, 10),
          ex('Leg curl', 3, 12, 12),
          ex('Mollets', 3, 12, 15, { small: true }),
        ]),
      },
      {
        id: 'haut', name: 'Haut', exercises: withIds([
          PULL,
          ex('Développé incliné barre', 3, 6, 8, { big: true }),
          ex('Rowing haltère', 3, 10, 10),
          ex('Développé haltères assis', 3, 10, 10),
          ex('Élévations latérales', 3, 15, 15, { small: true }),
          ex('Curl biceps', 2, 12, 12, { small: true, note: 'Curl + triceps en superset' }),
          ex('Extensions triceps', 2, 12, 12, { small: true }),
        ]),
      },
      {
        id: 'bas', name: 'Bas', exercises: withIds([
          ex('Presse à cuisses', 4, 10, 10),
          ex('Fentes', 3, 10, 10, { note: '10 reps par jambe' }),
          ex('Hip thrust', 3, 10, 10, { big: true }),
          ex('Leg extension', 3, 12, 12),
          ex('Mollets', 3, 15, 15, { small: true }),
        ]),
      },
    ],
    // 0 = dimanche … 6 = samedi ; null = repos
    schedule: { 0: null, 1: 'push', 2: 'pull', 3: 'legs', 4: null, 5: 'haut', 6: 'bas' },
    restNotes: { 0: 'Repos complet', 4: 'Repos – skill L-sit / ATR à la maison' },
  };
}

// ---- Skills ----
export const DEFAULT_SKILLS = {
  lsit: {
    name: 'L-sit', stage: 0,
    stages: [
      { name: 'Tuck L-sit', goal: 15 },
      { name: 'L-sit une jambe tendue', goal: 15 },
      { name: 'L-sit complet', goal: 15 },
    ],
  },
  atr: {
    name: 'ATR (poirier)', stage: 0,
    stages: [
      { name: 'Gainage ventre au mur', goal: 30 },
      { name: 'Montées au mur (tenue en haut)', goal: 20 },
      { name: 'Kick-ups (tenue en équilibre)', goal: 5 },
      { name: 'Équilibre libre', goal: 15 },
    ],
  },
};
