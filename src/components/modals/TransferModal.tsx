'use client';
import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSuccess: (msg: string) => void;
  defaultToAccountId?: string | null;
}

export default function TransferModal({
  isOpen,
  onClose,
  accounts,
  onSuccess,
  defaultToAccountId
}: TransferModalProps) {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const bankAccounts = accounts.filter(a => a.type !== 'credit_card');
      const creditCards = accounts.filter(a => a.type === 'credit_card');

      if (defaultToAccountId) {
        setToAccountId(defaultToAccountId);
        const firstBank = bankAccounts[0];
        if (firstBank) setFromAccountId(firstBank.id);
      } else {
        if (bankAccounts.length > 0) setFromAccountId(bankAccounts[0].id);
        if (creditCards.length > 0) setToAccountId(creditCards[0].id);
        else if (bankAccounts.length > 1) setToAccountId(bankAccounts[1].id);
      }
      setAmount('');
      setNote('');
      setErrorMsg(null);
    }
  }, [isOpen, defaultToAccountId, accounts]);

  if (!isOpen) return null;

  const formatMoney = (val: number, cur: string = 'TRY') => {
    if (cur === 'GOLD') return `${(val || 0).toLocaleString('tr-TR')} ₺ (Kasa/Altın)`;
    const validCur = ['TRY', 'USD', 'EUR', 'GBP'].includes(cur) ? cur : 'TRY';
    try {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: validCur, maximumFractionDigits: 0 }).format(val || 0);
    } catch {
      return `${(val || 0).toLocaleString('tr-TR')} ₺`;
    }
  };

  const selectedFrom = accounts.find(a => a.id === fromAccountId);
  const selectedTo = accounts.find(a => a.id === toAccountId);
  const isCardPayment = selectedTo?.type === 'credit_card';

  // Yetersiz bakiye kontrolü
  const isInsufficientBalance = Boolean(
    selectedFrom &&
    selectedFrom.type !== 'credit_card' &&
    amount !== '' &&
    Number(amount) > selectedFrom.balance
  );

  // Borç Doldurma: Nakit yetersizse çıkış hesabındaki maksimum bakiyeyi doldur, yetiyorsa kart borcunun tamamını doldur
  const handleFillDebt = () => {
    if (selectedTo && selectedFrom) {
      const maxPossible = Math.min(selectedTo.balance, selectedFrom.balance);
      setAmount(maxPossible);
    }
  };

  const handleFillFullDebt = () => {
    if (selectedTo) {
      setAmount(selectedTo.balance);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || !amount || Number(amount) <= 0) {
      setErrorMsg('Lütfen geçerli bir tutar ve hesap seçin.');
      return;
    }
    if (fromAccountId === toAccountId) {
      setErrorMsg('Çıkış hesabı ve hedef hesap aynı olamaz.');
      return;
    }
    if (isInsufficientBalance) {
      setErrorMsg(`Yetersiz Bakiye! Çıkış hesabınızda sadece ${formatMoney(selectedFrom?.balance || 0)} nakit bulunmaktadır.`);
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/budget/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount: Number(amount),
          note
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(json.message);
        onClose();
      } else {
        setErrorMsg(json.error || 'İşlem başarısız.');
      }
    } catch (err: any) {
      setErrorMsg('Sunucu hatası.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '460px', width: '100%',
        boxShadow: 'var(--shadow-xl)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔄</span>
              <span>{isCardPayment ? '💳 Kart Borcu Ödeme' : 'Transfer & Borç Ödeme'}</span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Hesaplar arası para aktarımı veya kredi kartı borç ödemesi
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
            {errorMsg}
          </div>
        )}

        {isInsufficientBalance && selectedFrom && (
          <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <span>Yetersiz Bakiye! {selectedFrom.name} hesabında en fazla <strong>{formatMoney(selectedFrom.balance)}</strong> nakit var.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Çıkış Hesabı */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              📤 PARANIN ÇIKACAĞI HESAP *
            </label>
            <select
              value={fromAccountId}
              onChange={e => setFromAccountId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', fontWeight: 600 }}
            >
              {accounts.filter(a => a.type !== 'credit_card').map(acc => (
                <option key={acc.id} value={acc.id}>
                  🏦 {acc.name} — Bakiye: {formatMoney(acc.balance, acc.currency)}
                </option>
              ))}
            </select>
          </div>

          {/* Hedef Hesap */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              📥 HEDEF HESAP / KREDİ KARTI *
            </label>
            <select
              value={toAccountId}
              onChange={e => setToAccountId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', fontWeight: 600 }}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.type === 'credit_card' ? '💳' : '🏦'} {acc.name} {acc.type === 'credit_card' ? `— Borç: ${formatMoney(acc.balance)}` : `— Bakiye: ${formatMoney(acc.balance, acc.currency)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Kart Ödeme Vurgu Rozeti ve Borç Doldurma Butonları */}
          {isCardPayment && selectedTo && selectedFrom && (
            <div style={{
              background: '#EEF2FF', border: '1px solid #C7D2FE', padding: '12px',
              borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#4F46E5' }}>{selectedTo.name} Borç Ödemesi</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#312E81', marginTop: '2px' }}>
                    Güncel Borç: {formatMoney(selectedTo.balance)}
                  </div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Kullanılabilir Nakit: <strong>{formatMoney(selectedFrom.balance)}</strong>
                </div>
              </div>

              {selectedTo.balance > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={handleFillDebt}
                    style={{
                      flex: 1, background: '#4F46E5', color: 'white', border: 'none',
                      borderRadius: 'var(--radius-md)', padding: '6px 10px', fontSize: '11px', fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ⚡ {selectedFrom.balance < selectedTo.balance ? `Tüm Nakdi Doldur (${formatMoney(selectedFrom.balance)})` : `Borcu Doldur (${formatMoney(selectedTo.balance)})`}
                  </button>

                  {selectedFrom.balance < selectedTo.balance && (
                    <button
                      type="button"
                      onClick={handleFillFullDebt}
                      style={{
                        background: 'var(--surface)', color: 'var(--indigo)', border: '1px solid var(--indigo)',
                        borderRadius: 'var(--radius-md)', padding: '6px 10px', fontSize: '11px', fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      💳 Tam Borç
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tutar */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              TRANSFER TUTARI (₺) *
            </label>
            <input
              type="number"
              required
              min={1}
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              style={{
                width: '100%', padding: '12px', fontSize: '18px', fontWeight: 900,
                border: isInsufficientBalance ? '2px solid #EF4444' : '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', marginTop: '4px',
                color: isInsufficientBalance ? '#DC2626' : 'var(--text-main)'
              }}
            />
          </div>

          {/* Not */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              AÇIKLAMA / NOT (OPSİYONEL)
            </label>
            <input
              type="text"
              placeholder="Örn: Garanti kart ekstresi son ödeme"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-subtle"
              style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600 }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving || isInsufficientBalance}
              className="btn-primary"
              style={{
                flex: 2, padding: '10px', fontSize: '13px', fontWeight: 800,
                opacity: isInsufficientBalance ? 0.5 : 1,
                cursor: isInsufficientBalance ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'İşleniyor...' : isCardPayment ? '💳 Ödemeyi Tamamla' : '🔄 Transfer Et'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
