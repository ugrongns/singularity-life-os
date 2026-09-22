'use client';
import { useState, useRef } from 'react';

interface PageCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId?: string;
  bookTitle?: string;
  currentWordsPerPage?: number;
  onCalibrated: (newWordsPerPage: number) => void;
  onSuccess?: (msg: string) => void;
}

export default function PageCalibrationModal({
  isOpen,
  onClose,
  bookId,
  bookTitle,
  currentWordsPerPage = 250,
  onCalibrated,
  onSuccess
}: PageCalibrationModalProps) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'confirm'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [calibratedCount, setCalibratedCount] = useState<number>(currentWordsPerPage);
  const [sampleText, setSampleText] = useState<string>('');
  const [fullText, setFullText] = useState<string>('');
  const [showFullText, setShowFullText] = useState<boolean>(false);
  const [isLowConfidence, setIsLowConfidence] = useState<boolean>(false);
  const [unreadableCount, setUnreadableCount] = useState<number>(0);
  const [detectedModel, setDetectedModel] = useState<string>('gemini-3.5-flash');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setStep('scanning');

    // Önizleme URL'i oluştur
    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);

    try {
      // Vercel 4.5 MB kısıtına karşı istemci tarafı Canvas sıkıştırma
      const base64Data = await compressImage(file);

      const res = await fetch('/api/library/scan-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64Data,
          mime_type: 'image/jpeg'
        })
      });

      if (!res.ok) {
        if (res.status === 413) {
          throw new Error('Görsel boyutu çok yüksek. Lütfen tekrar deneyin.');
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Sunucu hatası (${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        const count = json.data.word_count || 250;
        setCalibratedCount(count);
        setSampleText(json.data.sample_text || '');
        setFullText(json.data.full_text || '');
        setIsLowConfidence(Boolean(json.is_low_confidence));
        setUnreadableCount(json.unreadable_count || 0);
        setDetectedModel(json.source === 'ai' ? 'Gemini 3.5 Flash' : 'Standart Heuristic');
        setStep('confirm');
      } else {
        throw new Error(json.error || 'Sayfa analizi başarısız oldu.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Sayfa fotoğrafı okunamadı. Lütfen ışığın iyi olduğu bir ortamda tekrar deneyin.');
      setStep('upload');
    }
  };

  const handleApplyCalibration = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const finalCount = Math.max(50, Math.min(1000, Number(calibratedCount) || 250));

      if (bookId) {
        const res = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_words_per_page',
            book_id: bookId,
            words_per_page: finalCount
          })
        });

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Kalibrasyon kaydedilemedi.');
        }
      }

      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      onCalibrated(finalCount);
      if (onSuccess) {
        onSuccess(`🎯 "${bookTitle || 'Kitap'}" için sayfa yoğunluğu ${finalCount} kelime/sayfa olarak kalibre edildi!`);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Kaydetme işlemi başarısız.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDensityBadge = (count: number) => {
    if (count < 220) return { label: 'Geniş Dizgi / Seyrek Metin', color: 'var(--blue)' };
    if (count <= 280) return { label: 'Standart Edebi Metin', color: 'var(--emerald)' };
    if (count <= 350) return { label: 'Yoğun Metin / İnce Punto', color: 'var(--amber)' };
    return { label: 'Çok Yoğun / Çift Sütun / Akademik', color: 'var(--indigo)' };
  };

  const density = getDensityBadge(calibratedCount);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="bottom-sheet"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div className="sheet-handle"></div>

        {/* Modal Başlık */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔬</span>
              <span>Sayfa Kelime Kalibrasyonu</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {bookTitle ? `"${bookTitle}" için hassas WPM & ETA motoru` : 'Hassas okuma hızı (WPM) ve bitiş süresi hesabı'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* AŞAMA 1: YÜKLEME & ÇEKME */}
        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              📖 <strong>Nasıl Çalışır?</strong> Kitabınızın tam dolu standart 1 sayfasının fotoğrafını çekin. 
              Yapay zekâ (Gemini OCR) sayfadaki tüm kelimeleri sayarak o kitaba özel net sayfa yoğunluğunu hesaplar. Böylece okuma seanslarınızdaki <strong>WPM (Dakikada Kelime)</strong> ve <strong>Kalan Süre (ETA)</strong> tahminleriniz milimetrik doğrulanır.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-subtle)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Mevcut Ayarlı Yoğunluk:</span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--indigo)' }}>⚡ {currentWordsPerPage} kelime/sayfa</span>
            </div>

            {/* Yükleme Butonu & Alanı */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--indigo)',
                borderRadius: 'var(--radius-lg)',
                padding: '30px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--indigo-bg)',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <div style={{ fontSize: '36px' }}>📸</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--indigo)' }}>
                Sayfa Fotoğrafı Çek veya Seç
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '300px' }}>
                Standart, paragraflarla dolu bir sayfayı kameraya düz tutarak çekin.
              </div>
            </div>

            {/* Hızlı Manuel Şablonlar */}
            <div style={{ marginTop: '4px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                VEYA STANDART ŞABLONLARDAN BİRİNİ SEÇİN:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'Seyrek / Büyük Punto', count: 200 },
                  { label: 'Standart Roman (Varsayılan)', count: 250 },
                  { label: 'Yoğun Edebi / Felsefe', count: 300 },
                  { label: 'Akademik / İnce Punto', count: 350 }
                ].map(preset => (
                  <button
                    key={preset.count}
                    type="button"
                    onClick={() => {
                      setCalibratedCount(preset.count);
                      setSampleText('Manuel şablon seçimi yapıldı.');
                      setFullText('');
                      setIsLowConfidence(false);
                      setUnreadableCount(0);
                      setStep('confirm');
                    }}
                    style={{
                      padding: '8px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-subtle)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div>{preset.label}</div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--indigo)', marginTop: '2px' }}>
                      {preset.count} kelime
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AŞAMA 2: AI TARAMA & ANALİZ SÜRÜYOR */}
        {step === 'scanning' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 16px', textAlign: 'center', gap: '14px' }}>
            <div className="spinner" style={{ width: '42px', height: '42px', border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Taranan sayfa"
                style={{ width: '70px', height: '95px', objectFit: 'cover', borderRadius: '6px', opacity: 0.7, border: '1px solid var(--indigo)' }}
              />
            )}
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                Gemini AI Sayfayı İnceliyor...
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Metin transkribe ediliyor ve kelimeler tek tek sayılıyor.
              </div>
            </div>
          </div>
        )}

        {/* AŞAMA 3: KULLANICI ONAY & DÜZENLEME FORMU (Non-negotiable AI Vision Prensibi) */}
        {step === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Önizleme Kartı */}
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Önizleme"
                  style={{ width: '55px', height: '75px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, border: '1px solid var(--border)' }}
                />
              ) : (
                <div style={{ width: '55px', height: '75px', background: 'var(--indigo-bg)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
                  📄
                </div>
              )}

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', background: isLowConfidence ? 'var(--amber-bg)' : 'var(--emerald-bg)', color: isLowConfidence ? 'var(--amber)' : 'var(--emerald)', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                    {isLowConfidence ? '⚠️ Düşük Güvenilirlik' : '✅ Yüksek Güvenilirlik'}
                  </span>
                  <span style={{ fontSize: '10px', color: density.color, fontWeight: 700 }}>
                    • {density.label}
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Model: <strong>{detectedModel}</strong> {unreadableCount > 0 ? `(${unreadableCount} okunamayan kelime)` : ''}
                </div>
              </div>
            </div>

            {/* Kelime Sayısı Ayarlama / Onaylama Alanı */}
            <div style={{ background: 'var(--indigo-bg)', border: '1px solid var(--indigo)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--indigo)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                HESAPLANAN SAYFA BAŞI KELİME
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCalibratedCount(prev => Math.max(50, prev - 10))}
                  style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--indigo)', background: 'var(--surface)', fontSize: '16px', fontWeight: 800, cursor: 'pointer', color: 'var(--indigo)' }}
                >
                  -10
                </button>

                <input
                  type="number"
                  min={50}
                  max={1000}
                  value={calibratedCount}
                  onChange={e => setCalibratedCount(parseInt(e.target.value) || 0)}
                  style={{
                    width: '110px',
                    textAlign: 'center',
                    fontSize: '24px',
                    fontWeight: 900,
                    padding: '6px 8px',
                    borderRadius: '8px',
                    border: '2px solid var(--indigo)',
                    background: 'var(--surface)',
                    color: 'var(--text-main)'
                  }}
                />

                <button
                  type="button"
                  onClick={() => setCalibratedCount(prev => Math.min(1000, prev + 10))}
                  style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--indigo)', background: 'var(--surface)', fontSize: '16px', fontWeight: 800, cursor: 'pointer', color: 'var(--indigo)' }}
                >
                  +10
                </button>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Kelime / Standart Sayfa
              </div>
            </div>

            {/* Metin Doğrulama Önizlemesi */}
            {sampleText && (
              <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    📖 OKUNAN İLK KELİMELER:
                  </span>
                  {fullText && (
                    <button
                      type="button"
                      onClick={() => setShowFullText(!showFullText)}
                      style={{ background: 'none', border: 'none', fontSize: '10px', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {showFullText ? 'Gizle' : 'Tümünü Gör'}
                    </button>
                  )}
                </div>

                <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-main)', marginTop: '4px', lineHeight: '1.4' }}>
                  "{sampleText}..."
                </div>

                {showFullText && fullText && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', fontSize: '11px', color: 'var(--text-muted)', maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {fullText}
                  </div>
                )}
              </div>
            )}

            {/* Butonlar */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep('upload')}
                style={{ flex: '0 0 auto', padding: '12px 14px' }}
              >
                🔄 Yeniden Çek
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleApplyCalibration}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '12px', fontSize: '14px', fontWeight: 800 }}
              >
                {isSubmitting ? 'Kaydediliyor...' : `✅ Bu Değeri Onayla (${calibratedCount} wpp)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Görsel Sıkıştırma Yardımcısı (Max 1600px, 0.85 kalite)
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX = 1600;
        if (width > height && width > MAX) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else if (height > MAX) {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
