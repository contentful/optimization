#!/usr/bin/env bash
#
# setup-spm-mirror-credential.sh
#
# One-time setup for the iOS Swift Package publishing workflow.
#
# The release workflow in `contentful/optimization` builds the Swift package and
# pushes it to a SEPARATE repo, `contentful/optimization.swift`. A workflow's
# built-in GITHUB_TOKEN can only write to its own repo, so we need a credential
# that can push to the mirror. This script creates that credential as a
# *writable deploy key* (an SSH key scoped to the mirror repo only) and stores
# the private half as a GitHub Actions secret on the source repo for the
# workflow to read.
#
# WHO RUNS THIS: someone with ADMIN on contentful/optimization.swift (deploy-key
# management requires admin; MAINTAIN/WRITE is not enough) and permission to set
# Actions secrets on contentful/optimization.
#
# WHAT IT DOES:
#   1. Checks prerequisites (gh authed + admin on the mirror, ssh-keygen).
#   2. Generates a fresh ed25519 keypair locally (no passphrase — CI can't type one).
#   3. Registers the PUBLIC key on contentful/optimization.swift as a deploy key
#      with write access.
#   4. Stores the PRIVATE key as a GitHub Actions secret on the source repo (or
#      prints the exact command if it can't be set from this machine).
#   5. Prints the workflow snippet that consumes it, then offers to delete the
#      local private key.
#
# It is idempotent: re-running replaces the deploy key we previously created
# (matched by title) and overwrites the Actions secret, converging to the same
# end state every time.
#
# Usage:
#   ./setup-spm-mirror-credential.sh           # interactive
#   ./setup-spm-mirror-credential.sh --yes     # skip confirmation prompts
#
set -euo pipefail

# ----------------------------------------------------------------------------
# Configuration — change only if the repo layout changes.
# ----------------------------------------------------------------------------
MIRROR_REPO="contentful/optimization.swift"
SOURCE_REPO="contentful/optimization"
KEY_TITLE="spm-publish (contentful/optimization release workflow)"
KEY_COMMENT="spm-mirror-publish"

# The release workflow reads the private key from this Actions secret on the
# source repo.
SECRET_NAME="SPM_MIRROR_DEPLOY_KEY"

KEY_PATH="${KEY_PATH:-$HOME/.ssh/optimization-swift-deploy}"

ASSUME_YES=false
[[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]] && ASSUME_YES=true

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
step()    { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()      { printf '\033[1;32m    ✓ %s\033[0m\n' "$*"; }
warn()    { printf '\033[1;33m    ! %s\033[0m\n' "$*"; }
die()     { printf '\033[1;31m    ✗ %s\033[0m\n' "$*" >&2; exit 1; }

confirm() {
  $ASSUME_YES && return 0
  local reply
  read -r -p "    $1 [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

# ----------------------------------------------------------------------------
# 1. Prerequisites
# ----------------------------------------------------------------------------
step "Checking prerequisites"

command -v gh         >/dev/null || die "GitHub CLI ('gh') is not installed. See https://cli.github.com/"
command -v ssh-keygen >/dev/null || die "ssh-keygen is not available."

gh auth status >/dev/null 2>&1 || die "Not logged in to gh. Run: gh auth login"
ok "gh is authenticated as: $(gh api user --jq .login)"

IS_ADMIN="$(gh api "repos/$MIRROR_REPO" --jq '.permissions.admin' 2>/dev/null || echo "error")"
if [[ "$IS_ADMIN" != "true" ]]; then
  die "You need ADMIN on $MIRROR_REPO to add a deploy key (you have: $IS_ADMIN).
      Ask an org admin to run this script, or to grant you admin on that repo."
fi
ok "You have admin on $MIRROR_REPO"

# Setting Actions secrets needs the repo's "secrets" permission, not full admin.
# Listing secrets requires that same permission, so it's a non-destructive probe:
# if you can list them, you can set them.
if gh api "repos/$SOURCE_REPO/actions/secrets" >/dev/null 2>&1; then
  ok "You can manage Actions secrets on $SOURCE_REPO"
else
  die "You can't manage Actions secrets on $SOURCE_REPO.
      You need the 'secrets' permission there (admin, or a role/grant that includes it).
      Ask an org admin to run this script, or to grant you that access."
fi

# ----------------------------------------------------------------------------
# 2. Summary + confirm
# ----------------------------------------------------------------------------
step "This will:"
cat <<EOF
    • generate an SSH keypair at: $KEY_PATH(.pub)
    • add the public key to $MIRROR_REPO as a WRITABLE deploy key
    • store the private key as the $SECRET_NAME Actions secret on $SOURCE_REPO
EOF
confirm "Proceed?" || die "Aborted by user."

# ----------------------------------------------------------------------------
# 3. Generate the keypair
# ----------------------------------------------------------------------------
step "Generating SSH keypair"

if [[ -f "$KEY_PATH" ]]; then
  warn "A key already exists at $KEY_PATH"
  if confirm "Reuse the existing key (No = generate a fresh one)?"; then
    ok "Reusing existing key"
  else
    rm -f "$KEY_PATH" "$KEY_PATH.pub"
    ssh-keygen -t ed25519 -N "" -C "$KEY_COMMENT" -f "$KEY_PATH" >/dev/null
    ok "Generated fresh key"
  fi
else
  mkdir -p "$(dirname "$KEY_PATH")"
  ssh-keygen -t ed25519 -N "" -C "$KEY_COMMENT" -f "$KEY_PATH" >/dev/null
  ok "Generated key at $KEY_PATH"
fi
chmod 600 "$KEY_PATH"

# ----------------------------------------------------------------------------
# 4. Register the deploy key (idempotent)
# ----------------------------------------------------------------------------
step "Registering the deploy key on $MIRROR_REPO"

# Idempotent: drop any deploy key we previously created (matched by title), then
# add the current public key. GitHub rejects re-adding an identical key with
# "key is already in use", so deleting first is what makes re-runs safe.
while read -r existing_id; do
  [[ -z "$existing_id" ]] && continue
  gh api -X DELETE "repos/$MIRROR_REPO/keys/$existing_id" >/dev/null
  ok "Removed previous deploy key (id: $existing_id)"
done < <(gh api "repos/$MIRROR_REPO/keys" --jq \
  ".[] | select(.title == \"$KEY_TITLE\") | .id" 2>/dev/null || true)

gh api -X POST "repos/$MIRROR_REPO/keys" \
  -f title="$KEY_TITLE" \
  -f key="$(cat "$KEY_PATH.pub")" \
  -F read_only=false >/dev/null
ok "Added writable deploy key to $MIRROR_REPO"

# ----------------------------------------------------------------------------
# 5. Store the private key as a GitHub Actions secret (or print instructions)
# ----------------------------------------------------------------------------
step "Storing the private key as a GitHub Actions secret"

# gh secret set overwrites an existing value, so this is idempotent on its own.
SECRET_DONE=false
if gh secret set "$SECRET_NAME" --repo "$SOURCE_REPO" < "$KEY_PATH"; then
  ok "Stored private key as $SECRET_NAME on $SOURCE_REPO"
  SECRET_DONE=true
else
  warn "Could not set the secret (do you have admin/secrets access on $SOURCE_REPO?)."
  cat <<EOF
    Finish provisioning by running this with gh access to $SOURCE_REPO:

        gh secret set $SECRET_NAME --repo $SOURCE_REPO < $KEY_PATH

    (Reading from the file via '<' keeps the key out of your shell history.)
EOF
fi

# ----------------------------------------------------------------------------
# 6. Verify the end state — read both values back and fail if either is missing
# ----------------------------------------------------------------------------
step "Verifying the configuration is complete"

VERIFIED_KEY="$(gh api "repos/$MIRROR_REPO/keys" --jq \
  ".[] | select(.title == \"$KEY_TITLE\" and .read_only == false) | .id" 2>/dev/null || true)"
[[ -n "$VERIFIED_KEY" ]] \
  || die "Verification failed: no writable deploy key titled \"$KEY_TITLE\" on $MIRROR_REPO."
ok "Writable deploy key present on $MIRROR_REPO (id: $VERIFIED_KEY)"

gh api "repos/$SOURCE_REPO/actions/secrets/$SECRET_NAME" >/dev/null 2>&1 \
  || die "Verification failed: $SECRET_NAME secret is not set on $SOURCE_REPO."
ok "$SECRET_NAME secret present on $SOURCE_REPO"

# ----------------------------------------------------------------------------
# 7. What the workflow needs
# ----------------------------------------------------------------------------
step "Done. The publish workflow consumes this credential like so:"
cat <<EOF

    # In .github/workflows/publish-spm.yaml — push over SSH using the secret:
    mkdir -p ~/.ssh
    echo "\${{ secrets.$SECRET_NAME }}" > ~/.ssh/id_ed25519
    chmod 600 ~/.ssh/id_ed25519
    ssh-keyscan github.com >> ~/.ssh/known_hosts
    git clone --depth 1 git@github.com:$MIRROR_REPO.git mirror

EOF

# ----------------------------------------------------------------------------
# 8. Clean up the local private key
# ----------------------------------------------------------------------------
if [[ "$SECRET_DONE" == true ]]; then
  step "Cleanup"
  if confirm "$SOURCE_REPO now holds the key. Delete the local private key at $KEY_PATH?"; then
    rm -f "$KEY_PATH" "$KEY_PATH.pub"
    ok "Deleted local keypair"
  else
    warn "Local private key kept at $KEY_PATH — delete it once you've confirmed the workflow works."
  fi
else
  warn "Keep $KEY_PATH safe until the $SECRET_NAME secret is set, then delete it."
fi

printf '\n\033[1;32mAll set.\033[0m\n'
