# VISION — Vigie

> PWA de veille open source (AGPL-3.0) · auto-hébergeable en une commande · instance publique `vigie.theosementa.fr` → port `8101`, en mode `invite`

## 1. Pitch

Tu colles un lien (ou tu le partages depuis ton téléphone) : Vigie en tire une carte illustrée et la range dans **À voir**. Tu vides ta pile à ton rythme, tu notes, tu tagues, tu envoies ce qui vaut le coup à quelqu'un, et Vigie te montre honnêtement si tu rattrapes ton retard.

Esprit : **un écran de veille, pas un fil d'actualité** : ce qui entre est choisi, ce qui sort est vu.

## 2. Objectifs

- **Ne plus perdre un lien** : capturer un article ou une vidéo en moins de 3 secondes, depuis n'importe où (feuille de partage, bookmarklet, raccourci, API).
- **Vider la pile** : savoir quoi regarder maintenant (file vidéo, filtres, recherche) et marquer « Vu » en un geste.
- **Voir sa veille** : combien j'ai vu, combien j'en accumule, depuis quand je tiens le rythme, chaque chiffre avec sa base.
- **Partager sans réseau social** : envoyer un lien à une personne précise, avec un mot.
- **Héberger soi-même sans être expert** : `docker compose up -d`, HTTPS automatique, défauts sûrs, mise à jour par `docker compose pull`.
- **Ouvert à tous** : interface en anglais et en français, accessible (AA), utilisable au pouce comme à la souris.

### Non-objectifs

- **Pas de réseau social** : pas de profils publics, de fil, d'abonnés, de likes, d'annuaire d'utilisateurs.
- **Pas d'algorithme** : aucune recommandation, aucun classement « pour toi ». L'ordre vient de toi (date, file, filtres).
- **Pas d'archivage du contenu** : Vigie garde un lien et ses métadonnées, pas une copie de l'article (droits, stockage). Pas de lecture hors ligne au MVP.
- **Pas de télémétrie** : aucune analytics, aucun appel sortant hormis la récupération des métadonnées et l'e-mail si configuré.
- **Pas d'IA au MVP** : pas de résumés, pas de classement automatique.
- **Pas d'apps natives** : la PWA couvre iPhone, Android et desktop.

## 3. Principes produit

1. **Une ressource, plusieurs bibliothèques** : une URL normalisée = une `Resource` globale, récupérée une fois ; chaque utilisateur en a son `Item` privé (statut, notes, tags, type). Ce qui est privé ne fuit jamais d'un compte à l'autre : un item d'un autre compte répond **404**, exactement comme un id inexistant.
2. **Le journal est la seule source de vérité de l'historique** : chaque changement d'état écrit un `ItemEvent` dans la même transaction. Toutes les statistiques datées se calculent sur le journal, jamais sur l'état courant. Supprimer un item ne réécrit pas le passé.
3. **Chaque chiffre dit d'où il vient** : explication (« Basé sur 42 vidéos vues, 3 sans durée ») et confiance (`mesuré` / `estimé` / `partiel` / `inconnu`) renvoyées par l'API avec la valeur.
4. **Une capture n'échoue jamais pour une raison de métadonnées** : si la page ne répond pas, la carte est créée avec le nom d'hôte comme titre et l'état « métadonnées indisponibles », réessayable. Seule une URL invalide ou interdite (SSRF) est refusée.
5. **Le réseau ne bloque jamais la base** : aucune requête sortante pendant une transaction ouverte. On récupère, puis on écrit dans une session courte.
6. **Sûr par défaut** : l'app refuse de démarrer avec un secret par défaut ou trop court ; la base n'est jamais exposée hors du réseau Docker ; les conteneurs tournent sans root ; chaque route sensible est limitée en débit.
7. **Aucune énumération de comptes** : inscription, connexion, réinitialisation et partage répondent de la même façon qu'un compte existe ou non.
8. **Tes données t'appartiennent** : export complet (JSON + CSV) et suppression de compte en libre-service, effectifs immédiatement.
9. **Désactiver masque, ne supprime pas** : un module désactivé disparaît de la navigation, de l'accueil, de la capture et des stats ; ses données restent.
10. **Le texte de l'interface n'est jamais écrit en dur** : toutes les chaînes passent par le dictionnaire `en` / `fr` ; l'API renvoie des codes et des paramètres, le front formule.

## 4. Comptes et instance

- **Un compte = une bibliothèque.** Prénom, nom, e-mail + mot de passe. Le formulaire d'inscription explique pourquoi on demande le nom : « Ton nom s'affiche quand tu envoies un lien à quelqu'un, pour qu'il sache de qui il vient. Il n'est visible par personne d'autre. »
- **Identifiants** : e-mail + mot de passe (Argon2, 8 caractères minimum, 72 octets max pris en compte). Session JWT dans un cookie `httpOnly`, `SameSite=Lax`, `Secure` automatique derrière HTTPS.
- **Rôles** : `admin` et `user`. Le **premier compte créé** sur une instance vide devient admin.
- **Mode d'inscription**, réglé par l'admin dans *Administration* et modifiable à tout moment (`REGISTRATION` dans `.env` ne fixe que la valeur initiale d'une instance neuve) :

| Mode | Comportement |
|---|---|
| `invite` **(défaut)** | Après le premier compte, seules les **adresses e-mail ajoutées par un admin** à la liste des invités peuvent créer un compte. Si SMTP est configuré, l'invité reçoit un e-mail ; sinon l'admin lui transmet l'adresse du site |
| `open` | Tout le monde peut s'inscrire ; e-mail à vérifier si SMTP est configuré |
| `closed` | Plus aucune inscription |

- **Changer de mode ne touche jamais aux comptes existants** : passer de `open` à `invite` ou `closed` bloque seulement les nouvelles inscriptions.
- **Instance publique** : démarre en `invite`, Théo seul admin ; il passe en `open` quand il veut, et revient en `invite` si besoin.

- **Sessions révocables** : `users.token_version` incrémenté au changement de mot de passe ou par « Me déconnecter partout » ; un JWT d'une version antérieure est refusé.
- **Mot de passe oublié** : par e-mail si `SMTP_*` est configuré (lien à usage unique, 1 h) ; sinon un admin génère un lien de réinitialisation depuis l'administration, ou en CLI (`docker compose exec api vigie reset-password <email>`).
- **Jetons d'API personnels** (pour raccourcis iOS, extension, scripts) : nommés, affichés une seule fois, stockés hachés, révocables, portée `capture` (ajouter) ou `full`.
- **Administration** (admin seulement) : mode d'inscription, liste des invités (ajouter / retirer une adresse, voir si elle a créé son compte), liste des comptes (nom, e-mail, date, nombre d'items), suppression d'un compte, lien de réinitialisation. Aucun accès au contenu des bibliothèques.
- **Domaines e-mail** : les domaines à usage spécial (`.local`, `.lan`, `.home.arpa`, `.test`) sont acceptés quand `REGISTRATION=invite` ou `closed`, pour les homelabs.

## 5. Modules

Le **Cœur** est toujours actif. Les autres s'activent **par compte** dans *Réglages → Modules*. Un module désactivé masque ses écrans, widgets, entrées de capture et statistiques ; ses données restent et reviennent à la réactivation. Ses routes répondent 404.

| Module | Défaut | Résumé |
|---|---|---|
| Cœur — Bibliothèque | Toujours | Capture, cartes, statuts À voir / Vu, tags, notes, recherche, filtres |
| File | Activé | Liste ordonnée de vidéos à regarder ensuite |
| Partage | Activé | Envoyer un item à une autre personne de l'instance |
| Statistiques | Activé | Rythme, temps passé, séries, tendance de la pile |

### 5.1 Cœur — Bibliothèque

**Saisie** : **URL**. Optionnels : tags, note, type (`article` / `video`, déduit sinon), statut (`À voir` par défaut).

**Normalisation de l'URL** : schéma et hôte en minuscules, suppression du fragment, des paramètres de suivi (`utm_*`, `fbclid`, `gclid`, `mc_*`, `ref`, `si` YouTube), du slash final, tri des paramètres restants ; `youtu.be/<id>` et `youtube.com/shorts/<id>` → `youtube.com/watch?v=<id>`. **Longueur max 2 048 caractères** (refus en 422 au-delà).

**Récupération des métadonnées** (protégée SSRF) : http/https, ports 80 et 443 uniquement (8080 et 8443 tolérés), résolution DNS puis refus des IP privées, loopback, link-local et réservées, connexion épinglée sur l'IP vérifiée, 5 s, 2 Mo, 3 redirections revérifiées. Sources par ordre de priorité : OpenGraph, Twitter cards, `<title>`, `<link rel=icon>`, `/favicon.ico`. YouTube : oEmbed + durée lue dans la page.

**Calculs**
- Type déduit = `video` si l'hôte est une plateforme vidéo connue (YouTube, Vimeo, Dailymotion, Twitch, PeerTube via `og:type=video`) ou si `og:type` commence par `video`, sinon `article`. L'utilisateur peut le corriger (`type_override`).
- Temps de lecture = `max(1, ceil(mots du corps / 230))` minutes, confiance `estimé`. Inconnu si la page n'a pas pu être lue.
- Durée vidéo : confiance `mesuré` quand elle vient de la plateforme, `inconnu` sinon (jamais devinée).

**Doublon** : ajouter une URL déjà présente ne crée rien ; la réponse renvoie l'item existant avec l'avertissement `already_in_library`, et l'interface ouvre la carte.

**Actualiser** : relance la récupération ; la réponse dit si elle a réussi (`refreshed: true | false` + raison). L'interface n'annonce jamais un succès qui n'a pas eu lieu.

**Saisie rapide** : un champ URL pré-rempli depuis le presse-papiers **seulement sur action** (bouton « Coller »), jamais lu à l'ouverture. Aperçu de la carte en direct, bouton « Ajouter à Vigie ».

**Recherche** : titre, site, URL, notes, tags (`ILIKE` + `pg_trgm`). Filtres : statut, type, tag, source, partagé avec moi, dans la file. Les filtres vivent dans l'URL.

**Affichage** : grille de cartes (image, titre, site + favicon, durée ou temps de lecture, tags, état). Image absente → vignette de la DA (pas de dégradé aléatoire). Détail : métadonnées, note, tags, historique de l'item (ajouté, vu, partagé par…).

### 5.2 File

**Règle** : un item est dans la file s'il a un `queue_position` et que son type effectif est `video`. Positions 0-based, contiguës par utilisateur, recompactées à chaque ajout, déplacement ou retrait.

**Sortie automatique** : marquer Vu, supprimer, ou changer le type en `article` retire de la file.

**Affichage** : liste réordonnable (glisser au doigt et au clavier), durée totale de la file = Σ durées connues, confiance `partiel` si au moins une durée est inconnue (« ≈ 2 h 40, 2 vidéos sans durée »).

### 5.3 Partage

**Saisie** : **adresse e-mail du destinataire**, message optionnel (280 caractères).

**Effet** : crée chez le destinataire un item `À voir` avec `shared_by` et le message ; notes et tags de l'expéditeur ne sont pas copiés. Si le destinataire a déjà la ressource, son item reçoit la mention du partage sans changer de statut.

**Anti-énumération** : vers une adresse qui n'est pas un contact, la réponse est toujours `202` avec « Envoyé si cette adresse a un compte et accepte tes partages ». Vers un contact, le partage est confirmé avec son nom.

**Contacts** (symétriques) : deux comptes deviennent contacts quand
- le destinataire **ouvre** un partage reçu (il voit le nom de l'expéditeur, l'expéditeur voit désormais le sien), ou
- l'un accepte le **lien de contact** de l'autre (usage unique, expire en 7 jours, créé dans *Partagés → Ajouter un contact*).

Le champ destinataire propose les contacts par nom. Retirer un contact est possible à tout moment ; les items déjà reçus restent.

**Réception** : réglage « Qui peut m'envoyer des liens » (`tout le monde` / `mes contacts` / `personne`). Défaut à la création du compte : `tout le monde` si l'instance est en `invite` ou `closed`, `mes contacts` si elle est en `open`.

**Limites** : 50 partages par jour et par compte.

### 5.4 Statistiques

Période `semaine` (lundi → dimanche) / `mois` / `année`, navigable, dans le **fuseau du compte** (`users.timezone`, IANA, détecté à l'inscription, modifiable).

**Calculs** (sur le journal `item_events`, principe 2)
- **Vus sur P** = nombre de ressources distinctes ayant un événement `seen` dans P qui n'est pas suivi d'un `unseen` dans P. Supprimer l'item plus tard ne change pas ce chiffre.
- **Ajoutés sur P** = ressources distinctes ayant un `added` dans P.
- **Temps de visionnage sur P** = Σ `duration_seconds` des vidéos vues sur P. Confiance `mesuré` si toutes les durées sont connues, sinon `partiel` avec le nombre de vidéos sans durée.
- **Temps de lecture sur P** = Σ temps de lecture des articles vus sur P, confiance `estimé` (230 mots/min).
- **Delta** = `(P − P₋₁) / P₋₁`. Si `P₋₁ = 0` : pas de pourcentage, mention « nouveau ».
- **Série courante** = nombre de jours consécutifs avec au moins un `seen`, en remontant depuis aujourd'hui ; si aujourd'hui n'a encore rien, on part d'hier et la série est marquée « à prolonger aujourd'hui ». **Record** = plus longue série du journal.
- **Pile (backlog) au jour J** = Σ jusqu'à J de `added` (+1), `seen` (−1), `unseen` (+1), `deleted` d'un item À voir (−1). Tendance = pente des 28 derniers jours : « tu rattrapes » si < 0, « stable » si |pente| < 0,1/jour, « ça s'accumule » sinon.
- **Top tags / sources** de P = tags actuels et `site_name` des items vus sur P ; base affichée (« sur 31 items vus encore dans ta bibliothèque ») car un item supprimé n'a plus de tags.
- **Objectifs** (anneaux) : objectif hebdomadaire d'items vus et de temps de visionnage, **stockés sur le compte** (`module_settings`), pas dans le navigateur.

**Affichage** : anneaux d'objectifs, histogramme articles / vidéos avec la période précédente en fantôme, chiffres clés avec delta, série, tendance de la pile, tops (clic → bibliothèque filtrée). Chaque graphe a son alternative en tableau.

## 6. Reprise d'historique

Une app vide ne donne rien à voir : l'import est dans l'onboarding.

| Source | Format | Ce qui est repris |
|---|---|---|
| Favoris de navigateur (Chrome, Firefox, Safari) | HTML Netscape | URL, titre, date d'ajout, dossiers → tags |
| Pocket (export) | CSV | URL, titre, date, tags, statut (`archive` → Vu) |
| Instapaper | CSV | URL, titre, dossier → tag, date |
| Raindrop.io | CSV | URL, titre, tags, date, note |
| Liste de liens | Texte, une URL par ligne | URL |

- L'import crée les items **tout de suite** (titre de l'export ou nom d'hôte), puis récupère les métadonnées **en tâche de fond** (file en base, traitée par l'API, 2 requêtes simultanées par hôte, reprise après redémarrage). La progression s'affiche (« 412 / 1 280 cartes complétées »).
- Les dates d'origine alimentent le journal (`added` / `seen` datés), donc les stats démarrent avec ton vrai historique.
- Doublons ignorés et comptés dans le récap. Limite : 20 000 lignes par import.

**Export** : JSON complet (items, notes, tags, journal) et CSV compatible Pocket, en un clic dans *Réglages → Données*.

## 7. Accueil (Bibliothèque)

- **Barre de capture** : coller un lien, toujours visible sur desktop, derrière l'action centrale sur mobile.
- **À voir** : les cartes, les plus récentes d'abord, filtres en tête.
- **Prochaine vidéo** de la file (si module File) : une carte large, « Regarder ».
- **Reçu récemment** (si module Partage) : partages non ouverts, avec le mot de l'expéditeur.
- **Rythme de la semaine** (si module Stats) : vus cette semaine vs objectif, série.

## 8. Signaux (in-app)

Pas de notifications push au MVP. Des pastilles dans la navigation :
- **Partages reçus non ouverts** : compteur sur l'onglet Partagés.
- **Import en cours** : progression dans Réglages → Données.
- **Pile qui s'accumule** : une ligne sur l'accueil quand la tendance est « ça s'accumule » trois semaines de suite, avec l'action « Voir les plus anciens ».

## 9. Réglages

**Compte** : prénom et nom (50 caractères chacun), e-mail, mot de passe, langue (`auto` / `en` / `fr`), thème (`système` / `sombre` / `clair`), fuseau horaire, me déconnecter partout, jetons d'API, bookmarklet, supprimer mon compte.
**Modules** : File, Partage, Statistiques (interrupteurs, enregistrés au basculement), objectifs, qui peut m'envoyer des partages.
**Données** : importer, exporter.
**Administration** (admin) : mode d'inscription, invités, comptes.

## 10. Stack technique

| Couche | Choix |
|---|---|
| Front | React 19 + Vite + TypeScript strict, **PWA** (`vite-plugin-pwa`), TanStack Query, `openapi-fetch` + types générés, React Router, **Tailwind CSS v4** dont le thème (`@theme`) reprend tels quels les tokens de la DA (`tokens.css`), SVG maison pour les graphes, i18n maison (`lib/i18n.ts`, dictionnaires typés `en` / `fr`, `Intl` pour nombres et dates) |
| Back | Python 3.13 **FastAPI**, SQLAlchemy 2 async (asyncpg), Alembic, Pydantic v2, `pydantic-settings`, `httpx` + `selectolax`, Argon2 (`pwdlib`), PyJWT, géré avec `uv` |
| Jobs | File de tâches en table Postgres (`jobs`, `SELECT … FOR UPDATE SKIP LOCKED`), boucle dans le lifespan de l'API, désactivable (`JOBS_ENABLED=false`) |
| BDD | **PostgreSQL 17** (`pg_trgm`) |
| E-mail | SMTP optionnel (`SMTP_*`) : vérification, réinitialisation, invitations. Sans SMTP, tout fonctionne par liens générés par l'admin |
| Infra | Docker Compose : `web` (**Caddy** : SPA, proxy `/api`, HTTPS automatique si `VIGIE_DOMAIN` est défini, en-têtes de sécurité), `api` (non-root), `db` (non exposée). Images publiées sur `ghcr.io` |
| Qualité | `pytest` (Postgres réel), `ruff check` + `ruff format`, `tsc -b`, ESLint ; GitHub Actions sur chaque PR, Dependabot |
| Déploiement de l'instance publique | Runner self-hosted homelab (`homelab-deploy`), Cloudflare → `vigie.theosementa.fr` |

**Écarts au blueprint, et pourquoi** : PostgreSQL réel en tests (et non SQLite) car la recherche (`pg_trgm`), les agrégats par fuseau et `SKIP LOCKED` sont propres à Postgres ; **Tailwind conservé** (choix de Théo, déjà en place dans le code) : les tokens de la DA alimentent son thème, aucune couleur ni taille en dur hors tokens ; i18n et code d'erreur côté API au lieu de textes français côté back, car l'interface est bilingue ; images publiées sur `ghcr.io` pour que l'auto-hébergement ne demande pas de build.

### Modèle de données (esquisse)

```
User(id, email, password_hash, first_name, last_name, role, token_version, locale, theme, timezone, email_verified_at, receive_shares, created_at)
UserModule(user_id, module, enabled, settings_json)
Resource(id, url, url_hash, type, title, description, image_url, site_name, favicon_url, duration_seconds, reading_time_minutes, fetch_status, fetched_at)
Item(id, user_id, resource_id, status, type_override, notes, seen_at, queue_position, shared_by_user_id, share_message, opened_at, created_at)   unique(user_id, resource_id)
Tag(id, user_id, name)  ItemTag(item_id, tag_id)
ItemEvent(id, user_id, item_id?, resource_id, kind, occurred_at)   kind ∈ added | seen | unseen | deleted | shared
Contact(user_id, contact_id, created_at)            une ligne par sens
ContactLink(id, user_id, token_hash, expires_at, used_at)
InstanceSettings(registration_mode, updated_at, updated_by)
Invitation(id, email, created_by, created_at, used_at)
ApiToken(id, user_id, name, token_hash, scope, last_used_at, created_at)
PasswordReset(id, user_id, token_hash, expires_at, used_at)
Job(id, kind, payload_json, status, attempts, run_after, locked_at, error)
ImportRun(id, user_id, source, total, done, duplicates, failed, created_at, finished_at)
```

`Resource.url` n'est plus indexée directement : unicité sur `url_hash` (SHA-256), ce qui lève la limite de taille de l'index btree.

## 11. Direction artistique

Référence visuelle : `vigie-da.html` (tokens copiés tels quels dans `tokens.css`, classes reprises dans `base.css`).
- Métaphore : **l'écran d'un instrument de navigation la nuit**. Ce qui arrive est un écho, ce qui est vu s'éteint, les objectifs se lisent comme un écran radar (anneaux concentriques).
- Accent « écho » : vert phosphore (`#B8F25C` sombre, `#A6E33F` clair ; trait `#3B6A00` en clair), réservé à **trois choses** : l'action principale de l'écran (Ajouter, Envoyer, Créer), ce qui est nouveau (partage non ouvert, ajout du jour), le point « maintenant » des graphes. Aplats en `--accent`, petites marques (points, focus) en `--accent-ink`.
- **Ce qui est vu s'éteint** : item Vu = titre en secondaire, image en niveaux de gris atténuée ; pas de badge.
- Thème de référence : **sombre** ; le clair reprend les mêmes rôles. Sélecteur Sombre / Clair / Système.
- Typo : **Geologica** seule, deux graisses (500 titres et chiffres, 400 texte), resserrement réservé aux grandes tailles, chiffres tabulaires partout.
- États : `ok` bleu « tu rattrapes », `watch` jaune « stable », `plan` orange « en retard », `over` rouge « ça s'accumule » (seul état rouge, avec les suppressions), `unknown` gris « inconnu » ; aucun ne reprend le vert de l'accent.
- Icônes : **Solar** (480 Design, CC BY 4.0), `linear` partout, `bold` pour l'onglet ou l'entrée active, embarquées au build.
- Image absente : vignette monogramme (initiale du site) sur `--surface-2` ; métadonnées indisponibles : vignette en pointillés + « Réessayer ».

### Navigation par plateforme

- **Mobile** : barre d'onglets en bas : Bibliothèque, File, **action centrale « Ajouter »**, Partagés, Stats. L'action centrale ouvre la capture plein écran (champ URL, « Coller », aperçu, « Ajouter à Vigie » collant en bas). Réglages depuis l'en-tête de la Bibliothèque.
- **Tablette portrait** : rail d'icônes latéral, capture en modale.
- **Tablette paysage et desktop** : barre latérale complète (modules actifs, puis Réglages, puis le compte). Barre de capture dans l'en-tête de la Bibliothèque, inspecteur à droite à partir de 1 280 px.

## 12. Roadmap

Le code actuel (MVP fonctionnel : bibliothèque, file, partage, stats) est **repris, pas réécrit de zéro** : chaque phase garde ce qui est sain et le remet aux règles de ce document.

**Reprise, dans l'ordre de build**
0. **Historique Git honnête** : commit initial (vision + DA), puis import du code existant tel quel, puis nettoyage (code mort, doublons, docs périmées).
1. **Socle sûr et auto-hébergeable** : refus des secrets par défaut, compose durci (base non exposée, non-root, images épinglées), Caddy + HTTPS auto, limitation de débit, mode d'inscription modifiable par l'admin + premier admin + liste des invités + prénom / nom, sessions révocables, changement de mot de passe, suppression de compte, garde-fou sur la base de test, correctif réseau-hors-transaction, URL ≤ 2 048 / `url_hash`. LICENSE, README en anglais, CONTRIBUTING, SECURITY, CI.
2. **Fondations front** : tokens de la DA branchés sur le thème Tailwind (`@theme`) et composants restylés à la DA, shell mobile / rail / sidebar, i18n `en` / `fr`, client `openapi-fetch` généré, thème Sombre / Clair / Système, cache du service worker vidé à la déconnexion. Bibliothèque, capture et détail portés.
3. **Modules** : table `UserModule`, File et Partage portés (anti-énumération, contacts et lien de contact, réception), « Actualiser » honnête.
4. **Statistiques sur le journal** : calculs du §5.4 en fonctions pures testées, objectifs sur le compte, explication + confiance sur chaque chiffre.
5. **Capture partout** : jetons d'API, bookmarklet, Web Share Target (Android), raccourci iOS documenté.
6. **Reprise et portabilité** : file de jobs, imports (§6), export JSON / CSV.
7. **Instance publique** : SMTP (vérification, réinitialisation, invitations par e-mail), proxy d'images (masque l'IP des visiteurs aux CDN tiers), pages Confidentialité et Conditions, administration.
→ Passe `unslop` sur l'app réelle, images `ghcr.io`, déploiement de l'instance publique, guide d'auto-hébergement.

**V1.1** : recherche plein texte `tsvector` (`english` / `french`), extension navigateur, import RSS (flux → items À voir), notifications Web Push des partages.

**V2** : collections partagées, résumés IA optionnels (clé fournie par l'instance), lecture hors ligne en mode lecteur.

## 13. Questions ouvertes

1. **Capacité de l'instance publique** : le homelab tient-il quelques milliers de comptes (CPU des récupérations, bande passante du proxy d'images) ? On le mesure pendant la phase `invite` avant d'ouvrir.

### Tranché

- Nom : **Vigie** (choisi avec la DA), sous-domaine `vigie.theosementa.fr`, dépôt `vigie`.
- Port de l'instance publique : `8101`, mode `invite`, Théo seul admin.
- Partage : contacts créés à l'ouverture d'un partage ou par lien de contact ; prénom et nom demandés à l'inscription, avec la raison affichée.
- Traductions : dictionnaires dans le dépôt ; une plateforme communautaire seulement quand d'autres langues seront demandées.
- Stats après suppression : tags et source ne sont pas figés dans l'événement ; la base est affichée.
