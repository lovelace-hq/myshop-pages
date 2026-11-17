# AGENTS.md

## Deployments

- **Production deploys happen through the GitHub Actions workflow 'Deploy myshop'**, which runs from the default branch (`master`) after the checks pass. Do not deploy from a feature branch or a preview alias, not even "just to test": a manual upload makes live differ from git and the next real deploy silently overwrites it.
- To ship a change: open a PR, get CI green, merge to `master`, and let the workflow deploy. To redeploy without a change, re-run the workflow (`workflow_dispatch`) on `master`.
- **Bootstrap/outage exception (owner-authorised):** if GitHub Actions is down, the owner has said a manual `wrangler pages deploy dist --project-name=<project> --branch=master` from a clean checkout of `master` at the tagged commit is acceptable. Afterwards re-run the workflow when Actions is back, so live and git agree again.
- `.github/workflows/drift.yml` builds `master` every day and diffs the output against the live site (ignoring Cloudflare's injected analytics script). If live differs it opens a `deploy-drift` issue. Fix drift by merging to `master` or re-running the deploy workflow.
- Deploys are off until the repo variable `CF_PAGES_PROJECT` is set to the confirmed Cloudflare Pages project name (the name `myshop` is not ours: myshop.pages.dev belongs to someone else).
- Cloudflare credentials belong to GitHub Actions secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`), never to files in this repo.

## Rules shared with mypod (enforced by `npm test`)

- No cookie banner, no popups, no third-party scripts. Cookieless Cloudflare Web Analytics only if added later (then update `_headers` CSP and the privacy page together).
- Footer credit: "Made by Kat Lovelace" linking https://lovelace.yv3.uk.
- Organization JSON-LD carries the contact email `myshop@lovelace.yv3.uk` only. Never publish an address or phone number, anywhere, including review text.
- The Awin comment `<!-- Awin : We approve this site for @yv3.uk on <UTC datetime> -->` stays in every page's `<head>` (value in `site-config.json`).
- Artwork is reused from mypod (its capsule icon, byte-identical, and its specimen-dot style), never redrawn.
- Sister-site link to mypod on every page.

## Data

See `DATA.md`. Shops in `data/shops.json`, one review per shop in `data/reviews/<shopId>.json`. Zero reviews is a valid, designed state.
