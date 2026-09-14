# Admin Category Handoff — Services & Sub-services

Hand this folder to the admin-panel developer. It is generated from the live frontend catalog in `lib/data/services.ts`.

## What’s inside

| File | Use |
|---|---|
| `categories-seed.json` | Full machine-readable seed (parents + children) |
| `categories-seed.csv` | Spreadsheet-friendly import checklist |
| `assets/icons/*.svg` | Main category icons (upload to CDN / admin media) |
| `assets/images/service-*.jpg` | Main category hero images |

**Totals:** 10 parent services · 83 sub-services

## Admin Category model mapping

Backend model: `Category` (`parentCategory`, `name`, `slug`, `tagline`, `filterGroup`, `status`, `images[]`, `commonServices[]`, `workingArea[]`, `sortOrder`)

### Create order
1. Create **all 10 parents** first (`parentCategory = null`).
2. Upload each parent’s **icon SVG** + **hero JPG** into `images[]` (or your icon field if separate).
3. Create **children** with `parentCategory = <parent ObjectId>`.
4. Keep **slugs exactly as listed** — public quote matching and URLs depend on them.

### Field guide

| Seed field | Admin / API field |
|---|---|
| `name` | `name` |
| `slug` | `slug` (unique, lowercase) |
| `tagline` | `tagline` |
| `description` | store in CMS or ignore if not in schema yet |
| `status` | `active` |
| `sortOrder` | `sortOrder` |
| `filterGroup` | parents: `""` · children: parent slug |
| `commonServices` | parents only — optional duplicate of child names |
| `iconAssetFile` | upload `assets/icons/...` |
| `imageAssetFile` | upload `assets/images/...` into `images[0]` |
| `lucideIconKey` | frontend Lucide key (optional UI hint: `droplets`, `zap`, …) |

> Do **not** copy frontend ids like `cat_plumbing`. Mongo will assign ObjectIds.

## Parent services (main)

| # | Name | Slug | Icon file | Image file |
|---|---|---|---|---|
| 1 | Plumbing | `plumbing` | `plumbing.svg` | `service-plumbing.jpg` |
| 2 | HVAC | `hvac` | `hvac.svg` | `service-hvac.jpg` |
| 3 | Electrical | `electrical` | `electrical.svg` | `service-electrical.jpg` |
| 4 | Handyman | `handyman` | `handyman.svg` | `service-handyman.jpg` |
| 5 | House Cleaning | `house-cleaning` | `house-cleaning.svg` | `service-cleaning.jpg` |
| 6 | Roofing | `roofing` | `roofing.svg` | `service-roofing.jpg` |
| 7 | Landscaping | `landscaping` | `landscaping.svg` | `service-landscaping.jpg` |
| 8 | Painting | `painting` | `painting.svg` | `service-painting.jpg` |
| 9 | Bathroom Remodeling | `bathroom-remodeling` | `bathroom-remodeling.svg` | `service-bathroom.jpg` |
| 10 | Pest Control | `pest-control` | `pest-control.svg` | `service-pest.jpg` |

## Sub-services

Every parent’s `children[]` in `categories-seed.json` is a sub-service.

Slug pattern: `{parentSlug}-{slugified-name}`  
Example: `Leak detection and repair` → `plumbing-leak-detection-and-repair`

Children may **reuse the parent icon/image** until dedicated media exists.

## Recommended admin UX

1. **Bulk import** from `categories-seed.json` (best), or
2. Open CSV in Sheets → create parents → create children row-by-row, or
3. One-time seed script on backend using the JSON.

## Acceptance checklist

- [ ] 10 active parent categories with exact slugs above  
- [ ] 83 active child categories linked to correct parents  
- [ ] Each parent has icon SVG + hero image uploaded  
- [ ] `GET /api/public/categories` returns parents + children  
- [ ] Frontend Find-a-Professional / quote intake shows live categories (not seed `cat_*` ids)

## Notes for frontend sync

After admin seed is live, frontend should prefer API categories (`categoriesSlice`) over `lib/data/services.ts` seed. Seed file remains fallback/demo only.
