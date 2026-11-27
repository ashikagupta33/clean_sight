# 003. Commit `best.onnx` to the repo, keep `best.pt` out

- **Date:** 2026-11-27
- **Status:** Accepted

## Context
`ML/README.md` said the weights were "shared separately", so anyone cloning the repo could not run the backend without asking the ML team for files.

## Decision
`backend/models/best.onnx` (~43 MB) is committed. It is under GitHub's 100 MB per-file limit, so Git LFS is not needed. `*.pt` files are ignored in `.gitignore`, because the backend does not use them.

## Consequences
- Clone, install, run: no extra download step.
- Each new model version adds ~43 MB to the repository history. Replace the file only when the model really improves, and note the change in the commit message.
- `best.pt` stays with the ML team for retraining and for `ML/inference.py`.
- If a future model goes over 100 MB, switch to Git LFS or a release download and record that in a new decision.
