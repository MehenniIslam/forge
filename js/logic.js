// =============================================================
// logic.js — raccourcis qui combinent les données enregistrées (S) et les calculs (calc.js).
// =============================================================
import { S } from './db.js';
import { today, addDays, dow, mondayOf, diffDays, dateStr } from './util.js';
import {
  nutritionTargets, refWeight, totals, heavyDaysFromProgram, pullPlanForDate, effectiveMax,
  computeProposals, planTarget, weekIndex, avg7,
} from './calc.js';

export const UI = {
  nutDate: today(),
  progTab: 'poids',
  calTab: 'tractions',
  selEx: null,
  editingWorkout: null, // id d'une séance passée en cours de modification
  sanitePreview: null,
};

export const ref = () => refWeight(S.weights, S.settings.poids);

export function activeKcalFor(date) {
  const h = S.health.find((x) => x.date === date);
  return h?.kcal_actives || 0;
}

export function targetsFor(date = today()) {
  return nutritionTargets(S.settings, ref().kg, activeKcalFor(date));
}

export const entriesFor = (date) => S.journal.filter((e) => e.date === date);
export const dayTotals = (date) => totals(entriesFor(date));

// ---- Plan / poids ----
export function planWeek(date = today()) {
  return weekIndex(S.settings.planStart, date);
}
export function weekTarget(date = today()) {
  const n = Math.max(1, Math.min(planWeek(date), S.settings.dureePlan));
  return { n, ...planTarget(S.settings.poids, n) };
}
export const todayAvg = () => avg7(S.weights, today());
export const weightOn = (date) => S.weights.find((w) => w.date === date);

// ---- Propositions d'ajustement ----
export function proposals() {
  const t = nutritionTargets(S.settings, ref().kg, 0);
  return computeProposals({ settings: S.settings, weights: S.weights, workouts: S.workouts, decisions: S.decisions, today: today(), currentKcal: t.kcalPlan });
}

// ---- Programme muscu ----
export const program = () => S.kv.program;
export const templateById = (id) => program().templates.find((t) => t.id === id);
export function templateForDate(date = today()) {
  const id = program().schedule[dow(date)];
  return id ? templateById(id) : null;
}
export const activeWorkout = () => S.workouts.find((w) => w.id === S.kv.activeWorkout && w.status === 'en_cours') || null;
export const doneToday = () => S.workouts.filter((w) => w.date === today() && w.status === 'terminee');

// ---- Tractions ----
export const pullCfg = () => ({ start: S.settings.pullStart, initialMax: S.settings.pullInitialMax });
export const pullTests = () => S.pullLogs.filter((l) => l.type === 'test').map((l) => ({ date: l.date, reps: l.reps, id: l.id }));
export const heavyDays = () => heavyDaysFromProgram(program());
export const pullPlan = (date = today()) => pullPlanForDate(pullCfg(), pullTests(), date, heavyDays());
export const currentMax = () => effectiveMax(pullCfg(), pullTests(), today());
export const gtgCount = (date = today()) => S.pullLogs.filter((l) => l.type === 'gtg' && l.date === date).length;

export function bestPullMax() {
  const tests = pullTests().map((t) => t.reps);
  return Math.max(S.settings.pullInitialMax, ...tests, 0);
}

// ---- Skills ----
export const skills = () => S.kv.skills;
export const skillLogsFor = (skill) => S.skillLogs.filter((l) => l.skill === skill).sort((a, b) => (a.date < b.date ? -1 : 1));
export function skillDaysThisWeek() {
  const mon = mondayOf(today());
  return new Set(S.skillLogs.filter((l) => l.date >= mon && l.date <= addDays(mon, 6) && (l.holds || []).length).map((l) => l.date)).size;
}
export function bestHold(skill, stage) {
  let best = 0;
  for (const l of S.skillLogs) if (l.skill === skill && l.stage === stage) for (const h of l.holds || []) best = Math.max(best, h);
  return best;
}

// ---- Santé ----
export const healthOn = (date) => S.health.find((h) => h.date === date);

// ---- Sauvegarde ----
export function backupDue() {
  if (!S.settings.rappelDimanche) return false;
  const localDay = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? today() : dateStr(d); };
  const last = S.kv.lastExport ? localDay(S.kv.lastExport) : null;
  const t = today();
  if (dow(t) === 0 && last !== t) return true;
  return !last ? diffDays(S.kv.seeded ? localDay(S.kv.seeded) : t, t) >= 7 : diffDays(last, t) >= 8;
}
