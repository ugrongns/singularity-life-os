# Singularity Life OS — Proje Kuralları (Always-On)

Bu dosya her oturumda otomatik yüklenir. Singularity projesi içinde genel anayasa (`ugur-core-constitution`) ile çelişen noktalarda **bu dosyadaki kurallar önceliklidir**.

## 1. Gerçek Mimari & Yığın
- **Mimari:** Online-only **Modüler Monolit** (Vercel + Next.js 15 App Router + React 19 + TypeScript Strict).
- **Veritabanı:** Supabase PostgreSQL + Drizzle ORM (`src/db/schema.ts`, 44 tablo). SQLite veya offline sync worker **yoktur** (`sync_queue` şemada bulunsa da aktif değildir).
- **API & UI Yapısı:** App Router Route Handlers (`src/app/api/**/route.ts`) + Client Components (`src/components/**`) + paylaşımlı PWA kabuğu (`src/components/layout/SharedLayout.tsx`).
- **Event Bus:** `src/lib/events.ts` (`eventBus`, `EVENTS`) aktiftir (`TRANSACTION_CREATED`, `VEHICLE_MAINTENANCE_RECORDED`, `DIET_MEAL_RECORDED`, `TASK_COMPLETED`). `src/lib/event-bus.ts` yalnızca geriye dönük re-export dosyasıdır.

## 2. Değişmez Kırmızı Çizgiler
1. **Dil Standardı:** Kod içi tüm isimlendirmeler (değişken, fonksiyon, tablo, dosya) **İngilizce**; kullanıcı arayüzü (UI), hata mesajları, açıklamalar ve proje dokümanları **Türkçe** yazılır.
2. **Yetkilendirme (Auth & BOLA):** Tüm korumalı API endpoint'lerinde `getAuthUser()` zorunludur. Sorgular ve mutasyonlar kullanıcı (`userId`) veya paylaşılan aile (`familyId`) sınırına göre izole edilir.
3. **AI Güvenlik Kalkanı:** Vision/OCR/LLM ayrıştırmalarından dönen hiçbir veri kullanıcı **onay/düzenleme ekranından** geçmeden veritabanına otomatik yazılmaz; hata durumunda sahte veri üretilmez.
4. **Tarih & Saat Dilimi:** Gün/takvim hesaplamalarında sunucu UTC sapması önlenir; `Europe/Istanbul` yardımcıları (`src/lib/date-utils.ts`) kullanılır.
5. **Hibrit Onay Protokolü:**
   - **Önce plan & açık onay gerekenler:** Veritabanı şeması (`src/db/schema.ts`), temel mimari kararlar veya çok dosyalı büyük özellik/güncellemeler (önce plan sunulup açık onay beklenir).
   - **Doğrudan uygulananlar:** Küçük–orta hata düzeltmeleri (bugfix), test eklemeleri, UI/metin rötuşları ve `/goal` ile başlatılan otonom görevler doğrudan uygulanıp doğrulanır.
6. **Git Commit / Canlı Dağıtım Sınırı:** Kullanıcı açıkça *"commit at / pushla"* veya `!bitti` demedikçe **otomatik `git commit` veya `git push` yapılmaz** (`main` dalına push canlı Vercel uygulamasını otomatik günceller).

## 3. Doğrulama Kapısı (Definition of Done)
- **Varsayılan (her kod değişikliği sonrası):** `npm run verify` (`tsc --noEmit` + `eslint .` + `vitest run`) sıfır hata ile geçmelidir.
- **UI değişikliğinde:** Yerel geliştirme sunucusu üzerinde tarayıcıda canlı görsel ve akış kontrolü yapılır.
- **Büyük işler / dağıtım öncesi:** `npm run verify:full` (`verify` + `next build`) sıfır hata ile geçmelidir.
- **ESLint Yapılandırması (`eslint.config.mjs`):** `eslint-config-next` (`next/core-web-vitals`, `next/typescript`) etkindir (`@typescript-eslint/no-explicit-any` ve `react/no-unescaped-entities` kuralları legacy uyumluluk/Türkçe JSX nedeniyle kapalıdır). Yeni `any` veya yeni lint uyarısı eklenmemelidir.

## 4. Sınırlı Denetim Protokolü (Anti-Loop Kuralı)
Bir modül veya değişiklik denetlenirken sonsuz düzeltme döngüsüne girmemek için şu sözleşme uygulanır:
- **En fazla 2 tur:**
  - **Tur 1 (Kritik / Bloker Hatalar):** Yalnızca çalışmayı bozan, güvenlik/yetki açığı yaratan, veri kaybına veya yanlış finansal/takvim hesabına yol açan, AI çıktısını onaysız yazdıran ya da `npm run verify` kapısını kıran **Kritik/Bloker** hatalar raporlanır ve düzeltilir.
  - **Tur 2 (Regresyon):** Yalnızca Tur 1'de değişen `git diff` üzerinde regresyon kontrolü ve doğrulama yapılır.
- **Durma ve Opsiyonel Not Kuralı:**
  - Kritik/Bloker hata kalmadığında sonuç **`"Sorun Yok" (PASS)`** olarak kapatılır ve ekstra düzeltme turuna **geçilmez**.
  - İstenirse sonucun altında en fazla **10 maddelik salt-okunur "Opsiyonel İyileştirme Notu"** bırakılabilir (**sayıyı doldurmak için zorlama/kozmetik madde uydurulmaz; gerçek fayda sağlayan kaç madde varsa o kadarı yazılır ve kullanıcı açıkça istemedikçe bu opsiyonel öneriler uygulanmaz**).

## 5. Proje Bağlamı ve Doküman Haritası
- **Domain ve Modül Kuralları:** `.agents/skills/singularity-lifeos-dev/SKILL.md`
- **Tek Komutlu Denetim (`!denetle`, `!denetle güvenlik`, `!denetle görsel`, `!denetle <modül>`, `!denetle hepsi`):** `.agents/skills/singularity-audit/SKILL.md`
- **Genel Çalışma Anayasası (`!durum`, `!plan`, `!bitti`):** `.agents/skills/ugur-core-constitution/SKILL.md`
- **Canlı Proje Durumu (yalnızca büyük kilometre taşlarında güncellenir):** `PROJECT_STATE.md`
- **Tarihsel Arşiv (Güncel Şartname Değildir):** `PROJECT_BLUEPRINT.md` ve `SINGULARITY_MASTER_SPECIFICATION.md`
