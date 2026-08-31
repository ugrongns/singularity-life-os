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
        navigator.vibrate(100);
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
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

  // Fotoğraftan Barkod Okuma (HTTP ve tüm mobil tarayıcılarda %100 çalışır)
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
            // 1. Native BarcodeDetector (Chrome/Android instant scan)
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
            setErrorMsg('Fotoğrafta barkod okunamadı. Lütfen barkodun net ve düz göründüğü bir fotoğraf çekin veya ISBN numarasını elle girin.');
          } finally {
            setIsProcessingImage(false);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsProcessingImage(false);
      setErrorMsg('Fotoğraf işlenirken bir sorun oluştu.');
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

    let isSubscribed = true;

    const startScanner = async () => {
      setErrorMsg(null);

      // Tarayıcı ve Protokol Kontrolü (HTTP üzerinde navigator.mediaDevices undefined olur)
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg('Tarayıcı güvenlik kuralları gereği canlı video yayını yalnızca HTTPS veya localhost üzerinde çalışır. Yerel IP (192.168.x.x) üzerinden kullanırken aşağıdaki "Fotoğraf Çek / Yükle" butonunu kullanabilirsiniz.');
        setIsScanning(false);
        return;
      }

      setIsScanning(true);

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

        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();

          // 1. Native BarcodeDetector (Chrome/Android instant scan)
          if ('BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({
                formats: ['ean_13', 'ean_8', 'code_128', 'upc_a']
              });
              const scanFrame = async () => {
                if (!isSubscribed || !videoRef.current) return;
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
                if (isSubscribed) requestAnimationFrame(scanFrame);
              };
              requestAnimationFrame(scanFrame);
              return;
            } catch (e) {
              // Fallback to ZXing
            }
          }

          // 2. ZXing Browser Stream Scan Loop
          reader.decodeFromStream(stream, videoRef.current, (result) => {
            if (result && isSubscribed) {
              const text = result.getText();
              if (text && text.length >= 9) {
                handleDetectedCode(text);
              }
            }
          });
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        console.error('Camera Access Error:', err);
        setErrorMsg('Kamera başlatılamadı. Lütfen kamera izinlerini kontrol edin veya fotoğraf çekme seçeneğini kullanın.');
        setIsScanning(false);
      }
    };

    startScanner();

    return () => {
      isSubscribed = false;
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0, 0, 0, 0.92)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between', padding: '16px'
    }}>
      {/* Gizli Kamera/Fotoğraf Girişi */}
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
          <span style={{ fontSize: '22px' }}>📷</span> ISBN Barkod Tarayıcı
        </div>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.15)', border: 'none', color: '#FFFFFF',
            width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer',
            fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          ✕
        </button>
      </div>

      {/* Orta Alan: Kamera veya Hata / Fotoğraf Alanı */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: '440px', minHeight: '300px', maxHeight: '380px',
        borderRadius: '24px', overflow: 'hidden', border: '1.5px solid rgba(255, 255, 255, 0.15)',
        background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
      }}>
        {isScanning ? (
          <>
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              playsInline
            />

            {/* Hedef Çerçeve & Lazer */}
            <div style={{
              position: 'absolute', width: '260px', height: '150px',
              border: '2px dashed #10B981', borderRadius: '16px',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{
                width: '100%', height: '2px', background: '#10B981',
                boxShadow: '0 0 10px #10B981', animation: 'scan 2s infinite ease-in-out'
              }} />
            </div>
          </>
        ) : isProcessingImage ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#FFFFFF' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }} className="loading-pulse">🔍</div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Barkod Çözümleniyor...</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>Fotoğraf taranıyor, lütfen bekleyin</div>
          </div>
        ) : (
          /* Kamera Çalışmadığında veya HTTP Ortamında Kullanıcı Dostu Panel */
          <div style={{
            padding: '24px 20px', color: '#FFFFFF', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px',
            width: '100%'
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px'
            }}>
              📸
            </div>

            {errorMsg ? (
              <div style={{
                fontSize: '12px', color: '#FCA5A5', background: 'rgba(239, 68, 68, 0.12)',
                padding: '10px 14px', borderRadius: '12px', lineHeight: 1.4, maxWidth: '360px'
              }}>
                {errorMsg}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                Kitap barkodunun fotoğrafını çekerek veya galeriden yükleyerek hemen tarayabilirsiniz.
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: '#FFFFFF', border: 'none', padding: '12px 24px',
                borderRadius: '12px', fontWeight: 700, fontSize: '14px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)', width: '80%', maxWidth: '280px',
                justifyContent: 'center'
              }}
            >
              📷 Fotoğraf Çek / Yükle
            </button>
          </div>
        )}
      </div>

      {/* Alt Aksiyonlar & Elle Giriş Seçeneği */}
      <div style={{
        width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column',
        gap: '10px', zIndex: 10, paddingBottom: '12px'
      }}>
        {/* Canlı kamera açıksa hızlı fotoğraf butonu da göster */}
        {isScanning && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'rgba(255, 255, 255, 0.1)', color: '#E2E8F0', border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            🖼️ Galeriden veya Fotoğraftan Tara
          </button>
        )}

        {/* Elle ISBN Giriş Alanı */}
        {showManualInput ? (
          <div style={{
            background: '#1E293B', padding: '12px', borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', gap: '8px'
          }}>
            <input
              type="text"
              placeholder="ISBN (örn: 978605...)"
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
        ) : (
          <button
            type="button"
            onClick={() => setShowManualInput(true)}
            style={{
              background: 'transparent', color: '#94A3B8', border: 'none',
              padding: '8px', fontSize: '13px', cursor: 'pointer',
              textDecoration: 'underline', textAlign: 'center'
            }}
          >
            ✍️ ISBN Numarasını Elle Girmek İstiyorum
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(-65px); opacity: 0.3; }
          50% { transform: translateY(65px); opacity: 1; }
          100% { transform: translateY(-65px); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
