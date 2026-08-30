import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url, 'http://localhost');
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Hesap ID zorunludur.' }, { status: 400 });
    }

    const account = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, id)))[0];
    if (!account || account.type !== 'time_deposit') {
      return NextResponse.json({ success: false, error: 'Vadeli mevduat hesabı bulunamadı.' }, { status: 404 });
    }

    // Faiz hesaplama
    const principal = account.balance || 0;
    const rate = account.interest_rate || 0;
    const createdDate = new Date(account.created_at);
    const maturityDate = account.maturity_date ? new Date(account.maturity_date) : new Date();
    const now = new Date();

    // Gün sayısı
    const totalDays = Math.max(1, Math.round((maturityDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))));
    const remainingDays = Math.max(0, totalDays - elapsedDays);

    // Basit günlük faiz formülü: Anapara * (Faiz / 100) * (Gün / 365) * (1 - Stopaj)
    // Standart stopaj: %7.5
    const grossInterest = principal * (rate / 100) * (totalDays / 365);
    const taxAmount = grossInterest * 0.075;
    const netInterest = grossInterest - taxAmount;

    // Şu ana kadar biriken faiz
    const accruedGross = principal * (rate / 100) * (elapsedDays / 365);
    const accruedNet = accruedGross * 0.925;

    return NextResponse.json({
      success: true,
      data: {
        account,
        calculations: {
          principal,
          rate,
          totalDays,
          elapsedDays,
          remainingDays,
          grossInterest,
          netInterest,
          accruedNet,
          maturityAmount: principal + netInterest,
          isMatured: now >= maturityDate
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json();
    const { accountId, targetAccountId, actualInterestEarned, closeNotes } = body;

    if (!accountId || !targetAccountId) {
      return NextResponse.json({ success: false, error: 'Hesap ID ve Hedef Hesap ID zorunludur.' }, { status: 400 });
    }

    const depositAcc = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, accountId)))[0];
    if (!depositAcc || depositAcc.type !== 'time_deposit') {
      return NextResponse.json({ success: false, error: 'Vadeli mevduat hesabı bulunamadı.' }, { status: 404 });
    }

    const targetAcc = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, targetAccountId)))[0];
    if (!targetAcc) {
      return NextResponse.json({ success: false, error: 'Hedef vadesiz hesap bulunamadı.' }, { status: 404 });
    }

    const principal = depositAcc.balance || 0;
    const interest = Number(actualInterestEarned) || 0;
    const totalReturn = principal + interest;

    const now = new Date();
    const nowISO = now.toISOString();

    // 1. Hedef hesabın bakiyesini güncelle
    await db.update(walletsAccounts)
      .set({
        balance: targetAcc.balance + totalReturn,
        updated_at: nowISO
      })
      .where(eq(walletsAccounts.id, targetAccountId))
      ;

    // 2. Vadeli hesabı sıfırla ve deaktif et
    await db.update(walletsAccounts)
      .set({
        balance: 0,
        is_active: 0,
        updated_at: nowISO
      })
      .where(eq(walletsAccounts.id, accountId))
      ;

    // 3. Anapara dönüşü işlemini kaydet
    await db.insert(transactions).values({
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
    });

    // 4. Faiz geliri işlemini kaydet
    if (interest > 0) {
      await db.insert(transactions).values({
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
      });
    }

    return NextResponse.json({
      success: true,
      message: `Vadeli mevduat kapatıldı! Toplam ${totalReturn.toLocaleString('tr-TR')} ${depositAcc.currency} (${principal.toLocaleString('tr-TR')} anapara + ${interest.toLocaleString('tr-TR')} faiz) ${targetAcc.name} hesabına aktarıldı.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
