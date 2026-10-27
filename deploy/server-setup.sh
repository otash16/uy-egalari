#!/bin/bash
# Serverda (callcenter@46.8.176.152) ishlaydi: konteynerni ko'taradi, nginx + sertifikatni sozlaydi.
# deploy.sh buni rsync'dan keyin chaqiradi. Qayta ishga tushirsa bo'ladi (idempotent).
set -e
APP=/opt/uy-egalari
DOMAIN=doska.zapusk.uz
cd "$APP"
mkdir -p data

# Birinchi dasturchi (otajon) paroli: bazada foydalanuvchi bo'lmasa server shundan yaratadi; keyin saytdan o'zgartiriladi
if [ ! -f .env ] || ! grep -q '^BOARD_PASSWORD=.\+' .env; then
  PW="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 14)"
  echo "BOARD_PASSWORD=$PW" > .env
  chmod 600 .env
  echo "Boshlang'ich parol yaratildi → $APP/.env"
fi

docker compose up -d --build --remove-orphans
sleep 10
curl -fsS -o /dev/null -w "Konteyner: HTTP %{http_code}\n" http://127.0.0.1:8211/login

# nginx sayti
if [ ! -f /etc/nginx/sites-enabled/$DOMAIN ]; then
  sudo cp deploy/$DOMAIN.conf /etc/nginx/sites-available/$DOMAIN
  sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
  sudo nginx -t && sudo systemctl reload nginx
  echo "nginx: $DOMAIN qo'shildi"
fi
# HTTPS (bir marta)
if ! sudo test -d /etc/letsencrypt/live/$DOMAIN; then
  sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --redirect -m admin@zapusk.uz
fi
curl -fsS -o /dev/null -w "https://$DOMAIN: HTTP %{http_code}\n" https://$DOMAIN/login
