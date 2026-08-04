#!/usr/bin/env bash
# ci-land-bot-pr.sh <branch> <pr-title>
#
# Creates a PR for the given branch and merges it once the required checks
# pass. Used by bot workflows (sync-contract-snapshot, generate-metrics)
# whose direct pushes to main are rejected by branch protection (required
# checks validate + build).
#
# Requires:
#   GH_TOKEN=<GITHUB_TOKEN>  (workflow permissions: contents + pull-requests)
#   branch pushed to origin as <branch>
#
# Fails loudly (exit 1) if the checks fail or the merge times out; in the
# timeout case the PR is left open for a human to merge.
set -euo pipefail

BRANCH="$1"
TITLE="$2"

gh pr create --base main --head "$BRANCH" --title "$TITLE" \
  --body "Automated change committed by a scheduled workflow; merged automatically once required checks pass."

for i in $(seq 1 60); do
  CHECKS=$(gh pr checks "$BRANCH" --required 2>/dev/null || true)
  if [ -n "$CHECKS" ]; then
    FAILED=$(printf '%s\n' "$CHECKS" | grep -c $'\tfail' || true)
    PENDING=$(printf '%s\n' "$CHECKS" | grep -c $'\tpending' || true)
    if [ "$FAILED" -gt 0 ]; then
      echo "::error::PR checks failed for ${BRANCH}."
      exit 1
    fi
    if [ "$PENDING" -eq 0 ]; then
      gh pr merge "$BRANCH" --merge --delete-branch
      echo "PR ${BRANCH} merged onto main."
      exit 0
    fi
  fi
  sleep 10
done

echo "::error::Timed out waiting for required checks on ${BRANCH} — PR left open for manual merge."
exit 1
