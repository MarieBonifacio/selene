# Reprendre la main

Espace optionnel, un suivi par module : tabac (cigarettes), cannabis (grammes de produit), alcool (verres standard français de 10 g d'alcool pur), réseaux sociaux (minutes déclarées). Ce suivi ne pose pas de diagnostic, ne prescrit aucun sevrage et ne mesure pas la dose de THC. Il ne lit ni ne bloque les autres applications.

## Parcours

Ajouter le modèle « Reprendre la main » depuis l'accueil ou les Réglages, ouvrir l'espace, puis définir son sujet et son intention : observer, réduire à une limite quotidienne choisie ou viser l'arrêt. Le sujet et son unité restent fixes dès le premier objectif ; créer un autre suivi pour changer d'unité. Le nom est libre et reste visible dans la navigation.

Les objectifs sont datés et conservés. Le dernier objectif applicable sert aux nouvelles confirmations ; une journée déjà confirmée garde son objectif, même après changement de cible. Le mode observation n'attribue aucun verdict. Pas de baisse automatique des limites ni de recommandation de quantité « sans risque ».

- **Consommation / durée** : quantité ajoutée au journal. On peut aussi saisir en une fois la consommation totale d'une journée si aucune autre saisie de cette journée n'existe. Ne pas additionner un total aux mêmes événements déjà saisis.
- **Envie** : intensité 0–10 facultative, contexte et stratégie facultatifs, retour utile / neutre / difficile. Une envie n'est pas un échec.
- **Pause** : cinq minutes facultatives depuis une envie. Échéance absolue enregistrée dans l'entrée, recalculée au retour ou après rechargement. Pas de son, de notification, de connexion serveur nécessaire ou de récompense automatique.
- **Action réalisée** : un geste concret de son plan, même si une consommation a eu lieu. La sélection d'une stratégie dans une envie ne prétend pas que l'action a été réalisée.
- **Point du jour** : confirmation explicite que toutes les consommations du jour choisi sont saisies. Le total est montré avant confirmation. Une journée sans consommation saisie devient zéro seulement après ce geste. Laisser inconnue est le choix initial.

Le bilan interne compare les sept derniers jours (aujourd'hui compris) aux sept précédents, sans journées antérieures au premier objectif. Il affiche couverture, inconnus, moyenne des seuls jours complets et objectifs atteints / évaluables. Une journée partielle n'est jamais interprétée comme une abstinence. Pas d'inférence causale sur les déclencheurs ou l'utilité d'une stratégie.

## Récompenses

Facultatives et masquées par défaut. Une marque par date locale comportant au moins une action réalisée, dans ce suivi. Jalons fixes : 1, 3, 7, 14, 30 marques. Récompense personnelle facultative avec seuil de 1 à 365 marques, gratuite ou dans son budget. Aucun classement, aléa, achat intégré, série obligatoire ou perte après un écart. Les actions antérieures comptent si l'affichage des marques est activé ensuite. Corriger / supprimer une action corrige le nombre ; ce compteur décrit les données, pas une monnaie transférable ou un paiement.

## Architecture et données

- `src/core/regulation.js` : opérations pures et calculs, horloge et date locale injectées.
- `MODULE_TYPES.regulation` dans `src/core/domain.js` : défauts et validation ; `src/app/modules/regulation.js` : UI et actions enregistrées par `registerType`.
- Format site **7** : nouveau type et `goals` ; les formats antérieurs restent importables et normalisés. La garde de synchronisation existante refuse aux anciennes apps d'écrire sur un format plus récent. Mettre à jour les appareils avant utilisation.
- `config` : sujet, appuis, affichage des récompenses, texte et seuil personnel.
- `goals[]` : id, date d'effet locale, horodatage, mode et limite. Une modification ajoute une version.
- `entries[]` : id, kind (`use`, `urge`, `action`, `day`), date locale, horodatage, fuseau et données propres au type. Le fuseau est informatif ; un déplacement ne reclasse pas rétroactivement les dates saisies.
- `day-AAAA-MM-JJ` : identifiant déterministe d'une confirmation, objectif associé et instantané exact trié des identifiants/quantités de consommation. Ajout, correction ou suppression de quantité invalident cette confirmation jusqu'à un nouveau geste, même après fusion distante. L'ordre des listes et une simple retouche de note ne l'invalident pas.
- Marques dérivées des dates distinctes d'actions, jamais d'un solde incrémenté : plusieurs actions ou appareils ne doublent pas le gain du jour. Les dates futures sont refusées à la saisie. Comme tout suivi autodéclaratif, la date et l'horloge ne sont pas des preuves antifraude.
- Stockage et fusion à trois voies existants conservés. Les conflits simultanés sur une même valeur gardent l'arbitrage du store ; aucune nouvelle table Supabase, dépendance ou infrastructure.

## Confidentialité

`assistant.share[id] = false` à la création, y compris depuis un type vide. Un partage volontaire dans les Réglages transmet uniquement le résumé des sept jours et le sujet, sans notes, déclencheurs ou stratégies. Révoquer ce partage empêche de nouveaux envois ; cela ne retire pas les anciens messages d'une conversation déjà transmise.

Pas de hook `texts` : exclusion des recherches, motifs, vocabulaire et test lunaire. `recent` est vide et `review` renvoie null. La planche de lunaison ignore ce type sensible, y compris pour compter les événements. Le pont de reprise reste dans l'espace et ne revient pas sur l'accueil. La résolution transversale des liens ignore aussi ses entrées. Aucun rappel ou widget ne reçoit les événements.

Ce n'est pas un coffre-fort séparé : le nom et la présence de l'espace restent visibles ; données et sauvegardes suivent le compte et le stockage existants. Pas de chiffrement de bout en bout ajouté. Le fichier JSON exporté volontairement depuis le module est lisible et contient son journal complet. Cet export dédié est destiné à la consultation ; la restauration utilise la sauvegarde complète Selene. La suppression de l'espace réutilise la confirmation nominative existante et la synchronisation ; une copie exportée ne peut pas être effacée à distance.

## Validation

`tests/regulation.test.js` couvre les inconnus, les trois intentions et quatre sujets, les dates, l'historique des objectifs, les corrections, les importations invalides, les fusions entre appareils, les marques, la pause et la confidentialité des surfaces générales/IA.

`tests/browser/regulation.js` exerce les formulaires réels sur téléphone, les unités décimales, les objectifs, la confirmation et sa réouverture, les récompenses, la pause après rechargement et les exclusions. Le test commun de registre inclut ce nouveau type. Exécuter `npm run check`, puis `npm run test:browser -- regulation` (Chromium et WebKit).

## Sources et limites

Information alcool : [Alcool Info Service — repères et définition du verre standard](https://www.alcool-info-service.fr/sinformer-et-evaluer-sa-consommation/alcool-et-sante/les-reperes-de-consommation-quest-ce-que-cest), [préparer l'arrêt](https://www.alcool-info-service.fr/questions-reponses/conseils-pour-larret-brutal). Consultation le 30 septembre 2026. Le message oriente vers un médecin / CSAPA en cas de dépendance ou de manque ; il ne fournit pas de calendrier de sevrage.

L'efficacité clinique de cette gamification n'est pas établie. La gestion des contingences étudiée en soin repose notamment sur des comportements vérifiés et des renforcements tangibles : [SAMHSA, janvier 2025](https://www.samhsa.gov/resource/ebp/using-samhsa-funds-implement-evidence-based-contingency-management-services). Elle ne valide pas à elle seule les marques autodéclaratives de Selene. Avant une communication publique comme outil thérapeutique, prévoir une revue spécialisée distincte.
