'use client';
import { useState } from 'react';

interface QuickIngestHubProps {
  onOpenReceiptScan: () => void;
  onOpenFoodScan: () => void;
  onOpenVoiceCommand: () => void;
  onOpenReadingSession: () => void;
  onQuickAddWater: () => void;
  onQuickTakeSupplements: () => void;
}

export default function QuickIngestHub({
  onOpenReceiptScan,
  onOpenFoodScan,
  onOpenVoiceCommand,
  onOpenReadingSession,
  onQuickAddWater,
  onQuickTakeSupplements
}: QuickIngestHubProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [justActioned, setJustActioned] = useState<string | null>(null);

  const triggerFeedback = (actionName: string, cb: () => void) => {
    setJustActioned(actionName);
    cb();
    setTimeout(() => {
      setJustActioned(null);
      setIsOpen(false);
    }, 900);
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 140,
            transition: 'opacity 0.2s ease'
          }}
        />
      )}

      {/* Floating Action Container */}
      <div className="quick-ingest-container">
        {/* Radial Action Items Panel */}
        {isOpen && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              backdropFilter: 'blur(16px)',
              minWidth: '220px',
              animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px' }}>
              ⚡ Sıfır Sürtünmeli Hızlı Giriş
            </div>

            {/* 📸 Fiş Tara */}
            <button
              onClick={() => { setIsOpen(false); onOpenReceiptScan(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-main)', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '18px' }}>📸</span>
              <span>Fiş & Fatura Tara</span>
            </button>

            {/* 🥗 Yemek Tabağı Tara */}
            <button
              onClick={() => { setIsOpen(false); onOpenFoodScan(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-main)', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '18px' }}>🥗</span>
              <span>Yemek Tabağı Tara</span>
            </button>

            {/* 💧 +500ml Su Ekle */}
            <button
              onClick={() => triggerFeedback('Su Eklendi (+500ml)', onQuickAddWater)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                background: 'var(--blue-bg)', border: '1px solid var(--blue)',
                borderRadius: 'var(--radius-md)', color: 'var(--blue)', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '18px' }}>💧</span>
              <span>{justActioned?.includes('Su') ? '✓ Kaydedildi (+500ml)' : '+500ml Su İçildi'}</span>
            </button>

            {/* 💊 Takviyeleri Alındı İşaretle */}
            <button
              onClick={() => triggerFeedback('Takviyeler Alındı', onQuickTakeSupplements)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                background: 'var(--emerald-bg)', border: '1px solid var(--emerald)',
                borderRadius: 'var(--radius-md)', color: 'var(--emerald)', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '18px' }}>💊</span>
              <span>{justActioned?.includes('Takviye') ? '✓ Hepsi Alındı' : 'Tüm Takviyeleri Al'}</span>
            </button>

            {/* 📖 Okuma Seansı */}
            <button
              onClick={() => { setIsOpen(false); onOpenReadingSession(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-main)', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '18px' }}>📖</span>
              <span>Okuma Seansı Başlat</span>
            </button>

            {/* 🎙️ Sesli Çoklu Komut */}
            <button
              onClick={() => { setIsOpen(false); onOpenVoiceCommand(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                background: 'var(--indigo-bg)', border: '1px solid var(--indigo)',
                borderRadius: 'var(--radius-md)', color: 'var(--indigo)', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '18px' }}>🎙️</span>
              <span>Sesli Komut Söyle</span>
            </button>
          </div>
        )}

        {/* Ana FAB Düğmesi */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '28px',
            background: isOpen ? 'var(--rose)' : 'linear-gradient(135deg, #10B981, #3B82F6)',
            color: '#FFFFFF',
            border: 'none',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isOpen ? '22px' : '24px',
            fontWeight: 700,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: isOpen ? 'rotate(90deg)' : 'scale(1)'
          }}
          title="Hızlı Eylem & Tara Hub"
        >
          {isOpen ? '✕' : '⚡'}
        </button>
      </div>
    </>
  );
}
