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
4. Papkadagi `ornatish.bat` ni **ikki marta bosing**. Ko'k "Windows protected your PC" oynasi chiqsa: "More info" → "Run anyway".
   Qora oyna ochilib paketlarni o'rnatadi (birinchi safar 1–2 daqiqa, internet kerak), avtostartni sozlaydi va agentni
   fonda ishga tushiradi. Oxirida "Tayyor" deb yozadi, istalgan tugmani bosib yoping.

Shu bilan tamom. Agent **ko'rinmas** ishlaydi: hech qanday oyna yo'q, yopib qo'yish mumkin emas, kompyuter qayta yonganda o'zi
ishga tushadi. Nima qilayotganini ko'rish: papkadagi `agent.log` fayli (Bloknotda ochiladi).
To'xtatish yoki olib tashlash: `olib-tashlash.bat`.

> Qo'ng'iroqlar agentsiz ham doskaga tushadi — ularni telefon stansiyasining o'zi yozib boradi. Agent faqat MicroSIP'ga
> qo'shgan **kontaktlaringizni** doskaga karta qilib tushirish uchun kerak.

### Qanday ishlashini tekshirish

MicroSIP → Contacts → Add bilan bitta kontakt qo'shing. 5–10 soniyada doskada "Yangi" ustunida u sizning ismingiz bilan karta
bo'lib chiqadi. Chiqmasa, `agent.log` ning oxirgi qatorlarini sherigingizga yuboring.

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
| `Serverga ulanib bo'lmadi` / `fetch failed` | Internet yo'q yoki `config.json` dagi `server` noto'g'ri (https://doska.zapusk.uz bo'lishi kerak) |
| `401` / token xatosi | `config.json` dagi `token` noto'g'ri — sherigingizdan yangisini oling (/users → "Agent token") |
| `Node.js topilmadi` | Node.js o'rnatilmagan yoki o'rnatgandan keyin kompyuter qayta yoqilmagan |
| Kontakt doskaga tushmayapti | `agent.log` oxirini qarang. Fayl umuman yangilanmasa agent ishlamayapti — `ornatish.bat` ni qayta bosing |
| Agent bilan nima bo'layotganini ko'rmoqchiman | `start-agent.bat` — xuddi shu agent, lekin oynada (avval `olib-tashlash.bat`, aks holda ikkita ishlaydi) |
| Qo'ng'iroqlar eski MicroSIP'da (3.20 va pastroq) | Agent `microsip.ini` dan ham o'qiy oladi, lekin yangi versiyaga o'tish yaxshiroq |
