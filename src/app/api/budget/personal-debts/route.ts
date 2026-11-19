import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { personalDebtsReceivables, walletsAccounts, transactions } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { diffTurkeyCalendarDays, getTodayTurkeyDate } from '@/lib/date-utils';
import { fetchLiveExchangeRates, MarketRates } from '@/lib/market-data';

function calcCurrentTLValue(indexType: string, indexAmount: number, rates?: MarketRates): number {
  const usd = rates?.USD_TRY || 0;
  const eur = rates?.EUR_TRY || 0;
  const gold = rates?.GOLD_GRAM_TRY || 0;
  switch (indexType) {
    case 'GOLD': return indexAmount * gold;
    case 'USD':  return indexAmount * usd;
    case 'EUR':  return indexAmount * eur;
    default:     return indexAmount; // TRY
  }
}

function calcMaturityValue(
  indexType: string,
  indexAmount: number,
  interestRate: number,
  interestPeriod: string,
  createdAt: string,
  dueDate: string | null,
  rates?: MarketRates
): number {
  const baseTL = calcCurrentTLValue(indexType, indexAmount, rates);
  if (!interestRate || interestRate === 0 || !dueDate) return baseTL;

  const start = new Date(createdAt);
  const end = new Date(dueDate);
  const days = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  let interestFactor = 1;
  if (interestPeriod === 'monthly') {
    const months = days / 30;
    interestFactor = 1 + (interestRate / 100) * months;
  } else {
    const years = days / 365;
    interestFactor = 1 + (interestRate / 100) * years;
  }

  return Math.round(baseTL * interestFactor * 100) / 100;
}

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const userId = user.id;

    const familyId = user.family_id || (userId ? `fam-${userId}` : null);

    const records = await db.select().from(personalDebtsReceivables).where(
      familyId
        ? or(eq(personalDebtsReceivables.family_id, familyId), eq(personalDebtsReceivables.user_id, userId))
        : eq(personalDebtsReceivables.user_id, userId)
    );

    const wallets = await db.select().from(walletsAccounts).where(
      familyId
        ? and(
            eq(walletsAccounts.is_active, 1),
            eq(walletsAccounts.family_id, familyId),
            or(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.is_family_shared, 1))
          )
        : and(eq(walletsAccounts.is_active, 1), eq(walletsAccounts.user_id, userId))
    );
    const walletMap = new Map((wallets).map((w: any) => [w.id, w.name]));

    const rates = await fetchLiveExchangeRates();
    const todayTurkeyStr = getTodayTurkeyDate();
    const enriched = (records).map((r: any) => {
      const currentTL = calcCurrentTLValue(r.index_type, r.index_amount, rates);
      const maturityTL = calcMaturityValue(
        r.index_type, r.index_amount,
        r.interest_rate || 0, r.interest_period || 'yearly',
        r.created_at, r.due_date,
        rates
      );
      const remaining = Math.max(0, maturityTL - (r.paid_amount || 0));
      const daysLeft = r.due_date ? diffTurkeyCalendarDays(r.due_date, todayTurkeyStr) : null;
      const isOverdue = daysLeft !== null && daysLeft < 0 && r.status !== 'closed';

      return {
        ...r,
        current_tl_value: currentTL,
        maturity_tl_value: maturityTL,
        remaining_tl: remaining,
        days_left: daysLeft,
        is_overdue: isOverdue,
        wallet_name: r.connected_wallet_id ? walletMap.get(r.connected_wallet_id) : null
      };
    });

    const totalDebt = enriched
      .filter((r: any) => r.type === 'debt' && r.status !== 'closed')
      .reduce((s: number, r: any) => s + r.remaining_tl, 0);

    const totalReceivable = enriched
      .filter((r: any) => r.type === 'receivable' && r.status !== 'closed')
      .reduce((s: number, r: any) => s + r.remaining_tl, 0);

    return NextResponse.json({
      success: true,
      data: {
        records: enriched,
        summary: { totalDebt, totalReceivable, netPosition: totalReceivable - totalDebt },
        rates
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await req.json();
    const {
      type, person_name, description,
      index_type, index_amount, interest_rate, interest_period,
      due_date, connected_wallet_id
    } = body;

    const numIndexAmount = Number(index_amount);
    if (!person_name?.trim() || !type || !Number.isFinite(numIndexAmount) || numIndexAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Kişi adı, tür ve 0\'dan büyük geçerli bir tutar zorunludur.' }, { status: 400 });
    }

    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);

    // BOLA Koruması: Bağlı cüzdan seçilmişse ailenin yetkisi altında ve TRY biriminde olduğunu doğrula
    if (connected_wallet_id) {
      const wallet = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, connected_wallet_id)))[0];
      if (!wallet) {
        return NextResponse.json({ success: false, error: 'Bağlı hesap bulunamadı.' }, { status: 404 });
      }
      if (wallet.is_active === 0) {
        return NextResponse.json({ success: false, error: 'Arşivlenmiş veya pasif hesap bağlanamaz.' }, { status: 400 });
      }
      if (wallet.currency && wallet.currency !== 'TRY') {
        return NextResponse.json({ success: false, error: `Para birimi uyuşmazlığı: Bağlı hesap TRY olmalıdır (Seçilen: ${wallet.currency}).` }, { status: 400 });
      }
      const walletBelongs = wallet.family_id
        ? Boolean(familyId && wallet.family_id === familyId)
        : wallet.user_id === user.id;
      if (!walletBelongs || (wallet.user_id !== user.id && wallet.is_family_shared !== 1 && !(!wallet.user_id && walletBelongs))) {
        return NextResponse.json({ success: false, error: 'Seçilen bağlı hesaba erişim yetkiniz yok.' }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    const nowDate = getTodayTurkeyDate();
    const newId = `debt-${crypto.randomUUID()}`;
    const rates = await fetchLiveExchangeRates();
    const origTL = Math.round(calcCurrentTLValue(index_type || 'TRY', numIndexAmount, rates) * 100) / 100;

    await db.transaction(async (tx) => {
      await tx.insert(personalDebtsReceivables).values({
        id: newId,
        user_id: user.id,
        family_id: familyId,
        type,
        person_name: person_name.trim(),
        description: description?.trim() || null,
        index_type: index_type || 'TRY',
        index_amount: Number(index_amount),
        interest_rate: Number(interest_rate) || 0,
        interest_period: interest_period || 'yearly',
        due_date: due_date || null,
        connected_wallet_id: connected_wallet_id || null,
        status: 'active',
        paid_amount: 0,
        created_at: now,
        updated_at: now
      });

      // Bağlı hesabın bakiyesini güncelle
      if (connected_wallet_id && origTL > 0) {
        const [wallet] = await tx.select().from(walletsAccounts).where(eq(walletsAccounts.id, connected_wallet_id)).for('update');
        if (wallet) {
          if (type !== 'debt') {
            // Borç verdim -> cüzdandan para çıkıyor. Yeterli bakiye var mı kontrol et.
            const availableFunds = wallet.type === 'kmh'
              ? (Number(wallet.balance) || 0) + (Number(wallet.overdraft_limit) || 0)
              : (Number(wallet.balance) || 0);

            if (availableFunds < origTL) {
              throw new Error(`Seçilen bağlı hesapta yetersiz bakiye! Mevcut kullanılabilir bakiye: ${availableFunds.toLocaleString('tr-TR')} ₺, Gereken: ${origTL.toLocaleString('tr-TR')} ₺`);
            }
          }

          const currentBalance = Number(wallet.balance) || 0;
          const newBalance = type === 'debt'
            ? currentBalance + origTL   // Borç aldım → para geldi
            : currentBalance - origTL;  // Borç verdim → para çıktı

          await tx.update(walletsAccounts)
            .set({ balance: newBalance, updated_at: now })
            .where(eq(walletsAccounts.id, connected_wallet_id));

          const icon = type === 'debt' ? '🤝 Şahıs Borcu Alındı' : '🤝 Şahsa Borç Verildi';
          await tx.insert(transactions).values({
            id: `tx-${newId}`,
            wallet_id: connected_wallet_id,
            user_id: user.id,
            family_id: familyId,
            merchant: `${icon}: ${person_name.trim()}`,
            amount: origTL,
            currency: 'TRY',
            transaction_date: nowDate,
            notes: description?.trim() || (type === 'debt' ? 'Kişisel borç girişi' : 'Kişisel borç çıkışı'),
            is_installment: 0,
            installment_number: 1,
            total_installments: 1,
            parent_transaction_id: newId,
            is_verified: 1,
            is_family_shared: 1,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            device_id: 'web-client'
          });
        }
      }
    });

    const typeLabel = type === 'debt' ? 'Borç' : 'Alacak';
    return NextResponse.json({
      success: true,
      message: `✅ ${person_name.trim()} kaydı başarıyla eklendi! ${origTL.toLocaleString('tr-TR')} ₺ ${typeLabel} kaydedildi.`
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await req.json();
    const { id, payment_amount } = body;

    const payAmt = Number(payment_amount);
    if (!id || !Number.isFinite(payAmt) || payAmt <= 0) {
      return NextResponse.json({ success: false, error: 'ID ve geçerli pozitif bir ödeme tutarı zorunludur.' }, { status: 400 });
    }

    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);

    // BOLA Koruması: Kaydın kullanıcıya veya ailesine ait olduğunu doğrula
    const record = (await db.select().from(personalDebtsReceivables).where(eq(personalDebtsReceivables.id, id)))[0];
    if (!record) {
      return NextResponse.json({ success: false, error: 'Kayıt bulunamadı.' }, { status: 404 });
    }

    const belongsToFamily = record.family_id
      ? Boolean(familyId && record.family_id === familyId)
      : record.user_id === user.id;
    if (!belongsToFamily) {
      return NextResponse.json({ success: false, error: 'Bu borç/alacak kaydına erişim yetkiniz yok.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const nowDate = getTodayTurkeyDate();

    const rates = await fetchLiveExchangeRates();
    const maturityTL = calcMaturityValue(
      record.index_type, record.index_amount,
      record.interest_rate || 0, record.interest_period || 'yearly',
      record.created_at, record.due_date,
      rates
    );
    const newPaid = (record.paid_amount || 0) + payAmt;
    const newStatus = newPaid >= maturityTL ? 'closed' : 'partial';

    await db.transaction(async (tx) => {
      await tx.update(personalDebtsReceivables)
        .set({ paid_amount: newPaid, status: newStatus, updated_at: now })
        .where(eq(personalDebtsReceivables.id, id));

      // Bağlı hesap bakiyesi güncelle
      if (record.connected_wallet_id) {
        const [wallet] = await tx.select().from(walletsAccounts).where(eq(walletsAccounts.id, record.connected_wallet_id)).for('update');
        if (wallet) {
          // Cüzdanın da aynı aileye ait olduğunu doğrula
          const walletBelongs = wallet.family_id
            ? Boolean(familyId && wallet.family_id === familyId)
            : wallet.user_id === user.id;
          if (!walletBelongs || (wallet.user_id !== user.id && wallet.is_family_shared !== 1 && !(!wallet.user_id && walletBelongs))) {
            throw new Error('FORBIDDEN: Bağlı ödeme hesabına erişim yetkiniz yok.');
          }
          if (wallet.currency && wallet.currency !== 'TRY') {
            throw new Error(`INSUFFICIENT_FUNDS: Bağlı ödeme hesabı TRY olmalıdır (Mevcut: ${wallet.currency}).`);
          }

          if (record.type === 'debt') {
            // Borcumu ödedim -> hesaptan para çıkıyor. Kontrol et.
            const availableFunds = wallet.type === 'kmh'
              ? (Number(wallet.balance) || 0) + (Number(wallet.overdraft_limit) || 0)
              : (Number(wallet.balance) || 0);

            if (availableFunds < payAmt) {
              throw new Error(`INSUFFICIENT_FUNDS: Ödeme yapılacak hesapta yetersiz bakiye! Kullanılabilir: ${availableFunds.toLocaleString('tr-TR')} ₺, Ödenen: ${payAmt.toLocaleString('tr-TR')} ₺`);
            }
          }

          const currentBalance = Number(wallet.balance) || 0;
          const newBalance = record.type === 'debt'
            ? currentBalance - payAmt   // Borcumu ödedim → para gitti
            : currentBalance + payAmt;  // Alacağımı tahsil ettim → para geldi

          await tx.update(walletsAccounts)
            .set({ balance: newBalance, updated_at: now })
            .where(eq(walletsAccounts.id, record.connected_wallet_id));

          const icon = record.type === 'debt' ? '🤝 Şahıs Borcu Ödendi' : '🤝 Şahıs Alacağı Tahsil Edildi';
          await tx.insert(transactions).values({
            id: `tx-pay-${crypto.randomUUID()}`,
            wallet_id: record.connected_wallet_id,
            user_id: user.id,
            family_id: familyId,
            merchant: `${icon}: ${record.person_name}`,
            amount: payAmt,
            currency: 'TRY',
            transaction_date: nowDate,
            notes: `Kısmi / tam ödeme — ${record.person_name}`,
            is_installment: 0,
            installment_number: 1,
            total_installments: 1,
            parent_transaction_id: record.id,
            is_verified: 1,
            is_family_shared: 1,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            device_id: 'web-client'
          });
        }
      }
    });

    const label = newStatus === 'closed' ? 'tamamen kapandı' : `kısmi ödeme yapıldı, kalan ${(maturityTL - newPaid).toLocaleString('tr-TR')} ₺`;
    return NextResponse.json({
      success: true,
      message: `✅ ${record.person_name} - ${payAmt.toLocaleString('tr-TR')} ₺ ödeme kaydedildi. Kayıt ${label}.`
    });
  } catch (err: any) {
    const msg = err?.message || 'İşlem sırasında hata oluştu.';
    if (msg.startsWith('FORBIDDEN:')) {
      return NextResponse.json({ success: false, error: msg.replace('FORBIDDEN: ', '') }, { status: 403 });
    }
    if (msg.startsWith('INSUFFICIENT_FUNDS:')) {
      return NextResponse.json({ success: false, error: msg.replace('INSUFFICIENT_FUNDS: ', '') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const { searchParams } = new URL(req.url, 'http://localhost');
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID zorunludur.' }, { status: 400 });

    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);

    // BOLA Koruması: Kaydın varlığını ve silme yetkisini doğrula
    const record = (await db.select().from(personalDebtsReceivables).where(eq(personalDebtsReceivables.id, id)))[0];
    if (!record) {
      return NextResponse.json({ success: false, error: 'Kayıt bulunamadı.' }, { status: 404 });
    }

    const belongsToFamily = record.family_id
      ? Boolean(familyId && record.family_id === familyId)
      : record.user_id === user.id;
    const isOwner = record.user_id === user.id;
    const isLeader = belongsToFamily && (user.is_master_account === 1 || user.role === 'admin');

    if (!belongsToFamily || (!isOwner && !isLeader)) {
      return NextResponse.json({ success: false, error: 'Bu borç/alacak kaydını silme yetkiniz yok.' }, { status: 403 });
    }

    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      // Revert balance changes in connected wallet if any (using original transaction amount to avoid FX drift)
      if (record.connected_wallet_id) {
        const [wallet] = await tx.select().from(walletsAccounts).where(eq(walletsAccounts.id, record.connected_wallet_id)).for('update');
        if (wallet) {
          const origTx = (await tx.select().from(transactions).where(eq(transactions.id, `tx-${record.id}`)))[0];
          const origTL = origTx
            ? Number(origTx.amount) || 0
            : calcCurrentTLValue(record.index_type || 'TRY', Number(record.index_amount), await fetchLiveExchangeRates());
          const paidTL = Number(record.paid_amount) || 0;

          // Borç: hesaba +origTL girmiş, -paidTL çıkmıştı (net eklenen = origTL - paidTL). Geri almak için düş.
          // Alacak: hesaptan -origTL çıkmış, +paidTL girmişti (net eksilen = -(origTL - paidTL)). Geri almak için ekle.
          const netImpact = record.type === 'debt' ? (origTL - paidTL) : -(origTL - paidTL);
          const revertedBalance = Math.round(((Number(wallet.balance) || 0) - netImpact) * 100) / 100;

          await tx.update(walletsAccounts)
            .set({ balance: revertedBalance, updated_at: now })
            .where(eq(walletsAccounts.id, record.connected_wallet_id));
        }
      }

      // İlişkili işlem kayıtlarını temizle
      await tx.delete(transactions).where(
        or(
          eq(transactions.id, `tx-${record.id}`),
          eq(transactions.parent_transaction_id, record.id)
        )
      );

      await tx.delete(personalDebtsReceivables).where(eq(personalDebtsReceivables.id, id));
    });

    return NextResponse.json({ success: true, message: 'Kayıt ve ilişkili finansal etkiler başarıyla silindi/geri alındı.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
