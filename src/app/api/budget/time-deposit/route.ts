import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions } from '@/db/schema';
import { eq , or } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    initDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Hesap ID zorunludur.' }, { status: 400 });
    }

    const account = await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, id)).get();
    if (!account || account.type !== 'time_deposit') {
      return NextResponse.json({ success: false, error: 'Vadeli mevduat hesabı bulunamadı.' }, { status: 404 });
    }

    // Faiz hesaplama
    const principal = account.balance || 0;
    const rate = account.interest_rate || 0;
    const createdDate = new Date(account.created_at);
    const maturityDate = account.maturity_date ? new Date(account.maturity_date) : new Date();

    // Gün farkı
    const diffTime = Math.max(0, maturityDate.getTime() - createdDate.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 30; // Varsayılan 30 gün

    // Brüt faiz formülü: Anapara * (Faiz Oranı / 100) * (Gün / 365)
    const calculatedInterest = Math.round(principal * (rate / 100) * (days / 365) * 100) / 100;

    return NextResponse.json({
      success: true,
      data: {
        id: account.id,
        name: account.name,
        principal,
        interest_rate: rate,
        interest_type: account.interest_type || 'simple',
        maturity_date: account.maturity_date,
        created_at: account.created_at,
        days,
        calculatedInterest,
        deposited_account_id: account.deposited_account_id,
        currency: account.currency
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();
    const { accountId, targetAccountId, actualInterestEarned, closeNotes } = body;

    if (!accountId || !targetAccountId) {
      return NextResponse.json({ success: false, error: 'Hesap ID ve Hedef Hesap ID zorunludur.' }, { status: 400 });
    }

    const depositAcc = await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, accountId)).get();
    if (!depositAcc || depositAcc.type !== 'time_deposit') {
      return NextResponse.json({ success: false, error: 'Vadeli mevduat hesabı bulunamadı.' }, { status: 404 });
    }

    const targetAcc = await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, targetAccountId)).get();
    if (!targetAcc) {
      return NextResponse.json({ success: false, error: 'Hedef vadesiz hesap bulunamadı.' }, { status: 404 });
    }

    const principal = depositAcc.balance || 0;
    const interest = Number(actualInterestEarned) || 0;
    const totalReturn = principal + interest;

    const now = new Date();
    const nowISO = now.toISOString();

    // 1. Hedef hesabın bakiyesini güncelle
    db.update(walletsAccounts)
      .set({
        balance: targetAcc.balance + totalReturn,
        updated_at: nowISO
      })
      .where(eq(walletsAccounts.id, targetAccountId))
      .run();

    // 2. Vadeli hesabı sıfırla ve deaktif et
    db.update(walletsAccounts)
      .set({
        balance: 0,
        is_active: 0,
        updated_at: nowISO
      })
      .where(eq(walletsAccounts.id, accountId))
      .run();

    // 3. Anapara dönüşü işlemini kaydet
    db.insert(transactions).values({
      id: `tx-deposit-return-${Date.now()}`,
      wallet_id: targetAccountId,
      merchant: `🏛️ Vadeli Mevduat Dönüşü (Anapara)`,
      amount: principal,
      currency: depositAcc.currency,
      transaction_date: nowISO.split('T')[0],
      notes: `${depositAcc.name} vadeli hesabı kapanış anaparası. ${closeNotes || ''}`,
      is_installment: 0,
      installment_number: 1,
      total_installments: 1,
      is_verified: 1,
      is_family_shared: 1,
      created_at: nowISO,
      updated_at: nowISO,
      sync_status: 'synced',
      device_id: 'mac-local'
    }).run();

    // 4. Faiz geliri işlemini kaydet
    if (interest > 0) {
      db.insert(transactions).values({
        id: `tx-deposit-interest-${Date.now()}`,
        wallet_id: targetAccountId,
        merchant: `💵 Vadeli Mevduat Faiz Geliri`,
        amount: interest,
        currency: depositAcc.currency,
        transaction_date: nowISO.split('T')[0],
        notes: `${depositAcc.name} vadeli hesabı net faiz getirisi.`,
        is_installment: 0,
        installment_number: 1,
        total_installments: 1,
        is_verified: 1,
        is_family_shared: 1,
        created_at: nowISO,
        updated_at: nowISO,
        sync_status: 'synced',
        device_id: 'mac-local'
      }).run();
    }

    return NextResponse.json({
      success: true,
      message: `Vadeli mevduat kapatıldı! Toplam ${totalReturn.toLocaleString('tr-TR')} ${depositAcc.currency} (${principal.toLocaleString('tr-TR')} anapara + ${interest.toLocaleString('tr-TR')} faiz) ${targetAcc.name} hesabına aktarıldı.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
