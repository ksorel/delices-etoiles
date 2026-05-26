# ⭐ Délices Étoiles — Plateforme Digitale

Restaurant Délices Étoiles · Grand-Bassam, Côte d'Ivoire

**URL Production** : https://delices-etoiles.web.app  
**Firebase Project** : `delices-etoiles`

---

## Stack technique

- **Frontend** : HTML5 / JS ES6 modules (vanilla, no framework)
- **Backend** : Firebase (Firestore, Auth, Hosting, Storage, Functions Node.js 22)
- **CI/CD** : GitHub Actions → Firebase Hosting

---

## Structure du projet

```
public/
  admin.html          ← Back-office gérant
  dashboard.html      ← Dashboard staff temps réel
  index.html          ← PWA client (menu + commandes)
  sw.js               ← Service Worker (v8)
  firebase-messaging-sw.js
  css/
    app.css           ← Styles PWA client
    dashboard.css     ← Styles dashboard staff
    onboarding.css    ← Tour guidé + assistant IA
  js/
    app.js            ← Logique PWA (carrousel, panier, sessions)
    db.js             ← Couche Firestore
    order.js          ← Commandes + paiements
    onboarding.js     ← Tour guidé interactif
    assistant.js      ← Chat IA Claude (admin)
    upselling.js      ← Suggestions automatiques
    i18n.js           ← Traductions FR/EN
    fcm.js            ← Notifications push
functions/
  index.js            ← Cloud Functions (FCM, stocks)
scripts/
  set-role.js         ← Assigner rôle Firebase Auth
  seed.js             ← Données de test
```

---

## Déploiement

```bash
# Hosting uniquement
npx firebase-tools deploy --only hosting

# Complet (hosting + règles + fonctions)
npx firebase-tools deploy --only hosting,firestore:rules,functions
```

## Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| `admin` | Back-office + Dashboard + Commande serveur |
| `serveur` | Dashboard + Commande serveur |
| `bar` | Dashboard + Commande serveur |
| `cuisine` | Dashboard lecture seule |
| `livreur` | Dashboard lecture seule |

```bash
node scripts/set-role.js email@exemple.com admin
```

---

## Mobile Money configurés

- Wave CI : **0759731911**
- Orange Money CI : **0759731911**
- MTN MoMo : à configurer

---

## Reste à faire avant lancement

- [ ] Clé VAPID FCM dans `public/js/fcm.js`
- [ ] Webhooks Wave + Orange Money + MTN
- [ ] WhatsApp Business API
- [ ] Photos des plats (Admin → Menu)
- [ ] Impression + pose QR Codes tables
- [ ] Programme de fidélité (paliers à définir)
- [ ] Icônes PWA : `icon-192.png` et `icon-512.png`
