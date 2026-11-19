---
name: singularity-lifeos-dev
description: Guides architecture decisions, code reviews, and feature planning for "Singularity" — Uğur's personal/family Life OS project (budget, analytics/FIRE, tasks/focus, investments/net worth, vehicle & home operations, personal library, health/nutrition/wellness, digital vault, shopping). Use this skill whenever the user mentions Singularity, Life OS, or references any of its modules, asks to design, build, review, or audit a feature for this system, discusses live operations, bugfixes, event bus, AI vision pipeline, or family privacy partitioning. Always consult this skill before proposing new features or code for this project, so recommendations stay consistent with the current production architecture instead of re-litigating settled decisions or outdated blueprints.
---

# Singularity Life OS — Development Guide

Güncel üretim mimarisi, modül sınırları ve sınırlı denetim kuralları rehberi. (Her oturumda otomatik yüklenen temel kurallar ve öncelikler için kök dizindeki `AGENTS.md`, güncel envanter için `PROJECT_STATE.md` geçerlidir.)

## Proje Kapsamı ve Gerçek Durum

Singularity, bireysel ve aile içi operasyonları birleştiren canlı bir **Life OS** web/PWA uygulamasıdır.

- **Canlı Hosting:** **Vercel** (`https://singularity-life-os.vercel.app`), repo: `github.com/ugrongns/singularity-life-os` (`main`).
- **Veritabanı & ORM:** **Supabase PostgreSQL** (`eu-central-1`, Transaction Pooler port `6543`) + **Drizzle ORM** (`src/db/schema.ts`, **44 tablo**). SQLite veya yerel sunucu artık kullanılmamaktadır.
- **Framework & UI:** Next.js 15 (App Router, React 19, TypeScript Strict), Tailwind CSS, Lucide Icons, Modern Dark Minimalist Dashboard.
- **Mimari:** Online-only **Modüler Monolit** (App Router Route Handlers + Client Components).
- **Paylaşımlı PWA Kabuğu (`src/components/layout/SharedLayout.tsx`):** Tüm sayfalarda ortak Quick PIN Kilit Ekranı (`LockScreenModal`), istemci oturum önbelleği ve küresel hızlı işlem modalları (fiş tarama, barkod, plaka tarama, ses komutu, manuel harcama, hızlı görev ekleme) yer alır.
- **Aktif Modüller (`src/app/`):**
  - `/` (Ana Akış & Özet)
  - `/budget` (Bütçe, Hesaplar, Kredi Kartı Kesim, Borç/Alacak, Sabit Faturalar)
  - `/analytics` (5x20 Holistik Skor, FIRE & Yaşam Takvimi Isı Haritası)
  - `/tasks` (Görevler, MIT/Top-3, Alt Görevler, Yinelenen Görevler, Pomodoro/Odak Sayacı, Aylık Takvim, Çapraz Modül Köprüleri)
  - `/vehicles` (Araç & Ev Operasyonları)
  - `/library` (Kütüphane, ISBN Tarama, Okuma Oturumları & Alıntılar)
  - `/health` (Beslenme, Aralıklı Oruç, Su & Antrenman/Strava)
  - `/wellness` & `/boost` (Takviyeler, Uyku, Ruh Hali, Biyometri & Akıllı Tartı)
  - `/vault` (Dijital Kasa, Önemli Tarihler, Evcil Hayvan Kayıtları)
  - `/shopping` (Alışveriş Listesi & Fiş Tarama)
  - `/settings`, `/welcome`, `/auth`

Tarihsel tasarım taslağı için [references/blueprint.md](./references/blueprint.md) yalnızca alan iş kurallarına (MTV takvimi, TÜFE kira artışı, okuma hızı hesabı vb.) referans olarak kullanılır; altyapı/hosting varsayımları geçersizdir.

---

## Değişmez Mimari İlkeler ve Sistem Gerçekleri

1. **Online-First (Offline Sync Worker Yok):**
   - `src/db/schema.ts` içinde `syncQueue` tablosu yer alsa da arka planda senkronizasyon yapan hiçbir worker yoktur. Sistem online-only çalışır; istemcide hayali offline senkron kuyruğu varsayılmaz.
2. **AI Vision / OCR Çıktısı Asla Otomatik Yazılmaz:**
   - Fiş, fatura, kitap kapağı/barkod, yemek fotoğrafı, tartı ekranı, doküman veya ses komutu çıktıları veritabanına yazılmadan önce mutlaka kullanıcının **onay/düzenleme ekranından** geçmelidir. AI fallback süreçlerinde gerçek dışı veri üretilmez.
3. **Event Bus Durumu (`src/lib/events.ts`):**
   - `src/lib/events.ts` (`eventBus` / `domainEventBus`, `EVENTS`) aktiftir; `TRANSACTION_CREATED`, `VEHICLE_MAINTENANCE_RECORDED`, `DIET_MEAL_RECORDED` ve `TASK_COMPLETED` olayları için dinleyiciler tanımlıdır ve ilgili API rotalarından tetiklenir.
   - `src/lib/event-bus.ts` yalnızca geriye dönük re-export dosyasıdır. Yeni modüller arası yan etkilerde `src/lib/events.ts` kullanılmalı veya açıkça değerlendirilmelidir.
4. **Kütüphane Mükerrer Kitap Koruması:**
   - `/api/library/scan-isbn`, `/api/library` POST **409 Conflict** kalkanı ve `AddBookModal` içindeki iki yönlü seçim (**"Mevcut Kitabı Aç/Güncelle"** vs `allowDuplicate: true` ile **"2. Kopya Olarak Ekle"**) tüm kütüphane akışlarında korunmalıdır.
5. **Aile Mahremiyeti Ayrımı (Binary Partitioning) & BOLA:**
   - Ortak Aile Havuzu (`familyId`: ortak bütçe, alışveriş, araç/ev, ortak kasa, kütüphane, paylaşılan görevler) vs Özel Bireysel Alan (`userId`: kişisel sağlık, oruç, wellness, özel görev/notlar).
   - Tüm korumalı API rotaları `getAuthUser()` ile kimlik ve sahiplik/aile yetkisi kontrolü yapmalıdır.
6. **Tarih & Saat Dilimi Standardı (`Europe/Istanbul`):**
   - Görevler, MIT görünümleri, fatura takvimleri ve çapraz modül köprülerinde UTC gün kaymasını önlemek için `src/lib/date-utils.ts` (`getTodayTurkeyDate`, `shiftTurkeyDate`, `diffTurkeyCalendarDays`) kullanılmalıdır.
7. **Güvenlik Temelleri:**
   - Unauthenticated API rotasına izin verilmez; Telegram webhook gizli token ile korunur; Digital Vault dosya yükleme/indirmede MIME ve erişim kontrolü zorunludur.

---

## Bilinen Açık Sorunlar & Çevresel Kısıtlar

- **Vercel Serverless Kütüphane ISBN Hatası:** Yerelde sorunsuz çalışan bazı ISBN aramaları (ör. `9786254416170`) Vercel canlı ortamında harici kaynak timeout/IP engeli nedeniyle başarısız olabilmektedir. Canlı kütüphane ISBN hatalarında ilk şüpheli serverless ağ kısıtlarıdır.
- **Test Gerçekliği:** `tests/*.test.ts` içindeki veritabanı testleri `@/db` katmanını in-memory mock'lar; gerçek Drizzle sorgusu, constraint veya UI davranışları için kritik akışlarda canlı doğrulama yapılmalıdır.
- **ESLint & Doğrulama Kapısı:** `eslint.config.mjs` (`eslint-config-next`) aktiftir. Varsayılan doğrulama kapısı `npm run verify` (`typecheck` + `lint` + `test`), UI değişikliklerinde tarayıcıda canlı kontrol, büyük işlerde `npm run verify:full` (`verify` + `next build`) kullanılır.

---

## Sınırlı Kod İncelemesi ve Denetim Kontrol Listesi

Denetimlerde sonsuz döngüye girmemek için yalnızca aşağıdaki **Kritik / Bloker Kriterleri** düzeltilir:

- [ ] **Auth & BOLA:** API rotası `getAuthUser()` ve `userId`/`familyId` sahiplik kontrolü yapıyor mu?
- [ ] **Veri & Matematik:** Finansal, taksit, kalori, WPM veya `Europe/Istanbul` tarih hesaplarında bozukluk / veri kaybı riski var mı?
- [ ] **AI Onay Kalkanı:** Vision/OCR/ses çıktısı kullanıcı onayı olmadan DB'ye yazılıyor mu?
- [ ] **Canlı Ortam Uyumu:** Vercel + Supabase PostgreSQL varsayımlarına aykırı yerel dosya/SQLite bağımlılığı var mı?
- [ ] **Kütüphane 409 Kalkanı (ilgiliyse):** Mükerrer kitap kontrolü ve `allowDuplicate` akışı korunuyor mu?
- [ ] **Doğrulama Kapısı:** `npm run verify` (UI değiştiyse canlı tarayıcı kontrolü, büyük işlerde `npm run verify:full`) sıfır hata ile geçti mi?

**Durma & Opsiyonel Not Kuralı:**
- Kritik/Bloker ihlal yoksa sonuç **`"Sorun Yok" (PASS)`** olarak kapatılır ve ekstra düzeltme turuna geçilmez.
- Varsa en fazla **10 maddelik salt-okunur "Opsiyonel İyileştirme Notu"** bırakılabilir (**sayıyı doldurmak için zorlama madde uydurulmaz; 1 tane bile gerçekten gerekli iyileştirme yoksa hiç yazılmaz (`0 öneri` tamamdır) ve kullanıcı açıkça istemedikçe bu opsiyonel öneriler uygulanmaz**).

---

## İletişim, Onay ve Git Protokolü

- **Dil:** İletişim, UI metinleri ve dokümantasyon **Türkçe**; kod içi tüm isimlendirmeler **İngilizce**. Gereksiz temel kavram açıklaması yapılmaz; doğrudan kök neden, teknik risk ve çözüm konuşulur.
- **Hibrit Onay Protokolü:** Veritabanı şeması, temel mimari kararlar veya çok dosyalı büyük özellik/güncellemelerde önce plan sunulup açık onay beklenir. Küçük–orta hata düzeltmeleri, test eklemeleri, UI rötuşları ve `/goal` görevleri doğrudan uygulanır.
- **Git Commit / Push:** Kullanıcı açıkça *"commit at / pushla"* veya `!bitti` demedikçe otomatik commit/push yapılmaz; `PROJECT_STATE.md` yalnızca önemli kilometre taşlarında güncellenir.
