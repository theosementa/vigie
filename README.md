# radar

PWA multi-utilisateur de veille techno : enregistrez articles et vidéos sous forme de cartes avec image de preview, suivez-les avec les statuts **À voir** / **Vu**, organisez-les avec des tags, retrouvez-les par la recherche, ajoutez des notes personnelles et envoyez des ressources à d'autres utilisateurs. Un seul site, installable comme une app, avec une interface adaptée au mobile (style iOS) et au desktop (style iPadOS/macOS).

Voir aussi : [Contrat d'API](backend/API.md) · [Vision produit et pistes post-MVP](VISION.md)

## Stack

- **Frontend** : React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, React Router, react-hook-form + zod, `vite-plugin-pwa`
- **Backend** : FastAPI, SQLAlchemy 2 (async, asyncpg), Alembic, Pydantic, `httpx` + `selectolax`, Argon2 (`pwdlib`), JWT (`pyjwt`), géré avec `uv` (Python 3.13)
- **Base de données** : PostgreSQL 17 (extension `pg_trgm` pour la recherche)
- **Infra** : Docker Compose (`db`, `api`, `web` = nginx)

## Architecture

### Resource vs Item

- Une **`Resource`** est globale : URL normalisée (sans `utm_*`, fragment, slash final…) et métadonnées (titre, image, durée, temps de lecture…). Elle est partagée entre tous les utilisateurs, donc scrapée une seule fois.
- Un **`Item`** appartient à un utilisateur et référence une `Resource` : statut (`to_watch` / `seen`), notes, tags, `type_override` (le type auto-détecté est modifiable par utilisateur), `seen_at`. Contrainte unique `(user_id, resource_id)`.
- Un **`ItemEvent`** est une ligne du journal (`added`, `seen`, `unseen`, `deleted`, `shared`) écrite dans la même transaction que le changement ; il survit à la suppression de l'item et alimente les statistiques (`/api/stats`). Le fuseau horaire de l'utilisateur (`users.timezone`) détermine jours, semaines (lundi) et séries.
- **Partage = « envoyer à »** : partager un item crée un `Item` `to_watch` chez le destinataire (identifié par email exact, sans annuaire d'utilisateurs), avec `shared_by_user_id` et un message optionnel. Notes et tags ne sont pas copiés.
- **File d'attente** : liste ordonnée de vidéos à regarder ensuite, distincte du statut `to_watch` / `seen`. Un item y figure s'il a un `queue_position` (colonne nullable de `items`, 0-based, contiguë par utilisateur, recompactée après chaque ajout, déplacement ou retrait) et que son type effectif est `video`. Marquer l'item `seen`, le supprimer ou lui retirer le type vidéo le sort de la file. Endpoints : `GET/POST /api/queue`, `PATCH/DELETE /api/queue/{item_id}`, et filtre `queued` sur `GET /api/items` (voir `backend/API.md`). Les opérations de file ne sont pas écrites dans le journal d'événements.
- Un item d'un autre utilisateur répond toujours `404`, comme un id inexistant.

### Récupération des métadonnées et protection SSRF

Le serveur récupère les métadonnées (OpenGraph / Twitter cards, favicon ; YouTube via oEmbed et parsing de la page pour la durée ; temps de lecture ≈ mots / 230). Comme l'URL vient de l'utilisateur, la requête sortante est protégée :

- http/https uniquement ;
- résolution DNS puis refus des IP privées, loopback et link-local ;
- timeout de 5 s, taille max 2 Mo, 3 redirections max, revérifiées à chaque saut.

Un échec de récupération n'est jamais bloquant : le titre retombe sur le nom d'hôte.

### Authentification

Email + mot de passe (hash Argon2). Le JWT est stocké dans un cookie **httpOnly** `radar_session` (`SameSite=Lax`, `Secure` si `COOKIE_SECURE=true`). Front et API partagent la même origine (nginx en prod, proxy Vite en dev) : pas de CORS.

## Démarrage rapide (Docker)

```bash
cp .env.example .env        # optionnel, des valeurs par défaut existent ; changez JWT_SECRET
docker compose up -d --build
```

Ouvrir http://localhost : nginx sert la SPA et proxifie `/api` vers le service `api`. L'API est aussi exposée sur http://localhost:8000 (docs interactives : http://localhost:8000/api/docs). Les migrations sont appliquées automatiquement au démarrage de l'API.

> En production derrière HTTPS : définir `COOKIE_SECURE=true` et un `JWT_SECRET` généré (`openssl rand -hex 32`).

## Développement local

Base + API en Docker, front en local :

```bash
docker compose up -d db api
cd frontend && npm install && npm run dev
```

Ou API sur l'hôte (la base reste dans Docker). L'API lit `.env` depuis son répertoire de travail (`backend/`) ; les valeurs par défaut pointent déjà sur `localhost:5432`, sinon copiez `.env` dans `backend/` ou exportez les variables :

```bash
docker compose up -d db
cd backend && uv sync && uv run uvicorn app.main:app --reload
cd frontend && npm install && npm run dev
```

Le serveur Vite proxifie `/api` vers `http://localhost:8000`.

## Variables d'environnement

Lues depuis `.env` (voir `.env.example`) ; `docker compose` les transmet à `db` et `api`.

| Variable | Valeur par défaut | Rôle |
|---|---|---|
| `POSTGRES_USER` | `radar` | Utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | `radar` | Mot de passe PostgreSQL |
| `POSTGRES_DB` | `radar` | Nom de la base |
| `DATABASE_URL` | `postgresql+asyncpg://radar:radar@localhost:5432/radar` | URL de la base pour l'API lancée sur l'hôte (dans Compose, elle est dérivée des `POSTGRES_*`) |
| `TEST_DATABASE_URL` | `postgresql+asyncpg://radar:radar@localhost:5432/radar_test` | Base utilisée par `uv run pytest` (créée automatiquement si absente) |
| `JWT_SECRET` | `change-me-in-production` | Clé de signature des JWT (`openssl rand -hex 32`) |
| `JWT_EXPIRE_DAYS` | `30` | Durée de validité de la session |
| `COOKIE_SECURE` | `false` | `true` quand le site est servi en HTTPS |

## Migrations

Depuis `backend/` (base démarrée ; `DATABASE_URL` par défaut ou défini dans l'environnement) :

```bash
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```

## Tests et lint

```bash
cd backend
uv run pytest            # nécessite la base db (docker compose up -d db)
uv run ruff check .

cd frontend
npm run lint
npm run build            # tsc -b && vite build
```

## Installer la PWA

- **iOS (Safari)** : ouvrir le site, bouton Partager, puis **« Ajouter à l'écran d'accueil »**.
- **Chrome / Android** : menu ⋮ puis **« Installer l'application »** (ou la bannière d'installation).
- **Chrome / Edge desktop** : icône d'installation dans la barre d'adresse.

Une PWA exige HTTPS en dehors de `localhost`. Le service worker précache le shell ; `/api` passe en NetworkFirst et les images en CacheFirst (7 jours).

## Statistiques

La page `/stats` (onglet « Stats » sur mobile, « Statistiques » dans la sidebar) affiche, pour une semaine, un mois ou une année navigable : anneaux d'objectifs (éléments vus, temps de visionnage, série), histogramme articles/vidéos avec la période précédente en fantôme, chiffres clés avec delta, top tags et sources (clic = bibliothèque filtrée), partages et tendance du backlog. Les graphiques sont écrits à la main en SVG (pas de dépendance) et ont une alternative en tableau. Les objectifs sont stockés dans le `localStorage` par période. Les jours et semaines suivent le fuseau horaire du compte (`users.timezone`, détecté à l'inscription, modifiable dans Réglages).

## Responsive

Un seul site, un seul build, une seule URL. Sous **768px** : coque mobile style iOS (barre d'onglets en bas, bottom sheets, gros titres). À partir de **768px** : coque style iPadOS/macOS (sidebar, grille multi-colonnes, panneau inspecteur). Données, hooks et `ItemCard` sont communs.

## Arborescence

```
docker-compose.yml        # db, api, web (nginx)
.env.example
README.md  VISION.md
backend/
  API.md                  # contrat d'API
  Dockerfile  pyproject.toml  alembic.ini
  alembic/versions/       # migrations
  docker/initdb/          # création de la base de test
  app/
    main.py  db.py
    core/                 # config, sécurité, dépendances
    models/               # user, resource, item, tag, event (journal)
    schemas/              # schémas Pydantic
    api/routes/           # auth, items, queue, resources, tags, stats
    services/             # metadata, url (normalisation + SSRF), share, items, events, stats, queue
  tests/                  # pytest + fixtures HTML
frontend/
  vite.config.ts          # PWA + proxy /api
  public/                 # icônes PWA
  src/
    lib/  hooks/
    components/{layout,ui}/
    features/{auth,items,tags,settings,...}/
    features/stats/       # page /stats : anneaux, histogramme, cartes (SVG/CSS maison, sans lib de graphiques)
```
