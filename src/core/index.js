/* Le noyau : les fichiers purs de Selene, en modules ES (imports et exports explicites). esbuild les assemble en tête
   du script (scripts/bundle-core.mjs) ; chaque nom exporté ici devient une constante de la portée que partagent les
   fichiers historiques de src/. Un module de plus = une ligne de plus, rien d'autre à tenir à jour. */
export * from "./sync.js";
