# Singularity Life OS — Canlı Proje Durumu (`PROJECT_STATE.md`)

> **Son Güncelleme:** 2026-11-19  
> **Aktif Dal:** `main` (`!denetle analitik` denetim, mahremiyet, finans/TR saat dilimi doğrulaması, isteğe bağlı TÜFE ayarı ve canlı responsive UI kapanışı)  
> **Canlı Ortam:** Vercel (`https://singularity-life-os.vercel.app`) + Supabase PostgreSQL (`eu-central-1`)

---

## 1. Mevcut Sistem Envanteri (Doğrulanmış Durum)
- **Çerçeve & Derleme:** Next.js `15.5.23` (App Router), React `19`, TypeScript `5.7.3` (`strict: true`), Drizzle ORM `0.38.4`.
- **Veritabanı Şeması:** `src/db/schema.ts` içinde **44 tablo** tanımlı.
- **Aktif Sayfa Modülleri (`src/app/`):**
  - `/` (Ana Akış & Özet), `/budget` (Bütçe & Nakit Akışı), `/analytics` (5x20 Holistik Skor, FIRE & Yaşam Takvimi Isı Haritası), `/tasks` (Görevler, MIT, Alt Görevler, Yinelenme, Pomodoro/Odak, Aylık Takvim), `/vehicles` (Araç & Ev), `/library` (Kütüphane), `/health` (Beslenme, Oruç, Antrenman), `/wellness` & `/boost` (Wellness, Takviye, Uyku, Tartı), `/vault` (Dijital Kasa), `/shopping` (Alışveriş Listesi), `/settings`, `/welcome`, `/auth`.
- **Doğrulama Durumu (`2026-11-19` itibarıyla):**
  - `npm run typecheck` (`tsc --noEmit`): Geçiyor (`exit 0`).
  - `npm run lint` (`eslint .` — `eslint.config.mjs`): Sıfır hata (`exit 0`).
  - `npm run test` (`vitest run`): `23` dosya / `350` test geçiyor (`exit 0`; yeni `tests/analytics-audit.test.ts` içinde `7` analitik regresyon testi).
  - `npm run verify` / `npm run verify:full` (`next build` dahil): Geçiyor (`exit 0`).

---

## 2. Son Tamamlanan İşler
- **[2026-11-19]** `!denetle analitik` modül denetimi, opsiyonel iyileştirmeler & kapanış düzeltmeleri (`tests/analytics-audit.test.ts`):
  - *BOLA & Kişisel Mahremiyet:* `/api/analytics/calendar` içinde `waterIntakeLogs` sorgusu `family_id` sızıntısından arındırılıp yalnızca `user_id` ile sınırlandı; `/api/analytics` `walletsAccounts` ortak (`user_id IS NULL`) hesapları ve `categories` küresel seed (`family_id IS NULL`) kategorilerini (`income` limitleri gider bütçesinden ayrılarak) kapsadı.
  - *Finansal Matematik, TR Takvim & Lazy Reset:* `📥 Gelen Transfer`, `💳 Kart Ödeme Tahsilatı`, `Vadeli Mevduat Açılışı/Dönüşü`, `Kredi Çekim Anaparası` ve `🤝 Şahıs/Şahsa` satırları gider/enflasyondan ayrıştırıldı; `💵 Vadeli Mevduat Faiz Geliri`, dövizli `time_deposit` pasif getirileri ve yabancı para birimli işlemler TRY'ye çevrildi. Sentetik `totalBudgetLimit * 1.2` geliri kaldırılıp son 3 ay gerçek ortalama geliri bağlandı. `calendar-heatmap.ts` oruç bitişleri `toTurkeyDay` (`Europe/Istanbul`) gününe ve `supplementRoutines` `last_taken_date === today` kontrolüne çekildi.
  - *İsteğe Bağlı TÜFE Referansı & `localhost` SW Koruması:* `GET`/`PATCH /api/analytics` ile aile bazlı `tuik_tufe_rate_${familyId}` tercihi (`FireAnalyticsCard` satır içi düzenleyici + `/settings` `📊 Analitik & TÜFE` `AnalyticsSettingsCard`) eklendi; `PwaManager.tsx` & `public/sw.js` `localhost` geliştirmede eski SW önbelleğini temizleyecek ve devre dışı bırakacak şekilde güncellendi.
  - *Duyarlı UI & Canlı Doğrulama:* `.analytics-kpi-grid` iki sütunlu masaüstü kartlarında 2x2 Bento düzeninde tutularak `₺2...` kesilmeleri giderildi; `Aylık Pasif Gelir` satırı `flexWrap` + `gap`, `HolisticScoreCard` tek emoji, `LifeCalendarHeatmap` dinamik `{rangeDays}` başlığı + `useCallback` temizliği ve `analytics/page.tsx` hata ayrımı tamamlandı (`npm run verify:full`, `350/350` test, canlı masaüstü/mobil & TÜFE CRUD kalıcılığı doğrulandı).
- **[2026-11-19]** `!denetle bütçe` modül denetimi & kapanış düzeltmeleri (`12` API rotası, `11` UI/CSS dosyası, `tests/budget-audit.test.ts`):
  - *BOLA & Yetki İzolasyonu:* `family_id = NULL` olan veya kişisel (`is_family_shared = 0`) yabancı cüzdan/hesap/fatura/borç kayıtlarına erişim engellendi; `owner_user_id`/`member_id` aile üyeliği kontrolü, `POST /api/budget/categories` cross-tenant `is_family_shared` sızıntı engeli ve `GET /api/budget/personal-debts` `401` koruması eklendi.
  - *Finansal & Takvim Kesinliği:* `db.transaction` içi `NOT_FOUND:`/`FORBIDDEN:`/`INSUFFICIENT_FUNDS:`/`LIMIT_EXCEEDED:` hataları `404`/`403`/`400` HTTP kodlarına eşlendi; mükerrer `mark_paid` ödemesi, `personal-debts` TRY dışı cüzdan bağlantısı ve sistem kredi anapara/vadeli mevduat açılış-dönüş satırlarının silinmesi engellendi; `[linked_tx:...]` ile tekil çift yönlü transfer iadesi, `Vadeli Mevduat Faiz Geliri` & `Gelir Girişi` gelir sınıflandırması, kur `0` sıfıra bölünme koruması, kredi taksit kuruş artığının ilk taksite eklenmesi ve tüm tarih hesaplarının `Europe/Istanbul` (`date-utils.ts`) hizalaması sağlandı.
  - *Sıfır Mock & Responsive UI:* `budget/page.tsx` sabit FX kur fallback'leri kaldırılıp hata şeridi eklendi; `RecentTxCard` 4 sütunlu sığdırılmış masaüstü tablosu ve tek büyüteç düzeltmesi, `MarketRatesBar` `repeat(auto-fit, minmax(140px, 1fr))` + iç `flex-wrap` ile 6 kartta sıfır taşma, `SharedLayout` & `globals.css` mobil header hizalama ve `BudgetLimitsCard` / `AccountsCard` / `RecurringBillsCard` / `Görünüm Filtresi` kırpılmasız sarmalama (`npm run verify:full`, `343/343` test, canlı masaüstü/mobil & CRUD kalıcılık doğrulandı).
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
1. **Küresel Seed Kategoriler (`family_id IS NULL`) Çok Kiracılı İzolasyonu (Onay Gerektirir):** `src/db/index.ts` içinde seed edilen 8 varsayılan kategori (`cat-maas`, `cat-market` vb.) `family_id = NULL` ortak kayıt olarak tutulduğundan `categories/route.ts` lider güncellemelerinin aile bazlı şablon kopyalamasına taşınması için mimari/veri göçü planı onaylanmalıdır.
2. **ESLint Uyarıları & Tip Sıkılaştırma:** Mevcut legacy uyarılarda (`no-unused-vars`, `exhaustive-deps`, `no-img-element`) hata yok; ileride ayrı küçük adımlarla temizlenip `@typescript-eslint/no-explicit-any` kademeli açılabilir.
3. **Test Kapsamı Gerçekliği:** Mevcut test dosyaları `@/db` katmanını bellek içi mock'larla çalıştırıyor; kritik kullanıcı akışları için canlı UI/E2E smoke kontrolleri artırılmalı.
4. **Büyük Dosyaların Bölünmesi:** `src/components/tasks/TasksClient.tsx`, `src/app/api/tasks/route.ts` ve `src/lib/tasks-engine.ts` sonraki görevlerde küçük parçalara ayrılabilir.
5. **Vercel Serverless Kütüphane ISBN Sorunu:** Bazı ISBN'lerde (ör. `9786254416170`) canlı Vercel ortamında dış kaynak timeout/IP kısıtı yaşanabiliyor.
