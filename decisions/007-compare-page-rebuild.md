# 007. Rebuild the Compare page on the shared design and real detection

- **Date:** 2026-11-27
- **Status:** Accepted

## Context
The before/after comparison page (added in PR #2) did not load the shared styles or navbar, used `alert()` pop-ups, called no backend, and always showed hardcoded sample numbers. Its categories (Bottle, Can, Paper, Plastic) also did not match the rest of the site.

## Decision
The page keeps its purpose and layout idea (two uploads, totals, reduction percentage, category table) and is rebuilt on the shared pieces:

- Shared navbar (with a new **Compare** item), `global.css` tokens, buttons, cards, alerts and stat row.
- Both images go through `detectWaste()` in `api.js`, at the same time, so the page uses exactly the same request, validation and error messages as Scan & Detect. Upload checks and error messages now live in `js/upload.js`, which both pages use.
- Results use the same Plastic / Paper / Metal / Other categories and colours, with annotated images, before/after totals, a per-category change column and a total row.
- Edge cases are explained in words: nothing detected before (no percentage possible), nothing after, or waste increased (shown as "Waste increase" in red).

## Consequences
- Compare looks and behaves like the rest of the app and works on phones.
- The hardcoded sample data is gone; the page only shows real results.
- A comparison PDF was not added. The Scan page report is unchanged.
