'use client';

interface LiveBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (isbn: string, frameBase64?: string) => void;
}

export default function LiveBarcodeScannerModal({ isOpen, onClose }: LiveBarcodeScannerModalProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: '#000', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', color: '#fff'
    }}>
      <p style={{ marginBottom: '16px' }}>Canlı Barkod Taraması Yeniden Yapılandırılıyor...</p>
      <button onClick={onClose} style={{ padding: '8px 16px', background: '#27272a', color: '#fff', borderRadius: '8px', border: 'none' }}>
        Kapat
      </button>
    </div>
  );
}
