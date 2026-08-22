# CLAUDE.md — Délices Étoiles

> Fichier de mémoire de projet lu automatiquement par Claude Code à chaque session.
> Il décrit le projet, les conventions **à respecter impérativement**, l'architecture, l'état d'avancement et le déploiement.

---

## 1. Vue d'ensemble

**Délices Étoiles** est une PWA de **restaurant & traiteur** à Abidjan (Côte d'Ivoire).
Développeur : **Sorel**. Communication en **français**.

- Projet Firebase : `delices-etoiles`
- GitHub : `ksorel/delices-etoiles`
- Production : `https://delices-etoiles.ci` (domaine personnalisé ; `https://delices-etoiles.web.app` reste actif en parallèle)
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
   `admin.html` a l'équivalent `escapeAdminHtml()` — un vrai XSS stocké a déjà été trouvé et corrigé (audit du
   2026-08-20) sur des champs client anonymes affichés sans échappement dans les devis/candidatures.
9. **URL saisie par un client/gérant utilisée en attribut `href`** (fichier joint devis, CV candidature, lien
   Facebook/Maps d'un établissement…) : l'échappement HTML seul ne bloque pas un schéma `javascript:`/`data:` —
   passer par `safeUrl()` (présente dans `admin.html`, `app.js` **et** `dashboard.html`) qui n'autorise que
   `http(s)://`, sinon neutralise le lien (`#`). Un audit du 2026-08-22 a trouvé plusieurs points (footer,
   en-tête, carte établissement) où ni `escapeHtml()` ni `safeUrl()` n'étaient appliqués — toujours vérifier
   les DEUX (texte affiché **et** URL) quand on ajoute un champ géré par un compte non-propriétaire.
10. **`.gitignore` doit rester en UTF-8 sans BOM.** PowerShell (`Out-File`/`Add-Content` sans `-Encoding utf8`)
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
  actualisation (écran de confirmation + bouton « Revoir le paiement »). Côté staff : statut `paymentStatus:
  'awaiting_payment'` posé automatiquement par le client pour toute commande mobile money (salle ou livraison,
  `order.js`) ; dashboard avec onglet dédié **💳 Paiement à confirmer** (compteur), badge sur la carte commande
  (🔴 à confirmer / ❌ échec), bouton **✓ Paiement reçu** (`confirmPayment`) qui bascule sur `paid`.
- **Articles « sur place uniquement »** (emballage consigné) : masqués en livraison (et non suggérés en upselling).
- **Dashboard par rôle** : onglets, cases de synthèse, permissions et badges filtrés par rôle ; **expiration des
  commandes** non traitées (statut « expirée » calculé côté client, filtre dédié, délai paramétrable `orderExpiryHours`,
  défaut 2h, 0 = jamais, jamais supprimé) ; contact du responsable par établissement (post-login) ; n° de commande
  préfixés par établissement.
- **Multi-rôles** : functions (`createEmployee`, `updateEmployeeRole` acceptent `roles[]`), admin en multi-sélection
  (puces, Propriétaire exclusif), dashboard union des vues. Rétrocompatible avec l'ancien rôle unique.
- **Rôle « personnalisé » paramétrable** (Phase 2 multi-rôles) : rôle `custom` sélectionnable comme les autres
  (puce 🎛️ PERSONNALISÉ dans admin.html) ; fait apparaître un panneau où le propriétaire/gérant coche les modules
  autorisés (actions : commandes/encaissement/statut/plan de salle ; onglets visibles ; cases de synthèse visibles),
  stocké dans `employees/{uid}.customPermissions` (sanitizé côté functions par `sanitizeCustomPermissions`) ; lu et
  appliqué au login dashboard (`ROLES_CONFIG.custom`, fusionné avec les autres rôles de l'employé le cas échéant).
- **Réservation + pré-commande sur place (MVP)** :
  - Réservation → collection **`reservations`** `{ restoId, tenantId, nom, telephone, date, heure, personnes, note,
    status:'pending', createdAt }` ; dashboard onglet **📅 Réservations** (Confirmer/Refuser, statuts pending/confirmed/refused).
  - **Créneaux horaires** : réglage par établissement `config/{restoId}.reservation` `{ ouverture, fermeture,
    dureeCreneauMin, capacitePersonnes }` (admin, valeurs par défaut 11h-22h/30min/20 pers. si non configuré) ;
    sélecteur de créneaux côté client (`_generateRvSlots`) qui marque « complet » tout créneau dont les réservations
    existantes atteignent la capacité (`fetchReservationsForDate`) ; re-vérification de la capacité côté client au
    moment de l'envoi (best-effort, ne bloque pas si la vérification échoue en réseau).
  - Commande **sur place** → type `surplace` dans `commandes` `{ nom, telephone, personnes, note, surplace:{date,heure,personnes},
    items, total, operateur:'especes' }` ; paiement à l'arrivée ; badge « 🍽️ Sur place · heure » sur la carte staff.
  - Règle Firestore `reservations` ajoutée (create par le client, read/update par le staff, delete par l'admin).
  - **Notification de confirmation** : trigger `onReservationStatusChange` (functions/index.js) envoie une
    notification FCM au client (✅ confirmée / ❌ refusée) si celui-ci a activé les notifications sur sa
    réservation (`enableReservationNotifications`, jeton stocké sur le doc `reservations`).
- **Contact de l'écran de connexion dashboard configurable** : `restos/{id}.loginContactPhone` par établissement,
  avec repli sur un numéro global (`config/accueil.loginContactPhone`) si l'établissement n'en a pas renseigné.
- **Footer persistant** (portail client, sur toutes les vues) : signature cursive « Great Vibes » + tagline,
  liens **pages légales**, puis bloc **« Nous contacter »** une fois l'établissement identifié (téléphone(s)/
  email `config/{restoId}.contacts`, Google Maps, Facebook, WhatsApp — remplace l'ancienne carte « Nous
  contacter » retirée de l'écran de choix du service, consolidée ici pour être visible sur tous les écrans).
- **Pages légales** (CGV / confidentialité / mentions légales) : contenu global réseau, `config/legal`
  `{ cgv:{fr,en}, confidentialite:{fr,en}, mentions:{fr,en}, updatedAt }` (lecture publique, écriture
  propriétaire uniquement), liens `#legal-cgv` / `#legal-confidentialite` / `#legal-mentions` dans le footer
  (accessibles sans établissement choisi, comme Infos & Actualités) ; texte affiché selon la langue active,
  repli sur le FR si l'anglais n'est pas rempli. Admin → onglet **Pages légales** (propriétaire uniquement) :
  un champ FR + un champ EN par page, texte simple (pas de mise en forme).
- **Statistiques de visiteurs** : compteur journalier par établissement (`stats-visites/{restoId}_{date}`),
  incrémenté côté client (`trackVisit`) une fois l'établissement identifié — 1 fois par jour et par appareil
  (repère `localStorage`), écriture limitée par règle Firestore à un incrément exact de +1 (aucune valeur
  arbitraire possible), lecture réservée au staff. Admin → Statistiques : cases **Visiteurs** et **Taux de
  conversion** (commandes ÷ visiteurs), mêmes période et établissement que le reste de la page.
- **Connexion admin + dashboard** : bouton désactivé + spinner dès le clic (`setBtnBusy`/`clearBtnBusy`,
  présent dans les deux fichiers), réactivé sur tout chemin d'échec (identifiants invalides, timeout, rôle
  non autorisé, lecture du rôle échouée) — évite qu'un utilisateur sur réseau lent pense que rien ne se passe.

## 7. Collections Firestore (principales)

`restos`, `config` (dont `config/accueil`, `config/legal`, `config/{restoId}`), `menus`, `zones-livraison`, `upselling-rules`,
`commandes` (types `salle` | `livraison` | `surplace`), `reservations`, `paiements`, `depenses`, `stocks`,
`plat-du-jour`, `employees`, `floor-plan` (docs `layout-{restoId}`), `stats-visites` (docs `{restoId}_{date}`),
collections traiteur (devis, zones-traiteur…).

## 8. Cloud Functions (functions/index.js) — points clés

- `createEmployee(email, password, roles|role, restoId, …)` : crée l'utilisateur Auth + pose les claims
  `buildRoleClaims(roles, restoId)` + doc `employees`. `checkAdmin(context)` requis (appelant = admin).
- `updateEmployeeRole(uid, roles|role, restoId)` : met à jour les claims + doc `employees`.
- `buildRoleClaims(input, restoId)` : `input` = string ou tableau ; retourne `{ role, roles, restoId }`
  (admin → `{ role:'admin', roles:['admin'] }`, global).
- `onNewOrder` (trigger `commandes` onCreate) : notification WhatsApp (dormant, voir secrets) + décompte
  stock **+ revalidation/correction serveur du total** (2026-08-22, `computeAuthoritativeOrderTotal`) — le
  client écrit directement en Firestore sans passer par une function, donc `item.price`/`total` sont
  déclaratifs ; ce trigger recompare chaque ligne au vrai catalogue (`menu-dispo`/`menus`, formats/variantes)
  et les frais de livraison à la vraie zone (`zones-livraison`), corrige `total` si besoin et trace l'écart
  (`totalOriginal`, `totalCorrigeAt`). Revalide aussi l'éligibilité de la réduction fidélité
  (`computeAuthoritativeLoyalty`, 2026-08-22) : date + % recalculés contre la vraie config
  (`config/{restoId}.loyalty` ou repli `config/fidelite-reseau`) et le vrai statut client (`clients/{tel}`),
  et c'est désormais CE trigger (Admin SDK) qui marque la récompense consommée — le client n'a plus le droit
  d'écrire `clients/{tel}.recompenses` lui-même en Firestore (ancienne règle trop permissive : seule la clé
  était vérifiée, pas la valeur, ce qui permettait de forger une date d'éligibilité arbitraire) — testé en
  conditions réelles (commande falsifiée → corrigée, éligibilité forgée via écriture directe → refusée 403).
- `askAssistant` : prompt système désormais **uniquement côté serveur** (`SYSTEM_PROMPTS` dans
  `functions/index.js`, copie de ceux qui vivaient dans `assistant.js`) — le client envoie juste une clé
  `contextType` (`admin`/`dashboard`/`client`), jamais le texte. Avant le 2026-08-22, un appel direct à
  cet endpoint (auth anonyme suffisante) permettait d'imposer n'importe quel prompt système, détournant le
  crédit API Anthropic du propriétaire.
- `uploadDevisFile`/`uploadCandidatureFile` : fichier stocké **sans** `makePublic()`, URL signée (1 an,
  non devinable) — `uploadDevisFile` utilisait `makePublic()` + nom de fichier basé sur `Date.now()`
  (devinable) jusqu'au 2026-08-22, incohérent avec la règle Firestore qui restreint la lecture du devis à
  l'admin. Corrigé pour utiliser le même mécanisme que `uploadCandidatureFile`.
- **Toute modif des functions nécessite un redéploiement `--only functions`.**
- **Secrets** : `functions.config()` est déprécié (coupure définitive prévue mars 2027) — migré vers
  **Google Secret Manager**, exposé en `process.env.X` via `.runWith({ secrets: [...] })` sur chaque
  function qui en a besoin. Secrets utilisés : `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`,
  `WHATSAPP_STAFF_NUMBERS` (notifs WhatsApp), `EMAIL_USER`/`EMAIL_PASS`/`EMAIL_DEST` (rapport
  quotidien), `ANTHROPIC_KEY` (assistant IA), `PAYMENT_WEBHOOK_SECRET` (webhook paiement — celui-ci
  **doit** être configuré sinon `paymentWebhook` refuse toute requête, fail-closed).
  Pour définir/mettre à jour un secret : `npx firebase-tools functions:secrets:set NOM_DU_SECRET`
  (invite interactive — jamais coller la valeur en clair dans une commande ou un fichier commité).

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

⚠️ La session `npx firebase-tools` (login CLI, différent du service account) expire périodiquement.
Si un déploiement échoue avec `Authentication Error: Your credentials are no longer valid`, relancer
`npx firebase-tools login --reauth` (interactif, ouvre le navigateur — à faire par l'utilisateur, pas
en tâche de fond). Juste après un ré-auth, le premier `deploy` peut échouer avec `Assertion failed:
resolving hosting target of a site with no site name or target name` — ajouter `--project delices-etoiles`
explicitement le temps que le contexte de projet du CLI se stabilise.

### Backfill des données existantes (si des docs n'ont pas de restoId)
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = ".\scripts\serviceAccountKey.json"
node .\scripts\backfill-restoid.js          # simulation (dry-run)
node .\scripts\backfill-restoid.js --apply  # applique
```

## 10. Pistes suivantes possibles

- **Vraie intégration de paiement en ligne** (Wave Business API, CinetPay…) pour remplacer les liens profonds
  mobile money actuels par une confirmation automatique côté serveur (`paymentWebhook`, secret non configuré
  volontairement — voir §8).
- **Firebase App Check** : aucune limite anti-abus sur les écritures anonymes (`commandes`, `devis`,
  `candidatures`, `reservations`, `avis`) au-delà de la limite déjà en place sur `askAssistant`. Décision du
  2026-08-22 : reporté volontairement (aucun abus constaté à ce jour ; App Check demande une config
  reCAPTCHA v3 + une phase de surveillance avant activation stricte, risque de bloquer de vrais visiteurs
  si mal fait) — à réévaluer si un abus réel est observé.

## 11. Workflow attendu de Claude Code

1. Lire l'état réel des fichiers avant toute modif.
2. Pour une fonctionnalité importante : **proposer l'approche, attendre validation, puis coder**.
3. Respecter les conventions §4. **Valider** chaque module (`node --check`) avant de conclure.
4. Livrer par **petits blocs sûrs** ; ne pas mélanger un gros changement d'auth avec autre chose.
5. Terminer par les **commandes de déploiement** concernées + un **plan de test** en navigation privée.
