# Compte rendu — <identifiant de campagne>

> Copier ce fichier en `comptes-rendus/AAAA-MM-JJ-<campagne>.md` (par exemple `2026-11-02-smoke.md`), le remplir pendant
> la campagne, le verser par une PR. Un compte rendu versé ne se réécrit pas : une correction ultérieure s'ajoute en bas,
> datée. Aucune donnée personnelle, aucun secret (ni mot de passe, ni clé, ni adresse réelle) dans ce fichier ni dans les
> preuves.

## Identification

| | |
|---|---|
| Identifiant de campagne | `AAAA-MM-JJ-<smoke \| ciblee-<PR> \| complete>` |
| Type | smoke · non-régression ciblée · recette complète ([campagnes.md](../campagnes.md)) |
| Date(s) | du … au … |
| Version testée | branche `…`, commit `…` ; version des apps (numéro, source : Actions, TestFlight…) |
| Commit du cahier utilisé | `…` (résultat de `npm run recette` : …) |
| Environnement | site (adresse), projet Supabase (production ou préproduction), navigateurs et versions, appareils et systèmes |
| Exécutant(s) | … |
| Comptes et données | comptes de recette utilisés (A, B, P) ; jeux de données importés |

## Critères d'entrée

- [ ] Commit identifié et déployé là où la campagne s'exécute
- [ ] CI verte sur ce commit (*Check › build-and-test*, *Check › browser* Chromium et WebKit, plateformes visées) — réserves d'entrée : …
- [ ] `npm run recette` vert sur le commit du cahier
- [ ] Comptes, clé de recette et appareils prêts ; mesure d'usage coupée
- [ ] Jeux de données disponibles ; jeu de volume régénéré
- [ ] Gestionnaire de tickets accessible

## Résultats

Résultat : *réussi*, *échoué*, *bloqué*, *non applicable*, *non exécuté* ([définitions](../campagnes.md#ce-qui-vaut-pour-toutes)).
Le résultat observé est ce qui s'est réellement passé, pas ce qu'on attendait ; obligatoire pour tout résultat autre que
*réussi*. La preuve est un fichier (capture, vidéo, extrait de console ou de Network) rangé à côté du ticket, ou une phrase
précise.

| Cas | Priorité | Plateforme | Résultat | Résultat observé | Preuve | Anomalie |
|---|---|---|---|---|---|---|
| `XXX-000`, en lien vers le cas | P1 | Web (Chrome …) | non exécuté | | | |

## Synthèse

| Priorité | Réussis | Échoués | Bloqués | Non applicables | Non exécutés |
|---|---|---|---|---|---|
| P1 | | | | | |
| P2 | | | | | |
| P3 | | | | | |

Anomalies ouvertes pendant la campagne : …

Écarts dus au cahier (attendu faux, étape ambiguë), corrigés par la PR … : …

## Réserves

| Écart | Ticket | Accepté par | Jusqu'à |
|---|---|---|---|
| | | | |

## Décision

*go* · *go avec réserves* · *no-go* — par …, le …, au regard des critères de sortie de la campagne.
