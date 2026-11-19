# Singularity — Tüm Modüller, Modlar ve 38 Modal İçin Hazır Prompt Rehberi

Bu dosya, Singularity projesinde yapay zekâya **teknik detay ezberlemeden** tek tıkla kopyalayıp yapıştırabileceğin tüm komutları, modül denetim promptlarını ve sistemdeki **38 açılır pencerenin (modal)** her biri için ayrı hazır promptları içerir.

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
Son yaptığımız değişikliği kontrol et. Sadece çalışmayı bozan Kritik/Bloker hataları (güvenlik, veri kaybı, yanlış hesap, kırık akış, test/derleme hatası) düzelt ve en fazla 2 turda dur. Kritik hata kalmayınca "Sorun Yok" (PASS) yaz; istersen altına en fazla 3 maddelik salt-okunur opsiyonel öneri bırak ama onayım olmadan uygulama.
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

---

## Bölüm 3 — Tüm Modüller İçin Ayrı Kopyala-Yapıştır Promptlar (12 Modül)

### 3.1. Ana Sayfa / Günlük Özet (`/`)
**Kapsam:** `src/app/page.tsx`, günlük akış, takip banner'ları ve özet kartları.
```text
Ana Sayfa (/) modülünü ve bileşenlerini denetle. npm run verify çalıştır; yerel sunucuda / sayfasını masaüstü (~1280px) ve mobil (~390px) boyutta canlı açıp kart hizalarını, takip banner'larını ve konsol/API hatalarını kontrol et. Yalnızca Kritik/Bloker hataları düzelt (en fazla 2 tur), yoksa "Sorun Yok" (PASS) ve en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

### 3.2. Görevler & Odak (`/tasks`)
**Kapsam:** `src/app/tasks/page.tsx`, `src/app/api/tasks/route.ts`, `src/lib/tasks-engine.ts`, MIT kotası, alt görevler, tekrarlar, odak sayacı ve takvim.
```text
!denetle görevler
```
*(Kısa komut yerine açık metin kullanmak istersen:)*
```text
Görevler (/tasks) modülünü denetle. API yetki/aile izolasyonu, Europe/Istanbul tarih hesabı, alt görev/MIT/odak sayacı mantığı, aylık takvim ve canlı tarayıcı görünümünü (masaüstü + mobil) kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

### 3.3. Bütçe & Nakit Akışı (`/budget`)
**Kapsam:** `src/app/budget/page.tsx`, `src/app/api/budget/**`, `src/app/api/transactions/route.ts`, hesaplar, kart kesim tarihleri, borç/alacak ve sabit faturalar.
```text
!denetle bütçe
```
*(Açık metin şablonu:)*
```text
Bütçe (/budget) modülünü ve src/app/api/budget/** uçlarını denetle. Yetki/aile izolasyonu, bakiye/taksit/kredi kartı kesim matematiği ve canlı tarayıcı görünümünü (masaüstü + mobil) kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

### 3.4. Analitik, FIRE & Holistik Skor (`/analytics`)
**Kapsam:** `src/app/analytics/page.tsx`, `src/app/api/analytics/**`, 5x20 Holistik Skor ve yaşam takvimi ısı haritası.
```text
!denetle analitik
```
*(Açık metin şablonu:)*
```text
Analitik (/analytics) modülünü ve src/app/api/analytics/** uçlarını denetle. 5x20 Holistik Skor, FIRE ve ısı haritası hesaplamalarının doğruluğunu, yetki izolasyonunu ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

### 3.5. Araç & Ev Operasyonları (`/vehicles`)
**Kapsam:** `src/app/vehicles/page.tsx`, `src/app/api/vehicles/**`, `src/app/api/home-operations/**`, KM/bakım eşikleri, yasal tarihler ve bütçe bağlantıları.
```text
!denetle araç
```
*(Açık metin şablonu:)*
```text
Araç ve Ev Operasyonları (/vehicles) modülünü denetle. Yetki/aile izolasyonu, KM/tarih eşik hesapları, EventBus/bütçe yansıması ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

### 3.6. Kütüphane & Okuma (`/library`)
**Kapsam:** `src/app/library/page.tsx`, `src/app/api/library/**`, ISBN tarama, 409 mükerrer kalkanı, okuma oturumları ve alıntılar.
```text
!denetle kütüphane
```
*(Açık metin şablonu:)*
```text
Kütüphane (/library) modülünü denetle. 409 mükerrer kitap kalkanı, Vercel serverless uyumlu ISBN/kapak işlemleri, WPM/okuma hesapları, yetki izolasyonu ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

### 3.7. Sağlık, Beslenme, Oruç & Antrenman (`/health`)
**Kapsam:** `src/app/health/page.tsx`, `src/app/api/health/**`, öğün/makro takibi, aralıklı oruç, su ve antrenman/Strava.
```text
!denetle sağlık
```
*(Açık metin şablonu:)*
```text
Sağlık (/health) modülünü ve src/app/api/health/** uçlarını denetle. Bireysel mahremiyet izolasyonu, AI besin/antrenman çıktılarında kullanıcı onay adımı, kalori/makro hesapları ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

### 3.8. Wellness, Takviyeler & Boost (`/wellness` ve `/boost`)
**Kapsam:** `src/app/wellness/page.tsx`, `src/app/boost/page.tsx`, `src/app/api/wellness/**`, takviye rutinleri, uyku, ruh hali ve akıllı tartı.
```text
!denetle wellness
```
*(Açık metin şablonu:)*
```text
Wellness (/wellness ve /boost) modülünü ve src/app/api/wellness/** uçlarını denetle. Bireysel mahremiyet izolasyonu, akıllı tartı/takviye kayıt akışı ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

### 3.9. Dijital Kasa, Önemli Tarihler & Evcil Hayvan (`/vault`)
**Kapsam:** `src/app/vault/page.tsx`, `src/app/api/digital-vault/**`, belge/dosya saklama, önemli günler ve evcil hayvan kayıtları.
```text
!denetle kasa
```
*(Açık metin şablonu:)*
```text
Dijital Kasa (/vault) modülünü ve src/app/api/digital-vault/** uçlarını denetle. Dosya yükleme/indirme yetki ve MIME kontrolleri, aile/özel mahremiyet ayrımı ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

### 3.10. Alışveriş Listesi (`/shopping`)
**Kapsam:** `src/app/shopping/page.tsx`, `src/app/api/shopping-list/**`, ortak alışveriş listesi, fiş tarama ve cüzdana aktarım.
```text
!denetle alışveriş
```
*(Açık metin şablonu:)*
```text
Alışveriş (/shopping) modülünü ve src/app/api/shopping-list/** uçlarını denetle. Aile paylaşım izolasyonu, cüzdana/bütçeye aktarım doğruluğu, fiş taramada AI onay adımı ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

### 3.11. Ayarlar, Aile Yönetimi, Yedekleme & Telegram (`/settings`)
**Kapsam:** `src/app/settings/page.tsx`, `src/app/api/family-members/**`, `src/app/api/family-invites/**`, `src/app/api/backup/**`, `src/app/api/telegram/**`, `src/app/api/auth/update-security/**`.
```text
!denetle ayarlar
```
*(Açık metin şablonu:)*
```text
Ayarlar (/settings) modülünü ve aile yönetimi, davet, yedekleme, güvenlik güncelleme ile Telegram webhook uçlarını denetle. Yetki/mahremiyet izolasyonu, şifreli yedek kapsamı ve masaüstü/mobil canlı tarayıcı görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

### 3.12. Giriş, Kayıt, Kilit & Karşılama (`/auth/login`, `/auth/register`, `/welcome`)
**Kapsam:** `src/app/auth/**`, `src/app/welcome/page.tsx`, `src/app/api/auth/**`, `src/middleware.ts`.
```text
Kimlik doğrulama ve karşılama sayfalarını (/auth/login, /auth/register, /welcome) ile src/app/api/auth/** ve src/middleware.ts akışını denetle. Oturum, PIN kilidi, yetkisiz yönlendirme, hesap sıfırlama/silme güvenliği ve masaüstü/mobil canlı görünümü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hataları en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

---

## Bölüm 4 — Tüm Açılır Pencereler (38 Modal) İçin Ayrı Kopyala-Yapıştır Promptlar

Her modal için yalnızca o modalı (dosyası, bağlı API uçları, form doğrulaması, state sıfırlama, masaüstü ve mobil görünümü) denetleyen hazır promptlar:

---

### 4.1. Ortak Kabuk / Tüm Sayfalardan Açılan Modallar (`SharedLayout.tsx` — 9 Modal)

#### 1. `LockScreenModal` — Hızlı PIN Kilit Ekranı
**Konum:** `src/components/auth/LockScreenModal.tsx`
```text
LockScreenModal bileşenini (src/components/auth/LockScreenModal.tsx) ve /api/auth/unlock akışını denetle. Kilit aktifken arka plan verisinin sızmamasını, hatalı/doğru PIN yönetimini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 2. `OnboardingModal` — İlk Kurulum / Hoş Geldin Penceresi
**Konum:** `src/components/auth/OnboardingModal.tsx`
```text
OnboardingModal bileşenini (src/components/auth/OnboardingModal.tsx) denetle. Açılış/kapanış koşullarını, adım geçişlerini, taşma veya tıklanamayan buton olup olmadığını masaüstü ve mobil boyutta kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 3. `FeatureShowcaseModal` — Özellik Vitrini Penceresi
**Konum:** `src/components/modals/FeatureShowcaseModal.tsx`
```text
FeatureShowcaseModal bileşenini (src/components/modals/FeatureShowcaseModal.tsx) denetle. Modal içeriğinin güncel modüllerle tutarlılığını, açılış/kapanış akışını ve masaüstü/mobil kaydırma/taşma durumunu kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 4. `ReceiptScanModal` — Fiş & Fatura Tarama Penceresi (AI Vision)
**Konum:** `src/components/modals/ReceiptScanModal.tsx` (Ortak kabuk + `/budget`)
```text
ReceiptScanModal bileşenini (src/components/modals/ReceiptScanModal.tsx) ve /api/scan-receipt akışını denetle. AI çıktısının mutlaka kullanıcı onay/düzenleme adımından geçmesini, hata durumunda sahte veri üretilmemesini, form sıfırlanmasını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 5. `ManualExpenseModal` — Manuel Gelir / Gider Ekleme Penceresi
**Konum:** `src/components/modals/ManualExpenseModal.tsx` (Ortak kabuk + `/budget`)
```text
ManualExpenseModal bileşenini (src/components/modals/ManualExpenseModal.tsx) ve bağlı bütçe/işlem kaydı akışını denetle. Tutar, taksit, hesap/kategori seçimi, aile paylaşım durumu, state temizliği ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 6. `VoiceCommandModal` — Sesli Çoklu Komut Penceresi
**Konum:** `src/components/modals/VoiceCommandModal.tsx`
```text
VoiceCommandModal bileşenini (src/components/modals/VoiceCommandModal.tsx) ve /api/voice-command akışını denetle. Sesli/metin komut çıktısının kullanıcı onayı olmadan veritabanına yazılmamasını, mikrofon/hata durumlarını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 7. `BarcodeScanModal` — Paketli Gıda / Barkod Tarama Penceresi
**Konum:** `src/components/modals/BarcodeScanModal.tsx` (Ortak kabuk + `/health`)
```text
BarcodeScanModal bileşenini (src/components/modals/BarcodeScanModal.tsx) ve bağlı lookup/onay akışını denetle. Barkod tarama sonucu onaylanmadan kayıt atılmamasını, kamera kapanış/temizliğini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 8. `PlateScanModal` — Yemek Tabağı Fotoğraf Analizi Penceresi (AI Vision)
**Konum:** `src/components/modals/PlateScanModal.tsx` (Ortak kabuk + `/health`)
```text
PlateScanModal bileşenini (src/components/modals/PlateScanModal.tsx) ve /api/health/scan-food akışını denetle. AI tahminlerinin kullanıcı porsiyon/içerik düzenleme onayından geçmeden kaydedilmemesini, hata durumlarını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 9. `AddTaskModal` — Görev Ekleme / Düzenleme Penceresi
**Konum:** `src/components/modals/AddTaskModal.tsx` (Ortak kabuk + `/tasks`)
```text
AddTaskModal bileşenini (src/components/modals/AddTaskModal.tsx) denetle. Ekleme/düzenleme state senkronizasyonu, alt görevler, MIT sınırı, pasif üye gösterimi, Europe/Istanbul tarih alanı ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

---

### 4.2. Bütçe & Hesaplar Modülü Modalları (`/budget` — 5 Modal)

#### 10. `CategoryDetailModal` — Kategori Detay & İşlem Penceresi
**Konum:** `src/components/modals/CategoryDetailModal.tsx`
```text
CategoryDetailModal bileşenini (src/components/modals/CategoryDetailModal.tsx) ve /api/budget/category-details akışını denetle. Limit/harcama hesapları, işlem düzenleme/silme, fiş önizleme ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 11. `CreditCardStatementModal` — Kredi Kartı Ekstre & Kesim Penceresi
**Konum:** `src/components/modals/CreditCardStatementModal.tsx`
```text
CreditCardStatementModal bileşenini (src/components/modals/CreditCardStatementModal.tsx) ve /api/budget/card-statement akışını denetle. Kesilmiş ekstre borcu ile kesim sonrası açık dönem harcaması ayrımını, ödeme akışını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 12. `ReconcileModal` — Hesap Bakiye Eşitleme (Mutabakat) Penceresi
**Konum:** `src/components/modals/ReconcileModal.tsx`
```text
ReconcileModal bileşenini (src/components/modals/ReconcileModal.tsx) ve /api/budget/reconcile akışını denetle. Gerçek bakiye ile sistem bakiyesi fark hesaplamasını, negatif/sıfır durumlarını, yetki kontrolünü ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 13. `TimeDepositCloseModal` — Vadeli Mevduat Kapatma Penceresi
**Konum:** `src/components/modals/TimeDepositCloseModal.tsx`
```text
TimeDepositCloseModal bileşenini (src/components/modals/TimeDepositCloseModal.tsx) ve /api/budget/time-deposit akışını denetle. Anapara/faiz/stopaj matematiğini, hedef hesaba aktarım doğruluğunu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 14. `TransferModal` — Hesaplar Arası Transfer / Kart Ödeme Penceresi
**Konum:** `src/components/modals/TransferModal.tsx`
```text
TransferModal bileşenini (src/components/modals/TransferModal.tsx) ve /api/budget/transfer akışını denetle. Aynı hesaba transfer engeli, farklı para birimi/kur çevrimi, bakiye yeterliliği ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

---

### 4.3. Araç & Ev Operasyonları Modalları (`/vehicles` — 6 Modal)

#### 15. `AddVehicleModal` — Araç Ekleme / Düzenleme Penceresi
**Konum:** `src/components/modals/AddVehicleModal.tsx`
```text
AddVehicleModal bileşenini (src/components/modals/AddVehicleModal.tsx) ve /api/vehicles akışını denetle. Plaka/KM/yasal tarih giriş doğrulamasını, düzenleme state senkronunu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 16. `AddVehicleServiceModal` — Araç Bakım / Servis Ekleme Penceresi
**Konum:** `src/components/modals/AddVehicleServiceModal.tsx`
```text
AddVehicleServiceModal bileşenini (src/components/modals/AddVehicleServiceModal.tsx) ve /api/vehicles/maintenance akışını denetle. KM güncelleme, taksitli/hesaplı bütçe yansıması, EventBus tetiklemesi ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 17. `AddFuelLogModal` — Yakıt Fişi / Alım Kaydı Penceresi
**Konum:** `src/components/modals/AddFuelLogModal.tsx`
```text
AddFuelLogModal bileşenini (src/components/modals/AddFuelLogModal.tsx) denetle. Litre/tutar/KM hesaplamalarını, varsa bütçe yansımasını, form doğrulamasını ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 18. `EditVehicleLegalModal` — Muayene / Sigorta / Kasko / MTV Düzenleme Penceresi
**Konum:** `src/components/modals/EditVehicleLegalModal.tsx`
```text
EditVehicleLegalModal bileşenini (src/components/modals/EditVehicleLegalModal.tsx) denetle. Muayene, sigorta, kasko ve MTV tarihlerinin güncellenmesi, modal state eşitlemesi ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 19. `MaintenanceHistoryModal` — Araç Bakım Geçmişi Penceresi
**Konum:** `src/components/vehicle/MaintenanceHistoryModal.tsx`
```text
MaintenanceHistoryModal bileşenini (src/components/vehicle/MaintenanceHistoryModal.tsx) denetle. Araç bakım geçmişinin doğru listelenmesini, silme/güncelleme tutarlılığını ve masaüstü/mobil kaydırma/taşma durumunu kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 20. `AddHomeItemModal` — Ev Bakım / Demirbaş & Fatura Penceresi
**Konum:** `src/components/modals/AddHomeItemModal.tsx` (`/vehicles` ve `/`)
```text
AddHomeItemModal bileşenini (src/components/modals/AddHomeItemModal.tsx) ve /api/home-operations akışını denetle. Fatura OCR onay adımı, ev bakım/cihaz kaydı, bütçe yansıması ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

---

### 4.4. Kütüphane & Okuma Modalları (`/library` — 5 Modal)

#### 21. `AddBookModal` — Kitap Ekleme & ISBN Arama Penceresi
**Konum:** `src/components/modals/AddBookModal.tsx`
```text
AddBookModal bileşenini (src/components/modals/AddBookModal.tsx) ve /api/library ile /api/library/scan-isbn akışlarını denetle. 409 mükerrer kitap uyarısı ("Mevcut Kitabı Aç/Güncelle" vs "2. Kopya Olarak Ekle" allowDuplicate akışı), Vercel uyumluluğu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 22. `BookDetailModal` — Kitap Detay, Düzenleme & Ödünç Penceresi
**Konum:** `src/components/modals/BookDetailModal.tsx`
```text
BookDetailModal bileşenini (src/components/modals/BookDetailModal.tsx) denetle. Kitap değiştirildiğinde form state eşitlemesi, kapak yükleme, ödünç/silme akışları ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 23. `ReadingSessionModal` — Okuma Oturumu & Alıntı Kaydı Penceresi
**Konum:** `src/components/modals/ReadingSessionModal.tsx` (`/library` ve `/`)
```text
ReadingSessionModal bileşenini (src/components/modals/ReadingSessionModal.tsx) ve /api/library/sessions ile /api/library/scan-page akışlarını denetle. WPM/sayfa ilerleme hesabı, AI sayfa tarama onayı ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 24. `LiveBarcodeScannerModal` — Canlı Kamera Barkod Okuyucu Penceresi
**Konum:** `src/components/modals/LiveBarcodeScannerModal.tsx`
```text
LiveBarcodeScannerModal bileşenini (src/components/modals/LiveBarcodeScannerModal.tsx) denetle. Kamera akışının açılış/kapanışta temizlenmesi, manuel/kamera hata fallback'i ve mobil PWA görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 25. `PageCalibrationModal` — Sayfa Kelime Sayısı Kalibrasyon Penceresi
**Konum:** `src/components/modals/PageCalibrationModal.tsx`
```text
PageCalibrationModal bileşenini (src/components/modals/PageCalibrationModal.tsx) denetle. Sayfa başına kelime hesabı, sıfır/geçersiz değer koruması ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

---

### 4.5. Sağlık & Beslenme Modalları (`/health` — 6 Modal)

#### 26. `AddMealModal` — Öğün Ekleme Penceresi
**Konum:** `src/components/modals/AddMealModal.tsx`
```text
AddMealModal bileşenini (src/components/modals/AddMealModal.tsx) ve /api/health/nutrition akışını denetle. Besin arama, porsiyon/makro ölçekleme, EventBus bildirimi ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 27. `DietPlanModal` — Diyet Planı & Öğün Seçenekleri Penceresi
**Konum:** `src/components/modals/DietPlanModal.tsx`
```text
DietPlanModal bileşenini (src/components/modals/DietPlanModal.tsx) ve /api/health/diet ile /api/health/diet/parse-text akışlarını denetle. 0 makro değerlerinin korunması, ekleme/düzenleme/silme butonları ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 28. `EditHealthProfileModal` — Sağlık & Kalori Hedefi Profili Penceresi
**Konum:** `src/components/modals/EditHealthProfileModal.tsx`
```text
EditHealthProfileModal bileşenini (src/components/modals/EditHealthProfileModal.tsx) denetle. Kalori/makro hedeflerinin kaydedilmesi, geçersiz sayı koruması, bireysel izolasyon ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 29. `FastingHistoryModal` — Aralıklı Oruç Geçmişi Penceresi
**Konum:** `src/components/health/FastingHistoryModal.tsx`
```text
FastingHistoryModal bileşenini (src/components/health/FastingHistoryModal.tsx) ve /api/health/fasting/history akışını denetle. Oruç süre hesapları, geçmiş kayıt ekleme/düzenleme/silme ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 30. `HomeWorkoutModal` — Antrenman / Ev Egzersizi Kaydı Penceresi
**Konum:** `src/components/modals/HomeWorkoutModal.tsx`
```text
HomeWorkoutModal bileşenini (src/components/modals/HomeWorkoutModal.tsx) ve /api/health/workouts ile /api/health/workouts/ocr akışlarını denetle. Egzersiz OCR onay adımı, süre/mesafe hesapları ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 31. `NutrientProfileModal` — Besin İçeriği / Katkı Karnesi Penceresi
**Konum:** `src/components/modals/NutrientProfileModal.tsx`
```text
NutrientProfileModal bileşenini (src/components/modals/NutrientProfileModal.tsx) ve /api/health/nutrition-profile akışını denetle. Gramaj ölçekleme, eksik veri durumları ve masaüstü/mobil kaydırma/taşma kontrolünü yap. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

---

### 4.6. Wellness & Boost Modalları (`/wellness` ve `/boost` — 2 Modal)

#### 32. `AddSupplementModal` — Takviye / Vitamin Rutini Penceresi
**Konum:** `src/components/modals/AddSupplementModal.tsx`
```text
AddSupplementModal bileşenini (src/components/modals/AddSupplementModal.tsx) ve /api/wellness akışını denetle. Doz/zaman/rutin kaydı, bireysel izolasyon ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 33. `SmartScaleScanModal` — Akıllı Tartı Ekranı Tarama Penceresi (AI Vision)
**Konum:** `src/components/modals/SmartScaleScanModal.tsx`
```text
SmartScaleScanModal bileşenini (src/components/modals/SmartScaleScanModal.tsx) ve /api/wellness/scan-scale ile /api/wellness/scale-logs akışlarını denetle. AI tartı okuma çıktısının kullanıcı onayından geçmeden kaydedilmemesini ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

---

### 4.7. Dijital Kasa Modülü Modalları (`/vault` — 3 Modal)

#### 34. `AddVaultItemModal` — Dijital Kasa Belge / Kayıt Penceresi
**Konum:** `src/components/modals/AddVaultItemModal.tsx`
```text
AddVaultItemModal bileşenini (src/components/modals/AddVaultItemModal.tsx) ve /api/digital-vault ile /api/digital-vault/scan-document ve upload akışlarını denetle. Düzenlemede mevcut dosyanın korunması, AI tarama onayı, MIME/yetki güvenliği ve masaüstü/mobil modal-xl görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 35. `AddImportantDateModal` — Önemli Tarih / Hatırlatma Penceresi
**Konum:** `src/components/modals/AddImportantDateModal.tsx`
```text
AddImportantDateModal bileşenini (src/components/modals/AddImportantDateModal.tsx) denetle. Düzenleme modunda form state eşitlemesi, tarih/tekrar doğrulaması, aile paylaşımı ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 36. `AddPetModal` — Evcil Hayvan & Aşı/Bakım Kaydı Penceresi
**Konum:** `src/components/modals/AddPetModal.tsx`
```text
AddPetModal bileşenini (src/components/modals/AddPetModal.tsx) denetle. Düzenleme modunda form state eşitlemesi, doğum/aşı tarihleri, aile paylaşımı ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

---

### 4.8. Alışveriş Listesi Modülü Modalları (`/shopping` — 2 Modal)

#### 37. `AddShoppingItemModal` — Alışveriş Ürünü Ekleme Penceresi
**Konum:** `src/components/modals/AddShoppingItemModal.tsx`
```text
AddShoppingItemModal bileşenini (src/components/modals/AddShoppingItemModal.tsx) ve /api/shopping-list akışını denetle. Miktar/kategori/öncelik girişleri, aile izolasyonu ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```

#### 38. `CheckoutToWalletModal` — Alışverişi Cüzdana / Bütçeye Aktarma Penceresi
**Konum:** `src/components/modals/CheckoutToWalletModal.tsx`
```text
CheckoutToWalletModal bileşenini (src/components/modals/CheckoutToWalletModal.tsx) denetle. Seçili kalemlerin toplam tutar hesabı, hesap/kategori seçimi, çift aktarım koruması ve masaüstü/mobil görünümünü kontrol et. npm run verify geçir. Sadece Kritik/Bloker hata varsa en fazla 2 turda düzelt; yoksa "Sorun Yok" (PASS) + en fazla 3 salt-okunur opsiyonel not yaz. Commit/push yapma.
```
