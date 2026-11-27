# 008. Git workflow: keep history, commit as the team member, deliver as a bundle

- **Date:** 2026-11-27
- **Status:** Accepted

## Context
The repository already had 9 commits from four contributors on `main`, plus the `frontend` and `feature/before-after-comparison` branches. The top priority was to never lose that history.

## Decision
- No history is rewritten: no rebase of `main`, no amend of existing commits, no force-push.
- The backend work is a set of normal commits on a new branch, `feature/backend`, built on top of the current `main` (`b39dde9`).
- Every new commit has Harshit Mishra as both author and committer, with no co-author lines.
- The commits are delivered as a git bundle. A team member fetches it into their own clone and pushes it from their own GitHub account, then merges it through a pull request, the same way PRs #1 and #2 were merged.

## Consequences
- All existing commits, authors and branches stay exactly as they are.
- `feature/backend` can be reviewed as a PR before it reaches `main`.
- The push steps are in the root README under "Contributing".
