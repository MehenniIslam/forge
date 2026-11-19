// =============================================================
// Onglet RÉGLAGES : profil, objectifs, tractions, skills, séance, Santé, sauvegarde, aide.
// =============================================================
import { S, saveSettings, setKV, exportData, checkBackup, importData, wipeAll, putMany } from '../db.js';
import { APP_VERSION, HALAL_EXCLUS } from '../data.js';
import { today, fmt, fmtDateCourt, esc, parseNum, isValidDateStr, dateStr } from '../util.js';
import { ACTIVITY, applyHalal, mergeWords } from '../calc.js';
import { on, toast, confirmBox, rerender, unlockAudio, beep } from '../ui.js';
import { UI, targetsFor, ref, skills } from '../logic.js';

const num = (k, label, { step = 'decimal', suffix = '' } = {}) => `
  <label class="field inline"><span>${label}</span>
    <span class="with-suffix"><input class="input" inputmode="${step}" value="${esc(String(S.settings[k]).replace('.', ','))}" data-change="set-num" data-k="${k}">${suffix ? `<em>${suffix}</em>` : ''}</span></label>`;
const toggle = (k, label) => `<label class="switch"><input type="checkbox" ${S.settings[k] ? 'checked' : ''} data-change="set-bool" data-k="${k}"><span>${label}</span></label>`;
const dateField = (k, label) => `<label class="field inline"><span>${label}</span><input class="input" type="date" value="${S.settings[k]}" data-change="set-date" data-k="${k}"></label>`;

export function render() {
  const s = S.settings;
  const t = targetsFor();
  const r = ref();
  const sk = skills();
  const lastExp = S.kv.lastExport ? fmtDateCourt(dateStr(new Date(S.kv.lastExport))) : 'jamais';
  return `
  <header class="page-head"><h1>Réglages</h1></header>

  <section class="card">
    <h2>Mon profil</h2>
    <label class="field inline"><span>Sexe</span><select class="input" data-change="set-text" data-k="sexe">
      <option value="homme" ${s.sexe === 'homme' ? 'selected' : ''}>Homme</option><option value="femme" ${s.sexe === 'femme' ? 'selected' : ''}>Femme</option></select></label>
    ${num('age', 'Âge', { step: 'numeric', suffix: 'ans' })}
    ${num('taille', 'Taille', { step: 'numeric', suffix: 'cm' })}
    ${num('poids', 'Poids de départ', { suffix: 'kg' })}
    <label class="field"><span>Niveau d'activité</span><select class="input" data-change="set-text" data-k="activite">
      ${Object.entries(ACTIVITY).map(([k, v]) => `<option value="${k}" ${s.activite === k ? 'selected' : ''}>${esc(v.label)} ×${String(v.f).replace('.', ',')}</option>`).join('')}</select></label>
    ${dateField('planStart', 'Début du plan')}
    ${num('dureePlan', 'Durée de la sèche', { step: 'numeric', suffix: 'sem.' })}
  </section>

  <section class="card">
    <h2>Objectifs nutrition</h2>
    <div class="calc-box">
      <div><span>Métabolisme de base</span><b>${fmt(t.bmr)} kcal</b></div>
      <div><span>Dépense estimée</span><b>${fmt(t.tdee)} kcal</b></div>
      <div><span>Objectif du jour</span><b>${fmt(t.kcal)} kcal</b></div>
      <div><span>Protéines · Lipides · Glucides</span><b>${t.p} · ${t.f} · ${t.c} g</b></div>
    </div>
    <p class="hint">Calcul basé sur ${r.source === 'moyenne' ? `ta moyenne 7 j (${fmt(r.kg, 1)} kg)` : `ton poids de départ (${fmt(r.kg, 1)} kg)`} : recalculé automatiquement quand ta moyenne change.${t.floorHit ? ' Le plancher s\'applique.' : ''}</p>
    ${num('deficit', 'Déficit', { suffix: '%' })}
    ${num('kcalMin', 'Plancher (jamais en dessous)', { step: 'numeric', suffix: 'kcal' })}
    ${num('protG', 'Protéines', { suffix: 'g/kg' })}
    ${num('lipG', 'Lipides minimum', { suffix: 'g/kg' })}
    <div class="row between field"><span>Ajustements validés : <b>${s.kcalAjust > 0 ? '+' : ''}${s.kcalAjust} kcal</b></span>${s.kcalAjust ? '<button class="btn ghost small" data-act="adj-reset">Remettre à 0</button>' : ''}</div>
    ${num('alerteProtHeure', 'Alerte protéines à partir de', { step: 'numeric', suffix: 'h' })}
    <label class="switch"><input type="checkbox" ${s.halal ? 'checked' : ''} data-change="set-halal"><span>Alimentation halal</span></label>
    <label class="field"><span>Mots exclus des suggestions (séparés par des virgules)</span>
      <input class="input" value="${esc(s.motsExclus.join(', '))}" data-change="set-words" placeholder="ex. olives, champignons"></label>
    <p class="hint">${s.halal ? 'Halal activé : les viandes de la base sont marquées « halal », et porc, alcool et gélatine sont exclus des suggestions. ' : ''}Quand tu crées un aliment, tu peux le marquer « à éviter »${s.halal ? ' ou « halal »' : ''}. Les aliments « à éviter » et ceux qui contiennent un mot exclu n'apparaissent jamais dans les idées de repas.</p>
  </section>

  <section class="card">
    <h2>Calories actives (Apple Santé)</h2>
    ${toggle('actifsOn', 'Ajouter une partie des calories actives à mon objectif du jour')}
    ${s.actifsOn ? num('actifsPct', 'Part ajoutée', { step: 'numeric', suffix: '%' }) : ''}
    <p class="hint">Désactivé par défaut : ton niveau d'activité compte déjà tes séances. Si tu l'actives, seules les calories actives importées pour la journée sont prises en compte.</p>
  </section>

  <section class="card">
    <h2>Tractions</h2>
    ${dateField('pullStart', 'Début du programme')}
    ${num('pullInitialMax', 'Max de départ', { step: 'numeric', suffix: 'reps' })}
    ${num('pullGoal', 'Objectif', { step: 'numeric', suffix: 'reps' })}
  </section>

  <section class="card">
    <h2>L-sit et ATR : objectifs par étape</h2>
    ${['lsit', 'atr'].map((key) => `<h3 class="list-title">${esc(sk[key].name)}</h3>${sk[key].stages.map((st, i) => `
      <label class="field inline"><span>${i + 1}. ${esc(st.name)}</span><span class="with-suffix"><input class="input" inputmode="numeric" value="${st.goal}" data-change="set-goal" data-s="${key}" data-i="${i}"><em>s</em></span></label>`).join('')}`).join('')}
    <p class="hint">Règle : quand tu tiens 3 fois l'objectif dans la même séance, l'app propose l'étape suivante.</p>
  </section>

  <section class="card">
    <h2>Séance</h2>
    ${num('restBig', 'Repos gros mouvements', { step: 'numeric', suffix: 's' })}
    ${num('restSmall', 'Repos autres exercices', { step: 'numeric', suffix: 's' })}
    ${toggle('son', 'Son à la fin du repos')}
    ${toggle('ecranAllume', 'Garder l\'écran allumé pendant une séance')}
    <button class="btn ghost full" data-act="test-sound">🔔 Tester le son</button>
    <p class="hint">Sur iPhone : le son ne sort pas si le mode silencieux est activé, et la vibration n'est pas disponible pour les apps web. Le minuteur sonne seulement si l'app est ouverte à l'écran.</p>
  </section>

  <section class="card">
    <h2>Apple Santé</h2>
    <button class="btn primary full" data-act="sante-import">Importer depuis Santé</button>
    <a class="btn ghost full" href="#aide/raccourci">📖 Guide : créer le raccourci Santé</a>
  </section>

  <section class="card">
    <h2>Sauvegarde</h2>
    <p class="hint">Tes données restent uniquement sur ton iPhone. Fais une sauvegarde chaque semaine : en cas de problème, tu pourras tout restaurer. Dernière sauvegarde : <b>${lastExp}</b>.</p>
    <button class="btn primary full" data-act="backup-export">💾 Exporter mes données (fichier JSON)</button>
    <button class="btn ghost full" data-act="backup-import">📂 Restaurer une sauvegarde</button>
    <input type="file" id="backup-file" accept=".json,application/json" hidden data-change="backup-file">
    ${toggle('rappelDimanche', 'Me rappeler de sauvegarder chaque dimanche')}
    <p class="hint">Stockage protégé : ${UI.persisted === true ? '✅ oui (Safari ne doit pas effacer les données)' : UI.persisted === false ? '⚠️ non accordé – installe l\'app sur l\'écran d\'accueil et pense aux sauvegardes' : 'inconnu sur ce navigateur'}.</p>
  </section>

  <section class="card">
    <h2>Aide</h2>
    <a class="btn ghost full" href="#aide/installation">📱 Installer l'app sur l'iPhone</a>
    <a class="btn ghost full" href="#aide/calculs">🧮 Comment l'app calcule tout</a>
    <a class="btn ghost full" href="#aide/raccourci">⌘ Guide du raccourci Santé</a>
  </section>

  <section class="card danger-zone">
    <h2>Zone dangereuse</h2>
    <button class="btn danger full" data-act="wipe">Tout effacer et repartir de zéro</button>
  </section>
  <p class="version">Forge v${APP_VERSION} · 100 % hors ligne · aucune donnée envoyée</p>`;
}

async function saveAndRefresh(msg = 'Enregistré') {
  await saveSettings();
  toast(msg, 'ok');
  rerender();
}

on('set-num', async (el) => {
  const v = parseNum(el.value);
  if (v === null || v < 0) { toast('Valeur invalide', 'warn'); rerender(); return; }
  S.settings[el.dataset.k] = v;
  await saveAndRefresh();
});
on('set-text', async (el) => { S.settings[el.dataset.k] = el.value; await saveAndRefresh(); });
on('set-bool', async (el) => { S.settings[el.dataset.k] = el.checked; await saveAndRefresh(); });
on('set-date', async (el) => {
  if (!isValidDateStr(el.value)) { toast('Date invalide', 'warn'); return; }
  S.settings[el.dataset.k] = el.value;
  await saveAndRefresh();
});
on('set-halal', async (el) => {
  S.settings.halal = el.checked;
  S.settings.motsExclus = mergeWords(S.settings.motsExclus, HALAL_EXCLUS, el.checked);
  await putMany('foods', applyHalal(S.foods, el.checked));
  await saveAndRefresh(el.checked ? 'Halal activé' : 'Halal désactivé');
});
on('set-words', async (el) => {
  S.settings.motsExclus = el.value.split(',').map((w) => w.trim()).filter(Boolean);
  await saveAndRefresh();
});
on('set-goal', async (el) => {
  const v = parseNum(el.value);
  if (!v || v <= 0) { toast('Valeur invalide', 'warn'); return; }
  const all = skills();
  all[el.dataset.s].stages[Number(el.dataset.i)].goal = v;
  await setKV('skills', all);
  toast('Objectif modifié', 'ok');
});
on('adj-reset', async () => {
  if (!(await confirmBox('Remettre les ajustements de calories à 0 ?', { ok: 'Remettre à 0' }))) return;
  S.settings.kcalAjust = 0;
  await saveAndRefresh();
});
on('test-sound', () => { unlockAudio(); setTimeout(() => beep(3), 50); });

// ---------- Sauvegarde ----------
async function markExported() {
  await setKV('lastExport', new Date().toISOString());
  rerender();
}

export function exportBackup() {
  const json = JSON.stringify(exportData(), null, 1);
  const name = `forge-sauvegarde-${today()}.json`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    markExported();
    toast('Fichier de sauvegarde créé', 'ok');
  };
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Sauvegarde Forge' })
        .then(() => { markExported(); toast('Sauvegarde partagée ✓ (choisis « Enregistrer dans Fichiers »)', 'ok'); })
        .catch((err) => { if (err && err.name !== 'AbortError') download(); });
      return;
    }
  } catch { /* on passe au téléchargement */ }
  download();
}
on('backup-export', () => exportBackup());
on('backup-import', () => document.getElementById('backup-file').click());
on('backup-file', async (el) => {
  const file = el.files?.[0];
  el.value = '';
  if (!file) return;
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { toast('Fichier illisible', 'warn'); return; }
  const err = checkBackup(obj);
  if (err) { toast(err, 'warn'); return; }
  const d = obj.data;
  const count = (k) => (Array.isArray(d[k]) ? d[k].length : 0);
  const when = obj.exportedAt ? new Date(obj.exportedAt).toLocaleString('fr-FR') : 'date inconnue';
  if (!(await confirmBox(`Sauvegarde du ${esc(when)} : ${count('weights')} pesées, ${count('workouts')} séances, ${count('journal')} aliments saisis, ${count('foods')} aliments en base.<br><br><b>Toutes les données actuelles seront remplacées.</b>`, { ok: 'Restaurer', danger: true, title: 'Restaurer la sauvegarde' }))) return;
  try {
    await importData(obj);
    toast('Sauvegarde restaurée ✓', 'ok');
    location.hash = '#accueil';
    rerender();
  } catch (e) {
    toast('Échec de la restauration : ' + e.message, 'warn');
  }
});
on('wipe', async () => {
  if (!(await confirmBox('Effacer TOUTES tes données (journal, pesées, séances, réglages) ? Fais d\'abord une sauvegarde !', { ok: 'Continuer', danger: true }))) return;
  if (!(await confirmBox('Dernière confirmation : tout effacer définitivement ?', { ok: 'Tout effacer', danger: true }))) return;
  await wipeAll();
  location.hash = '';
  location.reload();
});
