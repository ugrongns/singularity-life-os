'use client';
import { useState, useRef } from 'react';

interface BarcodeScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function BarcodeScanModal({ isOpen, onClose, onSuccess }: BarcodeScanModalProps) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'result'>('upload');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX = 1800;
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
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep('scanning');
    try {
      const compressedBase64 = await compressImage(file);
      const res = await fetch('/api/health/scan-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'packaged_barcode',
          base64: compressedBase64,
          mimeType: 'image/jpeg'
        })
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setStep('result');
      } else {
        alert(json.error || 'Görsel analizi başarısız.');
        setStep('upload');
      }
    } catch (err) {
      alert('Görsel analizi başarısız.');
      setStep('upload');
    }
  };

  const handleManualScan = async (barcodeVal?: string) => {
    const targetBarcode = barcodeVal || barcodeInput.trim();
    if (!targetBarcode) {
      alert('Lütfen sorgulamak istediğiniz barkod numarasını girin.');
      return;
    }

    setStep('scanning');
    try {
      const res = await fetch('/api/health/scan-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'packaged_barcode',
          barcode_text: targetBarcode
        })
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setStep('result');
      } else {
        alert(json.error || 'Barkod analizi başarısız.');
        setStep('upload');
      }
    } catch (err) {
      alert('Barkod analizi başarısız.');
      setStep('upload');
    }
  };

  // Blueprint 8.6 Karar Butonları:
  const handleDecision = async (decision: 'consumed' | 'rejected') => {
    if (decision === 'consumed') {
      // Beslenmeye Ekle
      try {
        await fetch('/api/health/nutrition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: result.product_name,
            meal_type: 'snack',
            base_calories: result.health_score >= 70 ? 180 : 350,
            base_protein: result.health_score >= 70 ? 8 : 3,
            base_carbs: result.health_score >= 70 ? 25 : 48,
            base_fat: result.health_score >= 70 ? 4 : 16,
            portion_multiplier: 1.0
          })
        });
      } catch (e) {}
      onSuccess(`🥗 "${result?.product_name}" günlük beslenmenize başarıyla eklendi!`);
    } else {
      // Tüketmekten Vazgeçildi (Sağlıklı Karar)
      onSuccess(`🏆 Harika karar! Zararlı katkı/işlenmişlik sebebiyle "${result?.product_name}" tüketmekten vazgeçtiniz.`);
    }

    onClose();
    setResult(null);
    setStep('upload');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="sheet-handle"></div>
        <div style={{ fontSize: '17px', fontWeight: 700 }}>🏷️ Paketli Gıda & Pestisit / Katkı Analizi</div>

        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Paketli gıdanın barkodunu veya arkasındaki içerik/içindekiler tablosunu kameranızla çekin.
            </p>

            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
            />

            <button 
              className="btn-primary" 
              onClick={() => fileInputRef.current?.click()} 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px' }}
            >
              <span>📷</span>
              <span>Kamerayı Aç & Barkodu / İçeriği Çek</span>
            </button>

            <div style={{ position: 'relative', textAlign: 'center', margin: '4px 0' }}>
              <span style={{ background: 'white', padding: '0 10px', fontSize: '11px', color: 'var(--text-muted)', position: 'relative', zIndex: 1 }}>veya barkod no ile ara</span>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--border)' }}></div>
            </div>

            <div>
              <input 
                type="text" 
                placeholder="Barkod No (Örn: 869055512348)"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => handleManualScan('869055512348')}
                style={{ fontSize: '11px', padding: '8px' }}
              >
                🧪 Örnek Temiz Gıda Testi
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => handleManualScan('869055512341')}
                style={{ fontSize: '11px', padding: '8px' }}
              >
                🧪 Örnek Riskli Gıda Testi
              </button>
            </div>

            {barcodeInput && (
              <button className="btn-primary" onClick={() => handleManualScan()}>
                🔍 Barkodu Sorgula
              </button>
            )}
          </div>
        )}

        {step === 'scanning' && (
          <div style={{ textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>🧠</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Yapay Zeka Barkod & İçerik Tablosunu İnceliyor...</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>E-kodları, palm yağı, koruyucular ve pestisit kalıntı riski taranıyor</div>
          </div>
        )}

        {step === 'result' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>{result.product_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{result.brand} • Barkod: {result.barcode}</div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span 
                  style={{ 
                    background: result.health_score >= 70 ? 'var(--emerald-bg)' : 'var(--rose-bg)', 
                    color: result.health_score >= 70 ? 'var(--emerald)' : 'var(--rose)',
                    fontSize: '16px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)'
                  }}
                >
                  {result.health_score} / 100
                </span>
              </div>
            </div>

            {/* Katkı Maddeleri ve Riskler */}
            <div style={{ background: result.health_score >= 70 ? '#ECFDF5' : '#FEF2F2', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: result.health_score >= 70 ? '#065F46' : '#991B1B' }}>
                🧪 Katkı Maddeleri & E-Kodları:
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.4 }}>
                {result.additives_detected}
              </div>
            </div>

            {/* Pestisit Değerlendirmesi */}
            <div style={{ background: 'var(--surface-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>🌱 Pestisit & Kimyasal Kalıntı Riski:</div>
              <div style={{ fontSize: '12px', marginTop: '2px' }}>{result.pesticide_risk_summary}</div>
            </div>

            {/* Temiz Alternatif Önerisi */}
            <div style={{ background: '#EFF6FF', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF' }}>💡 Sağlıklı Alternatif Tavsiyesi:</div>
              <div style={{ fontSize: '12px', color: '#1E3A8A', marginTop: '2px' }}>{result.alternative_suggestions}</div>
            </div>

            {/* Blueprint 8.6 Karar Butonları */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginTop: '4px' }}>
              <button 
                className="btn-primary" 
                onClick={() => handleDecision('consumed')}
                style={{ padding: '10px', fontSize: '12px' }}
              >
                ➕ Günlük Beslenmeme Ekle
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => handleDecision('rejected')}
                style={{ padding: '10px', fontSize: '12px', color: 'var(--rose)' }}
              >
                ❌ Tüketmekten Vazgeç
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
