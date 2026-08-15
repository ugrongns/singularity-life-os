'use client';
import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface PersonalDebtRecord {
  id: string;
  type: 'debt' | 'receivable';
  person_name: string;
  description?: string;
  index_type: 'TRY' | 'GOLD' | 'USD' | 'EUR';
  index_amount: number;
  interest_rate: number;
  interest_period: string;
  due_date?: string;
  status: 'active' | 'partial' | 'closed';
  paid_amount: number;
  current_tl_value: number;
  maturity_tl_value: number;
  remaining_tl: number;
  days_left: number | null;
  is_overdue: boolean;
  wallet_name?: string;
}

interface PersonalDebtsCardProps {
  accounts: Account[];
  onToast: (msg: string) => void;
}

export default function PersonalDebtsCard({ accounts, onToast }: PersonalDebtsCardProps) {
  const [records, setRecords] = useState<PersonalDebtRecord[]>([]);
  const [summary, setSummary] = useState({ totalDebt: 0, totalReceivable: 0, netPosition: 0 });
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PersonalDebtRecord | null>(null);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [txType, setTxType] = useState<'debt' | 'receivable'>('debt');
  const [personName, setPersonName] = useState('');
  const [description, setDescription] = useState('');
  const [indexType, setIndexType] = useState<'TRY' | 'GOLD' | 'USD' | 'EUR'>('TRY');
  const [indexAmount, setIndexAmount] = useState<number | ''>('');
  const [interestRate, setInterestRate] = useState<number | ''>('');
  const [interestPeriod, setInterestPeriod] = useState<'yearly' | 'monthly'>('yearly');
  const [dueDate, setDueDate] = useState('');
  const [connectedWalletId, setConnectedWalletId] = useState('');

  const USD_RATE = 36.50;
  const EUR_RATE = 39.80;
  const GOLD_RATE = 3180;

  const formatTRY = (v: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);

  const indexLabel = (type: string, amount: number) => {
    switch (type) {
      case 'GOLD': return `${amount} gr Altın ≈ ${formatTRY(amount * GOLD_RATE)}`;
      case 'USD':  return `$${amount.toLocaleString('tr-TR')} ≈ ${formatTRY(amount * USD_RATE)}`;
      case 'EUR':  return `€${amount.toLocaleString('tr-TR')} ≈ ${formatTRY(amount * EUR_RATE)}`;
      default:     return formatTRY(amount);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    const res = await fetch('/api/budget/personal-debts');
    const json = await res.json();
    if (json.success) {
      setRecords(json.data.records);
      setSummary(json.data.summary);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || !indexAmount) {
      setError('Kişi adı ve tutar zorunludur.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/budget/personal-debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: txType,
          person_name: personName.trim(),
          description: description.trim() || null,
          index_type: indexType,
          index_amount: Number(indexAmount),
          interest_rate: Number(interestRate) || 0,
          interest_period: interestPeriod,
          due_date: dueDate || null,
          connected_wallet_id: connectedWalletId || null
        })
      });
      const json = await res.json();
      if (json.success) {
        setIsAddOpen(false);
        onToast(json.message);
        fetchRecords();
        setPersonName('');
        setIndexAmount('');
        setDescription('');
        setInterestRate('');
        setDueDate('');
      } else {
        setError(json.error || 'İşlem başarısız.');
      }
    } catch {
      setError('Sunucu hatası.');
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !payAmount) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/budget/personal-debts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedRecord.id, payment_amount: Number(payAmount) })
      });
      const json = await res.json();
      if (json.success) {
        setIsPayOpen(false);
        onToast(json.message);
        fetchRecords();
        setPayAmount('');
      } else {
        setError(json.error);
      }
    } catch {
      setError('Sunucu hatası.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, personName: string) => {
    if (!confirm(`"${personName}" kaydını silmek istediğinize emin misiniz?`)) return;
    const res = await fetch(`/api/budget/personal-debts?id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) { onToast(json.message); fetchRecords(); }
  };

  const bankAccounts = accounts.filter(a => a.type === 'bank' || a.type === 'cash');
  const activeDebts = records.filter(r => r.type === 'debt' && r.status !== 'closed');
  const activeReceivables = records.filter(r => r.type === 'receivable' && r.status !== 'closed');
  const closed = records.filter(r => r.status === 'closed');

  const RecordRow = ({ r }: { r: PersonalDebtRecord }) => (
    <div style={{
      background: 'var(--surface-subtle)', border: `1px solid ${r.is_overdue ? '#FCA5A5' : 'var(--border)'}`,
      borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 800 }}>{r.type === 'debt' ? '🔴' : '🟢'} {r.person_name}</span>
          {r.is_overdue && <span style={{ fontSize: '9px', background: '#FEE2E2', color: '#B91C1C', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>⚠️ Vadesi Geçti!</span>}
          {r.status === 'partial' && <span style={{ fontSize: '9px', background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>Kısmi Ödeme</span>}
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
          {indexLabel(r.index_type, r.index_amount)}
          {r.interest_rate ? ` • Faiz: %${r.interest_rate} ${r.interest_period === 'monthly' ? 'aylık' : 'yıllık'}` : ''}
          {r.due_date ? ` • Vade: ${r.due_date}` : ''}
          {r.days_left !== null && !r.is_overdue ? ` (${r.days_left} gün kaldı)` : ''}
          {r.description ? ` • ${r.description}` : ''}
        </div>

        {r.interest_rate ? (
          <div style={{ fontSize: '10px', marginTop: '3px', color: '#6B7280' }}>
            Bugünkü Değer: {formatTRY(r.current_tl_value)} → Vade Sonu Değeri: <strong>{formatTRY(r.maturity_tl_value)}</strong>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '12px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Kalan</div>
          <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 900, color: r.type === 'debt' ? '#DC2626' : '#059669' }}>
            {r.type === 'debt' ? '-' : '+'}{formatTRY(r.remaining_tl)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => { setSelectedRecord(r); setPayAmount(''); setError(null); setIsPayOpen(true); }}
            style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {r.type === 'debt' ? '💸 Öde' : '💰 Tahsil'}
          </button>
          <button onClick={() => handleDelete(r.id, r.person_name)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', opacity: 0.5 }}>🗑️</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🤝</span> Kişisel Borç & Alacak Takibi
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Altın, döviz ve faiz endeksli kişisel borç/alacak yönetimi
          </div>
        </div>
        <button
          onClick={() => { setIsAddOpen(true); setError(null); setTxType('debt'); setPersonName(''); setIndexAmount(''); setDescription(''); setInterestRate(''); setDueDate(''); }}
          style={{ background: 'var(--emerald-bg)', color: 'var(--emerald)', border: '1px solid var(--emerald)', borderRadius: 'var(--radius-full)', padding: '6px 14px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
        >
          ＋ Yeni Kayıt
        </button>
      </div>

      {/* Özet Satırı */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#7F1D1D' }}>🔴 Borçlarım</div>
          <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 900, color: '#DC2626', marginTop: '3px' }}>{formatTRY(summary.totalDebt)}</div>
        </div>
        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#14532D' }}>🟢 Alacaklarım</div>
          <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 900, color: '#059669', marginTop: '3px' }}>{formatTRY(summary.totalReceivable)}</div>
        </div>
        <div style={{ background: summary.netPosition >= 0 ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${summary.netPosition >= 0 ? '#86EFAC' : '#FCA5A5'}`, borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#374151' }}>📊 Net Pozisyon</div>
          <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 900, color: summary.netPosition >= 0 ? '#059669' : '#DC2626', marginTop: '3px' }}>{summary.netPosition >= 0 ? '+' : ''}{formatTRY(summary.netPosition)}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Yükleniyor...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Borçlar */}
          {activeDebts.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#DC2626', marginBottom: '8px' }}>🔴 Kişilere Borçlarım</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeDebts.map(r => <RecordRow key={r.id} r={r} />)}
              </div>
            </div>
          )}

          {/* Alacaklar */}
          {activeReceivables.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669', marginBottom: '8px' }}>🟢 Kişilerden Alacaklarım</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeReceivables.map(r => <RecordRow key={r.id} r={r} />)}
              </div>
            </div>
          )}

          {activeDebts.length === 0 && activeReceivables.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🤝</div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>Henüz kişisel borç veya alacak kaydı yok.</div>
            </div>
          )}

          {/* Kapatılmış Kayıtlar */}
          {closed.length > 0 && (
            <details>
              <summary style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer', paddingBottom: '6px' }}>
                ✅ Kapatılmış Kayıtlar ({closed.length} adet)
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', opacity: 0.6 }}>
                {closed.map(r => <RecordRow key={r.id} r={r} />)}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Yeni Kayıt Modalı */}
      {isAddOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>🤝 Borç / Alacak Kaydı Ekle</h2>
              <button onClick={() => setIsAddOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            {error && <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>{error}</div>}

            {/* Tür Seçici */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
              {(['debt', 'receivable'] as const).map(t => (
                <button key={t} type="button" onClick={() => setTxType(t)} style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 800, borderRadius: '6px', border: 'none', background: txType === t ? (t === 'debt' ? '#EF4444' : '#10B981') : 'transparent', color: txType === t ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {t === 'debt' ? '🔴 Borç Aldım' : '🟢 Borç Verdim'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{txType === 'debt' ? 'Borç Aldığım Kişi *' : 'Borç Verdiğim Kişi *'}</label>
                <input type="text" required placeholder="Örn: Ahmet Yılmaz" value={personName} onChange={e => setPersonName(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }} />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Açıklama / Neden (İsteğe Bağlı)</label>
                <input type="text" placeholder="Örn: Kira yardımı, düğün alışverişi..." value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Endeks / Para Birimi *</label>
                  <select value={indexType} onChange={e => setIndexType(e.target.value as any)} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)' }}>
                    <option value="TRY">₺ Türk Lirası</option>
                    <option value="GOLD">🥇 Gram Altın</option>
                    <option value="USD">💵 Dolar (USD)</option>
                    <option value="EUR">💶 Euro (EUR)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {indexType === 'GOLD' ? 'Gram Miktarı *' : indexType === 'TRY' ? 'Tutar (₺) *' : `Miktar (${indexType}) *`}
                  </label>
                  <input type="number" required step="0.01" placeholder={indexType === 'GOLD' ? 'Örn: 10' : 'Örn: 15000'} value={indexAmount} onChange={e => setIndexAmount(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }} />
                </div>
              </div>

              {/* Canlı TL Karşılığı Önizleme */}
              {indexAmount && indexType !== 'TRY' && (
                <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: '#3730A3' }}>
                  💡 Bugünkü TL Karşılığı:{' '}
                  {indexType === 'GOLD' && `${Number(indexAmount)} gr × ${GOLD_RATE.toLocaleString('tr-TR')} ₺/gr = ${(Number(indexAmount) * GOLD_RATE).toLocaleString('tr-TR')} ₺`}
                  {indexType === 'USD' && `$${Number(indexAmount)} × ${USD_RATE} ₺ = ${(Number(indexAmount) * USD_RATE).toLocaleString('tr-TR')} ₺`}
                  {indexType === 'EUR' && `€${Number(indexAmount)} × ${EUR_RATE} ₺ = ${(Number(indexAmount) * EUR_RATE).toLocaleString('tr-TR')} ₺`}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Faiz Oranı (%)</label>
                  <input type="number" step="0.01" placeholder="Örn: 2.5 (opsiyonel)" value={interestRate} onChange={e => setInterestRate(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Faiz Dönemi</label>
                  <select value={interestPeriod} onChange={e => setInterestPeriod(e.target.value as any)} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)' }}>
                    <option value="yearly">Yıllık</option>
                    <option value="monthly">Aylık</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>📅 Vade / Ödeme Tarihi</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bağlı Hesap</label>
                  <select value={connectedWalletId} onChange={e => setConnectedWalletId(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)' }}>
                    <option value="">— Bağlanmasın —</option>
                    {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn-subtle" style={{ flex: 1, padding: '12px', fontWeight: 700 }}>İptal</button>
                <button type="submit" disabled={saving} style={{ flex: 2, padding: '12px', fontWeight: 800, background: txType === 'debt' ? '#EF4444' : '#10B981', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px' }}>
                  {saving ? 'Kaydediliyor...' : txType === 'debt' ? '🔴 Borcu Kaydet' : '🟢 Alacağı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ödeme / Tahsilat Modalı */}
      {isPayOpen && selectedRecord && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                {selectedRecord.type === 'debt' ? '💸 Borç Öde' : '💰 Alacak Tahsil Et'}
              </h2>
              <button onClick={() => setIsPayOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '12px' }}>
              <div style={{ fontWeight: 800 }}>{selectedRecord.person_name}</div>
              <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                Kalan borç: <strong>{formatTRY(selectedRecord.remaining_tl)}</strong>
                {selectedRecord.maturity_tl_value !== selectedRecord.current_tl_value && ` (Vade Sonu: ${formatTRY(selectedRecord.maturity_tl_value)})`}
              </div>
            </div>

            {error && <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>{error}</div>}

            <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ödenen / Tahsil Edilen Tutar (₺) *</label>
                <input type="number" step="0.01" required placeholder="0.00" value={payAmount} onChange={e => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100%', padding: '12px', fontSize: '18px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }} />
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" onClick={() => setPayAmount(selectedRecord.remaining_tl)} style={{ flex: 1, padding: '6px', fontSize: '10px', fontWeight: 800, background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '6px', cursor: 'pointer', color: '#065F46' }}>
                  ✅ Tamamını Öde
                </button>
                <button type="button" onClick={() => setPayAmount(Math.round(selectedRecord.remaining_tl / 2))} style={{ flex: 1, padding: '6px', fontSize: '10px', fontWeight: 800, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '6px', cursor: 'pointer', color: '#3730A3' }}>
                  ½ Yarısını Öde
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setIsPayOpen(false)} className="btn-subtle" style={{ flex: 1, padding: '10px', fontWeight: 700 }}>İptal</button>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 2, padding: '10px', fontWeight: 800, fontSize: '13px' }}>
                  {saving ? 'İşleniyor...' : selectedRecord.type === 'debt' ? '💸 Ödemeyi Kaydet' : '💰 Tahsilatı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
