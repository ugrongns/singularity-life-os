# Singularity Life OS — Canlı Proje Durumu (`PROJECT_STATE.md`)

> **Son Güncelleme:** 2026-11-18  
> **Aktif Dal:** `main` (`!denetle görevler` denetim, güvenlik ve arayüz düzeltmeleri)  
> **Canlı Ortam:** Vercel (`https://singularity-life-os.vercel.app`) + Supabase PostgreSQL (`eu-central-1`)

---

## 1. Mevcut Sistem Envanteri (Doğrulanmış Durum)
- **Çerçeve & Derleme:** Next.js `15.5.23` (App Router), React `19`, TypeScript `5.7.3` (`strict: true`), Drizzle ORM `0.38.4`.
- **Veritabanı Şeması:** `src/db/schema.ts` içinde **44 tablo** tanımlı.
- **Aktif Sayfa Modülleri (`src/app/`):**
  - `/` (Ana Akış & Özet), `/budget` (Bütçe & Nakit Akışı), `/analytics` (5x20 Holistik Skor & FIRE), `/tasks` (Görevler, MIT, Alt Görevler, Yinelenme, Pomodoro/Odak, Aylık Takvim), `/vehicles` (Araç & Ev), `/library` (Kütüphane), `/health` (Beslenme, Oruç, Antrenman), `/wellness` & `/boost` (Wellness, Takviye, Uyku, Tartı), `/vault` (Dijital Kasa), `/shopping` (Alışveriş Listesi), `/settings`, `/welcome`, `/auth`.
- **Doğrulama Durumu (`2026-11-18` itibarıyla):**
  - `npm run typecheck` (`tsc --noEmit`): Geçiyor (`exit 0`).
  - `npm run lint` (`eslint .` — `eslint.config.mjs`): Sıfır hata (`exit 0`).
  - `npm run test` (`vitest run`): 20 dosya / 324 test geçiyor (`exit 0`).
  - `npm run verify` / `npm run verify:full`: Geçiyor (`exit 0`).

---

## 2. Son Tamamlanan İşler
- **[2026-11-18]** `!denetle görevler` modül denetimi & kapanış düzeltmeleri: `import_cross_module` ortak kart BOLA kontrolü, `/api/backup` `is_family_shared = 0` mahremiyet koruması, `update` alt-görev doğrulama ve durum senkronu, `projectVirtualRecurrences` sanal rutin tekilleştirme, pasif (`is_active = 0`) üye filtrelemesi, Ana Sayfa/`TasksClient`/`TimeContextualFeed` banner-buton hizalamaları ve `/tasks` masaüstü/mobil sekme şeridi duyarlılığı (`324/324` test, canlı oturumlu CRUD/yenileme doğrulandı).
- **[2026-11-18]** Tasks modülü BOLA/güvenlik, `Europe/Istanbul` takvim hizalaması, Pomodoro odak zamanlayıcı, aylık görev takvimi ve 5x20 holistik skor geliştirmeleri (`fd0e0a5`, `ac3cfe8`).
- **[2026-11-18]** **Skill / Kural Temizliği & Doğrulama Kapısı (Adım 1):**
  - Çift kopya `.agent/skills/` ve mimariyle çelişen 8 jenerik kurumsal skill temizlendi.
  - `singularity-lifeos-dev` skill'i `.agents/skills/singularity-lifeos-dev/` altına taşındı ve güncel kod tabanıyla eşitlendi.
  - Always-on proje kuralları için `AGENTS.md` ve canlı durum için `PROJECT_STATE.md` oluşturuldu.
  - `SINGULARITY_MASTER_SPECIFICATION.md` ve `PROJECT_BLUEPRINT.md` tarihsel arşiv olarak işaretlendi.
  - `package.json` içine `typecheck`, `test`, `test:watch`, `verify`, `verify:full` script'leri eklendi.

- **[2026-11-18]** **ESLint (`eslint-config-next`) Kurulumu & Çalışma Kurallarının Hizalanması:**
  - `eslint`, `eslint-config-next@15.5.23` ve `@eslint/eslintrc` kuruldu; `eslint.config.mjs` oluşturuldu.
  - Tespit edilen 1 adet gerçek `react-hooks/rules-of-hooks` hatası (`BookDetailModal.tsx`) ve 12 adet `prefer-const` hatası düzeltildi; `npm run lint` artık `npm run verify` ve `npm run verify:full` içinde zorunlu kapıdır.
  - `AGENTS.md` ve `singularity-lifeos-dev/SKILL.md` hibrit onay, Kritik/Bloker + en fazla 3 salt-okunur opsiyonel not, UI'da canlı tarayıcı doğrulaması ve onaysız commit/push yasağı kurallarına göre hizalandı.
  - Dinamik keşifli tek komut denetim rehberi `.agents/skills/singularity-audit/SKILL.md` (`!denetle`) eklendi.

---

## 3. Bilinen Açıklar & Sonraki Öncelikli Adımlar
1. **ESLint Uyarıları & Tip Sıkılaştırma:** Mevcut legacy uyarılarda (`no-unused-vars`, `exhaustive-deps`, `no-img-element`) hata yok; ileride ayrı küçük adımlarla temizlenip `@typescript-eslint/no-explicit-any` kademeli açılabilir.
2. **Test Kapsamı Gerçekliği:** Mevcut 20 test dosyası `@/db` katmanını bellek içi mock'larla çalıştırıyor; kritik kullanıcı akışları için canlı UI/E2E smoke kontrolleri artırılmalı.
3. **Büyük Dosyaların Bölünmesi:** `src/components/tasks/TasksClient.tsx`, `src/app/api/tasks/route.ts` ve `src/lib/tasks-engine.ts` sonraki görevlerde küçük parçalara ayrılabilir.
4. **Vercel Serverless Kütüphane ISBN Sorunu:** Bazı ISBN'lerde (ör. `9786254416170`) canlı Vercel ortamında dış kaynak timeout/IP kısıtı yaşanabiliyor.
