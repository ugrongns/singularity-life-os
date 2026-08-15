'use client';
import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface TimeDepositCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accounts: Account[];
  onSuccess: (msg: string) => void;
}

export default function TimeDepositCloseModal({
  isOpen,
  onClose,
  accountId,
  accounts,
  onSuccess
}: TimeDepositCloseModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);

  const [targetAccountId, setTargetAccountId] = useState('');
  const [actualInterestEarned, setActualInterestEarned] = useState<string>('');
  const [closeNotes, setCloseNotes] = useState('');

  useEffect(() => {
    if (isOpen && accountId) {
      setLoading(true);
      setErrorMsg(null);
      setDetails(null);
      setActualInterestEarned('');
      setCloseNotes('');

      fetch(`/api/budget/time-deposit?id=${accountId}`)
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            setDetails(json.data);
            setActualInterestEarned(String(json.data.calculatedInterest));
            // Pre-select funding account if valid
            const sourceId = json.data.deposited_account_id;
            const validSource = accounts.find(a => a.id === sourceId && a.type !== 'credit_card');
            if (validSource) {
              setTargetAccountId(validSource.id);
            } else {
              const bankAcc = accounts.find(a => a.type === 'bank' || a.type === 'cash');
              if (bankAcc) setTargetAccountId(bankAcc.id);
            }
          } else {
            setErrorMsg(json.error || 'Vadeli mevduat detayları yüklenemedi.');
          }
        })
        .catch(() => {
          setErrorMsg('Bir ağ hatası oluştu.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, accountId, accounts]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAccountId) {
      setErrorMsg('Lütfen paranın aktarılacağı vadesiz hesabı seçin.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/budget/time-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          targetAccountId,
          actualInterestEarned: parseFloat(actualInterestEarned) || 0,
          closeNotes
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(json.message);
        onClose();
      } else {
        setErrorMsg(json.error || 'İşlem gerçekleştirilemedi.');
      }
    } catch {
      setErrorMsg('Bir sunucu hatası oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number, cur: string = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="sheet-handle"></div>
        <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🏛️</span>
          <span>Vadeli Mevduat Hesabını Kapat (Vade Sonu)</span>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Hesap detayları ve faiz hesaplaması yükleniyor...
          </div>
        )}

        {errorMsg && (
          <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {!loading && details && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Detay Kartı */}
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                {details.name} Detayları
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12px' }}>
                <div>Anapara: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(details.principal, details.currency)}</strong></div>
                <div>Faiz Oranı: <strong style={{ color: 'var(--text-main)' }}>%{details.interest_rate} (Yıllık)</strong></div>
                <div>Vade Süresi: <strong style={{ color: 'var(--text-main)' }}>{details.days} Gün</strong></div>
                <div>Mevduat Başlangıç: <strong style={{ color: 'var(--text-muted)' }}>{details.created_at.slice(0, 10)}</strong></div>
                {details.maturity_date && (
                  <div style={{ gridColumn: 'span 2' }}>
                    Vade Bitiş Tarihi: <strong style={{ color: '#10B981' }}>{details.maturity_date}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Faiz Geliri Uyarısı / Tahmini */}
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
              🤖 Sistem tarafından hesaplanan tahmini brüt faiz getirisi: <strong style={{ fontSize: '13px' }}>{formatCurrency(details.calculatedInterest, details.currency)}</strong>. Banka stopaj kesintisi nedeniyle net yatan faiz farklı olabilir, lütfen gerçek tutarı aşağıda düzeltin.
            </div>

            {/* Hedef Hesap Seçici */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                📥 PARANIN AKTARILACAĞI VADESİZ HESAP *
              </label>
              <select
                value={targetAccountId}
                onChange={e => setTargetAccountId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', fontWeight: 600 }}
                required
              >
                <option value="">-- Bir Vadesiz Hesap Seçin --</option>
                {accounts.filter(a => a.type === 'bank' || a.type === 'cash' || a.type === 'vault').map(acc => (
                  <option key={acc.id} value={acc.id}>
                    🏦 {acc.name} (Bakiye: {formatCurrency(acc.balance, acc.currency)})
                  </option>
                ))}
              </select>
            </div>

            {/* Gerçek Net Faiz */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                💵 HESABA YATAN NET FAİZ GETİRİSİ *
              </label>
              <div style={{ position: 'relative', marginTop: '4px' }}>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={actualInterestEarned}
                  onChange={e => setActualInterestEarned(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', paddingRight: '40px' }}
                />
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, fontSize: '13px', color: 'var(--text-muted)' }}>
                  {details.currency}
                </span>
              </div>
            </div>

            {/* Açıklama */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AÇIKLAMA / NOTLAR</label>
              <textarea
                placeholder="Örn: Garanti Bankası vadeli vade sonu kapanış"
                value={closeNotes}
                onChange={e => setCloseNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', resize: 'none' }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button type="button" onClick={onClose} className="btn-subtle" style={{ flex: 1, padding: '12px' }}>
                Vazgeç
              </button>
              <button type="submit" className="btn-primary" disabled={submitting} style={{ flex: 2, padding: '12px', fontWeight: 800, background: '#10B981', borderColor: '#10B981' }}>
                {submitting ? 'Kapatılıyor...' : '✅ Vadeyi Kapat ve Parayı Aktar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
