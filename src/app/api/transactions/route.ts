import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthUser } from '@/lib/auth';
import { db, initDatabase } from '@/db';
import { transactions, walletsAccounts, categories, familyMembers } from '@/db/schema';
import { eventBus, EVENTS } from '@/lib/events';
import { eq, or, and, like, sql } from 'drizzle-orm';
import { addMonthsSafe, parseLocalYYYYMMDD } from '@/lib/bill-schedule';
import { getTodayTurkeyDate, parseTurkeyCalendarDate } from '@/lib/date-utils';

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await req.json();

    const {
      wallet_id,
      category_id,
      merchant,
      amount,
      notes,
      installments = 1,
      is_family_shared = 1,
      receipt_image_url,
      transaction_date
    } = body;

    const numAmount = Number(amount);
    if (!wallet_id || !Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Lütfen geçerli bir hesap ve 0\'dan büyük bir tutar girin.' }, { status: 400 });
    }

    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);
    const wallet = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, wallet_id)))[0];
    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Seçilen hesap bulunamadı.' }, { status: 404 });
    }
    if (wallet.is_active === 0) {
      return NextResponse.json({ success: false, error: 'Arşivlenmiş veya pasif bir hesapta işlem yapılamaz.' }, { status: 400 });
    }

    // OWASP BOLA Sahiplik Kontrolü: Cüzdan kullanıcıya ait olmalı veya aynı ailede paylaşımlı/ortak olmalıdır
    const isSameFamily = wallet.family_id ? Boolean(familyId && wallet.family_id === familyId) : false;
    const isOwner = wallet.user_id === user.id || (isSameFamily && (wallet.is_family_shared === 1 || !wallet.user_id));
    if (!isOwner) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim: Bu hesap sizin veya ailenizin paylaşımlı hesabına ait değil.' }, { status: 403 });
    }

    // 1. İşlemin Gelir mi Gider mi Olduğunu Belirle (Kategori aile/sistem sınırı kontrollü)
    let category: any = null;
    if (category_id) {
      category = (await db.select().from(categories).where(
        and(
          eq(categories.id, category_id),
          familyId
            ? or(eq(categories.family_id, familyId), sql`${categories.family_id} IS NULL`, eq(categories.family_id, ''))
            : or(sql`${categories.family_id} IS NULL`, eq(categories.family_id, ''))
        )
      ))[0] || null;
      if (!category) {
        return NextResponse.json({ success: false, error: 'Seçilen kategori bulunamadı veya erişim yetkiniz yok.' }, { status: 403 });
      }
    }
    const finalCategoryId = category ? category.id : null;
    const isIncome = (category && category.type === 'income') || body.type === 'income';

    // 2. Kredi Kartı, KMH veya Nakit Limit Kontrolü (Sadece Gider / Harcama İşlemlerinde Yapılır)
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
      } else if (wallet.type === 'kmh') {
        const overdraftLimit = wallet.overdraft_limit || 0;
        const availableKMH = wallet.balance + overdraftLimit;
        if (numAmount > availableKMH) {
          return NextResponse.json({
            success: false,
            error: `KMH (Ek Hesap) Limiti Aşıldı! ${wallet.name} hesabınızın kullanılabilir toplam limiti ${availableKMH.toLocaleString('tr-TR')} ₺'dir.`
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
    const parentTxId = `tx_${crypto.randomUUID()}`;
    const baseMonthly = Math.floor((numAmount / totalInstallments) * 100) / 100;
    const remainder = Math.round((numAmount - (baseMonthly * totalInstallments)) * 100) / 100;
    const approxMonthly = Math.round((numAmount / totalInstallments) * 100) / 100;

    const createdTxIds: string[] = [];
    const userId = user.id;

    let memberId: string | null = null;
    if (body.member_id) {
      const requestedMember = (await db.select().from(familyMembers).where(
        and(
          eq(familyMembers.id, body.member_id),
          eq(familyMembers.is_active, 1),
          familyId ? eq(familyMembers.family_id, familyId) : eq(familyMembers.user_id, userId)
        )
      ))[0];
      if (!requestedMember) {
        return NextResponse.json({ success: false, error: 'Seçilen aile üyesi bulunamadı veya ailenize ait değil.' }, { status: 403 });
      }
      memberId = requestedMember.id;
    }
    if (!memberId && wallet.user_id) {
      const ownerMember = (await db.select().from(familyMembers).where(and(eq(familyMembers.is_active, 1), eq(familyMembers.user_id, wallet.user_id))))[0];
      memberId = ownerMember?.id || null;
    }
    if (!memberId && familyId) {
      const member = (await db.select().from(familyMembers).where(and(eq(familyMembers.is_active, 1), eq(familyMembers.family_id, familyId))))[0];
      memberId = member?.id || null;
    }

    // Taksit Motoru: Tutar tek seferlik ise 1 satır, taksitli ise gelecek aylara dağıtılan N adet satır
    const parsedBaseDate = transaction_date ? parseLocalYYYYMMDD(transaction_date) : null;
    const validBaseDate = parsedBaseDate || parseTurkeyCalendarDate(getTodayTurkeyDate());

    // Atomik Veritabanı Yazma İşlemi (db.transaction + FOR UPDATE satır kilitleme)
    await db.transaction(async (tx) => {
      // 1. Cüzdanı FOR UPDATE ile kilitleyerek çek (Lost update önleme)
      const lockedWallet = (await tx.select().from(walletsAccounts).where(eq(walletsAccounts.id, wallet_id)).for('update'))[0];
      if (!lockedWallet) {
        throw new Error('NOT_FOUND: Seçilen hesap bulunamadı.');
      }

      // 2. Kredi Kartı, KMH veya Nakit Limit Kontrolü (Transaction içinde kilitli bakiye ile kesin denetim)
      if (!isIncome) {
        if (lockedWallet.type === 'credit_card') {
          const creditLimit = lockedWallet.credit_limit || 0;
          const currentDebt = lockedWallet.balance || 0;
          const availableLimit = Math.max(0, creditLimit - currentDebt);
          if (numAmount > availableLimit) {
            throw new Error(`LIMIT_EXCEEDED: Kredi Kartı Limiti Aşıldı! ${lockedWallet.name} kartınızın kullanılabilir limiti sadece ${availableLimit.toLocaleString('tr-TR')} ₺'dir.`);
          }
        } else if (lockedWallet.type === 'kmh') {
          const overdraftLimit = lockedWallet.overdraft_limit || 0;
          const availableKMH = lockedWallet.balance + overdraftLimit;
          if (numAmount > availableKMH) {
            throw new Error(`LIMIT_EXCEEDED: KMH (Ek Hesap) Limiti Aşıldı! ${lockedWallet.name} hesabınızın kullanılabilir toplam limiti ${availableKMH.toLocaleString('tr-TR')} ₺'dir.`);
          }
        } else {
          if (numAmount > lockedWallet.balance) {
            throw new Error(`INSUFFICIENT_FUNDS: Yetersiz Bakiye! ${lockedWallet.name} hesabınızda sadece ${lockedWallet.balance.toLocaleString('tr-TR')} ₺ bakiye bulunmaktadır.`);
          }
        }
      }

      // 3. Taksitli veya tekil işlem kayıtlarını ekle
      for (let i = 0; i < totalInstallments; i++) {
        const txDateString = addMonthsSafe(validBaseDate, i);
        const txId = i === 0 ? parentTxId : `tx_${crypto.randomUUID()}_${i + 1}`;

        await tx.insert(transactions).values({
          id: txId,
          wallet_id,
          category_id: finalCategoryId,
          member_id: memberId,
          user_id: userId,
          family_id: familyId,
          merchant: merchant || (isIncome ? 'Gelir Girişi' : 'Genel Harcama'),
          amount: (i === 0 ? Math.round((baseMonthly + remainder) * 100) / 100 : baseMonthly),
          currency: lockedWallet.currency || 'TRY',
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
          device_id: 'web-client'
        });

        createdTxIds.push(txId);
      }

      // 4. Cüzdan / Kart / KMH Bakiyesini Atomik Olarak Güncelle
      let newBalance = lockedWallet.balance;
      if (isIncome) {
        // Gelir: Banka bakiyesini artırır, Kredi Kartı borcunu azaltır
        newBalance = lockedWallet.type === 'credit_card'
          ? Math.max(0, lockedWallet.balance - numAmount)
          : lockedWallet.balance + numAmount;
      } else {
        // Gider: Banka bakiyesini azaltır, Kredi Kartı borcunu artırır, KMH eksiye düşebilir
        if (lockedWallet.type === 'credit_card') {
          newBalance = lockedWallet.balance + numAmount;
        } else if (lockedWallet.type === 'kmh') {
          newBalance = lockedWallet.balance - numAmount; // KMH eksiye düşebilir
        } else {
          newBalance = Math.max(0, lockedWallet.balance - numAmount);
        }
      }

      await tx.update(walletsAccounts)
        .set({ balance: newBalance, updated_at: nowISO })
        .where(eq(walletsAccounts.id, wallet_id));
    });

    // Event Bus üzerinden çapraz modüllere haber ver
    await eventBus.emit(EVENTS.TRANSACTION_CREATED, {
      transactionId: parentTxId,
      amount,
      merchant,
      installments: totalInstallments,
      wallet_id,
      category_id,
      userId: user.id,
      familyId
    });

    return NextResponse.json({
      success: true,
      message: totalInstallments > 1 
        ? `İşlem ${totalInstallments} taksit olarak kaydedildi (Aylık ~${approxMonthly} TL). Gelecek ekstrelere işlendi.` 
        : 'İşlem başarıyla kaydedildi.',
      createdIds: createdTxIds
    });
  } catch (error: any) {
    console.error('Transaction API Error:', error);
    const msg = error?.message || 'İşlem sırasında hata oluştu.';
    if (msg.startsWith('NOT_FOUND:')) {
      return NextResponse.json({ success: false, error: msg.replace('NOT_FOUND: ', '') }, { status: 404 });
    }
    if (msg.startsWith('FORBIDDEN:')) {
      return NextResponse.json({ success: false, error: msg.replace('FORBIDDEN: ', '') }, { status: 403 });
    }
    if (msg.startsWith('LIMIT_EXCEEDED:') || msg.startsWith('INSUFFICIENT_FUNDS:')) {
      return NextResponse.json({ success: false, error: msg.replace(/^[A-Z_]+: /, '') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
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
      return NextResponse.json({ success: false, error: 'Harcama ID zorunludur.' }, { status: 400 });
    }

    const tx = (await db.select().from(transactions).where(eq(transactions.id, id)))[0];
    if (!tx) {
      return NextResponse.json({ success: false, error: 'Harcama kaydı bulunamadı.' }, { status: 404 });
    }

    const userFamilyId = user.family_id || (user.id ? `fam-${user.id}` : null);
    // OWASP BOLA: İşlem kullanıcının ailesine ait mi?
    const isFamilyMatch = tx.family_id ? Boolean(userFamilyId && tx.family_id === userFamilyId) : tx.user_id === user.id;
    if (!isFamilyMatch) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim: Bu işlem ailenize ait değil.' }, { status: 403 });
    }

    const canDelete = tx.user_id === user.id || user.is_master_account === 1 || user.role === 'admin';
    if (!canDelete) {
      return NextResponse.json({ 
        success: false, 
        error: 'Yetkisiz İşlem: Başka bir aile üyesine ait harcama kaydını yalnızca işlemi yapan üye veya Aile Lideri silebilir.' 
      }, { status: 403 });
    }

    if (
      tx.merchant?.includes('Kredi Çekim Anaparası') ||
      tx.merchant?.includes('Vadeli Mevduat Açılışı') ||
      tx.merchant?.includes('Vadeli Mevduat Dönüşü (Anapara)')
    ) {
      return NextResponse.json({
        success: false,
        error: 'Kredi çekimi veya vadeli mevduat anapara hareketi doğrudan silinemez; ilgili hesabı düzenleyin veya kapatın.'
      }, { status: 400 });
    }

    // Taksit grubu mu kontrol et: Eğer taksitli işlemse, yetim taksit ve bakiye sapmasını önlemek için tüm kardeş taksitleri topla
    let txsToDelete = [tx];
    if (tx.is_installment === 1 && tx.parent_transaction_id) {
      const siblings = await db.select().from(transactions).where(eq(transactions.parent_transaction_id, tx.parent_transaction_id));
      if (siblings.length > 0) {
        txsToDelete = siblings;
      }
    }

    const totalRevertAmount = Math.round(txsToDelete.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) * 100) / 100;

    // İşlemin Gelir mi Gider mi Olduğunu Belirle
    let isIncome = false;
    if (tx.category_id) {
      const cat = (await db.select().from(categories).where(eq(categories.id, tx.category_id)))[0];
      if (cat?.type === 'income') isIncome = true;
    }
    if (!isIncome && (tx.merchant?.includes('Gelir Girişi') || tx.merchant?.includes('Vadeli Mevduat Faiz Geliri'))) {
      isIncome = true;
    }

    // Transfer veya Kart Ödemesi ise yönü ve karşıt hesabı tespit et
    const toMatch = tx.notes?.match(/\[to_wallet:([^\]]+)\]/);
    const fromMatch = tx.notes?.match(/\[from_wallet:([^\]]+)\]/);
    const linkedMatch = tx.notes?.match(/\[linked_tx:([^\]]+)\]/);
    const targetWalletId = toMatch?.[1] || null;
    const sourceWalletId = fromMatch?.[1] || null;
    const linkedTxId = linkedMatch?.[1] || null;

    const nowISO = new Date().toISOString();

    // Atomik Veritabanı İade & Silme İşlemi (db.transaction)
    await db.transaction(async (dbtx) => {
      if (sourceWalletId && tx.wallet_id) {
        // Gelen Transfer satırı siliniyor: tx.wallet_id parayı almıştı (geri düş), sourceWalletId vermişti (iade et)
        const receiverWallet = (await dbtx.select().from(walletsAccounts).where(eq(walletsAccounts.id, tx.wallet_id)).for('update'))[0];
        if (receiverWallet) {
          let newReceiverBalance: number;
          if (receiverWallet.type === 'credit_card') {
            newReceiverBalance = Math.round((receiverWallet.balance + totalRevertAmount) * 100) / 100;
          } else if (receiverWallet.type === 'kmh') {
            newReceiverBalance = Math.round((receiverWallet.balance - totalRevertAmount) * 100) / 100;
          } else {
            newReceiverBalance = Math.max(0, Math.round((receiverWallet.balance - totalRevertAmount) * 100) / 100);
          }
          await dbtx.update(walletsAccounts)
            .set({ balance: newReceiverBalance, updated_at: nowISO })
            .where(eq(walletsAccounts.id, tx.wallet_id));
        }

        const senderWallet = (await dbtx.select().from(walletsAccounts).where(eq(walletsAccounts.id, sourceWalletId)).for('update'))[0];
        if (senderWallet) {
          const newSenderBalance = senderWallet.type === 'credit_card'
            ? Math.max(0, Math.round((senderWallet.balance - totalRevertAmount) * 100) / 100)
            : Math.round((senderWallet.balance + totalRevertAmount) * 100) / 100;
          await dbtx.update(walletsAccounts)
            .set({ balance: newSenderBalance, updated_at: nowISO })
            .where(eq(walletsAccounts.id, sourceWalletId));
        }

        // Karşıt çıkış transfer kaydını yalnızca ilgili işlem üzerinden temizle
        if (linkedTxId) {
          await dbtx.delete(transactions).where(and(eq(transactions.id, linkedTxId), eq(transactions.wallet_id, sourceWalletId)));
        } else {
          const legacyOut = (await dbtx.select({ id: transactions.id }).from(transactions).where(
            and(
              eq(transactions.wallet_id, sourceWalletId),
              like(transactions.notes, `%[to_wallet:${tx.wallet_id}]%`),
              eq(transactions.amount, tx.amount),
              eq(transactions.transaction_date, tx.transaction_date)
            )
          ).limit(1))[0];
          if (legacyOut) {
            await dbtx.delete(transactions).where(eq(transactions.id, legacyOut.id));
          }
        }
      } else {
        // 1. Kaynak Cüzdan Bakiyesini İade Et
        if (tx.wallet_id) {
          const wallet = (await dbtx.select().from(walletsAccounts).where(eq(walletsAccounts.id, tx.wallet_id)).for('update'))[0];
          if (wallet) {
            let newBalance = wallet.balance;
            if (isIncome) {
              // Gelir siliniyor: Normal banka bakiyesi AZALIR, Kredi kartı borcu ARTAR, KMH borcu derinleşebilir
              if (wallet.type === 'credit_card') {
                newBalance = Math.round((wallet.balance + totalRevertAmount) * 100) / 100;
              } else if (wallet.type === 'kmh') {
                newBalance = Math.round((wallet.balance - totalRevertAmount) * 100) / 100;
              } else {
                newBalance = Math.max(0, Math.round((wallet.balance - totalRevertAmount) * 100) / 100);
              }
            } else {
              // Gider veya giden transfer siliniyor: Normal banka bakiyesi ARTAR, Kredi kartı borcu AZALIR
              newBalance = wallet.type === 'credit_card'
                ? Math.max(0, Math.round((wallet.balance - totalRevertAmount) * 100) / 100)
                : Math.round((wallet.balance + totalRevertAmount) * 100) / 100;
            }

            await dbtx.update(walletsAccounts)
              .set({ balance: newBalance, updated_at: nowISO })
              .where(eq(walletsAccounts.id, tx.wallet_id));
          }
        }

        // 2. Giden Transfer ise Hedef Hesabın Bakiyesini de Geri Al ve YALNIZCA bu transfere bağlı karşıt kaydı sil
        if (targetWalletId) {
          const targetWallet = (await dbtx.select().from(walletsAccounts).where(eq(walletsAccounts.id, targetWalletId)).for('update'))[0];
          if (targetWallet) {
            let newTargetBalance: number;
            if (targetWallet.type === 'credit_card') {
              newTargetBalance = Math.round((targetWallet.balance + totalRevertAmount) * 100) / 100;
            } else if (targetWallet.type === 'kmh') {
              newTargetBalance = Math.round((targetWallet.balance - totalRevertAmount) * 100) / 100;
            } else {
              newTargetBalance = Math.max(0, Math.round((targetWallet.balance - totalRevertAmount) * 100) / 100);
            }

            await dbtx.update(walletsAccounts)
              .set({ balance: newTargetBalance, updated_at: nowISO })
              .where(eq(walletsAccounts.id, targetWalletId));
          }

          // Çift taraflı transferin hedef hesaptaki YALNIZCA bu transfere bağlı karşıt hareketini temizle
          const linkedIncoming = (await dbtx.select({ id: transactions.id }).from(transactions).where(
            and(
              eq(transactions.wallet_id, targetWalletId),
              like(transactions.notes, `%[linked_tx:${tx.id}]%`)
            )
          ).limit(1))[0];

          if (linkedIncoming) {
            await dbtx.delete(transactions).where(eq(transactions.id, linkedIncoming.id));
          } else {
            const legacyIncoming = (await dbtx.select({ id: transactions.id }).from(transactions).where(
              and(
                eq(transactions.wallet_id, targetWalletId),
                like(transactions.notes, `%[from_wallet:${tx.wallet_id}]%`),
                eq(transactions.amount, tx.amount),
                eq(transactions.transaction_date, tx.transaction_date)
              )
            ).limit(1))[0];
            if (legacyIncoming) {
              await dbtx.delete(transactions).where(eq(transactions.id, legacyIncoming.id));
            }
          }
        }
      }

      // 3. Taksitli ise tüm kardeş taksitleri sil, değilse sadece bu kaydı sil
      if (tx.is_installment === 1 && tx.parent_transaction_id) {
        await dbtx.delete(transactions).where(eq(transactions.parent_transaction_id, tx.parent_transaction_id));
      } else {
        await dbtx.delete(transactions).where(eq(transactions.id, id));
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: txsToDelete.length > 1 
        ? `${txsToDelete.length} taksit kaydı silindi ve bakiye eksiksiz güncellendi.` 
        : 'Harcama kaydı silindi ve bakiye güncellendi.' 
    });
  } catch (error: any) {
    console.error('Delete Transaction API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
