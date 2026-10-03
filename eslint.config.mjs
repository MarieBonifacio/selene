// Analyse statique de chaque module un à un (src/platform.js, src/app, src/core), de l'outillage (scripts), de
// l'amorçage natif, du script de la page de test et du service worker. Un module ne voit que ses imports et les globales déclarées ici : `no-undef`
// fait de chaque dépendance un import explicite.
// Aucune dépendance : seulement les règles intégrées d'eslint, globals déclarés à la main.
const readonly = names => Object.fromEntries(names.map(name => [name, "readonly"]));
// L'interface (src/app) : le DOM, le réseau, les minuteries. Pas le stockage de l'hôte : il passe par platform.
const browser = readonly(["window", "document", "location", "navigator", "fetch", "setTimeout", "clearTimeout",
  "setInterval", "clearInterval", "AbortController", "URL", "URLSearchParams", "Blob", "File", "FormData", "console",
  "DOMParser", "CustomEvent", "Event", "history", "IntersectionObserver", "matchMedia", "requestAnimationFrame",
  "cancelAnimationFrame", "getComputedStyle", "HTMLElement", "Node", "structuredClone", "queueMicrotask", "TextDecoder", "TextEncoder", "crypto"]);
// La plateforme (src/platform.js) : en plus, le stockage du navigateur.
const host = { ...browser, ...readonly(["localStorage", "sessionStorage", "indexedDB", "BroadcastChannel"]) };
const rules = {
  "no-undef": "error", "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
  "no-redeclare": "error", "no-dupe-keys": "error", "no-unreachable": "error", "no-const-assign": "error",
  "no-self-assign": "error", "no-dupe-else-if": "error", "no-duplicate-case": "error", "no-fallthrough": "error",
  "use-isnan": "error", "valid-typeof": "error", "no-unsafe-finally": "error", "no-unsafe-negation": "error",
  "no-cond-assign": ["error", "except-parens"], "no-sparse-arrays": "error", "no-shadow-restricted-names": "error"
};
export default [
  { files: ["src/platform.js"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: host }, rules },
  { files: ["src/app/**/*.js"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: browser }, rules },
  // Le noyau est pur (ni DOM, ni stockage, ni réseau) : un module n'y voit que ses imports et URL.
  { files: ["src/core/**/*.js"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { URL: "readonly" } }, rules },
  { files: ["scripts/**/*.mjs"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { process: "readonly", URL: "readonly", console: "readonly" } }, rules },
  // Le script des captures pilote une page : ce qu'il fait évaluer dedans voit le DOM.
  { files: ["scripts/store-screenshots.mjs", "scripts/essai-captures.mjs"], languageOptions: { globals: { window: "readonly", document: "readonly", localStorage: "readonly" } } },
  // La vérification des sources de santé (npm run liens) interroge le réseau, avec un délai.
  { files: ["scripts/liens.mjs"], languageOptions: { globals: readonly(["fetch", "AbortController", "setTimeout", "clearTimeout"]) } },
  // Le test d'isolation entre comptes (npm run isolation) interroge un projet Supabase de préproduction.
  { files: ["scripts/isolation.mjs"], languageOptions: { globals: readonly(["fetch", "AbortSignal", "Buffer"]) } },
  // L'amorçage des coquilles natives (src/native/boot.js), posé seul avant Selene dans dist/native.
  { files: ["src/native/*.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script",
    globals: { window: "readonly", history: "readonly", Event: "readonly", document: "readonly", sessionStorage: "readonly", URL: "readonly", CustomEvent: "readonly" } }, rules },
  // Le script de la page publique de test (src/essai.js), posé seul dans essai.html : le DOM et le réseau, aucun stockage.
  { files: ["src/essai.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script",
    globals: readonly(["document", "location", "fetch", "performance", "URLSearchParams"]) }, rules },
  { files: ["sw.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script",
    globals: { self: "readonly", caches: "readonly", fetch: "readonly", location: "readonly", URL: "readonly", Response: "readonly" } }, rules }
];
