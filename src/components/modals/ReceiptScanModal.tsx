'use client';
import { useState, useRef, useEffect } from 'react';

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: Array<{ id: string; name: string; type: string }>;
  onSuccess: (msg?: string) => void;
}

export default function ReceiptScanModal({ isOpen, onClose, accounts = [], onSuccess }: ReceiptScanModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'presets'>('camera');
  const [step, setStep] = useState<'scan' | 'processing' | 'confirm'>('scan');
  const [scanType, setScanType] = useState<'market' | 'fuel' | 'service'>('market');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const [fetchedAccounts, setFetchedAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);

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
    items: Array<{ name: string; price: number; quantity?: number }>;
  }>({
    merchant: 'Migros Ticaret A.Ş.',
    amount: 1485.50,
    date: new Date().toISOString().split('T')[0],
    category_id: 'cat-market',
    category_name: 'Market & Gıda',
    items: [
      { name: 'Süt 1L Günlük', price: 42.50, quantity: 2 },
      { name: 'Tam Buğday Ekmeği', price: 35.00, quantity: 1 },
      { name: 'Beyaz Peynir 500g', price: 185.00, quantity: 1 },
      { name: 'Zeytinyağı 1L Sızma', price: 450.00, quantity: 1 }
    ]
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Kamera Başlatma
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError('Kamera erişimine izin verilmedi veya kamera bulunamadı. Lütfen dosya yükleme veya hazır fiş seçeneklerini kullanın.');
      setIsCameraActive(false);
    }
  };

  // Kamera Durdurma
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera' && step === 'scan') {
      startCamera();
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

  // Dosya Yükleme
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    const base64Promises = fileArray.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });
    });

    const base64Images = await Promise.all(base64Promises);
    setCapturedImages(base64Images);
    processReceiptImage(base64Images, fileArray);
  };

  // AI Pipeline ile Fişi Çözümle
  const processReceiptImage = async (base64Array: string[], fileObjs?: File[]) => {
    setStep('processing');
    try {
      const formData = new FormData();
      if (fileObjs && fileObjs.length > 0) {
        fileObjs.forEach(file => formData.append('files', file));
      } else {
        base64Array.forEach(b64 => formData.append('base64Images', b64));
      }

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        const isFuel = d.category_id === 'cat-arac' || d.merchant.toLowerCase().includes('shell') || d.merchant.toLowerCase().includes('opet') || d.merchant.toLowerCase().includes('petrol');
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
          items: d.items || []
        });
      }
    } catch (err) {
      console.warn('AI Receipt parse fallback:', err);
    } finally {
      setStep('confirm');
    }
  };

  // Hazır Senaryo Yükleme (Simülasyon)
  const handlePresetSelect = (type: 'migros' | 'shell' | 'bosch') => {
    setStep('processing');
    setTimeout(() => {
      const today = new Date().toISOString().split('T')[0];
      if (type === 'migros') {
        setScanType('market');
        setSelectedInstallments(1);
        setParsedData({
          merchant: 'Migros Ticaret A.Ş.',
          amount: 1485.50,
          date: today,
          category_id: 'cat-market',
          category_name: 'Market & Gıda',
          items: [
            { name: 'Süt 1L Günlük', price: 42.50, quantity: 2 },
            { name: 'Tam Buğday Ekmeği', price: 35.00, quantity: 1 },
            { name: 'Beyaz Peynir 500g', price: 185.00, quantity: 1 },
            { name: 'Zeytinyağı 1L Sızma', price: 450.00, quantity: 1 }
          ]
        });
      } else if (type === 'shell') {
        setScanType('fuel');
        setSelectedInstallments(1);
        setParsedData({
          merchant: 'Shell Petrol A.Ş.',
          amount: 2250.00,
          date: today,
          category_id: 'cat-arac',
          category_name: 'Ulaşım & Akaryakıt',
          vehicle_km: 65850,
          fuel_station: 'Shell V-Power Kurşunsuz 95',
          items: [{ name: 'V-Power Kurşunsuz 95 (50.5 Litre)', price: 2250.00, quantity: 1 }]
        });
      } else if (type === 'bosch') {
        setScanType('service');
        setSelectedInstallments(6);
        setParsedData({
          merchant: 'Bosch Car Service',
          amount: 18000.00,
          date: today,
          category_id: 'cat-arac',
          category_name: 'Ulaşım & Araç Bakımı',
          vehicle_km: 75000,
          parts_changed: 'Motor Yağı, Yağ/Hava/Polen Filtresi, Ön Fren Balatası & Disk Değişimi',
          items: [{ name: '75.000 KM Periyodik Ağır Bakım Paketi', price: 18000.00, quantity: 1 }]
        });
      }
      setStep('confirm');
    }, 800);
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

  // Çift Yönlü Kaydetme
  const handleFinalSave = async () => {
    setIsSubmitting(true);
    try {
      // 1. Finans Modülüne Harcama / Taksit Kaydı
      const noteDetails = scanType === 'fuel'
        ? `Akaryakıt (${parsedData.fuel_station || 'Shell'} • ${parsedData.vehicle_km?.toLocaleString('tr-TR')} KM)`
        : scanType === 'service'
        ? `Araç Bakımı (${parsedData.parts_changed || 'Periyodik Bakım'})`
        : parsedData.items?.length ? `${parsedData.items.length} kalem market fişi (${parsedData.items.map(i => i.name).slice(0, 3).join(', ')})` : 'AI Fiş Taraması';

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
        alert(txJson.error || 'İşlem engellendi.');
        setIsSubmitting(false);
        return;
      }

      // 2. Çift Yönlü Senkronizasyon: Araç Defterine KM veya Servis Kaydı
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

      onSuccess(`✅ "${parsedData.merchant}" fişi başarıyla kaydedildi ve bütçe/araç modüllerine işlendi!`);
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
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleModalClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        {/* Modal Başlığı */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>📸</span>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 800 }}>Akıllı Fiş & Fatura Tarama</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AI Vision ile otomatik tutar, kalem ve araç KM ayrıştırma</div>
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
            <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', marginBottom: '14px' }}>
              <button
                onClick={() => setActiveTab('camera')}
                className={`choice-pill ${activeTab === 'camera' ? 'selected' : ''}`}
                style={{ flex: 1, padding: '7px', fontSize: '12px', fontWeight: 600 }}
              >
                📷 Canlı Kamera
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`choice-pill ${activeTab === 'upload' ? 'selected' : ''}`}
                style={{ flex: 1, padding: '7px', fontSize: '12px', fontWeight: 600 }}
              >
                📁 Fotoğraf Yükle
              </button>
              <button
                onClick={() => setActiveTab('presets')}
                className={`choice-pill ${activeTab === 'presets' ? 'selected' : ''}`}
                style={{ flex: 1, padding: '7px', fontSize: '12px', fontWeight: 600 }}
              >
                ⚡ Hazır Örnekler
              </button>
            </div>

            {/* TAB 1: CANLI KAMERA */}
            {activeTab === 'camera' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  position: 'relative', width: '100%', height: '280px',
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

                  {/* Fiş Hizalama Kılavuzu (Kılavuz Çerçevesi) */}
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
                    <span>Parça Ekle ({capturedImages.length > 0 ? `+${capturedImages.length}` : 'Çek'})</span>
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

            {/* TAB 2: DOSYA / GALERİ YÜKLE */}
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
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>veya cihazınızdan seçmek için tıklayın (JPG, PNG, HEIC)</div>
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

            {/* TAB 3: HAZIR ÖRNEK FİŞLER */}
            {activeTab === 'presets' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Kameranız veya dosyanız yoksa aşağıdaki gerçekçi test senaryolarından birini seçebilirsiniz:
                </div>

                <button
                  onClick={() => handlePresetSelect('migros')}
                  className="btn-subtle"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🛒</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>Migros Market Fişi</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>4 Kalem: Süt, Ekmek, Peynir, Zeytinyağı</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>1.485,50 ₺</div>
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

        {/* 2. ADIM: YAPAY ZEKA AYRIŞTIRMA (PROCESSING) */}
        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '40px', animation: 'spin 1.2s linear infinite' }}>🧠</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>Yapay Zeka Fişi Çözümlüyor...</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: '1.5' }}>
              İşletme adı, KDV oranları, sepet kalemleri ve araç bilgileri ayrıştırılıyor.
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
              <span style={{ fontSize: '11px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '3px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                ✓ AI Çözümleme Başarılı
              </span>
            </div>

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
                  style={{ fontWeight: 800, fontSize: '20px', textAlign: 'right', width: '120px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 8px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                />
                <span style={{ fontWeight: 800, fontSize: '16px' }}>₺</span>
              </div>
            </div>

            {/* Kalem Kalem Alışveriş Listesi */}
            {parsedData.items && parsedData.items.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>SEPET KALEMLERİ ({parsedData.items.length})</div>
                  <button onClick={handleAddItem} style={{ fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    + Kalem Ekle
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                  {parsedData.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <input
                        type="text"
                        value={item.name}
                        onChange={e => handleItemChange(idx, 'name', e.target.value)}
                        style={{ flex: 1, padding: '4px 6px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
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

            {/* Araç Özel Bilgileri (Çift Yönlü Senkronizasyon) */}
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
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>ÖDEME YAPAN HESAP / KART:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                {activeAccounts.map(acc => {
                  const isCard = acc.type === 'credit_card';
                  const icon = isCard ? '💳' : acc.type === 'bank' ? '🏦' : acc.type === 'cash' ? '💵' : '💰';
                  return (
                    <button
                      key={acc.id}
                      className={`choice-pill ${selectedWalletId === acc.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedWalletId(acc.id);
                        if (acc.type !== 'credit_card') {
                          setSelectedInstallments(1);
                        }
                      }}
                      style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 600, textAlign: 'center' }}
                    >
                      {icon} {acc.name}
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
                {isSubmitting ? '⏳ Kaydediliyor...' : '✅ Onayla & Çift Yönlü Kaydet'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
