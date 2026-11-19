// =============================================================
// Import Apple Santé : presse-papiers → vérification → aperçu → enregistrement sans doublon.
// =============================================================
import { S, putMany } from '../db.js';
import { fmt, fmtDateCourt, esc } from '../util.js';
import { parseHealthText, planHealthImport } from '../calc.js';
import { on, openSheet, closeSheet, toast, rerender } from '../ui.js';

let pending = null;

function pasteSheet(message = '') {
  openSheet('Importer depuis Santé', `
    ${message ? `<div class="alert soft">${message}</div>` : ''}
    <p class="hint">Lance d'abord ton raccourci « Export Santé » (widget ou app Raccourcis). Puis touche le bouton ci-dessous et choisis « Coller » si l'iPhone te le demande.</p>
    <button class="btn primary full big" data-act="sante-read">📋 Lire le presse-papiers</button>
    <p class="hint">Si ça ne marche pas : fais un appui long dans la zone ci-dessous → « Coller », puis « Analyser ».</p>
    <textarea class="input" id="sante-text" rows="5" placeholder='{"source":"sante","jours":[…]}'></textarea>
    <button class="btn ghost full" data-act="sante-parse">Analyser le texte collé</button>
    <a class="link center block" href="#aide/raccourci" data-act="sheet-close-nav">Je n'ai pas encore créé le raccourci → voir le guide</a>`);
}

function analyse(text) {
  const res = parseHealthText(text);
  if (!res.ok) { pasteSheet(`❌ ${esc(res.error)}`); return; }
  const plan = planHealthImport(res.days, S.health, S.weights);
  pending = plan;
  const cell = (v, d = 0, u = '') => (v == null ? '<span class="muted">–</span>' : `${fmt(v, d)}${u}`);
  const wLabel = { ajout: '', maj: '', identique: '', ignore: ' <span class="tag">manuel gardé</span>' };
  const changed = plan.rows.filter((r) => r.status !== 'identique').length;
  openSheet('Aperçu de l\'import', `
    <p class="hint">${plan.rows.length} jour(s) lu(s) · ${changed} nouveau(x) ou mis à jour. Une date déjà présente est mise à jour, jamais dupliquée.</p>
    ${res.warnings.length ? `<div class="alert soft">${res.warnings.map(esc).join('<br>')}</div>` : ''}
    <div class="table-wrap"><table class="table small">
      <tr><th>Date</th><th>Pas</th><th>Sommeil</th><th>kcal act.</th><th>Poids</th><th></th></tr>
      ${plan.rows.map((r) => `<tr class="${r.status === 'identique' ? 'dim' : ''}"><td>${fmtDateCourt(r.date)}</td><td>${cell(r.rec.pas)}</td><td>${cell(r.rec.sommeil, 1, ' h')}</td><td>${cell(r.rec.kcal_actives)}</td>
        <td>${r.rec.poids != null ? fmt(r.rec.poids, 1) + (wLabel[r.weightAction] || '') : '<span class="muted">–</span>'}</td><td><span class="tag ${r.status === 'nouveau' ? 'ok' : ''}">${r.status}</span></td></tr>`).join('')}
    </table></div>
    <button class="btn primary full big" data-act="sante-save" ${changed ? '' : 'disabled'}>${changed ? 'Enregistrer' : 'Rien de nouveau'}</button>
    <button class="btn ghost full" data-act="sante-cancel">Annuler</button>`, { wide: true });
}

export function startImport() {
  pending = null;
  pasteSheet();
}

on('sante-import', () => startImport());
on('sante-read', async () => {
  try {
    if (!navigator.clipboard?.readText) throw new Error('indisponible');
    const text = await navigator.clipboard.readText();
    analyse(text);
  } catch {
    pasteSheet('Impossible de lire le presse-papiers automatiquement. Colle le texte dans la zone ci-dessous (appui long → Coller).');
  }
});
on('sante-parse', () => analyse(document.getElementById('sante-text').value));
on('sante-cancel', () => { pending = null; closeSheet(); });
on('sante-save', async () => {
  if (!pending) return;
  const { healthPuts, weightPuts } = pending;
  await putMany('health', healthPuts);
  await putMany('weights', weightPuts);
  pending = null;
  closeSheet();
  toast(`Import réussi : ${healthPuts.length} jour(s)${weightPuts.length ? `, ${weightPuts.length} pesée(s)` : ''}`, 'ok');
  rerender();
});
on('sheet-close-nav', (el) => { closeSheet(); location.hash = el.getAttribute('href'); });
