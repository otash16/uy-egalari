# Uy egalari doskasi

OLX'dagi uy egalariga qo'ng'iroqlarni kanban doskada kuzatish va e'lonlarni Rentmi'ga ko'chirish uchun shaxsiy localhost sayt.

- **Backend:** Node.js + Express 5 + Prisma 6 + SQLite (`server/`)
- **Frontend:** React 19 + Vite + TypeScript (`web/`)

## Ishga tushirish

```bash
yarn setup   # birinchi marta: paketlar, baza, build
yarn start   # http://localhost:4000
```

Kod ustida ishlash uchun: `yarn dev` (frontend http://localhost:5173, API 4000-portda).

## Ma'lumotlar

- Baza: `server/prisma/dev.db` (bitta fayl). Zaxira: `yarn backup` → `backups/` papkasiga nusxa.
- Bazani brauzerda ko'rish: `yarn --cwd server db:studio`.
- **Ma'lumotlar ▾** menyusi:
  - *Linphone'dan yangilash* — Linphone'dagi yangi kontaktlarni birinchi ustunga qo'shadi (bor raqamlar va avval o'chirilganlar qayta qo'shilmaydi).
  - *CSV yuklab olish* / *CSV'dan import* — Excel zaxirasi; eski HTML doskadan olingan CSV ham import qilinadi.

Linphone bazasi manzili boshqacha bo'lsa: `LINPHONE_DB=/yo'l/linphone.db yarn start`.
