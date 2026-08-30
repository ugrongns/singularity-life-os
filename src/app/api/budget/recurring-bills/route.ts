import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { recurringBills, walletsAccounts, categories, transactions } from '@/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

// ✅ Timezone-safe yerel YYYY-MM ve YYYY-MM-DD
const localYYYYMM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const localYYYYMMDD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const { searchParams } = new URL(req.url, 'http://localhost');
    const today = new Date();
    const currentMonthStr = searchParams.get('month') || localYYYYMM(today);
    const currentDay = today.getDate();

    const userId = user.id;
    const familyId = user.family_id || `fam-${user.id}`;

    // 1. Faturaları ve Abonelikleri Çek
    const rawBills = await db.select()
      .from(recurringBills)
      .where(
        familyId
          ? or(eq(recurringBills.family_id, familyId), eq(recurringBills.user_id, userId))
          : eq(recurringBills.user_id, userId)
      )
      .orderBy(recurringBills.due_day);

    // 2. Cüzdan ve Kategori Haritaları
    const rawWallets = await db.select().from(walletsAccounts).where(eq(walletsAccounts.is_active, 1));
    const walletMap = new Map((rawWallets).map((w: any) => [w.id, w.name]));

    const rawCats = await db.select().from(categories);
    const categoryMap = new Map((rawCats).map((c: any) => [c.id, { name: c.name, icon: c.icon, color: c.color }]));

    let totalMonthly = 0;
    let paidThisMonth = 0;
    let pendingThisMonth = 0;
    let paidCount = 0;
    let pendingCount = 0;

    const enrichedBills = (rawBills).map((bill: any) => {
      const isPaidThisMonth = bill.last_paid_month === currentMonthStr;
      
      // Fatura kesim günü (tebliğ günü) geçti mi veya tanımlı değil mi?
      const isBillingOpen = !bill.billing_day || currentDay >= bill.billing_day;
      
      // Son ödeme gününe kalan gün sayısı
      const daysLeft = bill.due_day - currentDay;
      const isOverdue = !isPaidThisMonth && daysLeft < 0;

      // İstatistik toplamları (Yıllık ise sadece o ayda ise topla)
      const isDueThisMonth = bill.period === 'yearly' ? (bill.due_month === (today.getMonth() + 1)) : true;
      
      if (isDueThisMonth) {
        totalMonthly += bill.amount;
        if (isPaidThisMonth) {
          paidThisMonth += bill.amount;
          paidCount++;
        } else {
          pendingThisMonth += bill.amount;
          pendingCount++;
        }
      }

      const catInfo = bill.category_id ? categoryMap.get(bill.category_id) : null;

      return {
        ...bill,
        is_paid_this_month: isPaidThisMonth,
        is_billing_open: isBillingOpen,
        days_left: daysLeft,
        is_overdue: isOverdue,
        wallet_name: bill.auto_pay_wallet_id ? walletMap.get(bill.auto_pay_wallet_id) || null : null,
        category_name: catInfo?.name || null,
        category_icon: catInfo?.icon || '⚡',
        category_color: catInfo?.color || '#3B82F6',
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        bills: enrichedBills,
        summary: {
          currentMonth: currentMonthStr,
          totalMonthly,
          paidThisMonth,
          pendingThisMonth,
          totalCount: rawBills.length,
          paidCount,
          pendingCount
        }
      }
    });
  } catch (error: any) {
    console.error('Recurring bills GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const body = await req.json();
    const {
      name, type = 'utility', billing_day, due_day,
      period = 'monthly', due_month, amount = 0,
      is_auto_pay = 0, auto_pay_wallet_id, category_id, notes
    } = body;

    if (!name?.trim() || !due_day) {
      return NextResponse.json({ success: false, error: 'Fatura/Abonelik adı ve son ödeme günü zorunludur.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newId = `bill-${Date.now()}`;
    const familyId = user.family_id || `fam-${user.id}`;

    await db.insert(recurringBills).values({
      id: newId,
      name: name.trim(),
      type,
      billing_day: billing_day ? Number(billing_day) : null,
      due_day: Number(due_day),
      period,
      due_month: due_month ? Number(due_month) : null,
      amount: Number(amount) || 0,
      is_auto_pay: is_auto_pay ? 1 : 0,
      auto_pay_wallet_id: auto_pay_wallet_id || null,
      category_id: category_id || null,
      notes: notes?.trim() || null,
      status: 'active',
      user_id: user.id,
      family_id: familyId,
      created_at: now,
      updated_at: now
    });

    return NextResponse.json({
      success: true,
      message: `✅ ${name.trim()} fatura/abonelik takvimine eklendi!`,
      data: { id: newId }
    });
  } catch (error: any) {
    console.error('Recurring bills POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const body = await req.json();
    const {
      id, name, type, billing_day, due_day,
      period, due_month, amount,
      is_auto_pay, auto_pay_wallet_id, category_id, notes, status
    } = body;

    if (!id || !name?.trim() || !due_day) {
      return NextResponse.json({ success: false, error: 'ID, ad ve son ödeme günü zorunludur.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    await db.update(recurringBills)
      .set({
        name: name.trim(),
        type: type || 'utility',
        billing_day: billing_day ? Number(billing_day) : null,
        due_day: Number(due_day),
        period: period || 'monthly',
        due_month: due_month ? Number(due_month) : null,
        amount: Number(amount) || 0,
        is_auto_pay: is_auto_pay ? 1 : 0,
        auto_pay_wallet_id: auto_pay_wallet_id || null,
        category_id: category_id || null,
        notes: notes !== undefined ? (notes?.trim() || null) : undefined,
        status: status || 'active',
        updated_at: now
      })
      .where(eq(recurringBills.id, id));

    return NextResponse.json({
      success: true,
      message: `✅ ${name.trim()} başarıyla güncellendi!`
    });
  } catch (error: any) {
    console.error('Recurring bills PUT error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const body = await req.json();
    const { id, action = 'mark_paid', create_transaction = false, wallet_id, amount } = body;

    if (!id) return NextResponse.json({ success: false, error: 'Fatura ID zorunludur.' }, { status: 400 });

    const bill = (await db.select().from(recurringBills).where(eq(recurringBills.id, id)))[0];
    if (!bill) return NextResponse.json({ success: false, error: 'Fatura bulunamadı.' }, { status: 404 });

    const today = new Date();
    const currentMonthStr = localYYYYMM(today);
    const todayISO = localYYYYMMDD(today);
    const now = new Date().toISOString();

    if (action === 'mark_paid') {
      await db.update(recurringBills)
        .set({
          last_paid_month: currentMonthStr,
          last_paid_date: todayISO,
          updated_at: now
        })
        .where(eq(recurringBills.id, id));

      // Opsiyonel: Cüzdandan harcama olarak düş ve işlem kaydı oluştur
      const targetWalletId = wallet_id || bill.auto_pay_wallet_id;
      const paymentAmount = Number(amount) || bill.amount;

      if (create_transaction && targetWalletId && paymentAmount > 0) {
        const wallet = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, targetWalletId)))[0];
        if (wallet) {
          const newBalance = wallet.type === 'credit_card'
            ? wallet.balance + paymentAmount
            : Math.max(0, wallet.balance - paymentAmount);

          await db.update(walletsAccounts)
            .set({ balance: newBalance, updated_at: now })
            .where(eq(walletsAccounts.id, targetWalletId));

          const familyId = user.family_id || `fam-${user.id}`;
          await db.insert(transactions).values({
            id: `tx-bill-${Date.now()}`,
            wallet_id: targetWalletId,
            category_id: bill.category_id || null,
            user_id: user.id,
            family_id: familyId,
            merchant: `🧾 Fatura Ödemesi: ${bill.name}`,
            amount: paymentAmount,
            currency: 'TRY',
            transaction_date: todayISO,
            notes: `${bill.name} - ${currentMonthStr} dönemi faturası ödendi`,
            is_installment: 0,
            is_verified: 1,
            is_family_shared: 1,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            device_id: 'web-client'
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `✅ ${bill.name} faturası ${currentMonthStr} dönemi için ödendi işaretlendi!`
      });
    } else if (action === 'unmark_paid') {
      await db.update(recurringBills)
        .set({
          last_paid_month: null,
          last_paid_date: null,
          updated_at: now
        })
        .where(eq(recurringBills.id, id));

      return NextResponse.json({
        success: true,
        message: `🔄 ${bill.name} ödeme durumu sıfırlandı.`
      });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    console.error('Recurring bills PATCH error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const { searchParams } = new URL(req.url, 'http://localhost');
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Fatura ID zorunludur.' }, { status: 400 });

    await db.delete(recurringBills).where(eq(recurringBills.id, id));

    return NextResponse.json({ success: true, message: 'Fatura/Abonelik kaydı silindi.' });
  } catch (error: any) {
    console.error('Recurring bills DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
