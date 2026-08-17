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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

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

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setErrorMsg(null);
      return;
    }

    let isSubscribed = true;

    const startScanner = async () => {
      setErrorMsg(null);
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
                      playBeep();
                      stopCamera();
                      onDetected(rawVal);
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
                playBeep();
                stopCamera();
                onDetected(text);
              }
            }
          });
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        console.error('Camera Access Error:', err);
        setErrorMsg('Kamera erişimi sağlanamadı. Lütfen kamera izinlerinizi kontrol edin.');
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
      background: '#000000', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between', padding: '20px'
    }}>
      {/* Top Header Controls */}
      <div style={{
        width: '100%', maxWidth: '500px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', zIndex: 10
      }}>
        <div style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>📷</span> Barkod Tarayıcı
        </div>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.2)', border: 'none', color: '#FFFFFF',
            width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer',
            fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          ✕
        </button>
      </div>

      {/* Camera Viewport & Overlay */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: '440px', height: '340px',
        borderRadius: '24px', overflow: 'hidden', border: '2px solid rgba(255, 255, 255, 0.2)',
        background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
          playsInline
        />

        {/* Target Frame Box */}
        <div style={{
          position: 'absolute', width: '260px', height: '160px',
          border: '2px dashed #10B981', borderRadius: '16px',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          {/* Laser Scanning Bar */}
          <div style={{
            width: '100%', height: '2px', background: '#10B981',
            boxShadow: '0 0 8px #10B981', animation: 'scan 2s infinite ease-in-out'
          }} />
        </div>

        {errorMsg && (
          <div style={{
            position: 'absolute', inset: '20px', background: 'rgba(239, 68, 68, 0.95)',
            borderRadius: '16px', padding: '20px', color: '#FFFFFF', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px'
          }}>
            <span style={{ fontSize: '32px' }}>⚠️</span>
            <p style={{ fontSize: '14px', textAlign: 'center', margin: 0 }}>{errorMsg}</p>
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              style={{
                background: '#FFFFFF', color: '#991B1B', border: 'none',
                padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Kapat
            </button>
          </div>
        )}
      </div>

      {/* Bottom Hint Text */}
      <div style={{
        width: '100%', maxWidth: '440px', textAlign: 'center', color: '#9CA3AF',
        fontSize: '13px', zIndex: 10, paddingBottom: '20px'
      }}>
        {isScanning ? (
          <p style={{ margin: 0, color: '#10B981', fontWeight: 500 }}>
            ✨ Barkodu yeşil çerçevenin içine hedefleyin...
          </p>
        ) : (
          <p style={{ margin: 0 }}>Kamera başlatılıyor...</p>
        )}
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(-70px); opacity: 0.4; }
          50% { transform: translateY(70px); opacity: 1; }
          100% { transform: translateY(-70px); opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
