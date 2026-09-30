// Analyse statique du script assemblé (python3 build.py --bundle .lint/selene.js), des modules du noyau un à un
// (src/core), de l'outillage (scripts) et du service worker.
// Aucune dépendance : seulement les règles intégrées d'eslint, globals déclarés à la main.
const browser = Object.fromEntries(["window", "document", "localStorage", "sessionStorage", "location", "navigator",
  "fetch", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "AbortController", "URL", "Blob", "File",
  "FormData", "console", "indexedDB", "BroadcastChannel"].map(name => [name, "readonly"]));
const rules = {
  "no-undef": "error", "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
  "no-redeclare": "error", "no-dupe-keys": "error", "no-unreachable": "error", "no-const-assign": "error",
  "no-self-assign": "error", "no-dupe-else-if": "error", "no-duplicate-case": "error", "no-fallthrough": "error",
  "use-isnan": "error", "valid-typeof": "error", "no-unsafe-finally": "error", "no-unsafe-negation": "error",
  "no-cond-assign": ["error", "except-parens"], "no-sparse-arrays": "error", "no-shadow-restricted-names": "error"
};
export default [
  { files: [".lint/selene.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: browser }, rules },
  // Le noyau est pur (ni DOM, ni stockage, ni réseau) : un module n'y voit que ses imports et URL.
  { files: ["src/core/**/*.js"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { URL: "readonly" } }, rules },
  { files: ["scripts/**/*.mjs"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { process: "readonly", URL: "readonly" } }, rules },
  // L'amorçage des coquilles natives (src/native/boot.js), posé seul avant Selene dans dist/native.
  { files: ["src/native/*.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script",
    globals: { window: "readonly", history: "readonly", Event: "readonly", document: "readonly", sessionStorage: "readonly" } }, rules },
  { files: ["sw.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script",
    globals: { self: "readonly", caches: "readonly", fetch: "readonly", location: "readonly", URL: "readonly" } }, rules }
];
