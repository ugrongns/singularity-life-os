'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import AccountsCard from '@/components/budget/AccountsCard';
import { BudgetRiskCard } from '@/components/budget/BudgetRiskCard';
import BudgetLimitsCard from '@/components/budget/BudgetLimitsCard';
import RecentTxCard from '@/components/budget/RecentTxCard';
import FutureForecastCard from '@/components/budget/FutureForecastCard';
import PersonalDebtsCard from '@/components/budget/PersonalDebtsCard';
import RecurringBillsCard from '@/components/budget/RecurringBillsCard';
import SpendingHabitsCard from '@/components/budget/SpendingHabitsCard';
import ReceiptScanModal from '@/components/modals/ReceiptScanModal';
import ManualExpenseModal, { ManualExpenseDraft } from '@/components/modals/ManualExpenseModal';
import CreditCardStatementModal from '@/components/modals/CreditCardStatementModal';
import CategoryDetailModal from '@/components/modals/CategoryDetailModal';
import TransferModal from '@/components/modals/TransferModal';
import MarketRatesBar from '@/components/budget/MarketRatesBar';
import SavingsGoalsCard from '@/components/budget/SavingsGoalsCard';
import PageLoadingState from '@/components/ui/PageLoadingState';
import { parseQuickFinanceInput } from '@/lib/finance-quick-parser';

export default function BudgetPage() {
  const [data, setData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  // ✅ Timezone-safe başlangıç ayı: toISOString() UTC'ye kaydıracağından getFullYear/getMonth kullanılır
  const todayLocal = new Date();
  const initMonth = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(initMonth);
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualExpenseDraft | null>(null);
  const [quickFinanceText, setQuickFinanceText] = useState('');
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferDefaultTargetId, setTransferDefaultTargetId] = useState<string | null>(null);
  const [cardStatementAccId, setCardStatementAccId] = useState<string | null>(null);
  const [categoryDetail, setCategoryDetail] = useState<{ catId: string | null; catName?: string }>({ catId: null });
  const [preselectedCatId, setPreselectedCatId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  const handleRefreshRates = async () => {
    setRatesLoading(true);
    try {
      const res = await fetch('/api/market-rates?refresh=true');
      const j = await res.json();
      if (j.success && j.data) {
        setData((prev: any) => ({ ...prev, marketRates: j.data }));
        showToast('📈 Canlı piyasa kurları güncellendi!');
      }
    } catch {
      showToast('Kurlar güncellenirken hata oluştu.');
    } finally {
      setRatesLoading(false);
    }
  };

  const fetchData = async (targetMonth?: string) => {
    const monthToFetch = targetMonth || selectedMonth;
    setFetchError(null);
    try {
      const [budRes, notifRes] = await Promise.all([
        fetch(`/api/budget?month=${monthToFetch}`),
        fetch('/api/notifications')
      ]);
      const [budJ, notifJ] = await Promise.all([budRes.json(), notifRes.json()]);
      if (!budRes.ok || !budJ.success) {
        setFetchError(budJ.error || 'Bütçe verileri yüklenemedi.');
      } else {
        setData(budJ.data);
      }
      if (notifRes.ok && notifJ.success) setNotifData(notifJ.data);
    } catch {
      setFetchError('Bütçe servisine bağlanılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleRefresh = () => {
      fetchData();
    };
    window.addEventListener('singularity-refresh', handleRefresh);
    return () => window.removeEventListener('singularity-refresh', handleRefresh);
  }, [selectedMonth]);

  const handleMonthChange = (mStr: string) => {
    setSelectedMonth(mStr);
  };

  const handleUpdate = (msg?: string) => {
    fetchData();
    if (msg) showToast(msg);
  };

  if (loading) {
    return (
      <SharedLayout notifications={notifData}>
        <PageLoadingState
          icon="💰"
          title="Bütçe & Nakit Akışı Yükleniyor..."
          description="Cüzdanlar, kredi kartları, yaklaşan faturalar ve harcama limitleri taranıyor"
          color="#10B981"
        />
      </SharedLayout>
    );
  }

  const formatTRY = (val: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val || 0);

  // FX Kuru Dönüştürücü (Canlı piyasa verisi yoksa sabit kur tahmini yapılmaz)
  const getRate = (curr: string) => {
    if (curr === 'TRY' || !curr) return 1.0;
    const rates = data?.marketRates;
    if (!rates) return 0;
    if (curr === 'USD') return rates.USD_TRY || 0;
    if (curr === 'EUR') return rates.EUR_TRY || 0;
    if (curr === 'GBP') return rates.GBP_TRY || 0;
    if (curr === 'GOLD') return rates.GOLD_GRAM_TRY || 0;
    if (curr === 'BTC') return rates.BTC_TRY || 0;
    return 1.0;
  };

  return (
    <SharedLayout notifications={notifData}>
      {toastMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text-main)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 500, boxShadow: 'var(--shadow-lg)', zIndex: 9999 }}>
          {toastMsg}
        </div>
      )}

      {/* Sayfa Başlığı ve İşlem Butonları */}
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>💰 Finans & Bütçe</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Hesaplar, harcamalar, borç ödeme ve bütçe limitleri</p>
        </div>
        
        {/* İşlem Butonları Toolbar */}
        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={async () => {
              const summary = data?.monthlySummary;
              if (!summary) return;
              const inc = Number(summary.totalIncome || 0);
              const exp = Number(summary.totalExpense || 0);
              const net = inc - exp;
              const saveRate = inc > 0 ? Math.round((net / inc) * 100) : 0;
              const topCats = [...(data?.categories || [])]
                .filter((c: any) => c.type !== 'income' && (c.spent || 0) > 0)
                .sort((a: any, b: any) => (b.spent || 0) - (a.spent || 0))
                .slice(0, 3)
                .map((c: any, idx: number) => `${idx + 1}. ${c.name}: ${formatTRY(c.spent)}`)
                .join('\n');
              const reportText = [
                `📊 Singularity Finans Özeti — ${summary.monthName || selectedMonth}`,
                `• Gelir: ${formatTRY(inc)}`,
                `• Gider: ${formatTRY(exp)}`,
                `• Net Nakit Akışı: ${net >= 0 ? '+' : ''}${formatTRY(net)} (Tasarruf: %${saveRate})`,
                data?.safeDailyLimit ? `• Güvenli Günlük Limit: ${formatTRY(data.safeDailyLimit.safeDailyLimit)}/gün (${data.safeDailyLimit.remainingDaysInMonth} gün kaldı)` : '',
                topCats ? `\n🏷️ En Yüksek 3 Kategori:\n${topCats}` : ''
              ].filter(Boolean).join('\n');
              try {
                await navigator.clipboard.writeText(reportText);
                showToast('📋 Aylık finans özeti panoya kopyalandı!');
              } catch {
                showToast('Panoya kopyalanamadı.');
              }
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              height: '36px', padding: '0 12px', borderRadius: 'var(--radius-full)',
              background: 'var(--surface-subtle)', border: '1px solid var(--border)',
              fontSize: '12px', fontWeight: 700, color: 'var(--text-main)',
              cursor: 'pointer', whiteSpace: 'nowrap', width: 'auto', margin: 0
            }}
          >
            <span>📋</span>
            <span>Özeti Kopyala</span>
          </button>

          <button
            onClick={() => setIsTransferOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              height: '36px', padding: '0 14px', borderRadius: 'var(--radius-full)',
              background: 'var(--indigo-bg)', border: '1px solid var(--border)',
              fontSize: '12px', fontWeight: 800, color: 'var(--indigo)',
              cursor: 'pointer', whiteSpace: 'nowrap', width: 'auto', margin: 0
            }}
          >
            <span>🔄</span>
            <span>Transfer / Ödeme</span>
          </button>

          <button
            onClick={() => setIsScanOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              height: '36px', padding: '0 14px', borderRadius: 'var(--radius-full)',
              background: 'var(--emerald-bg)', border: '1px solid var(--emerald)',
              fontSize: '12px', fontWeight: 800, color: 'var(--emerald)',
              cursor: 'pointer', whiteSpace: 'nowrap', width: 'auto', margin: 0
            }}
          >
            <span>📷</span>
            <span>Fiş Tara</span>
          </button>

          <button
            onClick={() => setIsManualOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              height: '36px', padding: '0 16px', borderRadius: 'var(--radius-full)',
              background: '#3B82F6', border: 'none',
              fontSize: '12px', fontWeight: 700, color: '#FFFFFF',
              cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)',
              width: 'auto', margin: 0
            }}
          >
            <span>＋</span>
            <span>Harcama / Gelir Ekle</span>
          </button>
        </div>
      </div>

      {/* 1. Canlı Piyasa & FX Bandı (Tam Genişlik) */}
      <MarketRatesBar
        rates={data?.marketRates}
        onRefresh={handleRefreshRates}
        loading={ratesLoading}
      />

      {/* ⚠️ Veri Yükleme Hata Şeridi */}
      {fetchError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            marginBottom: '16px',
            borderRadius: 'var(--radius-lg)',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            fontSize: '12px',
            fontWeight: 700
          }}
        >
          <span>⚠️ {fetchError}</span>
          <button
            type="button"
            onClick={() => fetchData()}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid #FCA5A5',
              background: '#FFFFFF',
              color: '#B91C1C',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Yenile
          </button>
        </div>
      )}

      {/* 🎛️ Aile / Kişi Görünüm Filtresi Barı */}
      {data?.monthlySummary?.familyMembers && data.monthlySummary.familyMembers.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            👥 Görünüm Filtresi:
          </span>

          <button
            type="button"
            onClick={() => setSelectedMember('all')}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              border: selectedMember === 'all' ? '1px solid var(--blue)' : '1px solid var(--border)',
              background: selectedMember === 'all' ? 'var(--blue)' : 'var(--surface-subtle)',
              color: selectedMember === 'all' ? 'white' : 'var(--text-main)',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            👨‍👩‍👧‍👦 Tüm Aile (Ortak)
          </button>

          <button
            type="button"
            onClick={() => setSelectedMember('mine')}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              border: selectedMember === 'mine' ? '1px solid var(--emerald)' : '1px solid var(--border)',
              background: selectedMember === 'mine' ? 'var(--emerald)' : 'var(--surface-subtle)',
              color: selectedMember === 'mine' ? 'white' : 'var(--text-main)',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            👑 Sadece Benim
          </button>

          {data.monthlySummary.familyMembers
            .filter((m: any) => !m.is_current_user)
            .map((m: any) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMember(m.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: selectedMember === m.id ? '1px solid #EC4899' : '1px solid var(--border)',
                  background: selectedMember === m.id ? '#EC4899' : 'var(--surface-subtle)',
                  color: selectedMember === m.id ? 'white' : 'var(--text-main)',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>{m.avatar || '👤'}</span>
                <span>{m.name}</span>
              </button>
            ))}
        </div>
      )}

      {/* İstemci Tarafı Filtrelenmiş Veriler ve Hesaplamalar */}
      {(() => {
        const filteredAccounts = (data?.accounts || []).filter((acc: any) => {
          if (selectedMember === 'all') return true;
          if (selectedMember === 'mine') return acc.is_mine;
          const targetMem = data?.monthlySummary?.familyMembers?.find((m: any) => m.id === selectedMember);
          return targetMem?.user_id ? acc.user_id === targetMem.user_id : true;
        });

        const filteredRecentTx = (data?.recentTransactions || []).filter((tx: any) => {
          if (selectedMember === 'all') return true;
          if (selectedMember === 'mine') return tx.is_mine;
          return tx.member_id === selectedMember;
        });

        // 4'lü Executive KPI Hesaplamaları
        const totalAssets = filteredAccounts
          .filter((a: any) => a.type !== 'credit_card' && a.type !== 'loan')
          .reduce((sum: number, a: any) => {
            const bal = Number(a.balance) || 0;
            const rate = getRate(a.currency);
            if (a.type === 'kmh' && bal < 0) return sum;
            return sum + (bal * rate);
          }, 0);

        const totalDebts = filteredAccounts
          .reduce((sum: number, a: any) => {
            const bal = Number(a.balance) || 0;
            const rate = getRate(a.currency);
            if (a.type === 'credit_card' || a.type === 'loan') {
              return sum + (bal * rate);
            }
            if (a.type === 'kmh' && bal < 0) {
              return sum + (Math.abs(bal) * rate);
            }
            return sum;
          }, 0);

        const netWorth = totalAssets - totalDebts;
        const totalIncome = data?.monthlySummary?.totalIncome || 0;
        const totalExpense = data?.monthlySummary?.totalExpense || 0;
        const netCashFlow = totalIncome - totalExpense;

        return (
          <>
            {/* 📊 2. Revolut / Copilot Money Tarzı 4'lü Executive KPI Özet Satırı */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
              marginBottom: '20px'
            }}>
              {/* 1. Toplam Varlık */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderTop: '3px solid #10B981',
                borderRadius: 'var(--radius-xl)',
                padding: '14px 16px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    🟢 Toplam Varlık
                  </span>
                  <span style={{ fontSize: '16px' }}>🏦</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: '#065F46', marginTop: '4px' }}>
                  {formatTRY(totalAssets)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Vadesiz, Vadeli, Döviz ve Nakit
                </div>
              </div>

              {/* 2. Toplam Borç */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderTop: '3px solid #EF4444',
                borderRadius: 'var(--radius-xl)',
                padding: '14px 16px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    🔴 Toplam Borç
                  </span>
                  <span style={{ fontSize: '16px' }}>💳</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: '#991B1B', marginTop: '4px' }}>
                  {formatTRY(totalDebts)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Kredi Kartları, Krediler ve KMH
                </div>
              </div>

              {/* 3. Net Değer (Net Worth) */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderTop: `3px solid ${netWorth >= 0 ? '#3B82F6' : '#EF4444'}`,
                borderRadius: 'var(--radius-xl)',
                padding: '14px 16px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    🔵 Net Değer
                  </span>
                  <span style={{ fontSize: '16px' }}>⚖️</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: netWorth >= 0 ? '#1E40AF' : '#991B1B', marginTop: '4px' }}>
                  {formatTRY(netWorth)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Net Varlık - Borç Pozisyonu
                </div>
              </div>

              {/* 4. Aylık Net Nakit Akışı */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderTop: `3px solid ${netCashFlow >= 0 ? '#10B981' : '#F59E0B'}`,
                borderRadius: 'var(--radius-xl)',
                padding: '14px 16px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    🟣 Aylık Nakit Akışı
                  </span>
                  <span style={{ fontSize: '16px' }}>📊</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: netCashFlow >= 0 ? '#059669' : '#D97706', marginTop: '4px' }}>
                  {netCashFlow >= 0 ? `+${formatTRY(netCashFlow)}` : formatTRY(netCashFlow)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Bu Ay Gelir ({formatTRY(totalIncome)}) - Gider ({formatTRY(totalExpense)})
                </div>
              </div>

              {/* 5. Güvenli Günlük Harcama Limiti */}
              {data?.safeDailyLimit && (
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderTop: '3px solid #06B6D4',
                  borderRadius: 'var(--radius-xl)',
                  padding: '14px 16px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      🛡️ Güvenli Günlük Limit
                    </span>
                    <span style={{ fontSize: '16px' }}>⏱️</span>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: '#0891B2', marginTop: '4px' }}>
                    {formatTRY(data.safeDailyLimit.safeDailyLimit)}<span style={{ fontSize: '12px', fontWeight: 700 }}>/gün</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Kalan {data.safeDailyLimit.remainingDaysInMonth} gün • Faturalar düşülmüş
                  </div>
                </div>
              )}
            </div>

            {/* ⚡ Doğal Dil Tek Satır Hızlı İşlem Girişi */}
            {(() => {
              const liveDraft = quickFinanceText.trim()
                ? parseQuickFinanceInput(quickFinanceText, data?.accounts || [], data?.categories || [])
                : null;
              const openPrefilledModal = (e: React.FormEvent) => {
                e.preventDefault();
                if (!liveDraft) return;
                setManualDraft({
                  txType: liveDraft.txType,
                  amount: liveDraft.amount,
                  merchant: liveDraft.merchant,
                  walletId: liveDraft.walletId,
                  categoryId: liveDraft.categoryId
                });
                setIsManualOpen(true);
              };
              return (
                <form
                  onSubmit={openPrefilledModal}
                  className="card"
                  style={{
                    marginBottom: '20px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={quickFinanceText}
                      onChange={e => setQuickFinanceText(e.target.value)}
                      placeholder="⚡ Doğal dille yazın: 'Kahve 120 nakit', '+65000 maaş garanti', 'Market 1450 kredi kartı'..."
                      aria-label="Doğal dil hızlı finans girişi"
                      style={{
                        flex: '1 1 260px',
                        minWidth: 0,
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)',
                        color: 'var(--text-main)',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!quickFinanceText.trim()}
                      className="btn-primary"
                      style={{ padding: '9px 16px', fontSize: '12px', fontWeight: 800, borderRadius: '10px', whiteSpace: 'nowrap' }}
                    >
                      İncele &amp; Ekle →
                    </button>
                  </div>
                  {liveDraft && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px', fontWeight: 700 }}>
                      <span style={{ padding: '2px 8px', borderRadius: '999px', background: liveDraft.txType === 'income' ? 'var(--emerald-bg)' : 'rgba(239,68,68,0.1)', color: liveDraft.txType === 'income' ? 'var(--emerald)' : '#DC2626' }}>
                        {liveDraft.txType === 'income' ? '📈 Gelir' : '💸 Gider'}: {liveDraft.numericAmount > 0 ? formatTRY(liveDraft.numericAmount) : 'Tutar bekleniyor'}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                        🏷️ {liveDraft.merchant}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                        💳 {liveDraft.walletName}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                        📂 {liveDraft.categoryName}
                      </span>
                    </div>
                  )}
                </form>
              );
            })()}

            {/* 🖥️ 3. Dengeli 2 Sütunlu Bento Grid Mimarisi */}
            <div className="dashboard-grid">
              {/* 👈 SOL SÜTUN: Varlıklar & Bütçe Planlaması */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. Varlık & Borç Hesapları Kartı (Segmented Control & Gradient Barlar) */}
                <AccountsCard
                  accounts={filteredAccounts}
                  familyMembers={data?.monthlySummary?.familyMembers || []}
                  onUpdate={handleUpdate}
                  onOpenCardStatement={(accId) => setCardStatementAccId(accId)}
                  marketRates={data?.marketRates}
                />

                {/* 2. Bütçe Limitleri & 50/30/20 Dağılımı */}
                <BudgetLimitsCard
                  categories={data?.categories || []}
                  monthlySummary={data?.monthlySummary || { totalIncome: 0, totalExpense: 0, totalBudgetLimit: 0, monthName: '', netCashFlow: 0, categories: [] }}
                  onUpdate={handleUpdate}
                  onMonthChange={handleMonthChange}
                  onOpenCategoryDetail={(catId, catName) => setCategoryDetail({ catId, catName })}
                />

                {/* 3. 6 Aylık Gelecek Bütçe & Taksit Projeksiyon Kartı */}
                <FutureForecastCard
                  forecast={data?.monthlySummary?.futureForecast || []}
                  selectedMonth={selectedMonth}
                  onSelectMonth={handleMonthChange}
                />
              </div>

              {/* 👉 SAĞ SÜTUN: Risk Motoru, Faturalar & Harcama Akışı */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. Kredi Kartı Risk & Faiz Motoru (Timeline Disiplini & Hızlı Öde) */}
                <BudgetRiskCard
                  accounts={filteredAccounts}
                  onUpdate={handleUpdate}
                  onOpenCardStatement={(accId) => setCardStatementAccId(accId)}
                  onOpenTransfer={(cardId) => { setTransferDefaultTargetId(cardId || null); setIsTransferOpen(true); }}
                />

                {/* 2. Periyodik Fatura & Abonelik Takvimi (Geri Sayım Rozetleri & Timeline) */}
                <RecurringBillsCard
                  accounts={filteredAccounts}
                  categories={data?.categories || []}
                  onToast={showToast}
                  onUpdate={handleUpdate}
                />

                {/* 3. Finansal Harcama Davranışları & No-Spend Analitiği (Faz 3) */}
                <SpendingHabitsCard />

                {/* 4. Son İşlemler (Mobilde 2 Satırlı Kompakt Kart, Masaüstünde Veri Tablosu + CSV + Arama) */}
                <RecentTxCard
                  transactions={filteredRecentTx}
                  upcomingPayments={data?.upcomingPayments || []}
                  onUpdate={handleUpdate}
                  onOpenCardStatement={(accId) => setCardStatementAccId(accId)}
                />
              </div>
            </div>

            {/* Birikim Hedefleri (Sinking Funds) */}
            <div style={{ marginTop: '20px' }}>
              <SavingsGoalsCard
                funds={data?.sinkingFunds || []}
                accounts={filteredAccounts}
                onUpdate={handleUpdate}
              />
            </div>

            {/* Kişisel Borç & Alacak Takibi (Sayfa Altı Tam Genişlik) */}
            <div style={{ marginTop: '20px' }}>
              <PersonalDebtsCard
                accounts={filteredAccounts}
                onToast={showToast}
                onUpdate={handleUpdate}
                marketRates={data?.marketRates}
              />
            </div>
          </>
        );
      })()}

      <ReceiptScanModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        accounts={data?.accounts || []}
        onSuccess={() => handleUpdate('✅ Fiş başarıyla kaydedildi!')}
      />

      <ManualExpenseModal
        isOpen={isManualOpen}
        onClose={() => { setIsManualOpen(false); setPreselectedCatId(null); setManualDraft(null); }}
        accounts={data?.accounts || []}
        categories={data?.categories || []}
        initialCategoryId={preselectedCatId}
        initialDraft={manualDraft}
        onSuccess={(msg) => {
          setQuickFinanceText('');
          setManualDraft(null);
          handleUpdate(msg);
        }}
      />

      <CreditCardStatementModal
        isOpen={Boolean(cardStatementAccId)}
        accountId={cardStatementAccId}
        onClose={() => setCardStatementAccId(null)}
      />

      <CategoryDetailModal
        isOpen={Boolean(categoryDetail.catId)}
        categoryId={categoryDetail.catId}
        categoryName={categoryDetail.catName}
        monthStr={selectedMonth}
        onClose={() => setCategoryDetail({ catId: null })}
        onUpdate={(msg) => handleUpdate(msg)}
        onAddExpense={(catId) => {
          setCategoryDetail({ catId: null });
          setPreselectedCatId(catId);
          setIsManualOpen(true);
        }}
      />

      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => { setIsTransferOpen(false); setTransferDefaultTargetId(null); }}
        accounts={data?.accounts || []}
        defaultToAccountId={transferDefaultTargetId}
        onSuccess={(msg) => handleUpdate(msg)}
      />
    </SharedLayout>
  );
}
