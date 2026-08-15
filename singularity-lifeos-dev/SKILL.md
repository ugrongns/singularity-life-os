---
name: singularity-lifeos-dev
description: Guides architecture decisions, code reviews, and feature planning for "Singularity" — Uğur's self-hosted personal/family Life OS project (budget, investments/net worth, vehicle & home operations, personal library, health/nutrition). Use this skill whenever the user mentions Singularity, Life OS, or references any of its five modules (bütçe, yatırım/net worth, araç/ev, kütüphane, sağlık), asks to design, build, review, or audit a feature for this system, discusses its phased roadmap (Faz 1-4), event bus, offline-first sync, dual-ledger ingestion, AI vision pipeline, or family privacy partitioning — even if they don't say "Singularity" by name but the request clearly matches one of these modules or architectural concerns. Always consult this skill before proposing new features or code for this project, so recommendations stay consistent with the agreed architecture and phase gates instead of re-litigating settled decisions.
---

# Singularity Life OS — Development Guide

A skill for keeping every future conversation about the Singularity project consistent with its agreed architecture, phase sequencing, and risk mitigations — instead of re-deriving them from scratch or drifting from what was already decided.

## What this project is

Singularity is a self-hosted personal/family "Life OS" unifying five modules: **Bütçe** (budget/cash flow), **Yatırım** (investments/net worth), **Araç & Ev** (vehicle/home operations), **Kütüphane** (personal library), and **Sağlık** (health/nutrition). Full design is in `references/blueprint.md` — read it whenever you need module-level detail (data fields, UI flows, specific business rules like MTV taksitleri or TÜFE kira artış tavanı) that isn't summarized below.

Core stack decisions already made — do not re-propose alternatives to these unless the user explicitly asks to revisit them:
- **Hosting:** Self-hosted on Uğur's own Windows PC via Docker/WSL2. LAN access at home; Cloudflare Tunnel or Tailscale VPN remotely. Zero monthly cost is a hard constraint.
- **Interface:** Mobile PWA with built-in camera + web dashboard. Telegram bot is a secondary/optional channel only.
- **Architecture:** Modular monolith (not microservices) with an internal event bus for cross-module triggers.
- **AI pipeline:** Isolated as its own service layer, decoupled from core business logic and database.

## Non-negotiable architectural principles

When proposing or reviewing any code/feature for this project, check it against these — they exist because the original design underweighted them:

1. **Offline-first sync is a data-model decision, not a bolt-on.** Any feature that writes data must define its conflict-resolution behavior (last-write-wins + conflict log is the chosen default) at design time. Flag any proposal that defers this to "we'll add sync later."
2. **AI Vision output is never auto-committed.** Every AI-parsed record (receipt, invoice, plate/odometer read, food photo, voice command) must pass through a user confirmation/edit step before being written to any ledger. Never suggest silently trusting AI extraction for financial, health, or vehicle records.
3. **Cross-module writes go through the event bus, not direct calls.** E.g., a fuel receipt writing to both the vehicle log and the budget ledger (dual-ledger ingestion) should emit an event the budget module subscribes to — not call budget's write function directly. This is what keeps modules addable/removable later.
4. **Single point of failure at the home server is a known, accepted risk — mitigate, don't ignore.** Any deployment-related suggestion should account for `restart: always` Docker policies and ideally a UPS; do not treat "the PC might be off" as out of scope.
5. **Family privacy partitioning is binary per data type, decided once per module.** Ortak Aile Havuzu (budget limits, vehicle maintenance, document vault, shared library) vs. Özel Bireysel Alan (individual health data, personal wallet, private notes) — classify new data types into one of these two buckets explicitly; don't leave it ambiguous.

## Phase gate — enforce this before agreeing to build anything

The project is intentionally sequenced to de-risk the two hardest problems (offline sync, cross-module events) early, in the smallest possible surface area. **Do not help design or build a Faz 2+ module until Faz 1 is described as functionally complete by the user.** If asked to jump ahead, say so plainly and ask whether they want to proceed anyway (their call, but the tradeoff should be named).

| Phase | Scope | Why this order |
|---|---|---|
| **Faz 1** | Core omurga (auth, event bus, AI vision pipeline, PWA camera) built through **Bütçe module only**. Receipt scan + installment engine end-to-end. Offline sync tested here. Family privacy partitioning template established here. | Cheapest place to get the two hardest problems (sync, AI verification UX) right. |
| **Faz 2** | Add **Araç or Yatırım** module. Test dual-ledger ingestion and real cross-module sync via the event bus. Validate TEFAS/KAP data source availability before committing to it. | First real test of the event bus and an external-API dependency, in a still-small system. |
| **Faz 3** | Add **Kütüphane**, then **Sağlık** (food-photo analysis added last — highest AI error rate). | Lower AI risk, UX-focused; good place to harden the confirm/edit pattern before the hardest AI case. |
| **Faz 4** | Multi-domain voice agent (pilot in one module first, always with a confirm-before-commit summary screen), disaster recovery automation (mandatory before calling anything "production"). | Highest-risk, highest-payoff features; only worth the complexity once the core is proven. |

## When reviewing code or a feature proposal

Run through this checklist and call out any miss explicitly (don't just silently fix it):

- [ ] Does it belong to the current phase, or does it jump ahead?
- [ ] If it writes AI-parsed data, is there a confirm/edit step before commit?
- [ ] If it writes to more than one module's data, does it go through the event bus?
- [ ] If it's offline-capable, does it define conflict resolution?
- [ ] Is the data classified as Ortak Aile Havuzu or Özel Bireysel Alan?
- [ ] Does it assume the home server is always reachable? (It shouldn't.)
- [ ] For Yatırım module features relying on TEFAS/KAP/BIST data: is the data source an official API, or scraping? If scraping, flag the maintenance burden.

## Communication style for this project

Uğur is a developer and active trader — technical depth is welcome, no need to over-explain standard concepts (Docker, event-driven architecture, REST). He communicates primarily in Turkish; default to Turkish for this project unless he switches languages. He values direct, structured critique over cheerleading — when reviewing his designs, lead with the honest assessment (as in the original blueprint review), not just praise.

## Modül bazlı teknik uzmanlık profili

Haklı bir nokta: 5 modül birbirinden çok farklı teknik problemler içeriyor — hepsine aynı "genel full-stack ajan" muamelesi yapmak, her birinin kendine özgü hata modlarını gözden kaçırır. Bir modül üzerinde çalışırken önce o modülün asıl teknik zorluğunun ne olduğunu netleştir, sonra ona göre model/yaklaşım seç.

| Modül | Asıl teknik uzmanlık alanı | Kendine özgü zorluk | Antigravity'de yaklaşım |
|---|---|---|---|
| **Bütçe** | Multimodal Vision (fiş/fatura OCR) + finansal matematik (taksit/amortisman) | İki farklı yetenek aynı akışta: önce görüntüden veri çıkarma (vision), sonra o veriyle kesin doğru hesap yapma (matematik). Görsel çıkarım hatası fark edilmeden hesaba karışabilir. | Vision/OCR kısmını üret, çıkan JSON'u ayrı bir adımda **Opus 4.6/Gemini 3.1 Pro'ya matematiksel doğrulama** yaptır — tek geçişte "oku ve hesapla" deme. |
| **Yatırım** | Dış veri entegrasyonu (TEFAS/KAP/BIST/kripto API'leri veya scraping) + çoklu para birimi dönüşüm mantığı | Uzmanlık burada modelde değil, **entegrasyon kırılganlığında**: API şema değişiklikleri, rate limit, resmi API yoksa scraping bakımı. Model gücünden çok hata toleranslı mimari (retry, fallback, veri kaynağı doğrulama) önemli. | Üretim hızlı modelle (Flash) yapılabilir ama **entegrasyon katmanı ayrı test edilmeli**; kur/emtia çevrimlerinin doğruluğunu Opus/Pro ile ayrıca kontrol et. |
| **Araç & Ev** | Event-driven mimari (dual-ledger yazma) + zamanlama/tetikleyici motoru (KM bazlı + tarih bazlı kurallar) | Bu modülün zorluğu vision ya da matematik değil, **durum yönetimi ve tetikleyici mantığı**: "15.000 KM veya 1 yıl, hangisi önce gelirse" gibi kurallar, çoklu koşullu alarmlar. Sistem tasarımı/mühendislik problemi. | Event bus ve tetikleyici mantığını **Sonnet 4.6 ile** tasarla (durum makinesi netliği gerektirir), rutin CRUD'u Flash'a bırak. |
| **Kütüphane** | OCR (barkod/ISBN + alıntı taraması) + ses-metin dönüşümü + basit istatistik (WPM hesaplama) | Diğer modüllere göre en düşük risk: barkod tanıma olgun bir problem, WPM formülü basit aritmetik. Asıl incelik kullanıcı deneyiminde (tahmin/ETA gösterimi). | Uçtan uca **Gemini 3.5 Flash** yeterli; bu modül paralel ajan / hızlı iterasyon için en uygun olanı. |
| **Sağlık** | Karmaşık multimodal analiz (tabak üzerindeki örtüşen/karışık besinleri ayrıştırma) + beslenme bilgisi | Sistemin **en yüksek AI hata payına sahip** parçası — vision modelinin gerçek "besin bilgisi" gerektirmesi (pişirme yöntemi, gizli yağ/şeker vb.), diğer modüllerdeki OCR'dan çok daha belirsiz bir çıkarım. | Üretim + review'ı **iki farklı güçlü model** yap (örn. Gemini 3.1 Pro üretir, Sonnet 4.6 review eder) ve kullanıcı düzeltme formunu (bkz. blueprint §8.2) hafifletmek yerine sağlamlaştırmaya öncelik ver. |

**Genel ilke:** Bir modülde "model zayıf kaldı" hissi oluşursa önce bunun bir *model seçimi* sorunu mu yoksa *o modüle özgü mimari* sorunu mu olduğunu ayır — Araç & Ev modülündeki zorluklar güçlü bir modelle değil, doğru durum makinesi tasarımıyla çözülür; Sağlık modülündeki zorluklar ise gerçekten model/vision kalitesiyle ilgilidir.

## Antigravity içinde model/araç seçim rehberi

Bu proje **Google Antigravity 2.0** üzerinde geliştirilecek. Antigravity, Agent Manager üzerinden çoklu model çalıştırmayı destekliyor: **Gemini 3.1 Pro**, **Gemini 3.5 Flash**, **Claude Sonnet 4.6**, **Claude Opus 4.6**, **GPT-OSS-120B** — ayrıca dahili Chrome tarayıcı ile görsel doğrulama, paralel ajan çalıştırma (Agent Manager'da eşzamanlı 5 ajana kadar), CLI ve SDK sunuyor. Kod/özellik önerirken hangi görev için hangi model/mod uygun, aşağıdaki tabloya göre belirt — kullanıcıya "bunu Antigravity'de X modeliyle çalıştır" şeklinde net yönlendirme yap.

**Seçim mantığı:** Derin mimari/doğruluk kritik kararlar → yavaş ama güçlü akıl yürütme modelleri (Opus 4.6, Gemini 3.1 Pro). Hacimli, tekrarlayan, düşük riskli üretim → hızlı/ucuz modeller (Gemini 3.5 Flash, GPT-OSS-120B). Görsel doğrulama gereken UI işleri → Antigravity'nin dahili tarayıcı ajanı + hızlı model kombosu.

| Aşama / Görev Türü | Önerilen Model / Mod | Neden |
|---|---|---|
| **Mimari tasarım kararları** (event bus şeması, veri modeli, offline sync stratejisi, DB şeması) | **Claude Opus 4.6** veya **Gemini 3.1 Pro** (tekli, derin düşünme modu — paralel ajan değil) | Bu kararlar sonradan pahalıya değiştirilir; hız değil doğruluk öncelikli. Tek ajanla, adım adım onaylatarak ilerle. |
| **Faz 1: Bütçe modülü — CRUD/boilerplate kod** (form bileşenleri, API endpoint iskeleleri, standart React/Next.js parçaları) | **Gemini 3.5 Flash** | Antigravity'de 4-12x daha hızlı; tekrarlayan, düşük riskli kod için doğruluk kaybı kabul edilebilir düzeyde. |
| **AI Vision doğrulama akışı** (fiş/fatura OCR sonrası kullanıcı onay formu, hata payı yüksek kısım) | **Claude Sonnet 4.6** veya **Opus 4.6**, kod yazıldıktan sonra ayrıca **Sonnet 4.6 ile code review** | Bu akışın güvenilirliği kritik (bkz. skill'in "AI Vision output asla otomatik commit edilmez" prensibi); üretimi hızlı modelle yap, doğrulamayı güçlü modelle yap. |
| **Finansal hesaplama motorları** (taksit bölme, TÜFE kira artış hesaplayıcı, WPM/okuma hızı formülü, net worth hesabı) | **Claude Opus 4.6** veya **Gemini 3.1 Pro** | Sayısal/mantıksal doğruluk hatası doğrudan kullanıcı parasını etkiler; en güçlü model ile yaz, ayrıca birim testle doğrula. |
| **Dual-ledger / event bus entegrasyon kodu** (Faz 2 — araç faturası hem araca hem bütçeye yazma) | **Claude Sonnet 4.6** (üretim) + mutlaka **Sonnet 4.6 veya Opus 4.6 ile ayrı review turu** | Çapraz modül tutarlılığı hataya en açık alan; üretim ve review'ı aynı ajanın tek geçişte yapmasına güvenme. |
| **UI/UX işleri — PWA kamera ekranı, dashboard, checklist formları** (görsel doğrulama gerektiren işler) | **Gemini 3.5 Flash + Antigravity'nin dahili Chrome tarayıcı ajanı** (ekran görüntüsü/kayıt ile doğrulama) | Antigravity'nin özgün gücü burada: ajan kendi yazdığı UI'ı tarayıcıda açıp görsel olarak doğrulayabiliyor. |
| **Dış API entegrasyonları** (TEFAS, KAP, BIST, döviz/altın/kripto fiyat çekme) | **Gemini 3.5 Flash** (üretim), riskli/kırılgan scraping kodu için **Sonnet 4.6 ile review** | Bkz. skill checklist'i: resmi API yoksa scraping bakım yükü taşır; en azından review'ı güçlü modelle yap. |
| **Faz 3 — Kütüphane/ISBN barkod, düşük riskli modüller** | **Gemini 3.5 Flash**, paralel ajan (Agent Manager, birden fazla görevi eşzamanlı) kullanılabilir | Düşük risk, düşük karmaşıklık; paralelleştirmeden en çok burada faydalanılır. |
| **Faz 4 — Multi-domain voice agent** (tek ses kaydından çoklu modüle parse) | Tasarım: **Claude Opus 4.6** (parse mantığı ve hata/onay akışı tasarımı) → Üretim: **Gemini 3.5 Flash** | En kırılgan özellik; mantık tasarımını güçlü modelle yap, kullanıcıya "işlenen kayıtları onayla" ekranını da aynı yüksek titizlikle incelet. |
| **Disaster recovery / yedekleme otomasyonu betikleri** | **Sonnet 4.6** veya **Gemini 3.1 Pro** | Sessiz veri kaybına yol açabilecek script'ler; hız yerine dikkatli, açıklamalı kod önceliklidir. |
| **Uzun süren, gözetimsiz arka plan görevleri** (örn. bir modülün tüm iskeletini tek seferde kurmak) | **GPT-OSS-120B** veya **Gemini 3.5 Flash**, Agent Manager'da arka planda zamanlanmış görev olarak | Maliyet/hız öncelikli, düşük-orta risk; ama çıktısı mutlaka insan + ayrı bir review modeliyle kontrol edilmeli. |
| **Hızlı prototipleme / erken fikir denemeleri** | **Google AI Studio**'da vibe-code, olgunlaşınca Antigravity'ye export | Antigravity'nin kendi export akışı bunun için var; olgunlaşmamış fikirleri doğrudan ana kod tabanında denemeye gerek yok. |

**Genel kural:** Üretimi yapan model ile review'ı yapan model **farklı bir aile** olsun (örn. Gemini ile üret, Claude ile review et ya da tersi) — özellikle finansal/kritik kod yollarında (taksit motoru, dual-ledger, disaster recovery). Aynı modelin kendi hatasını görme olasılığı, farklı bir modelin görme olasılığından düşüktür.

## 🛑 Hata ve Düzeltme İş Akışı Talimatı (Mandatory User Approval Protocol)

Kullanıcı herhangi bir **hata, düzeltme veya revizyon** bildirdiğinde aşağıdaki protokol KESİNLİKLE uygulanacaktır:

1. **Önce Açıkla & Onay Bekle:** Kullanıcıdan bir hata, düzeltme veya revizyon isteği geldiğinde, KESİNLİKLE doğrudan kod değişikliğine başlanmayacak veya komut çalıştırılmayacaktır. Yapılacak tüm işlemler, kök neden analizi ve çözüm adımları detaylıca kullanıcıya açıklanacak ve kullanıcının **açık onayı (örneğin "devam et", "onaylıyorum")** beklenecektir.
2. **Revizyon Gelirse Planı Yeniden Yaz:** Kullanıcı sunulan çözüm planına veya öneriye bir düzeltme/ek talimat verirse, yapılcak işlemlerin TAMAMI yeni talimatlar doğrultusunda sıfırdan yeniden yazılacak ve **tekrar onay** beklenecektir.
3. **Onay Alınmadan Asla Kod/Dosya Değiştirilmeyecektir:** Kullanıcının açık onayı gelmeden hiçbir dosya düzenleme, kod değiştirme veya terminal komutu yürütme aracı çağrılmayacaktır.

## Reference files

- `references/blueprint.md` — Full v2 project blueprint (Turkish). Contains complete module specs (data fields, business rules, UI copy), the full risk-note annotations, and the phase roadmap in detail. Read this when you need specifics beyond the summary above — e.g. exact MTV takvimi, TÜFE kira artış hesaplayıcı mantığı, WPM okuma hızı formülü, or the full cross-module synergy list (§9.1).

