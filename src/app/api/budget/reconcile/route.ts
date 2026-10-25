import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions, categories } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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
    const { account_id, real_balance, notes } = body;

    if (!account_id) {
      return NextResponse.json({ success: false, error: 'Hesap ID belirtilmedi.' }, { status: 400 });
    }

    if (real_balance === undefined || real_balance === null || isNaN(Number(real_balance))) {
      return NextResponse.json({ success: false, error: 'Geçerli bir gerçek bakiye giriniz.' }, { status: 400 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const targetBalance = Math.round(Number(real_balance) * 100) / 100;

    // Hesabı ve yetkiyi doğrula
    const account = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, account_id)).limit(1))[0];
    if (!account) {
      return NextResponse.json({ success: false, error: 'Hesap bulunamadı.' }, { status: 404 });
    }

    const isOwner = account.user_id === user.id || (account.family_id && account.family_id === familyId) || user.is_master_account === 1 || user.role === 'admin' || !account.user_id;
    if (!isOwner) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim: Bu hesap sizin veya ailenizin hesabına ait değil.' }, { status: 403 });
    }

    const currentBalance = Math.round((account.balance || 0) * 100) / 100;
    const isCreditCard = account.type === 'credit_card';

    // Kredi kartlarında balance = borçtur.
    // Borç arttıysa gider, borç azaldıysa gelir (ödeme).
    // Vadesiz/Nakit hesaplarda bakiye arttıysa gelir, azaldıysa giderdir.
    let diff = 0;
    let isIncome = false;

    if (isCreditCard) {
      diff = Math.round((targetBalance - currentBalance) * 100) / 100;
      isIncome = diff < 0; // Borç düştüyse gelir (ödeme)
    } else {
      diff = Math.round((targetBalance - currentBalance) * 100) / 100;
      isIncome = diff > 0; // Bakiye arttıysa gelir
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let txCreated = false;

    if (diff !== 0) {
      const targetType = isIncome ? 'income' : 'expense';
      const absAmount = Math.abs(diff);

      // Mutabakat kategorisini bul veya oluştur
      let cat = (await db.select().from(categories).where(
        and(
          eq(categories.name, 'Bakiye Mutabakatı'),
          eq(categories.type, targetType)
        )
      ).limit(1))[0];

      if (!cat) {
        const newCatId = `cat-reconcile-${targetType}`;
        const catExists = (await db.select().from(categories).where(eq(categories.id, newCatId)).limit(1))[0];
        if (catExists) {
          cat = catExists;
        } else {
          await db.insert(categories).values({
            id: newCatId,
            name: 'Bakiye Mutabakatı',
            type: targetType,
            monthly_budget_limit: 0,
            group_50_30_20: 'needs',
            icon: '⚖️',
            color: isIncome ? '#10B981' : '#6366F1',
            is_family_shared: 1,
            created_at: nowISO,
            updated_at: nowISO,
            sync_status: 'synced',
            device_id: 'web-client',
            family_id: familyId
          });
          cat = (await db.select().from(categories).where(eq(categories.id, newCatId)).limit(1))[0];
        }
      }

      // Mutabakat düzeltme işlemini transactions tablosuna ekle
      const txId = `tx-reconcile-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const defaultNote = isIncome
        ? `⚖️ Bakiye Mutabakatı: Banka ile eşitleme (+${absAmount.toLocaleString('tr-TR')} ${account.currency} düzeltme geliri)`
        : `⚖️ Bakiye Mutabakatı: Banka ile eşitleme (-${absAmount.toLocaleString('tr-TR')} ${account.currency} düzeltme gideri)`;

      await db.insert(transactions).values({
        id: txId,
        wallet_id: account.id,
        category_id: cat ? cat.id : null,
        merchant: 'Bakiye Mutabakatı',
        amount: absAmount,
        currency: account.currency || 'TRY',
        transaction_date: dateStr,
        notes: notes ? `${notes} (${defaultNote})` : defaultNote,
        is_installment: 0,
        installment_number: 1,
        total_installments: 1,
        is_verified: 1,
        is_family_shared: account.is_family_shared ?? 1,
        created_at: nowISO,
        updated_at: nowISO,
        sync_status: 'synced',
        device_id: 'web-client',
        user_id: user.id,
        family_id: familyId
      });

      // Event Bus Bildirimi
      await eventBus.emit(EVENTS.TRANSACTION_CREATED, {
        transactionId: txId,
        amount: absAmount,
        merchant: 'Bakiye Mutabakatı',
        wallet_id: account.id,
        type: targetType
      });

      txCreated = true;
    }

    // Hesabın bakiyesini ve güncellenme tarihini güncelle
    await db.update(walletsAccounts)
      .set({
        balance: targetBalance,
        updated_at: nowISO
      })
      .where(eq(walletsAccounts.id, account.id));

    return NextResponse.json({
      success: true,
      diff,
      previous_balance: currentBalance,
      current_balance: targetBalance,
      transaction_created: txCreated,
      message: diff === 0
        ? `⚖️ ${account.name} bakiyesi zaten birebir eşleşiyor! Mutabakat onaylandı.`
        : `⚖️ ${account.name} bakiyesi ${targetBalance.toLocaleString('tr-TR')} ${account.currency} olarak güncellendi ve ${Math.abs(diff).toLocaleString('tr-TR')} ${account.currency} mutabakat işlemi kaydedildi!`
    });
  } catch (error: any) {
    console.error('Reconcile Account Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
