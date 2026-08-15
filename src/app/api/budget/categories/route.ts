import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db, initDatabase } from '@/db';
import { categories } from '@/db/schema';
import { eq , or , and } from 'drizzle-orm';

import { walletsAccounts } from '@/db/schema';

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();
    const { id, name, type, monthly_budget_limit, group_50_30_20, icon, color } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Kategori adı zorunludur.' }, { status: 400 });
    }

    const targetLimit = Number(monthly_budget_limit) || 0;

    // 1. Maksimum Bütçe Tavanı Kontrolü (Aylık Toplam Gelir + Kredi Kartı Limitleri Toplamı)
    const accounts = db.select().from(walletsAccounts).where(eq(walletsAccounts.is_active, 1)).all();
    let totalCreditCardLimits = 0;
    for (const acc of accounts) {
      if (acc.type === 'credit_card') {
        totalCreditCardLimits += (acc.credit_limit || 0);
      }
    }

    // Sabit / Tahmini Aylık Gelir Toplamı (Maaş + Kira Geliri + Diğer)
    // Varsayılan hesaplanan gelir 94.000 TL
    const defaultIncome = 94000;
    const maxAllowedCap = defaultIncome + totalCreditCardLimits;

    const allCategories = db.select().from(categories).all();
    let currentTotalLimitExceptTarget = 0;

    for (const cat of allCategories) {
      if (cat.type !== 'income' && cat.id !== id) {
        currentTotalLimitExceptTarget += (cat.monthly_budget_limit || 0);
      }
    }

    const proposedTotalLimit = currentTotalLimitExceptTarget + targetLimit;

    if (proposedTotalLimit > maxAllowedCap) {
      return NextResponse.json({
        success: false,
        error: `Bütçe Tavanı Sınırı Aşıldı! Tüm kategorilerin bütçe limitleri toplamı (${proposedTotalLimit.toLocaleString('tr-TR')} ₺), Aylık Gelir + Kredi Kartı Limitleri Toplamı tavanını (${maxAllowedCap.toLocaleString('tr-TR')} ₺) aşamaz.`
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (id) {
      // Güncelle
      db.update(categories)
        .set({
          name: name.trim(),
          type: type || 'expense',
          monthly_budget_limit: targetLimit,
          group_50_30_20: group_50_30_20 || 'needs',
          icon: icon || '🏷️',
          color: color || '#10B981',
          updated_at: now
        })
        .where(eq(categories.id, id))
        .run();

      return NextResponse.json({ success: true, message: 'Kategori ve bütçe limiti güncellendi!' });
    } else {
      // Yeni Ekle
      const newId = `cat-${Date.now()}`;
      db.insert(categories).values({
        id: newId,
        name: name.trim(),
        type: type || 'expense',
        monthly_budget_limit: targetLimit,
        group_50_30_20: group_50_30_20 || 'needs',
        icon: icon || '🏷️',
        color: color || '#10B981',
        created_at: now,
        updated_at: now
      }).run();

      return NextResponse.json({ success: true, message: 'Yeni kategori başarıyla eklendi!' });
    }
  } catch (error: any) {
    console.error('Categories API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Kategori ID zorunludur.' }, { status: 400 });
    }

    db.delete(categories).where(eq(categories.id, id)).run();

    return NextResponse.json({ success: true, message: 'Kategori başarıyla silindi.' });
  } catch (error: any) {
    console.error('Delete Category API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
