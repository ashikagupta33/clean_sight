# Decisions

This folder records the important decisions made while building CleanSight: what was decided, why, and what it means for the rest of the project. Read these before changing the parts they describe.

Each file is one decision. Files are numbered in the order the decisions were made and are never renumbered. If a decision is reversed later, add a new file and mark the old one as **Superseded by NNN**.

| No. | Decision | Status |
|---|---|---|
| [001](001-python-fastapi-backend.md) | Backend in Python with FastAPI | Accepted |
| [002](002-onnx-runtime-inference.md) | Run the model with ONNX Runtime, not PyTorch | Accepted |
| [003](003-commit-onnx-weights-only.md) | Commit `best.onnx` to the repo, keep `best.pt` out | Accepted |
| [004](004-display-categories.md) | Keep Plastic / Paper / Metal / Other as display categories | Accepted |
| [005](005-detect-api-contract.md) | `/detect` request and response format | Accepted |
| [006](006-server-side-history.md) | Scan history stored on the server in SQLite | Accepted |
| [007](007-compare-page-rebuild.md) | Rebuild the Compare page on the shared design and real detection | Accepted |
| [008](008-git-workflow.md) | Git workflow: keep history, commit as the team member, deliver as a bundle | Accepted |
| [009](009-deferred-work.md) | Work deliberately left for later | Accepted |

## Template for a new decision

```markdown
# NNN. Short title

- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Superseded by NNN

## Context
What problem or question led to this decision.

## Decision
What was decided, stated plainly.

## Consequences
What this makes easier, what it makes harder, and what anyone changing it must know.
```
