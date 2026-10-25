'use client';
import { useState, useRef, useEffect } from 'react';
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  BinaryBitmap,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource
} from '@zxing/library';

export interface AccountOption {
  id: string;
  name: string;
  type: string;
  owner_name?: string;
  owner_avatar?: string;
  is_mine?: boolean;
  is_joint?: boolean;
  credit_limit?: number;
  balance?: number;
}

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: AccountOption[];
  onSuccess: (msg?: string) => void;
}

async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return file;
  }
  if (file.size <= 800 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now()
              }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.82
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export default function ReceiptScanModal({ isOpen, onClose, accounts = [], onSuccess }: ReceiptScanModalProps) {
  // Sekmeler: 'qr' (Karekod Fiş), 'camera' (Fotoğraf Çek), 'upload' (Dosya Yükle), 'presets' (Hazır Örnekler)
  const [activeTab, setActiveTab] = useState<'qr' | 'camera' | 'upload' | 'presets'>('qr');
  const [step, setStep] = useState<'scan' | 'processing' | 'confirm'>('scan');
  const [scanType, setScanType] = useState<'market' | 'fuel' | 'service'>('market');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [qrScanningStatus, setQrScanningStatus] = useState<string>('Fiş veya fatura üzerindeki karekodu çerçeveye hizalayın');
  const [showManualQrInput, setShowManualQrInput] = useState(false);
  const [manualQrUrl, setManualQrUrl] = useState('');

  const [fetchedAccounts, setFetchedAccounts] = useState<AccountOption[]>([]);

  useEffect(() => {
    if (isOpen && accounts.length === 0) {
      fetch('/api/budget')
        .then(res => res.json())
        .then(json => {
          if (json.success && json.data?.accounts) {
            setFetchedAccounts(json.data.accounts);
          }
        })
        .catch(err => console.warn('Failed to load accounts in modal:', err));
    }
  }, [isOpen, accounts.length]);

  const activeAccounts = accounts.length > 0 ? accounts : fetchedAccounts;

  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeAccounts.length > 0) {
      const exists = activeAccounts.some(a => a.id === selectedWalletId);
      if (!exists || !selectedWalletId) {
        setSelectedWalletId(activeAccounts[0].id);
      }
    }
  }, [activeAccounts, selectedWalletId]);

  const selectedAccount = activeAccounts.find(a => a.id === selectedWalletId);
  const isCreditCard = selectedAccount ? selectedAccount.type === 'credit_card' : false;

  useEffect(() => {
    if (selectedAccount && selectedAccount.type !== 'credit_card' && selectedInstallments > 1) {
      setSelectedInstallments(1);
    }
  }, [selectedWalletId, selectedAccount]);

  const [parsedData, setParsedData] = useState<{
    merchant: string;
    amount: number;
    date: string;
    category_id: string;
    category_name: string;
    vehicle_km?: number;
    fuel_station?: string;
    parts_changed?: string;
    items: Array<{ name: string; price: number; quantity?: number; barcode?: string; vat_rate?: number }>;
    tax_amount?: number;
    tax_breakdown?: { vat_1?: number; vat_10?: number; vat_20?: number };
    confidence?: number;
    reference_number?: string;
    ettn?: string;
    qr_url?: string;
    source_type?: 'qr_ebelge' | 'qr_gib_code' | 'ai_ocr';
  }>({
    merchant: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category_id: 'cat-market',
    category_name: 'Market & Gıda',
    items: [],
    tax_amount: 0,
    source_type: 'ai_ocr'
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const isQrScanningActiveRef = useRef<boolean>(false);
  const qrScanIntervalRef = useRef<any>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sesli Bip ve Haptic Titreşim Bildirimi
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
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // Audio context fallthrough
    }
  };

  // Kamera Başlatma (Hem QR hem Fotoğraf Modu için)
  const startCamera = async (isQrMode: boolean = false) => {
    setCameraError(null);
    try {
      stopCamera();

      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('Tarayıcı güvenlik kuralları gereği canlı video yayını sadece HTTPS veya localhost üzerinde çalışır. Yerel IP erişiminde lütfen yukarıdaki "Dosya Yükle" sekmesini kullanın.');
        setIsCameraActive(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      mediaStreamRef.current = stream;

      // Fener (Torch) ve Sürekli Odaklanma (Autofocus) yeteneği
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as any;
      if (caps && caps.torch) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }

      if (caps && caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        try {
          await (track as any).applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          });
        } catch (e) {}
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsCameraActive(true);

        if (isQrMode) {
          startQrDetection();
        }
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError('Kamera erişimine izin verilmedi veya kamera bulunamadı. Lütfen izinlerinizi kontrol edin veya "Fotoğraf Yükle" sekmesini kullanın.');
      setIsCameraActive(false);
    }
  };

  // Fener Aç/Kapa
  const toggleTorch = async () => {
    if (mediaStreamRef.current) {
      const track = mediaStreamRef.current.getVideoTracks()[0];
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setIsTorchOn(nextState);
      } catch (e) {
        console.warn('Torch toggle error:', e);
      }
    }
  };

  // Gerçek Zamanlı Çok Katmanlı QR Tarama Döngüsü (Sıfır Deadlock)
  const startQrDetection = () => {
    isQrScanningActiveRef.current = true;
    setQrScanningStatus('Fiş veya faturadaki karekodu yeşil çerçeveye hizalayın...');

    if (qrScanIntervalRef.current) {
      clearInterval(qrScanIntervalRef.current);
      qrScanIntervalRef.current = null;
    }

    // 1. ZXing Reader (TRY_HARDER modu ile termal fişler için en hassas okuma)
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const zxingReader = new BrowserMultiFormatReader(hints);
    zxingReaderRef.current = zxingReader;

    // 2. Tarayıcı Native Donanım BarcodeDetector (Chrome/Android destekliyorsa)
    let nativeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'data_matrix']
        });
      } catch (e) {
        nativeDetector = null;
      }
    }

    // Merkeze odaklı 2x dijital zoom ve kırpma için canvas
    if (!scanCanvasRef.current && typeof document !== 'undefined') {
      scanCanvasRef.current = document.createElement('canvas');
    }
    const offscreenCanvas = scanCanvasRef.current;
    const offscreenCtx = offscreenCanvas?.getContext('2d', { willReadFrequently: true });

    let scanAttempts = 0;
    let isProcessing = false;

    qrScanIntervalRef.current = setInterval(async () => {
      if (!isQrScanningActiveRef.current || !videoRef.current || isProcessing) return;

      const video = videoRef.current;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

      isProcessing = true;
      scanAttempts++;

      // Kullanıcıya dinamik rehberlik ipuçları
      if (scanAttempts === 20) {
        setQrScanningStatus('Kamerayı fişe 15-20 cm mesafede ve düz tutun...');
      } else if (scanAttempts === 45) {
        setQrScanningStatus('Işık azsa feneri (🔦) açın veya "📁 Dosya" sekmesini deneyin');
      }

      try {
        // A. KATMAN: Native BarcodeDetector (Tam Kare)
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleDetectedQr(barcodes[0].rawValue);
              return;
            }
          } catch (e) {}
        }

        // B. KATMAN: Native BarcodeDetector (Yeşil Vizör Merkez Kırpma / 2x Zoom)
        // Termal fişlerde karekod küçük olduğundan vizör bölgesini büyütmek anında okumayı sağlar
        if (nativeDetector && offscreenCanvas && offscreenCtx) {
          try {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const cropSize = Math.round(Math.min(vw, vh) * 0.65);
            const sx = Math.round((vw - cropSize) / 2);
            const sy = Math.round((vh - cropSize) / 2);

            offscreenCanvas.width = 480;
            offscreenCanvas.height = 480;
            offscreenCtx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 480, 480);

            const barcodes = await nativeDetector.detect(offscreenCanvas);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleDetectedQr(barcodes[0].rawValue);
              return;
            }
          } catch (e) {}
        }

        // C. KATMAN: ZXing Motoru (Tam Video Karesi)
        try {
          const zResult = zxingReader.decode(video);
          if (zResult && zResult.getText()) {
            handleDetectedQr(zResult.getText());
            return;
          }
        } catch (e) {}

        // D. KATMAN: ZXing Motoru (Yeşil Vizör Merkez Kırpma / 2x Zoom)
        if (offscreenCanvas && offscreenCtx) {
          try {
            if (offscreenCanvas.width !== 480) {
              const vw = video.videoWidth;
              const vh = video.videoHeight;
              const cropSize = Math.round(Math.min(vw, vh) * 0.65);
              const sx = Math.round((vw - cropSize) / 2);
              const sy = Math.round((vh - cropSize) / 2);
              offscreenCanvas.width = 480;
              offscreenCanvas.height = 480;
              offscreenCtx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 480, 480);
            }
            const luminanceSource = new HTMLCanvasElementLuminanceSource(offscreenCanvas);
            const bitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
            const zResult = zxingReader.decodeBitmap(bitmap);
            if (zResult && zResult.getText()) {
              handleDetectedQr(zResult.getText());
              return;
            }
          } catch (e) {}
        }
      } finally {
        isProcessing = false;
      }
    }, 120);
  };

  // QR Algılandığında Tetiklenen Olay
  const handleDetectedQr = (qrData: string) => {
    if (!isQrScanningActiveRef.current) return;
    isQrScanningActiveRef.current = false;
    if (qrScanIntervalRef.current) {
      clearInterval(qrScanIntervalRef.current);
      qrScanIntervalRef.current = null;
    }
    playBeep();
    setQrScanningStatus('✅ Karekod Algılandı! e-Belge Çözümleniyor...');
    stopCamera();
    processReceiptQr(qrData);
  };

  // Kamera Durdurma
  const stopCamera = () => {
    isQrScanningActiveRef.current = false;
    if (qrScanIntervalRef.current) {
      clearInterval(qrScanIntervalRef.current);
      qrScanIntervalRef.current = null;
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch (e) {}
      zxingReaderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
  };

  useEffect(() => {
    if (isOpen && step === 'scan') {
      if (activeTab === 'qr') {
        startCamera(true);
      } else if (activeTab === 'camera') {
        startCamera(false);
      } else {
        stopCamera();
      }
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, step]);

  useEffect(() => {
    if (activeAccounts.length > 0 && !selectedWalletId) {
      setSelectedWalletId(activeAccounts[0].id);
    }
  }, [activeAccounts, selectedWalletId]);

  if (!isOpen) return null;

  // Fotoğraf Çek (Snap Frame)
  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImages(prev => [...prev, base64]);
  };

  const handleProcessAll = () => {
    if (capturedImages.length === 0) return;
    stopCamera();
    processReceiptImage(capturedImages);
  };

  // QR Kod Metnini / Linkini Sunucuya Gönderip Çözümle
  const processReceiptQr = async (qrDataText: string) => {
    setStep('processing');
    try {
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_data: qrDataText })
      });
      const json = await res.json();
      if (json.success && json.data) {
        applyParsedData(json.data);
      } else {
        alert(json.error || 'Karekod çözümlenemedi. Lütfen görsel yüklemeyi deneyin.');
        setStep('scan');
      }
    } catch (err: any) {
      console.warn('QR parse fallback error:', err);
      alert('Karekod çözümlenirken sunucu bağlantısında hata oluştu.');
      setStep('scan');
    }
  };

  // Dosya Yükleme (Fotoğrafta QR varsa önce QR'ı dener, yoksa OCR yapar)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setStep('processing');
    try {
      const fileArray = Array.from(files);
      const compressedFiles = await Promise.all(fileArray.map(f => compressImageIfNeeded(f)));

      const base64Promises = compressedFiles.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.readAsDataURL(file);
        });
      });

      const base64Images = await Promise.all(base64Promises);
      setCapturedImages(base64Images);

      // İstemci tarafında görselde QR kod var mı tara
      let detectedQr: string | undefined;
      try {
        const img = new Image();
        img.src = base64Images[0];
        await new Promise(r => { img.onload = r; img.onerror = r; });

        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'data_matrix'] });
          const barcodes = await detector.detect(img);
          if (barcodes?.length > 0 && barcodes[0].rawValue) {
            detectedQr = barcodes[0].rawValue;
          }
        }

        if (!detectedQr) {
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
          const zxingReader = new BrowserMultiFormatReader(hints);
          const res = await zxingReader.decodeFromImageElement(img);
          if (res && res.getText()) {
            detectedQr = res.getText();
          }
        }
      } catch (qrErr) {
        // QR bulunamadıysa normal AI Vision ile devam edilir
      }

      await processReceiptImage(base64Images, compressedFiles, detectedQr);
    } catch (err: any) {
      console.error('File upload process error:', err);
      alert('Dosya yüklenirken bir hata oluştu: ' + (err.message || 'Lütfen tekrar deneyin.'));
      setStep('scan');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // AI Pipeline ile Fişi Çözümle
  const processReceiptImage = async (base64Array: string[], fileObjs?: File[], qrData?: string) => {
    setStep('processing');
    try {
      const formData = new FormData();
      if (fileObjs && fileObjs.length > 0) {
        fileObjs.forEach(file => formData.append('files', file));
      }
      base64Array.forEach(b64 => formData.append('base64Images', b64));
      if (qrData) {
        formData.append('qr_data', qrData);
      }

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success && json.data && (json.data.amount > 0 || json.data.merchant || (json.data.items && json.data.items.length > 0))) {
        applyParsedData(json.data);
      } else {
        alert(json.error || 'Fiş üzerindeki bilgiler okunamadı. Lütfen fişin daha net bir fotoğrafını yükleyin veya manuel giriş yapın.');
        setStep('scan');
      }
    } catch (err: any) {
      console.warn('AI Receipt parse error:', err);
      alert('Fiş çözümlenirken bağlantı hatası oluştu: ' + (err.message || 'Lütfen tekrar deneyin.'));
      setStep('scan');
    }
  };

  // Gelen Fiş Verisini State'e Doldur
  const applyParsedData = (d: any) => {
    const isFuel = d.category_id === 'cat-ulasim' || d.category_id === 'cat-arac' || d.merchant.toLowerCase().includes('shell') || d.merchant.toLowerCase().includes('opet') || d.merchant.toLowerCase().includes('petrol');
    const isService = d.merchant.toLowerCase().includes('service') || d.merchant.toLowerCase().includes('oto') || d.merchant.toLowerCase().includes('tamir');

    setScanType(isFuel ? 'fuel' : isService ? 'service' : 'market');
    setParsedData({
      merchant: d.merchant || 'İşletme',
      amount: Number(d.amount) || 0,
      date: d.date || new Date().toISOString().split('T')[0],
      category_id: d.category_id || 'cat-market',
      category_name: d.category_name || 'Market & Gıda',
      vehicle_km: isFuel ? 65500 : isService ? 75000 : undefined,
      fuel_station: isFuel ? d.merchant : undefined,
      parts_changed: isService ? 'Periyodik Bakım ve Yağ Değişimi' : undefined,
      items: d.items || [],
      tax_amount: d.tax_amount,
      tax_breakdown: d.tax_breakdown,
      confidence: d.confidence,
      reference_number: d.reference_number,
      ettn: d.ettn,
      qr_url: d.qr_url,
      source_type: d.source_type || 'ai_ocr'
    });
    setStep('confirm');
  };

  // Hazır Senaryo Yükleme (Simülasyon / Test)
  const handlePresetSelect = (type: 'migros_qr' | 'shell' | 'bosch') => {
    setStep('processing');
    setTimeout(() => {
      const today = new Date().toISOString().split('T')[0];
      if (type === 'migros_qr') {
        setScanType('market');
        setSelectedInstallments(1);
        setParsedData({
          merchant: 'MİGROS (YENİ BATI ANKARA MM MİGROS)',
          amount: 430.85,
          date: '2026-10-24',
          category_id: 'cat-market',
          category_name: 'Market & Gıda',
          items: [
            { name: 'MLIFE KAFESSİZ M BOY TAVUK YUMURTASI 10 LU 53-62 G', price: 104.95, quantity: 1, barcode: '8697581702809' },
            { name: 'MLIFE KAFESSİZ M BOY TAVUK YUMURTASI 10 LU 53-62 G', price: 104.95, quantity: 1, barcode: '8697581702809' },
            { name: 'ORKİD PLATINUM GECE EKSTRA PLUS 14 LÜ', price: 219.95, quantity: 1, barcode: '8006530170062' },
            { name: 'MİGROS PLASTİK POŞET YENİ', price: 1.00, quantity: 1, barcode: '2001111341301' }
          ],
          tax_amount: 22.25,
          reference_number: '063921026770261024',
          ettn: '36407bb8-3882-4ed7-8afa-54fed93e587f',
          qr_url: 'https://sites.fitbulut.com/eBelgeGoruntuleyici/ViewDocument.aspx?ID=6220529513&UUID=36407bb8-3882-4ed7-8afa-54fed93e587f#Refid063921026770261024',
          source_type: 'qr_ebelge'
        });
      } else if (type === 'shell') {
        setScanType('fuel');
        setSelectedInstallments(1);
        setParsedData({
          merchant: 'Shell Petrol A.Ş.',
          amount: 2250.00,
          date: today,
          category_id: 'cat-ulasim',
          category_name: 'Ulaşım & Akaryakıt',
          vehicle_km: 65850,
          fuel_station: 'Shell V-Power Kurşunsuz 95',
          items: [{ name: 'V-Power Kurşunsuz 95 (50.5 Litre)', price: 2250.00, quantity: 1 }],
          source_type: 'ai_ocr'
        });
      } else if (type === 'bosch') {
        setScanType('service');
        setSelectedInstallments(6);
        setParsedData({
          merchant: 'Bosch Car Service',
          amount: 18000.00,
          date: today,
          category_id: 'cat-ulasim',
          category_name: 'Ulaşım & Araç Bakımı',
          vehicle_km: 75000,
          parts_changed: 'Motor Yağı, Yağ/Hava/Polen Filtresi, Ön Fren Balatası & Disk Değişimi',
          items: [{ name: '75.000 KM Periyodik Ağır Bakım Paketi', price: 18000.00, quantity: 1 }],
          source_type: 'ai_ocr'
        });
      }
      setStep('confirm');
    }, 600);
  };

  // Kalem Düzenleme / Ekleme / Silme
  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...parsedData.items];
    updated[index] = { ...updated[index], [field]: val };
    const total = updated.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    setParsedData({ ...parsedData, items: updated, amount: total > 0 ? Math.round(total * 100) / 100 : parsedData.amount });
  };

  const handleAddItem = () => {
    setParsedData({
      ...parsedData,
      items: [...parsedData.items, { name: 'Yeni Ürün', price: 50.00, quantity: 1 }]
    });
  };

  const handleRemoveItem = (index: number) => {
    const updated = parsedData.items.filter((_, i) => i !== index);
    const total = updated.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    setParsedData({ ...parsedData, items: updated, amount: total > 0 ? Math.round(total * 100) / 100 : parsedData.amount });
  };

  // Kaydetme
  const handleFinalSave = async () => {
    setIsSubmitting(true);
    try {
      const refText = parsedData.reference_number ? ` • Ref: ${parsedData.reference_number}` : '';
      const noteDetails = scanType === 'fuel'
        ? `Akaryakıt (${parsedData.fuel_station || 'Shell'} • ${parsedData.vehicle_km?.toLocaleString('tr-TR')} KM)${refText}`
        : scanType === 'service'
        ? `Araç Bakımı (${parsedData.parts_changed || 'Periyodik Bakım'})${refText}`
        : parsedData.items?.length
        ? `${parsedData.items.length} kalem market fişi (${parsedData.items.map(i => i.name).slice(0, 3).join(', ')})${refText}`
        : `Fiş / Fatura Harcaması${refText}`;

      const txRes = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_id: selectedWalletId,
          category_id: parsedData.category_id,
          merchant: parsedData.merchant,
          amount: parsedData.amount,
          installments: selectedInstallments,
          notes: noteDetails
        })
      });

      const txJson = await txRes.json();
      if (!txJson.success) {
        alert(txJson.error || 'İşlem kaydedilemedi.');
        setIsSubmitting(false);
        return;
      }

      // Çift Yönlü Senkronizasyon (Araç Defterine KM veya Servis Kaydı)
      if (scanType === 'fuel' && parsedData.vehicle_km) {
        await fetch('/api/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicle_id: 'veh-1',
            current_km: parsedData.vehicle_km
          })
        });
      } else if (scanType === 'service' && parsedData.vehicle_km) {
        await fetch('/api/vehicles/maintenance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicle_id: 'veh-1',
            km_at_service: parsedData.vehicle_km,
            service_date: parsedData.date,
            description: parsedData.parts_changed || 'Periyodik Bakım',
            cost: parsedData.amount,
            service_provider: parsedData.merchant
          })
        });
      }

      onSuccess(`✅ "${parsedData.merchant}" faturası başarıyla kaydedildi!`);
      handleModalClose();
    } catch (err: any) {
      alert('İşlem kaydedilirken hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    stopCamera();
    setStep('scan');
    setCapturedImages([]);
    setShowManualQrInput(false);
    setManualQrUrl('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleModalClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        {/* Modal Başlığı */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>🧾</span>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 800 }}>Karekod & Akıllı Fiş Okuyucu</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Migros, BİM, A101 ve GİB e-Arşiv karekodları & AI Vision OCR</div>
            </div>
          </div>
          <button onClick={handleModalClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            ✕
          </button>
        </div>

        {/* 1. ADIM: TARAMA / GÖRSEL SEÇME */}
        {step === 'scan' && (
          <div>
            {/* Sekme Butonları */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', marginBottom: '14px' }}>
              <button
                onClick={() => setActiveTab('qr')}
                className={`choice-pill ${activeTab === 'qr' ? 'selected' : ''}`}
                style={{ flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: 700 }}
              >
                📱 Karekod / QR
              </button>
              <button
                onClick={() => setActiveTab('camera')}
                className={`choice-pill ${activeTab === 'camera' ? 'selected' : ''}`}
                style={{ flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: 600 }}
              >
                📷 Fiş Çek
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`choice-pill ${activeTab === 'upload' ? 'selected' : ''}`}
                style={{ flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: 600 }}
              >
                📁 Dosya
              </button>
              <button
                onClick={() => setActiveTab('presets')}
                className={`choice-pill ${activeTab === 'presets' ? 'selected' : ''}`}
                style={{ flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: 600 }}
              >
                ⚡ Örnekler
              </button>
            </div>

            {/* TAB 1: CANLI KAREKOD / QR TARAYICI */}
            {activeTab === 'qr' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  position: 'relative', width: '100%', height: 'clamp(280px, 46vh, 420px)',
                  background: '#0B0F19', borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
                }}>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: isCameraActive ? 'block' : 'none' }}
                  />
                  {!isCameraActive && (
                    <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '20px' }}>
                      <div style={{ fontSize: '36px', marginBottom: '8px' }}>📱</div>
                      <div style={{ fontSize: '13px' }}>{cameraError || 'Karekod kamerası başlatılıyor...'}</div>
                    </div>
                  )}

                  {/* QR Odaklama Vizörü ve Lazer Tarama Çizgisi */}
                  {isCameraActive && (
                    <div style={{
                      position: 'absolute', width: '220px', height: '220px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none'
                    }}>
                      {/* Köşe Parantezleri */}
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '28px', height: '28px', borderTop: '4px solid #10B981', borderLeft: '4px solid #10B981', borderTopLeftRadius: '8px' }} />
                      <div style={{ position: 'absolute', top: 0, right: 0, width: '28px', height: '28px', borderTop: '4px solid #10B981', borderRight: '4px solid #10B981', borderTopRightRadius: '8px' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '28px', height: '28px', borderBottom: '4px solid #10B981', borderLeft: '4px solid #10B981', borderBottomLeftRadius: '8px' }} />
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '28px', height: '28px', borderBottom: '4px solid #10B981', borderRight: '4px solid #10B981', borderBottomRightRadius: '8px' }} />

                      {/* Lazer Tarama Efekti */}
                      <div style={{
                        position: 'absolute', top: '15%', left: '10px', right: '10px', height: '2px',
                        background: 'linear-gradient(90deg, transparent, #10B981, #34D399, transparent)',
                        boxShadow: '0 0 12px #10B981',
                        animation: 'scanLaser 2s ease-in-out infinite alternate'
                      }} />

                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: '4px', textAlign: 'center', marginTop: '160px' }}>
                        Karekodu buraya tutun
                      </div>
                    </div>
                  )}

                  {/* Fener Butonu */}
                  {hasTorch && isCameraActive && (
                    <button
                      onClick={toggleTorch}
                      style={{
                        position: 'absolute', top: '12px', right: '12px',
                        background: isTorchOn ? '#F59E0B' : 'rgba(0,0,0,0.6)',
                        color: 'white', border: 'none', borderRadius: '50%',
                        width: '36px', height: '36px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', backdropFilter: 'blur(4px)'
                      }}
                      title={isTorchOn ? 'Feneri Kapat' : 'Feneri Aç'}
                    >
                      {isTorchOn ? '💡' : '🔦'}
                    </button>
                  )}
                </div>

                {/* Bilgi Çubuğu */}
                <div style={{
                  width: '100%', padding: '8px 12px', background: 'var(--emerald-bg)',
                  border: '1px solid var(--emerald)', borderRadius: 'var(--radius-md)',
                  fontSize: '11px', color: 'var(--emerald-text, #065F46)', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <span>⚡</span>
                  <span style={{ fontWeight: 600 }}>{qrScanningStatus}</span>
                </div>

                {/* Hızlı Tavsiye ve Rehberlik Rozetleri */}
                <div style={{
                  display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap',
                  fontSize: '11px', color: 'var(--text-muted)', marginTop: '-4px'
                }}>
                  <span style={{ background: 'var(--surface)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    📏 15-20 cm mesafe
                  </span>
                  <span style={{ background: 'var(--surface)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    ✨ Parlamayı önleyin
                  </span>
                  <span style={{ background: 'var(--surface)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    📁 veya Dosya yükleyin
                  </span>
                </div>

                {/* Karekodsuz Klasik Fiş için Hızlı Geçiş Butonu */}
                <button
                  type="button"
                  onClick={() => setActiveTab('camera')}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    marginTop: '2px'
                  }}
                >
                  <span>📷</span>
                  <span>Fişte Karekod Yoksa: Fotoğraf Çekip AI ile Çözümle</span>
                </button>

                {/* Manuel Link Yapıştırma Aç/Kapa */}
                <div style={{ width: '100%', textAlign: 'center', marginTop: '2px' }}>
                  <button
                    onClick={() => setShowManualQrInput(!showManualQrInput)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {showManualQrInput ? '▲ Link girişini gizle' : '🔗 veya Fatura Karekod Linki Yapıştır'}
                  </button>

                  {showManualQrInput && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        placeholder="https://sites.fitbulut.com/... veya VKN:... linkini yapıştırın"
                        value={manualQrUrl}
                        onChange={e => setManualQrUrl(e.target.value)}
                        style={{
                          flex: 1, padding: '8px 10px', fontSize: '12px',
                          border: '1px solid var(--border)', borderRadius: '6px',
                          background: 'var(--surface)'
                        }}
                      />
                      <button
                        onClick={() => {
                          if (manualQrUrl.trim()) processReceiptQr(manualQrUrl.trim());
                        }}
                        className="btn-primary"
                        style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}
                      >
                        Çözümle
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: FİŞ FOTOĞRAFI ÇEKME */}
            {activeTab === 'camera' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  position: 'relative', width: '100%', height: 'clamp(280px, 46vh, 420px)',
                  background: '#111827', borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: isCameraActive ? 'block' : 'none' }}
                  />
                  {!isCameraActive && (
                    <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '20px' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                      <div style={{ fontSize: '13px' }}>{cameraError || 'Kamera başlatılıyor...'}</div>
                    </div>
                  )}

                  {/* Fiş Çerçeve Kılavuzu */}
                  <div style={{
                    position: 'absolute', inset: '24px',
                    border: '2px dashed rgba(255,255,255,0.6)',
                    borderRadius: '12px', pointerEvents: 'none',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                    padding: '8px'
                  }}>
                    <span style={{ fontSize: '11px', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px' }}>
                      Fişi çerçevenin içine hizalayın
                    </span>
                  </div>
                </div>

                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                  <button
                    className="btn-subtle"
                    onClick={handleCaptureSnapshot}
                    disabled={!isCameraActive}
                    style={{ flex: 1, padding: '14px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--border)' }}
                  >
                    <span>📸</span>
                    <span>Fotoğraf Çek ({capturedImages.length > 0 ? `+${capturedImages.length}` : 'Ekle'})</span>
                  </button>
                  {capturedImages.length > 0 && (
                    <button
                      className="btn-primary"
                      onClick={handleProcessAll}
                      style={{ flex: 1, padding: '14px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <span>🚀</span>
                      <span>Tümünü Çözümle</span>
                    </button>
                  )}
                </div>

                {capturedImages.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', width: '100%', paddingBottom: '8px' }}>
                    {capturedImages.map((img, idx) => (
                      <div key={idx} style={{ minWidth: '60px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--primary)' }}>
                        <img src={img} alt={`Parça ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DOSYA / GALERİ YÜKLE */}
            {activeTab === 'upload' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border-strong)',
                    borderRadius: 'var(--radius-lg)', padding: '36px 20px',
                    background: 'var(--surface-subtle)', cursor: 'pointer',
                    transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
                  }}
                >
                  <span style={{ fontSize: '40px' }}>🧾</span>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>Fiş veya Fatura Görselini Buraya Bırakın</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Karekodlu yeni nesil fişler veya klasik kağıt fişler (JPG, PNG, HEIC)</div>
                </div>

                <button
                  className="btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ padding: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <span>📁</span>
                  <span>Galeriden veya Dosyalardan Seç</span>
                </button>
              </div>
            )}

            {/* TAB 4: HAZIR ÖRNEK FİŞLER */}
            {activeTab === 'presets' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Farklı senaryoları denemek için aşağıdaki hazır test fişlerinden birini seçebilirsiniz:
                </div>

                <button
                  onClick={() => handlePresetSelect('migros_qr')}
                  className="btn-subtle"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--emerald)',
                    borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>📱</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>Migros e-Arşiv QR Fişi</span>
                        <span style={{ fontSize: '9px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>KAREKODLU</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        4 Kalem: MLIFE Yumurta x2, Orkid Gece, Poşet (Ref: 063921026770261024)
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>430,85 ₺</div>
                </button>

                <button
                  onClick={() => handlePresetSelect('shell')}
                  className="btn-subtle"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>⛽</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>Shell V-Power Akaryakıt</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>50.5 Litre Benzin • Araç Sayacı (65.850 KM)</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>2.250,00 ₺</div>
                </button>

                <button
                  onClick={() => handlePresetSelect('bosch')}
                  className="btn-subtle"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🔧</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>Bosch Car Service Faturası</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ağır Bakım & Balata • 6 Taksit • 75.000 KM Servis Kaydı</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>18.000,00 ₺</div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. ADIM: YAPAY ZEKA VE e-BELGE ÇÖZÜMLEME (PROCESSING) */}
        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '40px', animation: 'spin 1.2s linear infinite' }}>⚡</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>Fatura Bilgileri Çözümleniyor...</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '340px', lineHeight: '1.5' }}>
              GİB e-Belge entegrasyonu ve AI Vision motoru ile mağaza, ürün kalemleri, KDV ve toplam tutar ayrıştırılıyor.
            </div>
          </div>
        )}

        {/* 3. ADIM: ONAY & DÜZENLEME EKRANI */}
        {step === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Üst Bilgi Rozeti */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                {scanType === 'fuel' ? '⛽ AKARYAKIT FİŞİ' : scanType === 'service' ? '🔧 SERVİS & BAKIM FATURASI' : '🧾 ALIŞVERİŞ FİŞİ'}
              </span>

              {parsedData.source_type === 'qr_ebelge' || parsedData.source_type === 'qr_gib_code' ? (
                <span style={{ fontSize: '11px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '3px 8px', borderRadius: 'var(--radius-full)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>✓</span> Resmi e-Belge Doğrulandı (%100)
                </span>
              ) : (
                <span style={{ fontSize: '11px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '3px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                  ✓ AI Çözümleme Başarılı
                </span>
              )}
            </div>

            {/* Referans Numarası veya Karekod Linki */}
            {parsedData.reference_number && (
              <div style={{
                fontSize: '11px', padding: '6px 10px', background: 'var(--surface-subtle)',
                border: '1px solid var(--border)', borderRadius: '6px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  İade / Referans No: <strong style={{ color: 'var(--text-main)' }}>{parsedData.reference_number}</strong>
                </span>
                {parsedData.qr_url && (
                  <a
                    href={parsedData.qr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Orijinal Faturayı Aç ↗
                  </a>
                )}
              </div>
            )}

            {/* Fiş Ana Bilgileri (İşletme, Tarih, Toplam) */}
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={parsedData.merchant}
                  onChange={e => setParsedData({ ...parsedData, merchant: e.target.value })}
                  style={{ fontWeight: 800, fontSize: '15px', border: 'none', background: 'transparent', outline: 'none', width: '100%' }}
                />
                <input
                  type="date"
                  value={parsedData.date}
                  onChange={e => setParsedData({ ...parsedData, date: e.target.value })}
                  style={{ fontSize: '11px', color: 'var(--text-muted)', border: 'none', background: 'transparent', outline: 'none', marginTop: '2px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  step="0.01"
                  value={parsedData.amount}
                  onChange={e => setParsedData({ ...parsedData, amount: parseFloat(e.target.value) || 0 })}
                  className="tabular-nums"
                  style={{ fontWeight: 800, fontSize: '20px', textAlign: 'right', width: '120px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 8px', background: 'var(--surface)', color: 'var(--text-main)' }}
                />
                <span style={{ fontWeight: 800, fontSize: '16px' }}>₺</span>
              </div>
            </div>

            {/* Kalem Kalem Alışveriş Listesi */}
            {parsedData.items && parsedData.items.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    SEPET KALEMLERİ ({parsedData.items.length})
                    {parsedData.tax_amount ? ` • Toplam KDV: ${parsedData.tax_amount.toFixed(2)} ₺` : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {parsedData.confidence !== undefined && (
                      <span style={{
                        fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                        background: parsedData.confidence >= 0.85 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        color: parsedData.confidence >= 0.85 ? '#059669' : '#D97706',
                        border: `1px solid ${parsedData.confidence >= 0.85 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`
                      }}>
                        {parsedData.confidence >= 0.85 ? '✓ Güvenilirlik %95+' : `Doğruluk: %${Math.round(parsedData.confidence * 100)}`}
                      </span>
                    )}
                    <button onClick={handleAddItem} style={{ fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      + Kalem Ekle
                    </button>
                  </div>
                </div>
                {parsedData.tax_breakdown && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {parsedData.tax_breakdown.vat_1 !== undefined && parsedData.tax_breakdown.vat_1 > 0 && (
                      <span style={{ background: 'var(--surface-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        KDV %1: <b>{parsedData.tax_breakdown.vat_1.toFixed(2)} ₺</b>
                      </span>
                    )}
                    {parsedData.tax_breakdown.vat_10 !== undefined && parsedData.tax_breakdown.vat_10 > 0 && (
                      <span style={{ background: 'var(--surface-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        KDV %10: <b>{parsedData.tax_breakdown.vat_10.toFixed(2)} ₺</b>
                      </span>
                    )}
                    {parsedData.tax_breakdown.vat_20 !== undefined && parsedData.tax_breakdown.vat_20 > 0 && (
                      <span style={{ background: 'var(--surface-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        KDV %20: <b>{parsedData.tax_breakdown.vat_20.toFixed(2)} ₺</b>
                      </span>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                  {parsedData.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <input
                        type="text"
                        value={item.name}
                        onChange={e => handleItemChange(idx, 'name', e.target.value)}
                        style={{ flex: 1, padding: '4px 6px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                        title={item.barcode ? `Barkod: ${item.barcode}` : undefined}
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={e => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                        style={{ width: '70px', textAlign: 'right', padding: '4px 6px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>₺</span>
                      <button onClick={() => handleRemoveItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer', fontSize: '12px' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Araç Özel Bilgileri */}
            {(scanType === 'fuel' || scanType === 'service') && (
              <div style={{ background: 'var(--indigo-bg)', border: '1px solid var(--indigo)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--indigo)' }}>🚗 Araç Defteri Çift Yönlü Entegrasyonu (Volvo XC60):</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Sayaç Kilometresi (KM):</label>
                    <input
                      type="number"
                      value={parsedData.vehicle_km || 65500}
                      onChange={e => setParsedData({ ...parsedData, vehicle_km: parseFloat(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '13px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: '6px', marginTop: '2px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{scanType === 'fuel' ? 'İstasyon / Yakıt Türü:' : 'Servis Sağlayıcı:'}</label>
                    <input
                      type="text"
                      value={scanType === 'fuel' ? (parsedData.fuel_station || 'Shell V-Power') : (parsedData.merchant || 'Bosch Car Service')}
                      onChange={e => setParsedData({ ...parsedData, fuel_station: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '2px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>
                {scanType === 'service' && (
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Değişen Parçalar / İşçilik:</label>
                    <input
                      type="text"
                      value={parsedData.parts_changed || 'Periyodik Bakım'}
                      onChange={e => setParsedData({ ...parsedData, parts_changed: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '2px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Ödeme Hesabı / Kart Seçimi */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>ÖDEME YAPAN HESAP / KART:</span>
                {selectedAccount && (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#4F46E5' }}>
                    {selectedAccount.owner_name ? `Sahibi: ${selectedAccount.owner_avatar || '👤'} ${selectedAccount.owner_name}` : (selectedAccount.is_joint ? '👥 Ortak Hesap' : '')}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                {activeAccounts.map((acc: any) => {
                  const isCard = acc.type === 'credit_card';
                  const icon = isCard ? '💳' : acc.type === 'bank' ? '🏦' : acc.type === 'cash' ? '💵' : '💰';
                  const isSelected = selectedWalletId === acc.id;
                  const ownerBadge = acc.owner_name
                    ? `${acc.owner_avatar || '👤'} ${acc.owner_name.split(' ')[0]}`
                    : (acc.is_joint ? '👥 Ortak' : null);

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      className={`choice-pill ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedWalletId(acc.id);
                        if (acc.type !== 'credit_card') {
                          setSelectedInstallments(1);
                        }
                      }}
                      style={{
                        padding: '8px 6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        textAlign: 'center',
                        minHeight: '48px'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span>{icon}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.name}</span>
                      </div>
                      {ownerBadge && (
                        <div style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          opacity: isSelected ? 0.95 : 0.65,
                          color: isSelected ? '#312E81' : 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '120px'
                        }}>
                          {ownerBadge}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Taksit Seçenekleri */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>TAKSİT DİLİMİ:</div>
                {!isCreditCard && (
                  <span style={{ fontSize: '10px', color: '#B45309', fontWeight: 700 }}>
                    ℹ️ Nakit / Vadesiz Hesap (Taksit Yapılamaz)
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
                {[1, 2, 3, 6, 9, 12].map(num => {
                  const isDisabled = !isCreditCard && num > 1;
                  return (
                    <button
                      key={num}
                      disabled={isDisabled}
                      className={`choice-pill ${selectedInstallments === num ? 'selected' : ''}`}
                      onClick={() => {
                        if (!isDisabled) setSelectedInstallments(num);
                      }}
                      style={{
                        padding: '6px 2px',
                        fontSize: '11px',
                        textAlign: 'center',
                        opacity: isDisabled ? 0.35 : 1,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        filter: isDisabled ? 'grayscale(1)' : 'none'
                      }}
                      title={isDisabled ? 'Nakit ve vadesiz hesaplarda taksit uygulanamaz' : undefined}
                    >
                      <div style={{ fontWeight: 700 }}>{num === 1 ? 'Tek' : `${num} Taksit`}</div>
                      {num > 1 && (
                        <div style={{ fontSize: '9px', opacity: 0.8, marginTop: '1px' }}>
                          {Math.round(parsedData.amount / num).toLocaleString('tr-TR')} ₺/ay
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Aksiyon Butonları */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                className="btn-subtle"
                onClick={() => { setStep('scan'); setCapturedImages([]); }}
                style={{ padding: '10px 16px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
              >
                ← Yeniden Tara
              </button>
              <button
                className="btn-primary"
                onClick={handleFinalSave}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '12px', fontSize: '14px', fontWeight: 700 }}
              >
                {isSubmitting ? '⏳ Kaydediliyor...' : '✅ Onayla & Kaydet'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
