import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions } from '@/db/schema';
import { eq , or } from 'drizzle-orm';
import { eventBus, EVENTS } from '@/lib/events';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json();
    const { from_account_id, to_account_id, amount, note, transaction_date } = body;

    if (!from_account_id || !to_account_id || !amount || Number(amount) <= 0) {
      return NextResponse.json({ success: false, error: 'Lütfen çıkış hesabı, hedef hesap ve geçerli bir tutar girin.' }, { status: 400 });
    }

    if (from_account_id === to_account_id) {
      return NextResponse.json({ success: false, error: 'Çıkış hesabı ile hedef hesap aynı olamaz.' }, { status: 400 });
    }

    const numAmount = Number(amount);
    const fromAcc = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, from_account_id)))[0];
    const toAcc = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, to_account_id)))[0];

    if (!fromAcc || !toAcc) {
      return NextResponse.json({ success: false, error: 'Hesaplardan biri bulunamadı.' }, { status: 404 });
    }

    // Yetersiz bakiye kontrolü (Banka/Nakit hesaplar eksiye düşemez)
    if (fromAcc.type !== 'credit_card' && numAmount > fromAcc.balance) {
      return NextResponse.json({
        success: false,
        error: `Yetersiz Bakiye! ${fromAcc.name} hesabınızda sadece ${fromAcc.balance.toLocaleString('tr-TR')} ₺ bakiye bulunmaktadır.`
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const txDate = transaction_date || now.split('T')[0];

    // 1. Çıkış Hesabı Bakiye Güncellemesi
    const newFromBalance = fromAcc.type === 'credit_card'
      ? fromAcc.balance + numAmount // Kredi kartından para çekilirse borcu artar
      : fromAcc.balance - numAmount; // Banka/Nakit hesabından para çıkarsa bakiye düşer

    await db.update(walletsAccounts)
      .set({ balance: Math.max(0, newFromBalance), updated_at: now })
      .where(eq(walletsAccounts.id, from_account_id))
      ;

    // 2. Hedef Hesap Bakiye Güncellemesi
    const newToBalance = toAcc.type === 'credit_card'
      ? toAcc.balance - numAmount // Kredi kartına ödeme yapılırsa borcu düşer!
      : toAcc.balance + numAmount; // Banka/Nakit hesabına girerse bakiye artar

    await db.update(walletsAccounts)
      .set({ balance: Math.max(0, newToBalance), updated_at: now })
      .where(eq(walletsAccounts.id, to_account_id))
      ;

    // 3. İşlem Kaydı Oluştur
    const isCardPayment = toAcc.type === 'credit_card';
    const txMerchant = isCardPayment 
      ? `💳 Kart Ödemesi: ${toAcc.name}`
      : `🔄 Transfer: ${fromAcc.name} ➔ ${toAcc.name}`;

    const txId = `tx-transfer-${Date.now()}`;
    await db.insert(transactions).values({
      id: txId,
      wallet_id: from_account_id,
      merchant: txMerchant,
      amount: numAmount,
      currency: fromAcc.currency || 'TRY',
      transaction_date: txDate,
      is_installment: 0,
      notes: note ? note.trim() : (isCardPayment ? `${toAcc.name} borç ödemesi` : `Hesaplar arası transfer`),
      created_at: now,
      updated_at: now
    });

    // 4. Event Bus Bildirimi
    await eventBus.emit(EVENTS.TRANSACTION_CREATED, {
      transactionId: txId,
      amount: numAmount,
      merchant: txMerchant,
      wallet_id: from_account_id,
      type: 'transfer'
    });

    return NextResponse.json({
      success: true,
      message: isCardPayment 
        ? `✅ ${toAcc.name} kartına ${numAmount.toLocaleString('tr-TR')} ₺ ödeme yapıldı ve borcu düşüldü!`
        : `✅ ${fromAcc.name} hesabından ${toAcc.name} hesabına ${numAmount.toLocaleString('tr-TR')} ₺ transfer edildi!`
    });
  } catch (error: any) {
    console.error('Transfer API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
