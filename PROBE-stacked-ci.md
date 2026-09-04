# Throwaway probe — delete with this branch

Exists only to open a pull request whose BASE is `chore/ci-runs-on-stacked-prs`
rather than `main`, so that the trigger change in that branch can be observed.

Under the old `pull_request: branches: [main]` this PR would receive ZERO
checks. Under the new unfiltered trigger, CI runs. Nothing else differs, so the
run is attributable to the removed filter alone.

This file sits outside `peer-floor.yml`'s `paths` filter on purpose: peer-floor
should be absent from the checks, which is the control showing CI specifically
is what changed.

Not for merge. Close the PR and delete the branch.
