'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import VehicleFleetCard from '@/components/vehicle/VehicleFleetCard';
import HomeOperationsCard from '@/components/home/HomeOperationsCard';
import MaintenanceHistoryModal from '@/components/vehicle/MaintenanceHistoryModal';
import AddFuelLogModal from '@/components/modals/AddFuelLogModal';
import AddVehicleServiceModal from '@/components/modals/AddVehicleServiceModal';
import AddHomeItemModal from '@/components/modals/AddHomeItemModal';

export default function VehiclesPage() {
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [homeData, setHomeData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals
  const [isMaintHistOpen, setIsMaintHistOpen] = useState(false);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isHomeModalOpen, setIsHomeModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchData = async () => {
    try {
      const [vehRes, homeRes, notifRes] = await Promise.all([
        fetch('/api/vehicles'),
        fetch('/api/home-operations'),
        fetch('/api/notifications')
      ]);

      const [vehJ, homeJ, notifJ] = await Promise.all([
        vehRes.json(),
        homeRes.json(),
        notifRes.json()
      ]);

      if (vehJ.success) setVehicleData(vehJ.data);
      if (homeJ.success) setHomeData(homeJ.data);
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
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>🚗 Araç & Ev Yönetim Merkezi</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
          Araç bakımı, yakıt günlüğü, muayene/sigorta takibi ve ev periyodik bakım / garanti merkezi
        </p>
      </div>

      <div className="dashboard-grid">
        {/* Sol Kolon: Araç Filosu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {vehicleData && (
            <VehicleFleetCard
              data={vehicleData}
              onOpenHistory={() => setIsMaintHistOpen(true)}
              onOpenFuelModal={() => setIsFuelModalOpen(true)}
              onOpenServiceModal={() => setIsServiceModalOpen(true)}
              onRefresh={fetchData}
            />
          )}
        </div>

        {/* Sağ Kolon: Ev Operasyonları */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <HomeOperationsCard
            maintenanceRecords={homeData?.maintenanceRecords || []}
            appliances={homeData?.appliances || []}
            onOpenAddModal={() => setIsHomeModalOpen(true)}
            onRefresh={fetchData}
          />
        </div>
      </div>

      {/* Modallar */}
      <MaintenanceHistoryModal
        isOpen={isMaintHistOpen}
        onClose={() => setIsMaintHistOpen(false)}
      />

      <AddFuelLogModal
        isOpen={isFuelModalOpen}
        vehicleId={vehicleData?.vehicle?.id || 'veh-bmw-320i'}
        currentKm={vehicleData?.vehicle?.current_km || 70000}
        wallets={vehicleData?.wallets || []}
        onClose={() => setIsFuelModalOpen(false)}
        onSuccess={(msg) => handleSuccess(msg)}
      />

      <AddVehicleServiceModal
        isOpen={isServiceModalOpen}
        vehicleId={vehicleData?.vehicle?.id || 'veh-bmw-320i'}
        currentKm={vehicleData?.vehicle?.current_km || 70000}
        wallets={vehicleData?.wallets || []}
        onClose={() => setIsServiceModalOpen(false)}
        onSuccess={(msg) => handleSuccess(msg)}
      />

      <AddHomeItemModal
        isOpen={isHomeModalOpen}
        onClose={() => setIsHomeModalOpen(false)}
        onSuccess={(msg) => handleSuccess(msg)}
      />
    </SharedLayout>
  );
}
