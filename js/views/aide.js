// =============================================================
// Écrans d'AIDE : installation sur iPhone, guide du raccourci Santé, explication des calculs.
// =============================================================
import { S } from '../db.js';
import { fmt, fmtDateCourt, addDays } from '../util.js';
import { ACTIVITY, LOSS_LOW, LOSS_HIGH, FINAL_TEST_OFFSET } from '../calc.js';
import { md, rerender } from '../ui.js';
import { targetsFor, ref } from '../logic.js';

let guideHtml = null;
let guideError = false;

function loadGuide() {
  fetch('GUIDE-RACCOURCI.md')
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then((t) => { guideHtml = md(t); rerender(); })
    .catch(() => { guideError = true; rerender(); });
}

const back = '<a class="btn ghost small" href="#reglages">‹ Réglages</a>';

export function render(sub) {
  if (sub === 'raccourci') {
    if (!guideHtml && !guideError) loadGuide();
    return `<header class="page-head"><h1>Raccourci Santé</h1>${back}</header>
      <article class="card prose">${guideHtml || (guideError ? '<p>Impossible de charger le guide. Ouvre l\'app une fois avec Internet pour le mettre en cache.</p>' : '<p>Chargement…</p>')}</article>`;
  }
  if (sub === 'calculs') return calculs();
  if (sub === 'installation') return installation();
  return `<header class="page-head"><h1>Aide</h1>${back}</header>
    <a class="btn ghost full" href="#aide/installation">📱 Installer l'app sur l'iPhone</a>
    <a class="btn ghost full" href="#aide/raccourci">⌘ Guide du raccourci Santé</a>
    <a class="btn ghost full" href="#aide/calculs">🧮 Comment l'app calcule tout</a>`;
}

function installation() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  return `<header class="page-head"><h1>Installer l'app</h1>${back}</header>
  ${standalone ? '<div class="alert good">✅ L\'app est déjà installée sur ton écran d\'accueil.</div>' : ''}
  <article class="card prose">
    <h3>Sur iPhone (obligatoirement avec Safari)</h3>
    <ol>
      <li>Ouvre l'adresse de l'app dans <strong>Safari</strong> (pas Chrome, pas l'app Instagram…).</li>
      <li>Touche le bouton <strong>Partager</strong> : le carré avec une flèche vers le haut, en bas de l'écran (ou en haut à droite selon la version d'iOS ; sur iOS 26, touche d'abord « ••• » puis « Partager »).</li>
      <li>Fais défiler la liste et touche <strong>« Sur l'écran d'accueil »</strong>.</li>
      <li>Laisse le nom « Forge » (ou change-le), vérifie que <strong>« Ouvrir en tant qu'app web »</strong> est activé si l'option s'affiche, puis touche <strong>« Ajouter »</strong>.</li>
      <li>L'icône apparaît sur ton écran d'accueil. <strong>Ouvre toujours l'app depuis cette icône</strong> : elle s'affiche en plein écran et garde ses propres données.</li>
    </ol>
    <h3>Bon à savoir</h3>
    <ul>
      <li>Après la première ouverture, l'app fonctionne <strong>sans Internet</strong> (mode avion compris).</li>
      <li>Les données de l'app installée et celles de Safari sont <strong>séparées</strong> : utilise uniquement l'icône.</li>
      <li>Si tu supprimes l'icône, les données sont supprimées avec : fais une <strong>sauvegarde</strong> avant (Réglages → Exporter).</li>
      <li>Pour garder tes données, ne change jamais l'adresse du site : les mises à jour se font à la même adresse.</li>
    </ul>
  </article>`;
}

function calculs() {
  const s = S.settings;
  const r = ref();
  const t = targetsFor();
  const act = ACTIVITY[s.activite] || ACTIVITY.modere;
  return `<header class="page-head"><h1>Les calculs</h1>${back}</header>
  <article class="card prose">
    <h3>1. Calories</h3>
    <p><strong>Métabolisme de base (Mifflin-St Jeor)</strong> = 10 × poids + 6,25 × taille − 5 × âge ${s.sexe === 'femme' ? '− 161' : '+ 5'}<br>
    = 10 × ${fmt(r.kg, 1)} + 6,25 × ${s.taille} − 5 × ${s.age} ${s.sexe === 'femme' ? '− 161' : '+ 5'} = <strong>${fmt(t.bmr)} kcal</strong></p>
    <p><strong>Dépense</strong> = métabolisme × ${String(act.f).replace('.', ',')} (« ${act.label} ») = <strong>${fmt(t.tdee)} kcal</strong></p>
    <p><strong>Objectif</strong> = dépense × (1 − ${s.deficit} %) arrondi à 50 = ${fmt(t.base)} kcal${s.kcalAjust ? `, ajustements ${s.kcalAjust > 0 ? '+' : ''}${s.kcalAjust} kcal` : ''}, jamais sous ${s.kcalMin} kcal → <strong>${fmt(t.kcalPlan)} kcal</strong>.</p>
    <p>Le poids utilisé est la <strong>moyenne de tes pesées sur 7 jours</strong> (sinon ton poids de départ) : quand ta moyenne baisse, l'objectif se recalcule tout seul.</p>
    <h3>2. Macros</h3>
    <ul>
      <li>Protéines : ${String(s.protG).replace('.', ',')} g × ${fmt(r.kg, 1)} kg ≈ <strong>${t.p} g</strong> (4 kcal/g)</li>
      <li>Lipides : au moins ${String(s.lipG).replace('.', ',')} g/kg = <strong>${t.f} g</strong> (9 kcal/g)</li>
      <li>Glucides : le reste = <strong>${t.c} g</strong> (4 kcal/g)</li>
    </ul>
    <h3>3. Plan de poids</h3>
    <p>Chaque semaine, la cible baisse de ${String(LOSS_LOW).replace('.', ',')} à ${LOSS_HIGH} % (milieu : 0,875 %). La courbe compare ta <strong>moyenne 7 jours</strong> (qui gomme l'eau et le sel) à la cible.</p>
    <h3>4. Ajustements proposés (tu valides ou tu refuses)</h3>
    <ul>
      <li>Moyenne qui stagne 2 semaines (moins de 0,2 % de perte par semaine) → <strong>−150 kcal</strong>, sans passer sous ${s.kcalMin} kcal.</li>
      <li>Perte de plus de 1,25 % en une semaine → <strong>+150 kcal</strong>.</li>
      <li>Charges (1RM estimé moyen, −1 % ou plus) ou tractions en baisse 2 semaines de suite → <strong>+150 kcal</strong> : le déficit est trop fort.</li>
    </ul>
    <h3>5. Double progression</h3>
    <p>Pour chaque exercice, tu as une fourchette (ex. 6-8 reps). Quand <strong>toutes les séries</strong> atteignent le haut de la fourchette, l'app propose <strong>+2,5 kg</strong> (+1 kg pour les petits muscles : élévations, curls, triceps, face pull, mollets).</p>
    <h3>6. Programme tractions</h3>
    <ul>
      <li>Séances lourdes (jours avec « Tractions (programme) ») : 5 séries, la 1re à ~70 % du max, les autres à ~60 %, +1 rep sur 2 séries chaque semaine (plafond 80 %).</li>
      <li>GTG (mer., sam., dim. – jamais la veille d'une séance lourde) : 5 → 8 séries de 3-4 reps dans la journée.</li>
      <li>Tests de max en fin de semaines 2 et 4 → le programme se recalcule. Semaine 6 : décharge (reps divisées par 2). Test final le <strong>${fmtDateCourt(addDays(s.pullStart, FINAL_TEST_OFFSET))}</strong>.</li>
    </ul>
    <h3>7. Import Santé</h3>
    <p>Une date déjà importée est mise à jour (jamais en double). Le sommeil est calculé à partir des phases « endormi », en fusionnant les plages qui se chevauchent (Watch + iPhone). Le poids importé ne remplace jamais une pesée saisie à la main.</p>
  </article>`;
}
