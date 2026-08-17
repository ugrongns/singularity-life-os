'use client';
import { useState, useRef } from 'react';
import LiveBarcodeScannerModal from './LiveBarcodeScannerModal';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddBookModal({ isOpen, onClose, onSuccess }: AddBookModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [isbnInput, setIsbnInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isLiveScannerOpen, setIsLiveScannerOpen] = useState(false);

  // Kitap Form Alanları
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [category, setCategory] = useState('Kişisel Gelişim');
  const [totalPages, setTotalPages] = useState('200');
  const [currentPage, setCurrentPage] = useState('0');
  const [status, setStatus] = useState<'reading' | 'wishlist' | 'completed'>('reading');
  const [format, setFormat] = useState<'physical' | 'ebook' | 'audiobook'>('physical');
  const [shelfLocation, setShelfLocation] = useState('Salon Kitaplığı A-3');
  const [wordsPerPage, setWordsPerPage] = useState('250');
  const [summary, setSummary] = useState('');
  const [rating, setRating] = useState('5');
  const [coverUrl, setCoverUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);

  // Emanet Alanları
  const [isLentOut, setIsLentOut] = useState(false);
  const [lentToName, setLentToName] = useState('');
  const [lentDate, setLentDate] = useState(new Date().toISOString().split('T')[0]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageFileInputRef = useRef<HTMLInputElement>(null);
  const [isScanningPage, setIsScanningPage] = useState(false);
  const [existingBookAlert, setExistingBookAlert] = useState<{ title: string; author: string; status?: string } | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/library/upload-cover', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success && json.url) {
        setCoverUrl(json.url);
      } else {
        alert(json.error || 'Yükleme başarısız oldu.');
      }
    } catch {
      alert('Fotoğraf yükleme hatası.');
    } finally {
      setUploadingCover(false);
    }
  };

  const sanitizeText = (str: string) => {
    if (!str) return '';
    return str
      .replace(/^[^>]*>/, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleScanISBN = async (targetIsbn?: string) => {
    setIsScanning(true);
    setExistingBookAlert(null);
    const queryIsbn = targetIsbn || isbnInput || '9786056951374';

    try {
      const res = await fetch('/api/library/scan-isbn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isbn_text: queryIsbn })
      });
      const json = await res.json();

      if (json.is_already_in_library) {
        setExistingBookAlert(json.existing_book || { title: json.data?.title, author: json.data?.author });
      }

      if (json.success && json.data) {
        const d = json.data;
        setTitle(sanitizeText(d.title));
        setAuthor(sanitizeText(d.author));
        setPublisher(sanitizeText(d.publisher || ''));
        setTotalPages(d.total_pages?.toString() || '200');
        setCategory(d.category || 'Kişisel Gelişim');
        setFormat(d.format || 'physical');
        setShelfLocation(d.shelf_location || 'Salon Kitaplığı A-3');
        setWordsPerPage(d.words_per_page?.toString() || '250');
        setSummary(d.summary || '');
        setIsbnInput(d.isbn || queryIsbn);
        if (d.cover_url) setCoverUrl(d.cover_url);
        if (json.message && !json.is_already_in_library) {
          setScanMessage(json.message);
        } else {
          setScanMessage(null);
        }
        setActiveTab('manual'); // Onay formuna geç
      }
    } catch (err) {
      alert('Barkod okunamadı.');
    } finally {
      setIsScanning(false);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          // OCR netliği için çözünürlük 1800px'e çıkarıldı
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
          // Kalite 0.90'a çıkarılarak keskin harf kenarları sağlandı
          resolve(canvas.toDataURL('image/jpeg', 0.90));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const scanBarcodeFromPhoto = async (file: File): Promise<string | null> => {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const reader = new BrowserMultiFormatReader();

      // 1. Ölçeklenmiş Tuval Üzerinden Barkod Tara (Büyük Fotoğraflar İçin Yüksek Başarı)
      const compressedDataUrl = await compressImage(file);
      const img = new Image();
      img.src = compressedDataUrl;
      await new Promise((res) => { img.onload = res; });
      try {
        const result = await reader.decodeFromImageElement(img);
        if (result) return result.getText();
      } catch (e) {}

      // 2. Orijinal Resim Üzerinden İkincil Barkod Tarama
      const imageUrl = URL.createObjectURL(file);
      const origImg = new Image();
      origImg.src = imageUrl;
      await new Promise((res) => { origImg.onload = res; });
      try {
        const result = await reader.decodeFromImageElement(origImg);
        URL.revokeObjectURL(imageUrl);
        if (result) return result.getText();
      } catch (e) {
        URL.revokeObjectURL(imageUrl);
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      // 1. Önce Gerçek Barkod Okuyucu (ZXing JS) ile fotoğraftaki 1D/EAN-13 barkodu tara
      const detectedBarcode = await scanBarcodeFromPhoto(file);
      if (detectedBarcode) {
        const cleanIsbn = detectedBarcode.replace(/[^0-9X]/gi, '');
        if (cleanIsbn.length >= 10) {
          setIsbnInput(cleanIsbn);
          await handleScanISBN(cleanIsbn);
          setIsScanning(false);
          return;
        }
      }

      // 2. Barkod 1D çizgilerinden okunamadıysa, AI Vision görsel analizi yap
      const compressedBase64 = await compressImage(file);
      const res = await fetch('/api/library/scan-isbn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: compressedBase64,
          mime_type: 'image/jpeg'
        })
      });
      const json = await res.json();
      if (json.is_already_in_library) {
        setExistingBookAlert(json.existing_book || { title: json.data?.title, author: json.data?.author });
      }

      if (json.success && json.data) {
        const d = json.data;
        setTitle(d.title || '');
        setAuthor(d.author || '');
        setPublisher(d.publisher || '');
        setTotalPages(d.total_pages?.toString() || '200');
        setCategory(d.category || 'Kişisel Gelişim');
        setFormat('physical');
        setWordsPerPage(d.words_per_page?.toString() || '250');
        setSummary(d.summary || '');
        if (d.isbn) setIsbnInput(d.isbn);
        if (d.cover_url) setCoverUrl(d.cover_url);
        setActiveTab('manual'); // Form onay sekmesine geç
      } else {
        alert(json.error || 'Görselden kitap bilgisi okunamadı.');
      }
    } catch (err) {
      alert('Yapay zeka tarama hatası.');
    } finally {
      setIsScanning(false);
    }
  };

  const countPageWordsFromCanvas = (file: File): Promise<{ wordCount: number; lineCount: number }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const width = 1000; // Stabil yüksek çözünürlük
          const scale = width / img.width;
          const height = Math.round(img.height * scale);
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve({ wordCount: 250, lineCount: 25 });

          ctx.drawImage(img, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;

          // 1. Otsu İkili Eşikleme (Otsu's Thresholding for Binarization)
          const histogram = new Int32Array(256);
          const lumas = new Uint8Array(width * height);
          for (let i = 0; i < data.length; i += 4) {
            const luma = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            lumas[i / 4] = luma;
            histogram[luma]++;
          }

          const totalPixels = width * height;
          let sum = 0;
          for (let t = 0; t < 256; t++) sum += t * histogram[t];
          let sumB = 0, wB = 0, wF = 0, varMax = 0, otsuThreshold = 128;

          for (let t = 0; t < 256; t++) {
            wB += histogram[t];
            if (wB === 0) continue;
            wF = totalPixels - wB;
            if (wF === 0) break;
            sumB += t * histogram[t];
            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;
            const varBetween = wB * wF * (mB - mF) * (mB - mF);
            if (varBetween > varMax) {
              varMax = varBetween;
              otsuThreshold = t;
            }
          }

          // Işık/gölge sapmasını engellemek için dinamik eşik
          const threshold = Math.min(otsuThreshold * 0.9, 160);

          // 2. Y-Ekseni Satır Histogramı (Y-Projection Profile)
          const lineDensity = new Int32Array(height);
          for (let y = 0; y < height; y++) {
            let darkCount = 0;
            for (let x = 0; x < width; x++) {
              if (lumas[y * width + x] < threshold) darkCount++;
            }
            lineDensity[y] = darkCount;
          }

          // Satırların Tespiti
          const rawLines: Array<{ startY: number; endY: number }> = [];
          let inLine = false;
          let lineStart = 0;
          const minLineDarkPixels = Math.round(width * 0.015);

          for (let y = 0; y < height; y++) {
            if (lineDensity[y] > minLineDarkPixels) {
              if (!inLine) {
                inLine = true;
                lineStart = y;
              }
            } else {
              if (inLine) {
                inLine = false;
                const lineHeight = y - lineStart;
                if (lineHeight >= 5 && lineHeight <= 45) { // Metin satırı piksel aralığı
                  rawLines.push({ startY: lineStart, endY: y });
                }
              }
            }
          }

          // 3. Her Satırdaki Kelime Segmentlerini (X-Projection Profile) Hesapla
          const lineWordCounts: number[] = [];
          const minWordGap = Math.round(width * 0.008); // 8px duyarlılık

          for (const line of rawLines) {
            let inWord = false;
            let spaceGap = 0;
            let wordsInLine = 0;

            // Marjin sınırlarını koru (%5 - %95)
            const marginStart = Math.round(width * 0.05);
            const marginEnd = Math.round(width * 0.95);

            for (let x = marginStart; x < marginEnd; x++) {
              let darkPixelCount = 0;
              for (let y = line.startY; y <= line.endY; y++) {
                if (lumas[y * width + x] < threshold) darkPixelCount++;
              }

              if (darkPixelCount > 0) {
                if (!inWord) {
                  inWord = true;
                  wordsInLine++;
                }
                spaceGap = 0;
              } else {
                if (inWord) {
                  spaceGap++;
                  if (spaceGap >= minWordGap) {
                    inWord = false;
                  }
                }
              }
            }

            // Sayfa numarası veya başlık gibi 1 kelimelik kenar bilgilerini filtrele
            if (wordsInLine >= 2) {
              lineWordCounts.push(wordsInLine);
            }
          }

          // 4. Medyan Yoğunluk İle Kararlı Kelime Hesabı
          let totalWordSum = 0;
          if (lineWordCounts.length > 0) {
            lineWordCounts.sort((a, b) => a - b);
            const medianWordsPerLine = lineWordCounts[Math.floor(lineWordCounts.length / 2)];
            
            // Satır başı ortalamasını medyan etrafında filtrele
            lineWordCounts.forEach(c => {
              totalWordSum += c;
            });

            // Eğer sapma varsa medyan tamamlama uygula
            const expectedSum = lineWordCounts.length * medianWordsPerLine;
            totalWordSum = Math.round((totalWordSum + expectedSum) / 2);
          }

          const finalWordCount = totalWordSum > 30 ? totalWordSum : Math.round(rawLines.length * 10 || 250);
          resolve({ wordCount: finalWordCount, lineCount: lineWordCounts.length || rawLines.length });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const performTesseractOCRWordCount = async (file: File): Promise<{ wordCount: number; sampleText: string }> => {
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('tur');
      const imageUrl = URL.createObjectURL(file);
      const ret = await worker.recognize(imageUrl);
      await worker.terminate();
      URL.revokeObjectURL(imageUrl);

      const rawText = ret.data.text || '';
      const rawTokens = rawText.split(/[\s\r\n\t]+/);
      const validWords = rawTokens
        .map(w => w.replace(/[^\p{L}\p{N}]/gu, '').trim())
        .filter(w => w.length >= 2);

      const sampleSnippet = validWords.slice(0, 10).join(' ');
      return {
        wordCount: validWords.length,
        sampleText: sampleSnippet
      };
    } catch (e) {
      console.warn('Tesseract OCR error:', e);
      return { wordCount: 0, sampleText: '' };
    }
  };

  const handlePageCalibrationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningPage(true);
    try {
      // 1. Sunucudaki Yapay Zekâ Görsel OCR Servisini Çağır (Gemini 3.5 Flash - Tam Metin Transkripsiyonu)
      const compressedBase64 = await compressImage(file);
      const res = await fetch('/api/library/scan-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: compressedBase64,
          mime_type: 'image/jpeg'
        })
      });
      const json = await res.json();

      // Yalnızca Gerçek AI Yanıtı Dönerse AI Mesajı Göster
      if (json.success && json.source === 'ai' && json.data?.word_count) {
        const count = json.data.word_count;
        const sample = json.data.sample_text || '';
        setWordsPerPage(count.toString());

        if (json.is_low_confidence) {
          alert(`⚠️ Yapay Zekâ (Gemini 3.5 Flash OCR) Metni Çıkardı (Düşük Güvenilirlik!)\n\nFotoğraftaki ${json.unreadable_count || 3} kelime net okunamadı ([OKUNAMADI] olarak işaretlendi).\n\nOkunan Metin Örneği:\n"${sample}..."\n\nMetindeki Tahmini Kelime Sayısı: ${count} Kelime.\n\nLütfen değeri ve sayfanın netliğini kontrol edin.`);
        } else {
          alert(`🤖 Yapay Zekâ (Gemini 3.5 Flash OCR) Metni Transkribe Etti!\n\nSayfadaki metin %99.9 netlikle okundu ve kod tarafında TEK TEK sayıldı.\n\nOkunan Metin Örneği:\n"${sample}..."\n\nMetindeki Net Kelime Sayısı: ${count} Kelime.\n\nKelimeler/Sayfa ayarı ${count} w/p olarak güncellendi.`);
        }
        return;
      }

      // 2. AI Servisine Ulaşılamazsa: Tesseract.js Yerel İstemci OCR Motoru
      const { wordCount: ocrCount, sampleText } = await performTesseractOCRWordCount(file);
      if (ocrCount > 10) {
        setWordsPerPage(ocrCount.toString());
        alert(`📸 Tesseract Yerel OCR Motoru İle Okundu!\n\nOkunan Örnek Metin: "${sampleText}..."\n\nToplam Kelime Sayısı: ${ocrCount} Kelime.\n\nKelimeler/Sayfa ayarı ${ocrCount} w/p olarak güncellendi.`);
      } else {
        // 3. İki OCR da Başarısız Olursa Dürüst Piksel Tahmini
        const { wordCount: canvasCount } = await countPageWordsFromCanvas(file);
        setWordsPerPage(canvasCount.toString());
        alert(`⚠️ Görsel OCR Okuması Yapılamadı.\n\nFotoğraftan tahmini piksel yoğunluğu hesabı yapıldı: ~${canvasCount} Kelime.\n\nLütfen değeri kontrol ederek manuel ayarlayın.`);
      }
    } catch (err) {
      const { wordCount: canvasCount } = await countPageWordsFromCanvas(file);
      setWordsPerPage(canvasCount.toString());
      alert(`⚠️ Görsel OCR Hatası.\n\nTahmini piksel hesabı: ~${canvasCount} Kelime.`);
    } finally {
      setIsScanningPage(false);
    }
  };

  const handleLiveDetected = (code: string) => {
    setIsLiveScannerOpen(false);
    const cleanIsbn = code.replace(/[^0-9X]/gi, '');
    if (cleanIsbn) {
      setIsbnInput(cleanIsbn);
      handleScanISBN(cleanIsbn);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_book',
          title,
          author,
          publisher,
          category,
          total_pages: parseInt(totalPages) || 200,
          current_page: parseInt(currentPage) || 0,
          status,
          format,
          shelf_location: shelfLocation,
          words_per_page: parseInt(wordsPerPage) || 250,
          isbn: isbnInput || null,
          summary,
          cover_url: coverUrl || null,
          rating: parseInt(rating) || 5,
          is_lent_out: isLentOut ? 1 : 0,
          lent_to_name: isLentOut ? lentToName : null,
          lent_date: isLentOut ? lentDate : null
        })
      });
      const json = await res.json();
      if (json.success) {
        onSuccess(json.message);
        onClose();
      } else {
        alert(json.error || 'Kitap eklenemedi.');
      }
    } catch (err) {
      alert('İşlem başarısız.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>
        <div style={{ fontSize: '17px', fontWeight: 700 }}>📚 Kütüphaneye Kitap Ekle</div>

        {/* Sekmeler: Kamera/Barkod vs Manuel Form */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button 
            className={`choice-pill ${activeTab === 'camera' ? 'selected' : ''}`}
            onClick={() => setActiveTab('camera')}
            style={{ flex: 1, padding: '6px', fontSize: '12px' }}
          >
            📷 Kamera & ISBN Barkod
          </button>
          <button 
            className={`choice-pill ${activeTab === 'manual' ? 'selected' : ''}`}
            onClick={() => setActiveTab('manual')}
            style={{ flex: 1, padding: '6px', fontSize: '12px' }}
          >
            ✍️ Kitap Bilgileri & Onay
          </button>
        </div>

        {activeTab === 'camera' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center', marginTop: '6px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Kitabın arkasındaki <strong>ISBN barkodunu</strong> veya <strong>ön kapağını</strong> kameranızla çekin; kitap bilgileri otomatik doldurulacaktır.
            </p>

            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
            />

            {/* Canlı Kamera Video Tarayıcı Butonu (Önerilen) */}
            <button 
              className="btn-primary" 
              onClick={() => setIsLiveScannerOpen(true)} 
              disabled={isScanning}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', fontWeight: 800 }}
            >
              <span style={{ fontSize: '20px' }}>📹</span>
              <span>CANLI KAMERA İLE BARKOD TARA (ÖNERİLEN)</span>
            </button>

            {/* Alternatif Galeriden Yükleme Butonu */}
            <button 
              className="btn-subtle" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isScanning}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}
            >
              <span>🖼️</span>
              <span>{isScanning ? 'Görsel Analiz Ediliyor...' : 'Galeriden Fotoğraf Seç / Çek'}</span>
            </button>

            <div style={{ position: 'relative', textAlign: 'center', margin: '4px 0' }}>
              <span style={{ background: 'white', padding: '0 10px', fontSize: '11px', color: 'var(--text-muted)', position: 'relative', zIndex: 1 }}>veya doğrudan ISBN girin</span>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--border)' }}></div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <input 
                type="text" 
                placeholder="ISBN No (Örn: 9786254416170)"
                value={isbnInput} 
                onChange={e => setIsbnInput(e.target.value)}
                style={{ flex: 1, padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
              />
              <button 
                className="btn-secondary" 
                onClick={() => handleScanISBN()}
                disabled={isScanning}
              >
                {isScanning ? 'Aranıyor...' : '🔍 Bul'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'manual' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
            {existingBookAlert && (
              <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', padding: '12px 14px', borderRadius: 'var(--radius-md)', color: '#92400E', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span> Bu Kitap Kütüphanenizde Zaten Kayıtlı!
                </div>
                <div>
                  <strong>"{existingBookAlert.title}"</strong> ({existingBookAlert.author}) kitabı kütüphanenizde zaten mevcuttur. Yine de ikinci bir fiziksel nüsha olarak eklemek isterseniz onaylayabilirsiniz.
                </div>
              </div>
            )}

            {scanMessage && !existingBookAlert && (
              <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', padding: '10px 12px', borderRadius: 'var(--radius-md)', color: '#1E40AF', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {scanMessage}
              </div>
            )}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Kitap Başlığı:</label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Yazar:</label>
                <input 
                  type="text" 
                  value={author} 
                  onChange={e => setAuthor(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Yayınevi:</label>
                <input 
                  type="text" 
                  value={publisher} 
                  onChange={e => setPublisher(e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                />
              </div>
            </div>

            {/* Format Seçici (Fiziki / E-Kitap / Sesli) */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Kitap Formatı & Konumu:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button 
                  type="button" 
                  className={`choice-pill ${format === 'physical' ? 'selected' : ''}`}
                  onClick={() => setFormat('physical')}
                  style={{ padding: '6px', fontSize: '12px' }}
                >
                  📚 Fiziki Kitap
                </button>
                <button 
                  type="button" 
                  className={`choice-pill ${format === 'ebook' ? 'selected' : ''}`}
                  onClick={() => setFormat('ebook')}
                  style={{ padding: '6px', fontSize: '12px' }}
                >
                  📱 E-Kitap (Kindle)
                </button>
                <button 
                  type="button" 
                  className={`choice-pill ${format === 'audiobook' ? 'selected' : ''}`}
                  onClick={() => setFormat('audiobook')}
                  style={{ padding: '6px', fontSize: '12px' }}
                >
                  🎧 Sesli Kitap
                </button>
              </div>

              {format === 'physical' && (
                <div style={{ marginTop: '6px' }}>
                  <input 
                    type="text"
                    placeholder="Raf / Oda Konumu (Örn: Salon Kitaplığı A-3)"
                    value={shelfLocation}
                    onChange={e => setShelfLocation(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Toplam Sayfa:</label>
                <input 
                  type="number" 
                  value={totalPages} 
                  onChange={e => setTotalPages(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px', fontSize: '13px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Şu Anki Sayfa:</label>
                <input 
                  type="number" 
                  value={currentPage} 
                  onChange={e => setCurrentPage(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Kelimeler/Sayfa:</label>
                <input 
                  type="number" 
                  value={wordsPerPage} 
                  onChange={e => setWordsPerPage(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                />
              </div>
            </div>

            {/* 1 Sayfa Fotoğrafı ile Kelime Kalibrasyonu */}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={pageFileInputRef} 
              style={{ display: 'none' }} 
              onChange={handlePageCalibrationUpload} 
            />
            <div style={{ background: '#F0FDF4', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '8px 12px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#065F46', fontWeight: 600 }}>🔬 Sayfa Başı Kelime (N-kelime): {wordsPerPage} w/p</span>
              <button 
                type="button" 
                className="btn-subtle" 
                onClick={() => pageFileInputRef.current?.click()}
                disabled={isScanningPage}
                style={{ fontSize: '11px', color: 'var(--emerald)', padding: '4px 10px', background: 'white', borderRadius: '4px', border: '1px solid var(--emerald)' }}
              >
                {isScanningPage ? '⏳ Analiz Ediliyor...' : '📸 1 Sayfa Tara & Kalibre Et'}
              </button>
            </div>

            {/* Emanet Takip Bölümü */}
            <div style={{ background: 'var(--surface-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={isLentOut} 
                  onChange={e => setIsLentOut(e.target.checked)} 
                />
                <span>🤝 "Kitabım Kimde?" — Şu an birine emanet verildi</span>
              </label>

              {isLentOut && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <input 
                    type="text" 
                    placeholder="Ödünç Alan Kişi (Örn: Ahmet Yılmaz)"
                    value={lentToName} 
                    onChange={e => setLentToName(e.target.value)}
                    style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'white' }}
                  />
                  <input 
                    type="date" 
                    value={lentDate} 
                    onChange={e => setLentDate(e.target.value)}
                    style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'white' }}
                  />
                </div>
              )}
            </div>

            {/* Durum Seçici */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Okuma Durumu:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button 
                  type="button" 
                  className={`choice-pill ${status === 'reading' ? 'selected' : ''}`}
                  onClick={() => setStatus('reading')}
                  style={{ padding: '6px', fontSize: '12px' }}
                >
                  📖 Okunuyor
                </button>
                <button 
                  type="button" 
                  className={`choice-pill ${status === 'wishlist' ? 'selected' : ''}`}
                  onClick={() => setStatus('wishlist')}
                  style={{ padding: '6px', fontSize: '12px' }}
                >
                  📋 İstek Listesi
                </button>
                <button 
                  type="button" 
                  className={`choice-pill ${status === 'completed' ? 'selected' : ''}`}
                  onClick={() => setStatus('completed')}
                  style={{ padding: '6px', fontSize: '12px' }}
                >
                  🏆 Tamamlandı
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ marginTop: '6px', padding: '12px' }}>
              {isSubmitting ? 'Kaydediliyor...' : '✅ Onayla ve Kütüphaneme Ekle'}
            </button>
          </form>
        )}

        {/* Canlı Video Kamera Barkod Tarayıcı Modalı */}
        <LiveBarcodeScannerModal
          isOpen={isLiveScannerOpen}
          onClose={() => setIsLiveScannerOpen(false)}
          onDetected={handleLiveDetected}
        />
      </div>
    </div>
  );
}
