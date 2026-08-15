import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { personalDebtsReceivables, walletsAccounts, transactions } from '@/db/schema';
import { eq , or , and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

const USD_RATE = 36.50;
const EUR_RATE = 39.80;
const GOLD_GRAM_RATE = 3180;

function calcCurrentTLValue(indexType: string, indexAmount: number): number {
  switch (indexType) {
    case 'GOLD': return indexAmount * GOLD_GRAM_RATE;
    case 'USD':  return indexAmount * USD_RATE;
    case 'EUR':  return indexAmount * EUR_RATE;
    default:     return indexAmount; // TRY
  }
}

function calcMaturityValue(
  indexType: string,
  indexAmount: number,
  interestRate: number,
  interestPeriod: string,
  createdAt: string,
  dueDate: string | null
): number {
  const baseTL = calcCurrentTLValue(indexType, indexAmount);
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
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const records = userId
      ? await db.select().from(personalDebtsReceivables).where(eq(personalDebtsReceivables.user_id, userId)).all()
      : [];
    const wallets = userId
      ? await db.select().from(walletsAccounts).where(or(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.is_family_shared, 1))).all()
      : [];
    const walletMap = new Map((wallets as any[]).map((w: any) => [w.id, w.name]));

    const enriched = (records as any[]).map((r: any) => {
      const currentTL = calcCurrentTLValue(r.index_type, r.index_amount);
      const maturityTL = calcMaturityValue(
        r.index_type, r.index_amount,
        r.interest_rate || 0, r.interest_period || 'yearly',
        r.created_at, r.due_date
      );
      const remaining = Math.max(0, maturityTL - (r.paid_amount || 0));
      const today = new Date();
      const dueDate = r.due_date ? new Date(r.due_date) : null;
      const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
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
      .filter(r => r.type === 'debt' && r.status !== 'closed')
      .reduce((s, r) => s + r.remaining_tl, 0);

    const totalReceivable = enriched
      .filter(r => r.type === 'receivable' && r.status !== 'closed')
      .reduce((s, r) => s + r.remaining_tl, 0);

    return NextResponse.json({
      success: true,
      data: {
        records: enriched,
        summary: { totalDebt, totalReceivable, netPosition: totalReceivable - totalDebt }
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();
    const {
      type, person_name, description,
      index_type, index_amount, interest_rate, interest_period,
      due_date, connected_wallet_id
    } = body;

    if (!person_name?.trim() || !type || !index_amount) {
      return NextResponse.json({ success: false, error: 'Kişi adı, tür ve tutar zorunludur.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const nowDate = now.split('T')[0];
    const newId = `debt-${Date.now()}`;
    const origTL = calcCurrentTLValue(index_type || 'TRY', Number(index_amount));

    db.insert(personalDebtsReceivables).values({
      id: newId,
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
    }).run();

    // Bağlı hesabın bakiyesini güncelle
    if (connected_wallet_id && origTL > 0) {
      const wallet = await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, connected_wallet_id)).get();
      if (wallet) {
        const newBalance = type === 'debt'
          ? wallet.balance + origTL   // Borç aldım → para geldi
          : wallet.balance - origTL;  // Borç verdim → para çıktı

        db.update(walletsAccounts)
          .set({ balance: Math.max(0, newBalance), updated_at: now })
          .where(eq(walletsAccounts.id, connected_wallet_id))
          .run();

        const icon = type === 'debt' ? '🤝 Şahıs Borcu Alındı' : '🤝 Şahsa Borç Verildi';
        db.insert(transactions).values({
          id: `tx-${newId}`,
          wallet_id: connected_wallet_id,
          merchant: `${icon}: ${person_name.trim()}`,
          amount: origTL,
          currency: 'TRY',
          transaction_date: nowDate,
          notes: description?.trim() || (type === 'debt' ? 'Kişisel borç girişi' : 'Kişisel borç çıkışı'),
          is_installment: 0,
          installment_number: 1,
          total_installments: 1,
          is_verified: 1,
          is_family_shared: 1,
          created_at: now,
          updated_at: now,
          sync_status: 'synced',
          device_id: 'mac-local'
        }).run();
      }
    }

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
    initDatabase();
    const body = await req.json();
    const { id, payment_amount } = body;

    if (!id || !payment_amount) {
      return NextResponse.json({ success: false, error: 'ID ve ödeme tutarı zorunludur.' }, { status: 400 });
    }

    const record = await db.select().from(personalDebtsReceivables).where(eq(personalDebtsReceivables.id, id)).get();
    if (!record) {
      return NextResponse.json({ success: false, error: 'Kayıt bulunamadı.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const nowDate = now.split('T')[0];
    const payAmt = Number(payment_amount);

    const maturityTL = calcMaturityValue(
      record.index_type, record.index_amount,
      record.interest_rate || 0, record.interest_period || 'yearly',
      record.created_at, record.due_date
    );
    const newPaid = (record.paid_amount || 0) + payAmt;
    const newStatus = newPaid >= maturityTL ? 'closed' : 'partial';

    db.update(personalDebtsReceivables)
      .set({ paid_amount: newPaid, status: newStatus, updated_at: now })
      .where(eq(personalDebtsReceivables.id, id))
      .run();

    // Bağlı hesap bakiyesi güncelle
    if (record.connected_wallet_id) {
      const wallet = await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, record.connected_wallet_id)).get();
      if (wallet) {
        const newBalance = record.type === 'debt'
          ? wallet.balance - payAmt   // Borcumu ödedim → para gitti
          : wallet.balance + payAmt;  // Alacağımı tahsil ettim → para geldi

        db.update(walletsAccounts)
          .set({ balance: Math.max(0, newBalance), updated_at: now })
          .where(eq(walletsAccounts.id, record.connected_wallet_id))
          .run();

        const icon = record.type === 'debt' ? '🤝 Şahıs Borcu Ödendi' : '🤝 Şahıs Alacağı Tahsil Edildi';
        db.insert(transactions).values({
          id: `tx-pay-${Date.now()}`,
          wallet_id: record.connected_wallet_id,
          merchant: `${icon}: ${record.person_name}`,
          amount: payAmt,
          currency: 'TRY',
          transaction_date: nowDate,
          notes: `Kısmi / tam ödeme — ${record.person_name}`,
          is_installment: 0,
          installment_number: 1,
          total_installments: 1,
          is_verified: 1,
          is_family_shared: 1,
          created_at: now,
          updated_at: now,
          sync_status: 'synced',
          device_id: 'mac-local'
        }).run();
      }
    }

    const label = newStatus === 'closed' ? 'tamamen kapandı' : `kısmi ödeme yapıldı, kalan ${(maturityTL - newPaid).toLocaleString('tr-TR')} ₺`;
    return NextResponse.json({
      success: true,
      message: `✅ ${record.person_name} - ${payAmt.toLocaleString('tr-TR')} ₺ ödeme kaydedildi. Kayıt ${label}.`
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID zorunludur.' }, { status: 400 });

    db.delete(personalDebtsReceivables).where(user.is_master_account === 1 ? eq(personalDebtsReceivables.id, id) : and(eq(personalDebtsReceivables.id, id), eq(personalDebtsReceivables.user_id, user.id))).run();
    return NextResponse.json({ success: true, message: 'Kayıt silindi.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
