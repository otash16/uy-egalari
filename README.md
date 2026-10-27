# Uy egalari doskasi

OLX'dagi uy egalariga qo'ng'iroqlarni kanban doskada kuzatish va e'lonlarni Rentmi'ga ko'chirish uchun ofis ichidagi sayt.
Ikki (yoki undan ko'p) operator bitta doskada ishlaydi: har karta va har qo'ng'iroqda **kim** qilgani ko'rinadi,
boshqa operatorning uy egasiga qo'ng'iroq qilinsa hammaning ekranida qizil ogohlantirish chiqadi.

- **Server:** Node.js + Express 5 + Prisma 6 + SQLite (`server/`) — bitta kompyuterda ishlaydi, baza shu yerda
- **Sayt:** React 19 + Vite + TypeScript (`web/`) — brauzerda ochiladi, ofis tarmog'idagi hamma kompyuterdan
- **Agent:** `agent/` — har operatorning kompyuterida ishlaydi, o'sha kompyuterdagi softphone (Linphone yoki MicroSIP)
  tarixini serverga yuboradi. Server turgan kompyuterda alohida agent kerak emas (server o'zi o'qiydi).

```
  Otajon (Mac)                                  Akbar (Windows)
  ┌─────────────────────────────┐               ┌──────────────────────────┐
  │ Linphone ──► server :4100   │◄── tarmoq ────│ MicroSIP ──► agent       │
  │              + SQLite baza  │               │ brauzer: http://IP:4100  │
  │ brauzer: http://localhost   │               └──────────────────────────┘
  └─────────────────────────────┘
```

## Server (bitta kompyuterda)

```bash
yarn setup             # birinchi marta: paketlar, baza, build
yarn start             # http://localhost:4100 — tarmoqda ham ochiq (0.0.0.0)
yarn service:install   # macOS: kompyuter yoqilganda o'zi ishga tushadigan xizmat (tavsiya)
yarn ip                # sherikka beriladigan manzil: http://<shu IP>:4100
```

Kod ustida ishlash uchun: `yarn dev` (sayt http://localhost:5173, API 4100-portda).

Muhit o'zgaruvchilari (ixtiyoriy): `OPERATOR` (server kompyuterining operatori, standart `Otajon`),
`SOFTPHONE` (`linphone` | `microsip`, standart: Linphone bazasi bo'lsa `linphone`), `SOFTPHONE_PATH`,
`HOST` (`127.0.0.1` qilinsa faqat shu kompyuterdan ochiladi), `PORT`.

Server turgan kompyuter **uxlamasligi** kerak, aks holda sherikda doska ochilmaydi
(Tizim sozlamalari → Batareya → quvvat adapterida uxlamasin). Router IP'ni o'zgartirib yubormasligi uchun
DHCP'da shu Mac'ga doimiy IP biriktirib qo'ying.

## Sherikning kompyuteri

`yarn agent:pack` → `~/Desktop/uy-egalari-agent.zip` (ichida tayyor `config.json` va o'rnatish yo'riqnomasi).
Batafsil: [docs/SHERIK-WINDOWS.md](docs/SHERIK-WINDOWS.md).

## Qanday ishlaydi

- Brauzer birinchi ochilganda **"Siz kimsiz?"** so'raladi — tanlov shu kompyuterda eslab qolinadi.
  Siz qo'shgan kartalar sizning nomingizga yoziladi (kartada ham, qo'ng'iroqlarda ham ko'rinadi).
- Softphone'ga yangi kontakt qo'shilsa 4 soniya ichida doskaning birinchi ustuniga karta tushadi,
  mas'ul — o'sha kontaktni qo'shgan operator. Linphone'da OLX havolasi "Kompaniya" maydoniga,
  MicroSIP'da "Info" maydoniga yozilsa, kartada havola va uy nomi o'zi to'ladi.
- **Dublikat himoyasi:** raqami doskada bor kontakt qayta karta bo'lmaydi. Agar u boshqa operatorniki bo'lsa,
  hamma ekranda qizil ogohlantirish: *«Akbar kontakt qo'shdi: +998… — bu Otajonning uy egasi»*.
  Boshqa operatorning raqamiga chiquvchi qo'ng'iroq qilinsa ham xuddi shunday ogohlantirish chiqadi.
- Statistika qatoridagi **Hammasi / Meniki / Akbar** tugmalari doskani operator bo'yicha filtrlaydi;
  yonidagi yashil nuqta — o'sha operatorning agenti oxirgi 2 daqiqada xabar bergan.
- Qo'ng'iroq qilishdan oldin raqamni qidiruvga yozing (`/` tugmasi) — doskada bo'lsa kim va qachon gaplashgani ko'rinadi.

## Ma'lumotlar

- Baza: `server/prisma/dev.db` (bitta fayl). Zaxira: `yarn backup` → `backups/` papkasiga nusxa.
- Bazani brauzerda ko'rish: `yarn --cwd server db:studio`.
- **Ma'lumotlar ▾** menyusi: *Softphone'dan yangilash* (server kompyuterining softphone'i, odatda kerak emas — o'zi 4 soniyada yangilanadi),
  *CSV yuklab olish* / *CSV'dan import* (Excel zaxirasi, "Mas'ul" ustuni bilan).
