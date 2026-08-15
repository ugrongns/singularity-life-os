import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { realEstateProperties, realEstateCashflows, transactions, walletsAccounts } from '@/db/schema';
import { eventBus, EVENTS } from '@/lib/events';
import { eq, desc , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const properties = userId
      ? await db.select().from(realEstateProperties).where(or(eq(realEstateProperties.user_id, userId), eq(realEstateProperties.is_family_shared, 1))).all()
      : [];
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

    // Her mülk için kira getirisi, amortisman süresi ve bu ayki tahsilat durumu
    const processedProperties = await Promise.all(properties.map(async prop => {
      const annualRent = prop.monthly_rent_income * 12;
      const rentalYield = prop.estimated_market_value > 0 ? ((annualRent / prop.estimated_market_value) * 100) : 0;
      const amortizationYears = annualRent > 0 ? (prop.estimated_market_value / annualRent) : 0;

      // Bu ay kira tahsil edildi mi kontrolü
      const cashflows = await db.select()
        .from(realEstateCashflows)
        .where(eq(realEstateCashflows.property_id, prop.id))
        .all();
      const collectedThisMonth = cashflows.some(cf => cf.type === 'rent_collection' && cf.date.startsWith(currentMonth));

      return {
        ...prop,
        annualRent,
        rentalYieldPercent: Math.round(rentalYield * 10) / 10,
        amortizationYears: Math.round(amortizationYears * 10) / 10,
        isRentCollectedThisMonth: collectedThisMonth
      };
    }));

    const totalRealEstateValue = properties.reduce((sum, p) => sum + p.estimated_market_value, 0);
    const totalMonthlyRentIncome = properties.reduce((sum, p) => sum + p.monthly_rent_income, 0);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRealEstateValue,
          totalMonthlyRentIncome,
          propertyCount: properties.length
        },
        properties: processedProperties
      }
    });
  } catch (error: any) {
    console.error('Real Estate API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 1-Tıkla Kira Tahsilatı
export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();
    const { property_id, wallet_id = 'wallet-isbank' } = body;

    const property = await db.select().from(realEstateProperties).where(eq(realEstateProperties.id, property_id)).get();
    if (!property) {
      return NextResponse.json({ success: false, error: 'Mülk bulunamadı.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const rentAmount = property.monthly_rent_income;

    // 1. Mülk Nakit Akışına Kira Tahsilatı Ekle
    db.insert(realEstateCashflows).values({
      id: `cf-rent-${Date.now()}`,
      property_id,
      type: 'rent_collection',
      amount: rentAmount,
      currency: 'TRY',
      date: today,
      notes: `${property.title} - ${property.tenant_name} Aylık Kira Tahsilatı`,
      created_at: now,
      updated_at: now
    }).run();

    // 2. Bütçe Modülüne Gelir Kaydet
    const txId = `tx-rent-${Date.now()}`;
    db.insert(transactions).values({
      id: txId,
      wallet_id,
      category_id: 'cat-maas', // Gelir kategorisi
      merchant: `Kira Geliri (${property.title})`,
      amount: rentAmount,
      currency: 'TRY',
      transaction_date: today,
      notes: `Kiracı: ${property.tenant_name}`,
      is_verified: 1,
      is_family_shared: 1,
      created_at: now,
      updated_at: now,
      sync_status: 'synced',
      device_id: 'mac-local'
    }).run();

    // 3. Banka Hesabı Bakiyesini Artır
    const wallet = await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, wallet_id)).get();
    if (wallet) {
      db.update(walletsAccounts)
        .set({ balance: wallet.balance + rentAmount, updated_at: now })
        .where(eq(walletsAccounts.id, wallet_id))
        .run();
    }

    // 4. Event Bus Bildirimi
    await eventBus.emit(EVENTS.RENT_COLLECTED, {
      property_id,
      amount: rentAmount,
      wallet_id,
      tenant: property.tenant_name
    });

    return NextResponse.json({
      success: true,
      message: `${property.title} için ${rentAmount.toLocaleString('tr-TR')} TL kira tahsil edildi ve banka hesabınıza gelir olarak işlendi!`
    });
  } catch (error: any) {
    console.error('Rent Collect API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
