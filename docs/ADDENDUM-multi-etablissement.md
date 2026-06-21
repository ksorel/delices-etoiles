# ADDENDUM — Migration Multi-Établissement (Bassam / Abobo / Ebimpé / …)

> À coller à la fin du document de contexte principal. Capture les décisions
> prises et le plan, pour survivre aux redémarrages de container.

## NATURE DU CHANTIER (à ne pas confondre)

Ce n'est **PAS** le multi-tenant SaaS (reporté à un projet séparé). C'est du
**multi-établissement** : un seul propriétaire, une seule marque « Délices
Étoiles », plusieurs lieux. Pas de DNS wildcard, pas de provisioning, pas de
pool d'auth séparé, pas de facturation par client. Un propriétaire qui voit tout.

Le champ `restoId` (déjà présent sur le papier mais **filtré nulle part** dans le
code actuel) est le pivot. Le travail = **l'activer**, pas le créer.

## DÉCISIONS VERROUILLÉES (cette session)

1. **Modèle d'isolation** : on reste en **pooled** (champ `restoId` + filtre dans
   chaque requête), PAS de restructuration en sous-collections `/restos/{id}/…`.
   Justification : ce sont des branches du même propriétaire, une fuite inter-lieu
   est un bug à corriger, pas une faille. Contrepartie acceptée : **ne jamais
   oublier un filtre**.
2. **Traiteur = CENTRAL.** Devis, paiements traiteur, dépenses traiteur, rappels
   `traiteurReminders`, équipe traiteur → transverses, hors découpage par lieu.
3. **Zones — Zone A.** Le traiteur a son **propre jeu de zones** dans une nouvelle
   collection `/zones-traiteur`, indépendante de `/zones-livraison` (qui devient
   par-lieu). La décision #4 de l'historique principal (« le traiteur réutilise les
   zones du restaurant ») est **caduque** : elle datait du mono-resto.
4. **Sentinelle explicite pour le central** : `restoId: 'traiteur'`, jamais
   null/absent. Un filtre oublié devient ainsi visible au lieu de fuiter en silence.

## DÉCISIONS PAR DÉFAUT (proposées, à confirmer ou corriger par Sorel)

- **Comptabilité à 3 portées** : vue par-lieu (resto seul, sans traiteur) +
  vue traiteur (centre de profit à part) + vue consolidée propriétaire (somme).
- **Dépenses traiteur** taguées `restoId: 'traiteur'`, séparées des dépenses resto.
- **Rôles** : propriétaire (voit tout, bascule entre lieux) + managers scopés à
  leur `restoId` (un manager d'Abobo ne voit ni les autres lieux ni le traiteur).
- **Backfill dépenses existantes** → 'bassam' par défaut (à arbitrer si certaines
  étaient en réalité du traiteur).

## CE QUI EST PAR-LIEU vs CENTRAL

| Par établissement (`restoId` = bassam/abobo/ebimpe) | Central |
|---|---|
| menus, plat-du-jour, upselling-rules | devis (+ sous-coll. paiements) |
| zones-livraison | zones-traiteur |
| commandes, sessions, tables | notifications traiteur |
| paiements (resto), config | équipe traiteur |
| dépenses resto, comptabilité resto | logo/marque, i18n |

## BUGS / PIÈGES IDENTIFIÉS

1. **`setPlatDuJour` (db.js)** — BUG RÉEL corrigé : désactivait TOUS les plats du
   jour `active==true` sans filtre de lieu. En multi-lieu, publier le plat de
   Bassam aurait éteint celui d'Abobo et Ebimpé. Désactivation désormais scopée.
2. **`plat-du-jour/menu-du-jour`** — doc à ID fixe → collision. Namespacé en
   `menu-du-jour-{restoId}`. ⚠️ À répercuter dans `admin.html` (écriture du carrousel).
3. **Numéros de table** — la table 5 existe dans chaque lieu. Doc `tables`
   namespacé en `{restoId}-{tableId}`. ⚠️ Les **QR codes** doivent encoder ce
   tableId namespacé (ou restoId + tableId) → régénération des QR.
4. **`config/restaurant`** — doc unique → doit devenir `/config/{restoId}`
   (managerPhone, etc.). Fallback '0759731911' à conserver.

## DELTAS INDEX FIRESTORE (firestore.indexes.json)

`restoId` en **première position** de chaque index resto existant :
- `menus` : restoId ASC, category ASC, order ASC
- `commandes` : restoId+createdAt ; restoId+status+createdAt ; restoId+type+createdAt ; restoId+tableId+createdAt
- `sessions` : restoId+status+createdAt(DESC) ; restoId+tableId+status+createdAt
- `zones-livraison` : restoId ASC, active ASC
- `plat-du-jour` : restoId ASC, active ASC, updatedAt DESC

Traiteur (inchangé pour la Compta) : `collectionGroup('paiements')` filtré
`statut=='confirme'` continue de ne ramener que le traiteur (les paiements resto
n'ont pas de champ `statut`). Le `restoId:'traiteur'` est posé pour l'uniformité.

## DELTAS RÈGLES FIRESTORE (esquisse)

Helper + scoping resto, le central reste tel quel :
```
function rid()        { return request.auth.token.restoId; }
function sameResto()  { return resource.data.restoId == rid(); }
function isOwner()    { return isAdmin() && request.auth.token.role == 'owner'; }

match /commandes/{id} {
  allow read: if isOwner() || (isStaff() && sameResto());
  ...
}
// /devis/** : inchangé (central, gate sur owner / manager traiteur)
```

## PLAN DE PHASES

1. **Backfill** (`backfill-restoid.js`) — pose 'bassam' sur le resto, 'traiteur'
   sur le central. Dry-run par défaut, idempotent. ✅ FOURNI.
2. **Refactor `db.js`** — threading restoId + `setRestoId`/`getRestoId` +
   `fetchZonesTraiteur`. ✅ FOURNI (node --check OK).
3. **Résolveur de lieu** — lire restoId depuis URL/QR au démarrage, appeler
   `setRestoId()`. Défaut 'bassam'. → à ajouter dans `config.js` (ou `location.js`).
4. **Sélecteur de lieu** dans `admin.html` + scoping dashboard par claim restoId.
5. **`renderTraiteur` / `loadTraiteurZones` (app.js)** → basculer sur
   `fetchZonesTraiteur()` au lieu des zones resto.
6. **Namespacer tables** + régénérer QR ; namespacer le carrousel plat-du-jour
   dans admin.html.
7. **Index + règles** réécrits, testés en émulateur.
8. **Comptabilité 3 portées** (renderComptabilite).
9. **Claims staff** : ajouter restoId + rôle 'owner' (createEmployee / setUserRole).
10. **Pilote Abobo** pour débusquer les filtres oubliés, puis Ebimpé.

## TRAVAIL CALLER-SIDE RESTANT (hors db.js, à faire ensuite)

- `config.js` : résolveur restoId (snippet ci-dessous) appelé avant tout fetch.
- `app.js` : passer restoId aux fetch resto ; `renderTraiteur` → `fetchZonesTraiteur`.
- `admin.html` : sélecteur de lieu, carrousel plat-du-jour namespacé, config par lieu.
- `dashboard.html` : `listenOrders`/`listenOpenSessions` scopés au claim restoId.
- `functions/index.js` : `createEmployee`/`setUserRole` posent restoId + role 'owner'.
- QR codes : encoder le tableId namespacé.

### Snippet résolveur (à placer tôt, ex. config.js)
```js
import { setRestoId } from './db.js';
// Priorité : param URL ?resto= / chemin / QR ; défaut 'bassam'.
const params = new URLSearchParams(location.search);
const VALID = ['bassam', 'abobo', 'ebimpe'];
const r = (params.get('resto') || '').toLowerCase();
setRestoId(VALID.includes(r) ? r : 'bassam');
```
