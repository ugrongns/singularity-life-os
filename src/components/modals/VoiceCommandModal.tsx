'use client';
import { useState, useEffect, useRef } from 'react';

interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

interface ActionItem {
  type: string;
  title: string;
  icon: string;
  details: Record<string, any>;
}

export default function VoiceCommandModal({ isOpen, onClose, onSuccess }: VoiceCommandModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [step, setStep] = useState<'input' | 'analyzing' | 'confirm'>('input');
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.lang = 'tr-TR';
        recog.continuous = false;
        recog.interimResults = true;

        recog.onresult = (event: any) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          setTranscript(current);
        };

        recog.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsRecording(false);
        };

        recog.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recog;
      }
    }
  }, []);

  if (!isOpen) return null;

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (err) {
        console.warn('Recording start error:', err);
      }
    }
  };

  const handleAnalyzeText = async (customText?: string) => {
    const textToAnalyze = customText || transcript;
    if (!textToAnalyze.trim()) return;

    setStep('analyzing');
    try {
      const res = await fetch('/api/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToAnalyze })
      });
      const json = await res.json();
      if (json.success && json.actions) {
        setActions(json.actions);
        setStep('confirm');
      }
    } catch (err) {
      alert('Sesli komut çözümlenemedi.');
      setStep('input');
    }
  };

  const handleExecuteActions = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', actions })
      });
      const json = await res.json();
      if (json.success) {
        onSuccess(`🎙️ ${json.message}`);
        handleClose();
      }
    } catch (err) {
      alert('İşlemler kaydedilirken hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    if (isRecording) recognitionRef.current?.stop();
    setIsRecording(false);
    setStep('input');
    setTranscript('');
    setActions([]);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="sheet-handle"></div>

        {/* Modal Başlığı */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>🎙️</span>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 800 }}>Sesli Çoklu Komut Girişi</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tek cümlede harcama, su, kitap ve market kaydı</div>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-muted)', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* 1. ADIM: SES KAYDI VEYA METİN GİRİŞİ */}
        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            {/* Animasyonlu Mikrofon Butonu */}
            <div
              onClick={toggleRecording}
              style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: isRecording ? '#EF4444' : 'linear-gradient(135deg, #10B981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isRecording ? '0 0 0 12px rgba(239, 68, 68, 0.25)' : '0 6px 20px rgba(16, 185, 129, 0.4)',
                cursor: 'pointer', fontSize: '36px', color: 'white',
                transition: 'all 0.3s ease',
                animation: isRecording ? 'pulse 1.5s infinite' : 'none'
              }}
            >
              {isRecording ? '⏹️' : '🎙️'}
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>
                {isRecording ? '🔴 Dinliyor... Şimdi konuşun' : 'Mikrofona dokunun ve konuşun'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                veya aşağıdaki kutucuğa komutunuzu yazın
              </div>
            </div>

            {/* Metin Giriş Alanı */}
            <div style={{ width: '100%' }}>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                placeholder="Örn: Migros'ta 450 TL harcadım, 500 ml su içtim ve kitaptan 30 sayfa okudum."
                style={{
                  width: '100%', height: '80px', padding: '12px',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                  fontSize: '13px', lineHeight: '1.5', resize: 'none', background: 'var(--surface-subtle)'
                }}
              />
            </div>

            {/* Hızlı Örnek Komut Butonları */}
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', marginBottom: '6px' }}>
                ⚡ HAZIR SESLİ TEST KOMUTLARI:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  className="btn-subtle"
                  onClick={() => {
                    setTranscript("Shell'den 1250 TL benzin aldım, 500 ml su içtim ve kitaptan 25 sayfa okudum.");
                    handleAnalyzeText("Shell'den 1250 TL benzin aldım, 500 ml su içtim ve kitaptan 25 sayfa okudum.");
                  }}
                  style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px' }}
                >
                  ⚡ "Shell'den 1250 TL benzin aldım, 500 ml su içtim ve 25 sayfa kitap okudum"
                </button>
                <button
                  className="btn-subtle"
                  onClick={() => {
                    setTranscript("Migros'ta 680 TL harcadım ve market listesine zeytinyağı ekle.");
                    handleAnalyzeText("Migros'ta 680 TL harcadım ve market listesine zeytinyağı ekle.");
                  }}
                  style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px' }}
                >
                  ⚡ "Migros'ta 680 TL harcadım ve market listesine zeytinyağı ekle"
                </button>
              </div>
            </div>

            {/* Ayrıştır Butonu */}
            {transcript && (
              <button
                className="btn-primary"
                onClick={() => handleAnalyzeText()}
                style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700 }}
              >
                🧠 Komutu Analiz Et & Ayrıştır
              </button>
            )}
          </div>
        )}

        {/* 2. ADIM: ANALİZ EDİLİYOR */}
        {step === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '36px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '36px', animation: 'spin 1s linear infinite' }}>🧠</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>Sesli Komut Çözümleniyor...</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cümledeki harcamalar, su miktarları ve okuma sayfaları ayrıştırılıyor.</div>
          </div>
        )}

        {/* 3. ADIM: ONAY & DAĞITIM EKRANI */}
        {step === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Ayrıştırılan <strong>{actions.length} adet işlem</strong> tespit edildi:
            </div>

            {/* Ayrıştırılan İşlemler Listesi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {actions.map((act, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>{act.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px' }}>{act.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {act.type === 'expense' && `Kategori: ${act.details.category_id === 'cat-arac' ? 'Ulaşım' : 'Market'} • Tutar: ${act.details.amount} ₺`}
                        {act.type === 'water' && `Miktar: ${act.details.amount_ml} ml • Günlük hedefe aktarılır`}
                        {act.type === 'reading' && `İlerleme: +${act.details.pages} sayfa • WPM ve bitiş tarihi güncellenir`}
                        {act.type === 'shopping' && `Market Listesine: ${act.details.name}`}
                        {act.type === 'supplement' && 'Günlük vitamin & takviyeler tamamlandı'}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveAction(i)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '14px', padding: '4px' }}>
                    🗑️
                  </button>
                </div>
              ))}
            </div>

            {/* Aksiyon Butonları */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button className="btn-subtle" onClick={() => setStep('input')} style={{ padding: '10px 14px', fontSize: '12px' }}>
                ← Geri Dön
              </button>
              <button
                className="btn-primary"
                onClick={handleExecuteActions}
                disabled={isSubmitting || actions.length === 0}
                style={{ flex: 1, padding: '12px', fontSize: '13px', fontWeight: 700 }}
              >
                {isSubmitting ? '⏳ Kaydediliyor...' : `✅ ${actions.length} İşlemi Onayla & Modüllere Dağıt`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
