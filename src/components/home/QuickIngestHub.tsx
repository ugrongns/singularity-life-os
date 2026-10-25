'use client';
import { useState } from 'react';
import { Mic, ReceiptText, Camera, ScanLine, Droplets, Pill, Zap, Check } from 'lucide-react';

interface QuickIngestHubProps {
  onOpenReceiptScan: () => void;
  onOpenFoodScan: () => void;
  onOpenVoiceCommand: () => void;
  onOpenBarcodeScan?: () => void;
  onOpenReadingSession?: () => void;
  onQuickAddWater: () => void;
  onQuickTakeSupplements: () => void;
}

export default function QuickIngestHub({
  onOpenReceiptScan,
  onOpenFoodScan,
  onOpenVoiceCommand,
  onOpenBarcodeScan,
  onOpenReadingSession,
  onQuickAddWater,
  onQuickTakeSupplements
}: QuickIngestHubProps) {
  const [justActioned, setJustActioned] = useState<string | null>(null);

  const triggerFeedback = (actionName: string, cb: () => void) => {
    setJustActioned(actionName);
    cb();
    setTimeout(() => {
      setJustActioned(null);
    }, 1200);
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '16px',
        height: '100%',
        minHeight: '260px'
      }}
    >
      {/* Kart Başlığı */}
      <div className="card-header-block" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="icon-badge icon-badge-indigo">
            <Zap size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              Sıfır Sürtünme
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Hızlı İşlem Merkezi
            </h2>
          </div>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--emerald)',
            background: 'var(--emerald-bg)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-full)'
          }}
        >
          Canlı AI Hub
        </span>
      </div>

      {/* 2x2 Dokunsal Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          width: '100%'
        }}
      >
        {/* 1. Sesli Komut */}
        <button
          type="button"
          onClick={onOpenVoiceCommand}
          className="touch-target"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: '52px'
          }}
        >
          <div className="icon-badge icon-badge-indigo" style={{ width: '32px', height: '32px', borderRadius: '8px' }}>
            <Mic size={16} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700 }}>Sesli Komut</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Yapay Zeka</div>
          </div>
        </button>

        {/* 2. Fiş & Fatura Tara */}
        <button
          type="button"
          onClick={onOpenReceiptScan}
          className="touch-target"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: '52px'
          }}
        >
          <div className="icon-badge icon-badge-emerald" style={{ width: '32px', height: '32px', borderRadius: '8px' }}>
            <ReceiptText size={16} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700 }}>Fiş / QR Tara</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Otomatik Gider</div>
          </div>
        </button>

        {/* 3. Yemek Tabağı Tara */}
        <button
          type="button"
          onClick={onOpenFoodScan}
          className="touch-target"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: '52px'
          }}
        >
          <div className="icon-badge icon-badge-amber" style={{ width: '32px', height: '32px', borderRadius: '8px' }}>
            <Camera size={16} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700 }}>Tabak Tara</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Makro & Kalori</div>
          </div>
        </button>

        {/* 4. Barkod / Karekod Tara */}
        <button
          type="button"
          onClick={onOpenBarcodeScan || onOpenReceiptScan}
          className="touch-target"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: '52px'
          }}
        >
          <div className="icon-badge icon-badge-blue" style={{ width: '32px', height: '32px', borderRadius: '8px' }}>
            <ScanLine size={16} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700 }}>Barkod Tara</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Gıda / Kitap / QR</div>
          </div>
        </button>
      </div>

      {/* Alt Mikro-Aksiyonlar: Hızlı Su & Takviye */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          paddingTop: '10px',
          borderTop: '1px solid var(--border)'
        }}
      >
        <button
          type="button"
          onClick={() => triggerFeedback('water', onQuickAddWater)}
          className="touch-target"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: justActioned === 'water' ? 'var(--blue)' : 'var(--blue-bg)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: justActioned === 'water' ? '#FFFFFF' : 'var(--blue)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {justActioned === 'water' ? <Check size={14} /> : <Droplets size={14} />}
          <span>{justActioned === 'water' ? 'Eklendi (+500ml)' : '+500ml Su İç'}</span>
        </button>

        <button
          type="button"
          onClick={() => triggerFeedback('supp', onQuickTakeSupplements)}
          className="touch-target"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: justActioned === 'supp' ? 'var(--emerald)' : 'var(--emerald-bg)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: justActioned === 'supp' ? '#FFFFFF' : 'var(--emerald)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {justActioned === 'supp' ? <Check size={14} /> : <Pill size={14} />}
          <span>{justActioned === 'supp' ? 'Hepsi Alındı' : 'Takviyeleri Al'}</span>
        </button>
      </div>
    </div>
  );
}
