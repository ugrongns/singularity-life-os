# Singularity — Tüm Modüller, Modlar ve 66 Açılır Pencere (Modal & Çekmece) İçin Hazır Prompt Rehberi

Bu dosya, Singularity projesinde yapay zekâya **teknik detay ezberlemeden** tek tıkla kopyalayıp yapıştırabileceğin tüm komutları, sistemdeki **16 ana modül** için denetim promptlarını ve **66 açılır pencerenin (modal, sayfa içi pop-up ve çekmece)** her biri için ayrı hazır promptları içerir.

> **Son Senkronizasyon:** Sistemdeki LifeOS entegrasyonları (Faz 1: `Ctrl+K` Komut Paleti, Kanban, Borç Simülatörleri, Okuma Kronometresi/Analitiği, BIA/PR, Market Çipleri; Faz 2: `/habits`, `/notes`, Banka CSV İçe Aktarım, Hazır Antrenman Rutinleri, Yer İmleri; Faz 3: `/calendar` Zaman Bloklama, `/okr` Yaşam Vizyonu) ile `/health` ve `/wellness` denetimleri sonrası tam güncellenmiştir.
>
> **Nasıl kullanılır?** İstediğin başlığın altındaki kutunun sağ üstündeki kopyala ikonuna basıp doğrudan yeni bir sohbete yapıştırabilirsin. Her prompt, `AGENTS.md` ve `.agents/skills/singularity-audit/SKILL.md` kurallarına uygun olarak **sonsuz döngüyü önleyecek (`en fazla 2 tur`, `"Sorun Yok" (PASS)` ve `onaysız commit/push yok`)** biçimde yazılmıştır.

---

## Bölüm 1 — Tek Satırlık Kısa Komutlar ve Slash Komutları

### 1.1. Kısa Komutlar (`!` Protokolü)

#### Son Yapılan Değişikliği Denetle
Yalnızca son değişikliği test/derleme ve gerekiyorsa canlı tarayıcı üzerinden kontrol eder.
```text
!denetle
```

#### Tüm Sistem Güvenlik Taraması
Sistemdeki o günkü tüm API uçlarını oturum, aile/kullanıcı izolasyonu, dosya erişimi ve AI onay kalkanı açısından tarar; kod değiştirmeden sade Türkçe özet çıkarır.
```text
!denetle güvenlik
```

#### Tüm Sayfaların Canlı Görsel Kontrolü
O gün sistemde bulunan tüm sayfaları yerel sunucuda açıp masaüstü ve telefon boyutunda tarayıcıda kontrol eder.
```text
!denetle görsel
```

#### Tüm Sistemi Baştan Sona Denetle
Güvenlik + Görsel + Modül kontrollerini sırayla, sistemi boğmadan tamamlar.
```text
!denetle hepsi
```

#### Proje Durumunu Öğren (Yeni Sohbet Başlangıcı)
Son tamamlanan işi ve sıradaki öncelikleri özetler.
```text
!durum
```

#### Büyük Özellik / Şema Değişikliği Öncesi Plan Çıkar
Kodlamaya geçmeden önce riskleri ve adımları çıkarıp onay ister.
```text
!plan
```

#### İşi Bitir, Doğrula ve Canlıya (Vercel) Yayınla
Tüm tip, lint, test ve build kapılarını çalıştırıp `PROJECT_STATE.md` günceller, commit atar ve `main` dalına push yapar.
```text
!bitti
```

---

### 1.2. Özel Durumlarda Kullanılacak Slash Komutları (`/komut`)

Günlük işlerde ve normal `!denetle` kullanımında `/boost` yazmana **gerek yoktur**; yalnızca şu durumlarda kullan:

* **Başında beklemeyeceğin uzun denetim (otonom tamamlama):**
```text
/goal !denetle hepsi
```
* **Çok karmaşık yeni mimari veya derin güvenlik incelemesi:**
```text
/boost !denetle görevler
```
* **Büyük bir özelliğe başlamadan önce soru-cevapla tasarımı netleştirme:**
```text
/grill-me
```
* **Ajan canlı tarayıcı kontrolünü kendiliğinden başlatmazsa:**
```text
/browser
```
* **Aynı sohbet çok uzadığında bağlamı özetleyip hafifletme:**
```text
/compact
```

---

## Bölüm 2 — Süreç ve Yardımcı Hazır Promptlar

### 2.1. Son Değişikliği Sade Türkçeyle Kontrol Et (`!denetle` alternatifi)
```text
Son yaptığımız değişikliği kontrol et. Sadece çalışmayı bozan Kritik/Bloker hataları (güvenlik, veri kaybı, yanlış hesap, kırık akış, test/derleme hatası) düzelt ve en fazla 2 turda dur. Kritik hata kalmayınca "Sorun Yok" (PASS) yaz; istersen altına en fazla 10 maddelik salt-okunur opsiyonel öneri bırak (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma) ama onayım olmadan uygulama.
```

### 2.2. Kod Değiştirmeden Güvenlik Matrisi Çıkar
```text
Kod değiştirmeden tüm src/app/api/**/route.ts uçlarını yalnızca oturum kontrolü, kullanıcı/aile izolasyonu, AI onaysız veritabanı yazımı ve dosya erişimi açısından tara. Teknik terimlere boğmadan sade Türkçe ile "Uç | Risk | Açıklama" tablosu çıkar. Kritik açık yoksa "Sorun Yok" (PASS) de.
```

### 2.3. Tarayıcı Girişi Beklediğinde Devam Etme Promptu
```text
giriş yaptım, devam et
```

### 2.4. Canlı Tarayıcı Testini İptal Edip Yerel Sunucuyu Kapatma Promptu
```text
Yerel sunucuyu kapat, canlı tarayıcı testi gerekmiyor; mevcut test ve derleme sonucuyla tamam.
```

### 2.5. Canlıya Yayınlamadan Sadece Bilgisayara Kaydetme Promptu
```text
Değişiklikleri git commit ile kaydet ama push yapma.
```

### 2.6. Başka Bir Projeden Özellik İnceleme ve Entegrasyon Planı Promptu
*(Örnek klasör yolunu inceletmek istediğin proje ile değiştirerek kullanabilirsin; önce kod değiştirmeden rapor alırsın.)*
```text
c:\Users\uguro\Documents\Projeler\life_os klasöründeki projemi incele ve Singularity'nin mevcut modülleriyle (src/app/ ve src/db/schema.ts) karşılaştır. Şimdilik HİÇBİR kod veya şema değişikliği yapma. Sade Türkçe ile (A) değer katacak yeni özellikler, (B) mevcut modüllere eklenebilecek geliştirmeler ve (C) almaya gerek olmayanlar olarak sınıflandır; her öneri için Singularity'nin online-only Next.js + Supabase PostgreSQL + aile/kişisel mahremiyet + Europe/Istanbul tarih + EventBus kurallarına nasıl uyarlanacağını ve faz sırasını çıkar, sonra benden onay iste.
```

---

## Bölüm 3 — Tüm Modüller İçin Ayrı Kopyala-Yapıştır Promptlar (16 Modül)

### 3.1. Ana Sayfa / Günlük Özet (`/`)
**Kapsam:** `src/app/page.tsx`, `src/app/api/dashboard/composite/route.ts`, günlük akış, takip banner'ları ve özet kartları.
```text
Ana Sayfa (/) modülünü, src/app/api/dashboard/composite/route.ts ucunu ve özet bileşenlerini denetle. npm run verify çalıştır; yerel sunucuda / sayfasını masaüstü (~1280px) ve mobil (~390px) boyutta canlı açıp kart hizalarını, takip banner'larını ve konsol/API hatalarını kontrol et. Yalnızca Kritik/Bloker hataları düzelt (en fazla 2 tur), yoksa "Sorun Yok" (PASS) ve en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.2. Görevler, Odak & Kanban (`/tasks`)
**Kapsam:** `src/app/tasks/page.tsx`, `src/app/api/tasks/route.ts`, `src/lib/tasks-engine.ts`, `src/components/tasks/TaskKanbanBoard.tsx`, MIT kotası, alt görevler, tekrarlar, Pomodoro/odak sayacı ve aylık takvim.
```text
!denetle görevler
```
*(Açık metin şablonu:)*
```text
Görevler (/tasks) modülünü, TaskKanbanBoard ve src/app/api/tasks/route.ts ucunu denetle. API yetki/aile izolasyonu, Europe/Istanbul tarih hesabı, alt görev/MIT/odak sayacı/Kanban sürükleme-durum mantığı, aylık takvim ve canlı tarayıcı görünümünü (masaüstü + mobil) kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.3. Zaman Bloklama & Ajanda (`/calendar`) — YENİ
**Kapsam:** `src/app/calendar/page.tsx`, `src/components/calendar/CalendarClient.tsx`, `src/app/api/time-blocks/route.ts`, `src/lib/time-blocks-engine.ts`, saatlik zaman blokları, çakışma/süre hesabı, planlanmamış görev/kitap/alışkanlık çekmecesi.
```text
!denetle takvim
```
*(Açık metin şablonu:)*
```text
Zaman Bloklama (/calendar) modülünü, CalendarClient, src/lib/time-blocks-engine.ts ve src/app/api/time-blocks/route.ts ucunu denetle. Yetki/aile paylaşımı izolasyonu, Europe/Istanbul gün/saat bloklama ve çakışma matematiği, görev/kitap/alışkanlık bağlama akışı ile masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.4. OKR & Yaşam Vizyonu (`/okr`) — YENİ
**Kapsam:** `src/app/okr/page.tsx`, `src/components/okr/OkrClient.tsx`, `src/app/api/okr/route.ts`, `src/lib/okr-engine.ts`, stratejik hedefler (Objective), anahtar sonuçlar (Key Result), check-in ve diğer modüllerden canlı veri çekimi.
```text
!denetle okr
```
*(Açık metin şablonu:)*
```text
OKR & Yaşam Vizyonu (/okr) modülünü, OkrClient, src/lib/okr-engine.ts ve src/app/api/okr/route.ts ucunu denetle. Yetki/aile izolasyonu, ağırlıklı hedef/KR ilerleme matematiği, check-in kalıcılığı, kitap/birikim/antrenman/görev/alışkanlık canlı metrik bağlantıları ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.5. Bütçe, Nakit Akışı & Birikim Hedefleri (`/budget`)
**Kapsam:** `src/app/budget/page.tsx`, `src/app/api/budget/**`, `src/app/api/transactions/route.ts`, `src/lib/debt-simulators.ts`, `src/lib/bank-csv-parser.ts`, `src/lib/finance-quick-parser.ts`, `SavingsGoalsCard.tsx`, hesaplar, kart kesim tarihleri, aile-izole kategoriler, borç/alacak ve sabit faturalar.
```text
!denetle bütçe
```
*(Açık metin şablonu:)*
```text
Bütçe (/budget) modülünü, src/app/api/budget/** (sinking-funds dahil) ve /api/transactions uçlarını denetle. Yetki/aile izolasyonu, bakiye/taksit/kredi kartı kesim ve kredi itfa matematiği, banka CSV içe aktarım, birikim hedefleri ve canlı tarayıcı görünümünü (masaüstü + mobil) kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.6. Analitik, FIRE & Holistik Skor (`/analytics`)
**Kapsam:** `src/app/analytics/page.tsx`, `src/app/api/analytics/**`, 5x20 Holistik Skor, FIRE, isteğe bağlı TÜFE ayarı ve yaşam takvimi ısı haritası (`src/lib/calendar-heatmap.ts`).
```text
!denetle analitik
```
*(Açık metin şablonu:)*
```text
Analitik (/analytics) modülünü ve src/app/api/analytics/** uçlarını denetle. 5x20 Holistik Skor, FIRE, dövizli pasif getiri, TÜİK tercihi ve Europe/Istanbul ısı haritası hesaplamalarının doğruluğunu, yetki izolasyonunu ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.7. Araç & Ev Operasyonları (`/vehicles`)
**Kapsam:** `src/app/vehicles/page.tsx`, `src/app/api/vehicles/**`, `src/app/api/home-operations/**`, KM/bakım eşikleri, yasal tarihler ve bütçe bağlantıları.
```text
!denetle araç
```
*(Açık metin şablonu:)*
```text
Araç ve Ev Operasyonları (/vehicles) modülünü denetle. Yetki/aile izolasyonu, KM/tarih eşik hesapları, EventBus/bütçe yansıması ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.8. Kütüphane, Okuma Analitiği & Alıntılar (`/library`)
**Kapsam:** `src/app/library/page.tsx`, `src/app/api/library/**` (`analytics`, `bookmarks`, `quotes`, `scan-isbn`, `scan-page`, `sessions`, `upload-cover`), 409 mükerrer kalkanı, canlı okuma kronometresi, yer imleri, alıntılar ve Goodreads CSV içe aktarımı.
```text
!denetle kütüphane
```
*(Açık metin şablonu:)*
```text
Kütüphane (/library) modülünü ve src/app/api/library/** (analytics, bookmarks ve quotes dahil) uçlarını denetle. 409 mükerrer kitap kalkanı, Vercel serverless uyumlu ISBN/kapak işlemleri, WPM/okuma analitiği/kronometre, yer imi ve Goodreads içe aktarım akışları ile yetki izolasyonu ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.9. Notlar & İkinci Beyin (`/notes`) — YENİ
**Kapsam:** `src/app/notes/page.tsx`, `src/components/notes/NotesClient.tsx`, `src/app/api/notes/route.ts`, `src/lib/notes-utils.ts`, klasörler, etiketler, güvenli Markdown önizleme, sabitleme/arşiv ve kitap/görev/birikim bağlantıları.
```text
!denetle notlar
```
*(Açık metin şablonu:)*
```text
Notlar & İkinci Beyin (/notes) modülünü, NotesClient, src/lib/notes-utils.ts ve src/app/api/notes/route.ts ucunu denetle. Yetki/aile mahremiyet izolasyonu, Markdown güvenli ayrıştırma (XSS koruması), klasör/etiket/bağlantılı kayıt akışları ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.10. Sağlık, Beslenme, Oruç & Antrenman (`/health`)
**Kapsam:** `src/app/health/page.tsx`, `src/app/api/health/**` (öğün/makro, diyet, oruç, su senkronu, antrenman, hazır rutinler `workout-routines`, PR rekorları, Strava), çoklu üye (`member_id`) BOLA kapsamı.
```text
!denetle sağlık
```
*(Açık metin şablonu:)*
```text
Sağlık (/health) modülünü ve src/app/api/health/** (workout-routines dahil) uçlarını denetle. Çoklu aile üyesi (member_id) ve bireysel mahremiyet izolasyonu, AI besin/antrenman çıktılarında kullanıcı onay adımı, kalori/makro ve PR hesapları ile masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.11. Wellness, Takviyeler, Akıllı Tartı & Boost (`/wellness` ve `/boost`)
**Kapsam:** `src/app/wellness/page.tsx`, `src/app/boost/page.tsx`, `src/app/api/wellness/**`, `SmartScaleTrendDashboard.tsx` (BIA LBM & tekil/çoklu/radar/matris grafikler, tartı kaydı silme), `DailyTrackerCalendarBar`, uyku/ruh hali/su/takviye günlükleri ve çoklu üye BOLA kapsamı.
```text
!denetle wellness
```
*(Açık metin şablonu:)*
```text
Wellness (/wellness ve /boost) modülünü, DailyTrackerCalendarBar, SmartScaleTrendDashboard ve src/app/api/wellness/** uçlarını denetle. Çoklu üye (member_id) BOLA izolasyonu, sıfır mock fallback kuralı, 0-stok ve daily-only kuralları, akıllı tartı/uyku/mod/takviye kayıt ve silme akışı ile masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.12. Alışkanlıklar & Rutinler (`/habits`) — YENİ
**Kapsam:** `src/app/habits/page.tsx`, `src/components/habits/HabitsClient.tsx`, `src/app/api/habits/route.ts`, `src/lib/habits-engine.ts`, seri/esnek haftalık kota hesabı, 16 haftalık matris, rozetler ve EventBus otomatik tamamlama köprüleri (`reading`, `workout`, `water`).
```text
!denetle alışkanlık
```
*(Açık metin şablonu:)*
```text
Alışkanlıklar (/habits) modülünü, HabitsClient, src/lib/habits-engine.ts ve src/app/api/habits/route.ts ucunu denetle. Bireysel mahremiyet izolasyonu, Europe/Istanbul gün/seri ve esnek haftalık kota matematiği, EventBus otomatik tamamlama tetiklemeleri ile masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.13. Dijital Kasa, Önemli Tarihler & Evcil Hayvan (`/vault`)
**Kapsam:** `src/app/vault/page.tsx`, `src/app/api/digital-vault/**`, belge/dosya saklama, önemli günler ve evcil hayvan kayıtları.
```text
!denetle kasa
```
*(Açık metin şablonu:)*
```text
Dijital Kasa (/vault) modülünü ve src/app/api/digital-vault/** uçlarını denetle. Dosya yükleme/indirme yetki ve MIME kontrolleri, aile/özel mahremiyet ayrımı ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.14. Alışveriş Listesi (`/shopping`)
**Kapsam:** `src/app/shopping/page.tsx`, `src/app/api/shopping-list/**`, ortak alışveriş listesi, hızlı reyon çipleri, fiş tarama ve cüzdana aktarım.
```text
!denetle alışveriş
```
*(Açık metin şablonu:)*
```text
Alışveriş (/shopping) modülünü ve src/app/api/shopping-list/** uçlarını denetle. Aile paylaşım izolasyonu, cüzdana/bütçeye aktarım doğruluğu, fiş taramada AI onay adımı ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.15. Ayarlar, Aile Yönetimi, Yedekleme, Arama & Telegram (`/settings`)
**Kapsam:** `src/app/settings/page.tsx`, `src/app/api/family-members/**`, `src/app/api/family-invites/**`, `src/app/api/backup/**`, `src/app/api/telegram/**`, `src/app/api/search/route.ts`, `src/app/api/auth/update-security/**`, `src/lib/backup-tables.ts`.
```text
!denetle ayarlar
```
*(Açık metin şablonu:)*
```text
Ayarlar (/settings) modülünü, aile yönetimi, davet, yedekleme (src/lib/backup-tables.ts yeni tabloları dahil), analitik TÜFE tercihi, /api/search, güvenlik güncelleme ve Telegram webhook uçlarını denetle. Yetki/mahremiyet izolasyonu, şifreli .enc yedek kapsamı ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

### 3.16. Giriş, Kayıt, Kilit & Karşılama (`/auth/login`, `/auth/register`, `/welcome`)
**Kapsam:** `src/app/auth/**`, `src/app/welcome/page.tsx`, `src/app/api/auth/**`, `src/middleware.ts` (`/calendar`, `/habits`, `/notes`, `/okr`, `/boost` dahil korumalı yollar, `reset-user-data` & `delete-account`).
```text
Kimlik doğrulama ve karşılama sayfalarını (/auth/login, /auth/register, /welcome) ile src/app/api/auth/** ve src/middleware.ts akışını denetle. Tüm yeni modül rotalarının (/calendar, /habits, /notes, /okr, /boost) oturum korumasını, PIN kilidini, aile izole kategori başlangıcını, hesap sıfırlama/silme güvenliğini ve masaüstü/mobil canlı görünümü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

---

## Bölüm 4 — Tüm Açılır Pencereler (66 Modal, Çekmece & Pop-up) İçin Ayrı Kopyala-Yapıştır Promptlar

Her pencere için yalnızca o modalı veya çekmeceyi (dosyası, bağlı API uçları, form doğrulaması, state sıfırlama, masaüstü ve mobil görünümü) denetleyen hazır promptlar:

---

### 4.1. Ortak Kabuk / Tüm Sayfalardan Açılan Pencereler (`SharedLayout.tsx` + `NotificationHub.tsx` — 12 Adet)

#### 1. `CommandPaletteModal` — Küresel Komut & Arama Paleti (`Ctrl+K`) — YENİ
**Konum:** `src/components/modals/CommandPaletteModal.tsx` (Bağlı API: `/api/search`)
```text
CommandPaletteModal bileşenini (src/components/modals/CommandPaletteModal.tsx) ve /api/search ucunu denetle. Ctrl+K / Cmd+K kısayolunu, klavye ok/Enter/Esc gezinimini, Türkçe karakter duyarsız aramayı, yetki/aile mahremiyet izolasyonunu (not/görev/takvim/okr/finans) ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 2. `LockScreenModal` — Hızlı PIN Kilit Ekranı
**Konum:** `src/components/auth/LockScreenModal.tsx`
```text
LockScreenModal bileşenini (src/components/auth/LockScreenModal.tsx) ve /api/auth/unlock akışını denetle. Kilit aktifken arka plan verisinin sızmamasını, hatalı/doğru PIN yönetimini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 3. `OnboardingModal` — İlk Kurulum / Hoş Geldin Penceresi
**Konum:** `src/components/auth/OnboardingModal.tsx`
```text
OnboardingModal bileşenini (src/components/auth/OnboardingModal.tsx) denetle. Açılış/kapanış koşullarını, adım geçişlerini, taşma veya tıklanamayan buton olup olmadığını masaüstü ve mobil boyutta kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 4. `FeatureShowcaseModal` — Özellik Vitrini Penceresi
**Konum:** `src/components/modals/FeatureShowcaseModal.tsx`
```text
FeatureShowcaseModal bileşenini (src/components/modals/FeatureShowcaseModal.tsx) denetle. Modal içeriğinin güncel modüllerle tutarlılığını, açılış/kapanış akışını ve masaüstü/mobil kaydırma/taşma durumunu kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 5. `ReceiptScanModal` — Fiş & Fatura Tarama Penceresi (AI Vision)
**Konum:** `src/components/modals/ReceiptScanModal.tsx` (Ortak kabuk + `/budget`)
```text
ReceiptScanModal bileşenini (src/components/modals/ReceiptScanModal.tsx) ve /api/scan-receipt akışını denetle. AI çıktısının mutlaka kullanıcı onay/düzenleme adımından geçmesini, hata durumunda sahte veri üretilmemesini, form sıfırlanmasını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 6. `ManualExpenseModal` — Manuel Gelir / Gider & Hızlı Metin Ayrıştırıcı Penceresi
**Konum:** `src/components/modals/ManualExpenseModal.tsx` (Ortak kabuk + `/budget`, `src/lib/finance-quick-parser.ts`)
```text
ManualExpenseModal bileşenini (src/components/modals/ManualExpenseModal.tsx) ve hızlı metin ayrıştırıcıyı (src/lib/finance-quick-parser.ts) denetle. Tutar, taksit, hesap/kategori seçimi, hızlı metinden doldurma, aile paylaşım durumu, state temizliği ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 7. `VoiceCommandModal` — Sesli Çoklu Komut Penceresi
**Konum:** `src/components/modals/VoiceCommandModal.tsx`
```text
VoiceCommandModal bileşenini (src/components/modals/VoiceCommandModal.tsx) ve /api/voice-command akışını denetle. Sesli/metin komut çıktısının kullanıcı onayı olmadan veritabanına yazılmamasını, mikrofon/hata durumlarını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 8. `BarcodeScanModal` — Paketli Gıda / Barkod Tarama Penceresi
**Konum:** `src/components/modals/BarcodeScanModal.tsx` (Ortak kabuk + `/health`)
```text
BarcodeScanModal bileşenini (src/components/modals/BarcodeScanModal.tsx) ve bağlı lookup/onay akışını denetle. Barkod tarama sonucu onaylanmadan kayıt atılmamasını, seçili member_id uyumunu, kamera kapanış/temizliğini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 9. `PlateScanModal` — Yemek Tabağı Fotoğraf Analizi Penceresi (AI Vision)
**Konum:** `src/components/modals/PlateScanModal.tsx` (Ortak kabuk + `/health`)
```text
PlateScanModal bileşenini (src/components/modals/PlateScanModal.tsx) ve /api/health/scan-food akışını denetle. AI tahminlerinin kullanıcı porsiyon/içerik düzenleme onayından geçmeden kaydedilmemesini, hata durumlarını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 10. `AddTaskModal` — Görev Ekleme / Düzenleme Penceresi
**Konum:** `src/components/modals/AddTaskModal.tsx` (Ortak kabuk + `/tasks`)
```text
AddTaskModal bileşenini (src/components/modals/AddTaskModal.tsx) denetle. Ekleme/düzenleme state senkronizasyonu, alt görevler, MIT sınırı, pasif üye gösterimi, Europe/Istanbul tarih alanı ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 11. `NotificationHub` — Bildirim Merkezi Açılır Penceresi — YENİ
**Konum:** `src/components/layout/NotificationHub.tsx` (`/api/notifications`)
```text
NotificationHub bileşenini (src/components/layout/NotificationHub.tsx) ve /api/notifications akışını denetle. Açılır pencerenin masaüstü ve 390px mobilde ekrandan taşmamasını, okundu/önem sıralamasını, sayfa geçişlerinde kapanmasını ve yetki izolasyonunu kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 12. `SharedLayout` Hızlı İşlem Çekmecesi & Mobil Yan Menü — YENİ
**Konum:** `src/components/layout/SharedLayout.tsx`
```text
SharedLayout.tsx içindeki Hızlı İşlem Çekmecesi (FAB bottom-sheet) ve Mobil Yan Çekmece Menüsünü denetle. Açılış/kapanış (Esc, dışarı tıklama, sayfa geçişi), scroll kilidi temizliği, tüm yeni modül linklerinin (/calendar, /okr, /habits, /notes dahil) varlığını ve 390px mobil uyumluluğunu kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

---

### 4.2. Bütçe, Hesaplar, Borçlar & Birikim Hedefleri Modalları (`/budget` — 15 Modal)

#### 13. `CategoryDetailModal` — Kategori Detay, İşlem & Fiş Lightbox Penceresi
**Konum:** `src/components/modals/CategoryDetailModal.tsx`
```text
CategoryDetailModal bileşenini (src/components/modals/CategoryDetailModal.tsx) ve /api/budget/category-details akışını denetle. Limit/harcama hesapları, işlem düzenleme/silme, fiş tam ekran lightbox önizleme ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 14. `CreditCardStatementModal` — Kredi Kartı Ekstre, Kesim & Ödeme Penceresi
**Konum:** `src/components/modals/CreditCardStatementModal.tsx`
```text
CreditCardStatementModal bileşenini (src/components/modals/CreditCardStatementModal.tsx) ve /api/budget/card-statement akışını denetle. Kesilmiş ekstre borcu ile kesim sonrası açık dönem harcaması ayrımını, asgari ödeme/faiz simülasyonunu, ödeme akışını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 15. `LoanAmortizationModal` — Kredi İtfa Planı & Erken Kapama Simülatörü Modalı — YENİ
**Konum:** `src/components/modals/LoanAmortizationModal.tsx` (`src/lib/debt-simulators.ts`)
```text
LoanAmortizationModal bileşenini (src/components/modals/LoanAmortizationModal.tsx) ve src/lib/debt-simulators.ts hesaplamalarını denetle. Tüketici/konut vergi katsayısı (KKDF/BSMV), taksit tablosu ve erken kapama tasarrufu matematiğini, Esc ile kapanmayı ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 16. `BankCsvImportModal` — Banka Ekstresi CSV İçe Aktarım Modalı — YENİ
**Konum:** `src/components/modals/BankCsvImportModal.tsx` (`src/lib/bank-csv-parser.ts`)
```text
BankCsvImportModal bileşenini (src/components/modals/BankCsvImportModal.tsx) ve src/lib/bank-csv-parser.ts ayrıştırıcısını denetle. CSV satırlarının mutlaka kullanıcı önizleme/seçim onayından sonra /api/transactions ucuna yazılmasını, mükerrer kayıt korumasını, cüzdan/kategori eşleşmesini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 17. `ReconcileModal` — Hesap Bakiye Eşitleme (Mutabakat) Penceresi
**Konum:** `src/components/modals/ReconcileModal.tsx`
```text
ReconcileModal bileşenini (src/components/modals/ReconcileModal.tsx) ve /api/budget/reconcile akışını denetle. Gerçek bakiye ile sistem bakiyesi fark hesaplamasını, negatif/sıfır durumlarını, yetki kontrolünü ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 18. `TimeDepositCloseModal` — Vadeli Mevduat Kapatma Penceresi
**Konum:** `src/components/modals/TimeDepositCloseModal.tsx`
```text
TimeDepositCloseModal bileşenini (src/components/modals/TimeDepositCloseModal.tsx) ve /api/budget/time-deposit akışını denetle. Anapara/faiz/stopaj matematiğini, hedef hesaba aktarım doğruluğunu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 19. `TransferModal` — Hesaplar Arası Transfer / Kart Ödeme Penceresi
**Konum:** `src/components/modals/TransferModal.tsx`
```text
TransferModal bileşenini (src/components/modals/TransferModal.tsx) ve /api/budget/transfer akışını denetle. Aynı hesaba transfer engeli, farklı para birimi/kur çevrimi, bakiye yeterliliği ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 20. `AccountsCard` — Hesap / Kredi / KMH Ekleme & Düzenleme Modalı — YENİ
**Konum:** `src/components/budget/AccountsCard.tsx` (`/api/budget/accounts`)
```text
AccountsCard içindeki Hesap/Kredi Ekleme ve Düzenleme modalını (src/components/budget/AccountsCard.tsx) ve /api/budget/accounts ucunu denetle. Banka, KMH/Ek Hesap, Kredi Kartı, Kredi ve Vadeli Mevduat alanlarının doğrulanmasını, aile/özel paylaşım yetkisini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 21. `BudgetLimitsCard` — Kategori & Bütçe Limitlerini Yönet Modalı — YENİ
**Konum:** `src/components/budget/BudgetLimitsCard.tsx` (`/api/budget/categories`)
```text
BudgetLimitsCard içindeki Kategori & Bütçe Limitlerini Yönet modalını (src/components/budget/BudgetLimitsCard.tsx) ve /api/budget/categories ucunu denetle. Maksimum bütçe tavan sınırını, aileye özel kategori izolasyonunu, sıfır/negatif limit korumasını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 22. `RecurringBillsCard` — Fatura / Abonelik Ekleme & Düzenleme Modalı — YENİ
**Konum:** `src/components/budget/RecurringBillsCard.tsx` (`/api/budget/recurring-bills`)
```text
RecurringBillsCard içindeki Fatura/Abonelik Ekleme ve Düzenleme modalını (src/components/budget/RecurringBillsCard.tsx) ve /api/budget/recurring-bills ucunu denetle. Sabit/değişken tutar seçimini, ödeme günü/periyot hesaplarını, aile paylaşım kontrolünü ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 23. `RecurringBillsCard` — Fatura Ödemesi Onay Modalı — YENİ
**Konum:** `src/components/budget/RecurringBillsCard.tsx` (`/api/budget/recurring-bills`)
```text
RecurringBillsCard içindeki Fatura Ödemesi Onay modalını (src/components/budget/RecurringBillsCard.tsx) denetle. Çift ödeme (mükerrer mark_paid) korumasını, değişken tutar güncellemesini, seçili hesaptan bakiye düşümünü ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 24. `PersonalDebtsCard` — Şahıs Borç / Alacak Ekleme Modalı — YENİ
**Konum:** `src/components/budget/PersonalDebtsCard.tsx` (`/api/budget/personal-debts`)
```text
PersonalDebtsCard içindeki Borç/Alacak Kaydı Ekleme modalını (src/components/budget/PersonalDebtsCard.tsx) ve /api/budget/personal-debts ucunu denetle. TRY/Altın/USD/EUR endeksli giriş doğrulamasını, TRY cüzdan bağlantı şartını, yetki izolasyonunu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 25. `PersonalDebtsCard` — Şahıs Borç Ödeme / Alacak Tahsilat Modalı — YENİ
**Konum:** `src/components/budget/PersonalDebtsCard.tsx` (`/api/budget/personal-debts`)
```text
PersonalDebtsCard içindeki Borç Öde / Alacak Tahsil Et modalını (src/components/budget/PersonalDebtsCard.tsx) denetle. Kısmi veya tam ödeme matematiğini, tutar aşımı korumasını, bağlı cüzdan bakiyesi güncellemesini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 26. `SavingsGoalsCard` — Yeni Birikim Hedefi Oluşturma Modalı — YENİ
**Konum:** `src/components/budget/SavingsGoalsCard.tsx` (`/api/budget/sinking-funds`)
```text
SavingsGoalsCard içindeki Yeni Birikim Hedefi modalını (src/components/budget/SavingsGoalsCard.tsx) ve /api/budget/sinking-funds ucunu denetle. Hedef/başlangıç tutarı doğrulamasını, aile paylaşım seçeneğini, state sıfırlanmasını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 27. `SavingsGoalsCard` — Birikim Hedefine Para / Katkı Ekleme Modalı — YENİ
**Konum:** `src/components/budget/SavingsGoalsCard.tsx` (`/api/budget/sinking-funds`)
```text
SavingsGoalsCard içindeki Para Ekle / Katkı modalını (src/components/budget/SavingsGoalsCard.tsx) ve /api/budget/sinking-funds (contribute) akışını denetle. Cüzdan bağlantılı/bağlantısız katkı ve geri çekme matematiğini, bakiye/yetki kontrollerini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

---

### 4.3. Zaman Bloklama & OKR Vizyon Modalları (`/calendar` ve `/okr` — 5 Modal/Çekmece)

#### 28. `CalendarClient` — Zaman Bloğu Ekleme / Düzenleme Modalı — YENİ
**Konum:** `src/components/calendar/CalendarClient.tsx` (`/api/time-blocks`)
```text
CalendarClient içindeki Zaman Bloğu Ekle/Düzenle modalını (src/components/calendar/CalendarClient.tsx) ve /api/time-blocks ucunu denetle. Başlangıç/bitiş saat doğrulamasını, çakışma uyarısını, kategori seçimini, düzenlemede state eşitlemesini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 29. `CalendarClient` — Planlanmamış Görev/Kitap/Alışkanlık Çekmecesi — YENİ
**Konum:** `src/components/calendar/CalendarClient.tsx`
```text
CalendarClient içindeki Planlanmamış Öğeler Çekmecesini (Unscheduled Drawer — tasks/books/habits sekmeleri) denetle. Görev, kitap ve alışkanlıkların tek tıkla zaman bloğuna dönüştürülmesini, kapanış/açılış akışını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 30. `OkrClient` — Yeni Stratejik Hedef (Objective) / Düzenleme Modalı — YENİ
**Konum:** `src/components/okr/OkrClient.tsx` (`/api/okr`)
```text
OkrClient içindeki Hedef (Objective) Oluştur/Düzenle modalını (src/components/okr/OkrClient.tsx) ve /api/okr ucunu denetle. Yaşam sütunu/dönem seçimini, aile paylaşım izolasyonunu, düzenleme state eşitlemesini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 31. `OkrClient` — Yeni Anahtar Sonuç (Key Result) Modalı — YENİ
**Konum:** `src/components/okr/OkrClient.tsx` (`/api/okr`)
```text
OkrClient içindeki Yeni Anahtar Sonuç (Key Result) modalını (src/components/okr/OkrClient.tsx) denetle. Modüllerden hızlı doldurma (kitap, birikim, antrenman, görev, alışkanlık canlı metrikleri) akışını, başlangıç/hedef değer doğrulamasını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 32. `OkrClient` — İlerleme Check-in Modalı — YENİ
**Konum:** `src/components/okr/OkrClient.tsx` (`/api/okr`)
```text
OkrClient içindeki İlerleme Check-in modalını (src/components/okr/OkrClient.tsx) denetle. Yeni değer, güven durumu (confidence) ve not kaydının KR/Objective ilerleme yüzdesini doğru güncellemesini, yetki kontrolünü ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

---

### 4.4. Araç & Ev Operasyonları Modalları (`/vehicles` — 6 Modal)

#### 33. `AddVehicleModal` — Araç Ekleme / Düzenleme Penceresi
**Konum:** `src/components/modals/AddVehicleModal.tsx`
```text
AddVehicleModal bileşenini (src/components/modals/AddVehicleModal.tsx) ve /api/vehicles akışını denetle. Plaka/KM/yasal tarih giriş doğrulamasını, düzenleme state senkronunu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 34. `AddVehicleServiceModal` — Araç Bakım / Servis Ekleme Penceresi
**Konum:** `src/components/modals/AddVehicleServiceModal.tsx`
```text
AddVehicleServiceModal bileşenini (src/components/modals/AddVehicleServiceModal.tsx) ve /api/vehicles/maintenance akışını denetle. KM güncelleme, taksitli/hesaplı bütçe yansıması, EventBus tetiklemesi ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 35. `AddFuelLogModal` — Yakıt Fişi / Alım Kaydı Penceresi
**Konum:** `src/components/modals/AddFuelLogModal.tsx`
```text
AddFuelLogModal bileşenini (src/components/modals/AddFuelLogModal.tsx) denetle. Litre/tutar/KM hesaplamalarını, varsa bütçe yansımasını, form doğrulamasını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 36. `EditVehicleLegalModal` — Muayene / Sigorta / Kasko / MTV Düzenleme Penceresi
**Konum:** `src/components/modals/EditVehicleLegalModal.tsx`
```text
EditVehicleLegalModal bileşenini (src/components/modals/EditVehicleLegalModal.tsx) denetle. Muayene, sigorta, kasko ve MTV tarihlerinin güncellenmesi, modal state eşitlemesi ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 37. `MaintenanceHistoryModal` — Araç Bakım Geçmişi Penceresi
**Konum:** `src/components/vehicle/MaintenanceHistoryModal.tsx`
```text
MaintenanceHistoryModal bileşenini (src/components/vehicle/MaintenanceHistoryModal.tsx) denetle. Araç bakım geçmişinin doğru listelenmesini, silme/güncelleme tutarlılığını ve masaüstü/mobil kaydırma/taşma durumunu kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 38. `AddHomeItemModal` — Ev Bakım / Demirbaş & Fatura Penceresi
**Konum:** `src/components/modals/AddHomeItemModal.tsx` (`/vehicles` ve `/`)
```text
AddHomeItemModal bileşenini (src/components/modals/AddHomeItemModal.tsx) ve /api/home-operations akışını denetle. Fatura OCR onay adımı, ev bakım/cihaz kaydı, bütçe yansıması ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

---

### 4.5. Kütüphane & Okuma Modalları (`/library` — 7 Modal/Çekmece)

#### 39. `AddBookModal` — Kitap Ekleme & ISBN Arama Penceresi
**Konum:** `src/components/modals/AddBookModal.tsx`
```text
AddBookModal bileşenini (src/components/modals/AddBookModal.tsx) ve /api/library ile /api/library/scan-isbn akışlarını denetle. 409 mükerrer kitap uyarısı ("Mevcut Kitabı Aç/Güncelle" vs "2. Kopya Olarak Ekle" allowDuplicate akışı), Vercel uyumluluğu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 40. `BookDetailModal` — Kitap Detay, Düzenleme, Ödünç & Yer İmleri Penceresi
**Konum:** `src/components/modals/BookDetailModal.tsx` (`/api/library/bookmarks` dahil)
```text
BookDetailModal bileşenini (src/components/modals/BookDetailModal.tsx) ve /api/library/bookmarks akışını denetle. Kitap değiştirildiğinde form state eşitlemesi, yer imi ekleme/silme, kapak yükleme, ödünç/silme akışları ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 41. `ReadingSessionModal` — Okuma Oturumu & Canlı Kronometre Penceresi
**Konum:** `src/components/modals/ReadingSessionModal.tsx` (`/library` ve `/`)
```text
ReadingSessionModal bileşenini (src/components/modals/ReadingSessionModal.tsx) ve /api/library/sessions ile /api/library/scan-page akışlarını denetle. Canlı okuma kronometresi (timer), WPM/sayfa/yüzde ilerleme hesabı, AI sayfa tarama onayı, EventBus/alışkanlık köprüsü ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 42. `QuotesDrawer` — Alıntı & Yansıma Notları Çekmecesi — YENİ
**Konum:** `src/components/library/QuotesDrawer.tsx` (`/api/library/quotes`)
```text
QuotesDrawer bileşenini (src/components/library/QuotesDrawer.tsx) ve /api/library/quotes ucunu denetle. Alıntı ekleme, arama, silme onayı, Esc/dış tıklama ile kapanma, yetki izolasyonu ve masaüstü yan çekmece / mobil bottom-sheet görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 43. `GoodreadsImportModal` — Goodreads CSV Kitap İçe Aktarım Penceresi — YENİ
**Konum:** `src/components/modals/GoodreadsImportModal.tsx` (`/api/library` `import_goodreads_batch`)
```text
GoodreadsImportModal bileşenini (src/components/modals/GoodreadsImportModal.tsx) ve /api/library (import_goodreads_batch) akışını denetle. CSV ayrıştırma doğruluğunu, mükerrer kitap tespitini, kullanıcı seçim onayı olmadan kayıt atılmamasını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 44. `LiveBarcodeScannerModal` — Canlı Kamera Barkod Okuyucu Penceresi
**Konum:** `src/components/modals/LiveBarcodeScannerModal.tsx`
```text
LiveBarcodeScannerModal bileşenini (src/components/modals/LiveBarcodeScannerModal.tsx) denetle. Kamera akışının açılış/kapanışta temizlenmesi, manuel/kamera hata fallback'i ve mobil PWA görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 45. `PageCalibrationModal` — Sayfa Kelime Sayısı Kalibrasyon Penceresi
**Konum:** `src/components/modals/PageCalibrationModal.tsx`
```text
PageCalibrationModal bileşenini (src/components/modals/PageCalibrationModal.tsx) denetle. Sayfa başına kelime hesabı, sıfır/geçersiz değer koruması ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

---

### 4.6. Sağlık & Beslenme Modalları (`/health` — 6 Modal)

#### 46. `AddMealModal` — Öğün Ekleme Penceresi
**Konum:** `src/components/modals/AddMealModal.tsx`
```text
AddMealModal bileşenini (src/components/modals/AddMealModal.tsx) ve /api/health/nutrition akışını denetle. Besin arama, porsiyon/makro ölçekleme, EventBus bildirimi ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 47. `DietPlanModal` — Diyet Planı & Öğün Seçenekleri Penceresi
**Konum:** `src/components/modals/DietPlanModal.tsx`
```text
DietPlanModal bileşenini (src/components/modals/DietPlanModal.tsx) ve /api/health/diet ile /api/health/diet/parse-text akışlarını denetle. 0 makro değerlerinin korunması, ekleme/düzenleme/silme butonları ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 48. `EditHealthProfileModal` — Sağlık & Kalori Hedefi Profili Penceresi
**Konum:** `src/components/modals/EditHealthProfileModal.tsx`
```text
EditHealthProfileModal bileşenini (src/components/modals/EditHealthProfileModal.tsx) denetle. Kalori/makro ve su hedeflerinin kaydedilmesi, geçersiz sayı koruması, member_id BOLA izolasyonu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 49. `FastingHistoryModal` — Aralıklı Oruç Geçmişi Penceresi
**Konum:** `src/components/health/FastingHistoryModal.tsx`
```text
FastingHistoryModal bileşenini (src/components/health/FastingHistoryModal.tsx) ve /api/health/fasting/history akışını denetle. Oruç süre/sınır (1-168 sa) hesapları, member_id izolasyonu, geçmiş kayıt ekleme/düzenleme/silme ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 50. `HomeWorkoutModal` — Antrenman, Hazır Rutinler & PR Kaydı Penceresi
**Konum:** `src/components/modals/HomeWorkoutModal.tsx` (`/api/health/workouts`, `/api/health/workouts/ocr` ve `/api/health/workout-routines`)
```text
HomeWorkoutModal bileşenini (src/components/modals/HomeWorkoutModal.tsx) ve /api/health/workouts, /api/health/workouts/ocr ile /api/health/workout-routines akışlarını denetle. Hazır rutin şablonu seçimi/kaydı, PR kişisel rekor hesabı, egzersiz OCR onay adımı, member_id izolasyonu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 51. `NutrientProfileModal` — Besin İçeriği / Katkı Karnesi Penceresi
**Konum:** `src/components/modals/NutrientProfileModal.tsx`
```text
NutrientProfileModal bileşenini (src/components/modals/NutrientProfileModal.tsx) ve /api/health/nutrition-profile akışını denetle. Gramaj (1-5000g) ölçekleme, eksik veri durumları ve masaüstü/mobil kaydırma/taşma kontrolünü yap. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

---

### 4.7. Wellness, Boost & Alışkanlıklar Modalları (`/wellness`, `/boost`, `/habits` — 6 Modal)

#### 52. `AddSupplementModal` — Takviye / Vitamin Rutini Penceresi
**Konum:** `src/components/modals/AddSupplementModal.tsx`
```text
AddSupplementModal bileşenini (src/components/modals/AddSupplementModal.tsx) ve /api/wellness akışını denetle. 0 stok koruması, as_needed/daily geçişinde zamanlama korunumu, doz/rutin kaydı, member_id izolasyonu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 53. `SmartScaleScanModal` — Akıllı Tartı Ekranı Tarama Penceresi (AI Vision)
**Konum:** `src/components/modals/SmartScaleScanModal.tsx`
```text
SmartScaleScanModal bileşenini (src/components/modals/SmartScaleScanModal.tsx) ve /api/wellness/scan-scale ile /api/wellness/scale-logs akışlarını denetle. AI tartı okuma çıktısının kullanıcı onayından geçmeden kaydedilmemesini, measurement_datetime / tarih korunumunu, modal sıfırlanmasını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 54. `WellnessCard` — Uyku Süresi & Kalitesi Güncelleme Modalı — YENİ
**Konum:** `src/components/health/WellnessCard.tsx` (`/api/wellness` `add_sleep`)
```text
WellnessCard içindeki Uyku Güncelleme modalını (src/components/health/WellnessCard.tsx) ve /api/wellness (add_sleep) akışını denetle. HH:MM yatış/uyanma saati ve 1-5 kalite doğrulamasını, seçili tarih/member_id uyumunu, Kaydet/İptal buton hizalamasını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 55. `WellnessCard` — Mod, Enerji & Stres Güncelleme Modalı — YENİ
**Konum:** `src/components/health/WellnessCard.tsx` (`/api/wellness` `add_mood`)
```text
WellnessCard içindeki Mod, Enerji & Stres Güncelleme modalını (src/components/health/WellnessCard.tsx) ve /api/wellness (add_mood) akışını denetle. 1-5 puan sınırlarını, seçili tarih/member_id kapsamını, kayıt sonrası özet kartı yenilenmesini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 56. `HabitsClient` — Yeni Alışkanlık Oluşturma Modalı — YENİ
**Konum:** `src/components/habits/HabitsClient.tsx` (`/api/habits`)
```text
HabitsClient içindeki Yeni Alışkanlık Oluştur modalını (src/components/habits/HabitsClient.tsx) ve /api/habits ucunu denetle. Evet/Hayır, sayısal sayaç ve süre hedefi tiplerini, esnek haftalık kota/belirli gün kurallarını, EventBus köprüsü seçimini (reading/workout/water) ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 57. `HabitsClient` — 16 Haftalık Alışkanlık Matris & Seri Detay Modalı — YENİ
**Konum:** `src/components/habits/HabitsClient.tsx`
```text
HabitsClient içindeki 16 Haftalık (112 Gün) Matris Detay modalını (src/components/habits/HabitsClient.tsx) denetle. Güncel/en uzun seri ve 30g tutarlılık yüzdesinin doğruluğunu, 112 günlük ızgaranın mobilde yatay kaydırmalı olarak taşmamasını ve kapatma akışını kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

---

### 4.8. Dijital Kasa Modülü Modalları (`/vault` — 3 Modal)

#### 58. `AddVaultItemModal` — Dijital Kasa Belge / Kayıt Penceresi
**Konum:** `src/components/modals/AddVaultItemModal.tsx`
```text
AddVaultItemModal bileşenini (src/components/modals/AddVaultItemModal.tsx) ve /api/digital-vault ile /api/digital-vault/scan-document ve upload akışlarını denetle. Düzenlemede mevcut dosyanın korunması, AI tarama onayı, MIME/yetki güvenliği ve masaüstü/mobil modal-xl görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 59. `AddImportantDateModal` — Önemli Tarih / Hatırlatma Penceresi
**Konum:** `src/components/modals/AddImportantDateModal.tsx`
```text
AddImportantDateModal bileşenini (src/components/modals/AddImportantDateModal.tsx) denetle. Düzenleme modunda form state eşitlemesi, tarih/tekrar doğrulaması, aile paylaşımı ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 60. `AddPetModal` — Evcil Hayvan & Aşı/Bakım Kaydı Penceresi
**Konum:** `src/components/modals/AddPetModal.tsx`
```text
AddPetModal bileşenini (src/components/modals/AddPetModal.tsx) denetle. Düzenleme modunda form state eşitlemesi, doğum/aşı tarihleri, aile paylaşımı ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

---

### 4.9. Alışveriş Listesi Modülü Modalları (`/shopping` — 2 Modal)

#### 61. `AddShoppingItemModal` — Alışveriş Ürünü Ekleme Penceresi
**Konum:** `src/components/modals/AddShoppingItemModal.tsx`
```text
AddShoppingItemModal bileşenini (src/components/modals/AddShoppingItemModal.tsx) ve /api/shopping-list akışını denetle. Miktar/kategori/öncelik girişleri, aile izolasyonu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 62. `CheckoutToWalletModal` — Alışverişi Cüzdana / Bütçeye Aktarma Penceresi
**Konum:** `src/components/modals/CheckoutToWalletModal.tsx`
```text
CheckoutToWalletModal bileşenini (src/components/modals/CheckoutToWalletModal.tsx) denetle. Seçili kalemlerin toplam tutar hesabı, hesap/kategori seçimi, çift aktarım koruması ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

---

### 4.10. Ayarlar, Aile, Yedekleme & Güvenlik Modalları (`/settings` — 4 Modal)

#### 63. `FamilyMembersCard` — Aile Üyesi Ekleme / Düzenleme Modalı — YENİ
**Konum:** `src/components/settings/FamilyMembersCard.tsx` (`/api/family-members`)
```text
FamilyMembersCard içindeki Aile Üyesi Ekleme/Düzenleme modalını (src/components/settings/FamilyMembersCard.tsx) ve /api/family-members ucunu denetle. Yetki kontrolünü (admin/sahip izolasyonu), davet kodu üretimini, pasif/aktif durum yönetimini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 64. `BackupStatusCard` — AES-256 Şifreli Yedek Parolası Modalı — YENİ
**Konum:** `src/components/settings/BackupStatusCard.tsx` (`/api/backup`, `src/lib/backup-tables.ts`)
```text
BackupStatusCard içindeki AES-256 Şifreli Yedek Parolası modalını (src/components/settings/BackupStatusCard.tsx) ve /api/backup (src/lib/backup-tables.ts dahil) akışını denetle. En az 8 karakter parola kuralını, şifreli .enc indirmenin tüm güncel tabloları ve aile mahremiyetini kapsamasını kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 65. `BackupStatusCard` — Veritabanı Geri Yükleme Onay Modalı — YENİ
**Konum:** `src/components/settings/BackupStatusCard.tsx` (`/api/backup`)
```text
BackupStatusCard içindeki Veritabanı Geri Yükleme Onay modalını (src/components/settings/BackupStatusCard.tsx) ve /api/backup restore akışını denetle. Tablo/kayıt önizleme sayımlarını, yanlış/bozuk dosyaya karşı koruma ve kullanıcı onay adımını, kullanıcı izolasyonunu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```

#### 66. `SecuritySettingsCard` — Hesabı Kalıcı Silme Onay Modalı — YENİ
**Konum:** `src/components/settings/SecuritySettingsCard.tsx` (`/api/auth/delete-account`)
```text
SecuritySettingsCard içindeki Hesabı Kalıcı Silme Onay modalını (src/components/settings/SecuritySettingsCard.tsx) ve /api/auth/delete-account ucunu denetle. Master parola doğrulamasını, silme sonrası tüm yeni tablolar (habits, notes, timeBlocks, okrObjectives vb.) ile yalnızca kullanıcıya/aileye ait ayarların eksiksiz temizlenmesini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 10 salt-okunur opsiyonel not yaz (sayıyı doldurmak için zorlama madde uydurma; 1 tane bile gerekli görmezsen hiç yazma). Commit/push yapma.
```
