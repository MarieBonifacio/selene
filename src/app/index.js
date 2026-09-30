/* L'application, chargée par build.py dans platform.ready (quand le stockage est lisible). L'ordre des lignes est
   l'ordre d'évaluation : app d'abord (il tire store, types, auth, assistant… dont les registres), boot en dernier,
   qui démarre la page. Tout ce qui est exporté ici forme l'espace de noms `__selene`, que seuls les tests lisent
   (tests/app.test.js) : la page elle-même ne l'expose pas. */
export * from "./registry.js";
export * from "./app.js";
export * from "./store.js";
export * from "./auth.js";
export * from "./passeur.js";
export * from "./dehors.js";
export * from "./types.js";
export * from "./assistant.js";
export * from "./boot.js";
export * from "../core/index.js";
