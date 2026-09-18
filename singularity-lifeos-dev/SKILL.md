---
name: singularity-lifeos-dev
description: Guides architecture decisions, code reviews, and feature planning for "Singularity" — Uğur's personal/family Life OS project (budget, investments/net worth, vehicle & home operations, personal library, health/nutrition). Use this skill whenever the user mentions Singularity, Life OS, or references any of its modules (bütçe, yatırım/net worth, araç/ev, kütüphane, sağlık), asks to design, build, review, or audit a feature for this system, discusses live operations, bugfixes, event bus, dual-ledger ingestion, AI vision pipeline, or family privacy partitioning — even if they don't say "Singularity" by name but the request clearly matches one of these modules or architectural concerns. Always consult this skill before proposing new features or code for this project, so recommendations stay consistent with the current production architecture and live environment realities instead of re-litigating settled decisions.
---

# Singularity Life OS — Development Guide

A skill for keeping every conversation about the Singularity project consistent with its actual production architecture, technology stack, current operating state, and risk mitigations — instead of relying on outdated design drafts or re-deriving settled decisions.

## What this project is

Singularity is a unified personal and family "Life OS" bringing together multiple operational domains: **Bütçe** (budget/cash flow), **Yatırım** (investments/net worth), **Araç & Ev** (vehicle/home operations), **Kütüphane** (personal library), **Sağlık & Beslenme** (health/nutrition/wellness), **Dijital Kasa** (digital vault), **Alışveriş Listesi** ve **Bildirimler**.

Full historical reference is in `references/blueprint.md` (read it for domain business rules such as MTV schedules, TÜFE lease caps, or reading rate math).

### Core Stack & Live Production Setup
Core stack decisions already in production — do not propose alternatives unless explicitly requested:
- **Hosting:** Deployed live on **Vercel** (`https://singularity-life-os.vercel.app`), repository: `github.com/ugrongns/singularity-life-os` (branch: `main`).
- **Database & ORM:** **Supabase PostgreSQL** (Frankfurt / `eu-central-1`, Transaction Pooler port `6543`) with **Drizzle ORM**. (SQLite or local-only DB is no longer used).
- **Framework & UI:** Next.js (App Router, TypeScript), Tailwind CSS, Lucide Icons, Modern Dark Minimalist Dashboard.
- **Interface:** Mobile PWA with device camera + Responsive Web Dashboard. Telegram bot is a secondary/optional webhook channel.
- **Architecture:** Modular monolith.
- **Phase Status:** Proje artık fikir/taslak aşamasında değil; **canlı operasyon, stabilizasyon ve özellik iyileştirme** aşamasındadır. Tüm temel modüller oluşturulmuştur.

---

## Non-negotiable architectural principles & system realities

When proposing or reviewing code/features, evaluate against these strict guidelines:

1. **Online-first (Gerçek Durum: Sync aktif değil):**
   - Veritabanı şemasında `sync_status`, `device_id`, `sync_queue` tabloları/kolonları yer alsa da, arka planda bu kuyruğu okuyup senkronize eden hiçbir background job veya API bulunmamaktadır.
   - Sistem yerel-öncelikli (local-first) değil, **online-only** çalışmaktadır. Aile üyeleri sistemi canlı Vercel + Supabase altyapısı üzerinden doğrudan online olarak kullanır. Bu nedenle istemcide hayali bir "offline sync" mekanizmasına bel bağlanmamalı, veri bütünlüğü doğrudan Supabase işlemlerine göre tasarlanmalıdır.
2. **AI Vision output is never auto-committed:**
   - Fiş, fatura, kitap kapağı/barkod, araç plakası, yemek fotoğrafı veya ses komutu gibi her AI çıktısı, herhangi bir deftere/veritabanına yazılmadan önce **kullanıcının onay/düzenleme adımından** geçmelidir. Asla arka planda kullanıcı görmeden sessiz kayıt yapılmaz.
3. **Event Bus Durumu & Cross-Module Yazımlar:**
   - `src/lib/events.ts` içinde `EventBus` sınıfı ve `EVENTS` sabitleri mevcuttur; ancak şu anda modüller (8 modül) event emit/subscribe mekanizmasını aktif olarak tüketmemekte, doğrudan veritabanına yazmaktadır (tightly coupled).
   - *Kural:* "Event bus zaten var ama henüz tüm akışlarda aktif değil" gerçeği bilinmelidir. Yeni bir modüller arası tetikleyici (örneğin araç yakıt fişinin bütçeye de yazılması) tasarlanırken, doğrudan tight coupling yapmak yerine bu event bus mekanizmasının canlandırılması veya en azından bu durumun açıkça netleştirilmesi gerekir.
4. **Kütüphane Mükerrer Kitap Koruması & UX Akışı (Zorunlu Prensip):**
   - Kütüphane modülünde barkod/ISBN taramasında (`/api/library/scan-isbn`) ve manuel kitap eklemede mükerrer kitap kontrolü bulunur.
   - Arka uçta `/api/library` POST endpoint'i 409 Conflict kalkanı ile mükerrer kayıtları engeller.
   - `AddBookModal` bileşeni mükerrer bir kitap algıladığında kehribar renkli bir uyarı kartı gösterir ve kullanıcıya iki net seçenek sunar:
     1. **"Mevcut Kitabı Aç/Güncelle"** (kullanıcıyı var olan kayda yönlendirir)
     2. **"2. Kopya Olarak Ekle"** (kullanıcının açık onayıyla `allowDuplicate: true` bayrağı ile kaydedilir)
   - Kütüphane ile ilgili tüm yeni akışlarda ve kod incelemelerinde bu mükerrer kontrolü ve çift seçenekli onay akışı korunmalıdır.
5. **Aile Mahremiyeti Ayrımı (Binary Partitioning):**
   - Ortak Aile Havuzu (ortak bütçe limitleri, araç bakımı, ortak dökümanlar/kasa, ortak kütüphane) vs. Özel Bireysel Alan (kişisel sağlık verileri, kişisel cüzdan, özel notlar). Yeni veri tipleri tasarlanırken bu iki alandan birine açıkça atanmalıdır.
6. **Güvenlik & Doğrulama Temelleri (Denetimden Geçmiş Yapı):**
   - Unauthenticated API endpoint'lerine izin verilmez.
   - Telegram webhook istekleri gizli token doğrulaması ile korunmalıdır.
   - Dijital Kasa (Digital Vault) dosya indirme/yükleme izinleri ve MIME tipleri sıkı kontrol altındadır.
   - AI vision fallback süreçlerinde gerçek dışı/sahte veri uydurulması (hallucination) engellenmeli, hata durumunda kullanıcıya şeffaf bildirim verilmelidir.

---

## Bilinen Açık Sorunlar & Çevresel Kısıtlar

- **Vercel Serverless Kütüphane ISBN Ekleme Hatası:**
  - Kütüphane kitap ekleme/arama modülü yerel ortamda (local development) sorunsuz çalışırken, Vercel canlı ortamında bazı ISBN numaralarında (örneğin: `9786254416170`) başarısız olabilmektedir.
  - *Muhtemel Neden:* Vercel Serverless Function ortamındaki kısıtlar (dosya sistemi/geçici dizin izinleri, Vercel network timeout/giden bağlantı kısıtlamaları, scraping/yerli katalog API'lerinin Vercel IP bloklarına yanıt vermemesi veya ortam değişkeni eksiklikleri).
  - Canlı kütüphane hataları incelenirken bu serverless ortam farkı her zaman ilk şüpheli olarak ele alınmalıdır.

---

## When reviewing code or a feature proposal

Her yeni kod veya özellik önerisinde bu kontrol listesini uygulayın ve eksiklikleri açıkça belirtin:

- [ ] Canlı Vercel ve Supabase PostgreSQL mimarisine uygun mu? (SQLite varsayımı veya yerel Docker kısıtı var mı?)
- [ ] AI Vision tarafından parse edilen veriler için kullanıcı onay/düzenleme adımı var mı?
- [ ] Kütüphaneye kitap ekleme/tarama yapılıyorsa 409 kalkanı ve `AddBookModal` ("Mevcut Kitabı Aç" / "2. Kopya Ekle") akışı gözetildi mi?
- [ ] Modüller arası veri yazımı gerekiyorsa, doğrudan çağrı yerine `src/lib/events.ts` EventBus kullanımı değerlendirildi mi?
- [ ] Çevrimdışı (offline-first) hayali bir kuyruğa güvenmek yerine sistemin canlı online-only çalıştığı dikkate alındı mı?
- [ ] Veri tipi Ortak Aile Havuzu mu yoksa Özel Bireysel Alan mı olarak sınıflandırıldı?
- [ ] API endpoint'i kimlik doğrulama (auth) ve yetkilendirme kontrolü içeriyor mu?
- [ ] Dış veri kaynaklarında (Google Books, OpenLibrary, scraping vb.) rate limit ve timeout/fallback stratejisi var mı?

---

## Communication style for this project

Uğur is a developer and active trader — technical depth is welcome, no need to over-explain standard concepts (REST, ORM, relational databases, Next.js routing). He communicates primarily in Turkish; default to Turkish for this project unless he switches languages. He values direct, structured critique over cheerleading.

---

## Modül bazlı teknik uzmanlık profili

Modüllerin kendine özgü teknik zorlukları ve yaklaşım modelleri:

| Modül | Asıl teknik uzmanlık alanı | Kendine özgü zorluk | Antigravity'de yaklaşım |
|---|---|---|---|
| **Bütçe & Harcama** | Multimodal Vision (fiş/fatura OCR) + finansal matematik (taksit/amortisman) | Görüntüden veri çıkarma ile hesaplama doğruluğu. Görsel çıkarım hatalarının bütçeye karışmaması. | Vision/OCR çıktısı alındıktan sonra tutarlar doğrulanmalı, kullanıcı onay ekranı atlanmamalıdır. |
| **Yatırım & Varlık** | Dış veri entegrasyonu + çoklu para birimi / portföy hesaplama | API değişiklikleri, kur dalgalanmaları, veri kaynağı kesintileri. | Entegrasyon katmanı retry/fallback mekanizmaları ile güçlendirilmeli; hesaplamalar birim testlerle korunmalıdır. |
| **Araç & Ev** | Durum yönetimi, periyodik bakım motoru (KM vs. Tarih eşikleri) | "15.000 KM veya 1 yıl" gibi koşullu alarmlar ve bütçe ile potansiyel çapraz yazım. | Durum makineleri açık ve net tasarlanmalı; cross-module yazımlarda EventBus göz önünde bulundurulmalıdır. |
| **Kütüphane** | Barkod/ISBN tarama, harici katalog arama + OCR | Vercel serverless ortamında harici scraper/API network kısıtları + mükerrer kitap yönetimi. | ISBN taramasında 409 duplicate koruması ve iki yönlü kullanıcı seçimi ("Mevcut Kitabı Aç" / "2. Kopya Ekle") korunmalı. |
| **Sağlık & Beslenme** | Multimodal analiz (yemek fotoğrafı analizi) + biyometrik takip | Besin değerleri ve porsiyon tahmininde AI hata payının yüksekliği. | AI tahminleri mutlak kabul edilmemeli, kullanıcıya porsiyon ve içerik düzenleme formu sunulmalıdır. |

---

## Antigravity içinde model/araç seçim rehberi

Google Antigravity 2.0 Agent Manager ortamında görev türlerine göre önerilen model eşleşmeleri:

- **Derin Mimari & Veri Modeli Kararları:** Claude Opus 4.6 veya Gemini Pro (tekli derin düşünme modu).
- **CRUD, Standart UI & Bileşen Geliştirme:** Gemini Flash (hızlı, yüksek verimli üretim).
- **AI Vision & Doğrulama Akışları:** Sonnet veya Pro (kullanıcı onay formları ve güvenlik kontrolleri).
- **Finansal Hesaplama & Veri Güvenliği:** Opus veya Pro + otomatik test doğrulaması.
- **Canlı Hata Ayıklama & Log İnceleme:** Hızlı analiz için Flash, kök neden analizinde Pro.

---

## 🛑 Hata ve Düzeltme İş Akışı Talimatı (Mandatory User Approval Protocol)

Kullanıcı herhangi bir **hata, düzeltme veya revizyon** bildirdiğinde aşağıdaki protokol KESİNLİKLE uygulanacaktır:

1. **Önce Açıkla & Onay Bekle:** Kullanıcıdan bir hata, düzeltme veya revizyon isteği geldiğinde, KESİNLİKLE doğrudan kod değişikliğine başlanmayacak veya komut çalıştırılmayacaktır. Yapılacak tüm işlemler, kök neden analizi ve çözüm adımları detaylıca kullanıcıya açıklanacak ve kullanıcının **açık onayı (örneğin "devam et", "onaylıyorum")** beklenecektir.
2. **Revizyon Gelirse Planı Yeniden Yaz:** Kullanıcı sunulan çözüm planına veya öneriye bir düzeltme/ek talimat verirse, yapılacak işlemlerin TAMAMI yeni talimatlar doğrultusunda sıfırdan yeniden yazılacak ve **tekrar onay** beklenecektir.
3. **Onay Alınmadan Asla Kod/Dosya Değiştirilmeyecektir:** Kullanıcının açık onayı gelmeden hiçbir dosya düzenleme, kod değiştirme veya terminal komutu yürütme aracı çağrılmayacaktır.

---

## Reference files

- `references/blueprint.md` — Full v2 project blueprint (Turkish). Contains historical module brainstorms, specific domain rules (MTV takvimi, TÜFE kira artış mantığı, WPM okuma hızı vb.).
