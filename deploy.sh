#!/usr/bin/env bash
# ================================================================
#  Alpha Ultimate ERP v5 — Full Deploy Script
#  Handles: git setup, GitHub push, Vercel deployment
#
#  Usage:
#    bash deploy.sh          — push to git + trigger Vercel build
#    bash deploy.sh vercel   — deploy directly via Vercel CLI
#    bash deploy.sh setup    — first-time git/token configuration
# ================================================================
set -euo pipefail

C='\033[0;36m'; G='\033[0;32m'; Y='\033[1;33m'
R='\033[0;31m'; B='\033[1m';    N='\033[0m'
ok()   { echo -e "${G}  ✔  $1${N}"; }
warn() { echo -e "${Y}  ⚠  $1${N}"; }
fail() { echo -e "${R}  ✘  $1${N}"; exit 1; }
info() { echo -e "${C}  ℹ  $1${N}"; }

GITHUB_USER="alphashaon89"
REPO_NAME="alpha-ultimate-erp"
BRANCH="main"
GIT_EMAIL="alpha.ultimate0.5@gmail.com"
GIT_NAME="Alpha Ultimate"

CMD="${1:-push}"

banner() {
  echo -e "\n${C}${B}"
  echo "  ╔═══════════════════════════════════════╗"
  echo "  ║   ALPHA ULTIMATE ERP v5 — Deploy      ║"
  echo "  ╚═══════════════════════════════════════╝"
  echo -e "${N}"
}

setup_git() {
  banner
  [ -f "package.json" ] || fail "Run from inside the project folder."

  git config --global user.name  "$GIT_NAME"
  git config --global user.email "$GIT_EMAIL"
  git config --global credential.helper store
  git config --global init.defaultBranch main
  ok "Git identity set"

  echo -e "\n${Y}  GitHub Personal Access Token required.${N}"
  echo -e "${C}  Generate at: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)${N}"
  echo -e "${C}  Required scope: repo (full)${N}\n"
  printf "  Token: "
  read -r GH_TOKEN
  [ -z "$GH_TOKEN" ] && fail "Token required."

  echo "https://${GITHUB_USER}:${GH_TOKEN}@github.com" > "$HOME/.git-credentials"
  chmod 600 "$HOME/.git-credentials"
  ok "Credentials saved to ~/.git-credentials"

  [ -d ".git" ] || { git init; ok "Git repo initialised"; }
  [ -f ".gitignore" ] || printf "node_modules/\ndist/\n.env\n.env.local\n.vercel/\n" > .gitignore

  REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
  git remote get-url origin &>/dev/null && git remote set-url origin "$REMOTE_URL" || git remote add origin "$REMOTE_URL"
  ok "Remote set to $REMOTE_URL"

  echo -e "\n${G}${B}  ✔  Setup complete. Run: bash deploy.sh${N}\n"
}

push_to_git() {
  banner
  [ -f "package.json" ] || fail "Run from inside the project folder."
  [ -d ".git" ]         || fail "No git repo. Run: bash deploy.sh setup"
  [ -f "$HOME/.git-credentials" ] && grep -q "github.com" "$HOME/.git-credentials" || fail "No credentials. Run: bash deploy.sh setup"

  git config --global user.name  "$GIT_NAME"
  git config --global user.email "$GIT_EMAIL"
  git config --global credential.helper store
  ok "Git identity confirmed"

  CHANGED=$(git status --porcelain | wc -l | tr -d ' ')
  if [ "$CHANGED" = "0" ]; then
    warn "Nothing to commit — working tree clean."
    info "Last commit: $(git log -1 --pretty='%h %s' 2>/dev/null)"
    echo ""; exit 0
  fi

  git add -A
  STAMP=$(date '+%Y-%m-%d %H:%M:%S')
  git commit -m "feat: ERP v5 — $STAMP"
  ok "Committed: $STAMP ($CHANGED files changed)"

  REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
  git remote get-url origin &>/dev/null && git remote set-url origin "$REMOTE_URL" || git remote add origin "$REMOTE_URL"
  git branch -M main

  info "Pushing to GitHub..."
  git push origin main --force
  ok "Pushed to github.com/${GITHUB_USER}/${REPO_NAME}"

  echo -e "\n${C}$(printf '─%.0s' {1..44})${N}"
  echo -e "${G}${B}  ✔  Done. Vercel will auto-deploy.${N}"
  echo -e "${C}  https://github.com/${GITHUB_USER}/${REPO_NAME}${N}"
  echo -e "${C}$(printf '─%.0s' {1..44})${N}\n"
}

deploy_vercel() {
  banner
  command -v vercel &>/dev/null || { npm install -g vercel; ok "Vercel CLI installed"; }
  info "Deploying to Vercel production..."
  vercel --prod
  ok "Vercel deployment triggered"
}

case "$CMD" in
  setup)  setup_git     ;;
  vercel) deploy_vercel ;;
  push|*) push_to_git   ;;
esac
