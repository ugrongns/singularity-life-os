'use client';
import { useState, useEffect } from 'react';
import { ArrowLeftRight, CreditCard, X, AlertTriangle } from 'lucide-react';

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

  // ESC tuşuyla kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    } catch {
      setErrorMsg('Sunucu hatası.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="sheet-handle" />

        {/* Modal Başlık */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className={`icon-badge ${isCardPayment ? 'icon-badge-indigo' : 'icon-badge-emerald'}`}>
              {isCardPayment ? <CreditCard size={18} strokeWidth={1.75} /> : <ArrowLeftRight size={18} strokeWidth={1.75} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {isCardPayment ? 'Kart Borcu Ödeme' : 'Transfer & Para Aktarımı'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                Hesaplar arası bakiye transferi veya kredi kartı borç kapatma
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Kapat"
            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
            {errorMsg}
          </div>
        )}

        {isInsufficientBalance && selectedFrom && (
          <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} strokeWidth={1.75} />
            <span>Yetersiz Bakiye! {selectedFrom.name} hesabında en fazla <strong className="tabular-nums">{formatMoney(selectedFrom.balance)}</strong> nakit var.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Çıkış Hesabı */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Paranın Çıkacağı Hesap *
            </label>
            <select
              value={fromAccountId}
              onChange={e => setFromAccountId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)', fontWeight: 600 }}
            >
              {accounts.filter(a => a.type !== 'credit_card').map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — Bakiye: {formatMoney(acc.balance, acc.currency)}
                </option>
              ))}
            </select>
          </div>

          {/* Hedef Hesap */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Paranın Gireceği Hesap (Hedef) *
            </label>
            <select
              value={toAccountId}
              onChange={e => setToAccountId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)', fontWeight: 600 }}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id} disabled={acc.id === fromAccountId}>
                  {acc.type === 'credit_card' ? '💳 ' : '🏦 '}
                  {acc.name} {acc.type === 'credit_card' ? `(Güncel Borç: ${formatMoney(acc.balance, acc.currency)})` : `(Bakiye: ${formatMoney(acc.balance, acc.currency)})`}
                  {acc.id === fromAccountId ? ' [Çıkış Hesabıyla Aynı]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Kart Borcu Ödeme İpuçları & Hızlı Doldurma Butonları */}
          {isCardPayment && selectedTo && selectedTo.balance > 0 && (
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Kartın Güncel Toplam Borcu:
                </span>
                <span className="tabular-nums" style={{ fontSize: '14px', fontWeight: 800, color: '#DC2626' }}>
                  {formatMoney(selectedTo.balance, selectedTo.currency)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleFillDebt}
                  className="btn-subtle"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '11px', fontWeight: 700 }}
                >
                  Maks. Ödenebilir ({selectedFrom ? formatMoney(Math.min(selectedTo.balance, selectedFrom.balance)) : '0 ₺'})
                </button>
                <button
                  type="button"
                  onClick={handleFillFullDebt}
                  className="btn-subtle"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: '#DC2626' }}
                >
                  Tamamını Kapat ({formatMoney(selectedTo.balance)})
                </button>
              </div>
            </div>
          )}

          {/* Tutar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Aktarılacak Tutar (TL) *
              </label>
              {selectedFrom && (
                <span className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Kullanılabilir Nakit: <strong>{formatMoney(selectedFrom.balance, selectedFrom.currency)}</strong>
                </span>
              )}
            </div>
            <input
              type="number"
              required
              min={1}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="tabular-nums"
              style={{
                width: '100%', padding: '12px', fontSize: '18px', fontWeight: 900,
                border: isInsufficientBalance ? '2px solid #EF4444' : '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: isInsufficientBalance ? '#DC2626' : 'var(--text-main)',
                background: 'var(--surface-subtle)'
              }}
            />
          </div>

          {/* Not */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Açıklama / Not (Opsiyonel)
            </label>
            <input
              type="text"
              placeholder="Örn: Garanti kart ekstresi son ödeme"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)' }}
            />
          </div>

          {/* Sabit Alt Butonlar (Sticky Footer) */}
          <div className="modal-sticky-footer" style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-subtle"
              style={{ flex: 1, padding: '12px', fontSize: '13px', fontWeight: 600, minHeight: '44px' }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving || isInsufficientBalance}
              className="btn-primary"
              style={{
                flex: 2, padding: '12px', fontSize: '13px', fontWeight: 800,
                opacity: isInsufficientBalance ? 0.5 : 1,
                cursor: isInsufficientBalance ? 'not-allowed' : 'pointer',
                margin: 0,
                minHeight: '44px'
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
