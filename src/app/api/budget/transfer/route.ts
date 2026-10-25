import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

    // OWASP BOLA Yetki Kontrolü: Transfer yapılacak hesaplar kullanıcıya veya ailesine ait olmalıdır
    const userFamilyId = user.family_id || (user.id ? `fam-${user.id}` : null);
    const isFromOwner = fromAcc.user_id === user.id || (userFamilyId && fromAcc.family_id === userFamilyId);
    const isToOwner = toAcc.user_id === user.id || (userFamilyId && toAcc.family_id === userFamilyId);
    if (!isFromOwner || !isToOwner) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim: Transfer yapılacak hesaplar sizin veya ailenizin hesabına ait değil.' }, { status: 403 });
    }

    // Yetersiz bakiye kontrolü (KMH ve Kredi Kartı limit kontrolleriyle)
    if (fromAcc.type === 'kmh') {
      const overdraftLimit = fromAcc.overdraft_limit || 0;
      const availableKMH = fromAcc.balance + overdraftLimit;
      if (numAmount > availableKMH) {
        return NextResponse.json({
          success: false,
          error: `KMH (Ek Hesap) Limiti Aşıldı! ${fromAcc.name} hesabınızın kullanılabilir toplam limiti ${availableKMH.toLocaleString('tr-TR')} ₺'dir.`
        }, { status: 400 });
      }
    } else if (fromAcc.type !== 'credit_card' && numAmount > fromAcc.balance) {
      return NextResponse.json({
        success: false,
        error: `Yetersiz Bakiye! ${fromAcc.name} hesabınızda sadece ${fromAcc.balance.toLocaleString('tr-TR')} ₺ bakiye bulunmaktadır.`
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const txDate = transaction_date || now.split('T')[0];

    // 1. Çıkış Hesabı Bakiye Güncellemesi
    let newFromBalance: number;
    if (fromAcc.type === 'credit_card') {
      newFromBalance = fromAcc.balance + numAmount; // Kredi kartından para çekilirse borcu artar
    } else if (fromAcc.type === 'kmh') {
      newFromBalance = fromAcc.balance - numAmount; // KMH eksi bakiyeye düşebilir
    } else {
      newFromBalance = Math.max(0, fromAcc.balance - numAmount); // Banka/Nakit hesabından para çıkarsa bakiye düşer
    }

    // 2. Hedef Hesap Bakiye Güncellemesi
    const newToBalance = toAcc.type === 'credit_card'
      ? Math.max(0, toAcc.balance - numAmount) // Kredi kartına ödeme yapılırsa borcu düşer!
      : toAcc.balance + numAmount; // Banka/Nakit hesabına girerse bakiye artar

    // 3. İşlem Kaydı Oluştur
    const isCardPayment = toAcc.type === 'credit_card';
    const txMerchant = isCardPayment 
      ? `💳 Kart Ödemesi: ${toAcc.name}`
      : `🔄 Transfer: ${fromAcc.name} ➔ ${toAcc.name}`;

    const txId = `tx-transfer-${Date.now()}`;
    const familyId = user.family_id || fromAcc.family_id || (user.id ? `fam-${user.id}` : null);

    // Geri alma (DELETE) işlemi için hedef hesap ID'sini notes içine mühürle: [to_wallet:...]
    const baseNote = note ? note.trim() : (isCardPayment ? `${toAcc.name} borç ödemesi` : `Hesaplar arası transfer`);
    const formattedNotes = `${baseNote} [to_wallet:${to_account_id}]`;

    // Atomik Veritabanı İşlemi (db.transaction)
    await db.transaction(async (tx) => {
      // 1. Çıkış hesabı bakiyesini güncelle
      await tx.update(walletsAccounts)
        .set({ balance: newFromBalance, updated_at: now })
        .where(eq(walletsAccounts.id, from_account_id));

      // 2. Hedef hesap bakiyesini güncelle
      await tx.update(walletsAccounts)
        .set({ balance: newToBalance, updated_at: now })
        .where(eq(walletsAccounts.id, to_account_id));

      // 3. Transfer hareketini kaydet
      await tx.insert(transactions).values({
        id: txId,
        wallet_id: from_account_id,
        user_id: user.id,
        family_id: familyId,
        merchant: txMerchant,
        amount: numAmount,
        currency: fromAcc.currency || 'TRY',
        transaction_date: txDate,
        is_installment: 0,
        notes: formattedNotes,
        is_family_shared: 1,
        is_verified: 1,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
        device_id: 'web-client'
      });
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
