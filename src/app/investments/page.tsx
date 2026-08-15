'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import PortfolioHeroCard from '@/components/investments/PortfolioHeroCard';
import StockGoldList from '@/components/investments/StockGoldList';
import InvestmentAccountsCard from '@/components/investments/InvestmentAccountsCard';
import RealEstateCard from '@/components/investments/RealEstateCard';
import AddAssetModal from '@/components/modals/AddAssetModal';
import DividendModal from '@/components/modals/DividendModal';

export default function InvestmentsPage() {
  const [data, setData] = useState<any>(null);
  const [budgetData, setBudgetData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isDividendOpen, setIsDividendOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  const fetchData = async () => {
    const [invRes, budRes, reRes, notifRes] = await Promise.all([
      fetch('/api/investments'), fetch('/api/budget'), fetch('/api/real-estate'), fetch('/api/notifications')
    ]);
    const [invJ, budJ, reJ, notifJ] = await Promise.all([invRes.json(), budRes.json(), reRes.json(), notifRes.json()]);
    if (invJ.success) setData({ ...invJ.data, properties: reJ.success ? reJ.data?.properties : [] });
    if (budJ.success) setBudgetData(budJ.data);
    if (notifJ.success) setNotifData(notifJ.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);
  const handleUpdate = (msg?: string) => { fetchData(); if (msg) showToast(msg); };

  if (loading) return <SharedLayout notifications={notifData}><div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Yükleniyor...</div></SharedLayout>;

  return (
    <SharedLayout notifications={notifData}>
      {toastMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text-main)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontSize: '13px', zIndex: 999 }}>
          {toastMsg}
        </div>
      )}

      <div style={{ padding: '0 16px 8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>📈 Yatırımlar</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Portföy, hisseler, borsalar, BES ve gayrimenkul</p>
      </div>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {data && (
            <PortfolioHeroCard
              summary={data.summary} allocation={data.allocation}
              onOpenDividendModal={() => setIsDividendOpen(true)}
              onOpenAddAssetModal={() => setIsAddAssetOpen(true)}
            />
          )}
          {data && <StockGoldList assets={data.assets} besContracts={data.besContracts} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <InvestmentAccountsCard
            accounts={budgetData?.accounts || []}
            onUpdate={(msg) => handleUpdate(msg)}
          />
          {data?.properties && (
            <RealEstateCard
              properties={data.properties}
              onRentCollectedSuccess={() => handleUpdate('💰 Kira tahsil edildi!')}
            />
          )}
        </div>
      </div>

      <AddAssetModal
        isOpen={isAddAssetOpen}
        onClose={() => setIsAddAssetOpen(false)}
        onSuccess={(msg) => handleUpdate(msg)}
        accounts={budgetData?.accounts || []}
      />

      <DividendModal
        isOpen={isDividendOpen}
        onClose={() => setIsDividendOpen(false)}
        assets={data?.assets || []}
        accounts={budgetData?.accounts || []}
        onSuccess={() => handleUpdate('💵 Temettü uygulandı!')}
      />
    </SharedLayout>
  );
}
