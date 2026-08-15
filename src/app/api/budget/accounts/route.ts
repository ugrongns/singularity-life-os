import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions } from '@/db/schema';
import { eq , or , and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();
    const {
      id, name, type, balance, credit_limit, cutoff_day, due_day, currency,
      loan_original_amount, loan_total_repayment, total_installments,
      first_installment_date, deposited_account_id,
      maturity_date, interest_rate, interest_type,
      interest_rate_contractual, interest_rate_late, min_payment_percent, overdraft_limit
    } = body;

    const user = await getAuthUser();
    const userId = user?.id;

    const now = new Date();
    const nowISO = now.toISOString();

    if (id) {
      // Güncelle
      db.update(walletsAccounts)
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
          overdraft_limit: overdraft_limit ? Number(overdraft_limit) : 0
        })
        .where(eq(walletsAccounts.id, id))
        .run();

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

        db.insert(walletsAccounts).values({
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
          created_at: nowISO,
          updated_at: nowISO
        }).run();

        // 1. Nakit Paranın Seçilen Vadesiz Banka Hesabına Yatırılması
        if (deposited_account_id && origAmt > 0) {
          const bankAcc = await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, deposited_account_id)).get();
          if (bankAcc) {
            db.update(walletsAccounts)
              .set({ balance: bankAcc.balance + origAmt, updated_at: nowISO })
              .where(eq(walletsAccounts.id, deposited_account_id))
              .run();

            // Nakit Giriş İşlemi
            db.insert(transactions).values({
              id: `tx-loan-dep-${Date.now()}`,
              wallet_id: deposited_account_id,
              merchant: `🏛️ Kredi Çekim Anaparası (${name.trim()})`,
              amount: origAmt,
              currency: 'TRY',
              transaction_date: nowISO.split('T')[0],
              notes: `${name.trim()} çekilen nakit anapara girişi`,
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
        }

        // 2. Ertelemeli Taksit Planının Geleceğe Yönelik Yazılması
        const parentTxId = `tx-loan-inst-${Date.now()}`;
        const startDateObj = new Date(firstDate);

        for (let i = 0; i < countInst; i++) {
          const instDate = new Date(startDateObj);
          instDate.setMonth(instDate.getMonth() + i);
          const instDateStr = instDate.toISOString().split('T')[0];

          db.insert(transactions).values({
            id: i === 0 ? parentTxId : `tx-loan-inst-${Date.now()}-${i + 1}`,
            wallet_id: newLoanId,
            merchant: `${name.trim()} Taksit Ödemesi`,
            amount: monthlyInst,
            currency: 'TRY',
            transaction_date: instDateStr,
            notes: `Kredi Taksiti [Taksit ${i + 1}/${countInst}]`,
            is_installment: 1,
            installment_number: i + 1,
            total_installments: countInst,
            parent_transaction_id: parentTxId,
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
          message: `Kredi başarıyla tanımlandı! ${origAmt.toLocaleString('tr-TR')} TL hesaba aktarıldı. İlk taksit (${firstDate}) itibariyle ${countInst} ay boyunca ${monthlyInst.toLocaleString('tr-TR')} TL taksit planı oluşturuldu.`
        });
      }

      if (type === 'time_deposit') {
        const principal = Number(balance) || 0;
        if (deposited_account_id && principal > 0) {
          const bankAcc = await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, deposited_account_id)).get();
          if (bankAcc) {
            db.update(walletsAccounts)
              .set({ balance: bankAcc.balance - principal, updated_at: nowISO })
              .where(eq(walletsAccounts.id, deposited_account_id))
              .run();

            // Nakit Çıkış İşlemi
            db.insert(transactions).values({
              id: `tx-deposit-out-${Date.now()}`,
              wallet_id: deposited_account_id,
              merchant: `🏛️ Vadeli Mevduat Açılışı (${name.trim()})`,
              amount: -principal,
              currency: currency || 'TRY',
              transaction_date: nowISO.split('T')[0],
              notes: `${name.trim()} vadeli hesabı için fon aktarımı`,
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
        }

        const newId = `acc-${Date.now()}`;
        db.insert(walletsAccounts).values({
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
          created_at: nowISO,
          updated_at: nowISO
        }).run();

        return NextResponse.json({
          success: true,
          message: `Vadeli mevduat hesabı başarıyla açıldı! ${principal.toLocaleString('tr-TR')} ${currency} kaynak hesaptan aktarıldı.`
        });
      }

      // Standart Hesap/Cüzdan/Kart/KMH Ekle
      const newId = `acc-${Date.now()}`;
      db.insert(walletsAccounts).values({
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
        created_at: nowISO,
        updated_at: nowISO,
        user_id: userId || null
      }).run();

      return NextResponse.json({ success: true, message: 'Yeni hesap başarıyla eklendi!' });
    }
  } catch (error: any) {
    console.error('Account API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url, 'http://localhost');
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Hesap ID zorunludur.' }, { status: 400 });
    }

    db.delete(walletsAccounts).where(user.is_master_account === 1 ? eq(walletsAccounts.id, id) : and(eq(walletsAccounts.id, id), eq(walletsAccounts.user_id, user.id))).run();

    return NextResponse.json({ success: true, message: 'Hesap başarıyla silindi.' });
  } catch (error: any) {
    console.error('Delete Account API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
