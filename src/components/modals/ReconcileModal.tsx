'use client';
import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  credit_limit?: number;
  owner_name?: string;
  owner_avatar?: string;
}

interface ReconcileModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function ReconcileModal({ isOpen, account, onClose, onSuccess }: ReconcileModalProps) {
  const [realBalance, setRealBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isCreditCard = account?.type === 'credit_card';

  useEffect(() => {
    if (account) {
      setRealBalance(String(account.balance || 0));
      setNotes('');
      setErrorMsg(null);
    }
  }, [account, isOpen]);

  if (!isOpen || !account) return null;

  const currentBalance = account.balance || 0;
  const targetNum = parseFloat(realBalance.replace(',', '.')) || 0;
  const hasValidTarget = !isNaN(targetNum) && realBalance.trim() !== '';

  // Fark hesaplama
  // Kredi kartlarında balance = borç. Borç arttıysa gider, azaldıysa gelir.
  // Normal hesaplarda bakiye arttıysa gelir, azaldıysa gider.
  const rawDiff = Math.round((targetNum - currentBalance) * 100) / 100;
  const diff = isCreditCard ? rawDiff : rawDiff;
  const isIncome = isCreditCard ? rawDiff < 0 : rawDiff > 0;
  const isExpense = isCreditCard ? rawDiff > 0 : rawDiff < 0;
  const isExactMatch = rawDiff === 0;

  const formatMoney = (val: number) => {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasValidTarget) {
      setErrorMsg('Lütfen geçerli bir gerçek bakiye girin.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/budget/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: account.id,
          real_balance: targetNum,
          notes: notes.trim()
        })
      });

      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        onSuccess(json.message);
        onClose();
      } else {
        setErrorMsg(json.error || 'Mutabakat işlemi başarısız.');
      }
    } catch {
      setErrorMsg('Bağlantı hatası oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="sheet-handle"></div>

        {/* Modal Başlığı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚖️ Bakiye Mutabakatı (Eşitleme)</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Gerçek banka ekstreniz veya cüzdanınız ile sistem bakiyesini dengeleyin
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {errorMsg && (
          <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
            {errorMsg}
          </div>
        )}

        {/* Seçili Hesap Özeti */}
        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                {account.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {account.owner_name ? `${account.owner_avatar || '👤'} ${account.owner_name}` : 'Ortak Hesap'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                {isCreditCard ? 'Kayıtlı Kart Borcu' : 'Kayıtlı Bakiye'}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: isCreditCard ? '#DC2626' : '#10B981' }}>
                {formatMoney(currentBalance)} {account.currency}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Gerçek Bakiye Girişi */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              {isCreditCard ? '💳 Bankadaki / Ekstrenizdeki Güncel Borç Tutarı *' : '🏦 Bankadaki / Gerçekteki Güncel Bakiye *'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                step="0.01"
                required
                value={realBalance}
                onChange={e => setRealBalance(e.target.value)}
                placeholder="0.00"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  paddingRight: '60px',
                  fontSize: '18px',
                  fontWeight: 800,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  color: 'var(--text-main)'
                }}
              />
              <span style={{
                position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)'
              }}>
                {account.currency}
              </span>
            </div>
          </div>

          {/* Hızlı Butonlar */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setRealBalance(String(currentBalance))}
              style={{
                fontSize: '11px', padding: '4px 8px', borderRadius: '6px',
                border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600
              }}
            >
              🔄 Bakiye Doğru (Fark Yok)
            </button>
            <button
              type="button"
              onClick={() => setRealBalance(String(Math.round((targetNum + 100) * 100) / 100))}
              style={{
                fontSize: '11px', padding: '4px 8px', borderRadius: '6px',
                border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600
              }}
            >
              +100
            </button>
            <button
              type="button"
              onClick={() => setRealBalance(String(Math.round((targetNum + 500) * 100) / 100))}
              style={{
                fontSize: '11px', padding: '4px 8px', borderRadius: '6px',
                border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600
              }}
            >
              +500
            </button>
            <button
              type="button"
              onClick={() => setRealBalance(String(Math.max(0, Math.round((targetNum - 100) * 100) / 100)))}
              style={{
                fontSize: '11px', padding: '4px 8px', borderRadius: '6px',
                border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600
              }}
            >
              -100
            </button>
          </div>

          {/* Canlı Fark Kartı (Otomatik Muhasebe Açıklaması) */}
          {hasValidTarget && (
            <div style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: isExactMatch ? '1px solid #10B981' : isIncome ? '1px solid #10B981' : '1px solid #F59E0B',
              background: isExactMatch ? 'rgba(16, 185, 129, 0.08)' : isIncome ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)'
            }}>
              {isExactMatch ? (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#065F46' }}>
                    ✅ Bakiyeler Birebir Eşleşiyor
                  </div>
                  <div style={{ fontSize: '11px', color: '#047857', marginTop: '3px' }}>
                    Sistem ve banka arasında herhangi bir fark bulunmuyor. Ek işlem oluşturulmayacak, hesap son mutabakat tarihi onaylanacaktır.
                  </div>
                </div>
              ) : isIncome ? (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#065F46', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📈 +{formatMoney(Math.abs(rawDiff))} {account.currency} (Düzeltme Geliri)</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#047857', marginTop: '3px' }}>
                    {isCreditCard
                      ? 'Kart borcunuz azaldığı için aradaki fark bakiye düzeltme geliri (borç ödemesi) olarak kaydedilecektir.'
                      : 'Gerçek bakiyeniz sistemdekinden yüksek olduğu için aradaki fark otomatik "Bakiye Mutabakatı" geliri olarak işlenecektir.'}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400E', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📉 -{formatMoney(Math.abs(rawDiff))} {account.currency} (Düzeltme Gideri)</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#B45309', marginTop: '3px' }}>
                    {isCreditCard
                      ? 'Kart borcunuz sistemdekinden yüksek olduğu için aradaki fark otomatik "Bakiye Mutabakatı" harcaması olarak kaydedilecektir.'
                      : 'Gerçek bakiyeniz sistemdekinden düşük olduğu için aradaki eksiklik otomatik "Bakiye Mutabakatı" gideri olarak cüzdandan düşülecektir.'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Opsiyonel Açıklama Notu */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              MUTABAKAT NOTU (İSTEĞE BAĞLI)
            </label>
            <input
              type="text"
              placeholder="Örn: Garanti mobil hesap özetiyle mutabakat yapıldı"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                marginTop: '4px',
                background: 'var(--surface)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !hasValidTarget}
            style={{
              padding: '13px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Mutabakat Kaydediliyor...' : '⚖️ Mutabakatı Onayla & Bakiyeyi Güncelle'}
          </button>
        </form>
      </div>
    </div>
  );
}
