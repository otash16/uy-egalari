#!/bin/zsh
# Sherikning kompyuteriga olib borish uchun agent papkasini zip qiladi (node_modules'siz).
# Agent tokeni: AGENT_TOKEN=... yarn agent:pack  (yoki /users → "Agent token" dan config.json ga qo'lda).
# Natija: ~/Desktop/uy-egalari-agent.zip
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HOME/Desktop/uy-egalari-agent.zip"
SERVER="${SERVER:-https://doska.zapusk.uz}"
TMP="$(mktemp -d)"
mkdir -p "$TMP/uy-egalari-agent"
cp -R "$ROOT/agent/src" "$ROOT/agent/package.json" "$ROOT/agent/tsconfig.json" "$ROOT/agent/start-agent.bat" "$ROOT/agent/ornatish.bat" "$ROOT/agent/olib-tashlash.bat" "$ROOT/agent/run-service.cmd" "$ROOT/agent/run-hidden.vbs" "$ROOT/agent/config.example.json" "$TMP/uy-egalari-agent/"
cp "$ROOT/docs/SHERIK-WINDOWS.md" "$TMP/uy-egalari-agent/O'RNATISH.md"
# Tayyor config: prod manzili + (berilgan bo'lsa) agent tokeni
node -e '
const fs=require("fs");const c=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
c.server=process.argv[2];c.token=process.env.AGENT_TOKEN||"";
fs.writeFileSync(process.argv[3],JSON.stringify(c,null,2)+"\n");
' "$ROOT/agent/config.example.json" "$SERVER" "$TMP/uy-egalari-agent/config.json"
rm -f "$OUT"
(cd "$TMP" && zip -qr "$OUT" uy-egalari-agent)
rm -rf "$TMP"
if [[ -n "$AGENT_TOKEN" ]]; then echo "Tayyor: $OUT  (server: $SERVER, token config.json ga yozildi)"; else echo "Tayyor: $OUT  (server: $SERVER, token BO'SH — config.json ga qo'lda yozing)"; fi
