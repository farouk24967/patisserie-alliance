// Collez ici les 2 valeurs de votre projet Supabase (voir GUIDE.txt).
// Tant qu'elles sont vides, le site fonctionne en MODE ESSAI (données sur cet appareil seulement).
// N'utilisez JAMAIS la clé "secret" ou "service_role".
window.CONFIG = {
  SUPABASE_URL: "https://bzzugzmxijyqylbzahue.supabase.co",
  SUPABASE_KEY: "sb_publishable_VYrlTjChHkEkkgDYEpYu3w_wdinftKX"   // clé "publishable" (sb_publishable_...)
};

// Informations du magasin. Une valeur vide masque l'élément sur le site.
window.SITE = {
  TELEPHONE: "0541 41 30 42",
  EMAIL: "patisserieallince1@gmail.com",
  WHATSAPP: "213541413042",    // format international sans +, ex. 213XXXXXXXXX
  FACEBOOK: "",    // lien complet de la page
  INSTAGRAM: "",
  TIKTOK: "",
  AVIS_GOOGLE: "", // lien "laisser un avis"
  // Horaires : 0 = dimanche ... 6 = samedi. Exemple : { 0: [["09:00","12:30"],["14:00","20:00"]], 5: [] }
  HORAIRES: null
};
