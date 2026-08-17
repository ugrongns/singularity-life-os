'use client';
import { useState, useEffect, useRef } from 'react';

interface LiveBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string, snapshotBase64?: string) => void;
}

export default function LiveBarcodeScannerModal({
  isOpen,
  onClose,
  onDetected
}: LiveBarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Kamera başlatılıyor...');
  const activeStreamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const stopCamera = () => {
    isScanningRef.current = false;
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => track.stop());
      activeStreamRef.current = null;
    }
  };

  const startCamera = async () => {
    setErrorMsg(null);
    setStatusText('Kamera açılıyor, lütfen izin verin...');
    isScanningRef.current = true;

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      }

      activeStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatusText('📸 Barkodu hizada tutun...');
        startScanLoop();
      }
    } catch (err: any) {
      console.error('Kamera erişim hatası:', err);
      setErrorMsg('Kamera erişimi sağlanamadı. Lütfen tarayıcı izinlerini kontrol edin veya galeriden fotoğraf yükleyin.');
    }
  };

  const startScanLoop = async () => {
    // 1. Tarayıcı Native BarcodeDetector API Kontrolü (Chrome Android / Safari 17+)
    if ('BarcodeDetector' in window) {
      try {
        const formats = ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'qr_code'];
        // @ts-ignore
        const detector = new window.BarcodeDetector({ formats });

        const detectFrame = async () => {
          if (!isScanningRef.current || !videoRef.current) return;
          try {
            if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const code = barcodes[0].rawValue;
                const cleanCode = code.replace(/[^0-9X]/gi, '');
                if (cleanCode.length >= 8) {
                  triggerSuccess(cleanCode);
                  return;
                }
              }
            }
          } catch (e) {}
          if (isScanningRef.current) {
            requestAnimationFrame(detectFrame);
          }
        };
        detectFrame();
        return;
      } catch (e) {
        console.warn('Native BarcodeDetector kullanılamadı, ZXing fallback çalıştırılıyor');
      }
    }

    // 2. Fallback: ZXing Video Decoder Loop
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const reader = new BrowserMultiFormatReader();

      const scanZXingFrame = async () => {
        if (!isScanningRef.current || !videoRef.current || !canvasRef.current) return;
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imgUrl = canvas.toDataURL('image/jpeg', 0.85);
              const img = new Image();
              img.src = imgUrl;
              await new Promise(r => { img.onload = r; });
              const result = await reader.decodeFromImageElement(img);
              if (result) {
                const cleanCode = result.getText().replace(/[^0-9X]/gi, '');
                if (cleanCode.length >= 8) {
                  triggerSuccess(cleanCode);
                  return;
                }
              }
            }
          }
        } catch (e) {}

        if (isScanningRef.current) {
          setTimeout(scanZXingFrame, 150);
        }
      };
      scanZXingFrame();
    } catch (err) {
      console.error('ZXing decoder hatası:', err);
    }
  };

  const triggerSuccess = (barcode: string) => {
    isScanningRef.current = false;
    setStatusText(`✅ Barkod Algılandı: ${barcode}`);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(200); } catch (e) {}
    }

    let snapshot: string | undefined = undefined;
    if (videoRef.current && canvasRef.current) {
      try {
        const v = videoRef.current;
        const c = canvasRef.current;
        c.width = v.videoWidth || 640;
        c.height = v.videoHeight || 480;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(v, 0, 0, c.width, c.height);
          snapshot = c.toDataURL('image/jpeg', 0.85);
        }
      } catch (e) {}
    }

    stopCamera();
    onDetected(barcode, snapshot);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '92%',
          maxWidth: '460px',
          background: '#0F172A',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          color: 'white'
        }}
      >
        {/* Modal Başlığı */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>📹</span> Live Barkod Tara
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: 'white',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Video Görünümü & Tarama Çerçevesi */}
        <div style={{ position: 'relative', width: '100%', height: '320px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Tarama Hedef Çerçevesi (Laser Scanner Line Animation) */}
          <div
            style={{
              position: 'absolute',
              width: '75%',
              height: '160px',
              border: '2px solid rgba(16, 185, 129, 0.8)',
              borderRadius: '16px',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}
          >
            {/* Köşe Vurguları */}
            <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '20px', height: '20px', borderTop: '4px solid #10B981', borderLeft: '4px solid #10B981', borderRadius: '4px 0 0 0' }}></div>
            <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '20px', height: '20px', borderTop: '4px solid #10B981', borderRight: '4px solid #10B981', borderRadius: '0 4px 0 0' }}></div>
            <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '20px', height: '20px', borderBottom: '4px solid #10B981', borderLeft: '4px solid #10B981', borderRadius: '0 0 0 4px' }}></div>
            <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '20px', height: '20px', borderBottom: '4px solid #10B981', borderRight: '4px solid #10B981', borderRadius: '0 0 4px 0' }}></div>

            {/* Hareket Eden Lazer Çizgisi */}
            <div
              style={{
                width: '100%',
                height: '2px',
                background: '#10B981',
                boxShadow: '0 0 8px #10B981',
                animation: 'scanLine 2s infinite ease-in-out'
              }}
            ></div>
          </div>
        </div>

        {/* Durum & İpucu Metni */}
        <div style={{ padding: '16px', textAlign: 'center' }}>
          {errorMsg ? (
            <div style={{ color: '#F87171', fontSize: '13px', lineHeight: '1.4' }}>{errorMsg}</div>
          ) : (
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#6EE7B7' }}>{statusText}</div>
          )}
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
            Kitabın arka kapağındaki siyah çizgili ISBN barkodunu yeşil çerçevenin ortasına hizalayın.
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scanLine {
          0% { transform: translateY(-70px); }
          50% { transform: translateY(70px); }
          100% { transform: translateY(-70px); }
        }
      `}</style>
    </div>
  );
}
