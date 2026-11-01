import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
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
    const userFamilyId = user.family_id || (user.id ? `fam-${user.id}` : null);
    const now = new Date().toISOString();
    const txDate = transaction_date || now.split('T')[0];

    let txId = `tx_trf_out_${crypto.randomUUID()}`;
    let txInId = `tx_trf_in_${crypto.randomUUID()}`;
    let isCardPayment = false;
    let fromAccName = '';
    let toAccName = '';

    // Atomik Veritabanı İşlemi (db.transaction + FOR UPDATE satır kilitleme)
    await db.transaction(async (tx) => {
      // 1. Hesapları FOR UPDATE ile kilitleyerek çek (Lost Update / Concurrency Race Condition önleme)
      const fromAcc = (await tx.select().from(walletsAccounts).where(eq(walletsAccounts.id, from_account_id)).for('update'))[0];
      const toAcc = (await tx.select().from(walletsAccounts).where(eq(walletsAccounts.id, to_account_id)).for('update'))[0];

      if (!fromAcc || !toAcc) {
        throw new Error('NOT_FOUND: Hesaplardan biri bulunamadı.');
      }

      fromAccName = fromAcc.name;
      toAccName = toAcc.name;
      isCardPayment = toAcc.type === 'credit_card';

      // OWASP BOLA Yetki Kontrolü: Transfer yapılacak hesaplar kullanıcıya veya ailesine ait olmalıdır
      const isFromOwner = fromAcc.user_id === user.id || (userFamilyId && fromAcc.family_id === userFamilyId);
      const isToOwner = toAcc.user_id === user.id || (userFamilyId && toAcc.family_id === userFamilyId);
      if (!isFromOwner || !isToOwner) {
        throw new Error('FORBIDDEN: Transfer yapılacak hesaplar sizin veya ailenizin hesabına ait değil.');
      }

      // Para Birimi Uyum Kontrolü
      if (fromAcc.currency !== toAcc.currency) {
        throw new Error(`CURRENCY_MISMATCH: Farklı para birimleri arasında doğrudan transfer desteklenmemektedir (${fromAcc.currency} ➔ ${toAcc.currency}). Lütfen aynı para birimine sahip hesaplar arasında transfer yapın.`);
      }

      // Yetersiz bakiye & Limit kontrolleri
      if (fromAcc.type === 'credit_card') {
        // [K-02 Düzeltmesi]: Kredi kartından nakit avans / transfer çekim limiti kontrolü
        const creditLimit = fromAcc.credit_limit || 0;
        const currentDebt = fromAcc.balance || 0;
        const availableCashAdvance = Math.max(0, creditLimit - currentDebt);
        if (numAmount > availableCashAdvance) {
          throw new Error(`LIMIT_EXCEEDED: Kredi Kartı Limiti Aşıldı! ${fromAcc.name} kartınızın kullanılabilir nakit çekim limiti ${availableCashAdvance.toLocaleString('tr-TR')} ₺'dir.`);
        }
      } else if (fromAcc.type === 'kmh') {
        const overdraftLimit = fromAcc.overdraft_limit || 0;
        const availableKMH = fromAcc.balance + overdraftLimit;
        if (numAmount > availableKMH) {
          throw new Error(`LIMIT_EXCEEDED: KMH (Ek Hesap) Limiti Aşıldı! ${fromAcc.name} hesabınızın kullanılabilir toplam limiti ${availableKMH.toLocaleString('tr-TR')} ₺'dir.`);
        }
      } else if (numAmount > fromAcc.balance) {
        throw new Error(`INSUFFICIENT_FUNDS: Yetersiz Bakiye! ${fromAcc.name} hesabınızda sadece ${fromAcc.balance.toLocaleString('tr-TR')} ₺ bakiye bulunmaktadır.`);
      }

      // 2. Çıkış Hesabı Bakiyesini Atomik SQL ile Güncelle
      if (fromAcc.type === 'credit_card') {
        await tx.update(walletsAccounts)
          .set({ balance: sql`${walletsAccounts.balance} + ${numAmount}`, updated_at: now })
          .where(eq(walletsAccounts.id, from_account_id));
      } else {
        await tx.update(walletsAccounts)
          .set({ balance: sql`${walletsAccounts.balance} - ${numAmount}`, updated_at: now })
          .where(eq(walletsAccounts.id, from_account_id));
      }

      // 3. Hedef Hesap Bakiyesini Atomik SQL ile Güncelle
      if (toAcc.type === 'credit_card') {
        // Kart borcu ödeniyor (eksiye inmez, borç sıfırlanabilir)
        await tx.update(walletsAccounts)
          .set({ balance: sql`GREATEST(0, ${walletsAccounts.balance} - ${numAmount})`, updated_at: now })
          .where(eq(walletsAccounts.id, to_account_id));
      } else {
        await tx.update(walletsAccounts)
          .set({ balance: sql`${walletsAccounts.balance} + ${numAmount}`, updated_at: now })
          .where(eq(walletsAccounts.id, to_account_id));
      }

      // 4. Çift Taraflı Muhasebe (Double-Entry) Kayıtları
      const familyId = user.family_id || fromAcc.family_id || (user.id ? `fam-${user.id}` : null);
      const baseNote = note ? note.trim() : (isCardPayment ? `${toAcc.name} borç ödemesi` : `Hesaplar arası transfer`);

      // 4a. Çıkış Hesabı Hareketi
      const outMerchant = isCardPayment 
        ? `💳 Kart Ödemesi: ${toAcc.name}`
        : `🔄 Transfer Çıkışı: ${fromAcc.name} ➔ ${toAcc.name}`;
      const outNotes = `${baseNote} [to_wallet:${to_account_id}]`;

      await tx.insert(transactions).values({
        id: txId,
        wallet_id: from_account_id,
        user_id: user.id,
        family_id: familyId,
        merchant: outMerchant,
        amount: numAmount,
        currency: fromAcc.currency || 'TRY',
        transaction_date: txDate,
        is_installment: 0,
        notes: outNotes,
        is_family_shared: 1,
        is_verified: 1,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
        device_id: 'web-client'
      });

      // 4b. Hedef Hesap Hareketi (Çift taraflı defter tutarlılığı)
      const inMerchant = isCardPayment
        ? `💳 Kart Ödeme Tahsilatı: ${fromAcc.name}`
        : `📥 Gelen Transfer: ${fromAcc.name} ➔ ${toAcc.name}`;
      const inNotes = `${baseNote} [from_wallet:${from_account_id}] [linked_tx:${txId}]`;

      await tx.insert(transactions).values({
        id: txInId,
        wallet_id: to_account_id,
        user_id: user.id,
        family_id: familyId,
        merchant: inMerchant,
        amount: numAmount,
        currency: toAcc.currency || 'TRY',
        transaction_date: txDate,
        is_installment: 0,
        notes: inNotes,
        is_family_shared: 1,
        is_verified: 1,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
        device_id: 'web-client'
      });
    });

    // 5. Event Bus Bildirimi
    await eventBus.emit(EVENTS.TRANSACTION_CREATED, {
      transactionId: txId,
      amount: numAmount,
      merchant: `🔄 Transfer: ${fromAccName} ➔ ${toAccName}`,
      wallet_id: from_account_id,
      type: 'transfer',
      userId: user.id,
      familyId: userFamilyId
    });

    return NextResponse.json({
      success: true,
      message: isCardPayment 
        ? `✅ ${toAccName} kartına ${numAmount.toLocaleString('tr-TR')} ₺ ödeme yapıldı ve borcu düşüldü!`
        : `✅ ${fromAccName} hesabından ${toAccName} hesabına ${numAmount.toLocaleString('tr-TR')} ₺ transfer edildi!`
    });
  } catch (error: any) {
    console.error('Transfer API Error:', error);
    const msg = error.message || 'Transfer sırasında hata oluştu.';
    if (msg.startsWith('NOT_FOUND:')) {
      return NextResponse.json({ success: false, error: msg.replace('NOT_FOUND: ', '') }, { status: 404 });
    }
    if (msg.startsWith('FORBIDDEN:')) {
      return NextResponse.json({ success: false, error: msg.replace('FORBIDDEN: ', '') }, { status: 403 });
    }
    if (msg.startsWith('LIMIT_EXCEEDED:') || msg.startsWith('INSUFFICIENT_FUNDS:') || msg.startsWith('CURRENCY_MISMATCH:')) {
      return NextResponse.json({ success: false, error: msg.replace(/^[A-Z_]+: /, '') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
