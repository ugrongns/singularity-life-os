'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SharedLayout from '@/components/layout/SharedLayout';

/**
 * Yatırım & Portföy modülü bu projeden çıkarılmıştır.
 * Bu özellik ayrı bir proje olarak geliştirilecektir.
 */
export default function InvestmentsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/budget');
  }, [router]);

  return (
    <SharedLayout notifications={{ notifications: [], critical: 0, warning: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
            Yatırım Modülü Taşınıyor
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            Portföy & Yatırım yönetimi ayrı bir projeye taşınmaktadır.
            Sizi Finans & Bütçe sayfasına yönlendiriyoruz...
          </div>
        </div>
      </div>
    </SharedLayout>
  );
}
