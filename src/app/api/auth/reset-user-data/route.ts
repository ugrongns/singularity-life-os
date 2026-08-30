import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { getAuthUser } from '@/lib/auth';
import {
  // Child tables
  readingSessions,
  bookQuotes,
  nutritionMealItems,
  workoutExerciseLogs,
  vehicleFuelLogs,
  vehicleMaintenanceRecords,
  vehicleLegalReminders,

  // Personal / Scoped tables
  books,
  nutritionMeals,
  fastingSessions,
  packagedFoodScans,
  dietMealOptions,
  workoutSessions,
  foodNutrientProfiles,
  waterIntakeLogs,
  smartScaleLogs,
  biometrics,
  sleepLogs,
  moodLogs,
  supplementRoutines,
  userHealthProfile,
  userReadingProfile,
  personalDebtsReceivables,

  // Shared Family tables
  vehicles,
  homeMaintenanceRecords,
  homeAppliances,
  digitalVaultItems,
  importantDates,
  petRecords,
  shoppingListItems,
  sinkingFunds,
  transactions,
  walletsAccounts
} from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();

    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const scope = body.scope || (user.role === 'admin' ? 'family' : 'personal'); // 'personal' | 'family'
    const userId = user.id;
    const familyId = user.family_id || `fam-${userId}`;
    const now = new Date().toISOString();

    // 1. KİŞİSEL VERİLERİN GÜVENLİ TEMİZLİĞİ (Tüm reset işlemlerinde o kullanıcının kişisel verileri temizlenir)
    
    // Kitaplar ve okuma seansları
    const userBooks = await db.select({ id: books.id }).from(books).where(eq(books.user_id, userId));
    const bookIds = userBooks.map((b: any) => b.id);
    if (bookIds.length > 0) {
      for (const bId of bookIds) {
        await db.delete(readingSessions).where(eq(readingSessions.book_id, bId));
        await db.delete(bookQuotes).where(eq(bookQuotes.book_id, bId));
      }
      await db.delete(books).where(eq(books.user_id, userId));
    }

    // Beslenme öğünleri ve alt kalemleri
    const userMeals = await db.select({ id: nutritionMeals.id }).from(nutritionMeals).where(eq(nutritionMeals.user_id, userId));
    const mealIds = userMeals.map((m: any) => m.id);
    if (mealIds.length > 0) {
      for (const mId of mealIds) {
        await db.delete(nutritionMealItems).where(eq(nutritionMealItems.meal_id, mId));
      }
      await db.delete(nutritionMeals).where(eq(nutritionMeals.user_id, userId));
    }

    // Sağlık, Spor & Wellness kayıtları
    await db.delete(workoutExerciseLogs).where(eq(workoutExerciseLogs.user_id, userId));
    await db.delete(workoutSessions).where(eq(workoutSessions.user_id, userId));
    await db.delete(fastingSessions).where(eq(fastingSessions.user_id, userId));
    await db.delete(packagedFoodScans).where(eq(packagedFoodScans.user_id, userId));
    await db.delete(foodNutrientProfiles).where(eq(foodNutrientProfiles.user_id, userId));
    await db.delete(waterIntakeLogs).where(eq(waterIntakeLogs.user_id, userId));
    await db.delete(smartScaleLogs).where(eq(smartScaleLogs.user_id, userId));
    await db.delete(biometrics).where(eq(biometrics.user_id, userId));
    await db.delete(sleepLogs).where(eq(sleepLogs.user_id, userId));
    await db.delete(moodLogs).where(eq(moodLogs.user_id, userId));
    await db.delete(supplementRoutines).where(eq(supplementRoutines.user_id, userId));
    await db.delete(personalDebtsReceivables).where(eq(personalDebtsReceivables.user_id, userId));
    await db.delete(userHealthProfile).where(eq(userHealthProfile.user_id, userId));
    await db.delete(userReadingProfile).where(eq(userReadingProfile.user_id, userId));

    // Kişisel profilleri sıfır değerlerle yeniden başlat
    try {
      await db.insert(userHealthProfile).values({
        id: `hp-${userId}`,
        user_id: userId,
        daily_water_target_ml: 2500,
        consumed_water_ml: 0,
        active_fasting_protocol: '16:8',
        created_at: now,
        updated_at: now
      });
    } catch (e) {}

    try {
      await db.insert(userReadingProfile).values({
        id: `rp-${userId}`,
        user_id: userId,
        yearly_target_books: 24,
        calibrated_avg_wpm: 220,
        avg_seconds_per_page: 84,
        created_at: now,
        updated_at: now
      });
    } catch (e) {}

    // 2. ORTAK AİLE VERİLERİNİN SIFIRLANMASI (Sadece Aile Admini ve scope === 'family' ise çalışır)
    if (scope === 'family' && user.role === 'admin') {
      // Bu ailenin araçları ve bakım kayıtları
      const familyVehicles = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.family_id, familyId));
      const vehicleIds = familyVehicles.map((v: any) => v.id);
      if (vehicleIds.length > 0) {
        for (const vId of vehicleIds) {
          await db.delete(vehicleFuelLogs).where(eq(vehicleFuelLogs.vehicle_id, vId));
          await db.delete(vehicleMaintenanceRecords).where(eq(vehicleMaintenanceRecords.vehicle_id, vId));
          await db.delete(vehicleLegalReminders).where(eq(vehicleLegalReminders.vehicle_id, vId));
        }
        await db.delete(vehicles).where(eq(vehicles.family_id, familyId));
      }

      // Ev operasyonları & Demirbaşlar
      await db.delete(homeMaintenanceRecords).where(eq(homeMaintenanceRecords.family_id, familyId));
      await db.delete(homeAppliances).where(eq(homeAppliances.family_id, familyId));

      // Ortak Kasa & Tarihler
      await db.delete(digitalVaultItems).where(eq(digitalVaultItems.family_id, familyId));
      await db.delete(importantDates).where(eq(importantDates.family_id, familyId));
      await db.delete(petRecords).where(eq(petRecords.family_id, familyId));

      // Market listesi & Kumbaralar
      await db.delete(shoppingListItems).where(eq(shoppingListItems.family_id, familyId));
      await db.delete(sinkingFunds).where(eq(sinkingFunds.family_id, familyId));

      // Bütçe işlemleri ve Cüzdanlar
      await db.delete(transactions).where(eq(transactions.family_id, familyId));
      await db.delete(walletsAccounts).where(eq(walletsAccounts.family_id, familyId));

      // Admin için varsayılan boş cüzdan aç
      try {
        await db.insert(walletsAccounts).values({
          id: `w-${userId}-main`,
          name: 'Vadesiz Maaş Hesabı',
          type: 'bank',
          currency: 'TRY',
          balance: 0,
          color: '#3B82F6',
          is_active: 1,
          is_family_shared: 1,
          user_id: userId,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: '🎉 Ailenize ait tüm veriler sıfırlandı. Diğer aileler kesinlikle etkilenmedi!'
      });
    }

    // Normal kullanıcı sadece kendi kişisel cüzdanlarını temizler
    await db.delete(walletsAccounts).where(and(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.is_family_shared, 0)));
    await db.delete(digitalVaultItems).where(and(eq(digitalVaultItems.user_id, userId), eq(digitalVaultItems.is_family_shared, 0)));

    return NextResponse.json({
      success: true,
      message: '🎉 Kişisel verileriniz (Sağlık, Kütüphane, Bireysel Kayıtlar) başarıyla sıfırlandı. Aile ortak havuzu korundu!'
    });
  } catch (error: any) {
    console.error('Reset User Data Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
