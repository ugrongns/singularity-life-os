import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';
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

    // BOLA / IDOR Koruması: Hesabın kullanıcıya veya ailesine ait olduğunu doğrula
    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);
    const belongsToFamily = !account.family_id || (familyId && account.family_id === familyId);
    const isOwner = account.user_id === user.id;
    const isShared = belongsToFamily && (account.is_family_shared === 1 || !account.user_id);
    const isLeader = belongsToFamily && (user.is_master_account === 1 || user.role === 'admin');

    if (!belongsToFamily || (!isOwner && !isShared && !isLeader)) {
      return NextResponse.json({ success: false, error: 'Bu hesaba erişim yetkiniz yok.' }, { status: 403 });
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
        },
        // Modal uyumluluğu için düzleştirilmiş (flattened) alanlar
        id: account.id,
        name: account.name,
        principal,
        currency: account.currency || 'TRY',
        interest_rate: account.interest_rate || 0,
        days: totalDays,
        created_at: account.created_at,
        maturity_date: account.maturity_date,
        calculatedInterest: Math.round(netInterest * 100) / 100,
        deposited_account_id: account.deposited_account_id
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

    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);

    const depositAcc = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, accountId)))[0];
    if (!depositAcc || depositAcc.type !== 'time_deposit') {
      return NextResponse.json({ success: false, error: 'Vadeli mevduat hesabı bulunamadı.' }, { status: 404 });
    }

    if (depositAcc.is_active === 0) {
      return NextResponse.json({ success: false, error: 'Bu vadeli hesap zaten kapatılmış.' }, { status: 400 });
    }

    // BOLA: Vadeli hesabın bu aileye/kullanıcıya ait olduğunu doğrula
    const depositBelongs = !depositAcc.family_id || (familyId && depositAcc.family_id === familyId);
    if (!depositBelongs || (depositAcc.user_id !== user.id && user.is_master_account !== 1 && user.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Bu vadeli hesabı kapatma yetkiniz yok.' }, { status: 403 });
    }

    const targetAcc = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, targetAccountId)))[0];
    if (!targetAcc) {
      return NextResponse.json({ success: false, error: 'Hedef vadesiz hesap bulunamadı.' }, { status: 404 });
    }

    if (depositAcc.currency !== targetAcc.currency) {
      return NextResponse.json({ 
        success: false, 
        error: `Para birimi uyuşmazlığı: Vadeli hesap (${depositAcc.currency}) ile hedef hesap (${targetAcc.currency}) aynı para biriminde olmalıdır.` 
      }, { status: 400 });
    }

    // BOLA: Hedef hesabın aynı aileye/kullanıcıya ait olduğunu doğrula
    const targetBelongs = !targetAcc.family_id || (familyId && targetAcc.family_id === familyId);
    if (!targetBelongs || (targetAcc.user_id !== user.id && targetAcc.is_family_shared !== 1 && user.is_master_account !== 1 && user.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Hedef hesaba aktarım yetkiniz yok.' }, { status: 403 });
    }

    const principal = Number(depositAcc.balance) || 0;
    const interest = Number(actualInterestEarned) || 0;

    if (interest < 0) {
      return NextResponse.json({ success: false, error: 'Faiz getirisi negatif olamaz.' }, { status: 400 });
    }

    // Mantıksız veya hileli faiz girişlerini önleme tavanı (maksimum faiz koruması)
    if (depositAcc.interest_rate && principal > 0) {
      const daysElapsed = Math.max(1, Math.round((Date.now() - new Date(depositAcc.created_at).getTime()) / (1000 * 60 * 60 * 24)) + 30);
      const theoreticalMaxInterest = (principal * (Number(depositAcc.interest_rate) / 100) * (daysElapsed / 365)) * 2;
      if (interest > theoreticalMaxInterest) {
        return NextResponse.json({ 
          success: false, 
          error: `Girilen faiz tutarı (${interest.toLocaleString('tr-TR')}), hesaba göre olası azami getirinin (${Math.round(theoreticalMaxInterest).toLocaleString('tr-TR')}) üzerindedir.` 
        }, { status: 400 });
      }
    }

    const totalReturn = principal + interest;
    const now = new Date();
    const nowISO = now.toISOString();

    await db.transaction(async (tx) => {
      const [lockedDeposit] = await tx.select().from(walletsAccounts).where(eq(walletsAccounts.id, accountId)).for('update');
      if (!lockedDeposit || lockedDeposit.is_active === 0) {
        throw new Error('Bu vadeli hesap zaten kapatılmış veya mevcut değil.');
      }

      const [lockedTarget] = await tx.select().from(walletsAccounts).where(eq(walletsAccounts.id, targetAccountId)).for('update');
      if (!lockedTarget) {
        throw new Error('Hedef hesap bulunamadı.');
      }

      // 1. Hedef hesabın bakiyesini güncelle
      await tx.update(walletsAccounts)
        .set({
          balance: (Number(lockedTarget.balance) || 0) + totalReturn,
          updated_at: nowISO
        })
        .where(eq(walletsAccounts.id, targetAccountId));

      // 2. Vadeli hesabı sıfırla ve deaktif et
      await tx.update(walletsAccounts)
        .set({
          balance: 0,
          is_active: 0,
          updated_at: nowISO
        })
        .where(eq(walletsAccounts.id, accountId));

      // 3. Anapara dönüşü işlemini kaydet
      await tx.insert(transactions).values({
        id: `tx-deposit-return-${crypto.randomUUID()}`,
        wallet_id: targetAccountId,
        user_id: user.id,
        family_id: familyId,
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
        device_id: 'web-client'
      });

      // 4. Faiz geliri işlemini kaydet
      if (interest > 0) {
        await tx.insert(transactions).values({
          id: `tx-deposit-interest-${crypto.randomUUID()}`,
          wallet_id: targetAccountId,
          user_id: user.id,
          family_id: familyId,
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
          device_id: 'web-client'
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Vadeli mevduat kapatıldı! Toplam ${totalReturn.toLocaleString('tr-TR')} ${depositAcc.currency} (${principal.toLocaleString('tr-TR')} anapara + ${interest.toLocaleString('tr-TR')} faiz) ${targetAcc.name} hesabına aktarıldı.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
