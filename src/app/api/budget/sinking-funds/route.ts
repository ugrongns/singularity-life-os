import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { sinkingFunds, walletsAccounts, transactions } from '@/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { getTodayTurkeyDate } from '@/lib/date-utils';
import { ensureFamilyCategories } from '@/lib/budget-categories';

function getVisibleFundsCondition(userId: string, familyId: string) {
  return or(
    eq(sinkingFunds.user_id, userId),
    and(eq(sinkingFunds.family_id, familyId), eq(sinkingFunds.is_family_shared, 1))
  );
}

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const familyId = user.family_id || `fam-${user.id}`;
    const rows = await db
      .select()
      .from(sinkingFunds)
      .where(getVisibleFundsCondition(user.id, familyId))
      .orderBy(desc(sinkingFunds.created_at));

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Sinking Funds GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const body = await req.json();
    const { action = 'create' } = body;
    const now = new Date().toISOString();
    const todayTr = getTodayTurkeyDate();
    const familyId = user.family_id || `fam-${user.id}`;

    if (action === 'create') {
      const cleanName = typeof body.name === 'string' ? body.name.trim() : '';
      const targetAmount = Number(body.target_amount);
      const currentAmount = Math.max(0, Number(body.current_amount || 0));

      if (!cleanName) {
        return NextResponse.json({ success: false, error: 'Hedef adı zorunludur.' }, { status: 400 });
      }
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        return NextResponse.json({ success: false, error: 'Hedef tutar 0’dan büyük olmalıdır.' }, { status: 400 });
      }

      const id = `sf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(sinkingFunds).values({
        id,
        name: cleanName,
        target_amount: targetAmount,
        current_amount: currentAmount,
        target_date: body.target_date || null,
        icon: body.icon || '🎯',
        color: body.color || '#10B981',
        is_family_shared: body.is_family_shared === 0 ? 0 : 1,
        user_id: user.id,
        family_id: familyId,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
        device_id: 'web-client'
      });

      return NextResponse.json({
        success: true,
        message: `🎯 "${cleanName}" birikim hedefi oluşturuldu!`
      });
    }

    const fundId = body.id;
    if (!fundId || typeof fundId !== 'string') {
      return NextResponse.json({ success: false, error: 'Hedef ID gereklidir.' }, { status: 400 });
    }

    const targetFund = (
      await db
        .select()
        .from(sinkingFunds)
        .where(and(eq(sinkingFunds.id, fundId), getVisibleFundsCondition(user.id, familyId)))
        .limit(1)
    )[0];

    if (!targetFund) {
      return NextResponse.json({ success: false, error: 'Birikim hedefi bulunamadı veya yetkiniz yok.' }, { status: 404 });
    }

    if (action === 'contribute') {
      const delta = Number(body.amount);
      if (!Number.isFinite(delta) || delta === 0) {
        return NextResponse.json({ success: false, error: 'Geçerli bir katkı tutarı giriniz.' }, { status: 400 });
      }

      const nextAmount = Math.max(0, Math.round(((targetFund.current_amount || 0) + delta) * 100) / 100);
      const walletId = typeof body.wallet_id === 'string' && body.wallet_id.trim() ? body.wallet_id.trim() : null;

      // İsteğe bağlı: Cüzdandan gerçek para düşümü / işlem kaydı
      if (walletId) {
        const wallet = (
          await db
            .select()
            .from(walletsAccounts)
            .where(
              and(
                eq(walletsAccounts.id, walletId),
                eq(walletsAccounts.family_id, familyId),
                or(eq(walletsAccounts.user_id, user.id), eq(walletsAccounts.is_family_shared, 1))
              )
            )
            .limit(1)
        )[0];

        if (!wallet) {
          return NextResponse.json({ success: false, error: 'Seçilen cüzdana erişim yetkiniz yok.' }, { status: 403 });
        }

        const newBalance = Math.round(((wallet.balance || 0) - delta) * 100) / 100;
        await db
          .update(walletsAccounts)
          .set({ balance: newBalance, updated_at: now })
          .where(eq(walletsAccounts.id, wallet.id));

        const famCats = await ensureFamilyCategories(familyId);
        const defaultCat = famCats.find((c: any) => c.type !== 'income') || famCats[0];

        await db.insert(transactions).values({
          id: `tx-sf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          wallet_id: wallet.id,
          category_id: defaultCat?.id || null,
          merchant: `🎯 Birikim: ${targetFund.name}`,
          amount: Math.abs(delta),
          currency: wallet.currency || 'TRY',
          transaction_date: todayTr,
          notes: delta > 0 ? `Birikim hedefine aktarım (${targetFund.name})` : `Birikim hedefinden iade (${targetFund.name})`,
          is_installment: 0,
          installment_number: 1,
          total_installments: 1,
          is_verified: 1,
          is_family_shared: targetFund.is_family_shared,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now,
          sync_status: 'synced',
          device_id: 'web-client'
        });
      }

      await db
        .update(sinkingFunds)
        .set({ current_amount: nextAmount, updated_at: now })
        .where(eq(sinkingFunds.id, targetFund.id));

      return NextResponse.json({
        success: true,
        message: walletId
          ? `✅ ${Math.abs(delta).toLocaleString('tr-TR')} ₺ "${targetFund.name}" hedefine aktarıldı ve cüzdandan düşüldü!`
          : `✅ "${targetFund.name}" hedefi güncellendi!`
      });
    }

    if (action === 'update') {
      const cleanName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : targetFund.name;
      const targetAmount = body.target_amount !== undefined ? Number(body.target_amount) : targetFund.target_amount;
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        return NextResponse.json({ success: false, error: 'Hedef tutar geçersiz.' }, { status: 400 });
      }
      await db
        .update(sinkingFunds)
        .set({
          name: cleanName,
          target_amount: targetAmount,
          target_date: body.target_date !== undefined ? body.target_date || null : targetFund.target_date,
          icon: body.icon || targetFund.icon,
          color: body.color || targetFund.color,
          is_family_shared: body.is_family_shared !== undefined ? (body.is_family_shared ? 1 : 0) : targetFund.is_family_shared,
          updated_at: now
        })
        .where(eq(sinkingFunds.id, targetFund.id));

      return NextResponse.json({ success: true, message: `✅ "${cleanName}" hedefi güncellendi.` });
    }

    if (action === 'delete') {
      if (targetFund.user_id && targetFund.user_id !== user.id && user.role !== 'admin' && user.is_master_account !== 1) {
        return NextResponse.json({ success: false, error: 'Bu hedefi silme yetkiniz yok.' }, { status: 403 });
      }
      await db.delete(sinkingFunds).where(eq(sinkingFunds.id, targetFund.id));
      return NextResponse.json({ success: true, message: '🗑️ Birikim hedefi silindi.' });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    console.error('Sinking Funds POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
