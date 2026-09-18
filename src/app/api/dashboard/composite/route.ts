import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { initDatabase } from '@/db';
import { GET as getBudget } from '@/app/api/budget/route';
import { GET as getVehicles } from '@/app/api/vehicles/route';
import { GET as getLibrary } from '@/app/api/library/route';
import { GET as getFasting } from '@/app/api/health/fasting/route';
import { GET as getWellness } from '@/app/api/wellness/route';
import { GET as getShopping } from '@/app/api/shopping-list/route';
import { GET as getNotifications } from '@/app/api/notifications/route';
import { fetchLiveExchangeRates } from '@/lib/market-data';

/**
 * Composite Dashboard Aggregate Endpoint
 * Tek bir HTTP isteği ile ana sayfanın 8 modül verisini ve piyasa kurlarını bellek içi
 * (in-process) paralel toplayıp döner. Döngüsel HTTP/fetch çağrılarını ve ağ gecikmesini sıfırlar.
 */
export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({
        success: true,
        data: {
          session: { is_authenticated: false, is_initialized: true, user: null }
        }
      }, { status: 200 });
    }

    // Tüm dashboard modül işleyicilerini bellek içi (in-process) paralel çalıştır
    const [
      budgetRes,
      vehicleRes,
      libraryRes,
      fastingRes,
      wellnessRes,
      shoppingRes,
      notifRes,
      ratesRes
    ] = await Promise.allSettled([
      getBudget(req).then(r => r.json()),
      getVehicles(req).then(r => r.json()),
      getLibrary().then(r => r.json()),
      getFasting().then(r => r.json()),
      getWellness().then(r => r.json()),
      getShopping().then(r => r.json()),
      getNotifications().then(r => r.json()),
      fetchLiveExchangeRates()
    ]);

    const getVal = (res: PromiseSettledResult<any>) => (res.status === 'fulfilled' && res.value?.success) ? res.value.data : null;

    return NextResponse.json({
      success: true,
      data: {
        session: {
          is_authenticated: true,
          is_initialized: true,
          user
        },
        budget: getVal(budgetRes),
        vehicles: getVal(vehicleRes),
        library: getVal(libraryRes),
        fasting: getVal(fastingRes),
        wellness: getVal(wellnessRes),
        shopping: getVal(shoppingRes),
        notifications: getVal(notifRes) || { notifications: [], critical: 0, warning: 0 },
        market_rates: ratesRes.status === 'fulfilled' ? ratesRes.value : null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Composite Dashboard API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Dashboard verileri derlenirken hata oluştu.'
    }, { status: 500 });
  }
}
