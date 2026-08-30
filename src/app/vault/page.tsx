'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import DigitalVaultCard from '@/components/vault/DigitalVaultCard';
import AddVaultItemModal from '@/components/modals/AddVaultItemModal';
import AddImportantDateModal from '@/components/modals/AddImportantDateModal';
import AddPetModal from '@/components/modals/AddPetModal';

export default function VaultPage() {
  const [data, setData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [vaultEditItem, setVaultEditItem] = useState<any>(null);

  const [isDateOpen, setIsDateOpen] = useState(false);
  const [dateEditItem, setDateEditItem] = useState<any>(null);

  const [isPetOpen, setIsPetOpen] = useState(false);
  const [petEditItem, setPetEditItem] = useState<any>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchData = async () => {
    try {
      const [vaultRes, notifRes] = await Promise.all([
        fetch('/api/digital-vault'),
        fetch('/api/notifications')
      ]);

      const [vaultJ, notifJ] = await Promise.all([
        vaultRes.json(),
        notifRes.json()
      ]);

      if (vaultJ.success) setData(vaultJ.data);
      if (notifJ.success) setNotifData(notifJ.data);
    } catch (err) {
      console.error(err);
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
  }, []);

  const handleUpdate = (msg?: string) => {
    fetchData();
    window.dispatchEvent(new CustomEvent('singularity-refresh'));
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
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text-main)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontSize: '13px', zIndex: 999, boxShadow: 'var(--shadow-lg)' }}>
          {toastMsg}
        </div>
      )}

      <div style={{ padding: '0 16px 8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>🗂️ Dijital Kasa & Önemli Günler</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
          Pasaport, kimlik, tapu, sigorta, evcil hayvan karneleri ve doğum günleri
        </p>
      </div>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {data && (
            <DigitalVaultCard
              vaultItems={data.vaultItems || []}
              importantDates={data.importantDates || []}
              pets={data.pets || []}
              onOpenAddVault={(item) => {
                setVaultEditItem(item || null);
                setIsVaultOpen(true);
              }}
              onOpenAddDate={(item) => {
                setDateEditItem(item || null);
                setIsDateOpen(true);
              }}
              onOpenAddPet={(item) => {
                setPetEditItem(item || null);
                setIsPetOpen(true);
              }}
              onRefresh={fetchData}
              onToast={showToast}
            />
          )}
        </div>
      </div>

      {/* Vault Modalı */}
      <AddVaultItemModal
        isOpen={isVaultOpen}
        item={vaultEditItem}
        onClose={() => {
          setIsVaultOpen(false);
          setVaultEditItem(null);
        }}
        onSuccess={(msg) => handleUpdate(msg)}
      />

      {/* Important Date Modalı */}
      <AddImportantDateModal
        isOpen={isDateOpen}
        item={dateEditItem}
        onClose={() => {
          setIsDateOpen(false);
          setDateEditItem(null);
        }}
        onSuccess={(msg) => handleUpdate(msg)}
      />

      {/* Pet Modalı */}
      <AddPetModal
        isOpen={isPetOpen}
        item={petEditItem}
        onClose={() => {
          setIsPetOpen(false);
          setPetEditItem(null);
        }}
        onSuccess={(msg) => handleUpdate(msg)}
      />
    </SharedLayout>
  );
}
