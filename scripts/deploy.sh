#!/bin/zsh
# Mac'dan serverga joylash: kodni rsync qiladi, serverda deploy/server-setup.sh ni yuritadi.
#   yarn deploy            (ssh kaliti bilan)
#   SSH="sshpass -f parolfayl ssh" yarn deploy
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-callcenter@46.8.176.152}"
APP="${DEPLOY_PATH:-/opt/uy-egalari}"
SSH="${SSH:-ssh}"
echo "→ $HOST:$APP"
${=SSH} "$HOST" "sudo mkdir -p $APP && sudo chown \$(whoami) $APP"
rsync -az --delete -e "$SSH" \
  --exclude node_modules --exclude dist --exclude .git --exclude backups --exclude data \
  --exclude '*.db' --exclude '*.db-journal' --exclude .env --exclude 'agent/config.json' --exclude 'agent/.state-*.json' --exclude .DS_Store \
  "$ROOT/" "$HOST:$APP/"
${=SSH} "$HOST" "bash $APP/deploy/server-setup.sh"
