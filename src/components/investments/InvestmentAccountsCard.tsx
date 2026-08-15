'use client';
import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  assets_count?: number;
  assets_summary?: string;
}

interface InvestmentAccountsCardProps {
  accounts: Account[];
  onUpdate: (msg?: string) => void;
}

export default function InvestmentAccountsCard({ accounts, onUpdate }: InvestmentAccountsCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('brokerage');
  const [currency, setCurrency] = useState('TRY');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Flex/Nema Modalı State'leri
  const [isFlexModalOpen, setIsFlexModalOpen] = useState(false);
  const [activeFlexAccountId, setActiveFlexAccountId] = useState<string | null>(null);
  const [flexLoading, setFlexLoading] = useState(false);
  const [flexData, setFlexData] = useState<any>(null);

  // Flex Configure Form
  const [flexRate, setFlexRate] = useState<string>('');
  const [flexActive, setFlexActive] = useState<boolean>(false);

  // Flex Record Earning Form
  const [earnPrincipal, setEarnPrincipal] = useState<string>('');
  const [earnRate, setEarnRate] = useState<string>('');
  const [earnStart, setEarnStart] = useState<string>('');
  const [earnEnd, setEarnEnd] = useState<string>('');
  const [earnActual, setEarnActual] = useState<string>('');
  const [earnNotes, setEarnNotes] = useState<string>('');

  const [flexSaving, setFlexSaving] = useState(false);
  const [flexError, setFlexError] = useState<string | null>(null);

  const invAccountTypes = ['brokerage', 'crypto_exchange', 'crypto_wallet'];
  const invAccounts = accounts.filter(a => invAccountTypes.includes(a.type));

  const formatTRY = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);

  const formatCurrency = (val: number, cur: string = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(val);
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
          name: name.trim(),
          type,
          balance: 0,
          currency
        })
      });

      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        setName('');
        onUpdate(json.message || '✅ Yatırım hesabı eklendi!');
      } else {
        setErrorMsg(json.error || 'İşlem başarısız.');
      }
    } catch {
      setErrorMsg('Sunucu hatası.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, accName: string) => {
    if (!confirm(`"${accName}" hesabını silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/budget/accounts?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        onUpdate(json.message);
      } else {
        alert(json.error);
      }
    } catch {
      alert('Sunucu hatası.');
    }
  };

  const loadFlexDetails = async (accId: string) => {
    setFlexLoading(true);
    setFlexError(null);
    try {
      const res = await fetch(`/api/flex-interest?accountId=${accId}`);
      const json = await res.json();
      if (json.success) {
        setFlexData(json.data);
        setFlexActive(json.data.flexConfig.is_active === 1);
        setFlexRate(String(json.data.flexConfig.annual_rate || ''));
        
        setEarnPrincipal(String(json.data.balance || ''));
        setEarnRate(String(json.data.flexConfig.annual_rate || ''));
        
        const lastUpdated = json.data.flexConfig.updated_at 
          ? json.data.flexConfig.updated_at.slice(0, 10) 
          : new Date().toISOString().slice(0, 10);
        setEarnStart(lastUpdated);
        setEarnEnd(new Date().toISOString().slice(0, 10));
        setEarnActual(String(json.data.estimatedAccrued || ''));
        setEarnNotes('');
      } else {
        setFlexError(json.error || 'Nema ayarları yüklenemedi.');
      }
    } catch {
      setFlexError('Sunucu hatası.');
    } finally {
      setFlexLoading(false);
    }
  };

  useEffect(() => {
    if (activeFlexAccountId && isFlexModalOpen) {
      loadFlexDetails(activeFlexAccountId);
    }
  }, [activeFlexAccountId, isFlexModalOpen]);

  const handleSaveFlexConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFlexAccountId) return;
    setFlexSaving(true);
    setFlexError(null);

    try {
      const res = await fetch('/api/flex-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'configure',
          accountId: activeFlexAccountId,
          isActive: flexActive,
          annualRate: parseFloat(flexRate) || 0
        })
      });
      const json = await res.json();
      if (json.success) {
        onUpdate(json.message);
        loadFlexDetails(activeFlexAccountId);
      } else {
        setFlexError(json.error);
      }
    } catch {
      setFlexError('İşlem başarısız.');
    } finally {
      setFlexSaving(false);
    }
  };

  const handleRecordEarning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFlexAccountId) return;
    setFlexSaving(true);
    setFlexError(null);

    try {
      const res = await fetch('/api/flex-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-earning',
          accountId: activeFlexAccountId,
          startDate: earnStart,
          endDate: earnEnd,
          principalAmount: parseFloat(earnPrincipal) || 0,
          interestRate: parseFloat(earnRate) || 0,
          actualAmount: parseFloat(earnActual) || 0,
          notes: earnNotes
        })
      });
      const json = await res.json();
      if (json.success) {
        onUpdate(json.message);
        loadFlexDetails(activeFlexAccountId);
      } else {
        setFlexError(json.error);
      }
    } catch {
      setFlexError('İşlem başarısız.');
    } finally {
      setFlexSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>🏛️</span>
          <span>Yatırım Hesaplarım & Kurumlar</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Hisse senedi, kripto borsa ve cüzdan hesaplarınızın dökümü
        </div>
      </div>

      <div className="card-action-bar">
        <button
          className="btn-primary"
          onClick={() => { setIsModalOpen(true); setErrorMsg(null); setName(''); }}
        >
          ＋ Yeni Hesap Ekle
        </button>
      </div>

      {invAccounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📈</div>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Henüz yatırım hesabı tanımlamadınız</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Aracı kurum (Midas, Garanti), Kripto Borsa (Binance) veya Cüzdan (MetaMask) ekleyin.
          </div>
          <button
            onClick={() => { setIsModalOpen(true); setErrorMsg(null); setName(''); }}
            className="btn-primary"
            style={{ fontSize: '12px', padding: '8px 16px' }}
          >
            ＋ İlk Yatırım Hesabını Tanımla
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {invAccounts.map(acc => {
            const icon = acc.type === 'brokerage' ? '📈' : acc.type === 'crypto_exchange' ? '🔐' : '🦊';
            const badgeLabel = acc.type === 'brokerage' ? 'Aracı Kurum' : acc.type === 'crypto_exchange' ? 'Kripto Borsa' : 'Kripto Cüzdan';
            const badgeBg = acc.type === 'brokerage' ? '#E0E7FF' : acc.type === 'crypto_exchange' ? '#FEF3C7' : '#ECE9FE';
            const badgeColor = acc.type === 'brokerage' ? '#3730A3' : acc.type === 'crypto_exchange' ? '#78350F' : '#5B21B6';

            return (
              <div
                key={acc.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '12px 14px', gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: acc.type === 'brokerage' ? 'rgba(59, 130, 246, 0.1)' : acc.type === 'crypto_exchange' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px', flexShrink: 0
                  }}>
                    {icon}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>{acc.name}</span>
                      <span style={{
                        fontSize: '10px', background: badgeBg, color: badgeColor,
                        padding: '2px 8px', borderRadius: '9999px', fontWeight: 700,
                        whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center'
                      }}>
                        {badgeLabel}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {acc.assets_summary ? (
                        <span>Varlıklar: <strong style={{ color: 'var(--text-main)' }}>{acc.assets_summary.split(', ').join(' • ')}</strong></span>
                      ) : (
                        <span>Portföy Hesabı (Henüz varlık bağlı değil)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Portföy Değeri</div>
                    <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 900, color: '#10B981', lineHeight: '1.2' }}>
                      {formatTRY(acc.balance)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={() => { setActiveFlexAccountId(acc.id); setIsFlexModalOpen(true); }}
                      style={{
                        background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8',
                        padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                      title="Nema / Boşta Duran Faiz Ayarları"
                    >
                      <span>💸</span>
                      <span>Nema</span>
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id, acc.name)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: '4px', borderRadius: '6px', fontSize: '13px', opacity: 0.5,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      title="Hesabı Sil"
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

      {/* Yatırım Hesabı Ekleme Modalı */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="sheet-handle"></div>
            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '14px' }}>
              🏛️ Yeni Yatırım Hesabı / Borsa Ekle
            </div>

            {errorMsg && (
              <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>HESAP / BORSA ADI *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Garanti Yatırım, Midas, Binance, MetaMask"
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
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)' }}
                  >
                    <option value="brokerage">📈 Aracı Kurum (Hisse/Borsa)</option>
                    <option value="crypto_exchange">🔐 Kripto Borsa (Binance vb.)</option>
                    <option value="crypto_wallet">🦊 Kripto Cüzdan (MetaMask/Ledger)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ANA PARA BİRİMİ</label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)' }}
                  >
                    <option value="TRY">₺ TRY</option>
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-subtle" style={{ flex: 1, padding: '10px' }}>
                  İptal
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 2, padding: '10px', fontWeight: 800 }}>
                  {saving ? 'Kaydediliyor...' : '✅ Hesabı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Boşta Duran Nakit Faiz / Nema Yönetim Modalı */}
      {isFlexModalOpen && activeFlexAccountId && (
        <div className="modal-overlay" onClick={() => setIsFlexModalOpen(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="sheet-handle"></div>
            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💸</span>
              <span>Nema / Boşta Duran Faiz Ayarları</span>
            </div>

            {flexLoading && (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                Nema ayarları yükleniyor...
              </div>
            )}

            {flexError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
                ⚠️ {flexError}
              </div>
            )}

            {!flexLoading && flexData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 1. Aktiflik Durumu ve Oran Tanımlama */}
                <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                  <form onSubmit={handleSaveFlexConfig} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Nemalandırma Aktiflik Durumu</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Hesapta boşta duran nakitler nemalandırılsın mı?</div>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => setFlexActive(!flexActive)}
                          style={{
                            background: flexActive ? '#D1FAE5' : '#F3F4F6',
                            border: `1px solid ${flexActive ? '#10B981' : '#D1D5DB'}`,
                            color: flexActive ? '#065F46' : '#374151',
                            padding: '6px 14px', borderRadius: 'var(--radius-full)',
                            fontSize: '11px', fontWeight: 800, cursor: 'pointer'
                          }}
                        >
                          {flexActive ? '🟢 AKTİF' : '⚫ PASİF'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', alignItems: 'end', marginTop: '4px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>YILLIK NEMALANDIRMA FAİZ ORANI (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Örn: 48"
                          value={flexRate}
                          onChange={e => setFlexRate(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={flexSaving}
                        className="btn-primary"
                        style={{ padding: '9px', fontSize: '12px', fontWeight: 800 }}
                      >
                        {flexSaving ? 'Kaydediliyor...' : 'Oranı Güncelle'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* 2. Aktif nemalandırma bilgileri ve faiz girişi */}
                {flexData.flexConfig.is_active === 1 && (
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#1E40AF', marginBottom: '8px' }}>
                      📈 Güncel Nema / Faiz Dönemi Bilgisi
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#1E3A8A', marginBottom: '12px' }}>
                      <div>Başlangıç Tarihi: <strong>{flexData.flexConfig.updated_at?.slice(0, 10)}</strong></div>
                      <div>Aktif Süre: <strong>{flexData.activeDays} Gün</strong></div>
                      <div>Hesap Bakiyesi: <strong>{formatCurrency(flexData.balance, flexData.currency)}</strong></div>
                      <div>Tahmini Kazanç: <strong style={{ fontSize: '12px', color: '#10B981' }}>{formatCurrency(flexData.estimatedAccrued, flexData.currency)}</strong></div>
                    </div>

                    <form onSubmit={handleRecordEarning} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed #BFDBFE', paddingTop: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#1E40AF', marginBottom: '4px' }}>
                        💵 Kazanılan Faiz Gelirini Hesaba İşle
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#1E3A8A' }}>ANAPARA</label>
                          <input
                            type="number"
                            value={earnPrincipal}
                            onChange={e => setEarnPrincipal(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-md)', background: 'white' }}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#1E3A8A' }}>YILLIK ORAN (%)</label>
                          <input
                            type="number"
                            value={earnRate}
                            onChange={e => setEarnRate(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-md)', background: 'white' }}
                            required
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#1E3A8A' }}>BAŞLANGIÇ</label>
                          <input
                            type="date"
                            value={earnStart}
                            onChange={e => setEarnStart(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-md)', background: 'white' }}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#1E3A8A' }}>BİTİŞ (Bugün)</label>
                          <input
                            type="date"
                            value={earnEnd}
                            onChange={e => setEarnEnd(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-md)', background: 'white' }}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: '#1E3A8A' }}>GERÇEKLEŞEN NET FAİZ GELİRİ *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={earnActual}
                          onChange={e => setEarnActual(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', fontSize: '13px', fontWeight: 700, border: '1px solid #3B82F6', borderRadius: 'var(--radius-md)', background: 'white', marginTop: '2px' }}
                          required
                        />
                      </div>

                      <div>
                        <input
                          type="text"
                          placeholder="Açıklama (opsiyonel)"
                          value={earnNotes}
                          onChange={e => setEarnNotes(e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-md)', background: 'white' }}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={flexSaving}
                        className="btn-primary"
                        style={{ padding: '8px', fontSize: '12px', fontWeight: 800, background: '#2563EB', borderColor: '#2563EB', marginTop: '4px' }}
                      >
                        {flexSaving ? 'Kaydediliyor...' : '💵 Faiz Gelirini Bakiyeye Ekle'}
                      </button>
                    </form>
                  </div>
                )}

                {/* 3. Kazanç Geçmişi */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Faiz / Nema Geliri Geçmişi
                  </div>
                  {flexData.earnings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Bu hesaba ait faiz/nema girişi bulunmamaktadır.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                      {flexData.earnings.map((earn: any) => (
                        <div
                          key={earn.id}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                            borderRadius: '4px', padding: '6px 10px', fontSize: '11px'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                              {earn.days} Günlük Faiz ({earn.start_date.slice(5)} - {earn.end_date.slice(5)})
                            </div>
                            {earn.notes && <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{earn.notes}</div>}
                          </div>
                          <div style={{ fontWeight: 800, color: '#10B981' }}>
                            +{formatCurrency(earn.actual_amount, earn.currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setIsFlexModalOpen(false)}
                className="btn-subtle"
                style={{ flex: 1, padding: '10px' }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
