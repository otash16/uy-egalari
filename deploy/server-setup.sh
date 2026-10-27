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
# HTTP/2 (bir marta): certbot 443 ni "listen 443 ssl" qilib yozadi — http2 qo'shamiz,
# brauzer bitta ulanishda hamma faylni parallel oladi (HTTP/1.1 da 6 ta ulanish, har biri TLS to'laydi).
SITE=/etc/nginx/sites-available/$DOMAIN
# IPv4 ("listen 443 ssl;") va IPv6 ("listen [::]:443 ssl ipv6only=on;") qatorlari — ikkalasiga ham,
# aks holda nginx "protocol options redefined" deb ogohlantiradi.
if sudo grep -qE '^\s*listen .*443 ssl( ipv6only=on)?;' $SITE 2>/dev/null; then
  sudo sed -i -E 's/^(\s*listen .*443 ssl)( ipv6only=on)?;/\1 http2\2;/' $SITE
  if sudo nginx -t; then sudo systemctl reload nginx && echo "nginx: HTTP/2 yoqildi"; else echo "nginx -t XATO — http2 qo'shilmadi, konfigni tekshiring"; fi
fi
curl -fsS -o /dev/null -w "https://$DOMAIN: HTTP %{http_code} (%{http_version})\n" https://$DOMAIN/login
