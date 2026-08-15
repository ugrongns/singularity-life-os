import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, flexInterestAccounts, flexInterestEarnings, transactions } from '@/db/schema';
import { eq, desc , or } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    initDatabase();
    const { searchParams } = new URL(req.url, 'http://localhost');
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'Hesap ID zorunludur.' }, { status: 400 });
    }

    // 1. Hesap bilgilerini al
    const account = await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, accountId)).get();
    if (!account) {
      return NextResponse.json({ success: false, error: 'Hesap bulunamadı.' }, { status: 404 });
    }

    // 2. Nema/Faiz durumunu al
    let flexConfig = await db.select().from(flexInterestAccounts).where(eq(flexInterestAccounts.account_id, accountId)).get();

    // 3. Kazanç geçmişini al
    const earnings = await db.select()
      .from(flexInterestEarnings)
      .where(eq(flexInterestEarnings.wallet_account_id, accountId))
      .orderBy(desc(flexInterestEarnings.created_at))
      .all();

    // 4. Eğer aktifse, geçen gün sayısını ve tahmini kazancı hesapla
    let activeDays = 0;
    let estimatedAccrued = 0;
    if (flexConfig && flexConfig.is_active === 1) {
      const start = new Date(flexConfig.updated_at);
      const today = new Date();
      const diffTime = Math.max(0, today.getTime() - start.getTime());
      activeDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; // En az 1 gün

      const principal = account.balance || 0;
      const rate = flexConfig.annual_rate || 0;
      // Brüt faiz formülü: Anapara * (Faiz Oranı / 100) * (Gün / 365)
      estimatedAccrued = Math.round(principal * (rate / 100) * (activeDays / 365) * 100) / 100;
    }

    return NextResponse.json({
      success: true,
      data: {
        accountName: account.name,
        currency: account.currency,
        balance: account.balance,
        flexConfig: flexConfig || { is_active: 0, annual_rate: 0, updated_at: null },
        activeDays,
        estimatedAccrued,
        earnings
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
    const { action, accountId } = body;

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'Hesap ID zorunludur.' }, { status: 400 });
    }

    const account = await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, accountId)).get();
    if (!account) {
      return NextResponse.json({ success: false, error: 'Hesap bulunamadı.' }, { status: 404 });
    }

    const nowISO = new Date().toISOString();

    if (action === 'configure') {
      const { isActive, annualRate } = body;
      const activeVal = isActive ? 1 : 0;
      const rateVal = Number(annualRate) || 0;

      // Kayıt var mı kontrol et
      const existing = await db.select().from(flexInterestAccounts).where(eq(flexInterestAccounts.account_id, accountId)).get();

      if (existing) {
        db.update(flexInterestAccounts)
          .set({
            is_active: activeVal,
            annual_rate: rateVal,
            updated_at: nowISO
          })
          .where(eq(flexInterestAccounts.account_id, accountId))
          .run();
      } else {
        db.insert(flexInterestAccounts).values({
          id: `flex-${Date.now()}`,
          account_id: accountId,
          is_active: activeVal,
          annual_rate: rateVal,
          created_at: nowISO,
          updated_at: nowISO
        }).run();
      }

      return NextResponse.json({
        success: true,
        message: activeVal === 1 
          ? `Nema/Faiz özelliği yıllık %${rateVal} faiz oranı ile aktifleştirildi.` 
          : `Nema/Faiz özelliği pasifleştirildi.`
      });
    }

    if (action === 'record-earning') {
      const { startDate, endDate, principalAmount, interestRate, actualAmount, notes } = body;

      if (!startDate || !endDate || !principalAmount) {
        return NextResponse.json({ success: false, error: 'Tarihler ve anapara zorunludur.' }, { status: 400 });
      }

      const earnAmt = Number(actualAmount) || 0;
      const principal = Number(principalAmount) || 0;
      const rate = Number(interestRate) || 0;

      const dStart = new Date(startDate);
      const dEnd = new Date(endDate);
      const diffTime = Math.max(0, dEnd.getTime() - dStart.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

      // Tahmini faizi hesapla
      const calculatedEarned = Math.round(principal * (rate / 100) * (days / 365) * 100) / 100;

      const flexConfig = await db.select().from(flexInterestAccounts).where(eq(flexInterestAccounts.account_id, accountId)).get();

      // 1. Kazancı veritabanına kaydet
      db.insert(flexInterestEarnings).values({
        id: `earning-${Date.now()}`,
        flex_account_id: flexConfig ? flexConfig.id : null,
        wallet_account_id: accountId,
        start_date: startDate,
        end_date: endDate,
        days,
        principal_amount: principal,
        interest_rate: rate,
        earned_amount: calculatedEarned,
        actual_amount: earnAmt,
        currency: account.currency,
        notes: notes || null,
        created_at: nowISO
      }).run();

      // 2. Hesap bakiyesini güncelle
      db.update(walletsAccounts)
        .set({
          balance: account.balance + earnAmt,
          updated_at: nowISO
        })
        .where(eq(walletsAccounts.id, accountId))
        .run();

      // 3. İşlem logunu yaz
      db.insert(transactions).values({
        id: `tx-flex-earn-${Date.now()}`,
        wallet_id: accountId,
        merchant: `💵 Nemalandırma / Faiz Kazancı`,
        amount: earnAmt,
        currency: account.currency,
        transaction_date: endDate,
        notes: notes || `${days} günlük nemalandırma geliri (%${rate} yıllık oran).`,
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

      // Opsiyonel: Nema hesabının başlangıç tarihini sıfırla (kazanç alındığı için yeni periyot başlar)
      if (flexConfig && flexConfig.is_active === 1) {
        db.update(flexInterestAccounts)
          .set({
            updated_at: nowISO // Yeni başlangıç tarihi bugündür
          })
          .where(eq(flexInterestAccounts.account_id, accountId))
          .run();
      }

      return NextResponse.json({
        success: true,
        message: `Faiz geliri (${earnAmt.toLocaleString('tr-TR')} ${account.currency}) hesaba başarıyla eklendi!`
      });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
