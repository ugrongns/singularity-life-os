# 🌌 SINGULARITY - KİŞİSEL & AİLE YAŞAM İŞLETİM SİSTEMİ (LIFE OS)
## Master Proje Beyin Fırtınası, Mimari Taslak, Karar Kayıtları & Yol Haritası (Blueprint) — v2.1

> **Mevcut Aşama:** Fikir Geliştirme, İhtiyaç Analizi, Kullanıcı Deneyimi & Mimari Tasarım (Kodlama Yapılmıyor)  
> **Kullanıcı Profili:** Bireysel & Aile İçi Ortak Yaşam Yönetimi  
> **Platform & Arayüz:** Yerel Mobil PWA (Kendi Kamera Modülüyle) + Web Dashboard + Opsiyonel Telegram Botu  
> **Son Güncelleme:** 08.08.2026 - v2.1 (Paketli Gıda & Katkı/Pestisit Karnesi Eklendi)

---

## 0. 🔍 UZMAN DEĞERLENDİRMESİ ÖZETİ

Bu bölüm, mevcut tasarımın sistem geliştirme optimizasyonu açısından incelenmesinden çıkan temel bulguları özetler. Detaylı gerekçeler ilgili modüllerin içine ⚠️ **Risk Notu** olarak, genel yol haritası ise Bölüm 10'a eklenmiştir.

* **Güçlü Yönler:** Zero-friction felsefesi doğru teşhis; self-hosting + Cloudflare Tunnel/Tailscale mimarisi maliyet ve gizlilik açısından isabetli; çapraz modül sinerjileri (Bölüm 9.1) sistemi gerçek anlamda farklılaştıran kısım.
* **En Büyük Risk — Kapsam:** 5 ana modülün her biri tek başına bağımsız bir ürün genişliğinde. Tek geliştirici için "hiçbiri bitmeyen 5 yarım modül" riski var. Çözüm: Bölüm 10'daki fazlı yol haritası.
* **İkinci Risk — Tek Arıza Noktalı Sunucu:** Windows ev sunucusu kapanırsa/yeniden başlarsa tüm aile sistemden mahrum kalır. Disaster recovery (9.3) veri kaybını önler ama erişilebilirliği garanti etmez.
* **Üçüncü Risk — AI Vision Güvenilirliği:** "Sıfır efor" vaadi ile gerçekte her zaman gereken bir doğrulama/düzeltme adımı arasında beklenti farkı var; sistem "low friction" olarak konumlandırılmalı.
* **Dördüncü Risk — Offline-First Senkron:** Conflict resolution ve sync strategy sonradan eklenecek bir özellik değil, veri modelinin en başından tasarlanması gereken bir mimari karardır.
* **Mimari Öneri:** Mikroservisler yerine modüler monolit + internal event bus ile başlanması, AI pipeline'ının ayrı bir servis katmanında izole edilmesi öneriliyor (detay Bölüm 2 ve 10).

---

## 1. 🎯 Temel Vizyon, Felsefe & Çıkış Noktası

* **Parçalanmışlığı ve Veri Kopukluğunu Bitirmek (Singularity Yaklaşımı):**  
  Geçmişte ayrı ayrı kullanılan veya geliştirilmeye çalışılan (ev bütçesi ayrı, borsa takibi ayrı, araç bakımı ayrı, kitaplık ayrı, sağlık/spor ayrı) parçalı sistemlerin yarattığı yorgunluğu ve veri kopukluğunu tek bir entegre merkezde toplamak.
* **Geçmiş Deneyimlerin En Büyük Sorununu Çözmek (Düşük Efor / Low-Friction):**  
  Uygulamaların terk edilmesindeki 1 numaralı sebep olan **"veri girme zorluğu, üşenme ve karmaşık formlar"** engelini; **Görsel Yapay Zeka (Vision AI)**, **Akıllı Fotoğraf Tarama**, **Sesli Çoklu Komutlar** ve **Tek Tıkla İnteraktif Butonlar** ile en aza indirmek.
  * ⚠️ **Risk Notu:** "Sıfır efor" ifadesi gerçek AI Vision performansına göre iddialı. Buruşuk fiş, kötü ışık, el yazısı notlar gibi durumlarda düzenli hata payı beklenmeli. Sistemde bir doğrulama/düzeltme adımı zaten var (bkz. 4.4, 8.2) — bu iyi, ama vizyon metninde "low-friction" (düşük efor) olarak konumlandırmak, kullanıcı beklentisiyle gerçek performans arasındaki farkı azaltır.
* **Tam Veri Mahremiyeti ve Sahiplik:**  
  Ailenin en özel finansal, mülk, evrak ve biyometrik verilerini bulut şirketlerinin sunucularına bağımlı kılmadan, %100 kendi kontrolünde ve yerelinde tutmak.

---

## 2. ⚙️ Altyapı, Sunucu & Dağıtım Mimarisi (Self-Hosting)

* **Ücretsiz Windows Ev Sunucusu (Self-Hosting):**  
  * Sistemin sunucusu kullanıcının kendi **Windows Bilgisayarı** olacak.
  * **Maliyet:** 0 TL (Aylık hosting, veritabanı veya bulut faturası yok).
  * **Kapasite & Güç:** Bilgisayarın disk kapasitesi ve donanım gücü kadar sınırsız.
  * **Çalışma Ortamı:** Windows üzerinde Docker / WSL2 ile izole, kararlı ve taşınabilir çalışma.
  * ⚠️ **Risk Notu:** Windows sunucu tek arıza noktası (SPOF). Bilgisayar kapanırsa (update restart, elektrik kesintisi, donanım arızası) tüm aile erişimden mahrum kalır — bu da terk edilme riskini yükseltir. Öneriler: (1) Windows'ta otomatik yeniden başlatma sonrası servislerin otomatik ayağa kalkması (`restart: always`), (2) UPS (kesintisiz güç kaynağı) ile ani kapanmaların önlenmesi, (3) basit bir "sunucu ayakta mı" health-check bildirimi.
* **Çok Katmanlı Güvenli Erişim Mimarisi:**  
  * **Ev İçi Yerel Ağ (LAN / Wi-Fi):** Evdeyken telefon, tablet ve bilgisayarlardan yerel IP üzerinden gecikmesiz, ultra hızlı erişim.
  * **Ev Dışı Uzaktan Güvenli Erişim:** Modemden port açma güvenlik riski olmadan, **Cloudflare Tunnel** veya **Tailscale VPN** üzerinden dışarıdayken şifreli, güvenli ve ücretsiz erişim.

### 2.1. 🏗️ Mimari Yaklaşım Önerisi

* **Modüler Monolit (Mikroservis Değil):** Tek geliştirici için deployment ve debug karmaşıklığını azaltmak amacıyla, en başta ayrı mikroservisler yerine tek bir uygulama içinde net modül sınırlarıyla (modüler monolit) başlanması öneriliyor.
* **Internal Event Bus:** Bölüm 9.1'deki çapraz modül sinerjileri (örn. "fatura kaydedildi" → hem bütçe hem araç defteri) doğal olarak bir event-driven omurga gerektirir. Basit bir internal event/queue mekanizması en başta kurulmalı.
* **AI Pipeline İzolasyonu:** Görüntü/ses → yapılandırılmış veri dönüşümü ayrı bir servis katmanında tutulmalı. Böylece AI sağlayıcısı/modeli değişse çekirdek sistem (veritabanı, iş mantığı) etkilenmez.
* **Offline Senkron Stratejisi Baştan Seçilmeli:** Conflict resolution ve sync stratejisi (Last-Write-Wins + Conflict Log), veri modeli tasarlanırken en baştan belirlenmeli.

---

## 3. 📱 Kullanıcı Arayüzü & Etkileşim Kanalları

* **Birincil Arayüz - Doğrudan Singularity Mobil Uygulaması (PWA / Web App):**  
  * Apple & Notion sadeliğinde, telefonun ana ekranından tek dokunuşla açılan tam ekran mobil uygulama.
  * **Dahili Hızlı Kamera Butonu `[ 📸 Tara ]`:** Telefonun yerel kamerası doğrudan uygulama içinde açılır; fiş, fatura, kitap barkodu veya yemek tabağı çekildiği anda sistemin kendi modern arayüzünde işlenir.
* **İkincil / Opsiyonel Kanal - Telegram Bot Asistanı:**  
  * Dışarıdayken hızlı mesaj atmak veya anlık bildirimleri/hatırlatmaları almak isteyen aile üyeleri için alternatif interaktif kanal.
* **Canlı Güncellenen Özellik Vitrini & Karşılama Ana Sayfası:**  
  * Sisteme yeni girecek aile üyelerine sistemi anlatan, sistem geliştikçe yeni yetenekleri canlı olarak listeleyen dinamik vitrin.

---

## 4. 💰 Modül 1: Ev & Aile Bütçesi ve Nakit Akışı Yönetimi

### 4.1. Varlık Merkezleri, Hesaplar & Cüzdanlar
* **Banka Vadesiz Hesapları:** Günlük likit para akışı.
* **Kredi Kartları:** Limitler, hesap kesim tarihleri, son ödeme günleri, asgari ve toplam borç takibi.
* **Nakit Cüzdanlar & Kasalar:** Eldeki fiziki nakit, döviz ve fiziki altın rezervleri.

### 4.2. Gelir & Gider Hiyerarşisi
* **Gelirler:** Sabit maaşlar, değişken prim/ek gelirler, gayrimenkul kira gelirleri, borsa temettüleri (Kişisel vs. Ortak Aile Havuzu ayrımı).
* **Giderler:**
  1. *Sabit & Zorunlu:* Kira/Aidat, faturalar (elektrik, su, gaz, internet, telefon), kredi taksitleri, sigorta/kasko, okul/kreş, dijital abonelikler.
  2. *Değişken Yaşam:* Market & gıda, dışarıda yeme-içme, akaryakıt/ulaşım, giyim, kişisel bakım, ev ihtiyaçları, sağlık/eczane.
  3. *Keyif & Dönemsel:* Tatil, seyahat, hobiler, sosyal aktiviteler, hediyeler.

### 4.3. Bütçeleme Kuralları & Hedef Fonları
* **Kategori Bütçe Limitleri:** Aylık harcama tavanları ve %80 / %100 limit aşım alarmları.
* **Acil Durum Fonu (Emergency Fund):** Ailenin 3-6 aylık zorunlu giderini güvenceye alan bağımsız fon.
* **Hedef Kumbaraları (Sinking Funds):** Tatil fonu, araba bakım fonu, teknoloji yenileme fonu.

### 4.4. 📸 AI Fiş/Fatura Tarama & İnteraktif Taksit Motoru
* **Vision AI ile 2 Saniyede Tarama:** İşletme adı, tarih, toplam tutar ve kategori tespiti (Çoklu kategori / split expense desteği).
* **İnteraktif Ödeme Seçimi:** Tutar okunduğunda butonlarla ödeme yöntemi seçilir (`[💳 Garanti]` `[💳 İş Bankası]` `[💵 Nakit]`).
* **Akıllı Taksit Bölme & Gelecek Projeksiyonu:**
  * Kredi kartı seçildiğinde taksit sayısı sorulur (`[⚡ Tek Çekim]` `[2]` `[3]` `[6]` `[9]` `[🔢 Özel]`).
  * Tutar otomatik aylara bölünür (3.600 TL ÷ 3 = 1.200 TL), gelecek 3 ayın kredi kartı ekstrelerine ve nakit akış takvimine otomatik işlenir.
* **Ürün Fiyat Geçmişi & Garanti Arşivi:** Fiş üzerindeki ürün fiyatları kaydedilerek kişisel enflasyon takibi yapılır; fiş fotoğrafı yerel garanti arşivine eklenir.
* ⚠️ **Risk Notu:** Bu modül, Bölüm 10'daki yol haritasında Faz 1 (ilk inşa edilecek modül) olarak önerilmektedir — çünkü hem AI vision pipeline'ını hem offline senkronu hem de aile gizlilik bölümlemesini tek bir modülde uçtan uca test etmeye izin verir.

---

## 5. 📈 Modül 2: Yatırımlar & Varlık Yönetimi (Wealth & Asset Engine)

### 5.1. Çoklu Para Birimi & Emtia Bazlı Değerleme (Multi-Currency Benchmark)
* Toplam servet ve Net Değer (Net Worth) anlık ve geriye dönük olarak:
  * **Türk Lirası (₺)**, **Amerikan Doları ($ - USD)**, **Euro (€ - EUR)**, **Gram Altın (gr)** ve **Bitcoin (₿ - BTC)**
  cinsinden tek tıkla değerlenebilir. Enflasyona ve devalüasyona karşı gerçek alım gücü büyümesi takip edilir.

### 5.2. Likit Yatırım Araçları & Esnek Motorlar
* **Borsa & Hisse Senetleri (BIST & Yabancı Hisseler):** Lot adetleri, alış maliyetleri (DCA), anlık kar/zarar (TL ve USD).
* **Gelişmiş & Esnek Temettü Motoru:**
  * Şirketlerin KAP'a açıkladığı resmi temettü takviminin otomatik çekilmesi.
  * **Manuel Düzeltme & Serbest Giriş:** Takvimden bağımsız gerçekleşen, stopaj farkı olan veya takvimde yer almayan özel/erken/geç temettü ödemelerini elle düzenleyebilme ve ekleyebilme esnekliği.
  * Yıllık beklenen pasif temettü nakit akışı projeksiyonu.
* **Yatırım Fonları (TEFAS / BEFAS):** TEFAS fon fiyatlarının resmi sistemden günlük otomatik çekilmesi (Sıfır manuel fiyat girişi).
* **Bireysel Emeklilik Sistemi (BES - Dinamik Devlet Katkısı):**
  * **Ayarlanabilir Devlet Katkısı Oranı Parametresi:** Mevzuattaki **%30 oranı sisteme sabit kodlanmayacak**, sistem ayarlarından dinamik olarak değiştirilebilecek.
* **Kıymetli Madenler & Kripto:** Canlı Kapalıçarşı/serbest piyasa altın/gümüş ve kripto API fiyatları.
* ⚠️ **Risk Notu:** TEFAS/KAP gibi kaynaklarda resmi/açık bir API yoksa sistem web scraping'e dayanacaktır — bu kırılgan ve sürekli bakım gerektiren bir bağımlılıktır. Bu modüle geçmeden önce (Bölüm 10 Faz 2) veri kaynaklarının API durumu netleştirilmeli.

### 5.3. İlikit Mal Varlıkları & Pasif Gelirler
* **Gayrimenkuller (Ev, Daire, Arsa, Dükkan):** Satın alma maliyeti, güncel değerleme ve kalan kredi borcu.
* **🏢 Akıllı Kira Gelir Takip Sistemi:** Kiracı sözleşme takibi, **TÜFE yasal kira artış tavanı hesaplayıcısı**, tahsilat alarmları ve tek tıkla bütçeye pasif gelir aktarımı.
* **Araçlar (Otomobil, Motosiklet):** Rayiç piyasa değeri ve araç net özkaynak değeri.

### 5.4. 💎 Net Değer (Net Worth) & Portföy Sağlığı
* Net Değer = Toplam Varlıklar − Toplam Borçlar (Krediler, taksitler, borçlar).
* Çoklu para birimli servet büyüme grafiği ve hedef varlık dağılımı (Rebalancing) analizi.

---

## 6. 🚗 Modül 3: Ev, Araç & Aile Operasyonları

### 6.1. 🚙 Araç Yönetimi & Akıllı Fatura Motoru (Dual-Ledger Ingestion)
* **Araç Profili & KM Takibi:** Plaka, marka/model, yıl, şase no, anlık Kilometre sayacı.
* **Periyodik Bakım Motoru:** *"15.000 KM veya 1 Yıl"* kuralı. Değişen parçaların (yağ, filtreler, balatalar vb.) eksiksiz dijital servis geçmişi.
* **Yasal Süreç Takvimi:** TÜVTÜRK muayenesi (30 gün önceden uyarı), Trafik Sigortası & Kasko yenilemeleri, MTV 1. ve 2. taksitleri (Ocak / Temmuz), Egzoz emisyon ölçümü.
* **Mevsimsel Lastik Takibi:** Yazlık/Kışlık değişim ayları, DOT üretim yılı/ömrü ve saklandığı yer.
* **Akaryakıt & Tüketim Analitiği:** 100 KM'de ortalama litre ve TL tüketimi.
* **📸 Akıllı Araç/Ev Fatura İşleme & Çift Yönlü Entegrasyon:**
  * Yakıt fişi, lastik alımı veya servis faturası yüklendiğinde AI işlemi tanır.
  * Bot/Uygulama kullanıcıya dinamik sorular sorar: *"Araç şu an kaç KM'de?"*, *"Hangi istasyondan aldınız (Shell, Opet...)?"*, *"Değişen parçaları onaylıyor musunuz?"*, *"Ödeme yöntemi ve taksit sayısı?"*.
  * **Çift Yönlü Kayıt:** Bilgiler hem **Araç Servis & KM Defterine** hem de **Ev Bütçesi ve Kredi Kartı Taksitlerine** aynı anda otomatik işlenir.
  * ⚠️ **Risk Notu:** Bu dual-ledger akış, çapraz modül senkronizasyonunun ilk gerçek testi olacağı için Bölüm 10 Faz 2'de öncelikli olarak ele alınması öneriliyor.

### 6.2. 🏡 Ev & Mülk Bakımı
* **Ev Künyesi & Tesisat:** DASK, konut sigortası, elektrik/su/gaz sayaç ve abone numaraları.
* **Periyodik Bakım Takvimi:** Yıllık sonbahar kombi ve petek bakımı, klima filtre temizlikleri, **su arıtma cihazı filtre değişim periyotları (3 ay, 6 ay, 1 yıl) ve alarmları**.
* **Demirbaşlar & Akıllı Garanti Takibi:** Beyaz eşya, televizyon, süpürge, telefon ve bilgisayarların fatura/garanti fotoğrafları; garantinin bitmesine 30 gün kala uyarı.

### 6.3. 📑 Aile Dijital Kasası & Rutinler
* **Pasaport & Ehliyet:** Pasaport geçerlilik süresinin bitmesine 6 ay kala (vize engellerini önlemek için) erken uyarı.
* **Taahhüt Savar (Contract Engine):** İnternet ve telefon tarifeleri taahhüt bitiş alarmları.
* **Evcil Hayvan Takibi:** Aşı takvimi (kuduz, karma, parazit), veteriner randevuları ve çip no.
* **Önemli Günler & Ortak Takvim:** Doğum günleri, evlilik yıldönümleri ve aile rutinleri.

---

## 7. 📚 Modül 4: Kişisel & Aile Kütüphanesi ve İkinci Beyin

### 7.1. Sıfır Eforla Kitap Ekleme & Barkod Okuma
* **ISBN Barkod & Kapak Tanıma:** Kitap arkasındaki barkod fotoğrafından yazar, yayınevi, sayfa sayısı, kapak görseli ve özet otomatik çekilir (Doğrulandı: Frédéric Bastiat - Hukuk, Liberus Yayınları, ISBN 9786056951374).
* **Format Desteği:** Fiziki Kitap (Oda/raf konumu), E-Kitap (Kindle/PDF), Sesli Kitap (Storytel), Çocuk Kitaplığı.

### 7.2. 🔬 Akıllı Okuma Hızı & Sayfa Başı Kelime Kalibrasyon Motoru
* **Sayfa Kelime Yoğunluğu Kalibrasyonu:** Kitabın tam dolu standart 1 sayfasının fotoğrafı yüklenir; AI sayfadaki kelimeleri sayarak o kitaba özel Ortalama Kelime Sayısı ($N_{\text{kelime}}$) kalibre eder (Örn: 320 kelime/sayfa).
* **Okuma Seansı Giriş Formu:** Kullanıcı seans sonunda 3 bilgiyi girer: Başlangıç Sayfası, Kaldığı Sayfa, Okuma Süresi (Dakika).
* **Sistemin Ürettiği Derin Metrikler:**
  * Toplam Okunan Kelime: $(\text{Okunan Sayfa}) \times N_{\text{kelime}}$
  * **Net Okuma Hızı (WPM - Dakikada Kelime):** $\frac{\text{Toplam Kelime}}{\text{Süre (dk)}}$
  * Sayfa Başına Süre (dk/sayfa).
  * **Dinamik Kitap Bitiş Tahmini (ETA):** Kalan sayfaların mevcut okuma hızına göre kaç saat/dakika içinde biteceği öngörüsü ("Günde 30 dk okursanız 4 gün sonra tamamlanacak").

### 7.3. Akıllı Alıntı, Dijital Notlar & Emanet Takibi
* **Fotoğraftan Alıntıya (Highlight OCR):** Kitapta altı çizilen paragrafın fotoğrafından otomatik dijital alıntı kaydı.
* **Sesli Not Düşünce Kaydı:** Telegram'a veya uygulamaya atılan ses kaydının metne dökülüp kitaba not eklenmesi.
* **🤝 "Kitabım Kimde?" Emanet Takip Sistemi:** Arkadaşa verilen kitapların kaydı ve 2 ay sonra geri alma hatırlatıcısı.
* ⚠️ **Risk Notu:** Barkod/ISBN tanıma nispeten olgun ve düşük riskli bir problem olduğundan bu modül Bölüm 10 Faz 3'te (düşük riskli modüller) öneriliyor.

---

## 8. 🧬 Modül 5: Bütünsel Sağlık, Spor & Beslenme (Longevity Hub)

### 8.1. Spor & Egzersiz Takibi
* Basit ve yormayan antrenman seans kayıtları (Ağırlık/Fitness, Koşu, Yürüyüş, Yüzme vb.).

### 8.2. 🥗 AI Yemek Tabağı Görsel Analizi & İnteraktif Düzenleme Formu
1. Yemek tabağının fotoğrafı çekilir.
2. AI tabaktaki besinleri ve tahmini gramajları ayrıştırır.
3. **Kullanıcı Düzenleme & Doğrulama Formu:** Kullanıcı gramajları serbestçe günceller (Örn: 180 gr yerine 200 gr), tabağa girmeyen eksik besinleri (`[+ 1 YK Zeytinyağı]` veya `[+ 1 Kase Yoğurt]`) ekler ya da yemediği kalemleri siler.
4. **Kesin Kayıt:** Sistem kullanıcının onayladığı son değerleri baz alarak günlük Kalori, Protein, Karbonhidrat ve Yağ toplamlarına işler.
* ⚠️ **Risk Notu:** Yemek tabağı görsel analizi, sistemin en yüksek AI hata payına sahip özelliği (gramaj tahmini, karışık/örtüşen besinler, pişirme yöntemi belirsizliği). Bölüm 10 Faz 3'te en son eklenmesi öneriliyor, kullanıcı düzeltme formunun (adım 3) sağlamlığına özellikle önem verilmeli.

### 8.3. 📋 Diyetisyen Menü Planı & Alternatifli Öğün Takip Sistemi
* **Diyetisyen Listesini Dijitalleştirme:** Diyetisyenden alınan liste/PDF sisteme yüklenir; AI bunu öğünlere ve alternatif seçeneklere (Seçenek 1, Seçenek 2, Seçenek 3) böler.
* **Tek Tıkla Alternatif Seçimi:** Öğün vakti geldiğinde menülerden biri tek tıkla seçilir (Örn: `[🥣 Seçenek 2: Yulaf Lapası]`).
* **Akıllı Görsel Eşleme:** Tabak fotoğrafı çekildiğinde AI tabağı tanır ve aktif diyet menüsüyle eşleştirir.
* **⚡ Menü Seçimi Sonrası Hızlı Düzenleme & Sapma Takibi:**
  * Seçilen menü mini bir kontrol listesi (checklist) olarak açılır.
  * Kullanıcı listedeki bir maddeyi tek tıkla çıkarabilir (`[❌ Zeytin Yemedim]`), porsiyonu değiştirebilir (`[3 Yumurta (+1)]`) veya menü dışı ilave yapabilir.
* **Diyetisyen Kontrol Raporu (PDF):** Diyetisyen randevusu için haftalık diyete uyum oranı (% uyum) ve tüketim eğilimleri raporu.

### 8.4. ⏳ Aralıklı Oruç (Intermittent Fasting - IF) Motoru
* Popüler protokoller (16:8, 18:6, 20:4, Özel Saatler).
* Canlı geri sayım sayacı ve yeme penceresi açılış/kapanış bildirimleri.

### 8.5. Biyometri, Uyku & Zihinsel Sağlık
* Günlük su tüketimi takibi (Hızlı +250ml / +500ml butonları).
* Günlük takviye ve vitamin rutinleri (Sabah/Akşam alarmları).
* Uyku süresi, sabahki zindelik/dinlenme hissi ve ruh hali (Mood Tracker).

### 8.6. 🏷️ Paketli Gıda Barkod & Katkı / Pestisit Risk Karnesi (YENİ EKLENDİ)
* **Open Food Facts & Vision Entegrasyonu:** Paketli gıdanın barkodu okutulduğunda ürün adı, marka, porsiyon ve makro besinler (kalori, şeker, yağ, protein) otomatik çekilir.
* **NOVA 1-4 & Katkı Maddesi (E-Kodları) Taraması:** Ürünün ultra-işlenmişlik derecesi (NOVA 4 tespiti), emülgatörler, koruyucular, yapay tatlandırıcılar ve bağırsak sağlığına zararlı E-kodları anında kırmızı/sarı bayrakla listelenir.
* **Tarımsal / Pestisit Risk İndeksi (EWG & EFSA Modeli):**
  * Ürünün Organik Sertifikası kontrol edilir.
  * Konvansiyonel tarımda yüksek pestisit kalıntısı riski taşıyan hammaddeler (çilek, elma, buğday, fındık, kuru meyveler) istatistiksel risk uyarısıyla gösterilir.
* **Kullanıcı Karar Butonları:**
  * `[ ➕ Günlük Beslenmeme Ekle ]` ➔ Kalori ve makroları günlük hedefe aktarır.
  * `[ ❌ Tüketmekten Vazgeç ]` ➔ Zararlı katkı/işlenmişlik sebebiyle vazgeçilen ürünleri ve sağlıklı tercih istatistiğini kaydeder.

---

## 9. 🚀 GELİŞTİRME ÖNCELİKLENDİRMESİ & 11 AŞAMALI FAZLI YOL HARİTASI

Mevcut tasarımın tamamını aynı anda inşa etmeye çalışmak yerine; riskleri önceden bertaraf eden, her adımda kullanıcı testi ve onayı gerektiren 11 aşamalı kontrollü üretim haritası:

### 🏛️ BLOK 1: ÇEKİRDEK İSKELET & EV BÜTÇESİ (MVP & İLK BAŞARI)
* **Faz 1:** Temel Altyapı, Next.js + SQLite (Offline-Sync Hazır Şema) & PWA Kabuğu.
* **Faz 2:** Manuel Bütçe, Hesaplar (Vadesiz/Nakit/Kredi Kartı) & Kategori Limitleri.
* **Faz 3:** AI Fiş/Fatura Tarama & Akıllı Taksit Bölme Motoru (Low-Friction Taslak).
* 🎯 **Onay Kapısı 1:** Gerçek bir fiş çekilip taksitli olarak bütçeye işlenmesi test edilip onaylanır.

### 🚗 BLOK 2: ÇAPRAZ SİNERJİ, ARAÇ & ÇOKLU PARA BİRİMLİ YATIRIMLAR
* **Faz 4:** Internal Event Bus (Omurga) & Araç Filo Yönetimi (KM / Periyodik Bakım).
* **Faz 5:** Çift Yönlü Fatura Motoru (Yakıt fişi ➔ Hem Araç Defterine hem Bütçeye).
* **Faz 6:** Çoklu Para Birimli Yatırımlar (USD, Altın, BTC), Gayrimenkul/Kira & Net Değer.
* 🎯 **Onay Kapısı 2:** Yakıt fişi çekilip çift yönlü kayıt ve Net Değer panosu test edilip onaylanır.

### 📚 BLOK 3: DÜŞÜK RİSKLİ MODÜLLER (EV, KÜTÜPHANE & SAĞLIK)
* **Faz 7:** Ev Tesisatı, Su Arıtma Filtreleri (3/6/12 ay) & Garanti/Evrak Kasası.
* **Faz 8:** Kütüphane (ISBN Barkod + Sayfa Kelime Kalibrasyonu + WPM/ETA Motoru).
* **Faz 9:** Bütünsel Sağlık (AI Tabak Analizi + Diyetisyen Menü Seçici + Aralıklı Oruç + Paketli Gıda Katkı/Pestisit Karnesi).
* 🎯 **Onay Kapısı 3:** Kitap okuma hızı ve yemek tabağı/gıda karnesi test edilip onaylanır.

### 🎙️ BLOK 4: İLERİ SEVİYE SİNERJİLER, SES & FELAKET KURTARMA
* **Faz 10:** Çapraz Sinerjiler (Diyetten Market Listesi) & Sesli Çoklu İşlem Girişi.
* **Faz 11:** Gece 04:00 Otomatik Şifreli Yedekleme (AES-256) & Canlı Özellik Vitrini.
* 🎯 **Onay Kapısı 4:** Sesli çoklu kayıt ve şifreli yedekleme test edilip nihai onay verilir.
