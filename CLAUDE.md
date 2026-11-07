# Vigie

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first (specs, dev mode, tests, commits).

## Environments: preprod first, production on request

Every feature and every bug fix is done on the `preprod` branch, never directly on `main`: commit, push to `preprod` (it deploys to https://vigie-pp.theosementa.fr) and let the user check it there.

Production only gets it afterwards, in one of two ways:
- the user clicks **Promote to production** in GitHub (Actions tab, "Run workflow");
- or the user asks you to promote: run `gh workflow run promote.yml --ref main`, then check the production deploy. Never promote, push to `main` or merge into it without that explicit request.

Details (branches, ports, `ALLOWED_EMAILS`) are in "Environments" in `CONTRIBUTING.md`.

## UI quality bar: keep it smooth

Every open/close, resize and reorder animates smoothly with no visible glitch (no jumping columns, no text re-wrapping mid-animation, no content blanking while something closes). Follow "Motion and smoothness" in `CONTRIBUTING.md`, and measure resize animations per frame rather than trusting a screenshot.
