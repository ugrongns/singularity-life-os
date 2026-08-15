'use client';
import { useState, useRef } from 'react';

interface PlateScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function PlateScanModal({ isOpen, onClose, onSuccess }: PlateScanModalProps) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'confirm'>('upload');
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [parsedPlate, setParsedPlate] = useState<{
    name: string;
    meal_type: string;
    base_calories: number;
    base_protein: number;
    base_carbs: number;
    base_fat: number;
    confidence?: number;
    items?: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number }>;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setStep('scanning');

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      // Convert to base64
      const base64 = await fileToBase64(file);
      const mimeType = file.type || 'image/jpeg';

      const res = await fetch('/api/health/scan-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'plate', base64, mimeType })
      });

      const json = await res.json();
      if (json.success && json.data) {
        setParsedPlate(json.data);
        setMultiplier(1.0);
        setStep('confirm');
      } else {
        throw new Error(json.error || 'Analiz başarısız');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Görsel analiz edilemedi. Tekrar deneyin.');
      setStep('upload');
    }
  };

  const handleDemoScan = async () => {
    setStep('scanning');
    setErrorMsg(null);
    setPreviewUrl(null);

    try {
      const res = await fetch('/api/health/scan-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'plate' })
      });
      const json = await res.json();
      if (json.success && json.data) {
        setParsedPlate(json.data);
        setMultiplier(1.0);
        setStep('confirm');
      } else {
        throw new Error(json.error || 'Demo analiz başarısız');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep('upload');
    }
  };

  const handleSaveMeal = async () => {
    if (!parsedPlate) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/health/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_meal',
          name: parsedPlate.name,
          meal_type: parsedPlate.meal_type,
          base_calories: Math.round(parsedPlate.base_calories * multiplier),
          base_protein: Math.round(parsedPlate.base_protein * multiplier),
          base_carbs: Math.round(parsedPlate.base_carbs * multiplier),
          base_fat: Math.round(parsedPlate.base_fat * multiplier),
          portion_multiplier: multiplier
        })
      });
      const json = await res.json();
      if (json.success) {
        onSuccess(json.message || `✅ ${parsedPlate.name} beslenmeye eklendi!`);
        handleClose();
      }
    } catch (err) {
      setErrorMsg('Öğün kaydedilemedi. Tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setPreviewUrl(null);
    setParsedPlate(null);
    setErrorMsg(null);
    setMultiplier(1.0);
    onClose();
  };

  // Dinamik Çarpanlı Makrolar
  const currentCalories = parsedPlate ? Math.round(parsedPlate.base_calories * multiplier) : 0;
  const currentProtein = parsedPlate ? Math.round(parsedPlate.base_protein * multiplier) : 0;
  const currentCarbs = parsedPlate ? Math.round(parsedPlate.base_carbs * multiplier) : 0;
  const currentFat = parsedPlate ? Math.round(parsedPlate.base_fat * multiplier) : 0;
  const confidencePct = parsedPlate?.confidence ? Math.round(parsedPlate.confidence * 100) : null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="sheet-handle"></div>

        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>📸 Yemek Tabağını Tara</div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Yemek tabağınızın fotoğrafını çekin; yapay zeka porsiyonu, kaloriyi ve makroları otomatik hesaplayacaktır.
            </p>

            {errorMsg && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px', color: '#DC2626' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <button className="btn-primary" onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span>📷</span>
              <span>Kamerayı Aç & Tabağı Çek</span>
            </button>

            {/* Galeriden fotoğraf seç */}
            <input
              type="file"
              accept="image/*"
              id="gallery-input"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button className="btn-secondary" onClick={() => (document.getElementById('gallery-input') as HTMLInputElement)?.click()}>
              🖼️ Galeriden Seç
            </button>

            <button className="btn-secondary" onClick={handleDemoScan}>
              ⚡ Demo Mod (AI Simülasyonu)
            </button>
          </div>
        )}

        {step === 'scanning' && (
          <div style={{ textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            {previewUrl && (
              <img src={previewUrl} alt="Tabak önizleme" style={{ width: '160px', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-md)', opacity: 0.7 }} />
            )}
            <div style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>🧠</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Yapay Zeka Tabağı Analiz Ediyor...</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Besin öğeleri, gramajlar ve makrolar ayrıştırılıyor</div>
          </div>
        )}

        {step === 'confirm' && parsedPlate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>🍽️ Tabak Analizi (Onay & Porsiyon)</div>
              {confidencePct && (
                <span style={{ fontSize: '11px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '3px 8px', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
                  AI %{confidencePct} Güven
                </span>
              )}
            </div>

            {/* Önizleme fotoğrafı */}
            {previewUrl && (
              <img src={previewUrl} alt="Taranan tabak" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
            )}

            {/* Yemek Başlığı & Kalori */}
            <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <input
                  type="text"
                  value={parsedPlate.name}
                  onChange={e => setParsedPlate({ ...parsedPlate, name: e.target.value })}
                  style={{ fontWeight: 700, fontSize: '15px', border: 'none', background: 'transparent', outline: 'none' }}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {parsedPlate.meal_type === 'breakfast' ? 'Kahvaltı' : parsedPlate.meal_type === 'lunch' ? 'Öğle' : parsedPlate.meal_type === 'dinner' ? 'Akşam' : 'Ara Öğün'}
                </div>
              </div>
              <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--emerald)' }}>
                {currentCalories} <span style={{ fontSize: '12px', fontWeight: 600 }}>kcal</span>
              </div>
            </div>

            {/* Tespit edilen yiyecekler */}
            {parsedPlate.items && parsedPlate.items.length > 0 && (
              <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', padding: '8px 12px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Tespit Edilen Yiyecekler
                </div>
                {parsedPlate.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                    <span style={{ fontSize: '12px' }}>{item.name}</span>
                    <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--emerald)' }}>{item.calories} kcal</span>
                  </div>
                ))}
              </div>
            )}

            {/* İnteraktif Porsiyon Ayarlayıcı */}
            <div style={{ background: '#EFF6FF', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E40AF' }}>⚖️ Porsiyon Büyüklüğü:</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#2563EB' }}>{multiplier}x Porsiyon</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[0.5, 1.0, 1.5, 2.0].map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`choice-pill ${multiplier === m ? 'selected' : ''}`}
                    onClick={() => setMultiplier(m)}
                    style={{ padding: '6px', fontSize: '12px' }}
                  >
                    {m}x {m === 0.5 ? '(Yarım)' : m === 1.0 ? '(Tam)' : m === 1.5 ? '(1.5x)' : '(Çift)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Dinamik Makro Değerleri */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <div style={{ background: 'var(--surface-subtle)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Protein</div>
                <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 700, color: '#3B82F6' }}>{currentProtein}g</div>
              </div>
              <div style={{ background: 'var(--surface-subtle)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Karb</div>
                <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 700, color: '#F59E0B' }}>{currentCarbs}g</div>
              </div>
              <div style={{ background: 'var(--surface-subtle)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Yağ</div>
                <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 700, color: '#EC4899' }}>{currentFat}g</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" onClick={() => setStep('upload')} style={{ flex: '0 0 auto' }}>
                ← Yeniden Tara
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveMeal}
                disabled={isSubmitting}
                style={{ flex: 1 }}
              >
                {isSubmitting ? 'Kaydediliyor...' : '✅ Onayla ve Beslenmeye Ekle'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Utility: File → base64 string
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
