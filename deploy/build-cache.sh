#!/usr/bin/env bash
# Build cache retention, sourced by deploy.sh and deploy-admin.sh.
#
# Keeps only the build cache used by the most recent deploy. A deploy is one
# commit: deploy.sh and deploy-admin.sh both run against the same HEAD, so
# the first one to start records the start time and the second one reuses
# it. After a successful deploy, every cache record not used since that
# start is pruned, so a cache layer the new build reused survives and
# everything older goes.

DEPLOY_MARKER="$APP_ROOT/.deploy-run"

mark_deploy_start() {
  local commit
  commit="$(git -C "$APP_ROOT" rev-parse HEAD)"
  if [ "$(cut -d' ' -f1 "$DEPLOY_MARKER" 2>/dev/null)" != "$commit" ]; then
    echo "$commit $(date +%s)" > "$DEPLOY_MARKER"
  fi
}

prune_build_cache() {
  local started
  started="$(cut -d' ' -f2 "$DEPLOY_MARKER")"
  log "Prune build cache not used by this deploy"
  # +1 because until=0s means "no age limit" and would prune everything.
  docker builder prune -af --filter "until=$(( $(date +%s) - started + 1 ))s" >/dev/null 2>&1 || true
}
