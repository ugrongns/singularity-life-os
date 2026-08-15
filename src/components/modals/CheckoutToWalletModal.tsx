'use client';
import { useState } from 'react';

interface Wallet {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface CheckoutToWalletModalProps {
  isOpen: boolean;
  wallets: Wallet[];
  totalAmount: number;
  checkedCount: number;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function CheckoutToWalletModal({
  isOpen,
  wallets,
  totalAmount,
  checkedCount,
  onClose,
  onSuccess
}: CheckoutToWalletModalProps) {
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWalletId) {
      alert('Lütfen harcama yapılacak bir cüzdan seçin.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkout_to_wallet',
          wallet_id: selectedWalletId
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(json.message || '💳 Harcama cüzdanınıza işlendi ve ürünler temizlendi!');
        onClose();
      } else {
        alert(json.error || 'İşlem başarısız.');
      }
    } catch {
      alert('Harcama aktarma hatası.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTRY = (v: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
            💳 Alışverişi Cüzdana İşle
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ background: '#F0FDF4', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid #BBF7D0', marginBottom: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#166534', fontWeight: 800, textTransform: 'uppercase' }}>
            ALINAN {checkedCount} ADET ÜRÜN TOPLAMI
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#15803D', marginTop: '2px' }}>
            {formatTRY(totalAmount)}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>HARCAMA YAPILAN CÜZDAN / KART *</label>
            <select
              value={selectedWalletId}
              onChange={e => setSelectedWalletId(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'white' }}
            >
              {wallets.map(w => (
                <option key={w.id} value={w.id}>
                  💳 {w.name} ({formatTRY(w.balance)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '8px 10px', borderRadius: '6px' }}>
            ℹ️ <strong>Not:</strong> Bu işlem alınan tüm ürünlerin toplam tutarını bütçenize harcama olarak işler ve listedeki alınan ürünleri otomatik temizler.
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'İşleniyor...' : '💳 Harcamayı Cüzdana Aktar ve Bitir'}
          </button>
        </form>
      </div>
    </div>
  );
}
