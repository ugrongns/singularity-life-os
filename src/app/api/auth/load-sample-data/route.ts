import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { getAuthUser } from '@/lib/auth';
import {
  walletsAccounts,
  transactions,
  categories,
  books,
  bookQuotes,
  userReadingProfile,
  vehicles,
  realEstateProperties,
  userHealthProfile,
  waterIntakeLogs
} from '@/db/schema';
import { eq , or } from 'drizzle-orm';

export async function POST() {
  try {
    initDatabase();
    const user = await getAuthUser();

    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı. Lütfen giriş yapın.' }, { status: 401 });
    }

    const userId = user.id;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Örnek Cüzdanlar
    const wallet1Id = `w-sample-1-${Date.now()}`;
    const wallet2Id = `w-sample-2-${Date.now()}`;

    await db.insert(walletsAccounts).values({
      id: wallet1Id,
      name: 'Vadesiz Maaş Hesabı',
      type: 'bank',
      currency: 'TRY',
      balance: 45000,
      color: '#3B82F6',
      is_active: 1,
      created_at: now,
      updated_at: now,
      user_id: userId
    });

    await db.insert(walletsAccounts).values({
      id: wallet2Id,
      name: 'Bonus Kredi Kartı',
      type: 'credit_card',
      currency: 'TRY',
      balance: -12500,
      credit_limit: 50000,
      cutoff_day: 15,
      due_day: 25,
      color: '#EF4444',
      is_active: 1,
      created_at: now,
      updated_at: now,
      user_id: userId
    });

    // 2. Örnek Kategori Bütçeleri
    const cat1Id = `cat-market`;
    const cat2Id = `cat-kira`;
    const cat3Id = `cat-arac`;

    try {
      await db.update(categories).set({ monthly_budget_limit: 15000 }).where(eq(categories.id, cat1Id));
      await db.update(categories).set({ monthly_budget_limit: 20000 }).where(eq(categories.id, cat2Id));
      await db.update(categories).set({ monthly_budget_limit: 7500 }).where(eq(categories.id, cat3Id));
    } catch (e) {}

    // 3. Örnek İşlemler
    await db.insert(transactions).values({
      id: `tx-sample-1-${Date.now()}`,
      wallet_id: wallet1Id,
      category_id: 'cat-maas',
      merchant: 'Maaş Ödemesi',
      amount: 65000,
      currency: 'TRY',
      transaction_date: today,
      notes: 'Aylık net şirket maaşı',
      is_installment: 0,
      is_verified: 1,
      created_at: now,
      updated_at: now,
      user_id: userId
    });

    await db.insert(transactions).values({
      id: `tx-sample-2-${Date.now()}`,
      wallet_id: wallet2Id,
      category_id: cat1Id,
      merchant: 'Migros Süpermarket',
      amount: 1450,
      currency: 'TRY',
      transaction_date: today,
      notes: 'Haftalık gıda alışverişi',
      is_installment: 0,
      is_verified: 1,
      created_at: now,
      updated_at: now,
      user_id: userId
    });

    // 4. Örnek Kitap & Alıntı
    const bookId = `book-sample-${Date.now()}`;
    await db.insert(books).values({
      id: bookId,
      title: 'Atomik Alışkanlıklar',
      author: 'James Clear',
      publisher: 'Pegasus Yayınları',
      total_pages: 320,
      current_page: 140,
      status: 'reading',
      format: 'physical',
      shelf_location: 'Salon Kitaplığı',
      words_per_page: 250,
      rating: 5,
      category: 'Kişisel Gelişim',
      start_date: today,
      is_family_shared: 1,
      created_at: now,
      updated_at: now,
      user_id: userId
    });

    await db.insert(bookQuotes).values({
      id: `quote-sample-1-${Date.now()}`,
      book_id: bookId,
      page_number: 74,
      quote_text: 'Hedeflerinizin seviyesine yükselmezsiniz, sistemlerinizin seviyesine düşersiniz.',
      reflection_note: 'Günlük rutinleri ve sistemleri kurmak sonuca odaklanmaktan 10x daha önemlidir.',
      is_favorite: 1,
      created_at: now,
      updated_at: now,
      user_id: userId
    });

    await db.insert(userReadingProfile).values({
      id: `prof-sample-${Date.now()}`,
      yearly_target_books: 24,
      calibrated_avg_wpm: 233,
      avg_seconds_per_page: 72,
      created_at: now,
      updated_at: now,
      user_id: userId
    });

    // 5. Örnek Gayrimenkul
    await db.insert(realEstateProperties).values({
      id: `prop-sample-${Date.now()}`,
      title: 'Kadıköy Moda 2+1 Daire',
      address: 'Moda Cad. Kadıköy / İstanbul',
      property_type: 'residential',
      purchase_price: 3500000,
      estimated_market_value: 6500000,
      currency: 'TRY',
      monthly_rent_income: 32000,
      tenant_name: 'Ahmet Yılmaz',
      tenant_phone: '0532 111 22 33',
      rent_due_day: 5,
      lease_start_date: '2025-01-01',
      is_occupied: 1,
      created_at: now,
      updated_at: now,
      user_id: userId
    });

    // 6. Örnek Sağlık & Su Profili
    await db.insert(userHealthProfile).values({
      id: `hp-sample-${Date.now()}`,
      daily_calorie_target: 2200,
      target_protein_g: 140,
      target_carbs_g: 180,
      target_fat_g: 65,
      daily_water_target_ml: 2500,
      consumed_water_ml: 1750,
      active_fasting_protocol: '16:8',
      created_at: now,
      updated_at: now,
      user_id: userId
    });

    return NextResponse.json({
      success: true,
      message: '🚀 Örnek demo veriler (Cüzdan, Harcama, Kitap, Alıntı, Mülk) hesabınıza başarıyla yüklendi!'
    });
  } catch (error: any) {
    console.error('Load Sample Data Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
