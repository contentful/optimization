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
# the private half in Vault for the workflow to read.
#
# WHO RUNS THIS: someone with ADMIN on contentful/optimization.swift. Deploy-key
# management requires admin; MAINTAIN/WRITE is not enough.
#
# WHAT IT DOES:
#   1. Checks prerequisites (gh authed + admin on the mirror, ssh-keygen).
#   2. Generates a fresh ed25519 keypair locally (no passphrase — CI can't type one).
#   3. Registers the PUBLIC key on contentful/optimization.swift as a deploy key
#      with write access.
#   4. Stores the PRIVATE key in Vault (or prints the exact command if Vault isn't
#      available on this machine).
#   5. Prints the workflow snippet that consumes it, then offers to delete the
#      local private key.
#
# It is safe to re-run: it detects an existing deploy key with the same title and
# asks before replacing it.
#
# Usage:
#   ./setup-spm-mirror-credential.sh           # interactive
#   ./setup-spm-mirror-credential.sh --yes     # skip confirmation prompts
#
set -euo pipefail

# ----------------------------------------------------------------------------
# Configuration — change only if the repo or Vault layout changes.
# ----------------------------------------------------------------------------
MIRROR_REPO="contentful/optimization.swift"
KEY_TITLE="spm-publish (contentful/optimization release workflow)"
KEY_COMMENT="spm-mirror-publish"

# Vault KV v2: you WRITE to secret/<path>, the workflow READS from secret/data/<path>.
VAULT_WRITE_PATH="secret/github/spm_mirror_deploy_key"
VAULT_READ_PATH="secret/data/github/spm_mirror_deploy_key"
VAULT_FIELD="SSH_PRIVATE_KEY"

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

# ----------------------------------------------------------------------------
# 2. Summary + confirm
# ----------------------------------------------------------------------------
step "This will:"
cat <<EOF
    • generate an SSH keypair at: $KEY_PATH(.pub)
    • add the public key to $MIRROR_REPO as a WRITABLE deploy key
    • store the private key in Vault at: $VAULT_WRITE_PATH (field: $VAULT_FIELD)
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

EXISTING_ID="$(gh api "repos/$MIRROR_REPO/keys" --jq \
  ".[] | select(.title == \"$KEY_TITLE\") | .id" 2>/dev/null || true)"

if [[ -n "$EXISTING_ID" ]]; then
  warn "A deploy key titled \"$KEY_TITLE\" already exists (id: $EXISTING_ID)."
  if confirm "Delete it and add the new key?"; then
    gh api -X DELETE "repos/$MIRROR_REPO/keys/$EXISTING_ID" >/dev/null
    ok "Removed old deploy key"
  else
    die "Aborted: cannot add a duplicate key. Remove the old one first or reuse it."
  fi
fi

gh api -X POST "repos/$MIRROR_REPO/keys" \
  -f title="$KEY_TITLE" \
  -f key="$(cat "$KEY_PATH.pub")" \
  -F read_only=false >/dev/null
ok "Added writable deploy key to $MIRROR_REPO"

# ----------------------------------------------------------------------------
# 5. Store the private key in Vault (or print instructions)
# ----------------------------------------------------------------------------
step "Storing the private key in Vault"

VAULT_DONE=false
if command -v vault >/dev/null 2>&1 && vault token lookup >/dev/null 2>&1; then
  if confirm "Write the private key to Vault at $VAULT_WRITE_PATH now?"; then
    vault kv put "$VAULT_WRITE_PATH" "$VAULT_FIELD=@$KEY_PATH" >/dev/null
    ok "Stored private key in Vault"
    VAULT_DONE=true
  fi
else
  warn "Vault CLI not available or not logged in on this machine."
fi

if [[ "$VAULT_DONE" == false ]]; then
  cat <<EOF
    To store the private key, run this on a machine with Vault access:

        vault kv put $VAULT_WRITE_PATH $VAULT_FIELD=@$KEY_PATH

    (The '@' makes Vault read the file directly, so the key is never pasted into
    your shell history.)
EOF
fi

# ----------------------------------------------------------------------------
# 6. What the workflow needs
# ----------------------------------------------------------------------------
step "Done. The publish workflow consumes this credential like so:"
cat <<EOF

    # In .github/workflows/publish-spm.yaml — fetch the key from Vault:
    secrets: |
      $VAULT_READ_PATH $VAULT_FIELD | MIRROR_DEPLOY_KEY ;

    # ...then push over SSH:
    mkdir -p ~/.ssh
    echo "\${{ steps.vault.outputs.MIRROR_DEPLOY_KEY }}" > ~/.ssh/id_ed25519
    chmod 600 ~/.ssh/id_ed25519
    ssh-keyscan github.com >> ~/.ssh/known_hosts
    git clone --depth 1 git@github.com:$MIRROR_REPO.git mirror

EOF

# ----------------------------------------------------------------------------
# 7. Clean up the local private key
# ----------------------------------------------------------------------------
if [[ "$VAULT_DONE" == true ]]; then
  step "Cleanup"
  if confirm "Vault now holds the key. Delete the local private key at $KEY_PATH?"; then
    rm -f "$KEY_PATH" "$KEY_PATH.pub"
    ok "Deleted local keypair"
  else
    warn "Local private key kept at $KEY_PATH — delete it once you've confirmed the workflow works."
  fi
else
  warn "Keep $KEY_PATH safe until it's in Vault, then delete it."
fi

printf '\n\033[1;32mAll set.\033[0m\n'
