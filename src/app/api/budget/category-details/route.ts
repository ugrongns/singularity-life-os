import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { categories, transactions, walletsAccounts, familyMembers } from '@/db/schema';
import { eq, desc, sql, or, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url, 'http://localhost');
    const categoryId = searchParams.get('category_id');
    const monthParam = searchParams.get('month'); // YYYY-MM

    if (!categoryId) {
      return NextResponse.json({ success: false, error: 'Kategori ID zorunludur.' }, { status: 400 });
    }

    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);
    const currentMonthStr = monthParam || new Date().toISOString().slice(0, 7);

    // Kategori Detayı - Kullanıcının ailesine ait veya sistem/ortak kategori olmalı
    const category = (await db.select().from(categories).where(eq(categories.id, categoryId)))[0];
    if (!category) {
      return NextResponse.json({ success: false, error: 'Kategori bulunamadı.' }, { status: 404 });
    }

    if (category.family_id && familyId && category.family_id !== familyId) {
      return NextResponse.json({ success: false, error: 'Bu kategoriye erişim yetkiniz yok.' }, { status: 403 });
    }

    // Hesap isimlerini ve tiplerini haritalamak için (BOLA Koruması)
    const wallets = familyId
      ? await db.select().from(walletsAccounts).where(
          and(
            eq(walletsAccounts.family_id, familyId),
            or(eq(walletsAccounts.user_id, user.id), eq(walletsAccounts.is_family_shared, 1), sql`${walletsAccounts.user_id} IS NULL`)
          )
        )
      : await db.select().from(walletsAccounts).where(eq(walletsAccounts.user_id, user.id));

    const walletMap = new Map((wallets).map((w: any) => [w.id, {
      name: w.name,
      type: w.type,
      color: w.color || '#111827'
    }]));

    // Aile üyelerini haritalamak için (member_id -> name, avatar, role)
    const members = familyId
      ? await db.select().from(familyMembers).where(eq(familyMembers.family_id, familyId))
      : await db.select().from(familyMembers).where(eq(familyMembers.user_id, user.id));

    const memberMap = new Map((members).map((m: any) => [m.id, {
      name: m.name,
      avatar: m.avatar || '👤',
      role: m.role || 'Üye'
    }]));

    // Bu kategoriye, seçili aya ve yalnızca bu aileye/kullanıcıya ait işlemler (BOLA Koruması)
    const familyTxFilter = familyId
      ? and(
          eq(transactions.family_id, familyId),
          or(eq(transactions.user_id, user.id), eq(transactions.is_family_shared, 1))
        )
      : eq(transactions.user_id, user.id);

    const txList = await db.select()
      .from(transactions)
      .where(
        and(
          eq(transactions.category_id, categoryId),
          sql`substr(${transactions.transaction_date}, 1, 7) = ${currentMonthStr}`,
          familyTxFilter
        )
      )
      .orderBy(desc(transactions.transaction_date), desc(transactions.created_at));

    const formattedTxList = (txList).map((tx: any) => {
      const walletObj = walletMap.get(tx.wallet_id);
      const memberObj = tx.member_id ? memberMap.get(tx.member_id) : null;
      return {
        ...tx,
        wallet_name: walletObj ? walletObj.name : 'Bilinmeyen Hesap',
        wallet_type: walletObj ? walletObj.type : 'cash',
        wallet_color: walletObj ? walletObj.color : '#111827',
        member_name: memberObj ? memberObj.name : null,
        member_avatar: memberObj ? memberObj.avatar : null,
        member_role: memberObj ? memberObj.role : null
      };
    });

    const totalSpent = (txList).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
    const txCount = txList.length;
    const averageSpent = txCount > 0 ? Math.round(totalSpent / txCount) : 0;
    const limit = category.monthly_budget_limit || 0;
    const remainingBudget = limit > 0 ? limit - totalSpent : null;
    const budgetPercentage = limit > 0 ? Math.round((totalSpent / limit) * 100) : 0;

    // Ay sonu projeksiyonu için gün hesaplama
    const [yearNum, monthNum] = currentMonthStr.split('-').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth1Based = now.getMonth() + 1;
    const isCurrentMonth = yearNum === currentYear && monthNum === currentMonth1Based;
    
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const currentDay = isCurrentMonth ? now.getDate() : daysInMonth;
    const daysRemaining = isCurrentMonth ? Math.max(1, daysInMonth - currentDay + 1) : 0;
    const dailyAllowance = (limit > 0 && remainingBudget !== null && remainingBudget > 0 && daysRemaining > 0)
      ? Math.round(remainingBudget / daysRemaining)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        category,
        monthStr: currentMonthStr,
        totalSpent,
        txCount,
        averageSpent,
        monthlyBudgetLimit: limit,
        remainingBudget,
        budgetPercentage,
        daysRemaining,
        daysInMonth,
        isCurrentMonth,
        dailyAllowance,
        transactions: formattedTxList
      }
    });
  } catch (error: any) {
    console.error('Category Details API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
