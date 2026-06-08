// ════════════════════════════════════════════════════════════
//  i18n — Traductions FR / EN
//  Usage : t('key') → string dans la langue courante
// ════════════════════════════════════════════════════════════

const translations = {
  fr: {
    // Header
    mode_salle:        'Table',
    mode_livraison:    'Livraison',
    banner_salle:      'Commande en salle · ',
    banner_table:      'Table',
    banner_livraison:  'Livraison à domicile',

    // Menu
    loading:           'Chargement du menu…',
    unavailable:       'Indisponible',
    all:               'Tout',
    cat_plats:         'Plats',
    cat_boissons:      'Boissons',
    cat_accompagnements: 'Accompagnements',
    cat_desserts:      'Desserts',
    cat_entrees:       'Entrées',
    cat_riz:           'Riz',
    cat_volailles:     'Volailles',
    cat_poissons:      'Poissons',
    cat_spaghetti:     'Spaghetti',
    cat_viandes:       'Viandes',
    cat_jus:           'Jus Naturels',
    cat_bieres:        'Bières',
    cat_spiritueux:    'Spiritueux',
    cat_eaux:          'Eaux & Sodas',
    prix_variable:     'Prix sur devis',
    add_to_cart:       'Ajouter au panier',
    fcfa:              'FCFA',

    // Options
    opt_glace:         'Glaçons',
    opt_oui:           'Oui',
    opt_non:           'Non',
    opt_format:        'Portion',
    opt_petit:         'Demi',
    opt_grand:         'Entier',
    opt_comment:       'Commentaire (optionnel)',
    comment_placeholder: 'Instructions spéciales…',

    // Upselling
    upsell_accomp:     'Ajouter un accompagnement ?',
    upsell_boisson:    'Ajouter une boisson ?',

    // Cart
    cart_title:        'Mon panier',
    cart_empty:        'Votre panier est vide',
    cart_empty_sub:    'Parcourez notre menu et ajoutez vos plats préférés.',
    cart_back:         'Voir le menu',
    qty:               'Qté',
    remove:            'Supprimer',
    subtotal:          'Sous-total',
    delivery_fee:      'Livraison',
    total:             'Total',
    order_btn_salle:   'Commander',
    order_btn_liv:     'Passer la commande',

    // Checkout
    checkout_title:    'Finaliser la commande',
    your_order:        'Votre commande',
    delivery_info:     'Informations de livraison',
    nom:               'Nom complet',
    telephone:         'Téléphone',
    adresse:           'Adresse de livraison',
    zone:              'Zone',
    select_zone:       '— Sélectionner la zone —',
    payment_title:     'Moyen de paiement',
    confirm_salle:     'Valider et commander',
    payment_especes:   'Paiement en espèces',
    payment_mobile:    'Paiement Mobile Money',
    payment_pending:   'En attente de paiement',
    confirm_especes:   'Paiement reçu — Merci !',
    confirm_mobile_salle: 'Commande envoyée !',
    sub_especes:       'Votre commande est transmise à la cuisine. Le paiement en espèces sera collecté à votre table.',
    sub_mobile_salle:  'Votre commande est transmise à la cuisine. Procédez au paiement Mobile Money.',
    confirm_liv:       'Payer et commander',

    // Confirmation
    confirm_title_salle: 'Commande envoyée !',
    confirm_title_liv:   'Commande confirmée !',
    confirm_sub_salle:   'L\'équipe prépare vos plats. Le règlement se fait en fin de repas.',
    confirm_sub_liv:     'Votre commande est en cours de préparation. Vous serez contacté(e) pour la livraison.',
    order_number:        'Commande n°',
    back_menu:           'Retour au menu',

    // Errors
    err_required:       'Veuillez remplir tous les champs obligatoires.',
    err_comment_long:   'Le commentaire ne peut pas dépasser 100 caractères.',
    err_order:          'Une erreur est survenue. Réessayez.',
    added_toast:        'Ajouté au panier ✓',

    // Traiteur
    tab_restaurant:     'Restaurant',
    tab_traiteur:       'Traiteur',
    traiteur_title:     'Service Traiteur',
    traiteur_subtitle:  'Mariages, baptêmes, séminaires, repas entreprise…<br>Nous préparons votre événement sur mesure.',
    tr_event_type:      "Type d'événement *",
    tr_date:            'Date *',
    tr_nb_persons:      'Nb personnes *',
    tr_lieu:            'Lieu *',
    tr_besoins:         'Vos besoins',
    tr_besoins_ph:      'Décrivez vos besoins : menu souhaité, service, décoration, allergies…',
    tr_contact_title:   '📞 Vos coordonnées',
    tr_nom_ph:          'Nom complet',
    tr_tel_ph:          'Téléphone / WhatsApp',
    tr_email_ph:        'Email (optionnel)',
    tr_send_btn:        '📨 Envoyer ma demande de devis',
    tr_footer_note:     'Nous vous recontactons sous 24h pour préparer votre devis personnalisé.',
    tr_confirm_title:   'Demande envoyée !',
    tr_confirm_msg1:    'Nous vous recontactons sous 24h au',
    tr_back_menu:       '← Retour au menu',
    tr_ev_mariage:      '💍 Mariage',
    tr_ev_bapteme:      "👶 Baptême",
    tr_ev_anniversaire: '🎂 Anniversaire',
    tr_ev_entreprise:   '🏢 Repas entreprise',
    tr_ev_seminaire:    '📊 Séminaire',
    tr_ev_autre:        '✨ Autre événement',
  },

  en: {
    mode_salle:        'Table',
    mode_livraison:    'Delivery',
    banner_salle:      'Dine-in · ',
    banner_table:      'Table',
    banner_livraison:  'Home delivery',

    loading:           'Loading menu…',
    unavailable:       'Unavailable',
    all:               'All',
    cat_plats:         'Mains',
    cat_boissons:      'Drinks',
    cat_accompagnements: 'Sides',
    cat_desserts:      'Desserts',
    cat_entrees:       'Starters',
    cat_riz:           'Rice',
    cat_volailles:     'Poultry',
    cat_poissons:      'Fish',
    cat_spaghetti:     'Spaghetti',
    cat_viandes:       'Meats',
    cat_jus:           'Natural Juices',
    cat_bieres:        'Beers',
    cat_spiritueux:    'Spirits',
    cat_eaux:          'Water & Sodas',
    prix_variable:     'Price on request',
    add_to_cart:       'Add to order',
    fcfa:              'FCFA',

    opt_glace:         'Ice',
    opt_oui:           'Yes',
    opt_non:           'No',
    opt_format:        'Portion',
    opt_petit:         'Half',
    opt_grand:         'Full',
    opt_comment:       'Comment (optional)',
    comment_placeholder: 'Special instructions…',

    upsell_accomp:     'Add a side dish?',
    upsell_boisson:    'Add a drink?',

    cart_title:        'My order',
    cart_empty:        'Your basket is empty',
    cart_empty_sub:    'Browse our menu and add your favourite dishes.',
    cart_back:         'View menu',
    qty:               'Qty',
    remove:            'Remove',
    subtotal:          'Subtotal',
    delivery_fee:      'Delivery',
    total:             'Total',
    order_btn_salle:   'Place order',
    order_btn_liv:     'Place order',

    checkout_title:    'Checkout',
    your_order:        'Your order',
    delivery_info:     'Delivery information',
    nom:               'Full name',
    telephone:         'Phone number',
    adresse:           'Delivery address',
    zone:              'Zone',
    select_zone:       '— Select zone —',
    payment_title:     'Payment method',
    confirm_salle:     'Validate & order',
    payment_especes:   'Cash payment',
    payment_mobile:    'Mobile Money',
    payment_pending:   'Awaiting payment',
    confirm_especes:   'Payment received — Thank you!',
    confirm_mobile_salle: 'Order sent!',
    sub_especes:       'Your order has been sent to the kitchen. Cash payment will be collected at your table.',
    sub_mobile_salle:  'Your order has been sent to the kitchen. Please proceed with Mobile Money payment.',
    confirm_liv:       'Pay & order',

    confirm_title_salle: 'Order sent!',
    confirm_title_liv:   'Order confirmed!',
    confirm_sub_salle:   'The team is preparing your dishes. You\'ll pay at the end of your meal.',
    confirm_sub_liv:     'Your order is being prepared. We\'ll contact you for delivery.',
    order_number:        'Order #',
    back_menu:           'Back to menu',

    err_required:       'Please fill in all required fields.',
    err_comment_long:   'Comment cannot exceed 100 characters.',
    err_order:          'An error occurred. Please try again.',
    added_toast:        'Added to order ✓',

    // Catering
    tab_restaurant:     'Restaurant',
    tab_traiteur:       'Catering',
    traiteur_title:     'Catering Service',
    traiteur_subtitle:  'Weddings, christenings, seminars, corporate meals…<br>We prepare your event to perfection.',
    tr_event_type:      'Event type *',
    tr_date:            'Date *',
    tr_nb_persons:      'No. of guests *',
    tr_lieu:            'Venue *',
    tr_besoins:         'Your needs',
    tr_besoins_ph:      'Describe your needs: menu, service, decoration, allergies…',
    tr_contact_title:   '📞 Your contact details',
    tr_nom_ph:          'Full name',
    tr_tel_ph:          'Phone / WhatsApp',
    tr_email_ph:        'Email (optional)',
    tr_send_btn:        '📨 Send my quote request',
    tr_footer_note:     'We will get back to you within 24h to prepare your personalised quote.',
    tr_confirm_title:   'Request sent!',
    tr_confirm_msg1:    'We will contact you within 24h at',
    tr_back_menu:       '← Back to menu',
    tr_ev_mariage:      '💍 Wedding',
    tr_ev_bapteme:      '👶 Christening',
    tr_ev_anniversaire: '🎂 Birthday',
    tr_ev_entreprise:   '🏢 Corporate meal',
    tr_ev_seminaire:    '📊 Seminar',
    tr_ev_autre:        '✨ Other event',
  },
};

// État langue courant
let currentLang = 'fr';

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('de_lang', lang);
  document.documentElement.lang = lang;
}

export function getLang() { return currentLang; }

export function t(key) {
  return translations[currentLang]?.[key] ?? translations.fr[key] ?? key;
}

export function itemName(item)  { return item[`name_${currentLang}`] || item.name_fr; }
export function itemDesc(item)  { return item[`description_${currentLang}`] || item.description_fr || ''; }

export function initLang() {
  const saved = localStorage.getItem('de_lang');
  const browser = navigator.language?.startsWith('fr') ? 'fr' : 'en';
  setLang(saved || browser);
}
