#!/bin/zsh
# Sherikning kompyuteriga olib borish uchun agent papkasini zip qiladi (node_modules'siz).
# Natija: ~/Desktop/uy-egalari-agent.zip
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HOME/Desktop/uy-egalari-agent.zip"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '192.168.1.10')"
TMP="$(mktemp -d)"
mkdir -p "$TMP/uy-egalari-agent"
cp -R "$ROOT/agent/src" "$ROOT/agent/package.json" "$ROOT/agent/tsconfig.json" "$ROOT/agent/start-agent.bat" "$ROOT/agent/config.example.json" "$TMP/uy-egalari-agent/"
cp "$ROOT/docs/SHERIK-WINDOWS.md" "$TMP/uy-egalari-agent/O'RNATISH.md"
# Serverning hozirgi IP manzili bilan tayyor config
sed "s#http://[0-9.]*:4100#http://$IP:4100#" "$ROOT/agent/config.example.json" > "$TMP/uy-egalari-agent/config.json"
rm -f "$OUT"
(cd "$TMP" && zip -qr "$OUT" uy-egalari-agent)
rm -rf "$TMP"
echo "Tayyor: $OUT  (server manzili: http://$IP:4100)"
