import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions } from '@/db/schema';
import { eq, or, and, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await req.json();
    const {
      id, name, type, balance, credit_limit, cutoff_day, due_day, currency,
      loan_original_amount, loan_total_repayment, total_installments,
      first_installment_date, deposited_account_id,
      maturity_date, interest_rate, interest_type,
      interest_rate_contractual, interest_rate_late, min_payment_percent, overdraft_limit,
      owner_user_id, is_family_shared
    } = body;

    const userId = user.id;
    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);

    const now = new Date();
    const nowISO = now.toISOString();

    if (id) {
      // Güncelleme öncesi BOLA yetki kontrolü
      const existingAcc = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, id)))[0];
      if (!existingAcc) {
        return NextResponse.json({ success: false, error: 'Hesap bulunamadı.' }, { status: 404 });
      }

      const belongsToFamily = !existingAcc.family_id || (familyId && existingAcc.family_id === familyId);
      if (!belongsToFamily) {
        return NextResponse.json({ success: false, error: 'Bu hesaba erişim yetkiniz yok.' }, { status: 403 });
      }

      const canEdit = existingAcc.user_id === userId || (belongsToFamily && (user.is_master_account === 1 || user.role === 'admin')) || !existingAcc.user_id;
      if (!canEdit) {
        return NextResponse.json({ 
          success: false, 
          error: 'Yetkisiz İşlem: Başka bir aile üyesine ait hesabı yalnızca hesap sahibi veya Aile Lideri düzenleyebilir.' 
        }, { status: 403 });
      }

      // Belirlenen sahip (owner_user_id verilmişse güncelle, verilmemişse mevcut olanı koru)
      let targetUserId = existingAcc.user_id;
      if (owner_user_id !== undefined) {
        targetUserId = (owner_user_id === 'joint' || owner_user_id === null || owner_user_id === '') ? null : owner_user_id;
      }

      // Belirlenen aile paylaşımı (is_family_shared verilmişse güncelle, verilmemişse mevcut olanı koru)
      let targetIsShared = existingAcc.is_family_shared;
      if (is_family_shared !== undefined) {
        targetIsShared = (is_family_shared === true || is_family_shared === 1 || targetUserId === null) ? 1 : 0;
      }

      // Güncelle
      await db.update(walletsAccounts)
        .set({
          name: name.trim(),
          type,
          balance: Number(balance) || 0,
          credit_limit: credit_limit ? Number(credit_limit) : null,
          cutoff_day: cutoff_day ? Number(cutoff_day) : null,
          due_day: due_day ? Number(due_day) : null,
          currency: currency || 'TRY',
          updated_at: nowISO,
          maturity_date: maturity_date || null,
          interest_rate: interest_rate ? Number(interest_rate) : null,
          interest_type: interest_type || null,
          interest_rate_contractual: interest_rate_contractual ? Number(interest_rate_contractual) : 4.25,
          interest_rate_late: interest_rate_late ? Number(interest_rate_late) : 4.55,
          min_payment_percent: min_payment_percent ? Number(min_payment_percent) : 20,
          overdraft_limit: overdraft_limit ? Number(overdraft_limit) : 0,
          user_id: targetUserId,
          is_family_shared: targetIsShared
        })
        .where(eq(walletsAccounts.id, id));

      return NextResponse.json({ success: true, message: 'Hesap başarıyla güncellendi.' });
    } else {
      // Yeni Kredi Hesabı Ekleme Mantığı
      if (type === 'loan') {
        const origAmt = Number(loan_original_amount) || 0;
        const totalRepay = Number(loan_total_repayment) || origAmt;
        const countInst = Math.max(1, Number(total_installments) || 1);
        const monthlyInst = Math.round((totalRepay / countInst) * 100) / 100;
        const firstDate = first_installment_date || new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString().split('T')[0];
        const dueDayNum = parseInt(firstDate.split('-')[2] || '15', 10);

        const newLoanId = `loan-${Date.now()}`;

        const targetUserId = owner_user_id !== undefined
          ? (owner_user_id === 'joint' || owner_user_id === null || owner_user_id === '' ? null : owner_user_id)
          : userId;
        const targetIsShared = is_family_shared !== undefined
          ? (is_family_shared === true || is_family_shared === 1 || targetUserId === null ? 1 : 0)
          : 1;

        // BOLA: Aktarım yapılacak vadesiz hesabın varlığını ve aile yetkisini doğrula
        let bankAcc: any = null;
        if (deposited_account_id && origAmt > 0) {
          bankAcc = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, deposited_account_id)))[0];
          if (!bankAcc) {
            return NextResponse.json({ success: false, error: 'Kredi anaparasının aktarılacağı hesap bulunamadı.' }, { status: 404 });
          }
          const bankBelongs = !bankAcc.family_id || (familyId && bankAcc.family_id === familyId);
          if (!bankBelongs) {
            return NextResponse.json({ success: false, error: 'Seçilen aktarım hesabına yetkiniz yok.' }, { status: 403 });
          }
        }

        // Atomik Veritabanı İşlemi (db.transaction)
        await db.transaction(async (tx) => {
          await tx.insert(walletsAccounts).values({
            id: newLoanId,
            name: name.trim(),
            type: 'loan',
            balance: totalRepay, // Borç yükü
            credit_limit: totalRepay,
            due_day: dueDayNum,
            loan_original_amount: origAmt,
            loan_total_repayment: totalRepay,
            monthly_installment_amount: monthlyInst,
            total_installments: countInst,
            first_installment_date: firstDate,
            deposited_account_id: deposited_account_id || null,
            currency: currency || 'TRY',
            is_active: 1,
            is_family_shared: targetIsShared,
            user_id: targetUserId,
            family_id: familyId,
            created_at: nowISO,
            updated_at: nowISO
          });

          // 1. Nakit Paranın Seçilen Vadesiz Banka Hesabına Yatırılması
          if (bankAcc && origAmt > 0) {
            await tx.update(walletsAccounts)
              .set({ balance: bankAcc.balance + origAmt, updated_at: nowISO })
              .where(eq(walletsAccounts.id, deposited_account_id));

            // Nakit Giriş İşlemi
            await tx.insert(transactions).values({
              id: `tx-loan-dep-${Date.now()}`,
              wallet_id: deposited_account_id,
              merchant: `🏛️ Kredi Çekim Anaparası (${name.trim()})`,
              amount: origAmt,
              currency: 'TRY',
              transaction_date: nowISO.split('T')[0],
              notes: `${name.trim()} çekilen nakit anapara girişi [to_wallet:${newLoanId}]`,
              is_installment: 0,
              installment_number: 1,
              total_installments: 1,
              is_verified: 1,
              is_family_shared: 1,
              user_id: userId,
              family_id: familyId,
              created_at: nowISO,
              updated_at: nowISO,
              sync_status: 'synced',
              device_id: 'web-client'
            });
          }

          // 2. Gelecek Taksit Planlarının transactions Tablosuna İşlenmesi
          const instDate = new Date(firstDate);
          for (let i = 0; i < countInst; i++) {
            const currentInstDate = new Date(instDate);
            currentInstDate.setMonth(currentInstDate.getMonth() + i);
            const instDateStr = currentInstDate.toISOString().split('T')[0];

            await tx.insert(transactions).values({
              id: `tx-${newLoanId}-${i + 1}`,
              wallet_id: newLoanId,
              merchant: `🏦 ${name.trim()} (${i + 1}/${countInst}. Taksit)`,
              amount: monthlyInst,
              currency: currency || 'TRY',
              transaction_date: instDateStr,
              notes: `${name.trim()} kredi geri ödeme taksiti`,
              is_installment: 1,
              installment_number: i + 1,
              total_installments: countInst,
              parent_transaction_id: newLoanId,
              is_verified: 1,
              is_family_shared: targetIsShared,
              user_id: targetUserId,
              family_id: familyId,
              created_at: nowISO,
              updated_at: nowISO,
              sync_status: 'synced',
              device_id: 'web-client'
            });
          }
        });

        return NextResponse.json({
          success: true,
          message: `Kredi başarıyla eklendi! ${origAmt.toLocaleString('tr-TR')} ₺ nakit hesabınıza aktarıldı, ${countInst} taksit planlandı.`
        });
      }

      if (type === 'time_deposit') {
        const principal = Number(balance) || 0;
        let bankAcc: any = null;
        if (deposited_account_id && principal > 0) {
          bankAcc = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, deposited_account_id)))[0];
          if (!bankAcc) {
            return NextResponse.json({ success: false, error: 'Mevduat anaparasının aktarılacağı kaynak hesap bulunamadı.' }, { status: 404 });
          }
          const bankBelongs = !bankAcc.family_id || (familyId && bankAcc.family_id === familyId);
          if (!bankBelongs) {
            return NextResponse.json({ success: false, error: 'Seçilen kaynak hesaba yetkiniz yok.' }, { status: 403 });
          }
        }

        const targetUserId = owner_user_id !== undefined
          ? (owner_user_id === 'joint' || owner_user_id === null || owner_user_id === '' ? null : owner_user_id)
          : userId;
        const targetIsShared = is_family_shared !== undefined
          ? (is_family_shared === true || is_family_shared === 1 || targetUserId === null ? 1 : 0)
          : 1;

        const newId = `acc-${Date.now()}`;

        // Atomik Veritabanı İşlemi (db.transaction)
        await db.transaction(async (tx) => {
          if (bankAcc && principal > 0) {
            await tx.update(walletsAccounts)
              .set({ balance: bankAcc.balance - principal, updated_at: nowISO })
              .where(eq(walletsAccounts.id, deposited_account_id));

            // Nakit Çıkış İşlemi - Pozitif tutar (virman)
            await tx.insert(transactions).values({
              id: `tx-deposit-out-${Date.now()}`,
              wallet_id: deposited_account_id,
              merchant: `🏛️ Vadeli Mevduat Açılışı (${name.trim()})`,
              amount: principal,
              currency: currency || 'TRY',
              transaction_date: nowISO.split('T')[0],
              notes: `${name.trim()} vadeli hesabı için fon aktarımı [to_wallet:${newId}]`,
              is_installment: 0,
              installment_number: 1,
              total_installments: 1,
              is_verified: 1,
              is_family_shared: 1,
              user_id: userId,
              family_id: familyId,
              created_at: nowISO,
              updated_at: nowISO,
              sync_status: 'synced',
              device_id: 'web-client'
            });
          }

          await tx.insert(walletsAccounts).values({
            id: newId,
            name: name.trim(),
            type: 'time_deposit',
            balance: principal,
            currency: currency || 'TRY',
            deposited_account_id: deposited_account_id || null,
            maturity_date: maturity_date || null,
            interest_rate: interest_rate ? Number(interest_rate) : null,
            interest_type: interest_type || 'simple',
            is_active: 1,
            is_family_shared: targetIsShared,
            user_id: targetUserId,
            family_id: familyId,
            created_at: nowISO,
            updated_at: nowISO
          });
        });

        return NextResponse.json({
          success: true,
          message: `Vadeli mevduat hesabı başarıyla açıldı! ${principal.toLocaleString('tr-TR')} ${currency} kaynak hesaptan aktarıldı.`
        });
      }

      // Standart Hesap/Cüzdan/Kart/KMH Ekle
      const targetUserId = owner_user_id !== undefined
        ? (owner_user_id === 'joint' || owner_user_id === null || owner_user_id === '' ? null : owner_user_id)
        : userId;
      const targetIsShared = is_family_shared !== undefined
        ? (is_family_shared === true || is_family_shared === 1 || targetUserId === null ? 1 : 0)
        : 1;

      const newId = `acc-${Date.now()}`;
      await db.insert(walletsAccounts).values({
        id: newId,
        name: name.trim(),
        type,
        balance: Number(balance) || 0,
        credit_limit: credit_limit ? Number(credit_limit) : null,
        cutoff_day: cutoff_day ? Number(cutoff_day) : null,
        due_day: due_day ? Number(due_day) : null,
        currency: currency || 'TRY',
        interest_rate_contractual: interest_rate_contractual ? Number(interest_rate_contractual) : 4.25,
        interest_rate_late: interest_rate_late ? Number(interest_rate_late) : 4.55,
        min_payment_percent: min_payment_percent ? Number(min_payment_percent) : 20,
        overdraft_limit: overdraft_limit ? Number(overdraft_limit) : 0,
        is_active: 1,
        is_family_shared: targetIsShared,
        user_id: targetUserId,
        family_id: familyId,
        created_at: nowISO,
        updated_at: nowISO
      });

      return NextResponse.json({ success: true, message: 'Yeni hesap başarıyla eklendi!' });
    }
  } catch (error: any) {
    console.error('Account API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url, 'http://localhost');
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Hesap ID zorunludur.' }, { status: 400 });
    }

    const acc = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, id)))[0];
    if (!acc) {
      return NextResponse.json({ success: false, error: 'Hesap bulunamadı.' }, { status: 404 });
    }

    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);
    const belongsToFamily = !acc.family_id || (familyId && acc.family_id === familyId);
    if (!belongsToFamily) {
      return NextResponse.json({ success: false, error: 'Bu hesaba erişim yetkiniz yok.' }, { status: 403 });
    }

    const canDelete = acc.user_id === user.id || (belongsToFamily && (user.is_master_account === 1 || user.role === 'admin'));
    if (!canDelete) {
      return NextResponse.json({ 
        success: false, 
        error: 'Yetkisiz İşlem: Başka bir aile üyesine ait hesabı yalnızca hesap sahibi veya Aile Lideri silebilir.' 
      }, { status: 403 });
    }

    // Hesabı güvenle deaktif et / arşivle (Geçmiş işlem kayıtlarının FK bütünlüğünü korumak için)
    await db.update(walletsAccounts)
      .set({ 
        is_active: 0, 
        updated_at: new Date().toISOString() 
      })
      .where(eq(walletsAccounts.id, id));

    return NextResponse.json({ success: true, message: 'Hesap başarıyla silindi.' });
  } catch (error: any) {
    console.error('Delete Account API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
