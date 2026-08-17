'use client';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddBookModal({ isOpen, onClose }: AddBookModalProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: '#18181b', border: '1px solid #27272a', borderRadius: '20px',
        padding: '24px', maxWidth: '500px', width: '100%', color: '#fff', textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>📚 Kitap Ekle</h2>
        <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '24px' }}>
          Kitap tarama modülü sil baştan yapılandırılıyor.
        </p>
        <button
          onClick={onClose}
          style={{
            background: '#3f3f46', color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: '10px', cursor: 'pointer'
          }}
        >
          Kapat
        </button>
      </div>
    </div>
  );
}
