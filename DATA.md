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

## Photos

Reviews may include `photos: [{ "file": "data/photos/<shopId>/counter.jpg", "alt": "A useful image description", "caption": "Optional caption" }]`. All three keys are required; caption may be empty. Use safe lowercase filenames (letters, numbers and hyphens). At most 12 still JPEG, PNG, WebP or AVIF photos per shop, 25 MB and 60 megapixels each. Paths must belong to that shop. Keep original metadata out of git: use the writer's cleaned downloads, not camera originals.

At /write/, attach photos, enter an image description for each, optionally add captions, then choose Make JSON. Download the review JSON and each cleaned photo using its download button. Put the JSON in data/reviews/<shopId>.json and photos in data/photos/<shopId>/. New shops also need the generated shop entry in data/shops.json. Send Kat the JSON and cleaned photos if you prefer it to publish them. There is no server upload.

Importing a review preserves its photo references; existing photos do not need downloading again. Replacing them is explicit via Remove and Attach. The writer decodes and re-encodes photos locally, so no EXIF or GPS leaves the device in its downloads. It requires a modern browser; export HEIC to JPEG first.

The build auto-orients, decodes to bare pixels, and re-encodes only WebP and JPEG at 480, 960 and up to 1600 pixels, without enlarging. Metadata is stripped regardless of what the source contains. Camera originals are never copied to dist. Public HTML uses responsive source sets, lazy loading, intrinsic dimensions and native keyboard-operable details/summary enlargement. No gallery JS or relaxed CSP is needed. Reviews expose image URLs in Review JSON-LD, /api/reviews.json and /review/<shopId>/index.md.

A shop with photos but no review stays explicitly unrated, with no Review schema or invented score, at /photos/<shopId>/. These photos are also in /api/photos.json and /photos/<shopId>/index.md. Check visible faces, number plates and personal details before publication: metadata cleaning does not remove things visible in the picture.

## One-file writer import

The writer downloads one JSON bundle with `shop` and `review`. Photos are resized to 1600px and re-encoded through browser canvas before embedding as JPEG data URLs. New and existing shops are included in the same file.

Run `node tools/import-review.mjs /path/to/download.json`. The importer validates both records, rejects unsafe paths/symlinks and oversized images, decodes and re-encodes raw pixels to strip metadata again, writes cleaned photos under `data/photos/<shopId>/`, updates the shop record, and writes the plain review JSON. Run `npm test`, commit all changed data/photos, merge and deploy master. Never commit the download itself.

The shop-level optional boolean `paymentSumUp` is controlled by the writer's Takes SumUp checkbox. Only mark it when confirmed. The configurable `SUMUP_REFERRAL` in tools/build.mjs is a personal spending referral, not a merchant-processing offer. Empty it to disable referral links. Terms checked 21 November 2026 at https://www.sumup.com/en-gb/personal/referrals/ and https://www.sumup.com/en-gb/personal/legal/refer-a-friend/. No blanket 5% or no-fees claim is made.
