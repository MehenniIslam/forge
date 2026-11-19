// =============================================================
// timer.js — minuteur de repos entre les séries.
// L'heure de fin est enregistrée : si tu fermes l'app, le minuteur reprend où il en était.
// =============================================================
import { S, setKV } from './db.js';
import { beep, vibrate, unlockAudio, on } from './ui.js';
import { fmtDuree } from './util.js';

let iv = null;
let alerted = false;

const el = () => document.getElementById('rest-timer');

export function startTimer(sec, label = 'Repos') {
  unlockAudio();
  alerted = false;
  setKV('timer', { endAt: Date.now() + sec * 1000, total: sec, label });
  tick();
  ensure();
}

function addTime(sec) {
  const t = S.kv.timer;
  if (!t) return;
  const endAt = Math.max(Date.now() + 1000, t.endAt + sec * 1000);
  setKV('timer', { ...t, endAt, total: Math.max(1, t.total + sec) });
  alerted = false;
  tick();
}

export function stopTimer() {
  setKV('timer', null);
  const e = el();
  if (e) { e.hidden = true; e.classList.remove('done'); }
}

function ensure() {
  if (!iv) iv = setInterval(tick, 250);
}

function tick() {
  const t = S.kv.timer;
  const e = el();
  if (!e) return;
  if (!t) { e.hidden = true; clearInterval(iv); iv = null; return; }
  e.hidden = false;
  const rem = (t.endAt - Date.now()) / 1000;
  e.querySelector('.rt-label').textContent = t.label;
  if (rem <= 0) {
    e.classList.add('done');
    e.querySelector('.rt-time').textContent = 'C\'est reparti !';
    e.querySelector('.rt-bar span').style.width = '100%';
    if (!alerted) {
      alerted = true;
      if (S.settings.son) beep(3);
      vibrate();
      setTimeout(() => { if (S.kv.timer && S.kv.timer.endAt === t.endAt) stopTimer(); }, 6000);
    }
    return;
  }
  e.classList.remove('done');
  e.querySelector('.rt-time').textContent = fmtDuree(Math.ceil(rem));
  e.querySelector('.rt-bar span').style.width = `${Math.min(100, (1 - rem / t.total) * 100)}%`;
}

export function initTimer() {
  const t = S.kv.timer;
  if (t) {
    if (t.endAt < Date.now() - 10000) setKV('timer', null);
    else { alerted = t.endAt <= Date.now(); ensure(); tick(); }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
}

on('timer-plus', () => addTime(30));
on('timer-minus', () => addTime(-15));
on('timer-stop', () => stopTimer());
