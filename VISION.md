# VISION — Vigie

> Open-source (AGPL-3.0) watch-list PWA · self-hostable with one command · public instance in `invite` mode

## 1. Pitch

You paste a link (or share it from your phone): Vigie turns it into an illustrated card and files it under **To watch**. You empty your pile at your own pace, rate, tag, send what is worth it to someone, and Vigie honestly shows whether you are catching up.

Spirit: **a watch screen, not a news feed**: what comes in is chosen, what goes out is seen.

## 2. Goals

- **Never lose a link**: capture an article or a video in under 3 seconds, from anywhere (share sheet, bookmarklet, shortcut, API).
- **Empty the pile**: know what to watch now (video queue, filters, search) and mark it "Seen" in one gesture.
- **See your watching**: how much I have seen, how much is piling up, since when I have kept the pace, every number with its basis.
- **Share without a social network**: send a link to one specific person, with a note.
- **Self-host without being an expert**: `docker compose up -d`, automatic HTTPS, safe defaults, update with `docker compose pull`.
- **Open to everyone**: interface in English and French, accessible (AA), usable with a thumb as well as a mouse.

### Non-goals

- **No social network**: no public profiles, feed, followers, likes, or user directory.
- **No algorithm**: no recommendations, no "for you" ranking. The order comes from you (date, queue, filters).
- **No import for now**: no import from Pocket, Instapaper, Raindrop or browser bookmarks. Vigie starts empty and fills from capture. The export (§6.5) stays.
- **No content archiving**: Vigie keeps a link and its metadata, not a copy of the article (rights, storage). No offline reading in the MVP.
- **No telemetry**: no analytics, no outgoing call except fetching metadata and e-mail if configured.
- **No AI in the MVP**: no summaries, no automatic sorting.
- **No native apps**: the PWA covers iPhone, Android and desktop.

## 3. Product principles

1. **One resource, many libraries**: one normalised URL = one global `Resource`, fetched once; each user has their own private `Item` (status, notes, tags, type). What is private never leaks from one account to another: another account's item answers **404**, exactly like a non-existent id.
2. **The journal is the only source of truth for history**: every state change writes an `ItemEvent` in the same transaction. All dated statistics are computed from the journal, never from the current state. Deleting an item does not rewrite the past.
3. **Every number says where it comes from**: an explanation ("Based on 42 videos seen, 3 without duration") and a confidence (`measured` / `estimated` / `partial` / `unknown`) are returned by the API with the value.
4. **A capture never fails because of metadata**: if the page does not answer, the card is created with the host name as title and the "metadata unavailable" state, which can be retried. Only an invalid or forbidden URL (SSRF) is refused.
5. **The network never blocks the database**: no outgoing request during an open transaction. We fetch first, then write in a short session.
6. **Safe by default**: the app refuses to start with a default or too-short secret; the database is never exposed outside the Docker network; containers run without root; every sensitive route is rate-limited.
7. **No account enumeration**: sign-up, sign-in, reset and sharing answer the same way whether an account exists or not.
8. **Your data belongs to you**: full export (JSON + CSV) and account deletion, self-service, effective immediately.
9. **Disabling hides, it does not delete**: a disabled module disappears from navigation, home, capture and stats; its data stays.
10. **Interface text is never hard-coded**: every string goes through the `en` / `fr` dictionary; the API returns codes and parameters, the front end words them.

## 4. Accounts and instance

- **One account = one library.** First name, last name, e-mail + password. The sign-up form explains why the name is asked: "Your name is shown when you send a link to someone, so they know who it is from. Nobody else can see it."
- **Credentials**: e-mail + password (Argon2, 8 characters minimum, 72 bytes maximum taken into account). JWT session in an `httpOnly` cookie, `SameSite=Lax`, `Secure` automatic behind HTTPS.
- **Roles**: `admin` and `user`. The **first account created** on an empty instance becomes admin.
- **Registration mode**, set by the admin in *Administration* and changeable at any time (`REGISTRATION` in `.env` only sets the initial value of a new instance):

| Mode | Behaviour |
|---|---|
| `invite` **(default)** | After the first account, only **e-mail addresses added by an admin** to the invite list can create an account. If SMTP is configured, the invitee receives an e-mail; otherwise the admin passes them the site address |
| `open` | Anyone can sign up; e-mail to verify if SMTP is configured |
| `closed` | No more sign-ups |

- **Changing mode never touches existing accounts**: going from `open` to `invite` or `closed` only blocks new sign-ups.
- **Public instance**: starts in `invite`, its owner the only admin; it switches to `open` when they want, and back to `invite` if needed.

- **Revocable sessions**: `users.token_version` is incremented on password change or by "Sign me out everywhere"; a JWT from an earlier version is refused.
- **Forgotten password**: by e-mail if `SMTP_*` is configured (single-use link, 1 h); otherwise an admin generates a reset link from the administration, or from the CLI (`docker compose exec api vigie reset-password <email>`).
- **Personal API tokens** (for iOS shortcuts, extension, scripts): named, shown once, stored hashed, revocable, scope `capture` (add) or `full`.
- **Administration** (admin only): registration mode, invite list (add / remove an address, see whether it has created its account), account list (name, e-mail, date, item count), account deletion, reset link, **instance activity** (active accounts over 24 h / 7 d / 30 d, sign-ups, items added / seen, shares, per-day curve over 7 / 30 / 90 days: counters computed in the instance's own database, nothing is sent elsewhere). No access to library contents.
- **E-mail domains**: special-use domains (`.local`, `.lan`, `.home.arpa`, `.test`) are accepted when `REGISTRATION=invite` or `closed`, for homelabs.

## 5. Modules

The **Core** is always on. The others are enabled **per account** in *Settings → Modules*. A disabled module hides its screens, widgets, capture entries and statistics; its data stays and comes back on re-enabling. Its routes answer 404.

| Module | Default | Summary |
|---|---|---|
| Core — Library | Always | Capture, cards, To watch / Seen statuses, tags, notes, search, filters |
| Queue | On | Ordered list of videos to watch next |
| Sharing | On | Send an item to another person on the instance |
| Statistics | On | Pace, time spent, streaks, pile trend |

### 5.1 Core — Library

**Input**: **URL**. Optional: tags, note, type (`article` / `video` / `podcast` / `website` / `repo`, inferred otherwise), status (`To watch` by default).

**URL normalisation**: scheme and host lowercased; fragment, tracking parameters (`utm_*`, `fbclid`, `gclid`, `mc_*`, `ref`, YouTube `si`) and trailing slash removed; remaining parameters sorted; `youtu.be/<id>` and `youtube.com/shorts/<id>` → `youtube.com/watch?v=<id>`. **Maximum length 2,048 characters** (refused with 422 beyond).

**Metadata fetching** (SSRF-protected): http/https, ports 80 and 443 only (8080 and 8443 tolerated), DNS resolution then refusal of private, loopback, link-local and reserved IPs, connection pinned to the verified IP, 5 s, 2 MB, 3 redirects re-verified. Sources in priority order: OpenGraph, Twitter cards, `<title>`, `<link rel=icon>`, `/favicon.ico`. YouTube: oEmbed + duration read from the page.

**Computations**
- Inferred type = `podcast` if the host is a podcast platform (Apple Podcasts, Spotify `/episode` and `/show` pages, Castbox, Ausha…) or if the page declares a `PodcastEpisode` / `PodcastSeries` in JSON-LD; otherwise `video` if the host is a known video platform (YouTube, Vimeo, Dailymotion, Twitch, PeerTube via `og:type=video`) or if `og:type` starts with `video`; `repo` for `github.com`, `gitlab.com`, `codeberg.org/<owner>/<repo>`; `website` for a home page; otherwise `article`. The user can correct it (`type_override`).
- A repository's stars = `stargazers_count` (GitHub), `star_count` (GitLab), `stars_count` (Codeberg), read from the host's public API. A value older than 6 h is re-read when the library is displayed (10 repositories at most per request, 3 s at most, the old value is kept if the API does not answer).
- Reading time = `max(1, ceil(body words / 230))` minutes, confidence `estimated`. Unknown if the page could not be read.
- Video or podcast duration: confidence `measured` when it comes from the platform (JSON-LD `duration`, `music:duration`), `unknown` otherwise (never guessed).

**Duplicate**: adding a URL that is already present creates nothing; the response returns the existing item with the `already_in_library` warning, and the interface opens the card.

**Refresh**: restarts the fetch; the response says whether it succeeded (`refreshed: true | false` + reason). The interface never announces a success that did not happen.

**Quick capture**: a URL field pre-filled from the clipboard **only on action** (a "Paste" button), never read on open. Live card preview, "Add to Vigie" button.

**Search**: title, site, URL, notes, tags (`ILIKE` + `pg_trgm`). Filters: status, type, tag, source, shared with me, in the queue, length. Filters live in the URL.

**Length filter ("I have 20 minutes")**: `length=short|medium|long` in the URL, computed by the API in a pure, tested function.
- Effective length = `duration_seconds` for a video or podcast, `reading_time_minutes × 60` for an article; repositories and websites have none.
- `short` = under 10 min (< 600 s), `medium` = 10 to 30 min (600 s ≤ x ≤ 1,800 s), `long` = over 30 min (> 1,800 s).
- An item without a known length never matches a length bucket, and the filter says what it leaves out ("4 items without a known length are hidden"). It is a filter the user chooses, never a ranking.

**Saved views**: a named set of library filters, i.e. the library URL query (status, type, length, tag, search; canonical: known keys and values only, defaults dropped, keys sorted).
- Stored on the account (`SavedView`), so every device sees the same views; 20 per account at most, name 1 to 40 characters, unique per account.
- Created from the library when at least one filter is active: "Save this view" asks for a name (prefilled from the filters, e.g. "Videos · short"). Applying a view replaces the current filters; the active view is marked as selected.
- **Desktop and tablet landscape**: listed in the left sidebar under Library, in the user's order (drag to reorder), rename and delete from the row's menu.
- **Mobile and tablet portrait**: a horizontal row of chips at the top of the library, hidden when there is no view; long press opens rename / delete.
- A view never stores results: it is re-run every time. A view whose tag was deleted shows an empty result with "This tag no longer exists".

**Delete and Seen without confirmation, with Undo**
- **Delete** removes the card at once and shows a toast "Removed “title” · Undo" for 5 s (title cut to about 40 characters, the custom title if renamed). The `DELETE` request is sent when the toast ends, or right away (`keepalive`) if the page is hidden or closed. Undo therefore never needs a server-side restore. If the request fails, the card comes back with an error toast.
- **Mark as seen** applies at once (request sent immediately) and shows "“title” marked as seen · Undo" for 5 s; Undo sends the item back to To watch, and to its former queue position when it was queued (the toast then says it was removed from the queue). The journal records `seen` then `unseen`, so the statistics stay right (§5.4: a `seen` followed by an `unseen` in the same period does not count).
- Deleting a saved view uses the same Undo toast. A confirmation stays only where an Undo cannot work: deleting the account, revoking an API token, deleting a contact (its history is involved).

**Display**: a grid / list toggle in the Library header (also in Settings; saved on the account, one value for phones and one for tablet and desktop). Grid: cards (image, title, site + favicon, duration or reading time, tags, state), the site line pinned to the bottom so cards in a row line up; on a phone, two columns of equal height. List: a wide row on tablet and desktop, the swipe row on a phone. Missing image → the art-direction thumbnail (no random gradient).

**Item actions**: there is no hover check on cards and rows. Every action (open the link, mark as seen / back to watch, add to or remove from the queue, share, rename, details, delete) lives in one menu, opened by right-click, long press, or the "⋯" button (shown on hover, always visible on touch screens). The row stays highlighted while its menu is open, and only one menu can be open at a time. Detail: metadata, note, tags, item history (added, seen, shared by…).

### 5.2 Queue

**Rule**: an item is in the queue if it has a `queue_position`, whatever its type. Positions are 0-based, contiguous per user, and compacted on every add, move or removal.

**Automatic exit**: marking Seen or deleting removes it from the queue.

**Display**: reorderable cards (a drag handle, by finger and by keyboard; image cropped to a fixed size), with the same item menu as the Library (open the link, details, mark as seen, move to the top / up / down, remove from the queue); the title opens the link and "Details" opens the inspector. The first item is marked "Up next". Total queue duration = Σ known durations, confidence `partial` if at least one duration is unknown ("≈ 2 h 40, 2 videos without duration").

### 5.3 Sharing

**Input**: **recipient's e-mail address**, optional message (280 characters).

**Effect**: creates a `To watch` item for the recipient with `shared_by` and the message; the sender's notes and tags are not copied. If the recipient already has the resource, their item gets the share mention without changing status.

**Anti-enumeration**: the response never depends on whether the address has an account. The same answer comes back for a registered and an unregistered address, and the sender never sees a delivery status.

**Contacts** (a private address book): each user keeps their own contacts, for any e-mail address, named whatever they type. Nobody else sees them, the name never comes from the other person's profile, and no link or acceptance is needed. They are managed in *Shared → Contacts*.
- By default every address a user shares with is saved as a contact. An "Automatically save recipients" setting turns this off; the share dialog then offers "Save as contact?" for the new addresses.
- The recipient field suggests contacts first (most recent first) and still accepts any e-mail address.
- Each contact has a read-only conversation-style history: what the user sent (right) and what that person delivered to them (left), with dates. A share sent to an address before it had an account never shows as received.
- A contact can be renamed or deleted at any time. Deleting keeps the history, which comes back if the address is added again; items already received stay.

**Limits**: 50 shares per day per account.

### 5.4 Statistics

Period `week` (Monday → Sunday) / `month` / `year`, navigable, in the **account's time zone** (`users.timezone`, IANA, detected at sign-up, editable).

**Computations** (on the `item_events` journal, principle 2)
- **Seen over P** = number of distinct resources having a `seen` event in P that is not followed by an `unseen` in P. Deleting the item later does not change this number.
- **Added over P** = distinct resources having an `added` in P.
- **Watch time over P** = Σ `duration_seconds` of videos seen over P. Confidence `measured` if all durations are known, otherwise `partial` with the number of videos without duration.
- **Reading time over P** = Σ reading time of articles seen over P, confidence `estimated` (230 words/min).
- **Delta** = `(P − P₋₁) / P₋₁`. If `P₋₁ = 0`: no percentage, "new" shown.
- **Current streak** = number of consecutive days with at least one `seen`, counting back from today; if today has nothing yet, we start from yesterday and the streak is marked "to extend today". **Record** = longest streak in the journal.
- **Pile (backlog) on day D** = Σ up to D of `added` (+1), `seen` (−1), `unseen` (+1), `deleted` of a To watch item (−1). Trend = slope over the last 28 days: "you're catching up" if < 0, "stable" if |slope| < 0.1/day, "it's piling up" otherwise.
- **Top tags / sources** of P = current tags and `site_name` of the items seen over P; basis shown ("out of 31 seen items still in your library") because a deleted item no longer has tags.
- **Goals** (rings): weekly goal of items seen and of watch time, **stored on the account** (`module_settings`), not in the browser.

**Display**: goal rings, articles / videos histogram with the previous period as a ghost, key figures with delta, streak, pile trend, tops (click → filtered library). Every chart has its table alternative.

## 6. Capture from anywhere and portability

The goal "capture in under 3 seconds from anywhere" (§2) is met by four doors, all ending in the same `POST /api/items` (same normalisation, same duplicate rule, same refusal of invalid URLs).

### 6.1 Personal API tokens

- Created in *Settings → Capture*: a name (1 to 50 characters) and a scope, `capture` (add a link and read back the item it created, nothing else) or `full` (the whole API of the account).
- The token (`vig_` + 32 random bytes, base64url) is **shown once**, with a Copy button; only its SHA-256 hash is stored. The list shows name, scope, creation date and last use ("Used 2 h ago", "Never used").
- Sent as `Authorization: Bearer vig_…`. A revoked token, a token of a deleted account, or a `capture` token on another route answers **401**, never a hint of what exists. 20 tokens per account at most; the same rate limits as a session.
- "Sign me out everywhere" and a password change do **not** revoke tokens (they are for devices without a session); deleting the account does. Revoking asks for a confirmation (it breaks a shortcut somewhere).

### 6.2 Android: Web Share Target

- The installed PWA declares a `share_target` (`GET /share?title&text&url`). Vigie appears in Android's share sheet.
- Android always opens a PWA to receive a share; Vigie cannot add in the background. So `/share` is a small "Added" screen that adds **on arrival, with no button to press**: it shows the card (title, site, length), "Added to your library" (or "Already in your library"), and three actions: Undo, Add to queue, Open. The user goes back to the app they came from with the system Back.
- The URL is taken from `url`, otherwise the first `http(s)` link found in `text`, then in `title` (apps put it in different fields). No link found → "This share has no link" and a field to paste one.
- Not signed in → sign-in, then the share is added (the URL survives the sign-in).
- Accepted risk: a third-party page could open `/share?url=…` and add a link to a signed-in user's library. Nothing leaks, the result is on screen with Undo, and the add is rate-limited like any capture.

### 6.3 iPhone and iPad: Shortcut

- iOS PWAs cannot be share targets. *Settings → Capture → iPhone shortcut* gives a step-by-step guide (with the instance address and a "Create a capture token" button) to build an Apple Shortcut that appears in the share sheet, calls `POST /api/items` with the token and shows a system notification "Added to Vigie" or "Already in your library", **without opening Vigie**.
- The guide is text and screenshots of the Shortcuts app; no shortcut file is distributed (the instance address and the token differ for everyone).

### 6.4 Bookmarklet (desktop)

- *Settings → Capture → Bookmarklet*: a link to drag into the bookmarks bar, with the instance address baked in.
- Clicking it opens a small window (420 × 560) on `/share?url=<current page>`: the same "Added" screen as Android, signed in with the session cookie (no token). The window closes itself 2 s after a successful add unless the pointer is over it.

### 6.5 Export

- *Settings → Data*: two buttons, **JSON** and **CSV**, one click each, downloaded at once (generated on the fly, no job, no e-mail).
- **JSON** (`vigie-export-YYYY-MM-DD.json`, `"format": "vigie-export", "version": 1`): account (name, e-mail, language, time zone, modules and goals), items (URL, original title, custom title, type, status, note, tags, queue position, sender's name and message, added / seen / opened dates), the journal (`item_events`), contacts, saved views. Never: password hash, tokens, sessions, other accounts' data.
- **CSV** (`vigie-export-YYYY-MM-DD.csv`): Pocket's columns, so other apps can read it: `title,url,time_added,tags,status`; `time_added` = Unix seconds, `tags` joined with `|`, `status` = `unread` (To watch) or `archive` (Seen).
- Rate-limited (10 exports per hour per account).

## 7. Home (Library)

- **Capture bar**: paste a link, always visible on desktop, behind the central action on mobile.
- **To watch**: the cards, newest first, filters at the top.
- **Next video** from the queue (if the Queue module is on): a wide card, "Watch".
- **Recently received** (if the Sharing module is on): unopened shares, with the sender's note.
- **This week's pace** (if the Stats module is on): seen this week vs goal, streak.

## 8. Signals (in-app)

No push notifications in the MVP. Badges in the navigation:
- **Unopened received shares**: counter on the Shared tab.
- **Pile building up**: one line on home when the trend is "it's piling up" three weeks in a row, with the "See the oldest" action.

## 9. Settings

**Account**: first and last name (50 characters each), e-mail, password, language (`auto` / `en` / `fr`), theme (`system` / `dark` / `light`), time zone, sign me out everywhere, delete my account.
**Capture**: API tokens, iPhone shortcut guide, bookmarklet (§6).
**Modules**: Queue, Sharing, Statistics (switches, saved on toggle), goals, who can send me shares.
**Data**: export JSON / CSV (§6.5).
**Administration** (admin): registration mode, invitees, accounts.

## 10. Tech stack

| Layer | Choice |
|---|---|
| Front end | React 19 + Vite + strict TypeScript, **PWA** (`vite-plugin-pwa`), TanStack Query, `openapi-fetch` + generated types, React Router, **Tailwind CSS v4** whose theme (`@theme`) reuses the art-direction tokens as they are (`tokens.css`), in-house SVG for charts, in-house i18n (`lib/i18n.ts`, typed `en` / `fr` dictionaries, `Intl` for numbers and dates) |
| Back end | Python 3.13 **FastAPI**, SQLAlchemy 2 async (asyncpg), Alembic, Pydantic v2, `pydantic-settings`, `httpx` + `selectolax`, Argon2 (`pwdlib`), PyJWT, managed with `uv` |
| Database | **PostgreSQL 17** (`pg_trgm`) |
| E-mail | Optional SMTP (`SMTP_*`): verification, reset, invitations. Without SMTP, everything works through links generated by the admin |
| Infra | Docker Compose: `web` (**Caddy**: SPA, `/api` proxy, automatic HTTPS if `VIGIE_DOMAIN` is set, security headers), `api` (non-root), `db` (not exposed). Images published on `ghcr.io` |
| Quality | `pytest` (real Postgres), `ruff check` + `ruff format`, `tsc -b`, ESLint; GitHub Actions on every PR, Dependabot |
| Public instance deployment | Self-hosted GitHub runner on the instance's server, behind a Cloudflare tunnel |

**Deviations from the blueprint, and why**: real PostgreSQL in tests (not SQLite) because search (`pg_trgm`), per-time-zone aggregates and `SKIP LOCKED` are specific to Postgres; **Tailwind kept** (the author's choice, already in the code): the art-direction tokens feed its theme, with no hard-coded colour or size outside tokens; i18n and error codes on the API side instead of French text in the back end, because the interface is bilingual; images published on `ghcr.io` so that self-hosting needs no build.

### Data model (sketch)

```
User(id, email, password_hash, first_name, last_name, role, token_version, locale, theme, timezone, email_verified_at, receive_shares, created_at)
UserModule(user_id, module, enabled, settings_json)
Resource(id, url, url_hash, type, title, description, image_url, site_name, favicon_url, duration_seconds, reading_time_minutes, fetch_status, fetched_at)
Item(id, user_id, resource_id, status, type_override, notes, seen_at, queue_position, shared_by_user_id, share_message, opened_at, created_at)   unique(user_id, resource_id)
Tag(id, user_id, name)  ItemTag(item_id, tag_id)
ItemEvent(id, user_id, item_id?, resource_id, kind, occurred_at)   kind ∈ added | seen | unseen | deleted | shared
Contact(id, owner_user_id, email, name?, created_at, updated_at)   private address book, unique(owner_user_id, email)
ShareLog(id, sender_user_id, recipient_email, recipient_user_id?, resource_id, message, shared_at)   recipient_user_id never exposed to the sender
InstanceSettings(registration_mode, updated_at, updated_by)
Invitation(id, email, created_by, created_at, used_at)
ApiToken(id, user_id, name, token_hash, scope, last_used_at, created_at)
PasswordReset(id, user_id, token_hash, expires_at, used_at)
SavedView(id, user_id, name, query, position, created_at, updated_at)   unique(user_id, name)
```

`Resource.url` is no longer indexed directly: uniqueness is on `url_hash` (SHA-256), which lifts the btree index size limit.

## 11. Art direction

Visual reference: `vigie-da.html` (tokens copied as they are into `tokens.css`, classes reused in `base.css`).
- Metaphor: **the screen of a navigation instrument at night**. What arrives is an echo, what is seen fades out, goals read like a radar screen (concentric rings).
- "Echo" accent: phosphor green (`#B8F25C` dark, `#A6E33F` light; stroke `#3B6A00` in light), reserved for **three things**: the screen's main action (Add, Send, Create), what is new (unopened share, today's addition), the "now" point of charts. Fills use `--accent`, small marks (dots, focus) use `--accent-ink`.
- **What is seen fades out**: a Seen item = title in secondary colour, image in dimmed greyscale; no badge.
- Reference theme: **dark**; light reuses the same roles. Dark / Light / System selector.
- Typography: **Geologica** only, two weights (500 titles and numbers, 400 text), tightening reserved for large sizes, tabular figures everywhere.
- States: `ok` blue "you're catching up", `watch` yellow "stable", `plan` orange "behind", `over` red "it's piling up" (the only red state, together with deletions), `unknown` grey "unknown"; none reuses the accent green.
- Icons: **Solar** (480 Design, CC BY 4.0), `linear` everywhere, `bold` for the active tab or entry, embedded at build time.
- Missing image: monogram thumbnail (the site's initial) on `--surface-2`; metadata unavailable: dashed thumbnail + "Retry".

### Navigation by platform

- **Mobile**: bottom tab bar: Library, Queue, **central "Add" action**, Shared, Stats. The central action opens full-screen capture (URL field, "Paste", preview, sticky "Add to Vigie" at the bottom). Settings from the Library header.
- **Tablet portrait**: side icon rail (navigation only, no logo and no Add button: the Library header has the capture bar), capture in a modal.
- **Tablet landscape and desktop**: full sidebar (active modules, then Settings, then the account). Capture bar in the Library header, inspector on the right from 1,280 px.

## 12. Roadmap

The current code (a working MVP: library, queue, sharing, stats) is **taken over, not rewritten from scratch**: each phase keeps what is sound and brings it back to this document's rules.

**Takeover, in build order**
0. **Honest Git history**: initial commit (vision + art direction), then import of the existing code as is, then clean-up (dead code, duplicates, outdated docs).
1. **Safe, self-hostable foundation**: refusal of default secrets, hardened compose (database not exposed, non-root, pinned images), Caddy + automatic HTTPS, rate limiting, registration mode editable by the admin + first admin + invite list + first / last name, revocable sessions, password change, account deletion, guard on the test database, network-outside-transaction fix, URL ≤ 2,048 / `url_hash`. LICENSE, English README, CONTRIBUTING, SECURITY, CI.
2. **Front-end foundations**: art-direction tokens wired into the Tailwind theme (`@theme`) and components restyled to the art direction, mobile shell / rail / sidebar, `en` / `fr` i18n, generated `openapi-fetch` client, Dark / Light / System theme, service-worker cache cleared on sign-out. Library, capture and detail ported.
3. **Modules**: `UserModule` table, Queue and Sharing ported (anti-enumeration, private contacts and history), honest "Refresh".
4. **Statistics on the journal**: computations of §5.4 as tested pure functions, goals on the account, explanation + confidence on every number.
Phases 0 to 4 are done (v1.1.0). Next, in build order:

5. **Faster library**: import removed (button, copy, docs), Delete and Seen with Undo instead of a confirmation, length filter (§5.1).
6. **Saved views**: `SavedView` table and routes, sidebar list on desktop, chip row on mobile (§5.1).
7. **Capture everywhere**: API tokens, Web Share Target (Android), iPhone shortcut guide, bookmarklet (§6.1 to §6.4).
8. **Export**: JSON and CSV (§6.5).
9. **Triage mode and dusty links** (to be specified before it starts): one card at a time, swipe right = queue, left = delete, up = Seen (keys too); "23 links added more than 3 months ago: keep them?" opens triage on those.
10. **Public instance**: SMTP (verification, reset, e-mail invitations), image proxy (hides visitors' IPs from third-party CDNs), Privacy and Terms pages, administration.
→ `unslop` pass on the real app, `ghcr.io` images, public instance deployment, self-hosting guide.

**Parked** (kept, not scheduled): keyboard shortcuts (`j`/`k`, `s` Seen, `q` queue, `e` send, `/` search, `?` help) and a `⌘K` palette (add + search); multiple selection (tag, Seen, queue, delete in bulk); chained queue playback (embedded `youtube-nocookie` player, "Mark as seen and play next"); partial progress ("resume at 12 min").

**V1.1**: `tsvector` full-text search (`english` / `french`), browser extension, RSS feeds (feed → To watch items), Web Push notifications for shares.

**V2**: shared collections, optional AI summaries (key provided by the instance), offline reading in reader mode.

## 13. Open questions

1. **Public instance capacity**: can the server handle a few thousand accounts (fetch CPU, image proxy bandwidth)? We measure it during the `invite` phase before opening.

### Settled

- Name: **Vigie** (chosen together with the art direction), repository `vigie`.
- Public instance: port `8101` by default, `invite` mode, its owner the only admin.
- Pre-production: port `8102` by default, separate database and volumes (compose project `vigie-pp`), `ALLOWED_EMAILS` allow-list (the owner only; other addresses are added in the server's `.env`). The `preprod` branch deploys there, `main` goes to production: a feature goes through `preprod` first, then is merged into `main` once validated.
- Sharing: contacts are a private address book, saved automatically when a share is sent (or on request); first and last name asked at sign-up, with the reason shown.
- Translations: dictionaries in the repository; a community platform only when other languages are requested.
- Stats after deletion: tags and source are not frozen into the event; the basis is shown.
