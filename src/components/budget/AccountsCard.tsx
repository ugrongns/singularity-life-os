'use client';
import { useState, useEffect } from 'react';
import TimeDepositCloseModal from '@/components/modals/TimeDepositCloseModal';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  credit_limit?: number;
  cutoff_day?: number;
  due_day?: number;
  loan_original_amount?: number;
  loan_total_repayment?: number;
  monthly_installment_amount?: number;
  total_installments?: number;
  first_installment_date?: string;
  deposited_account_id?: string;
  currency: string;
  color?: string;
  assets_count?: number;
  assets_summary?: string;
  maturity_date?: string;
  interest_rate?: number;
  interest_type?: string;
  interest_rate_contractual?: number;
  interest_rate_late?: number;
  min_payment_percent?: number;
  overdraft_limit?: number;
}

interface AccountsCardProps {
  accounts: Account[];
  onUpdate?: (msg?: string) => void;
  onOpenCardStatement?: (accId: string) => void;
}

export default function AccountsCard({ accounts, onUpdate, onOpenCardStatement }: AccountsCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [balance, setBalance] = useState<number | ''>('');
  const [creditLimit, setCreditLimit] = useState<number | ''>('');
  const [cutoffDay, setCutoffDay] = useState<number | ''>('');
  const [dueDay, setDueDay] = useState<number | ''>('');
  const [currency, setCurrency] = useState('TRY');
  
  // Kredi Borçlanma Parametreleri
  const [loanOrigAmt, setLoanOrigAmt] = useState<number | ''>('');
  const [loanTotalRepay, setLoanTotalRepay] = useState<number | ''>('');
  const [totalInstallments, setTotalInstallments] = useState<number | ''>(24);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState<string>('');
  const [depositedAccId, setDepositedAccId] = useState<string>('');

  // Vadeli Mevduat Parametreleri
  const [maturityDate, setMaturityDate] = useState<string>('');
  const [interestRate, setInterestRate] = useState<number | ''>('');
  const [interestType, setInterestType] = useState<string>('simple');

  // Kredi Kartı & KMH Faiz / Limit Parametreleri
  const [interestRateContractual, setInterestRateContractual] = useState<number | ''>(4.25);
  const [interestRateLate, setInterestRateLate] = useState<number | ''>(4.55);
  const [overdraftLimit, setOverdraftLimit] = useState<number | ''>(20000);

  // Vadeli Kapatma Modalı
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [selectedCloseAccountId, setSelectedCloseAccountId] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Varsayılan ilk taksit tarihini gelecek aya ayarla
  // ✅ Timezone-safe YYYY-MM-DD formatter: toISOString() UTC'ye kaydırır, yerel bileşenler kullanılır
  const localDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (!firstInstallmentDate) {
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 15);
      setFirstInstallmentDate(localDateStr(nextMonth));
    }
    const bankAccounts = accounts.filter(a => a.type === 'bank' || a.type === 'cash');
    if (bankAccounts.length > 0 && !depositedAccId) {
      setDepositedAccId(bankAccounts[0].id);
    }
  }, [accounts, isModalOpen]);

  const setDeferredMonth = (monthsCount: number) => {
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() + 1 + monthsCount, 15);
    setFirstInstallmentDate(localDateStr(targetDate));
  };

  const openAddModal = () => {
    setEditingAcc(null);
    setName('');
    setType('bank');
    setBalance('');
    setCreditLimit('');
    setCutoffDay('');
    setDueDay('');
    setLoanOrigAmt('');
    setLoanTotalRepay('');
    setTotalInstallments(12);
    setMaturityDate('');
    setInterestRate('');
    setInterestType('simple');
    setInterestRateContractual(4.25);
    setInterestRateLate(4.55);
    setOverdraftLimit(20000);
    setCurrency('TRY');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (acc: Account) => {
    setEditingAcc(acc);
    setName(acc.name);
    setType(acc.type);
    setBalance(acc.balance);
    setCreditLimit(acc.credit_limit || '');
    setCutoffDay(acc.cutoff_day || '');
    setDueDay(acc.due_day || '');
    setMaturityDate(acc.maturity_date || '');
    setInterestRate(acc.interest_rate || '');
    setInterestType(acc.interest_type || 'simple');
    setInterestRateContractual(acc.interest_rate_contractual || 4.25);
    setInterestRateLate(acc.interest_rate_late || 4.55);
    setOverdraftLimit(acc.overdraft_limit || 20000);
    setCurrency(acc.currency || 'TRY');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Hesap adı zorunludur.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/budget/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAcc?.id,
          name: name.trim(),
          type,
          balance: type === 'loan' ? (Number(loanTotalRepay) || 0) : (Number(balance) || 0),
          credit_limit: type === 'credit_card' ? (Number(creditLimit) || 0) : type === 'loan' ? (Number(loanTotalRepay) || 0) : undefined,
          cutoff_day: type === 'credit_card' ? (Number(cutoffDay) || undefined) : undefined,
          due_day: type === 'credit_card' ? (Number(dueDay) || undefined) : undefined,
          loan_original_amount: type === 'loan' ? (Number(loanOrigAmt) || 0) : undefined,
          loan_total_repayment: type === 'loan' ? (Number(loanTotalRepay) || 0) : undefined,
          total_installments: type === 'loan' ? (Number(totalInstallments) || 1) : undefined,
          first_installment_date: type === 'loan' ? firstInstallmentDate : undefined,
          deposited_account_id: (type === 'loan' || type === 'time_deposit') ? depositedAccId : undefined,
          maturity_date: type === 'time_deposit' ? maturityDate : undefined,
          interest_rate: type === 'time_deposit' ? (Number(interestRate) || 0) : undefined,
          interest_type: type === 'time_deposit' ? interestType : undefined,
          interest_rate_contractual: (type === 'credit_card' || type === 'kmh') ? (Number(interestRateContractual) || 4.25) : undefined,
          interest_rate_late: type === 'credit_card' ? (Number(interestRateLate) || 4.55) : undefined,
          overdraft_limit: type === 'kmh' ? (Number(overdraftLimit) || 0) : undefined,
          currency
        })
      });

      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        if (onUpdate) onUpdate(json.message);
      } else {
        setErrorMsg(json.error || 'İşlem başarısız.');
      }
    } catch (err: any) {
      setErrorMsg('Sunucu hatası.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (accId: string, accName: string) => {
    if (!confirm(`"${accName}" hesabını silmek istediğinize emin misiniz?`)) return;

    try {
      const res = await fetch(`/api/budget/accounts?id=${accId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        if (onUpdate) onUpdate(json.message);
      } else {
        alert(json.error || 'Silme işlemi başarısız.');
      }
    } catch (err) {
      alert('Sunucu hatası.');
    }
  };

  const formatMoney = (val: number, curr = 'TRY') => {
    const symbol = curr === 'USD' ? '$' : curr === 'EUR' ? '€' : curr === 'GOLD' ? 'gr' : '₺';
    return `${val.toLocaleString('tr-TR')} ${symbol}`;
  };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>🏦</span>
          <span>Varlık & Borç Hesapları</span>
        </div>
      </div>

      <div className="card-action-bar">
        <button
          onClick={openAddModal}
          className="btn-primary"
        >
          + Yeni Hesap / Kredi Ekle
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {accounts.map(acc => {
          const isCreditCard = acc.type === 'credit_card';
          const isLoan = acc.type === 'loan';
          const isTimeDeposit = acc.type === 'time_deposit';

          const isMatured = isTimeDeposit && acc.maturity_date && new Date(acc.maturity_date) <= new Date();

          const icon = isCreditCard ? '💳' :
            isLoan ? '🏛️' :
            isTimeDeposit ? '⏳' :
            acc.type === 'cash' ? '💵' :
            acc.type === 'vault' ? '🥇' : '🏦';
          
          return (
            <div
              key={acc.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '12px 14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{acc.name}</span>
                    {isCreditCard && (
                      <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#991B1B', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        Kredi Kartı
                      </span>
                    )}
                    {isLoan && (
                      <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        🏛️ Tüketici Kredisi
                      </span>
                    )}
                    {isTimeDeposit && (
                      <span style={{ fontSize: '10px', background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        ⏳ Vadeli Mevduat
                      </span>
                    )}
                    {isMatured && (
                      <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#B91C1C', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                        ⚠️ Vade Sonu Geldi!
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {isCreditCard && (
                      <span>
                        Limit: {formatMoney(acc.credit_limit || 0, acc.currency)} • Kullanılabilir: <strong>{formatMoney(Math.max(0, (acc.credit_limit || 0) - acc.balance), acc.currency)}</strong>
                      </span>
                    )}
                    {isLoan && (
                      <span>
                        Çekilen: {formatMoney(acc.loan_original_amount || 0)} • Taksit: <strong>{formatMoney(acc.monthly_installment_amount || 0)} / ay</strong> • İlk Taksit: <strong>{acc.first_installment_date || 'Belirtilmedi'}</strong>
                      </span>
                    )}
                    {isTimeDeposit && (
                      <span>
                        Faiz Oranı: <strong>%{acc.interest_rate}</strong> • Vade Tarihi: <strong>{acc.maturity_date || 'Belirtilmedi'}</strong>
                      </span>
                    )}
                    {!isCreditCard && !isLoan && !isTimeDeposit && (
                      <span>Vadesiz Mevduat & Nakit Bakiye</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {isCreditCard || isLoan ? 'Kalan Borç' : 'Bakiye'}
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: '15px', fontWeight: 900,
                      color: isCreditCard || isLoan ? '#DC2626' : '#10B981'
                    }}
                  >
                    {isCreditCard || isLoan ? `-${formatMoney(acc.balance, acc.currency)}` : formatMoney(acc.balance, acc.currency)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {isCreditCard && onOpenCardStatement && (
                    <button
                      onClick={() => onOpenCardStatement(acc.id)}
                      title="Ekstre Detaylarını Gör"
                      style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Ekstre 📄
                    </button>
                  )}
                  {isTimeDeposit && (
                    <button
                      onClick={() => { setSelectedCloseAccountId(acc.id); setIsCloseModalOpen(true); }}
                      title="Vadeyi Kapat ve Parayı Aktar"
                      style={{ background: '#D1FAE5', border: '1px solid #10B981', color: '#065F46', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Kapat 💵
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(acc)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', opacity: 0.6 }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(acc.id, acc.name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', opacity: 0.6 }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hesap / Kredi Ekle & Düzenle Modalı */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="sheet-handle"></div>
            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '14px' }}>
              {editingAcc ? '✏️ Hesabı Düzenle' : '➕ Yeni Hesap / Kredi Ekle'}
            </div>

            {errorMsg && (
              <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>HESAP / KREDİ ADI *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Akbank İhtiyaç Kredisi veya Yapı Kredi Vadesiz"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>HESAP TÜRÜ *</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    disabled={Boolean(editingAcc)}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)' }}
                  >
                    <option value="bank">🏦 Banka Vadesiz</option>
                    <option value="kmh">⚡ KMH / Ek Hesap (Hazır Kredi)</option>
                    <option value="time_deposit">⏳ Vadeli Mevduat Hesabı</option>
                    <option value="credit_card">💳 Kredi Kartı</option>
                    <option value="loan">🏛️ Kredi / İhtiyaç Kredisi</option>
                    <option value="cash">💵 Nakit Cüzdan</option>
                    <option value="vault">🔐 Kasa / Fiziksel Varlık</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PARA BİRİMİ</label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)' }}
                  >
                    <option value="TRY">₺ TRY</option>
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                    <option value="GOLD">🥇 Altın</option>
                  </select>
                </div>
              </div>

              {/* KMH Özel Formu */}
              {type === 'kmh' && (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#1E40AF' }}>
                    ⚡ KMH / Ek Hesap (Hazır Kredi) Parametreleri
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF' }}>TAHSİS EDİLEN KMH LİMİTİ (₺)</label>
                      <input
                        type="number"
                        placeholder="Örn: 20000"
                        value={overdraftLimit}
                        onChange={e => setOverdraftLimit(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF' }}>AYLIK AKDİ FAİZ ORANI (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Örn: 5.0"
                        value={interestRateContractual}
                        onChange={e => setInterestRateContractual(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#1E40AF', opacity: 0.9 }}>
                    ℹ️ Ek hesaptan harcama yapıldığında bakiye eksiye düşer ve ay sonu faiz simülasyonu çalışır.
                  </div>
                </div>
              )}

              {/* Krediye Özel Form Alanları */}
              {type === 'loan' && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#92400E' }}>
                    🏛️ Kredi Borçlanma & Geri Ödeme Planı
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#92400E' }}>ÇEKİLEN ANAPARA (Nakit) *</label>
                      <input
                        type="number"
                        required
                        placeholder="Örn: 100000"
                        value={loanOrigAmt}
                        onChange={e => setLoanOrigAmt(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #FCD34D', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#92400E' }}>GERİ ÖDENECEK TOPLAM (Faizli) *</label>
                      <input
                        type="number"
                        required
                        placeholder="Örn: 130000"
                        value={loanTotalRepay}
                        onChange={e => setLoanTotalRepay(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #FCD34D', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#92400E' }}>TAKSİT SAYISI (Ay) *</label>
                      <input
                        type="number"
                        required
                        placeholder="Örn: 24"
                        value={totalInstallments}
                        onChange={e => setTotalInstallments(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #FCD34D', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#92400E' }}>NAKTİN AKTARILACAĞI HESAP *</label>
                      <select
                        value={depositedAccId}
                        onChange={e => setDepositedAccId(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '12px', border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                      >
                        {accounts.filter(a => a.type === 'bank' || a.type === 'cash').map(a => (
                          <option key={a.id} value={a.id}>🏦 {a.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--amber)' }}>📅 İLK TAKSİT BAŞLANGIÇ TARİHİ *</label>
                    <input
                      type="date"
                      required
                      value={firstInstallmentDate}
                      onChange={e => setFirstInstallmentDate(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                    />

                    {/* Hızlı Erteleme Butonları */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setDeferredMonth(0)}
                        style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 800, background: 'var(--amber-bg)', border: '1px solid var(--amber)', color: 'var(--amber)', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        ⚡ Gelecek Ay
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeferredMonth(1)}
                        style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 800, background: 'var(--amber-bg)', border: '1px solid var(--amber)', color: 'var(--amber)', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        ⏳ 1 Ay Ertelemeli
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeferredMonth(2)}
                        style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 800, background: 'var(--amber-bg)', border: '1px solid var(--amber)', color: 'var(--amber)', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        ⏳ 2 Ay Ertelemeli
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeferredMonth(3)}
                        style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 800, background: 'var(--amber-bg)', border: '1px solid var(--amber)', color: 'var(--amber)', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        ⏳ 3 Ay Ertelemeli
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {type === 'time_deposit' && (
                <div style={{ background: 'var(--emerald-bg)', border: '1px solid var(--emerald)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--emerald)' }}>
                    ⏳ Vadeli Mevduat Hesabı Detayları
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--emerald)' }}>YATIRILAN ANAPARA *</label>
                      <input
                        type="number"
                        required
                        placeholder="Örn: 50000"
                        value={balance}
                        disabled={Boolean(editingAcc)}
                        onChange={e => setBalance(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--emerald)' }}>YILLIK FAİZ ORANI (%) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="Örn: 45"
                        value={interestRate}
                        onChange={e => setInterestRate(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--emerald)' }}>VADE BİTİŞ TARİHİ *</label>
                      <input
                        type="date"
                        required
                        value={maturityDate}
                        onChange={e => setMaturityDate(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--emerald)' }}>FAİZ TİPİ</label>
                      <select
                        value={interestType}
                        onChange={e => setInterestType(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
                      >
                        <option value="simple">Basit Faiz</option>
                        <option value="compound">Bileşik Faiz</option>
                      </select>
                    </div>
                  </div>

                  {!editingAcc && (
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--emerald)' }}>PARANIN ÇEKİLECEĞİ VADESİZ HESAP *</label>
                      <select
                        value={depositedAccId}
                        onChange={e => setDepositedAccId(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
                        required
                      >
                        <option value="">-- Bir Vadesiz Hesap Seçin --</option>
                        {accounts.filter(a => a.type === 'bank' || a.type === 'cash').map(a => (
                          <option key={a.id} value={a.id}>🏦 {a.name} (Bakiye: {formatMoney(a.balance, a.currency)})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {type !== 'loan' && type !== 'time_deposit' && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {type === 'credit_card' ? 'GÜNCEL EKSTRE BORCU (₺)' : 'BAKİYE / VARLIK (₺)'}
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={balance}
                    onChange={e => setBalance(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                  />
                </div>
              )}

              {type === 'credit_card' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Number(balance) > Number(creditLimit) && Number(creditLimit) > 0 && (
                    <div style={{ background: '#FFF7ED', border: '1px solid #FFD8A8', color: '#D97706', padding: '10px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}>
                      ⚠️ Kart Limiti Aşıldı (₺{(Number(balance) - Number(creditLimit)).toLocaleString('tr-TR')} Aşım). Faiz yansıması veya aşım izni nedeniyle borç kart limitini aşmış görünüyor.
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>KART LİMİTİ (₺)</label>
                    <input
                      type="number"
                      placeholder="Örn: 50000"
                      value={creditLimit}
                      onChange={e => setCreditLimit(e.target.value === '' ? '' : Number(e.target.value))}
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>✂️ HESAP KESİM GÜNÜ</label>
                      <input
                        type="number"
                        min={1} max={31}
                        placeholder="Örn: 5"
                        value={cutoffDay}
                        onChange={e => setCutoffDay(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>📅 SON ÖDEME GÜNÜ</label>
                      <input
                        type="number"
                        min={1} max={31}
                        placeholder="Örn: 15"
                        value={dueDay}
                        onChange={e => setDueDay(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>📈 AKDİ FAİZ ORANI (%/AY)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="4.25"
                        value={interestRateContractual}
                        onChange={e => setInterestRateContractual(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>🚨 GECİKME FAİZİ ORANI (%/AY)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="4.55"
                        value={interestRateLate}
                        onChange={e => setInterestRateLate(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-subtle"
                  style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600 }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                  style={{ flex: 2, padding: '10px', fontSize: '13px', fontWeight: 700 }}
                >
                  {saving ? 'Kaydediliyor...' : editingAcc ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Vadeli Mevduat Kapatma Modalı */}
      <TimeDepositCloseModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        accountId={selectedCloseAccountId}
        accounts={accounts}
        onSuccess={(msg) => {
          if (onUpdate) onUpdate(msg);
        }}
      />
    </div>
  );
}
