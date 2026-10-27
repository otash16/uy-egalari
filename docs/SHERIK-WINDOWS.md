# Sherik uchun o'rnatish (Windows + MicroSIP)

Sizda ikkita narsa bo'ladi:
1. **Doska** — brauzerda ochiladi, o'rnatish shart emas.
2. **Agent** — kichik dastur, MicroSIP'dagi qo'ng'iroqlaringizni doskaga yuborib turadi. Bir marta o'rnatiladi.

Doska internetda: **https://doska.zapusk.uz**. Login, parol va agent tokenini sherigingiz beradi.

## 1. Doska

Brauzerda https://doska.zapusk.uz ni oching, yulduzchaga qo'shib qo'ying. Login va parolingizni kiriting —
brauzer 180 kun eslab qoladi. Siz qo'shgan kartalar sizning nomingizda bo'ladi.
Parolni o'zgartirish: yuqori o'ngdagi ismingiz → "Parolni o'zgartirish".

## 2. Agent

1. **Node.js** o'rnating: https://nodejs.org → "LTS" tugmasi → yuklab, "Next, Next" bilan o'rnating.
   (Kamida 22.5 versiya kerak. Tekshirish: `Win+R` → `cmd` → `node -v`.)
2. Sherigingiz bergan `uy-egalari-agent.zip` ni oching, papkani qulay joyga qo'ying, masalan `C:\uy-egalari-agent\`.
3. Papkadagi `config.json` ni Bloknotda oching va tekshiring:
   ```json
   {
     "server": "https://doska.zapusk.uz",
     "operator": "Akbar",
     "softphone": "microsip",
     "path": "",
     "token": "sherigingiz bergan agent tokeni"
   }
   ```
   - `server` — doska manzili
   - `token` — sizning agent tokeningiz (parol emas). Shu token orqali server sizni taniydi.
   - `operator` — faqat oynada ko'rsatish uchun; doskada ism tokendan olinadi
   - `path` — bo'sh qoldiring. MicroSIP portable (o'rnatilmagan, papkadan ishlaydigan) bo'lsa,
     `microsip.exe` turgan papkani yozing, masalan `"C:\\MicroSIP"` (ikki teskari chiziq bilan).
4. `start-agent.bat` ni ikki marta bosing. Birinchi safar paketlarni o'rnatadi (internet kerak), keyin qora oyna ochiladi:
   ```
   Uy egalari agenti — operator: Akbar, microsip (C:\Users\...\AppData\Roaming\MicroSIP) → https://doska.zapusk.uz
   10:15:02  +0 kontakt, +37 qo'ng'iroq
   ```
   Oynani **yopmang**, kichraytirib qo'ying (yopsangiz qo'ng'iroqlar doskaga tushmay turadi; qayta ochsangiz hammasini yetkazadi).
5. Kompyuter yonganda o'zi ishga tushsin: `start-agent.bat` ustida o'ng tugma → *Yorliq yaratish* (Create shortcut),
   `Win+R` → `shell:startup` → Enter → ochilgan papkaga yorliqni ko'chiring.

### Qanday ishlashini tekshirish

MicroSIP'dan birorta raqamga qo'ng'iroq qiling. 5–10 soniyada doskada "Qo'ng'iroqlar" bo'limida u sizning ismingiz bilan
ko'rinadi; raqam doskadagi kartaga tegishli bo'lsa, kartaning o'zida ham chiqadi.

### Kontaktlarni MicroSIP'ga qo'shsangiz

MicroSIP → Contacts → Add: Name — uy egasining ismi, Number — raqam, **Info** — OLX e'lonining havolasi.
Shunda doskada karta o'zi paydo bo'ladi (OLX havolasi va uy nomi bilan). Qo'shmasangiz ham bo'ladi:
kartani doskada "+ Uy egasi" bilan qo'lda yarating, qo'ng'iroqlar raqam bo'yicha o'zi bog'lanadi.

### Eng muhim qoida

Qo'ng'iroq qilishdan **oldin** raqamni doskadagi qidiruvga yozing. Agar karta boshqa operatorniki bo'lsa — qo'ng'iroq qilmang.
Baribir qilsangiz, ikkalangizning ekraningizda qizil ogohlantirish chiqadi.

## Muammolar

| Belgi | Sabab / yechim |
|---|---|
| `MicroSIP ma'lumotlari topilmadi` | MicroSIP hali bir marta ham ishlatilmagan yoki portable — `path` ni to'ldiring |
| `Serverga ulanib bo'lmadi` / `fetch failed` | Server kompyuteri o'chiq, uxlayapti yoki IP o'zgargan — `config.json` dagi `server` ni yangilang |
| `Node.js topilmadi` | Node.js o'rnatilmagan yoki o'rnatgandan keyin kompyuter qayta yoqilmagan |
| Qo'ng'iroqlar eski MicroSIP'da (3.20 va pastroq) | Agent `microsip.ini` dan ham o'qiy oladi, lekin yangi versiyaga o'tish yaxshiroq |
