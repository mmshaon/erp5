#!/usr/bin/env bash
# ================================================================
#  Alpha Ultimate ERP — Force Push Script
#  Stages all changes, commits with a timestamp, and force-pushes
#  to GitHub main. Credentials are read from ~/.git-credentials
#  (saved by deploy.sh on first run — no prompt needed).
#  Usage: bash push.sh
# ================================================================
set -euo pipefail

C='\033[0;36m'; G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[1m'; N='\033[0m'
ok()   { echo -e "${G}  ✔  $1${N}"; }
warn() { echo -e "${Y}  ⚠  $1${N}"; }
fail() { echo -e "${R}  ✘  $1${N}"; exit 1; }

GITHUB_USER="alphashaon89"
REPO_NAME="alpha-ultimate-erp"
BRANCH="main"

echo -e "\n${C}${B}  Alpha Ultimate ERP — Force Push${N}"
echo -e "${C}──────────────────────────────────${N}\n"

# Verify we are inside the project
[ -f "package.json" ] || fail "Run this from inside the erp-v4 folder."

# Ensure git identity and credential helper are set
git config --global user.name  "Alpha Ultimate"
git config --global user.email "alpha.ultimate0.5@gmail.com"
git config --global credential.helper store
ok "Git identity confirmed"

# Verify credentials are stored
[ -f "$HOME/.git-credentials" ] && grep -qs "github.com" "$HOME/.git-credentials" \
  || fail "No stored credentials. Run bash deploy.sh once first to save your token."
ok "Stored credentials found"

# Stage everything
git add -A
if git diff --cached --quiet; then
  warn "Nothing new to commit — tree is already clean"
else
  STAMP=$(date '+%Y-%m-%d %H:%M:%S')
  git commit -m "fix: force push at ${STAMP}"
  ok "Committed: fix: force push at ${STAMP}"
fi

# Ensure remote is set
REMOTE="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
git remote get-url origin &>/dev/null \
  && git remote set-url origin "$REMOTE" \
  || git remote add origin "$REMOTE"

# Force push
echo ""
echo -e "${C}  Pushing to github.com/${GITHUB_USER}/${REPO_NAME}…${N}"
git push origin "$BRANCH" --force
ok "Force-pushed to ${BRANCH}"

echo ""
echo -e "${C}──────────────────────────────────${N}"
echo -e "${G}${B}  ✔  Done. Vercel will rebuild automatically.${N}"
echo -e "${C}──────────────────────────────────${N}\n"
