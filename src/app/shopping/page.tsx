'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import ShoppingListCard from '@/components/shopping/ShoppingListCard';
import AddShoppingItemModal from '@/components/modals/AddShoppingItemModal';
import CheckoutToWalletModal from '@/components/modals/CheckoutToWalletModal';

export default function ShoppingPage() {
  const [data, setData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchData = async () => {
    try {
      const [shopRes, notifRes] = await Promise.all([
        fetch('/api/shopping-list'),
        fetch('/api/notifications')
      ]);

      const [shopJ, notifJ] = await Promise.all([
        shopRes.json(),
        notifRes.json()
      ]);

      if (shopJ.success) setData(shopJ.data);
      if (notifJ.success) setNotifData(notifJ.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSuccess = (msg?: string) => {
    fetchData();
    if (msg) showToast(msg);
  };

  if (loading) {
    return (
      <SharedLayout notifications={notifData}>
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Yükleniyor...</div>
      </SharedLayout>
    );
  }

  return (
    <SharedLayout notifications={notifData}>
      {toastMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text-main)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontSize: '13px', zIndex: 999 }}>
          {toastMsg}
        </div>
      )}

      <div style={{ padding: '0 16px 8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>🛒 Akıllı Market Listesi</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
          Fiş okuyucu AI, hazır alışveriş paketleri, sepet tutarı ve cüzdana harcama aktarma
        </p>
      </div>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {data && (
            <ShoppingListCard
              items={data.items || []}
              summary={data.summary || { total: 0, remaining: 0, done: 0, totalEstimated: 0, remainingEstimated: 0, checkedEstimated: 0 }}
              byCategory={data.byCategory || {}}
              categoryTotals={data.categoryTotals || {}}
              onOpenAddItem={(item) => {
                setEditItem(item || null);
                setIsAddOpen(true);
              }}
              onOpenCheckout={() => setIsCheckoutOpen(true)}
              onRefresh={fetchData}
            />
          )}
        </div>
      </div>

      {/* Add / Edit Shopping Item Modal */}
      <AddShoppingItemModal
        isOpen={isAddOpen}
        item={editItem}
        onClose={() => {
          setIsAddOpen(false);
          setEditItem(null);
        }}
        onSuccess={(msg) => handleSuccess(msg)}
      />

      {/* Checkout To Wallet Modal */}
      <CheckoutToWalletModal
        isOpen={isCheckoutOpen}
        wallets={data?.wallets || []}
        totalAmount={data?.summary?.checkedEstimated || 0}
        checkedCount={data?.summary?.done || 0}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={(msg) => handleSuccess(msg)}
      />
    </SharedLayout>
  );
}
