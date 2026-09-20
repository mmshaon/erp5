#!/data/data/com.termux/files/usr/bin/bash
# ================================================================
#  Alpha Ultimate ERP v5 — TERMUX Git Push Script
#
#  USAGE (from inside the erp-v5 folder):
#    bash termux-push.sh          → auto-setup if needed, then push
#    bash termux-push.sh setup    → force re-run setup only
#    bash termux-push.sh push     → push only (setup already done)
#    bash termux-push.sh status   → show git status + last commits
#    bash termux-push.sh log      → show commit graph
# ================================================================

# ── Colours ──────────────────────────────────────────────────────
C='\033[0;36m'; G='\033[0;32m'; Y='\033[1;33m'
R='\033[0;31m'; B='\033[1m';    N='\033[0m'
ok()    { echo -e "${G}  ✔  $1${N}"; }
warn()  { echo -e "${Y}  ⚠  $1${N}"; }
fail()  { echo -e "${R}  ✘  $1${N}"; exit 1; }
info()  { echo -e "${C}  ℹ  $1${N}"; }
sep()   { echo -e "${C}$(printf '─%.0s' {1..52})${N}"; }
title() { echo -e "\n${C}${B}  $1${N}"; sep; echo ""; }

# ── Config ────────────────────────────────────────────────────────
GITHUB_USER="mmshaon"
REPO_NAME="erp5"
BRANCH="main"
GIT_EMAIL="alpha.ultimate0.5@gmail.com"
GIT_NAME="Alpha Ultimate"

CMD="${1:-auto}"

# ─────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────

is_git_repo()    { [ -d ".git" ]; }
has_credentials() {
  [ -f "$HOME/.git-credentials" ] && grep -q "github.com" "$HOME/.git-credentials" 2>/dev/null
}

ensure_gitignore() {
  if [ ! -f ".gitignore" ]; then
    cat > .gitignore << 'GI'
node_modules/
dist/
.env
.env.local
.env.*.local
*.log
.DS_Store
.vercel/
GI
    ok ".gitignore created"
  fi
}

set_git_identity() {
  git config --global user.name  "$GIT_NAME"
  git config --global user.email "$GIT_EMAIL"
  git config --global credential.helper store
  git config --global init.defaultBranch main
  git config --global core.autocrlf false
  git config --global pull.rebase false
}

set_remote() {
  local REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
  if git remote get-url origin &>/dev/null; then
    git remote set-url origin "$REMOTE_URL"
  else
    git remote add origin "$REMOTE_URL"
  fi
}

# ─────────────────────────────────────────────────────────────────
# SETUP
# ─────────────────────────────────────────────────────────────────
do_setup() {
  title "TERMUX SETUP — Alpha Ultimate ERP v5"

  # ── 1. Install packages ───────────────────────────────────────
  info "Checking / installing required packages..."
  if ! command -v git &>/dev/null; then
    pkg update -y -q 2>/dev/null || true
    pkg install -y git curl openssh 2>/dev/null || fail "Failed to install packages. Check internet connection."
    ok "git, curl, openssh installed"
  else
    ok "git already installed: $(git --version)"
  fi

  # ── 2. Git identity ───────────────────────────────────────────
  set_git_identity
  ok "Git identity set: $GIT_NAME <$GIT_EMAIL>"

  # ── 3. GitHub token ───────────────────────────────────────────
  echo ""
  echo -e "${Y}${B}  ► GitHub Personal Access Token required${N}"
  echo ""
  echo -e "${C}  How to create one (takes 1 minute):${N}"
  echo -e "${C}  1. Open browser → github.com${N}"
  echo -e "${C}  2. Top-right avatar → Settings${N}"
  echo -e "${C}  3. Left sidebar → Developer settings${N}"
  echo -e "${C}  4. Personal access tokens → Tokens (classic)${N}"
  echo -e "${C}  5. Generate new token (classic)${N}"
  echo -e "${C}  6. Name: termux-erp   |   Expiration: 90 days${N}"
  echo -e "${C}  7. Scopes: tick the top 'repo' checkbox${N}"
  echo -e "${C}  8. Click Generate token → COPY IT (shown once only)${N}"
  echo ""
  printf "  Paste your token here: "
  read -r GH_TOKEN
  [ -z "$GH_TOKEN" ] && fail "Token cannot be empty."

  # Store credentials
  printf "https://%s:%s@github.com\n" "$GITHUB_USER" "$GH_TOKEN" > "$HOME/.git-credentials"
  chmod 600 "$HOME/.git-credentials"
  ok "Token stored securely in ~/.git-credentials"

  # ── 4. Verify token ───────────────────────────────────────────
  info "Verifying token with GitHub API..."
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: token ${GH_TOKEN}" \
    "https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}" 2>/dev/null || echo "000")

  case "$HTTP" in
    200) ok "Token verified — repository '$REPO_NAME' found and accessible" ;;
    404)
      warn "Repository not found (HTTP 404)."
      echo ""
      echo -e "${Y}  You need to create the repository on GitHub first:${N}"
      echo -e "${C}  1. Go to: https://github.com/new${N}"
      echo -e "${C}  2. Repository name: ${REPO_NAME}${N}"
      echo -e "${C}  3. Visibility: Private${N}"
      echo -e "${C}  4. DO NOT tick 'Add a README' (leave completely empty)${N}"
      echo -e "${C}  5. Click Create repository${N}"
      echo ""
      printf "  Press ENTER once you have created the repo on GitHub..."
      read -r
      ok "Continuing..."
      ;;
    401) fail "Token rejected (HTTP 401). Token may be incorrect or expired." ;;
    000) warn "Could not reach GitHub API — check internet connection. Continuing anyway." ;;
    *)   warn "GitHub returned HTTP $HTTP. Continuing anyway." ;;
  esac

  # ── 5. Init git repo ──────────────────────────────────────────
  if is_git_repo; then
    ok "Git repository already initialised"
  else
    git init
    git checkout -b main 2>/dev/null || git branch -M main
    ok "Git repository initialised"
  fi

  # ── 6. Set remote ─────────────────────────────────────────────
  set_remote
  ok "Remote origin → https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

  # ── 7. .gitignore ─────────────────────────────────────────────
  ensure_gitignore

  # ── Done ──────────────────────────────────────────────────────
  echo ""
  sep
  echo -e "${G}${B}  ✔  Setup complete!${N}"
  echo ""
  echo -e "${C}  Next step — push your code:${N}"
  echo -e "${G}${B}    bash termux-push.sh${N}"
  echo ""
}

# ─────────────────────────────────────────────────────────────────
# PUSH
# ─────────────────────────────────────────────────────────────────
do_push() {
  title "ALPHA ULTIMATE ERP — Push to GitHub"

  # ── Pre-flight checks ─────────────────────────────────────────
  [ -f "package.json" ] || fail "Run this from inside the erp-v5 folder.  cd ~/downloads/erp-v5"

  # Auto-setup if no repo or no credentials
  if ! is_git_repo; then
    warn "No git repository found. Running setup first..."
    echo ""
    do_setup
    echo ""
    title "Continuing with push..."
  fi

  if ! has_credentials; then
    warn "No GitHub credentials found. Running setup first..."
    echo ""
    do_setup
    echo ""
    title "Continuing with push..."
  fi

  # ── Apply identity ────────────────────────────────────────────
  set_git_identity
  ok "Git identity: $GIT_NAME <$GIT_EMAIL>"

  # ── Ensure gitignore ──────────────────────────────────────────
  ensure_gitignore

  # ── Check for changes ─────────────────────────────────────────
  CHANGED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

  if [ "$CHANGED" = "0" ]; then
    warn "Nothing new to commit — working tree is already clean."
    echo ""
    LAST=$(git log -1 --pretty='%h %s (%ar)' 2>/dev/null || echo "no commits yet")
    info "Last commit: $LAST"
    echo ""
    echo -e "${C}  If Vercel hasn't deployed, trigger it manually:${N}"
    echo -e "${C}  https://vercel.com/dashboard${N}"
    echo ""
    exit 0
  fi

  info "Detected $CHANGED changed file(s)"

  # ── Stage ─────────────────────────────────────────────────────
  git add -A
  ok "All changes staged"

  # ── Commit ────────────────────────────────────────────────────
  STAMP=$(date '+%Y-%m-%d %H:%M')
  MSG="feat: ERP v5 update — $STAMP"
  git commit -m "$MSG"
  ok "Committed: $MSG"

  # ── Ensure remote ─────────────────────────────────────────────
  set_remote

  # ── Ensure branch is main ─────────────────────────────────────
  CURR=$(git branch --show-current 2>/dev/null || echo "")
  [ "$CURR" != "main" ] && git branch -M main && ok "Branch set to main"

  # ── Push ──────────────────────────────────────────────────────
  info "Pushing to github.com/${GITHUB_USER}/${REPO_NAME}..."
  echo ""

  if git push origin main --force 2>&1; then
    PUSH_OK=true
  else
    warn "Standard push failed — trying with explicit token..."
    RAW_TOKEN=$(grep "github.com" "$HOME/.git-credentials" 2>/dev/null \
      | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|' | head -1)
    if [ -n "$RAW_TOKEN" ]; then
      EXPLICIT_URL="https://${GITHUB_USER}:${RAW_TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git"
      GIT_TERMINAL_PROMPT=0 git push "$EXPLICIT_URL" main --force 2>&1 && PUSH_OK=true || PUSH_OK=false
    else
      PUSH_OK=false
    fi
  fi

  echo ""
  if [ "${PUSH_OK:-false}" = "true" ]; then
    sep
    echo -e "${G}${B}  ✔  Successfully pushed to GitHub!${N}"
    echo ""
    echo -e "${C}  Repository:   https://github.com/${GITHUB_USER}/${REPO_NAME}${N}"
    echo -e "${C}  Branch:       main${N}"
    echo -e "${C}  Vercel will auto-deploy in ~60 seconds.${N}"
    echo -e "${C}  Watch build:  https://vercel.com/dashboard${N}"
    sep
    echo ""
  else
    sep
    echo -e "${R}${B}  ✘  Push failed.${N}"
    echo ""
    echo -e "${Y}  Common fixes:${N}"
    echo -e "${C}  1. Token expired → run: bash termux-push.sh setup${N}"
    echo -e "${C}  2. Repo doesn't exist on GitHub → create it at github.com/new${N}"
    echo -e "${C}     Name: ${REPO_NAME}  |  Private: YES  |  Leave empty (no README)${N}"
    echo -e "${C}  3. Wrong username → edit GITHUB_USER in this script${N}"
    echo -e "${C}  4. No internet → check WiFi/mobile data${N}"
    sep
    echo ""
    exit 1
  fi
}

# ─────────────────────────────────────────────────────────────────
# STATUS
# ─────────────────────────────────────────────────────────────────
do_status() {
  title "REPO STATUS"
  is_git_repo || fail "Not a git repository. Run: bash termux-push.sh setup"
  echo -e "${C}  Branch:${N} $(git branch --show-current 2>/dev/null || echo 'unknown')"
  echo -e "${C}  Remote:${N} $(git remote get-url origin 2>/dev/null || echo 'not set')"
  echo ""
  git status
  echo ""
  echo -e "${C}  Last 5 commits:${N}"
  git log --oneline -5 2>/dev/null || echo "  (no commits yet)"
  echo ""
}

# ─────────────────────────────────────────────────────────────────
# LOG
# ─────────────────────────────────────────────────────────────────
do_log() {
  title "COMMIT LOG"
  is_git_repo || fail "Not a git repository."
  git log --oneline --graph --decorate -20 2>/dev/null || echo "  (no commits yet)"
  echo ""
}

# ─────────────────────────────────────────────────────────────────
# ROUTER
# ─────────────────────────────────────────────────────────────────
case "$CMD" in
  setup)        do_setup  ;;
  push)         do_push   ;;
  auto|"")      do_push   ;;   # default: auto-setup if needed, then push
  status)       do_status ;;
  log)          do_log    ;;
  help|--help|-h)
    echo ""
    echo -e "${C}${B}  Alpha Ultimate ERP v5 — termux-push.sh${N}"
    sep
    echo -e "  ${G}bash termux-push.sh${N}         Auto-setup if needed, then push"
    echo -e "  ${G}bash termux-push.sh setup${N}   First-time setup (install git, store token)"
    echo -e "  ${G}bash termux-push.sh push${N}    Push only"
    echo -e "  ${G}bash termux-push.sh status${N}  Show git status + recent commits"
    echo -e "  ${G}bash termux-push.sh log${N}     Show commit graph"
    echo ""
    ;;
  *)
    echo -e "${Y}  Unknown command: $CMD${N}"
    echo -e "  Run: bash termux-push.sh help"
    ;;
esac
