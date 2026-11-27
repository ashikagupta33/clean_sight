# 004. Keep Plastic / Paper / Metal / Other as display categories

- **Date:** 2026-11-27
- **Status:** Accepted

## Context
The model detects four classes: `bottle`, `can`, `paper_cardboard` and `plastic_wrapper`. The frontend's charts, legends, PDF report and colour palette group waste into Plastic, Paper, Metal and Other.

## Decision
The display categories stay as they are. Model labels are grouped by `CATEGORY_RULES` in `frontend/js/config.js`:

| Model label | Shown as |
|---|---|
| `bottle` | Plastic |
| `plastic_wrapper` | Plastic |
| `paper_cardboard` | Paper |
| `can` | Metal |

The backend always returns and stores the model's own labels. Grouping happens only in the frontend.

## Consequences
- **Other** is empty with the current model. It is kept for future classes that match none of the rules.
- The `bottle` class was trained on clear plastic, other plastic **and glass** bottles (see the notebook's `CLASS_MAP`), so glass bottles are counted as Plastic. If that matters, retrain with a separate glass class and add a rule.
- The detections list and the PDF still show the exact model label (for example `paper_cardboard`) next to the category.
- Because the history stores model labels, changing the grouping later re-groups old scans too.
