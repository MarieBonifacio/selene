// Analyse statique du script assemblé (python3 build.py --bundle .lint/selene.js) et du service worker.
// Aucune dépendance : seulement les règles intégrées d'eslint, globals déclarés à la main.
const browser = Object.fromEntries(["window", "document", "localStorage", "sessionStorage", "location", "navigator",
  "fetch", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "AbortController", "URL", "Blob", "File",
  "FormData", "console"].map(name => [name, "readonly"]));
const rules = {
  "no-undef": "error", "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
  "no-redeclare": "error", "no-dupe-keys": "error", "no-unreachable": "error", "no-const-assign": "error",
  "no-self-assign": "error", "no-dupe-else-if": "error", "no-duplicate-case": "error", "no-fallthrough": "error",
  "use-isnan": "error", "valid-typeof": "error", "no-unsafe-finally": "error", "no-unsafe-negation": "error",
  "no-cond-assign": ["error", "except-parens"], "no-sparse-arrays": "error", "no-shadow-restricted-names": "error"
};
export default [
  { files: [".lint/selene.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: browser }, rules },
  { files: ["sw.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script",
    globals: { self: "readonly", caches: "readonly", fetch: "readonly", location: "readonly", URL: "readonly" } }, rules }
];
