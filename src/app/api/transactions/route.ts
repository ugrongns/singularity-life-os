import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db, initDatabase } from '@/db';
import { transactions, walletsAccounts, categories, familyMembers } from '@/db/schema';
import { eventBus, EVENTS } from '@/lib/events';
import { eq , or , and } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();

    const {
      wallet_id,
      category_id,
      merchant,
      amount,
      notes,
      installments = 1,
      is_family_shared = 1,
      receipt_image_url
    } = body;

    if (!wallet_id || !amount || Number(amount) <= 0) {
      return NextResponse.json({ success: false, error: 'Lütfen geçerli bir hesap ve tutar girin.' }, { status: 400 });
    }

    const numAmount = Number(amount);
    const wallet = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, wallet_id)))[0];
    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Seçilen hesap bulunamadı.' }, { status: 404 });
    }

    // 1. İşlemin Gelir mi Gider mi Olduğunu Belirle
    const category = category_id ? (await db.select().from(categories).where(eq(categories.id, category_id)))[0] : null;
    const finalCategoryId = category ? category.id : null;
    const isIncome = (category && category.type === 'income') || body.type === 'income';

    // 2. Kredi Kartı veya Nakit Limit Kontrolü (Sadece Gider / Harcama İşlemlerinde Yapılır)
    if (!isIncome) {
      if (wallet.type === 'credit_card') {
        const creditLimit = wallet.credit_limit || 0;
        const currentDebt = wallet.balance || 0;
        const availableLimit = Math.max(0, creditLimit - currentDebt);

        if (numAmount > availableLimit) {
          return NextResponse.json({
            success: false,
            error: `Kredi Kartı Limiti Aşıldı! ${wallet.name} kartınızın kullanılabilir limiti sadece ${availableLimit.toLocaleString('tr-TR')} ₺'dir. Limit üzerinde işlem yapılamaz.`
          }, { status: 400 });
        }
      } else {
        if (numAmount > wallet.balance) {
          return NextResponse.json({
            success: false,
            error: `Yetersiz Bakiye! ${wallet.name} hesabınızda sadece ${wallet.balance.toLocaleString('tr-TR')} ₺ bakiye bulunmaktadır.`
          }, { status: 400 });
        }
      }
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const totalInstallments = Math.max(1, parseInt(installments, 10));
    const parentTxId = `tx-${Date.now()}`;
    const monthlyAmount = Math.round((numAmount / totalInstallments) * 100) / 100;

    const createdTxIds: string[] = [];

    const user = await getAuthUser();
    const userId = user?.id || null;

    let memberId = body.member_id || null;
    if (!memberId) {
      const member = (await db.select().from(familyMembers).where(eq(familyMembers.is_active, 1)))[0];
      memberId = member?.id || null;
    }

    // Taksit Motoru: Tutar tek seferlik ise 1 satır, taksitli ise gelecek aylara dağıtılan N adet satır
    for (let i = 0; i < totalInstallments; i++) {
      const txDate = new Date(now);
      txDate.setMonth(txDate.getMonth() + i); // Her ay için bir sonraki ekstre tarihi
      const txDateString = txDate.toISOString().split('T')[0];

      const txId = i === 0 ? parentTxId : `tx-${Date.now()}-${i + 1}`;

      db.insert(transactions).values({
        id: txId,
        wallet_id,
        category_id: finalCategoryId,
        member_id: memberId,
        user_id: userId,
        merchant: merchant || (isIncome ? 'Gelir Girişi' : 'Genel Harcama'),
        amount: monthlyAmount,
        currency: 'TRY',
        transaction_date: txDateString,
        notes: totalInstallments > 1 
          ? `${notes || ''} [Taksit ${i + 1}/${totalInstallments}]` 
          : notes,
        is_installment: totalInstallments > 1 ? 1 : 0,
        installment_number: i + 1,
        total_installments: totalInstallments,
        parent_transaction_id: parentTxId,
        receipt_image_url: receipt_image_url || null,
        is_verified: 1,
        is_family_shared: is_family_shared ? 1 : 0,
        created_at: nowISO,
        updated_at: nowISO,
        sync_status: 'synced',
        device_id: 'mac-local'
      });

      createdTxIds.push(txId);
    }

    // Cüzdan / Kredi Kartı Bakiyesini Güncelle
    if (wallet) {
      let newBalance = wallet.balance;
      if (isIncome) {
        // Gelir: Banka bakiyesini artırır, Kredi Kartı borcunu azaltır
        newBalance = wallet.type === 'credit_card'
          ? Math.max(0, wallet.balance - numAmount)
          : wallet.balance + numAmount;
      } else {
        // Gider: Banka bakiyesini azaltır, Kredi Kartı borcunu artırır
        newBalance = wallet.type === 'credit_card'
          ? wallet.balance + numAmount
          : wallet.balance - numAmount;
      }

      db.update(walletsAccounts)
        .set({ balance: newBalance, updated_at: nowISO })
        .where(eq(walletsAccounts.id, wallet_id))
        ;
    }

    // Event Bus üzerinden çapraz modüllere haber ver
    await eventBus.emit(EVENTS.TRANSACTION_CREATED, {
      transactionId: parentTxId,
      amount,
      merchant,
      installments: totalInstallments,
      wallet_id,
      category_id
    });

    return NextResponse.json({
      success: true,
      message: totalInstallments > 1 
        ? `İşlem ${totalInstallments} taksit olarak kaydedildi (Aylık ${monthlyAmount} TL). Gelecek ekstrelere işlendi.` 
        : 'İşlem başarıyla kaydedildi.',
      createdIds: createdTxIds
    });
  } catch (error: any) {
    console.error('Transaction API Error:', error);
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
      return NextResponse.json({ success: false, error: 'Harcama ID zorunludur.' }, { status: 400 });
    }

    const tx = (await db.select().from(transactions).where(eq(transactions.id, id)))[0];
    if (tx) {
      // Bakiye İadesi
      if (tx.wallet_id) {
        const wallet = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, tx.wallet_id)))[0];
        if (wallet) {
          const newBalance = wallet.type === 'credit_card'
            ? wallet.balance - tx.amount
            : wallet.balance + tx.amount;

          db.update(walletsAccounts)
            .set({ balance: Math.max(0, newBalance), updated_at: new Date().toISOString() })
            .where(eq(walletsAccounts.id, tx.wallet_id))
            ;
        }
      }
      db.delete(transactions).where(user.is_master_account === 1 ? eq(transactions.id, id) : and(eq(transactions.id, id), eq(transactions.user_id, user.id)));
    }

    return NextResponse.json({ success: true, message: 'Harcama kaydı silindi ve bakiye güncellendi.' });
  } catch (error: any) {
    console.error('Delete Transaction API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
