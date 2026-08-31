'use client';
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';

interface LiveBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (isbn: string) => void;
}

export default function LiveBarcodeScannerModal({
  isOpen,
  onClose,
  onDetected
}: LiveBarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Titreşim veya Sesli Bip Bildirimi
  const playBeep = () => {
    try {
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate(120);
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch (e) {
      // Audio context fallthrough
    }
  };

  const stopCamera = () => {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (e) {}
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const handleDetectedCode = (code: string) => {
    playBeep();
    stopCamera();
    onDetected(code.trim());
  };

  // Fotoğraftan / Kapaktan Barkod Okuma (İkincil yedek)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setErrorMsg(null);

    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const img = new Image();
        img.onload = async () => {
          try {
            // 1. Native BarcodeDetector (Chrome/Android)
            if ('BarcodeDetector' in window) {
              try {
                const detector = new (window as any).BarcodeDetector({
                  formats: ['ean_13', 'ean_8', 'code_128', 'upc_a']
                });
                const barcodes = await detector.detect(img);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  handleDetectedCode(barcodes[0].rawValue);
                  setIsProcessingImage(false);
                  return;
                }
              } catch (e) {}
            }

            // 2. ZXing MultiFormat Reader
            const hints = new Map();
            hints.set(DecodeHintType.POSSIBLE_FORMATS, [
              BarcodeFormat.EAN_13,
              BarcodeFormat.EAN_8,
              BarcodeFormat.CODE_128,
              BarcodeFormat.UPC_A
            ]);
            const zxingReader = new BrowserMultiFormatReader(hints);
            const result = await zxingReader.decodeFromImageElement(img);
            if (result && result.getText()) {
              handleDetectedCode(result.getText());
              setIsProcessingImage(false);
              return;
            }
          } catch (scanErr) {
            console.warn('Barkod algılanamadı:', scanErr);
            setErrorMsg('Görselde barkod okunamadı. Lütfen barkodu kameraya daha net tutun veya ISBN numarasını elle girin.');
          } finally {
            setIsProcessingImage(false);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsProcessingImage(false);
      setErrorMsg('Görsel işlenirken bir sorun oluştu.');
    }
  };

  const startScanner = async () => {
    setErrorMsg(null);
    setIsScanning(true);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Tarayıcı güvenlik kuralları gereği canlı kamera yayını HTTPS veya localhost gerektirir. Telefondan bağlanırken lütfen https:// adresini kullanın veya kameraya izin verin.');
      setIsScanning(false);
      return;
    }

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.UPC_A
    ]);

    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();

        // 1. Native BarcodeDetector (Chrome/Android anlık lazer tarama)
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: ['ean_13', 'ean_8', 'code_128', 'upc_a']
            });
            const scanFrame = async () => {
              if (!videoRef.current) return;
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  const rawVal = barcodes[0].rawValue;
                  if (rawVal && rawVal.length >= 9) {
                    handleDetectedCode(rawVal);
                    return;
                  }
                }
              } catch (e) {}
              requestAnimationFrame(scanFrame);
            };
            requestAnimationFrame(scanFrame);
            return;
          } catch (e) {
            // Fallback to ZXing
          }
        }

        // 2. ZXing Browser Stream Loop
        reader.decodeFromStream(stream, videoRef.current, (result) => {
          if (result) {
            const text = result.getText();
            if (text && text.length >= 9) {
              handleDetectedCode(text);
            }
          }
        });
      }
    } catch (err: any) {
      console.error('Camera Access Error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Kamera izni reddedildi. Canlı tarama yapabilmek için lütfen tarayıcınızın adres çubuğundaki kilit/ayar simgesinden kamera iznini onaylayın.');
      } else {
        setErrorMsg('Kameraya erişilemedi. Lütfen kamera izinlerinizi kontrol edin veya HTTPS bağlantısı kullandığınızdan emin olun.');
      }
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setErrorMsg(null);
      setShowManualInput(false);
      setManualIsbn('');
      return;
    }

    startScanner();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between', padding: '16px'
    }}>
      {/* Gizli Fotoğraf Girişi (Barkod bulunamadığında veya kapak için) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Üst Başlık ve Kapatma */}
      <div style={{
        width: '100%', maxWidth: '480px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', zIndex: 10,
        paddingTop: '8px'
      }}>
        <div style={{ color: '#FFFFFF', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '22px' }}>📷</span> Canlı Barkod & ISBN Tarayıcı
        </div>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.15)', border: 'none', color: '#FFFFFF',
            width: '38px', height: '38px', borderRadius: '50%', cursor: 'pointer',
            fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          ✕
        </button>
      </div>

      {/* Ana Kamera Görünümü & Lazer Çerçevesi */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: '460px', height: '360px',
        borderRadius: '24px', overflow: 'hidden', border: '2px solid rgba(16, 185, 129, 0.4)',
        background: '#090D16', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)'
      }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
          playsInline
        />

        {/* Canlı Lazer Tarama Kutusu */}
        {isScanning && !errorMsg && (
          <div style={{
            position: 'absolute', width: '280px', height: '160px',
            border: '2px dashed #10B981', borderRadius: '16px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            {/* Lazer Işığı */}
            <div style={{
              width: '100%', height: '3px', background: '#10B981',
              boxShadow: '0 0 12px #10B981, 0 0 4px #FFFFFF',
              animation: 'laserScan 2s infinite ease-in-out'
            }} />
          </div>
        )}

        {/* Görsel İşlenirken Loading Durumu */}
        {isProcessingImage && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(9, 13, 22, 0.85)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '12px', zIndex: 5
          }}>
            <div style={{ fontSize: '36px' }} className="loading-pulse">🔍</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>Barkod Taranıyor...</div>
          </div>
        )}

        {/* Kamera İzni / Başlatma Hatası Durumunda Yardımcı Panel */}
        {errorMsg && (
          <div style={{
            position: 'absolute', inset: '16px', background: 'rgba(15, 23, 42, 0.95)',
            borderRadius: '18px', padding: '20px', color: '#FFFFFF', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', zIndex: 10
          }}>
            <span style={{ fontSize: '32px' }}>📷</span>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#FCA5A5', lineHeight: 1.4 }}>
              {errorMsg}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={startScanner}
                style={{
                  background: '#10B981', color: '#FFFFFF', border: 'none',
                  padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                🔄 Tekrar Dene
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)', color: '#FFFFFF', border: 'none',
                  padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                🖼️ Fotoğraf Seç
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Alt Bilgi & İkincil Butonlar */}
      <div style={{
        width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '10px', zIndex: 10, paddingBottom: '12px'
      }}>
        {isScanning && !errorMsg ? (
          <p style={{ margin: 0, color: '#10B981', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
            ✨ Kitap arkasındaki barkodu yeşil lazer çizgisine hizalayın
          </p>
        ) : null}

        {/* İkincil Seçenekler (Fotoğraf / Kapak Yükleme & Elle Giriş) */}
        <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'rgba(255, 255, 255, 0.08)', color: '#CBD5E1',
              border: '1px solid rgba(255, 255, 255, 0.15)', padding: '9px 16px',
              borderRadius: '12px', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            🖼️ Kapak / Fotoğraf Yükle
          </button>

          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)', color: '#CBD5E1',
              border: '1px solid rgba(255, 255, 255, 0.15)', padding: '9px 16px',
              borderRadius: '12px', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            ✍️ Elle ISBN Gir
          </button>
        </div>

        {/* Elle ISBN Giriş Kutusu (Açıldığında) */}
        {showManualInput && (
          <div style={{
            width: '100%', background: '#1E293B', padding: '10px', borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', gap: '8px'
          }}>
            <input
              type="text"
              placeholder="978605..."
              value={manualIsbn}
              onChange={(e) => setManualIsbn(e.target.value)}
              style={{
                flex: 1, background: '#0F172A', border: '1px solid #334155',
                color: '#FFFFFF', borderRadius: '8px', padding: '8px 12px',
                fontSize: '14px', outline: 'none'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualIsbn.trim()) {
                  handleDetectedCode(manualIsbn);
                }
              }}
            />
            <button
              type="button"
              disabled={!manualIsbn.trim()}
              onClick={() => {
                if (manualIsbn.trim()) handleDetectedCode(manualIsbn);
              }}
              style={{
                background: manualIsbn.trim() ? '#10B981' : '#475569',
                color: '#FFFFFF', border: 'none', borderRadius: '8px',
                padding: '8px 14px', fontWeight: 600, fontSize: '13px',
                cursor: manualIsbn.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              Sorgula
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes laserScan {
          0% { transform: translateY(-70px); opacity: 0.4; }
          50% { transform: translateY(70px); opacity: 1; }
          100% { transform: translateY(-70px); opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
