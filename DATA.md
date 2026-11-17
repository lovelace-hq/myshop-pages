# myshop data

Two things, both plain JSON, both validated in CI and by `npm test`:

- `data/shops.json` is the list of shops (an array). Schema: `data/shops.schema.json`.
- `data/reviews/<shopId>.json` is the review for one shop. Schema: `data/review.schema.json`. One file per shop; a re-visit replaces the file (the git history keeps the old one).

**Privacy rule:** never publish a street address or phone number, in either file. `area` is a town or neighbourhood only. The tests fail the build if an `address`/`phone`/`tel` field or a phone-like number appears in the data.

## Adding a shop and a review

1. Open `/write/` on the site (or locally). Fill in the form. It never uploads anything.
2. If the shop is new, copy the **shop entry** into `data/shops.json`.
3. Copy the **review JSON** to `data/reviews/<shopId>.json`.
4. Open a PR, get CI green, merge to `master`. The deploy workflow publishes it.

Or paste JSON straight into the files by hand: the shape is below.

## shops.json

```json
[
  { "id": "example-roasters", "name": "Example Roasters", "area": "Leith, Edinburgh", "website": "https://example.com", "blurb": "Small bar, one grinder." }
]
```

`website` and `blurb` are optional. `id` is a lowercase slug and becomes the URL: `/review/<id>/`.

## review file

```json
{
  "shopId": "example-roasters",
  "reviewed": true,
  "date": "2026-11-17",
  "visit": { "drink": "Flat white", "priceGbp": 3.6, "when": "Saturday 10am", "seat": "in", "milk": "Whole" },
  "coffee": {
    "score": 82,
    "notes": "Sweet, clean, a little short.",
    "aroma":     { "quantity": 40, "quality": 55, "notes": "" },
    "acidity":   { "quantity": 20, "quality": 30, "notes": "" },
    "sweetness": { "quantity": 60, "quality": 70, "notes": "" },
    "body":      { "quantity": 35, "quality": 45, "notes": "" },
    "finish":    { "quantity": -20, "quality": 10, "notes": "" }
  },
  "space":   { "score": 70, "notes": "Bright, loud at the counter." },
  "service": { "score": 90, "notes": "Quick and warm." },
  "value":   { "score": 60, "notes": "Fair for the area." },
  "flavour": "Caramel, hazelnut.",
  "overall": 78,
  "notes": "Would go back."
}
```

- **Pillars** (`coffee`, `space`, `service`, `value`): `score` is a whole number 0-100 and drives the public score bars. `null` = not recorded; it renders as "not recorded", never as 0.
- **The cup** (`coffee.aroma` ... `finish`) uses the same tasting-sheet lines as mypod (adapted from the Prufrock sheet): `quantity` and `quality` are line positions from -100 (left end) to 100 (right end), 0 at the centre. `null` = not recorded.
- **`overall`** is your own enjoyment out of 100. It is not computed from the pillars.
- **`reviewed: false`** means a placeholder; it is not published. A shop in `shops.json` with no reviewed file shows as "on the list".
- The `date` decides feed order (newest first; ties broken by shop id).

A copy of this example lives at `docs/example-review.json`. It is documentation only and is never built into the site.
