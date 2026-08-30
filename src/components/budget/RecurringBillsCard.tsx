'use client';
import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface Category {
  id: string;
  name: string;
}

interface RecurringBill {
  id: string;
  name: string;
  type: 'utility' | 'subscription' | 'tax' | 'other';
  billing_day: number | null;
  due_day: number;
  period: 'monthly' | 'yearly' | 'quarterly';
  due_month: number | null;
  amount: number;
  amount_type: 'fixed' | 'variable';
  is_auto_pay: number;
  auto_pay_wallet_id: string | null;
  category_id: string | null;
  last_paid_month: string | null;
  last_paid_date: string | null;
  status: string;
  notes: string | null;
  is_paid_this_month: boolean;
  is_billing_open: boolean;
  days_left: number;
  is_overdue: boolean;
  overdue_days?: number;
  next_due_date?: string;
  next_billing_date?: string | null;
  formatted_next_due?: string;
  formatted_next_billing?: string | null;
  wallet_name: string | null;
  category_name: string | null;
  category_icon?: string;
  category_color?: string;
}

interface RecurringBillsCardProps {
  accounts: Account[];
  categories?: Category[];
  onToast?: (msg: string) => void;
  onUpdate?: () => void;
}

export default function RecurringBillsCard({ accounts, categories = [], onToast, onUpdate }: RecurringBillsCardProps) {
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [summary, setSummary] = useState({
    totalMonthly: 0,
    fixedTotal: 0,
    variableTotal: 0,
    paidThisMonth: 0,
    pendingThisMonth: 0,
    totalCount: 0,
    paidCount: 0,
    pendingCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'utility' | 'subscription'>('all');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'utility' | 'subscription' | 'tax' | 'other'>('utility');
  const [billingDay, setBillingDay] = useState<number | ''>('');
  const [dueDay, setDueDay] = useState<number | ''>('');
  const [period, setPeriod] = useState<'monthly' | 'yearly' | 'quarterly'>('monthly');
  const [dueMonth, setDueMonth] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [amountType, setAmountType] = useState<'fixed' | 'variable'>('fixed');
  const [isAutoPay, setIsAutoPay] = useState(false);
  const [autoPayWalletId, setAutoPayWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');

  // Ödeme Onay Modalı
  const [payModalBill, setPayModalBill] = useState<RecurringBill | null>(null);
  const [payWalletId, setPayWalletId] = useState('');
  const [createTx, setCreateTx] = useState(true);
  const [customPayAmount, setCustomPayAmount] = useState<number | ''>('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formatTRY = (val: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/budget/recurring-bills');
      const j = await res.json();
      if (j.success && j.data) {
        setBills(j.data.bills || []);
        setSummary(j.data.summary || {
          totalMonthly: 0, fixedTotal: 0, variableTotal: 0,
          paidThisMonth: 0, pendingThisMonth: 0,
          totalCount: 0, paidCount: 0, pendingCount: 0
        });
      }
    } catch (err) {
      console.error('Fetch recurring bills error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const openAddModal = () => {
    setEditingBill(null);
    setName('');
    setType('utility');
    setBillingDay('');
    setDueDay('');
    setPeriod('monthly');
    setDueMonth('');
    setAmount('');
    setAmountType('fixed');
    setIsAutoPay(false);
    setAutoPayWalletId(accounts[0]?.id || '');
    setCategoryId(categories[0]?.id || '');
    setNotes('');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (b: RecurringBill) => {
    setEditingBill(b);
    setName(b.name);
    setType(b.type);
    setBillingDay(b.billing_day || '');
    setDueDay(b.due_day);
    setPeriod(b.period);
    setDueMonth(b.due_month || '');
    setAmount(b.amount || '');
    setAmountType(b.amount_type || 'fixed');
    setIsAutoPay(Boolean(b.is_auto_pay));
    setAutoPayWalletId(b.auto_pay_wallet_id || accounts[0]?.id || '');
    setCategoryId(b.category_id || '');
    setNotes(b.notes || '');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dueDay) {
      setErrorMsg('Lütfen fatura adını ve son ödeme gününü girin.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      id: editingBill ? editingBill.id : undefined,
      name: name.trim(),
      type,
      billing_day: billingDay ? Number(billingDay) : null,
      due_day: Number(dueDay),
      period,
      due_month: dueMonth ? Number(dueMonth) : null,
      amount: Number(amount) || 0,
      amount_type: amountType,
      is_auto_pay: isAutoPay ? 1 : 0,
      auto_pay_wallet_id: isAutoPay && autoPayWalletId ? autoPayWalletId : null,
      category_id: categoryId || null,
      notes: notes.trim() || null
    };

    try {
      const url = '/api/budget/recurring-bills';
      const method = editingBill ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await res.json();
      if (j.success) {
        setIsModalOpen(false);
        fetchBills();
        if (onToast) onToast(j.message || '✅ Fatura kaydedildi!');
        if (onUpdate) onUpdate();
      } else {
        setErrorMsg(j.error || 'Kaydetme başarısız.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bağlantı hatası.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, billName: string) => {
    if (!confirm(`"${billName}" faturasını silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/budget/recurring-bills?id=${id}`, { method: 'DELETE' });
      const j = await res.json();
      if (j.success) {
        fetchBills();
        if (onToast) onToast(`🗑️ ${billName} silindi.`);
        if (onUpdate) onUpdate();
      }
    } catch {
      alert('Silme işlemi başarısız.');
    }
  };

  const openPayModal = (b: RecurringBill) => {
    setPayModalBill(b);
    setPayWalletId(b.auto_pay_wallet_id || accounts[0]?.id || '');
    setCustomPayAmount(b.amount);
    setCreateTx(true);
  };

  const handleConfirmPay = async () => {
    if (!payModalBill) return;
    try {
      const res = await fetch('/api/budget/recurring-bills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payModalBill.id,
          action: 'mark_paid',
          create_transaction: createTx,
          wallet_id: payWalletId,
          amount: Number(customPayAmount) || payModalBill.amount
        })
      });
      const j = await res.json();
      if (j.success) {
        setPayModalBill(null);
        fetchBills();
        if (onToast) onToast(j.message);
        if (onUpdate) onUpdate();
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
      }
    } catch {
      alert('Ödeme kaydedilemedi.');
    }
  };

  const handleUnmarkPaid = async (b: RecurringBill) => {
    try {
      const res = await fetch('/api/budget/recurring-bills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, action: 'unmark_paid' })
      });
      const j = await res.json();
      if (j.success) {
        fetchBills();
        if (onToast) onToast(j.message);
        if (onUpdate) onUpdate();
      }
    } catch {
      alert('İşlem başarısız.');
    }
  };

  const filteredBills = bills.filter(b => {
    if (filter === 'pending') return !b.is_paid_this_month;
    if (filter === 'utility') return b.type === 'utility';
    if (filter === 'subscription') return b.type === 'subscription';
    return true;
  });

  const getBillIcon = (b: RecurringBill) => {
    if (b.type === 'subscription') return '📱';
    if (b.type === 'tax') return '🏛️';
    if (b.name.toLowerCase().includes('elektrik')) return '⚡';
    if (b.name.toLowerCase().includes('su') || b.name.toLowerCase().includes('iski')) return '💧';
    if (b.name.toLowerCase().includes('gaz') || b.name.toLowerCase().includes('igdas')) return '🔥';
    if (b.name.toLowerCase().includes('internet') || b.name.toLowerCase().includes('turk')) return '🌐';
    if (b.name.toLowerCase().includes('aidat') || b.name.toLowerCase().includes('kira')) return '🏠';
    return '🧾';
  };

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      {/* Başlık ve Eylem Butonu */}
      <div className="card-title-row">
        <div className="card-title">
          <span>🧾</span>
          <span>Periyodik Fatura & Abonelik Takvimi</span>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary"
          style={{ padding: '6px 14px', fontSize: '12px' }}
        >
          + Fatura / Abonelik Ekle
        </button>
      </div>

      {/* Özet Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '12px', marginBottom: '16px' }}>
        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>AYLIK TOPLAM YÜK</div>
          <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
            {formatTRY(summary.totalMonthly)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {summary.totalCount} Adet ({formatTRY(summary.fixedTotal)} Sabit + ≈{formatTRY(summary.variableTotal)} Tahmini)
          </div>
        </div>

        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 'var(--radius-md)', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#065F46', fontWeight: 700 }}>BU AY ÖDENEN</div>
          <div style={{ fontSize: '16px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
            {formatTRY(summary.paidThisMonth)}
          </div>
          <div style={{ fontSize: '10px', color: '#065F46', marginTop: '2px' }}>{summary.paidCount} Ödeme Tamamlandı</div>
        </div>

        <div style={{ background: summary.pendingThisMonth > 0 ? '#FEF2F2' : 'var(--surface-subtle)', border: `1px solid ${summary.pendingThisMonth > 0 ? '#FECDD3' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: summary.pendingThisMonth > 0 ? '#991B1B' : 'var(--text-muted)', fontWeight: 700 }}>KALAN / BEKLEYEN</div>
          <div style={{ fontSize: '16px', fontWeight: 900, color: summary.pendingThisMonth > 0 ? '#DC2626' : 'var(--text-main)', marginTop: '2px' }}>
            {formatTRY(summary.pendingThisMonth)}
          </div>
          <div style={{ fontSize: '10px', color: summary.pendingThisMonth > 0 ? '#991B1B' : 'var(--text-muted)', marginTop: '2px' }}>{summary.pendingCount} Bekleyen Ödeme</div>
        </div>
      </div>

      {/* Filtreleme Butonları */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '5px 12px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-full)', border: '1px solid var(--border)',
            background: filter === 'all' ? '#4F46E5' : 'var(--surface-subtle)',
            color: filter === 'all' ? '#FFFFFF' : 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          Tümü ({bills.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          style={{
            padding: '5px 12px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-full)', border: '1px solid var(--border)',
            background: filter === 'pending' ? '#DC2626' : 'var(--surface-subtle)',
            color: filter === 'pending' ? 'white' : 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          Ödenecekler ({summary.pendingCount})
        </button>
        <button
          onClick={() => setFilter('utility')}
          style={{
            padding: '5px 12px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-full)', border: '1px solid var(--border)',
            background: filter === 'utility' ? '#3B82F6' : 'var(--surface-subtle)',
            color: filter === 'utility' ? 'white' : 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          Faturalar
        </button>
        <button
          onClick={() => setFilter('subscription')}
          style={{
            padding: '5px 12px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-full)', border: '1px solid var(--border)',
            background: filter === 'subscription' ? '#8B5CF6' : 'var(--surface-subtle)',
            color: filter === 'subscription' ? 'white' : 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          Abonelikler
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
          Faturalar yükleniyor...
        </div>
      ) : filteredBills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🧾</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Henüz kayıtlı fatura veya abonelik yok</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Elektrik, su, doğalgaz, internet faturalarınızı veya dijital aboneliklerinizi ekleyin.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredBills.map(bill => {
            const icon = getBillIcon(bill);
            const isVariable = bill.amount_type === 'variable';

            return (
              <div
                key={bill.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: bill.is_paid_this_month ? 'var(--surface-subtle)' : bill.is_overdue ? '#FFF1F2' : 'var(--surface)',
                  border: `1px solid ${bill.is_paid_this_month ? 'var(--border)' : bill.is_overdue ? '#FDA4AF' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', padding: '12px 14px',
                  opacity: bill.is_paid_this_month ? 0.75 : 1,
                  transition: 'all 0.15s'
                }}
              >
                {/* Sol Alan: İkon + Başlık + Tarih Bilgisi */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: bill.is_paid_this_month ? '#D1FAE5' : bill.is_overdue ? '#FEE2E2' : 'var(--surface-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                  }}>
                    {icon}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {bill.name}
                      </span>

                      {/* Tür Rozeti */}
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                        background: bill.type === 'subscription' ? '#EDE9FE' : '#DBEAFE',
                        color: bill.type === 'subscription' ? '#6D28D9' : '#1E40AF'
                      }}>
                        {bill.type === 'subscription' ? 'Abonelik' : bill.type === 'tax' ? 'Vergi' : 'Fatura'}
                      </span>

                      {/* Sabit / Değişken (Tahmini) Rozeti */}
                      {isVariable ? (
                        <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          📊 Tahmini
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', background: 'var(--surface-subtle)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, border: '1px solid var(--border)' }}>
                          🔒 Sabit
                        </span>
                      )}

                      {/* Otomatik Ödeme Rozeti */}
                      {Boolean(bill.is_auto_pay) && (
                        <span style={{ fontSize: '10px', background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }} title={`Otomatik Ödeme: ${bill.wallet_name || 'Banka/Kart'}`}>
                          ⚡ Otomatik
                        </span>
                      )}

                      {/* Durum Rozetleri */}
                      {bill.is_paid_this_month ? (
                        <span style={{ fontSize: '10px', background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          ✓ Ödendi ({bill.last_paid_date ? bill.last_paid_date.slice(5) : 'Bu Ay'})
                        </span>
                      ) : bill.is_overdue ? (
                        <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#991B1B', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          ⚠️ {bill.overdue_days || Math.abs(bill.days_left)} Gün Gecikmede!
                        </span>
                      ) : bill.is_billing_open ? (
                        <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          ⏳ Ödeme Açık ({bill.days_left === 0 ? 'Bugün Son!' : `${bill.days_left} gün kaldı`})
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', background: 'var(--surface-subtle)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          📅 Gelecek Dönem ({bill.formatted_next_due || `${bill.days_left} gün kaldı`})
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {bill.formatted_next_billing ? (
                        <span>✂️ Tebliğ: <strong>{bill.formatted_next_billing}</strong></span>
                      ) : bill.billing_day ? (
                        <span>✂️ Tebliğ: <strong>Her ayın {bill.billing_day}'i</strong></span>
                      ) : null}
                      <span>📅 Son Ödeme: <strong>{bill.formatted_next_due || `Her ayın ${bill.due_day}'i`}</strong></span>
                      {bill.wallet_name && (
                        <span>💳 Hesap: <strong>{bill.wallet_name}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sağ Alan: Tutar + Butonlar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: bill.is_paid_this_month ? 'var(--text-muted)' : 'var(--text-main)' }}>
                      {isVariable ? `≈ ${formatTRY(bill.amount)}` : formatTRY(bill.amount)}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {isVariable ? 'Tahmini Tutar' : bill.period === 'yearly' ? 'Yıllık Sabit' : 'Aylık Sabit'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {/* Ödeme Butonu */}
                    {!bill.is_paid_this_month ? (
                      <button
                        onClick={() => openPayModal(bill)}
                        style={{
                          padding: '6px 12px', fontSize: '11px', fontWeight: 800,
                          background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white',
                          border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        ✓ Öde
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnmarkPaid(bill)}
                        style={{
                          padding: '6px 10px', fontSize: '11px', fontWeight: 600,
                          background: 'var(--surface-subtle)', color: 'var(--text-muted)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer'
                        }}
                        title="Ödeme Durumunu Geri Al"
                      >
                        ↩
                      </button>
                    )}

                    {/* Düzenle Butonu */}
                    <button
                      onClick={() => openEditModal(bill)}
                      style={{
                        padding: '6px 8px', fontSize: '11px',
                        background: 'var(--surface-subtle)', color: 'var(--text-main)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer'
                      }}
                      title="Düzenle"
                    >
                      ✏️
                    </button>

                    {/* Sil Butonu */}
                    <button
                      onClick={() => handleDelete(bill.id, bill.name)}
                      style={{
                        padding: '6px 8px', fontSize: '11px',
                        background: 'var(--surface-subtle)', color: '#DC2626',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer'
                      }}
                      title="Sil"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================== */}
      {/* ➕ YENİ / DÜZENLEME MODALI */}
      {/* ========================================== */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', background: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--text-main)' }}>
                {editingBill ? '✏️ Fatura / Abonelik Düzenle' : '➕ Yeni Fatura & Abonelik Ekle'}
              </div>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            {errorMsg && (
              <div style={{ background: '#FEE2E2', border: '1px solid #FECDD3', color: '#991B1B', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>FATURA / HİZMET ADI *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Enerjisa Elektrik, Netflix, İSKİ Su, Ev Aidatı"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                />
              </div>

              {/* Sabit / Değişken Tutar Türü Seçimi */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  ÖDEME TUTARI TÜRÜ *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setAmountType('fixed')}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${amountType === 'fixed' ? '#3B82F6' : 'var(--border)'}`,
                      background: amountType === 'fixed' ? 'rgba(59, 130, 246, 0.1)' : 'var(--surface-subtle)',
                      color: amountType === 'fixed' ? '#2563EB' : 'var(--text-muted)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '13px' }}>🔒 Sabit Tutar</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Abonelik, kira, aidat gibi net tutar</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAmountType('variable')}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${amountType === 'variable' ? '#F59E0B' : 'var(--border)'}`,
                      background: amountType === 'variable' ? 'rgba(245, 158, 11, 0.1)' : 'var(--surface-subtle)',
                      color: amountType === 'variable' ? '#D97706' : 'var(--text-muted)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '13px' }}>📊 Değişken Tutar</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Elektrik, su, doğalgaz vb. tahmini tutar</div>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>TÜR</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                  >
                    <option value="utility">⚡ Fatura / Aidat</option>
                    <option value="subscription">📱 Dijital Abonelik</option>
                    <option value="tax">🏛️ Vergi / Harç</option>
                    <option value="other">🏷️ Diğer</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>DÖNGÜ PERİYODU</label>
                  <select
                    value={period}
                    onChange={e => setPeriod(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                  >
                    <option value="monthly">Aylık</option>
                    <option value="yearly">Yıllık</option>
                    <option value="quarterly">3 Aylık</option>
                  </select>
                </div>
              </div>

              {/* Gün Girişleri (Tebliğ ve Son Ödeme) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    ✂️ HESAP KESİM / TEBLİĞ GÜNÜ
                  </label>
                  <input
                    type="number"
                    min={1} max={31}
                    placeholder="Örn: 5 (Opsiyonel)"
                    value={billingDay}
                    onChange={e => setBillingDay(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Faturanın kesildiği gün</div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626' }}>
                    📅 SON ÖDEME GÜNÜ *
                  </label>
                  <input
                    type="number"
                    required
                    min={1} max={31}
                    placeholder="Örn: 20"
                    value={dueDay}
                    onChange={e => setDueDay(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', borderColor: '#FCA5A5', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                  />
                  <div style={{ fontSize: '10px', color: '#DC2626', marginTop: '2px' }}>Nihai son gün</div>
                </div>
              </div>

              {/* Bilgilendirme Notu */}
              <div style={{ fontSize: '11px', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 10px', color: 'var(--text-muted)' }}>
                💡 <strong>Döngü Başlangıcı:</strong> Fatura takvimi tanımlandığı tarihten sonraki ilk denk gelen tarihten itibaren başlar. Geçmişe dönük ödenmemiş borç kaydı oluşturulmaz.
              </div>

              {/* Tutar */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {amountType === 'variable' ? '📊 TAHMİNİ / YAKLAŞIK TUTAR (₺) *' : '🔒 SABİT TUTAR (₺) *'}
                </label>
                <input
                  type="number"
                  required
                  placeholder={amountType === 'variable' ? 'Örn: 450 (Tahmini ortalama fatura tutarı)' : 'Örn: 299 (Sabit çekilecek net tutar)'}
                  value={amount}
                  onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                />
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {amountType === 'variable'
                    ? 'Sayaca/kullanıma göre fatura kesilene kadar bütçe planında tahmini yük olarak hesaplanır.'
                    : 'Her dönem sabit olarak tahsil edilen kesin tutar olarak kaydedilir.'}
                </div>
              </div>

              {/* Otomatik Ödeme Talimatı */}
              <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                  <input
                    type="checkbox"
                    checked={isAutoPay}
                    onChange={e => setIsAutoPay(e.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span>⚡ Bu Fatura Otomatik Ödeme Talimatında</span>
                </label>

                {isAutoPay && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>OTOMATİK ÇEKİLECEĞİ HESAP / KART</label>
                    <select
                      value={autoPayWalletId}
                      onChange={e => setAutoPayWalletId(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.type === 'credit_card' ? '💳' : '🏦'} {a.name} ({formatTRY(a.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>NOTLAR</label>
                <input
                  type="text"
                  placeholder="Abone no, sözleşme bitişi vb."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-subtle)', color: 'var(--text-main)', fontWeight: 700, cursor: 'pointer' }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ flex: 2, padding: '10px', borderRadius: 'var(--radius-md)', border: 'none', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', color: 'white', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
                >
                  {saving ? 'Kaydediliyor...' : editingBill ? 'Güncelle' : 'Kaydet & Takvime Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 💳 ÖDEME ONAY MODALI */}
      {/* ========================================== */}
      {payModalBill && (
        <div className="modal-overlay" onClick={() => setPayModalBill(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', background: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--text-main)' }}>✓ Fatura Ödemesi Onayı</div>
              <button className="modal-close-btn" onClick={() => setPayModalBill(null)}>✕</button>
            </div>

            <div style={{ background: 'var(--emerald-bg)', border: '1px solid var(--emerald)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--emerald)' }}>{payModalBill.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Son Ödeme: {payModalBill.formatted_next_due || `Ayın ${payModalBill.due_day}. günü`}
              </div>
              {payModalBill.amount_type === 'variable' && (
                <div style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#92400E', padding: '6px 10px', borderRadius: '6px', marginTop: '8px' }}>
                  📊 <strong>Değişken Tutar:</strong> Tahmini tutar ≈ {formatTRY(payModalBill.amount)}. Gelen faturadaki kesin tutarı aşağıya yazabilirsiniz.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {payModalBill.amount_type === 'variable' ? 'ÖDENEN GERÇEK / NET FATURA TUTARI (₺) *' : 'ÖDENEN NET TUTAR (₺) *'}
                </label>
                <input
                  type="number"
                  value={customPayAmount}
                  onChange={e => setCustomPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                  <input
                    type="checkbox"
                    checked={createTx}
                    onChange={e => setCreateTx(e.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span>Hesabımdan Para Çıkışı Olarak Kaydet</span>
                </label>

                {createTx && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>ÖDEMENİN YAPILDIĞI HESAP</label>
                    <select
                      value={payWalletId}
                      onChange={e => setPayWalletId(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.type === 'credit_card' ? '💳' : '🏦'} {a.name} ({formatTRY(a.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPayModalBill(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-subtle)', color: 'var(--text-main)', fontWeight: 700, cursor: 'pointer' }}
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPay}
                  style={{ flex: 2, padding: '10px', borderRadius: 'var(--radius-md)', border: 'none', background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
                >
                  ✓ Ödemeyi Onayla & İşle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


