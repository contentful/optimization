#!/usr/bin/env bash
#
# setup-maven-central-credential.sh
#
# One-time setup for the Android Maven Central publishing workflow.
#
# The release workflow `.github/workflows/publish-android.yaml` builds the Android
# library (`com.contentful.java:optimization-android`) and publishes it to Maven
# Central through the Sonatype Central Portal. That needs two kinds of credential,
# both stored as GitHub Actions secrets on `contentful/optimization`:
#
#   1. A Central Portal USER TOKEN (username + password) that authorizes uploads
#      to the `com.contentful.java` namespace.
#   2. A GPG signing key (Maven Central requires every artifact to be signed), with
#      its PUBLIC half published to the keyservers Sonatype validates against.
#
# This script provisions all of that and then VERIFIES it, so the person who runs
# it can walk away confident CI will publish on the next release.
#
# WHO RUNS THIS: someone who (a) has been granted access to the Contentful Central
# Portal account that owns the `com.contentful.java` namespace (pending IT), and
# (b) can set GitHub Actions secrets on `contentful/optimization`.
#
# WHAT IT DOES:
#   1. Checks prerequisites (gh authed + can set Actions secrets; gpg; curl; base64).
#   2. Generates (or reuses) an rsa4096 GPG signing key and publishes the public
#      key to keyserver.ubuntu.com and keys.openpgp.org.
#   3. Prompts for the Central Portal user token (it cannot be minted via API).
#   4. Stores five GitHub Actions secrets on contentful/optimization.
#   5. Verifies: every secret exists, the token actually authenticates against the
#      Central Portal API, and the public key is retrievable from a keyserver.
#
# It is safe to re-run: `gh secret set` overwrites, an existing signing key is
# reused, and the keyserver upload is idempotent.
#
# Usage:
#   ./setup-maven-central-credential.sh           # interactive
#   ./setup-maven-central-credential.sh --yes     # skip confirmation prompts
#
set -euo pipefail

# ----------------------------------------------------------------------------
# Configuration — change only if the repo, coordinate, or namespace changes.
# ----------------------------------------------------------------------------
SOURCE_REPO="contentful/optimization"
NAMESPACE="com.contentful.java"
ARTIFACT="optimization-android"

# GPG identity used for the release signing key (reused across re-runs).
GPG_NAME="Contentful Optimization"
GPG_EMAIL="mobile@contentful.com"
GPG_UID="$GPG_NAME <$GPG_EMAIL>"

# Keyservers Maven Central fetches public keys from to validate .asc signatures.
KEYSERVERS=("keyserver.ubuntu.com" "keys.openpgp.org")

# The release workflow reads these five secrets. The names are also the suffixes
# of the ORG_GRADLE_PROJECT_* env vars the vanniktech plugin expects (see the
# workflow): mavenCentralUsername/Password, signingInMemoryKey/KeyId/KeyPassword.
SECRET_USERNAME="MAVEN_CENTRAL_USERNAME"
SECRET_PASSWORD="MAVEN_CENTRAL_PASSWORD"
SECRET_KEY="MAVEN_SIGNING_KEY"
SECRET_KEY_ID="MAVEN_SIGNING_KEY_ID"
SECRET_KEY_PASSWORD="MAVEN_SIGNING_PASSWORD"

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

command -v gh     >/dev/null || die "GitHub CLI ('gh') is not installed. See https://cli.github.com/"
command -v gpg    >/dev/null || die "gpg is not installed (brew install gnupg)."
command -v curl   >/dev/null || die "curl is not available."
command -v base64 >/dev/null || die "base64 is not available."

gh auth status >/dev/null 2>&1 || die "Not logged in to gh. Run: gh auth login"
ok "gh is authenticated as: $(gh api user --jq .login)"

# Listing Actions secrets needs the same permission as setting them, so this is a
# non-destructive probe: if you can list them, you can set them.
if gh api "repos/$SOURCE_REPO/actions/secrets" >/dev/null 2>&1; then
  ok "You can manage Actions secrets on $SOURCE_REPO"
else
  die "You can't manage Actions secrets on $SOURCE_REPO.
      You need admin (or a role/grant that includes 'secrets') on that repo.
      Ask an org admin to run this script, or to grant you that access."
fi

# ----------------------------------------------------------------------------
# 2. Summary + confirm
# ----------------------------------------------------------------------------
step "This will:"
cat <<EOF
    • generate or reuse a GPG signing key for: $GPG_UID
    • publish its PUBLIC key to: ${KEYSERVERS[*]}
    • prompt you for a Central Portal user token (username + password)
    • store these GitHub Actions secrets on $SOURCE_REPO:
        $SECRET_USERNAME, $SECRET_PASSWORD,
        $SECRET_KEY, $SECRET_KEY_ID, $SECRET_KEY_PASSWORD
EOF
confirm "Proceed?" || die "Aborted by user."

# ----------------------------------------------------------------------------
# 3. GPG signing key (generate or reuse)
# ----------------------------------------------------------------------------
step "Preparing the GPG signing key"

# Find an existing secret key for our UID. fpr line 10 = full fingerprint.
KEY_FPR="$(gpg --list-secret-keys --with-colons "$GPG_UID" 2>/dev/null \
  | awk -F: '/^fpr:/ { print $10; exit }' || true)"

GPG_PASSPHRASE=""
if [[ -n "$KEY_FPR" ]]; then
  ok "Reusing existing signing key: $KEY_FPR"
  warn "Re-enter its passphrase so it can be stored for CI (input hidden)."
  read -r -s -p "    GPG passphrase: " GPG_PASSPHRASE; echo
else
  warn "No signing key for $GPG_UID found; generating a fresh rsa4096 key."
  read -r -s -p "    Choose a passphrase for the new key: " GPG_PASSPHRASE; echo
  read -r -s -p "    Confirm passphrase: " GPG_PASSPHRASE2; echo
  [[ "$GPG_PASSPHRASE" == "$GPG_PASSPHRASE2" ]] || die "Passphrases did not match."
  # Non-interactive generation. 2y expiry — document a rotation runbook before it lapses.
  gpg --batch --pinentry-mode loopback --passphrase "$GPG_PASSPHRASE" \
    --quick-generate-key "$GPG_UID" rsa4096 sign 2y >/dev/null 2>&1
  KEY_FPR="$(gpg --list-secret-keys --with-colons "$GPG_UID" \
    | awk -F: '/^fpr:/ { print $10; exit }')"
  ok "Generated signing key: $KEY_FPR"
fi

# vanniktech's signingInMemoryKeyId wants the short (last 8 hex) key id.
KEY_ID_SHORT="${KEY_FPR: -8}"
ok "Short key id: $KEY_ID_SHORT"

# ASCII-armored private key for the in-memory signer.
ARMORED_KEY="$(gpg --batch --pinentry-mode loopback --passphrase "$GPG_PASSPHRASE" \
  --armor --export-secret-keys "$KEY_FPR")"
[[ -n "$ARMORED_KEY" ]] || die "Failed to export the armored secret key."

step "Publishing the PUBLIC key to keyservers"
# Maven Central's validator downloads the public key by fingerprint to verify the
# .asc signatures on every artifact. Without this, releases fail validation.
for ks in "${KEYSERVERS[@]}"; do
  if gpg --keyserver "$ks" --send-keys "$KEY_FPR" >/dev/null 2>&1; then
    ok "Sent to $ks"
  else
    warn "Could not send to $ks (will re-check during verification)."
  fi
done

# ----------------------------------------------------------------------------
# 4. Central Portal user token
# ----------------------------------------------------------------------------
step "Central Portal user token"
cat <<EOF
    The Central Portal user token cannot be created via API. Generate one now:

      1. Sign in at https://central.sonatype.com (the account with access to the
         '$NAMESPACE' namespace).
      2. Go to Account → Generate User Token.
      3. Copy the username and password it shows (shown once).
EOF
read -r  -p "    Central Portal token USERNAME: " CP_USER
read -r -s -p "    Central Portal token PASSWORD: " CP_PASS; echo
[[ -n "$CP_USER" && -n "$CP_PASS" ]] || die "Username and password are required."

# ----------------------------------------------------------------------------
# 5. Store the five GitHub Actions secrets
# ----------------------------------------------------------------------------
step "Storing GitHub Actions secrets on $SOURCE_REPO"
gh secret set "$SECRET_USERNAME"     --repo "$SOURCE_REPO" --body "$CP_USER"        && ok "$SECRET_USERNAME"
gh secret set "$SECRET_PASSWORD"     --repo "$SOURCE_REPO" --body "$CP_PASS"        && ok "$SECRET_PASSWORD"
gh secret set "$SECRET_KEY"          --repo "$SOURCE_REPO" --body "$ARMORED_KEY"    && ok "$SECRET_KEY"
gh secret set "$SECRET_KEY_ID"       --repo "$SOURCE_REPO" --body "$KEY_ID_SHORT"   && ok "$SECRET_KEY_ID"
gh secret set "$SECRET_KEY_PASSWORD" --repo "$SOURCE_REPO" --body "$GPG_PASSPHRASE" && ok "$SECRET_KEY_PASSWORD"

# ----------------------------------------------------------------------------
# 6. Verify the end state
# ----------------------------------------------------------------------------
step "Verifying the configuration is complete"

FAILED=0

# 6a. Every secret exists on the repo.
for s in "$SECRET_USERNAME" "$SECRET_PASSWORD" "$SECRET_KEY" "$SECRET_KEY_ID" "$SECRET_KEY_PASSWORD"; do
  if gh api "repos/$SOURCE_REPO/actions/secrets/$s" >/dev/null 2>&1; then
    ok "secret present: $s"
  else
    warn "secret MISSING: $s"; FAILED=1
  fi
done

# 6b. The token actually authenticates against the Central Portal API.
# There is no pure "ping" endpoint, so we hit a read-only endpoint that never
# creates a deployment. The Portal returns 401 for bad/missing credentials and a
# non-401 (200/400/404) once the Bearer token is accepted — verified empirically.
B64="$(printf '%s:%s' "$CP_USER" "$CP_PASS" | base64 | tr -d '\n')"
CODE="$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $B64" \
  "https://central.sonatype.com/api/v1/publisher/published?namespace=$NAMESPACE&name=$ARTIFACT&version=0.0.0-probe" || echo 000)"
case "$CODE" in
  401|403) warn "Central Portal rejected the token (HTTP $CODE) — wrong token or no access to '$NAMESPACE'."; FAILED=1 ;;
  000)     warn "Could not reach the Central Portal API (network?)."; FAILED=1 ;;
  *)       ok "Central Portal token authenticated (HTTP $CODE)" ;;
esac

# 6c. The public key is retrievable from a keyserver (by fingerprint, in a throwaway
# keyring). Propagation lags, so retry a few times before giving up.
TMP_GNUPG="$(mktemp -d)"
KEY_FOUND=0
for attempt in 1 2 3 4 5; do
  if GNUPGHOME="$TMP_GNUPG" gpg --batch --keyserver keyserver.ubuntu.com \
       --recv-keys "$KEY_FPR" >/dev/null 2>&1; then
    KEY_FOUND=1; break
  fi
  sleep 10
done
if [[ "$KEY_FOUND" == 1 ]]; then
  ok "Public key retrievable from keyserver.ubuntu.com"
else
  warn "Public key not yet on keyserver.ubuntu.com — propagation can take minutes; re-check later with:
      gpg --keyserver keyserver.ubuntu.com --recv-keys $KEY_FPR"
  FAILED=1
fi
rm -rf "$TMP_GNUPG"

# ----------------------------------------------------------------------------
# 7. Result
# ----------------------------------------------------------------------------
if [[ "$FAILED" == 0 ]]; then
  printf '\n\033[1;32mAll set — CI can publish %s:%s to Maven Central.\033[0m\n' "$NAMESPACE" "$ARTIFACT"
else
  die "One or more checks failed (see above). Fix them and re-run; this script is idempotent."
fi
