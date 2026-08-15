'use client';
import { useState } from 'react';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
}

interface DividendModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  accounts: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

export default function DividendModal({ isOpen, onClose, assets, accounts, onSuccess }: DividendModalProps) {
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id || 'asset-thyao');
  const [amountPerShare, setAmountPerShare] = useState('8.50');
  const [totalAmount, setTotalAmount] = useState('10200');
  const [treatmentType, setTreatmentType] = useState<'cash_payout' | 'drip_reinvest'>('cash_payout');
  const [walletId, setWalletId] = useState(accounts[0]?.id || 'wallet-isbank');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalAmount || parseFloat(totalAmount) <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/investments/dividends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: selectedAssetId,
          amount_per_share: parseFloat(amountPerShare) || 0,
          total_amount: parseFloat(totalAmount),
          treatment_type: treatmentType,
          wallet_id: walletId
        })
      });
      const json = await res.json();
      if (json.success) {
        onSuccess();
        onClose();
      } else {
        alert(json.error || 'Temettü kaydedilemedi.');
      }
    } catch (err) {
      alert('İşlem hatası.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="sheet-handle"></div>
        <div style={{ fontSize: '17px', fontWeight: 700 }}>💵 Temettü & Kâr Payı Dağıtımı</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Hisse / Varlık:</label>
            <select 
              value={selectedAssetId} 
              onChange={e => setSelectedAssetId(e.target.value)}
              style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            >
              {assets.map(a => (
                <option key={a.id} value={a.id}>{a.symbol} - {a.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Hisse Başı Temettü (TL):</label>
              <input 
                type="number" 
                step="0.01" 
                value={amountPerShare} 
                onChange={e => setAmountPerShare(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Toplam Tutar (TL):</label>
              <input 
                type="number" 
                step="0.01" 
                value={totalAmount} 
                onChange={e => setTotalAmount(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
              Temettü Kullanım Modeli (Esnek İşleme):
            </label>
            <div className="btn-pill-group">
              <button 
                type="button" 
                className={`choice-pill ${treatmentType === 'cash_payout' ? 'selected' : ''}`}
                onClick={() => setTreatmentType('cash_payout')}
              >
                💵 Nakit Bankaya Aktar (Gelir)
              </button>
              <button 
                type="button" 
                className={`choice-pill ${treatmentType === 'drip_reinvest' ? 'selected' : ''}`}
                onClick={() => setTreatmentType('drip_reinvest')}
              >
                📈 DRIP: Otomatik Hisse Al
              </button>
            </div>
          </div>

          {treatmentType === 'cash_payout' && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Paranın Yatacağı Hesap:</label>
              <select 
                value={walletId} 
                onChange={e => setWalletId(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'İşleniyor...' : 'Temettüyü İşle'}
          </button>
        </form>
      </div>
    </div>
  );
}
