---
name: singularity-audit
description: >-
  Singularity Life OS için dinamik, teknik jargondan arındırılmış ve sonsuz döngüye girmeyen
  denetim rehberi. Kullanıcı "!denetle", "!denetle güvenlik", "!denetle görsel",
  "!denetle <modül>" veya "!denetle hepsi" dediğinde ya da sade Türkçeyle sistemi/güvenliği/görünümü
  kontrol etmek istediğinde bu skill kullanılır.
---

# Singularity Dinamik Denetim Rehberi (`!denetle`)

Bu skill, kullanıcı teknik detayları bilmek zorunda kalmadan tek bir komutla güvenli, güncel ve sınırlı denetim yapılmasını sağlar.

## Altın Kural: Her Zaman Güncel Klasörü Oku (Asla Ezbere Liste Kullanma)

Yeni modül veya sayfalar eklendiğinde bu rehberin eskimemesi için, ajan her `!denetle` çalıştırışında mevcut kapsamı diskten dinamik olarak keşfeder:
- **Aktif UI sayfaları:** `src/app/**/page.tsx` dosyalarını tara.
- **Aktif API uçları:** `src/app/api/**/route.ts` dosyalarını tara.
- **Son değişiklikler:** `git status` ve `git diff` (çalışma ağacı temizse son commit `git show --stat HEAD`) çıktısına bak.
- **Aktif veritabanı tabloları:** `src/db/schema.ts` dosyasını referans al.

---

## Komut Modları

### 1. `!denetle` (Varsayılan — Son Değişiklik Kontrolü)
1. `npm run verify` (`tsc --noEmit` + `eslint .` + `vitest run`) çalıştır.
2. `git status` / `git diff` (veya son commit) üzerinden yalnızca değişen dosya ve modülleri incele.
3. Değişen dosyalar arayüz (`src/app/**/page.tsx` veya `src/components/**`) içeriyorsa yerel geliştirme sunucusunu (`npm run dev:http`) başlatıp ilgili sayfaları tarayıcıda canlı kontrol et (masaüstü + mobil).
4. Yalnızca **Kritik / Bloker** hata varsa düzelt (en fazla 2 tur) ve `npm run verify` tekrar geçir.

### 2. `!denetle güvenlik` (Önce Rapor — Kod Değiştirmeden)
1. Diskten tüm güncel `src/app/api/**/route.ts` dosyalarını listele.
2. Her ucu 4 temel kurala göre kontrol et:
   - Oturum kontrolü var mı (`getAuthUser()`)? *(Giriş/kayıt/kilit açma ve gizli anahtarlı Telegram webhook hariç.)*
   - Kullanıcı başka bir kullanıcının veya başka bir ailenin verisine erişebiliyor mu (`userId` / `familyId` izolasyonu)?
   - Dosya yükleme/indirme uçlarında yetkisiz dosya erişimi veya tehlikeli dosya türü riski var mı?
   - Yapay zekâ (fiş, yemek, barkod, doküman, ses) çıktıları kullanıcı onay ekranından geçmeden veritabanına yazılıyor mu?
3. **İlk adımda kod değiştirme.** Sonucu kullanıcıya **teknik terimsiz, sade Türkçe** bir özet tablosuyla sun; açık yoksa `"Sorun Yok" (PASS)` de.

### 3. `!denetle görsel` (Canlı Tarayıcı Kontrolü — Masaüstü & Mobil)
1. Diskten tüm güncel `src/app/**/page.tsx` sayfalarını listele.
2. Yerel sunucuyu (`npm run dev:http`) aç ve tarayıcı aracını kullanarak sayfaları **3–4 sayfalık gruplar** hâlinde canlı incele (hem masaüstü `~1280px` hem mobil `~390px` genişlikte).
3. Paylaşımlı kabuktaki (`src/components/layout/SharedLayout.tsx`) kilit ekranı, menü/çekmece ve hızlı işlem modallarının açılıp kapanmasını da kontrol et.
4. Yalnızca **gerçek görsel kırılmaları** (ekrandan taşma, kesilen/tıklanamayan buton, üst üste binen metin, boş/bozuk ekran, tarayıcı konsol veya `500` sunucu hatası) raporla. Renk/zevke dayalı stil önerilerini kritik hata gibi sunma.

### 4. `!denetle <modül>` (Örn. `!denetle görevler`, `!denetle bütçe`, `!denetle kütüphane`)
1. İstenen Türkçe modül adını (`görevler -> tasks`, `bütçe -> budget`, `analitik -> analytics`, `araç/ev -> vehicles`, `kütüphane -> library`, `sağlık -> health`, `wellness/boost`, `kasa -> vault`, `alışveriş -> shopping`, `ayarlar -> settings` veya sonradan eklenen yeni klasörler) `src/app/` ve `src/app/api/` altında dinamik olarak eşleştir.
2. `npm run verify` çalıştır; ilgili API uçlarının güvenlik/hesaplama doğruluğunu kontrol et.
3. Yerel sunucuda o modülün sayfasını canlı açıp temel kullanıcı akışını (ekleme/düzenleme ve sayfa yenileyince verinin korunması dâhil) test et.

### 5. `!denetle hepsi` (Kapsamlı Sistem Denetimi)
Tüm sistemi tek bir dağınık yanıta sıkıştırmadan, sırayla ilerle:
1. `npm run verify:full` (`typecheck` + `lint` + `test` + `build`) çalıştır.
2. `!denetle güvenlik` taramasını yap ve güvenlik özetini çıkar.
3. `!denetle görsel` kontrolünü 3–4 sayfalık gruplar hâlinde tamamla.
4. Kritik modüllerin temel akışlarını canlı doğrula; yalnızca **Kritik / Bloker** sorun varsa düzeltip tekrar `npm run verify` geçir.

---

## Raporlama ve Durma Sözleşmesi (Her Modda Zorunlu)

- **Sade Türkçe Anlatım:** Kullanıcıyı gereksiz teknik terimlerle boğma; sorunu *"Bu ekranda mobilde kaydet butonu dışarı taşıyor"* veya *"Bu uçta başka kullanıcının kaydı okunabiliyor"* gibi net ve anlaşılır dille özetle.
- **En Fazla 2 Tur:** Kritik/Bloker hata düzeltildiyse yalnızca değişen kısım için 1 kez regresyon kontrolü yap; 3. tura geçme.
- **Sonuç Formatı:**
  - Kritik/Bloker hata kalmadığında sonucu **`"Sorun Yok" (PASS)`** olarak kapat.
  - İstersen en alta en fazla **3 maddelik salt-okunur "Opsiyonel İyileştirme Notu"** ekle (**kullanıcı açıkça istemedikçe kesinlikle uygulama**).
- **Git Kuralı:** Kullanıcı `!bitti` veya açıkça *"kaydet/commit at/pushla"* demedikçe `git commit` / `git push` yapma.
