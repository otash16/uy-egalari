#!/bin/zsh
# Serverni macOS'da avtomatik ishga tushadigan xizmat qilib o'rnatadi (launchd).
# Kompyuter yoqilib, foydalanuvchi kirgach server o'zi ko'tariladi va o'chib qolsa qayta ishga tushadi.
#   yarn service:install     — o'rnatish / yangilash
#   yarn service:uninstall   — olib tashlash
#   log: ~/Library/Logs/uy-egalari.log
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="uz.uyegalari.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/uy-egalari.log"
OPERATOR="${OPERATOR:-Otajon}"
YARN="$(command -v yarn)"

if [[ "$1" == "uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Xizmat olib tashlandi."
  exit 0
fi

echo "Frontend build..."
"$YARN" --cwd "$ROOT/web" --silent build

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$YARN</string>
    <string>--cwd</string>
    <string>$ROOT/server</string>
    <string>--silent</string>
    <string>start</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$(dirname "$YARN"):/usr/local/bin:/usr/bin:/bin</string>
    <key>OPERATOR</key><string>$OPERATOR</string>
    <key>HOST</key><string>0.0.0.0</string>
    <key>PORT</key><string>4000</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 2
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '<IP>')"
echo "Xizmat o'rnatildi: $LABEL (operator: $OPERATOR)"
echo "  Siz:      http://localhost:4000"
echo "  Sherik:   http://$IP:4000"
echo "  Log:      $LOG"
tail -3 "$LOG" 2>/dev/null || true
