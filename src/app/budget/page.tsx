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
import ReceiptScanModal from '@/components/modals/ReceiptScanModal';
import ManualExpenseModal from '@/components/modals/ManualExpenseModal';
import CreditCardStatementModal from '@/components/modals/CreditCardStatementModal';
import CategoryDetailModal from '@/components/modals/CategoryDetailModal';
import TransferModal from '@/components/modals/TransferModal';
import MarketRatesBar from '@/components/budget/MarketRatesBar';

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
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [cardStatementAccId, setCardStatementAccId] = useState<string | null>(null);
  const [categoryDetail, setCategoryDetail] = useState<{ catId: string | null; catName?: string }>({ catId: null });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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
    const [budRes, notifRes] = await Promise.all([
      fetch(`/api/budget?month=${monthToFetch}`),
      fetch('/api/notifications')
    ]);
    const [budJ, notifJ] = await Promise.all([budRes.json(), notifRes.json()]);
    if (budJ.success) setData(budJ.data);
    if (notifJ.success) setNotifData(notifJ.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const handleMonthChange = (mStr: string) => {
    setSelectedMonth(mStr);
  };

  const handleUpdate = (msg?: string) => {
    fetchData();
    if (msg) showToast(msg);
  };

  if (loading) return <SharedLayout notifications={notifData}><div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Yükleniyor...</div></SharedLayout>;

  const formatTRY = (val: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val || 0);

  // FX Kuru Dönüştürücü
  const getRate = (curr: string) => {
    const rates = data?.marketRates;
    if (!rates) {
      if (curr === 'USD') return 38.5;
      if (curr === 'EUR') return 41.5;
      if (curr === 'GBP') return 48.5;
      if (curr === 'GOLD') return 3200;
      return 1.0;
    }
    if (curr === 'USD') return rates.USD_TRY || 38.5;
    if (curr === 'EUR') return rates.EUR_TRY || 41.5;
    if (curr === 'GBP') return rates.GBP_TRY || 48.5;
    if (curr === 'GOLD') return rates.GOLD_GRAM_TRY || 3200;
    return 1.0;
  };

  return (
    <SharedLayout notifications={notifData}>
      {toastMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text-main)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 500, boxShadow: 'var(--shadow-lg)', zIndex: 999 }}>
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

      {/* 🎛️ Aile / Kişi Görünüm Filtresi Barı */}
      {data?.monthlySummary?.familyMembers && data.monthlySummary.familyMembers.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '16px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
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
            </div>

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
                  monthlySummary={data?.monthlySummary || { totalIncome: 0, totalExpenses: 0, netCashFlow: 0, categories: [] }}
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
                  onOpenTransfer={() => setIsTransferOpen(true)}
                />

                {/* 2. Periyodik Fatura & Abonelik Takvimi (Geri Sayım Rozetleri & Timeline) */}
                <RecurringBillsCard
                  accounts={filteredAccounts}
                  categories={data?.categories || []}
                  onToast={showToast}
                  onUpdate={handleUpdate}
                />

                {/* 3. Son İşlemler (Mobilde 2 Satırlı Kompakt Kart, Masaüstünde Veri Tablosu + CSV + Arama) */}
                <RecentTxCard
                  transactions={filteredRecentTx}
                  upcomingPayments={data?.upcomingPayments || []}
                  onUpdate={handleUpdate}
                  onOpenCardStatement={(accId) => setCardStatementAccId(accId)}
                />
              </div>
            </div>

            {/* Kişisel Borç & Alacak Takibi (Sayfa Altı Tam Genişlik) */}
            <div style={{ marginTop: '20px' }}>
              <PersonalDebtsCard
                accounts={filteredAccounts}
                onToast={showToast}
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
        onClose={() => setIsManualOpen(false)}
        accounts={data?.accounts || []}
        categories={data?.categories || []}
        onSuccess={(msg) => handleUpdate(msg)}
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
      />

      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        accounts={data?.accounts || []}
        onSuccess={(msg) => handleUpdate(msg)}
      />
    </SharedLayout>
  );
}
