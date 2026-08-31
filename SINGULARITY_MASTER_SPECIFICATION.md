# 🌌 SINGULARITY LIFE OS — KAPSAMLI SİSTEM & MİMARİ MASTER RAPORU
> **Doküman Türü:** Master Sistem Mimarisi, Veritabanı Şeması, API Kataloğu & Taşınabilirlik (Porting) Rehberi  
> **Versiyon:** v3.0 Production Ready  
> **Tarih:** 31 Ağustos 2026  
> **Hedef:** Sistemin başka bir platformda (Flutter, React Native, Go/FastAPI/NestJS, Swift/Kotlin vb.) sıfırdan yeniden üretilmesi veya taşınması için eksiksiz teknik kılavuz.

---

## 1. 🎯 SİSTEM VİZYONU & TEMEL FELSEFE

**Singularity**, dağınık halde kullanılan kişisel ve ailevi yaşam yönetim araçlarını (ev bütçesi, portföy, araç bakımı, kütüphane/okuma takibi, aralıklı oruç/sağlık, evrak kasası ve alışveriş listesi) tek bir merkezi, yüksek performanslı ve gizlilik odaklı mimaride birleştiren bir **Yaşam İşletim Sistemidir (Life OS)**.

### Temel Prensipler:
1. **Low-Friction (Düşük Efor / Kolay Veri Girişi):** Form doldurma zorluğunu ortadan kaldırmak için Görsel Yapay Zekâ (Vision AI OCR), canlı kamera barkod tarama ve tek dokunuşlu interaktif widget'lar kullanılır.
2. **Çapraz Modül Sinerjisi (Dual-Ledger):** Bir yakıt fişi veya araç bakım faturası işlendiğinde, sistem bunu tek seferde hem **Araç Servis Defterine** hem de **Ev Bütçesi & Kredi Kartı Taksitlerine** aynı anda yazar.
3. **Çok Kullanıcılı Aile & Hane Modeli (Multi-Tenant Household):** Tek bir hesap yerine aynı hanedeki bireyler (Eş, Çocuk, vb.) ortak aile bütçesini, market listesini ve araçları paylaşırken, kişisel sağlık, oruç ve kitaplıklarını izole yönetebilirler.
4. **Platform Bağımsızlığı & Self-Hosting:** Veriler standart PostgreSQL veritabanında tutulur; ister evdeki bir yerel sunucuda (Docker/Windows/Linux), ister bulutta (Supabase, AWS, Cloudflare) 0 maliyetle çalıştırılabilir.

---

## 2. 🏗️ TEKNOLOJİ YIĞINI (TECH STACK)

| Katman | Mevcut Teknoloji | Alternatif Platform Karşılığı |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 15 (App Router, React 19) | Flutter / React Native / Swift (iOS) / Jetpack Compose |
| **Programlama Dili** | TypeScript (Strict Mode) | Dart / Go / Python / Kotlin / Swift |
| **Stil & Tema Motoru** | Tailwind CSS + CSS Variables (Dark Matrix) | Flutter ThemeData / React Native StyleSheet |
| **Veritabanı (RDBMS)** | PostgreSQL 15+ (Supabase / Local PG) | PostgreSQL / SQLite (Offline Client) |
| **ORM / Veri Katmanı** | Drizzle ORM | Prisma / Drift (Flutter) / SQLAlchemy / GORM |
| **Kamera & Barkod** | WebRTC `getUserMedia` + `@zxing/library` | `camera` + `mobile_scanner` (Flutter) / AVFoundation |
| **Yapay Zekâ (AI Engine)** | Google Gemini (Vision & Grounding API) | OpenAI GPT-4o Vision / Anthropic Claude / Ollama |
| **Kimlik Doğrulama** | PBKDF2-SHA256 + 6 Haneli Quick PIN | JWT + Argon2 / Biometric (FaceID / TouchID) |
| **Dağıtım / Hosting** | Vercel Serverless + Ev Wi-Fi Yerel Sunucu | Docker Compose / Kubernetes / Fly.io / Bare-metal |

---

## 3. 🔐 GÜVENLİK & KİMLİK DOĞRULAMA MİMARİSİ

```
[ İstemci Giriş Talebi ]
       │
       ├──> 1. Master Parola Girişi (E-posta veya Kullanıcı Adı + Parola)
       │      └── PBKDF2-SHA256 (100.000 iterasyon + 16 byte salt) ──> Doğrulama
       │
       └──> 2. Hızlı PIN Girişi (6 Haneli Kilit Açma)
              └── PBKDF2-SHA256 (50.000 iterasyon + 'pin_salt_' + salt) ──> Doğrulama
       │
[ Başarılı Doğrulama ] ──> 32-Byte Kriptografik Rastgele Session Token
       │
       └──> HTTP-Only, Strict, Secure Cookie ('singularity_session')
            └── 'auth_sessions' tablosunda 30 günlük oturum kaydı
```

---

## 4. 🗄️ EKSİKSİZ VERİTABANI ŞEMASI (28 TABLO)

Tüm tablolar PostgreSQL uyumludur. Başka bir dilde veya ORM'de birebir oluşturulabilir.

### 4.1. Kimlik, Kullanıcı & Aile Yönetimi

```sql
-- 1. Aileler / Haneler
CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Kullanıcılar & Giriş Kimlikleri
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  quick_pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', -- 'admin' | 'spouse' | 'member'
  relationship_type TEXT DEFAULT 'leader',
  avatar_emoji TEXT DEFAULT '👤',
  is_master_account INTEGER NOT NULL DEFAULT 1,
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. Oturumlar (Session Cache)
CREATE TABLE auth_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  device_name TEXT DEFAULT 'web-client',
  created_at TEXT NOT NULL
);

-- 4. Aile Üyeleri (İlişkisel Profil)
CREATE TABLE family_members (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id),
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  relationship_type TEXT DEFAULT 'member',
  avatar TEXT DEFAULT '👤',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  device_id TEXT DEFAULT 'web-client'
);

-- 5. Aile Davet Kodları
CREATE TABLE family_invites (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id),
  invite_code TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL,
  family_role TEXT NOT NULL DEFAULT 'member',
  relationship_type TEXT DEFAULT 'spouse',
  target_name TEXT,
  expires_at TEXT NOT NULL,
  is_used INTEGER NOT NULL DEFAULT 0,
  used_by_user_id TEXT,
  created_at TEXT NOT NULL
);
```

---

### 4.2. Bütçe & Finansal Yönetim

```sql
-- 6. Varlık Merkezleri & Hesaplar (Banka, Kredi Kartı, Nakit, Kredi)
CREATE TABLE wallets_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'bank' | 'credit_card' | 'cash' | 'loan' | 'investment' | 'time_deposit'
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  credit_limit DOUBLE PRECISION DEFAULT 0,
  cutoff_day INTEGER, -- Kredi kartı hesap kesim günü (1-31)
  due_day INTEGER,    -- Kredi kartı son ödeme günü (1-31)
  loan_original_amount DOUBLE PRECISION DEFAULT 0,
  loan_total_repayment DOUBLE PRECISION DEFAULT 0,
  monthly_installment_amount DOUBLE PRECISION DEFAULT 0,
  total_installments INTEGER DEFAULT 1,
  first_installment_date TEXT,
  deposited_account_id TEXT,
  currency TEXT NOT NULL DEFAULT 'TRY',
  color TEXT DEFAULT '#111827',
  is_family_shared INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  maturity_date TEXT,
  interest_rate DOUBLE PRECISION,
  interest_type TEXT,
  interest_rate_contractual DOUBLE PRECISION DEFAULT 4.25,
  interest_rate_late DOUBLE PRECISION DEFAULT 4.55,
  min_payment_percent DOUBLE PRECISION DEFAULT 20,
  overdraft_limit DOUBLE PRECISION DEFAULT 0,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 7. Gelir & Gider Kategorileri
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'income' | 'expense'
  monthly_budget_limit DOUBLE PRECISION DEFAULT 0,
  group_50_30_20 TEXT DEFAULT 'needs', -- 'needs' | 'wants' | 'savings'
  icon TEXT DEFAULT '🏷️',
  color TEXT DEFAULT '#10B981',
  is_family_shared INTEGER NOT NULL DEFAULT 1,
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 8. Gelir, Gider & Taksitli İşlemler
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets_accounts(id),
  category_id TEXT REFERENCES categories(id),
  member_id TEXT REFERENCES family_members(id),
  merchant TEXT DEFAULT 'Diğer',
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  transaction_date TEXT NOT NULL,
  notes TEXT,
  is_installment INTEGER NOT NULL DEFAULT 0,
  installment_number INTEGER DEFAULT 1,
  total_installments INTEGER DEFAULT 1,
  parent_transaction_id TEXT,
  receipt_image_url TEXT,
  is_verified INTEGER NOT NULL DEFAULT 1,
  is_family_shared INTEGER NOT NULL DEFAULT 1,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 9. Hedef Fonları & Kumbaralar
CREATE TABLE sinking_funds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_amount DOUBLE PRECISION NOT NULL,
  current_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  target_date TEXT,
  icon TEXT DEFAULT '🎯',
  is_family_shared INTEGER NOT NULL DEFAULT 1,
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 10. Kişisel Borç & Alacak Defteri
CREATE TABLE personal_debts_receivables (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'debt' (Borcum) | 'receivable' (Alacağım)
  person_name TEXT NOT NULL,
  description TEXT,
  index_type TEXT NOT NULL DEFAULT 'TRY', -- 'TRY' | 'USD' | 'EUR' | 'GOLD_GR'
  index_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  interest_rate DOUBLE PRECISION DEFAULT 0,
  interest_period TEXT DEFAULT 'yearly',
  due_date TEXT,
  connected_wallet_id TEXT REFERENCES wallets_accounts(id),
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'paid' | 'cancelled'
  paid_amount DOUBLE PRECISION DEFAULT 0,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 11. Periyodik Fatura & Abonelik Takvimi
CREATE TABLE recurring_bills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'utility', -- 'utility' | 'subscription' | 'tax' | 'other'
  billing_day INTEGER, -- Tebliğ/Kesim Günü (1-31)
  due_day INTEGER NOT NULL, -- Son Ödeme Günü (1-31)
  period TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' | 'yearly' | 'quarterly'
  due_month INTEGER, -- Yıllık ödemeler için ay (1-12)
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  amount_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed' | 'variable'
  is_auto_pay INTEGER DEFAULT 0,
  auto_pay_wallet_id TEXT REFERENCES wallets_accounts(id),
  category_id TEXT REFERENCES categories(id),
  last_paid_month TEXT, -- 'YYYY-MM'
  last_paid_date TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'cancelled'
  notes TEXT,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

### 4.3. Araç, Garaj & Mülk Yönetimi

```sql
-- 12. Araçlar (Filo)
CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  plate TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  current_km DOUBLE PRECISION NOT NULL DEFAULT 0,
  fuel_type TEXT NOT NULL DEFAULT 'Benzin',
  color TEXT DEFAULT '#3B82F6',
  is_family_shared INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 13. Araç Bakım & Servis Kayıtları
CREATE TABLE vehicle_maintenance_records (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'periyodik_bakim',
  km_at_service DOUBLE PRECISION NOT NULL,
  service_date TEXT NOT NULL,
  next_service_km DOUBLE PRECISION,
  next_service_date TEXT,
  description TEXT NOT NULL,
  cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  service_provider TEXT DEFAULT 'Özel Servis',
  receipt_image_url TEXT,
  is_family_shared INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 14. Akaryakıt Tüketim Günlüğü
CREATE TABLE vehicle_fuel_logs (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  km DOUBLE PRECISION NOT NULL,
  fuel_station TEXT NOT NULL DEFAULT 'Opet',
  liters DOUBLE PRECISION NOT NULL,
  price_per_liter DOUBLE PRECISION NOT NULL,
  total_amount DOUBLE PRECISION NOT NULL,
  fuel_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 15. Yasal Araç Hatırlatıcıları (Muayene, Sigorta, Kasko, MTV)
CREATE TABLE vehicle_legal_reminders (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'muayene' | 'sigorta' | 'kasko' | 'mtv_1' | 'mtv_2' | 'egzoz'
  due_date TEXT NOT NULL,
  policy_no TEXT,
  cost_estimate DOUBLE PRECISION DEFAULT 0,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 16. Ev & Tesisat Bakım Takvimi (Kombi, Su Arıtma, Filtreler)
CREATE TABLE home_maintenance_records (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL, -- 'kombi' | 'su_aritma' | 'klima' | 'dask'
  title TEXT NOT NULL,
  last_serviced_date TEXT NOT NULL,
  next_due_date TEXT NOT NULL,
  interval_months INTEGER NOT NULL DEFAULT 6,
  cost_estimate DOUBLE PRECISION DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 17. Ev Demirbaş & Garanti Arşivi
CREATE TABLE home_appliances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  purchase_date TEXT,
  warranty_months INTEGER DEFAULT 24,
  warranty_expiry_date TEXT,
  service_phone TEXT,
  receipt_url TEXT,
  notes TEXT,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

### 4.4. Akıllı Kütüphane & İkinci Beyin

```sql
-- 18. Kitaplar
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  translator TEXT,
  publisher TEXT,
  total_pages INTEGER NOT NULL DEFAULT 0,
  current_page INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'reading', -- 'reading' | 'completed' | 'wishlist' | 'paused'
  format TEXT NOT NULL DEFAULT 'physical', -- 'physical' | 'ebook' | 'audiobook'
  shelf_location TEXT DEFAULT 'Salon Kitaplığı',
  words_per_page INTEGER DEFAULT 250,
  is_lent_out INTEGER NOT NULL DEFAULT 0,
  lent_to_name TEXT,
  lent_date TEXT,
  cover_url TEXT,
  isbn TEXT,
  summary TEXT,
  rating INTEGER DEFAULT 5,
  category TEXT DEFAULT 'Kişisel Gelişim',
  start_date TEXT,
  finish_date TEXT,
  purchased_date TEXT,
  purchased_from TEXT,
  purchase_price DOUBLE PRECISION,
  notes TEXT,
  is_family_shared INTEGER NOT NULL DEFAULT 1,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 19. Okuma Seansları & Hız Metrikleri
CREATE TABLE reading_sessions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  pages_read INTEGER NOT NULL,
  duration_minutes DOUBLE PRECISION NOT NULL,
  session_date TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 20. Kitap Alıntıları & Dijital Notlar (OCR Highlight)
CREATE TABLE book_quotes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_number INTEGER,
  quote_text TEXT NOT NULL,
  reflection_note TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 21. Okuyucu Hız & Kalibrasyon Profili
CREATE TABLE user_reading_profile (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES family_members(id),
  yearly_target_books INTEGER NOT NULL DEFAULT 24,
  calibrated_avg_wpm DOUBLE PRECISION NOT NULL DEFAULT 220,
  avg_seconds_per_page DOUBLE PRECISION NOT NULL DEFAULT 84,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

### 4.5. Sağlık, Biyometri, Oruç & Rutinler

```sql
-- 22. Kullanıcı Sağlık & Hedef Profili
CREATE TABLE user_health_profile (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES family_members(id),
  daily_calorie_target DOUBLE PRECISION NOT NULL DEFAULT 2200,
  target_protein_g DOUBLE PRECISION NOT NULL DEFAULT 140,
  target_carbs_g DOUBLE PRECISION NOT NULL DEFAULT 180,
  target_fat_g DOUBLE PRECISION NOT NULL DEFAULT 65,
  daily_water_target_ml DOUBLE PRECISION NOT NULL DEFAULT 2500,
  consumed_water_ml DOUBLE PRECISION NOT NULL DEFAULT 1250,
  active_fasting_protocol TEXT NOT NULL DEFAULT '16:8',
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 23. Aralıklı Oruç Seansları (Intermittent Fasting)
CREATE TABLE fasting_sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES family_members(id),
  protocol TEXT NOT NULL DEFAULT '16:8', -- '16:8' | '18:6' | '20:4' | 'OMAD' | 'custom'
  start_time TEXT NOT NULL,
  target_end_time TEXT NOT NULL,
  actual_end_time TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 24. Su Tüketim Günlüğü
CREATE TABLE water_intake_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  member_id TEXT REFERENCES family_members(id),
  date TEXT NOT NULL,
  amount_ml INTEGER NOT NULL DEFAULT 0,
  goal_ml INTEGER NOT NULL DEFAULT 2500,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 25. Günlük Takviye & İlaç Rutinleri
CREATE TABLE supplement_routines (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES family_members(id),
  name TEXT NOT NULL,
  dose TEXT NOT NULL,
  timing TEXT NOT NULL, -- 'sabah' | 'ogle' | 'aksam' | 'yatmadan'
  frequency_type TEXT NOT NULL DEFAULT 'daily',
  interval_days INTEGER NOT NULL DEFAULT 1,
  is_taken_today INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  remaining_pills INTEGER,
  total_pills INTEGER,
  last_taken_date TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 26. Biyometri & Akıllı Tartı Kayıtları
CREATE TABLE smart_scale_logs (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES family_members(id),
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  measurement_date TEXT NOT NULL,
  weight_kg DOUBLE PRECISION NOT NULL,
  bmi DOUBLE PRECISION,
  body_fat_percent DOUBLE PRECISION,
  skeletal_muscle_percent DOUBLE PRECISION,
  water_percent DOUBLE PRECISION,
  visceral_fat_rating DOUBLE PRECISION,
  bone_mass_kg DOUBLE PRECISION,
  bmr_calories DOUBLE PRECISION,
  metabolic_age DOUBLE PRECISION,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

### 4.6. Alışveriş Listesi, Evrak Kasası & Bildirimler

```sql
-- 27. Akıllı Aile Alışveriş Listesi
CREATE TABLE shopping_list_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  quantity TEXT NOT NULL DEFAULT '1',
  unit TEXT DEFAULT 'adet',
  category TEXT DEFAULT 'Market', -- 'Market' | 'Manav' | 'Kasap' | 'Eczane' | 'Ev'
  is_checked INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'manual', -- 'manual' | 'recipe' | 'low_stock' | 'voice'
  source_ref TEXT,
  estimated_price DOUBLE PRECISION DEFAULT 0,
  notes TEXT,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 28. Dijital Kasa (Pasaport, Poliçe, Sözleşmeler)
CREATE TABLE digital_vault_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- 'passport' | 'id_card' | 'insurance' | 'contract' | 'license'
  owner TEXT DEFAULT 'Kullanıcı',
  issuer TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  remind_days_before INTEGER DEFAULT 30,
  document_number TEXT,
  document_image_url TEXT,
  notes TEXT,
  is_family_shared INTEGER NOT NULL DEFAULT 0,
  user_id TEXT REFERENCES users(id),
  family_id TEXT REFERENCES families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 5. 🧠 TEMEL İŞ MANTIĞI & HESAPLAMA MOTORLARI

### 5.1. Periyodik Fatura Zamanlama Motoru (`bill-schedule.ts`)
* **Tebliğ Günü (`billing_day`):** Faturanın kesildiği ve ödeme penceresinin açıldığı gün.
* **Vade Günü (`due_day`):** Son ödeme günü.
* **Durum Algoritması:**
  * Eğer `last_paid_month === currentMonth` ➔ `status = 'paid'`
  * Eğer `today > due_day` ➔ `status = 'overdue'` (Gecikmiş Fatura)
  * Eğer `today >= billing_day` ➔ `status = 'window_open'` (Ödeme Penceresi Açık)
  * Eğer `today < billing_day` ➔ `status = 'upcoming'` (Beklemede)

### 5.2. 4 Aşamalı Hibrit ISBN Arama & Künye Ayrıştırma Motoru
Kitap barkodu tarandığında veya ISBN girildiğinde sırayla şu mekanizma çalışır:
```
[ ISBN Girildi: Örn. 9786257615839 ]
              │
              ├──> 1. Aşama: Google Books API Sorgusu
              │      └── Başarılıysa (Kapak URL, Sayfa Sayısı, Başlık)
              │
              ├──> 2. Aşama: Open Library API Sorgusu (Yedek)
              │
              ├──> 3. Aşama: Türkçe Kitap Ağı & Kitabevi Scraping (Örn: D&R, Kitapyurdu, Amazon TR)
              │      └── Türkiye'ye özel ISBN'ler için başlık, yazar ve yayınevi tespiti
              │
              └──> 4. Aşama: Gemini AI Canlı Grounding & Künye Analizi
                     └── Zengin Türkçe özet (2-3 cümle) ve doğru edebi kategori sınıflandırması
              │
[ Akıllı Birleştirme (Smart Fusion) ] ──> Eksiksiz Kitap Kartı
```

### 5.3. Okuma Hızı & Sayfa Başına Süre Kalibrasyonu
$$\text{Okunan Kelime Sayısı} = \text{Sayfa Sayısı} \times \text{Sayfa Başı Ortalama Kelime} (N_{\text{kelime}})$$
$$\text{Okuma Hızı (WPM)} = \frac{\text{Toplam Okunan Kelime}}{\text{Süre (Dakika)}}$$
$$\text{Kalan Süre (ETA)} = \frac{(\text{Toplam Sayfa} - \text{Mevcut Sayfa}) \times N_{\text{kelime}}}{\text{WPM}}$$

### 5.4. Aralıklı Oruç (Intermittent Fasting) Motoru
* Seçilen protokole göre (16:8 = 16 saat oruç / 8 saat yeme penceresi) hedef bitiş zamanı otomatik hesaplanır:
$$\text{Target End Time} = \text{Start Time} + 16 \text{ hours}$$
* Oruç safhaları (Kan Şekeri Düşüşü 0-4s, Glikojen Tükenmesi 4-8s, Yağ Yakımı 8-12s, Ketozis 12-16s, Otofaji 16s+) canlı ilerleme çubuğuyla izlenir.

---

## 6. 🔌 RESTFUL API KATALOĞU (50+ UÇ NOKTA)

| Modül | Metod | Endpoint | Açıklama |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/register` | Yeni hane lideri kaydı (PBKDF2 hash) |
| **Auth** | `POST` | `/api/auth/login` | E-posta/Kullanıcı Adı + Parola veya PIN ile giriş |
| **Auth** | `GET` | `/api/auth/session` | Aktif oturum ve yetki durumu kontrolü |
| **Auth** | `POST` | `/api/auth/logout` | Oturum tokenini silme ve çıkış yapma |
| **Dashboard**| `GET` | `/api/dashboard/composite` | Ana sayfa için tüm modül verilerinin paralel özeti |
| **Bütçe** | `GET, POST` | `/api/budget` | Varlık hesapları, işlemler ve bütçe özeti |
| **Bütçe** | `POST` | `/api/budget/transfer` | Hesaplar arası virman / para transferi |
| **Bütçe** | `POST` | `/api/budget/recurring-bills` | Periyodik fatura oluşturma / ödeme kaydı |
| **Bütçe** | `POST` | `/api/budget/personal-debts` | Borç / Alacak defteri kaydı ve tahsilat |
| **Bütçe** | `POST` | `/api/scan-receipt` | Fiş görselinden AI Vision ile tutar ve kalem okuma |
| **Araç** | `GET, POST` | `/api/vehicles` | Araç ekleme ve filo listesi |
| **Araç** | `POST` | `/api/vehicles/maintenance` | Servis/bakım ve yakıt fişi ekleme (Dual-ledger) |
| **Kütüphane** | `GET, POST` | `/api/library` | Kitaplık listesi ve yeni kitap kaydı |
| **Kütüphane** | `POST` | `/api/library/scan-isbn` | Canlı barkod / ISBN sorgulama motoru |
| **Kütüphane** | `POST` | `/api/library/sessions` | Okuma seansı kaydı ve WPM hesaplama |
| **Kütüphane** | `POST` | `/api/library/quotes` | Alıntı kaydı (Fotoğraftan OCR ile metin çıkarma) |
| **Sağlık** | `GET, POST` | `/api/health/fasting` | Oruç başlatma, durdurma ve geçmişi |
| **Sağlık** | `POST` | `/api/health/water` | Hızlı su ekleme (+250ml, +500ml) |
| **Sağlık** | `GET, POST` | `/api/wellness` | Takviye rutinleri checklist'i ve durum güncelleme |
| **Market** | `GET, POST` | `/api/shopping-list` | Aile ortak alışveriş listesi ve tamamlandı işaretleme |
| **Evrak** | `GET, POST` | `/api/digital-vault` | Pasaport, ehliyet ve garanti belgeleri kasası |
| **Sesli Asistan**| `POST` | `/api/voice-command` | Ses kaydından eylem çıkarma (NLP ayrıştırma) |

---

## 7. 🚀 BAŞKA PLATFORMA TAŞIMA (MIGRATION GUIDE)

Eğer bu sistemi **Flutter (Mobil)** veya **Go / Python / Node.js (Backend)** mimarisine taşımak isterseniz:

1. **Veritabanı Katmanı:** Bölüm 4'teki SQL DDL scriptlerini doğrudan hedef PostgreSQL veritabanında çalıştırın.
2. **Kimlik Doğrulama:** Hedef dilde standart `crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')` fonksiyonunu kullanarak mevcut kullanıcı şifreleriyle %100 uyumluluk sağlayabilirsiniz.
3. **Kamera & Barkod:** 
   - **Flutter:** `mobile_scanner` veya `qr_code_scanner` paketini kullanın.
   - **React Native:** `react-native-vision-camera` + `vision-camera-code-scanner` kullanın.
4. **Çevre Değişkenleri (`.env`):**
   ```env
   DATABASE_URL="postgresql://postgres.[REF]:[PASS]@[HOST]:6543/postgres?pgbouncer=true"
   GEMINI_API_KEY="AIzaSy..."
   NEXT_PUBLIC_APP_URL="https://your-domain.com"
   ```
