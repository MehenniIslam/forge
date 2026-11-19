# Guide : envoyer tes données Apple Santé dans l'app

Une app web (comme Forge) n'a pas le droit de lire l'app Santé directement. On passe donc par l'app **Raccourcis** d'Apple (gratuite, déjà installée sur ton iPhone) :

1. un **raccourci** lit tes 7 derniers jours dans Santé (pas, calories actives, poids, sommeil) et les copie dans le **presse-papiers** ;
2. tu ouvres Forge et tu touches **« Importer depuis Santé »** : l'app lit le presse-papiers, te montre un aperçu, puis enregistre (sans jamais créer de doublon).

Compte **20 à 30 minutes** la première fois. Tu le fais une seule fois.

> **Les noms peuvent varier un peu selon ta version d'iOS** (17, 18 ou 26). Si tu ne trouves pas une action, tape un **mot-clé** dans la barre de recherche des actions (indiqué à chaque étape, par exemple « santé », « répéter », « format »). Entre parenthèses : le nom anglais, si ton iPhone est en anglais.

---

## Avant de commencer : 3 gestes à connaître

- **Ajouter une action** : dans un raccourci, touche la barre **« Rechercher des apps et actions »** en bas (ou **« Ajouter une action »**), tape le mot-clé, puis touche l'action. Elle s'ajoute en bas de la liste.
- **Insérer une variable** dans un champ : touche le champ, puis choisis la variable dans la barre qui apparaît au-dessus du clavier (les variables que tu as nommées toi-même, comme `Jour` ou `Valeur`, y apparaissent). Sinon : touche **« Sélectionner une variable »** ou fais un appui long dans le champ → **« Insérer une variable »**.
- **Changer l'entrée d'une action** : dans une action, les mots en **bleu** sont modifiables. Touche-les pour choisir une autre valeur ou une autre variable.

---

## Partie 1 – Créer le raccourci « Export Santé »

1. Ouvre l'app **Raccourcis**.
2. Onglet **« Raccourcis »** (en bas) → touche le **+** en haut à droite.
3. Touche le nom en haut (« Nouveau raccourci ») → **Renommer** → tape `Export Santé` → **OK**.

Le raccourci a **5 blocs** : Pas, Calories actives, Poids, Sommeil, puis l'assemblage final. Chaque bloc ajoute des lignes de texte dans une variable appelée `Lignes`.

### Bloc A – Les pas (7 derniers jours)

**A1. Action « Rechercher des échantillons de santé »** (*Find Health Samples*) — mot-clé : `échantillons`
- Touche **Type** (en bleu) → choisis **Pas** (parfois « Nombre de pas »).
- Touche **« Ajouter un filtre »** → choisis **Date de début** → règle sur **« au cours des derniers »** → **7** → **jours**.
- Touche **« Regrouper par »** → **Jour**. *Important : c'est ce qui donne le total de la journée, sans compter deux fois l'iPhone et la Watch.*
- **Trier par** : Date de début, **Ordre** : du plus ancien au plus récent (facultatif). **Limiter** : désactivé.

**A2. Action « Répéter avec chaque élément »** (*Repeat with Each*) — mot-clé : `répéter`
- Sur iOS 26 elle s'appelle **« Répéter chaque élément »**.
- Vérifie qu'elle répète avec **Échantillons de santé** (le résultat de A1). Deux lignes apparaissent : le début du bloc et **« Fin de la répétition »**. Les actions A3 à A9 doivent se trouver **entre les deux** (fais-les glisser si besoin).

**A3. Action « Obtenir les détails des échantillons de santé »** (*Get Details of Health Sample*) — mot-clé : `détails`
- Règle-la sur : Obtenir **Date de début** de **Élément de répétition** (sur iOS 26 : **« Répéter l'élément »**).

**A4. Action « Formater la date »** (*Format Date*) — mot-clé : `format`
- Date : le résultat de A3 (déjà sélectionné en général).
- **Format de date** → **Personnalisé**.
- **Chaîne de format** : efface ce qui est écrit et tape exactement `yyyy-MM-dd`

**A5. Action « Définir la variable »** (*Set Variable*) — mot-clé : `variable`
- Nom de la variable : `Jour` · Entrée : **Date formatée** (résultat de A4).

**A6. Action « Obtenir les détails des échantillons de santé »** (encore une fois)
- Règle-la sur : Obtenir **Valeur** de **Élément de répétition** (touche le mot en bleu pour choisir *Élément de répétition* / *Répéter l'élément* au lieu du résultat précédent).

**A7. Action « Définir la variable »**
- Nom : `Valeur` · Entrée : **Détails de l'échantillon de santé** (résultat de A6).

**A8. Action « Texte »** (*Text*) — mot-clé : `texte`
- Tape exactement ceci, en insérant les variables `Jour` et `Valeur` aux endroits indiqués :

```
{"date":"[Jour]","pas":"[Valeur]"}
```

  (`[Jour]` et `[Valeur]` = les variables, pas le texte entre crochets.)

**A9. Action « Ajouter à la variable »** (*Add to Variable*) — mot-clé : `ajouter à la variable`
- Ajouter **Texte** à la variable : tape le nom `Lignes`.

✅ Le bloc A est fini : vérifie que A3 à A9 sont bien à l'intérieur de « Répéter ».

### Bloc B – Les calories actives

Refais **exactement les mêmes actions que le bloc A** (A1 à A9), **après** la « Fin de la répétition » du bloc A, avec 2 différences :
- en **B1**, Type = **Énergie active** (garde **« Regrouper par : Jour »**) ;
- en **B8**, le texte devient :

```
{"date":"[Jour]","kcal_actives":"[Valeur]"}
```

> Astuce : tu peux aussi faire un appui long sur une action → **« Dupliquer »**, puis la déplacer et la modifier.

### Bloc C – Le poids

Mêmes actions que le bloc A, après le bloc B, avec 3 différences :
- en **C1**, Type = **Poids** et **« Regrouper par » : Aucun** (chaque pesée compte ; l'app garde la première de la journée) ;
- en **C8**, le texte devient :

```
{"date":"[Jour]","poids":"[Valeur]"}
```

### Bloc D – Le sommeil

**D1. « Rechercher des échantillons de santé »**
- Type = **Analyse du sommeil** (*Sleep Analysis*).
- Filtre **Date de début** **au cours des derniers 8 jours**. **Regrouper par : Aucun.**

**D2. « Répéter avec chaque élément »** (avec les échantillons de D1). Les actions D3 à D12 vont **à l'intérieur**.

**D3. « Obtenir les détails des échantillons de santé »** : **Date de début** de **Élément de répétition**.

**D4. « Formater la date »** : Format **Personnalisé**, chaîne : `yyyy-MM-dd HH:mm`

**D5. « Définir la variable »** : nom `Debut`, entrée **Date formatée**.

**D6. « Obtenir les détails des échantillons de santé »** : **Date de fin** de **Élément de répétition**.

**D7. « Formater la date »** : Format **Personnalisé**, chaîne : `yyyy-MM-dd HH:mm`

**D8. « Définir la variable »** : nom `Fin`, entrée **Date formatée** (celle de D7).

**D9. « Obtenir les détails des échantillons de santé »** : **Valeur** de **Élément de répétition** (c'est la phase : « Au lit », « Sommeil profond », « Éveillé »…).

**D10. « Définir la variable »** : nom `Valeur`, entrée **Détails de l'échantillon de santé** (résultat de D9).

**D11. « Texte »** :

```
{"debut":"[Debut]","fin":"[Fin]","valeur":"[Valeur]"}
```

  (insère les variables `Debut`, `Fin` et `Valeur`.)

**D12. « Ajouter à la variable »** : Texte → `Lignes`.

> L'app fait le calcul toute seule : elle additionne les phases « endormi », fusionne les plages qui se chevauchent (Watch + iPhone), ignore « Éveillé », et utilise « Au lit » seulement s'il n'y a rien d'autre. La nuit compte pour le jour du réveil.

### Bloc E – Assembler et copier (après toutes les répétitions, tout en bas)

**E1. Action « Combiner le texte »** (*Combine Text*) — mot-clé : `combiner`
- Combiner **Lignes** avec **Personnalisé** → tape une simple virgule `,`

**E2. Action « Texte »** :

```
{"source":"sante","jours":[[Texte combiné]]}
```

  C'est-à-dire : `{"source":"sante","jours":[` puis la variable **Texte combiné** (résultat de E1), puis `]}`.

**E3. Action « Copier dans le presse-papiers »** (*Copy to Clipboard*) — mot-clé : `presse-papiers`
- Entrée : **Texte** (résultat de E2).

**E4. Action « Afficher la notification »** (*Show Notification*) — mot-clé : `notification`
- Tape : `Données prêtes, ouvre l'app et appuie sur Importer`

Touche **OK** (ou ✓) en haut pour enregistrer le raccourci.

### Premier essai (obligatoire)

1. Dans la liste des raccourcis, touche **Export Santé**.
2. iOS demande l'accès à Santé : touche **« Autoriser »** pour chaque type demandé (pas, énergie active, poids, analyse du sommeil). Si une fenêtre propose « Autoriser une fois » / « Toujours autoriser », choisis **Toujours autoriser**.
3. Une notification « Données prêtes… » apparaît.
4. Ouvre **Forge** → **Accueil** → **« ⤓ Santé »** (ou Réglages → **Importer depuis Santé**) → **« Lire le presse-papiers »** → touche **« Coller »** dans la bulle qui apparaît.
5. Vérifie l'aperçu, puis **« Enregistrer »**.

**Pour voir ce que le raccourci produit** : lance-le, ouvre l'app **Notes**, crée une note et colle. Tu dois voir quelque chose comme :

```
{"source":"sante","jours":[{"date":"2026-11-20","pas":"8500"},{"date":"2026-11-20","kcal_actives":"520"},{"date":"2026-11-20","poids":"81,6"},{"debut":"2026-11-19 23:12","fin":"2026-11-20 06:47","valeur":"Sommeil profond"}]}
```

Pas d'inquiétude pour les virgules (« 81,6 »), les espaces (« 8 500 ») ou les guillemets « intelligents » : l'app les comprend.

---

## Partie 2 – Lancer le raccourci chaque soir à 22 h

1. App **Raccourcis** → onglet **« Automatisation »** (en bas).
2. Touche **« Nouvelle automatisation »** (ou le **+** en haut à droite ; sur d'anciennes versions : **« Créer une automatisation personnelle »**).
3. Choisis **« Heure de la journée »**.
4. Règle l'heure sur **22:00** et la répétition sur **« Quotidienne »** (tous les jours).
5. Choisis **« Exécuter immédiatement »** (sur d'anciennes versions : désactive **« Demander avant d'exécuter »** puis touche **« Ne pas demander »**). Tu peux désactiver **« Me notifier lors de l'exécution »** : ton raccourci envoie déjà sa propre notification.
6. Touche **« Suivant »**.
7. Dans **« Mes raccourcis »**, choisis **Export Santé**. (Si iOS propose « Nouveau raccourci vide », choisis plutôt ton raccourci existant.)
8. Touche **« OK »**.

À 22 h, tu reçois : **« Données prêtes, ouvre l'app et appuie sur Importer »**. Ouvre Forge → **Importer depuis Santé**.

> **Limite d'iOS à connaître** : quand l'iPhone est **verrouillé**, les données Santé sont protégées et le raccourci peut ne rien trouver. Si l'aperçu de l'app dit « Aucune donnée », lance simplement le raccourci depuis le **widget** (partie 3) puis réimporte. Aucun doublon ne sera créé.
>
> Le presse-papiers ne contient qu'une chose à la fois : si tu copies autre chose entre 22 h et l'import, relance le raccourci.

---

## Partie 3 – Ajouter le raccourci en widget sur l'écran d'accueil

1. Sur l'écran d'accueil, fais un **appui long sur un espace vide** jusqu'à ce que les icônes tremblent.
2. Touche **« Modifier »** en haut à gauche puis **« Ajouter un widget »** (sur certaines versions : le **+** en haut à gauche).
3. Cherche et touche **« Raccourcis »**.
4. Choisis le **petit widget** (un seul raccourci), puis **« Ajouter le widget »**.
5. Le widget apparaît. Touche-le (toujours en mode édition) ou fais un appui long dessus → **« Modifier le widget »** → **Raccourci** → choisis **Export Santé**.
6. Touche en dehors du widget, puis **« OK »** en haut à droite.

Place l'icône **Forge** juste à côté : **1 tap** sur le widget, **1 tap** sur Forge, **Importer** → terminé.

---

## Dépannage

| Problème | Solution |
|---|---|
| « Le presse-papiers est vide » | Lance le raccourci (widget), puis réessaie l'import. |
| « JSON illisible » / mauvais format | Ouvre Notes et colle pour voir le texte. Vérifie les accolades `{ }` et crochets `[ ]` des actions Texte (A8, B8, C8, D11, E2). |
| La bulle « Coller » n'apparaît pas | Dans la fenêtre d'import, fais un appui long dans la zone de texte → **Coller** → **Analyser**. |
| Pas de sommeil | Il faut une Apple Watch, une app de sommeil, ou un horaire de sommeil (Santé → Sommeil). |
| Poids en livres | Santé → Parcourir → Mensurations → Poids → change l'unité en kg. |
| Des « ” » bizarres dans le texte | L'app les accepte. Pour les éviter : Réglages → Général → Clavier → désactive **Ponctuation intelligente**. |
| Le raccourci s'arrête avec une erreur Santé | Réglages → Santé → Accès aux données et appareils → Raccourcis → tout activer. |

## Format accepté par l'app (pour les curieux)

- Le format simple du cahier des charges marche aussi : `{"source":"sante","jours":[{"date":"2026-11-20","pas":8500,"poids":81.6,"sommeil":7.5,"kcal_actives":520}]}`
- Plusieurs lignes pour la même date sont **fusionnées**.
- Une date déjà présente dans l'app est **mise à jour**, jamais dupliquée.
- Une donnée manquante est simplement ignorée.
- Le poids importé ne remplace **jamais** une pesée que tu as saisie à la main ce jour-là.
