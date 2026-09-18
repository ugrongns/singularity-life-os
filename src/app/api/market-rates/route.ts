import { NextResponse } from 'next/server';
import { fetchLiveExchangeRates } from '@/lib/market-data';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const refresh = searchParams.get('refresh') === 'true';

    const rates = await fetchLiveExchangeRates(refresh);

    return NextResponse.json({
      success: true,
      data: rates,
      message: 'Canlı piyasa ve döviz kurları başarıyla alındı.'
    });
  } catch (error: any) {
    console.error('Market Rates API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Piyasa kurları alınırken hata oluştu.'
    }, { status: 500 });
  }
}
