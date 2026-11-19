// =============================================================
// app.js — point de départ : ouvre la base, affiche l'onglet demandé, active le mode hors ligne.
// =============================================================
import { initDB, S, askPersist } from './db.js';
import { initActions, initChartTips, setRender, toast, keepAwake, closeSheet } from './ui.js';
import { initTimer } from './timer.js';
import { today } from './util.js';
import { UI, activeWorkout } from './logic.js';
import * as accueil from './views/accueil.js';
import * as nutrition from './views/nutrition.js';
import * as seance from './views/seance.js';
import * as calis from './views/calis.js';
import * as progres from './views/progres.js';
import * as reglages from './views/reglages.js';
import * as aide from './views/aide.js';
import * as bienvenue from './views/bienvenue.js';
import './views/sante.js';

const routes = { accueil, nutrition, seance, calis, progres, reglages, aide };
const tabOf = { aide: 'reglages' };
const main = document.getElementById('view');

function route() {
  const [r, sub] = location.hash.replace(/^#/, '').split('/');
  return { name: routes[r] ? r : 'accueil', sub };
}

function render() {
  const { name, sub } = route();
  const y = window.scrollY;
  // premier lancement : on remplit d'abord le profil
  const onboarding = !S.settings.profilOk;
  document.body.classList.toggle('onboarding', onboarding);
  try {
    main.innerHTML = onboarding ? bienvenue.render() : routes[name].render(sub);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="card"><h2>Oups, un problème d'affichage</h2><p class="muted">${String(e.message || e)}</p><a class="btn primary full" href="#accueil">Retour à l'accueil</a></div>`;
  }
  window.scrollTo(0, y);
  const tab = tabOf[name] || name;
  document.querySelectorAll('.tabbar a').forEach((a) => {
    const on = a.dataset.tab === tab;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

let lastDay = today();
function checkNewDay() {
  if (today() !== lastDay) {
    lastDay = today();
    UI.nutDate = today();
    render();
  }
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    // vérifie s'il existe une nouvelle version à chaque ouverture
    reg.update().catch(() => {});
  }).catch((e) => console.warn('Service worker non enregistré', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // première installation : rien à signaler
    const b = document.getElementById('update-banner');
    b.hidden = false;
  });
}

async function boot() {
  try {
    await initDB();
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="card"><h2>Stockage indisponible</h2><p>L'app n'arrive pas à ouvrir sa base de données locale (${String(e.message || e)}).</p>
      <p class="muted">Vérifie que tu n'es pas en navigation privée, puis relance l'app.</p></div>`;
    return;
  }
  initActions();
  initChartTips();
  setRender(render);
  initTimer();
  window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });
  render();
  document.getElementById('splash')?.remove();

  UI.persisted = await askPersist();
  registerSW();
  if (activeWorkout() && S.settings.ecranAllume) keepAwake(true);

  setInterval(checkNewDay, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkNewDay();
    else seance.flushWorkout();
  });
  window.addEventListener('pagehide', () => seance.flushWorkout());
  window.addEventListener('error', (ev) => console.error(ev.error || ev.message));
  window.addEventListener('unhandledrejection', (ev) => { console.error(ev.reason); toast('Erreur : ' + (ev.reason?.message || ev.reason), 'warn'); });
}

document.getElementById('update-reload')?.addEventListener('click', () => location.reload());
boot();
