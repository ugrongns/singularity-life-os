import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

/**
 * Composite Dashboard Aggregate Endpoint
 * Tek bir HTTP isteği ile ana sayfanın 8 modül verisini paralel olarak toplayıp istemciye döner.
 * Waterfall fetch gecikmesini sıfıra indirir.
 */
export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        data: {
          session: { is_authenticated: false, is_initialized: false }
        }
      }, { status: 200 });
    }

    const { origin } = new URL(req.url);
    const cookieHeader = req.headers.get('cookie') || '';
    const headers = {
      'cookie': cookieHeader,
      'Content-Type': 'application/json'
    };

    // Tüm dashboard verilerini paralel topla
    const [
      budgetRes,
      investRes,
      vehicleRes,
      libraryRes,
      fastingRes,
      wellnessRes,
      shoppingRes,
      notifRes
    ] = await Promise.allSettled([
      fetch(`${origin}/api/budget`, { headers }).then(r => r.json()),
      fetch(`${origin}/api/investments`, { headers }).then(r => r.json()),
      fetch(`${origin}/api/vehicles`, { headers }).then(r => r.json()),
      fetch(`${origin}/api/library`, { headers }).then(r => r.json()),
      fetch(`${origin}/api/health/fasting`, { headers }).then(r => r.json()),
      fetch(`${origin}/api/wellness`, { headers }).then(r => r.json()),
      fetch(`${origin}/api/shopping-list`, { headers }).then(r => r.json()),
      fetch(`${origin}/api/notifications`, { headers }).then(r => r.json()),
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
        investments: getVal(investRes),
        vehicles: getVal(vehicleRes),
        library: getVal(libraryRes),
        fasting: getVal(fastingRes),
        wellness: getVal(wellnessRes),
        shopping: getVal(shoppingRes),
        notifications: getVal(notifRes) || { notifications: [], critical: 0, warning: 0 },
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
