'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import AccountsCard from '@/components/budget/AccountsCard';
import { BudgetRiskCard } from '@/components/budget/BudgetRiskCard';
import BudgetLimitsCard from '@/components/budget/BudgetLimitsCard';
import RecentTxCard from '@/components/budget/RecentTxCard';
import FutureForecastCard from '@/components/budget/FutureForecastCard';
import PersonalDebtsCard from '@/components/budget/PersonalDebtsCard';
import ReceiptScanModal from '@/components/modals/ReceiptScanModal';
import ManualExpenseModal from '@/components/modals/ManualExpenseModal';
import CreditCardStatementModal from '@/components/modals/CreditCardStatementModal';
import CategoryDetailModal from '@/components/modals/CategoryDetailModal';
import TransferModal from '@/components/modals/TransferModal';

export default function BudgetPage() {
  const [data, setData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  // ✅ Timezone-safe başlangıç ayı: toISOString() UTC'ye kaydıracağından getFullYear/getMonth kullanılır
  const todayLocal = new Date();
  const initMonth = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(initMonth);
  const [loading, setLoading] = useState(true);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [cardStatementAccId, setCardStatementAccId] = useState<string | null>(null);
  const [categoryDetail, setCategoryDetail] = useState<{ catId: string | null; catName?: string }>({ catId: null });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

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

  return (
    <SharedLayout notifications={notifData}>
      {toastMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text-main)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 500, boxShadow: 'var(--shadow-lg)', zIndex: 999 }}>
          {toastMsg}
        </div>
      )}

      {/* Sayfa Başlığı ve İşlem Butonları — NetWorth'ün üstünde */}
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>💰 Finans & Bütçe</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Hesaplar, harcamalar, borç ödeme ve bütçe limitleri</p>
        </div>
        
        {/* İşlem Butonları Toolbar */}
        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
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

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <BudgetRiskCard
            accounts={data?.accounts || []}
            onUpdate={handleUpdate}
          />
          <AccountsCard
            accounts={data?.accounts || []}
            onUpdate={handleUpdate}
            onOpenCardStatement={(accId) => setCardStatementAccId(accId)}
          />
          <RecentTxCard
            transactions={data?.recentTransactions || []}
            upcomingPayments={data?.upcomingPayments || []}
            onUpdate={handleUpdate}
            onOpenCardStatement={(accId) => setCardStatementAccId(accId)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <BudgetLimitsCard
            categories={data?.categories || []}
            monthlySummary={data?.monthlySummary || { totalIncome: 0, totalExpenses: 0, netCashFlow: 0, categories: [] }}
            onUpdate={handleUpdate}
            onMonthChange={handleMonthChange}
            onOpenCategoryDetail={(catId, catName) => setCategoryDetail({ catId, catName })}
          />
        </div>
      </div>

      {/* Gelecek 6 Ay Bütçe & Taksit Projeksiyon Kartı */}
      <FutureForecastCard
        forecast={data?.monthlySummary?.futureForecast || []}
        selectedMonth={selectedMonth}
        onSelectMonth={handleMonthChange}
      />

      {/* Kişisel Borç & Alacak Takibi */}
      <PersonalDebtsCard
        accounts={data?.accounts || []}
        onToast={showToast}
      />

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
