# CLAUDE.md — Délices Étoiles

> Fichier de mémoire de projet lu automatiquement par Claude Code à chaque session.
> Il décrit le projet, les conventions **à respecter impérativement**, l'architecture, l'état d'avancement et le déploiement.

---

## 1. Vue d'ensemble

**Délices Étoiles** est une PWA de **restaurant & traiteur** à Abidjan (Côte d'Ivoire).
Développeur : **Sorel**. Communication en **français**.

- Projet Firebase : `delices-etoiles`
- GitHub : `ksorel/delices-etoiles`
- Production : `https://delices-etoiles.web.app`
- Multi-établissements : Grand-Bassam, Abobo, Ebimpé + un **Traiteur central** (transverse).

## 2. Stack & environnement

- **Front** : modules **ES6 vanilla** (pas de framework, pas de bundler).
- **Backend** : Firebase — Firestore, Auth, Storage, **Cloud Functions v1** région `europe-west1`, Hosting.
- **OS de dev** : Windows 11 + PowerShell. Claude Code tourne en natif (WSL installé mais non configuré).
- **Déploiement** : via `npx firebase-tools ...` — **PAS de CLI Firebase globale**. `git push` ne déploie PAS.
- **Test** : toujours en **navigation privée** (le Service Worker met `.js`/`.html` en cache ~1 an).

## 3. Arborescence des fichiers

```
public/
  index.html            # portail client (point d'entrée)
  admin.html            # back-office PROPRIÉTAIRE uniquement
  dashboard.html        # dashboard STAFF (par rôle)
  js/
    app.js              # logique client (accueil, menu, panier, checkout, réservation, sur place)
    db.js               # accès Firestore (fetch/submit/listen)
    i18n.js             # traductions FR/EN
    (config.js, fcm.js, order.js, upselling.js … importés par app.js)
  css/
    app.css             # portail client
    dashboard.css       # dashboard staff
    onboarding.css      # onboarding / assistant IA
  img/                  # accueil-1/2/3.jpg (démos carrousel), logos, etc.
functions/
  index.js             # Cloud Functions (createEmployee, updateEmployeeRole, triggers…)
firestore.rules        # règles Firestore (racine)
storage.rules          # règles Storage (racine)
scripts/               # backfill-restoid.js, bootstrap-owner.js, seed-restos.js
```

## 4. Conventions de code — À RESPECTER IMPÉRATIVEMENT

1. **Apostrophes dans les `onclick` en concaténation de chaînes** : utiliser `\x27` (jamais `'`).
   Exemple : `onclick="window.Admin.editLieu(\x27' + id + '\x27)"`.
2. **Apostrophes dans les template literals** (backticks) : apostrophe réelle `'` directement.
3. **Jamais de template literals imbriqués** dans les fonctions de rendu : préférer la concaténation de chaînes.
4. **`window.Admin.X` / `window.App.X`** : les handlers doivent être définis **APRÈS** l'objet littéral `window.Admin` / `window.App`.
5. **Validation systématique** de chaque module avant livraison :
   ```bash
   # extraire le <script type="module"> puis :
   node --check --input-type=module -
   # ou pour un .js pur :
   node --check app.js
   ```
6. **Pas de sur-ingénierie** : livrer par petits blocs sûrs, valider, puis enchaîner. Ne jamais empiler
   plusieurs gros changements risqués (surtout auth/claims) dans une seule livraison.
7. **Toujours proposer avant de coder** les fonctionnalités importantes, puis coder après validation.
8. **Échapper tout texte libre saisi par le client** avant de l'injecter dans `innerHTML` (nom, note,
   commentaire, adresse…) via une fonction `escapeHtml()` — présente dans `app.js` **et** `dashboard.html`
   (le dashboard affiche des champs écrits par des clients anonymes : réservations, commandes, livraison).
9. **`.gitignore` doit rester en UTF-8 sans BOM.** PowerShell (`Out-File`/`Add-Content` sans `-Encoding utf8`)
   écrit en UTF-16 par défaut ; un `.gitignore` partiellement UTF-16 rend ses dernières lignes invisibles
   pour Git (motifs ignorés silencieusement). Toujours vérifier après modif : `git check-ignore -v <fichier>`.

## 5. Architecture

### Multi-établissements (modèle « pooled »)
- Chaque document porte un champ **`restoId`** ; les requêtes filtrent via `where('restoId','==',x)`.
- Établissements dans la collection **`restos/{restoId}`** :
  `{ nom, nomCourt, commune, adresse, mapUrl, facebookUrl, whatsapp, logoUrl, actif, ordre, updatedAt }`.
- **Traiteur** central : `restoId = 'traiteur'`, transverse, ne change pas.
- Config par établissement : **`config/{restoId}`** (paiements, contacts, `orderExpiryHours`).
  Le client lit `config/{restoId}` (fallback `config/restaurant`).
- Carrousel d'accueil **global** : doc **`config/accueil`** `{ actif, slides:[{url,path,ordre}] }`
  (lu AVANT l'auth anonyme → règle Firestore en lecture publique).
- Plan de salle : doc **`layout-{restoId}`** ; carrousel plat du jour : **`menu-du-jour-{restoId}`**.
- Préfixe des n° de commande = 3 premières lettres du `restoId` en majuscules (BAS-, ABO-, EBI-, TRA-).

### Rôles (multi-rôles)
- Un employé peut avoir **plusieurs rôles**. Custom claims = `{ role: <principal>, roles: [...], restoId }`.
  - `role` (principal) est **conservé pour la sécurité** (règles Firestore `isAdmin()`/`isStaff()`, `checkAdminOrManager` des functions).
  - `roles[]` sert à l'**affichage/permissions** du dashboard (union des vues).
  - **PROPRIÉTAIRE (`admin`)** = global, exclusif, sans `restoId`.
- Rôles : `admin` (propriétaire), `manager` (gérant), `serveur`, `bar`, `cuisine`, `livreur`, `caissier`.
- Le dashboard fait l'**union** des onglets/cases de synthèse/permissions de tous les rôles ; le plan de salle
  n'est masqué que si **tous** les rôles le masquent.
- **admin.html = PROPRIÉTAIRE uniquement**. ⚠️ Le `onAuthStateChanged` de l'admin ne fait **PAS** de `signOut`
  passif (admin et dashboard **partagent la même session Firebase** ; un signOut passif déconnectait le dashboard).
  Il masque simplement l'UI admin.

### Ordre de déploiement sûr pour les changements de claims/règles
custom claims d'abord → écritures de données → backfill → règles strictes → changements UI.

## 6. État d'avancement (fait)

- **Multi-établissements** : page admin **Établissements** (CRUD : nom court, Google Maps, Facebook, WhatsApp, logo,
  activer/désactiver) ; sélecteur d'établissement ; colonne/puce « 📍 Lieu » dans les tableaux en mode « Tous » ;
  script `scripts/backfill-restoid.js` (estampille `restoId` sur les données existantes, y compris `employees`
  non-propriétaires).
- **Carrousel d'accueil paramétrable** (admin) : upload Storage `accueil/`, normalisation auto (paysage + fond flou +
  compression), max 5 images, interrupteur d'activation ; 3 images de démo par défaut.
- **Portail client** : accueil avec bandeau carrousel compact, liste d'établissements (logo si présent, sinon 🍽️,
  liens **Facebook/WhatsApp officiels** en SVG, lien 📍 Google Maps), calligraphie « Great Vibes ».
  Choix de service après l'établissement : **Livraison / Sur place / Réserver**. Service **Traiteur** en carte séparée.
- **Paiement** : espèces **en salle uniquement** ; en **livraison**, uniquement paiement mobile (Wave/OM/MTN) avec
  mention « paiement à l'avance » ; montant modale = sous-total + livraison (bug corrigé) ; reprise du paiement après
  actualisation (écran de confirmation + bouton « Revoir le paiement »).
- **Articles « sur place uniquement »** (emballage consigné) : masqués en livraison (et non suggérés en upselling).
- **Dashboard par rôle** : onglets, cases de synthèse, permissions et badges filtrés par rôle ; **expiration des
  commandes** non traitées (statut « expirée » calculé côté client, filtre dédié, délai paramétrable `orderExpiryHours`,
  défaut 2h, 0 = jamais, jamais supprimé) ; contact du responsable par établissement (post-login) ; n° de commande
  préfixés par établissement.
- **Multi-rôles** : functions (`createEmployee`, `updateEmployeeRole` acceptent `roles[]`), admin en multi-sélection
  (puces, Propriétaire exclusif), dashboard union des vues. Rétrocompatible avec l'ancien rôle unique.
- **Réservation + pré-commande sur place (MVP)** :
  - Réservation → collection **`reservations`** `{ restoId, tenantId, nom, telephone, date, heure, personnes, note,
    status:'pending', createdAt }` ; dashboard onglet **📅 Réservations** (Confirmer/Refuser, statuts pending/confirmed/refused).
  - Commande **sur place** → type `surplace` dans `commandes` `{ nom, telephone, personnes, note, surplace:{date,heure,personnes},
    items, total, operateur:'especes' }` ; paiement à l'arrivée ; badge « 🍽️ Sur place · heure » sur la carte staff.
  - Règle Firestore `reservations` ajoutée (create par le client, read/update par le staff, delete par l'admin).

## 7. Collections Firestore (principales)

`restos`, `config` (dont `config/accueil`, `config/{restoId}`), `menus`, `zones-livraison`, `upselling-rules`,
`commandes` (types `salle` | `livraison` | `surplace`), `reservations`, `paiements`, `depenses`, `stocks`,
`plat-du-jour`, `employees`, `floor-plan` (docs `layout-{restoId}`), collections traiteur (devis, zones-traiteur…).

## 8. Cloud Functions (functions/index.js) — points clés

- `createEmployee(email, password, roles|role, restoId, …)` : crée l'utilisateur Auth + pose les claims
  `buildRoleClaims(roles, restoId)` + doc `employees`. `checkAdmin(context)` requis (appelant = admin).
- `updateEmployeeRole(uid, roles|role, restoId)` : met à jour les claims + doc `employees`.
- `buildRoleClaims(input, restoId)` : `input` = string ou tableau ; retourne `{ role, roles, restoId }`
  (admin → `{ role:'admin', roles:['admin'] }`, global).
- Trigger de notification WhatsApp sur nouvelle commande.
- **Toute modif des functions nécessite un redéploiement `--only functions`.**

## 9. Commandes de déploiement

```powershell
cd ~\delices-etoiles

# 1) Commit
git add .
git commit -m "..."
git push origin main

# 2) Déploiement — RÈGLES d'abord, puis FUNCTIONS (si claims/rôles touchés), puis HOSTING
npx firebase-tools deploy --only firestore:rules
npx firebase-tools deploy --only storage
npx firebase-tools deploy --only functions
npx firebase-tools deploy --only hosting

# (ou tout d'un coup, mais l'ordre ci-dessus est plus sûr pour les changements de règles/claims)
```

### Backfill des données existantes (si des docs n'ont pas de restoId)
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = ".\scripts\serviceAccountKey.json"
node .\scripts\backfill-restoid.js          # simulation (dry-run)
node .\scripts\backfill-restoid.js --apply  # applique
```

## 10. Pistes suivantes possibles

- Rôle **« personnalisé » paramétrable** (Phase 2 du multi-rôles : le propriétaire coche les modules autorisés).
- **Notifications automatiques** de confirmation (FCM/WhatsApp) pour les réservations.
- **Créneaux horaires / disponibilité** de tables (au-delà de l'heure libre + confirmation manuelle).
- Statut **« paiement à confirmer »** côté staff pour les commandes mobiles non réglées (badge + bouton « paiement reçu »).
- **Contact de l'écran de connexion** du dashboard rendu configurable (numéro propriétaire global).
- Harmoniser éventuellement le **nom court** côté client (cartes de l'accueil).

## 11. Workflow attendu de Claude Code

1. Lire l'état réel des fichiers avant toute modif.
2. Pour une fonctionnalité importante : **proposer l'approche, attendre validation, puis coder**.
3. Respecter les conventions §4. **Valider** chaque module (`node --check`) avant de conclure.
4. Livrer par **petits blocs sûrs** ; ne pas mélanger un gros changement d'auth avec autre chose.
5. Terminer par les **commandes de déploiement** concernées + un **plan de test** en navigation privée.
