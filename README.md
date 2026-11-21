# myshop

Coffee shop reviews. Sister site of [mypod](https://mypod.pages.dev) (coffee pods). Same tasting-sheet idea, a different cup: every visit prints like a till receipt, itemised as coffee, space, service and value, with one honest total.

- Data: `data/shops.json` and `data/reviews/<shopId>.json`. Format and how to add a review: [DATA.md](DATA.md).
- Build: `npm ci && npm run build` (Node 20.9+, sharp installed from the lockfile) writes `dist/`.
- Tests: `npm test` (schema, build, headers, mypod-carried rules).
- Private writer: `/write/` on the built site makes the JSON locally; nothing is uploaded.
- Deploys: see [AGENTS.md](AGENTS.md).
- Design: built from scratch with [katkit](https://katkit.pages.dev). Concept: *this review log behaves like a till receipt so every visit reads as itemised lines adding to one honest total.* Palette family and fonts (Big Shoulders Display, DM Sans; SIL OFL) shared with mypod.

Made by [Kat Lovelace](https://lovelace.yv3.uk).
