'use client';
import { useState, useRef, useEffect } from 'react';

import NutrientProfileModal from '@/components/modals/NutrientProfileModal';

interface BarcodeScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function BarcodeScanModal({ isOpen, onClose, onSuccess }: BarcodeScanModalProps) {
  const [step, setStep] = useState<'upload' | 'live_camera' | 'scanning' | 'result'>('upload');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [isNutrientModalOpen, setIsNutrientModalOpen] = useState(false);
  const [selectedNutrientFood, setSelectedNutrientFood] = useState('');
  const [selectedNutrientProfile, setSelectedNutrientProfile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      stopLiveCamera();
    }
  }, [isOpen]);

  const stopLiveCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startLiveCamera = async () => {
    setStep('live_camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();

          // BarcodeDetector API kontrolü (Chrome / Safari / Edge Native Barcode API)
          if ('BarcodeDetector' in window) {
            const barcodeDetector = new (window as any).BarcodeDetector({
              formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code']
            });

            scanIntervalRef.current = setInterval(async () => {
              if (videoRef.current && videoRef.current.readyState === 4) {
                try {
                  const barcodes = await barcodeDetector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0) {
                    const code = barcodes[0].rawValue;
                    if (code) {
                      stopLiveCamera();
                      // Bip Sesi Çal
                      try {
                        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const osc = ctx.createOscillator();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(880, ctx.currentTime);
                        osc.connect(ctx.destination);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.15);
                      } catch (e) {}

                      handleManualScan(code);
                    }
                  }
                } catch (e) {}
              }
            }, 250);
          }
        }
      }, 300);
    } catch (err) {
      alert('Kameraya erişilemedi. Lütfen fotoğraf yükleme veya manuel barkod girişini kullanın.');
      setStep('upload');
    }
  };

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

    stopLiveCamera();
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

    stopLiveCamera();
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

  const handleDecision = async (decision: 'consumed' | 'rejected') => {
    if (decision === 'consumed') {
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
      if (result?.id) {
        try {
          await fetch(`/api/health/scan-food?id=${result.id}`, { method: 'DELETE' });
        } catch (e) {}
      }
      onSuccess(`🏆 Harika karar! "${result?.product_name}" tüketmekten vazgeçtiniz ve kaydı tamamen silindi.`);
    }

    onClose();
    setResult(null);
    setStep('upload');
  };

  return (
    <div className="modal-overlay" onClick={() => { stopLiveCamera(); onClose(); }}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="sheet-handle"></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>🏷️ Paketli Gıda & Pestisit / Katkı Analizi</div>
          <button type="button" onClick={() => { stopLiveCamera(); onClose(); }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Barkodu canlı kamerayla tutarak anında okutabilir veya ambalaj fotoğrafını çekebilirsiniz.
            </p>

            {/* Canlı Kamera Butonu */}
            <button
              type="button"
              className="btn-primary"
              onClick={startLiveCamera}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', fontWeight: 800 }}
            >
              <span>📹</span>
              <span>Canlı Kamera İle Tara (Bip Sesiyle Otomatik)</span>
            </button>

            {/* Fotoğraf Çek / Yükle */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />

            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '13px' }}
            >
              <span>📷</span>
              <span>Ambalaj / Etiket Fotoğrafı Çek</span>
            </button>

            <div style={{ position: 'relative', textAlign: 'center', margin: '4px 0' }}>
              <span style={{ background: 'var(--surface)', padding: '0 10px', fontSize: '11px', color: 'var(--text-muted)', position: 'relative', zIndex: 1 }}>veya barkod no girin</span>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--border)' }}></div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Barkod No (Örn: 8690158120143)"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                style={{ flex: 1, padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 700 }}
              />
              <button className="btn-primary" onClick={() => handleManualScan()} style={{ padding: '0 16px', fontSize: '13px', fontWeight: 800 }}>
                🔍 Sorgula
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
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
          </div>
        )}

        {/* Canlı Kamera Akışı */}
        {step === 'live_camera' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#000', minHeight: '260px' }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '260px', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', height: '120px', border: '2px dashed #10B981', borderRadius: '12px', boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.4)', pointerEvents: 'none' }}>
                <div style={{ width: '100%', height: '2px', background: '#10B981', position: 'absolute', top: '50%', boxShadow: '0 0 8px #10B981' }}></div>
              </div>
            </div>

            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
              🎯 Barkodu yeşil çerçevenin ortasına getirin...
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Otomatik algılandığında Bip sesiyle ürün analizi açılacaktır.
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => { stopLiveCamera(); setStep('upload'); }}
              style={{ padding: '8px 16px', fontSize: '12px' }}
            >
              ← Vazgeç / Manuel Giriş
            </button>
          </div>
        )}

        {step === 'scanning' && (
          <div style={{ textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>🧠</div>
            <div style={{ fontSize: '16px', fontWeight: 800 }}>Yapay Zeka & Biyo-Toksikoloji İncelemesi...</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Open Food Facts veritabanı ve Gemini AI toksikoloji motoru taranıyor</div>
          </div>
        )}

        {step === 'result' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>{result.product_name}</div>
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
              <div style={{ fontSize: '12px', fontWeight: 800, color: result.health_score >= 70 ? '#065F46' : '#991B1B' }}>
                🧪 Katkı Maddeleri & E-Kodları:
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                {result.additives_detected}
              </div>
            </div>

            {/* Pestisit Değerlendirmesi */}
            <div style={{ background: 'var(--surface-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>🌱 Pestisit & Kimyasal Kalıntı Riski:</div>
              <div style={{ fontSize: '12px', marginTop: '2px', lineHeight: 1.4 }}>{result.pesticide_risk_summary}</div>
            </div>

            {/* Temiz Alternatif Önerisi */}
            <div style={{ background: '#EFF6FF', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#1E40AF' }}>💡 Sağlıklı Alternatif Tavsiyesi:</div>
              <div style={{ fontSize: '12px', color: '#1E3A8A', marginTop: '2px', lineHeight: 1.4 }}>{result.alternative_suggestions}</div>
            </div>

            {/* 360° Vitamin & Mineral Profil Dökümü Butonu */}
            <button
              type="button"
              onClick={() => {
                setSelectedNutrientFood(result.product_name);
                setSelectedNutrientProfile(result.micronutrient_profile || null);
                setIsNutrientModalOpen(true);
              }}
              style={{
                padding: '10px 12px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#10B981',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>🔬</span>
              <span>360° Detaylı Vitamin & Mineral Karnesini Gör ➔</span>
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginTop: '4px' }}>
              <button
                className="btn-primary"
                onClick={() => handleDecision('consumed')}
                style={{ padding: '10px', fontSize: '12px', fontWeight: 800 }}
              >
                ➕ Günlük Beslenmeme Ekle
              </button>
              <button
                className="btn-secondary"
                onClick={() => handleDecision('rejected')}
                style={{ padding: '10px', fontSize: '12px', color: 'var(--rose)', fontWeight: 800 }}
              >
                ❌ Tüketmekten Vazgeç
              </button>
            </div>
          </div>
        )}
      </div>

      <NutrientProfileModal
        isOpen={isNutrientModalOpen}
        onClose={() => setIsNutrientModalOpen(false)}
        initialFoodName={selectedNutrientFood}
        initialGrams={100}
        initialProfile={selectedNutrientProfile}
        onSuccess={onSuccess}
      />
    </div>
  );
}
