#!/bin/zsh
# Mac'da serverni EMAS, agentni xizmat qiladi: Linphone tarixini internetdagi serverga (agent/config.json) yuboradi.
#   yarn agent:service:install / yarn agent:service:uninstall
# log: ~/Library/Logs/uy-egalari-agent.log
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="uz.uyegalari.agent"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/uy-egalari-agent.log"
YARN="$(command -v yarn)"
if [[ "$1" == "uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"; echo "Agent xizmati olib tashlandi."; exit 0
fi
[[ -f "$ROOT/agent/config.json" ]] || { echo "agent/config.json yo'q — config.example.json dan nusxa olib to'ldiring"; exit 1; }
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$YARN</string><string>--cwd</string><string>$ROOT/agent</string><string>--silent</string><string>start</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$YARN"):/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string><key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PLIST
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 3; echo "Agent xizmati o'rnatildi: $LABEL  (log: $LOG)"; tail -3 "$LOG" 2>/dev/null || true
