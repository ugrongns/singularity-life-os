'use client';
import { useState } from 'react';
import { CreditCard, X, ShoppingCart, CheckCircle2, AlertCircle } from 'lucide-react';

interface Wallet {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  owner_name?: string;
  owner_avatar?: string;
  is_joint?: boolean;
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
      alert('Lütfen harcama yapılacak bir cüzdan veya kart seçin.');
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
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        onSuccess(json.message || '💳 Harcama cüzdanınıza işlendi ve alınan ürünler temizlendi!');
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

  const formatTRY = (v: number) => 
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div 
        className="bottom-sheet" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="sheet-handle" />

        {/* Modal Başlık Barı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-emerald">
              <CreditCard size={18} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                Kasada Öde & Bütçeye Aktar
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Sepetteki ürünleri tek tıkla cüzdandan düşüp arşive aktarın
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="modal-close-btn"
            aria-label="Kapat"
            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Sepet Tutar Özeti Vurgu Kartı */}
        <div 
          style={{ 
            background: 'var(--emerald-bg)', 
            padding: '14px', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid rgba(16, 185, 129, 0.35)', 
            marginBottom: '14px', 
            textAlign: 'center' 
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            SEPETTEKİ {checkedCount} ADET ÜRÜN TUTARI
          </div>
          <div className="tabular-nums" style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
            {formatTRY(totalAmount)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Bu tutar seçtiğiniz cüzdandan harcama olarak düşülecektir.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Cüzdan / Kart Seçimi */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>
              HARCAMA YAPILAN CÜZDAN VEYA KART *
            </label>
            <select
              value={selectedWalletId}
              onChange={e => setSelectedWalletId(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '10px 12px', 
                fontSize: '13px', 
                fontWeight: 700,
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', 
                marginTop: '4px', 
                background: 'var(--surface-subtle)', 
                color: 'var(--text-main)',
                minHeight: '44px'
              }}
            >
              {wallets.map((w: any) => {
                const owner = w.owner_name ? ` • ${w.owner_avatar || '👤'} ${w.owner_name}` : (w.is_joint ? ' • 👥 Ortak' : '');
                return (
                  <option key={w.id} value={w.id}>
                    {w.type === 'credit_card' ? '💳' : '🏦'} {w.name}{owner} ({formatTRY(w.balance)})
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', lineHeight: 1.4 }}>
            ℹ️ <strong>Otomatik İşlem:</strong> Bu onay sonrasında market harcamanız bütçenize otomatik kayıt edilecek ve sepetteki alınan ürünler listenizden temizlenecektir.
          </div>

          <div className="modal-sticky-footer" style={{ marginTop: '8px' }}>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={submitting} 
              style={{ 
                width: '100%', 
                padding: '13px', 
                fontSize: '14px', 
                fontWeight: 900, 
                minHeight: '46px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#166534'
              }}
            >
              <CreditCard size={17} />
              <span>{submitting ? 'İşleniyor...' : `Harcamayı Cüzdana Aktar (${formatTRY(totalAmount)})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
