# Vigie

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first (specs, dev mode, tests, commits).

## Environments: preprod first, production on request

Every feature and every bug fix is done on the `preprod` branch, never directly on `main`: commit, push to `preprod` (it deploys to the pre-production instance) and let the user check it there.

Production only gets it afterwards, in one of two ways:
- the user clicks **Promote to production** in GitHub (Actions tab, "Run workflow");
- or the user asks you to promote: run `gh workflow run promote.yml --ref main`, then check the production deploy. Never promote, push to `main` or merge into it without that explicit request.

Details (branches, ports, `ALLOWED_EMAILS`) are in "Environments" in `CONTRIBUTING.md`.

## UI quality bar: keep it smooth

Every open/close, resize and reorder animates smoothly with no visible glitch (no jumping columns, no text re-wrapping mid-animation, no content blanking while something closes). Follow "Motion and smoothness" in `CONTRIBUTING.md`, and measure resize animations per frame rather than trusting a screenshot.

## Security

Before touching auth, sharing, invitations, outbound fetches, SQL or HTML rendering, read "Rules for contributors" in [`SECURITY.md`](SECURITY.md). In particular: never reveal whether an email has an account.

## Pull requests from forks: the deploy runner is self-hosted

`deploy.yml` runs on the maintainer's own server (`runs-on: [self-hosted, vigie]`). A fork PR can change a workflow file, so approving its Actions run executes its code on that server. Before approving a run, or merging, read the diff of anything touching `.github/` (workflows, `dependabot.yml`), the `Dockerfile`s, `docker-compose*.yml`, `Caddyfile` and `scripts/`. Never approve the run of a PR that edits `.github/` or adds a `runs-on` label you do not recognise. Keep `ci.yml` and any workflow triggered by `pull_request` on `ubuntu-latest`; only the push-triggered `deploy.yml` may use the self-hosted runner.
