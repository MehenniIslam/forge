// =============================================================
// util.js — petites fonctions utiles partout (dates, nombres, texte)
// Aucune dépendance : ce fichier marche dans le navigateur ET dans Node (tests).
// =============================================================

export const pad = (n) => String(n).padStart(2, '0');

/** Date locale au format "AAAA-MM-JJ" (jamais en UTC, pour éviter les décalages de fuseau). */
export function dateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const today = () => dateStr(new Date());

/** "AAAA-MM-JJ" → objet Date à minuit (heure locale). */
export function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDate(s);
  return dateStr(d) === s;
}

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

/** Nombre de jours de a vers b (b - a). Math.round gère les changements d'heure. */
export function diffDays(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

/** Jour de la semaine : 0 = dimanche, 1 = lundi … 6 = samedi. */
export const dow = (s) => parseDate(s).getDay();

/** Lundi de la semaine qui contient la date s. */
export function mondayOf(s) {
  const w = dow(s);
  return addDays(s, w === 0 ? -6 : 1 - w);
}

export const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** Ordre d'affichage lundi → dimanche. */
export const SEMAINE = [1, 2, 3, 4, 5, 6, 0];

/** "ven. 20 nov." */
export function fmtDateCourt(s) {
  const d = parseDate(s);
  return `${JOURS_COURTS[d.getDay()]} ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}
/** "vendredi 20 novembre" */
export function fmtDateLong(s) {
  const d = parseDate(s);
  return `${JOURS[d.getDay()].toLowerCase()} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}
/** "20/11" */
export function fmtDateMini(s) {
  const d = parseDate(s);
  return `${d.getDate()}/${pad(d.getMonth() + 1)}`;
}

/** Nombre → texte français ("81,6"). dec = nombre de décimales max. */
export function fmt(n, dec = 0) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '–';
  const x = Number(n);
  const fixed = x.toFixed(dec);
  // on retire les zéros inutiles ("82,0" → "82")
  const clean = dec > 0 ? String(Number(fixed)) : fixed;
  const [ent, frac] = clean.split('.');
  const entGroup = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return frac ? `${entGroup},${frac}` : entGroup;
}

/**
 * Lit un nombre écrit "à la française" ou venant de Raccourcis :
 * "81,6" · "81.6" · "8 500" · "81,6 kg" · 520 → nombre, ou null si illisible.
 */
export function parseNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  // espaces (normaux, insécables, fines) entre chiffres = séparateurs de milliers
  s = s.replace(/(\d)[\s  ]+(?=\d)/g, '$1');
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Minuscules sans accents, pour la recherche ("Œufs" → "oeufs"). */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .trim();
}

export const roundTo = (n, step) => Math.round(n / step) * step;
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const mean = (arr) => (arr.length ? sum(arr) / arr.length : null);

/** "125" secondes → "2:05" */
export function fmtDuree(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}
