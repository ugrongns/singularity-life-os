'use client';

import React, { useState, useRef } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Zap,
  Check,
  X,
  Sliders,
  Sparkles,
  ArrowLeft,
  Flame
} from 'lucide-react';

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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setStep('scanning');

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const base64 = await compressImage(file);
      const mimeType = 'image/jpeg';

      const res = await fetch('/api/health/scan-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'plate', base64, mimeType })
      });

      if (!res.ok) {
        if (res.status === 413) {
          throw new Error('Görsel boyutu çok yüksek. Lütfen tekrar deneyin.');
        }
        const text = await res.text();
        try {
          const errJson = JSON.parse(text);
          throw new Error(errJson.error || `Sunucu hatası (${res.status})`);
        } catch {
          throw new Error(`Sunucu yanıt vermedi (${res.status}). Lütfen tekrar deneyin.`);
        }
      }

      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.confidence <= 0.15 && json.data.base_calories === 0 && !json.data.name) {
          throw new Error('Görseldeki tabak analiz edilemedi. Lütfen fotoğrafı daha net ve aydınlık bir ortamda çekip tekrar deneyin.');
        }
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
          meal_type: parsedPlate.meal_type || 'lunch',
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
      <div
        className="bottom-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        <div className="sheet-handle" style={{ margin: '8px auto 4px' }} />

        {/* Modal Üst Barı */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px 12px',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {step === 'confirm' ? 'Tabak Analizi & Porsiyon' : 'Yemek Tabağını Tara'}
              </h3>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                AI Vision Biyometrik Porsiyonlama
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Gövdesi */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {/* 1. ADIM: YÜKLEME / KAMERA AÇILIŞI */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 6px' }}>
                Yemek tabağınızın fotoğrafını çekin; yapay zeka porsiyonu, gramajı ve makroları otomatik hesaplasın.
              </p>

              {errorMsg && (
                <div
                  style={{
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: '#F43F5E',
                    textAlign: 'left'
                  }}
                >
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Kamera Girişi */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={cameraInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {/* Galeri Girişi */}
              <input
                type="file"
                accept="image/*"
                ref={galleryInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {/* Mobil Tek Elle Başparmak Alanı Butonları */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => cameraInputRef.current?.click()}
                  style={{
                    padding: '14px',
                    fontSize: '14px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                    borderRadius: '10px'
                  }}
                >
                  <Camera className="w-5 h-5" />
                  <span>Kamerayı Aç & Tabağı Çek</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => galleryInputRef.current?.click()}
                  style={{
                    padding: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '10px'
                  }}
                >
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                  <span>Fotoğraf Galerisinden Seç</span>
                </button>

                <button
                  type="button"
                  className="btn-subtle"
                  onClick={handleDemoScan}
                  style={{
                    padding: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    color: 'var(--text-muted)'
                  }}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>⚡ Demo Mod (AI Örnek Tabak Simülasyonu)</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. ADIM: AI TARAMA VE ANALİZ DURUMU */}
          {step === 'scanning' && (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              {previewUrl && (
                <div style={{ position: 'relative', width: '160px', height: '120px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img
                    src={previewUrl}
                    alt="Tabak önizleme"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: 'rgba(99, 102, 241, 0.25)',
                      backdropFilter: 'blur(1px)'
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: '#6366F1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 1.5s infinite ease-in-out'
                }}
              >
                <Sparkles className="w-6 h-6 animate-spin text-indigo-500" />
              </div>

              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Yapay Zeka Tabağı Analiz Ediyor...
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Besin öğeleri, gramajlar ve biyometrik makrolar ayrıştırılıyor.
                </div>
              </div>
            </div>
          )}

          {/* 3. ADIM: ONAY & PORSİYON DÜZELTME SLIDER'I */}
          {step === 'confirm' && parsedPlate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Fotoğraf ve Başlık Bento Kartı */}
              <div
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center'
                }}
              >
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Taranan tabak"
                    style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="text"
                    value={parsedPlate.name}
                    onChange={e => setParsedPlate({ ...parsedPlate, name: e.target.value })}
                    style={{
                      width: '100%',
                      fontWeight: 800,
                      fontSize: '15px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      outline: 'none',
                      padding: 0
                    }}
                  />

                  {/* Öğün Türü Seçici */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    {[
                      { key: 'breakfast', label: 'Kahvaltı' },
                      { key: 'lunch', label: 'Öğle' },
                      { key: 'dinner', label: 'Akşam' },
                      { key: 'snack', label: 'Ara Öğün' }
                    ].map(type => (
                      <button
                        key={type.key}
                        type="button"
                        onClick={() => setParsedPlate({ ...parsedPlate, meal_type: type.key })}
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: parsedPlate.meal_type === type.key ? 'var(--blue)' : 'var(--surface)',
                          color: parsedPlate.meal_type === type.key ? '#fff' : 'var(--text-muted)'
                        }}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: '#10B981' }}>
                    {currentCalories}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>kcal</div>
                </div>
              </div>

              {/* Tespit Edilen Malzemeler */}
              {parsedPlate.items && parsedPlate.items.length > 0 && (
                <div
                  style={{
                    backgroundColor: 'var(--surface-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px'
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Tespit Edilen Besin Kalemleri
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {parsedPlate.items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '11px',
                          color: 'var(--text-main)'
                        }}
                      >
                        <span>{item.name}</span>
                        <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          {Math.round(item.calories * multiplier)} kcal
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dinamik Porsiyon Ayarlayıcı (Slider + Haplar) */}
              <div
                style={{
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#6366F1', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Porsiyon Ayarı</span>
                  </span>
                  <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 900, color: '#6366F1' }}>
                    {multiplier}x Porsiyon
                  </span>
                </div>

                {/* Hızlı Porsiyon Hapları */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {[0.5, 1.0, 1.5, 2.0].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMultiplier(m)}
                      style={{
                        padding: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: multiplier === m ? '1px solid #6366F1' : '1px solid var(--border)',
                        backgroundColor: multiplier === m ? '#6366F1' : 'var(--surface)',
                        color: multiplier === m ? '#fff' : 'var(--text-main)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {m}x {m === 0.5 ? '(Yarım)' : m === 1.0 ? '(Tam)' : m === 1.5 ? '(1.5x)' : '(Çift)'}
                    </button>
                  ))}
                </div>

                {/* Kaydırılabilir Hassas Slider */}
                <input
                  type="range"
                  min="0.25"
                  max="3.0"
                  step="0.1"
                  value={multiplier}
                  onChange={e => setMultiplier(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#6366F1', cursor: 'pointer', marginTop: '2px' }}
                />
              </div>

              {/* Dinamik 3'lü Makro Göstergesi */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '8px',
                    padding: '8px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#6366F1', fontWeight: 700 }}>🥩 Protein</div>
                  <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 900, color: '#6366F1', marginTop: '2px' }}>
                    {currentProtein}g
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '8px',
                    padding: '8px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 700 }}>🌾 Karbonhidrat</div>
                  <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 900, color: '#F59E0B', marginTop: '2px' }}>
                    {currentCarbs}g
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '8px',
                    padding: '8px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#10B981', fontWeight: 700 }}>🥑 Sağlıklı Yağ</div>
                  <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
                    {currentFat}g
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Alt Aksiyon Çubuğu (Thumb-Friendly Sticky Footer) */}
        {step === 'confirm' && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--surface-subtle)',
              display: 'flex',
              gap: '10px'
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep('upload')}
              style={{
                flex: '0 0 auto',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 14px',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Tekrar Çek</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveMeal}
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                boxShadow: '0 3px 10px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Kaydediliyor...' : 'Onayla ve Beslenmeye Ekle'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Utility: Görsel sıkıştırma
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
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
