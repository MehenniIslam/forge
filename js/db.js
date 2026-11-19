// =============================================================
// db.js — stockage local (IndexedDB) + copie en mémoire pour un affichage instantané.
// Chaque modification est écrite tout de suite dans IndexedDB : rien n'est perdu
// si l'app est fermée.
// =============================================================
import { DEFAULT_SETTINGS, SEED_FOODS, DEFAULT_SKILLS, seedProgram, APP_VERSION } from './data.js';

const DB_NAME = 'forge-db';
const DB_VERSION = 1;
// nom du "tiroir" → champ qui sert d'identifiant
export const STORES = {
  kv: 'k', // réglages, programme, séance en cours…
  foods: 'id',
  journal: 'id',
  meals: 'id', // repas enregistrés
  weights: 'date',
  health: 'date',
  workouts: 'id',
  pullLogs: 'id', // GTG + tests de max
  skillLogs: 'id', // L-sit / ATR
  decisions: 'id', // ajustements de calories acceptés / refusés
};
const LISTS = Object.keys(STORES).filter((s) => s !== 'kv');

/** État en mémoire (lu au démarrage). */
export const S = { kv: {}, settings: { ...DEFAULT_SETTINGS } };
for (const l of LISTS) S[l] = [];

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) return reject(new Error('IndexedDB indisponible'));
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const [name, key] of Object.entries(STORES)) {
        if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath: key });
      }
    };
    r.onsuccess = () => {
      db = r.result;
      db.onversionchange = () => { db.close(); location.reload(); };
      resolve(db);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Base bloquée : ferme les autres onglets de l\'app.'));
  });
}

function readAll(store) {
  return new Promise((res, rej) => {
    const q = db.transaction(store).objectStore(store).getAll();
    q.onsuccess = () => res(q.result || []);
    q.onerror = () => rej(q.error);
  });
}

/** Écrit dans une ou plusieurs tables, et attend que ce soit vraiment enregistré. */
function write(stores, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(stores, 'readwrite');
    fn(t);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Écriture annulée'));
  });
}

function mergeSkills(saved) {
  const out = {};
  for (const [k, def] of Object.entries(DEFAULT_SKILLS)) {
    const s = saved?.[k] || {};
    out[k] = { ...def, ...s, stages: Array.isArray(s.stages) && s.stages.length ? s.stages : def.stages };
    out[k].stage = Math.min(Math.max(0, out[k].stage || 0), out[k].stages.length - 1);
  }
  return out;
}

function hydrate() {
  S.settings = { ...DEFAULT_SETTINGS, ...(S.kv.settings || {}) };
  if (!Array.isArray(S.settings.motsExclus)) S.settings.motsExclus = [];
  // sauvegarde d'une version sans écran de bienvenue : profil déjà complet
  const s = S.settings;
  if (!s.profilOk && s.age && s.taille && s.poids && s.planStart) s.profilOk = true;
  if (!S.kv.program) S.kv.program = seedProgram();
  S.kv.skills = mergeSkills(S.kv.skills);
}

/** Ouvre la base, la remplit au premier lancement, puis charge tout en mémoire. */
export async function initDB() {
  await openDB();
  const kvRows = await readAll('kv');
  S.kv = Object.fromEntries(kvRows.map((r) => [r.k, r.v]));
  if (!S.kv.seeded) {
    const program = seedProgram();
    await write(['kv', 'foods'], (t) => {
      const kv = t.objectStore('kv');
      kv.put({ k: 'settings', v: { ...DEFAULT_SETTINGS } });
      kv.put({ k: 'program', v: program });
      kv.put({ k: 'skills', v: DEFAULT_SKILLS });
      kv.put({ k: 'seeded', v: new Date().toISOString() });
      const foods = t.objectStore('foods');
      for (const f of SEED_FOODS) foods.put({ halal: false, avoid: false, fav: false, custom: false, ...f });
    });
    S.kv = { settings: { ...DEFAULT_SETTINGS }, program, skills: DEFAULT_SKILLS, seeded: new Date().toISOString() };
  }
  for (const l of LISTS) S[l] = await readAll(l);
  hydrate();
}

/** Ajoute ou remplace un élément (en mémoire + sur le disque). */
export async function put(store, obj) {
  const key = STORES[store];
  const arr = S[store];
  const i = arr.findIndex((x) => x[key] === obj[key]);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
  await write([store], (t) => t.objectStore(store).put(obj));
}

export async function putMany(store, list) {
  if (!list.length) return;
  const key = STORES[store];
  for (const obj of list) {
    const i = S[store].findIndex((x) => x[key] === obj[key]);
    if (i >= 0) S[store][i] = obj; else S[store].push(obj);
  }
  await write([store], (t) => { const os = t.objectStore(store); for (const o of list) os.put(o); });
}

export async function del(store, keyValue) {
  const key = STORES[store];
  S[store] = S[store].filter((x) => x[key] !== keyValue);
  await write([store], (t) => t.objectStore(store).delete(keyValue));
}

export async function delMany(store, keys) {
  if (!keys.length) return;
  const key = STORES[store];
  const set = new Set(keys);
  S[store] = S[store].filter((x) => !set.has(x[key]));
  await write([store], (t) => { const os = t.objectStore(store); for (const k of keys) os.delete(k); });
}

/** Réglages / objets uniques. */
export async function setKV(k, v) {
  S.kv[k] = v;
  if (k === 'settings') S.settings = { ...DEFAULT_SETTINGS, ...v };
  if (v === null || v === undefined) await write(['kv'], (t) => t.objectStore('kv').delete(k));
  else await write(['kv'], (t) => t.objectStore('kv').put({ k, v }));
}

export const saveSettings = () => setKV('settings', S.settings);

// ---------- Sauvegarde (export / import JSON) ----------

export function exportData() {
  const data = { kv: Object.entries(S.kv).filter(([k]) => k !== 'timer').map(([k, v]) => ({ k, v })) };
  for (const l of LISTS) data[l] = S[l];
  return { app: 'forge', schema: 1, version: APP_VERSION, exportedAt: new Date().toISOString(), data };
}

/** Vérifie un fichier de sauvegarde. Renvoie un message d'erreur ou null. */
export function checkBackup(obj) {
  if (!obj || typeof obj !== 'object') return 'Fichier illisible.';
  if (obj.app !== 'forge' || !obj.data || typeof obj.data !== 'object') return 'Ce fichier n\'est pas une sauvegarde de cette app.';
  for (const l of [...LISTS, 'kv']) {
    if (obj.data[l] !== undefined && !Array.isArray(obj.data[l])) return `Partie « ${l} » invalide.`;
  }
  return null;
}

/** Remplace TOUTES les données par celles de la sauvegarde (en une seule opération). */
export async function importData(obj) {
  const err = checkBackup(obj);
  if (err) throw new Error(err);
  const all = Object.keys(STORES);
  await write(all, (t) => {
    for (const s of all) {
      const os = t.objectStore(s);
      os.clear();
      for (const row of obj.data[s] || []) {
        if (row && typeof row === 'object' && row[STORES[s]] !== undefined) os.put(row);
      }
    }
    t.objectStore('kv').put({ k: 'seeded', v: new Date().toISOString() });
  });
  const kvRows = await readAll('kv');
  S.kv = Object.fromEntries(kvRows.map((r) => [r.k, r.v]));
  for (const l of LISTS) S[l] = await readAll(l);
  hydrate();
}

/** Efface tout (l'app repart de zéro au prochain lancement). */
export async function wipeAll() {
  const all = Object.keys(STORES);
  await write(all, (t) => { for (const s of all) t.objectStore(s).clear(); });
}

/** Demande à Safari de ne pas effacer les données (stockage « persistant »). */
export async function askPersist() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
