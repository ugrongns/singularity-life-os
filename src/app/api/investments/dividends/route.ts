import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { investmentAssets, investmentDividends, transactions, walletsAccounts } from '@/db/schema';
import { eventBus, EVENTS } from '@/lib/events';
import { eq , or } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();

    const {
      asset_id,
      amount_per_share,
      total_amount,
      treatment_type = 'cash_payout', // 'cash_payout' | 'drip_reinvest'
      wallet_id = 'wallet-isbank'
    } = body;

    const asset = (await db.select().from(investmentAssets).where(eq(investmentAssets.id, asset_id)))[0];
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Varlık bulunamadı.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const dividendId = `div-${Date.now()}`;

    let reinvestedQty = 0;

    if (treatment_type === 'drip_reinvest') {
      // DRIP: Temettü tutarıyla güncel fiyattan ek hisse alımı
      reinvestedQty = Math.round((total_amount / asset.current_price) * 100) / 100;
      const newQuantity = asset.quantity + reinvestedQty;
      // Yeni ortalama maliyet hesabı
      const newTotalCost = (asset.quantity * asset.avg_cost) + total_amount;
      const newAvgCost = Math.round((newTotalCost / newQuantity) * 100) / 100;

      db.update(investmentAssets)
        .set({
          quantity: newQuantity,
          avg_cost: newAvgCost,
          updated_at: now
        })
        .where(eq(investmentAssets.id, asset_id))
        ;
    } else {
      // Nakit Temettü: Bütçeye gelir olarak yaz ve banka hesabını artır
      const txId = `tx-div-${Date.now()}`;
      db.insert(transactions).values({
        id: txId,
        wallet_id,
        category_id: 'cat-maas', // Yatırım / Gelir
        merchant: `${asset.name} Temettü Geliri`,
        amount: total_amount,
        currency: 'TRY',
        transaction_date: today,
        notes: `Hisse Başına ${amount_per_share} TL Temettü Dağıtımı`,
        is_verified: 1,
        is_family_shared: 1,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
        device_id: 'mac-local'
      });

      const wallet = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, wallet_id)))[0];
      if (wallet) {
        db.update(walletsAccounts)
          .set({ balance: wallet.balance + total_amount, updated_at: now })
          .where(eq(walletsAccounts.id, wallet_id))
          ;
      }
    }

    // Temettü tablosuna kaydet
    db.insert(investmentDividends).values({
      id: dividendId,
      asset_id,
      dividend_date: today,
      amount_per_share,
      total_amount,
      currency: 'TRY',
      treatment_type,
      reinvested_quantity: reinvestedQty,
      is_family_shared: 1,
      created_at: now,
      updated_at: now
    });

    await eventBus.emit(EVENTS.DIVIDEND_RECORDED, {
      dividendId,
      asset_id,
      total_amount,
      treatment_type,
      reinvestedQty
    });

    return NextResponse.json({
      success: true,
      message: treatment_type === 'drip_reinvest'
        ? `DRIP uygulandı: Portföye +${reinvestedQty} adet ${asset.symbol} hissesi eklendi.`
        : `Nakit temettü (${total_amount.toLocaleString('tr-TR')} TL) banka hesabınıza gelir olarak işlendi.`
    });
  } catch (error: any) {
    console.error('Dividend API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
