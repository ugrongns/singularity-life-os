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
  supplementIntakeLogs,
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
  walletsAccounts,
  recurringBills
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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

    await db.transaction(async (tx) => {
      // 1. KİŞİSEL VERİLERİN GÜVENLİ TEMİZLİĞİ (Tüm reset işlemlerinde o kullanıcının kişisel verileri temizlenir)
      
      // Kitaplar ve okuma seansları
      const userBooks = await tx.select({ id: books.id }).from(books).where(eq(books.user_id, userId));
      for (const b of userBooks) {
        await tx.delete(readingSessions).where(eq(readingSessions.book_id, b.id));
        await tx.delete(bookQuotes).where(eq(bookQuotes.book_id, b.id));
      }
      await tx.delete(books).where(eq(books.user_id, userId));
      await tx.delete(userReadingProfile).where(eq(userReadingProfile.user_id, userId));

      // Beslenme öğünleri ve alt kalemleri
      const userMeals = await tx.select({ id: nutritionMeals.id }).from(nutritionMeals).where(eq(nutritionMeals.user_id, userId));
      for (const m of userMeals) {
        await tx.delete(nutritionMealItems).where(eq(nutritionMealItems.meal_id, m.id));
      }
      await tx.delete(nutritionMeals).where(eq(nutritionMeals.user_id, userId));

      // Sağlık, Spor & Wellness kayıtları
      await tx.delete(workoutExerciseLogs).where(eq(workoutExerciseLogs.user_id, userId));
      await tx.delete(workoutSessions).where(eq(workoutSessions.user_id, userId));
      await tx.delete(fastingSessions).where(eq(fastingSessions.user_id, userId));
      await tx.delete(packagedFoodScans).where(eq(packagedFoodScans.user_id, userId));
      await tx.delete(foodNutrientProfiles).where(eq(foodNutrientProfiles.user_id, userId));
      await tx.delete(waterIntakeLogs).where(eq(waterIntakeLogs.user_id, userId));
      await tx.delete(smartScaleLogs).where(eq(smartScaleLogs.user_id, userId));
      await tx.delete(biometrics).where(eq(biometrics.user_id, userId));
      await tx.delete(sleepLogs).where(eq(sleepLogs.user_id, userId));
      await tx.delete(moodLogs).where(eq(moodLogs.user_id, userId));
      
      // Rutinler silinmeden önce FK bağımlı intake loglarını temizle
      await tx.delete(supplementIntakeLogs).where(eq(supplementIntakeLogs.user_id, userId));
      await tx.delete(supplementRoutines).where(eq(supplementRoutines.user_id, userId));
      
      await tx.delete(personalDebtsReceivables).where(eq(personalDebtsReceivables.user_id, userId));
      await tx.delete(userHealthProfile).where(eq(userHealthProfile.user_id, userId));

      // Kişisel profilleri sıfır değerlerle yeniden başlat
      try {
        await tx.insert(userHealthProfile).values({
          id: `hp-${userId}`,
          user_id: userId,
          family_id: familyId,
          daily_water_target_ml: 2500,
          consumed_water_ml: 0,
          active_fasting_protocol: '16:8',
          created_at: now,
          updated_at: now
        });
      } catch (e) {}

      try {
        await tx.insert(userReadingProfile).values({
          id: `rp-${userId}`,
          user_id: userId,
          family_id: familyId,
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
        const familyVehicles = await tx.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.family_id, familyId));
        for (const v of familyVehicles) {
          await tx.delete(vehicleFuelLogs).where(eq(vehicleFuelLogs.vehicle_id, v.id));
          await tx.delete(vehicleMaintenanceRecords).where(eq(vehicleMaintenanceRecords.vehicle_id, v.id));
          await tx.delete(vehicleLegalReminders).where(eq(vehicleLegalReminders.vehicle_id, v.id));
        }
        await tx.delete(vehicles).where(eq(vehicles.family_id, familyId));

        // Ev operasyonları & Demirbaşlar
        await tx.delete(homeMaintenanceRecords).where(eq(homeMaintenanceRecords.family_id, familyId));
        await tx.delete(homeAppliances).where(eq(homeAppliances.family_id, familyId));

        // Ortak Kasa & Tarihler
        await tx.delete(digitalVaultItems).where(eq(digitalVaultItems.family_id, familyId));
        await tx.delete(importantDates).where(eq(importantDates.family_id, familyId));
        await tx.delete(petRecords).where(eq(petRecords.family_id, familyId));

        // Market listesi & Kumbaralar
        await tx.delete(shoppingListItems).where(eq(shoppingListItems.family_id, familyId));
        await tx.delete(sinkingFunds).where(eq(sinkingFunds.family_id, familyId));

        // Bütçe işlemleri, Periyodik Faturalar ve Cüzdanlar (Önce transactions, sonra cüzdanlar)
        await tx.delete(transactions).where(eq(transactions.family_id, familyId));
        await tx.delete(recurringBills).where(eq(recurringBills.family_id, familyId));
        await tx.delete(walletsAccounts).where(eq(walletsAccounts.family_id, familyId));

        // Admin için varsayılan boş cüzdan aç
        try {
          await tx.insert(walletsAccounts).values({
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
      } else {
        // Normal kullanıcı sadece kendi kişisel işlemlerini, faturalarını ve cüzdanlarını temizler
        await tx.delete(transactions).where(eq(transactions.user_id, userId));
        await tx.delete(recurringBills).where(eq(recurringBills.user_id, userId));
        await tx.delete(walletsAccounts).where(and(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.is_family_shared, 0)));
        await tx.delete(digitalVaultItems).where(and(eq(digitalVaultItems.user_id, userId), eq(digitalVaultItems.is_family_shared, 0)));
      }
    });

    if (scope === 'family' && user.role === 'admin') {
      return NextResponse.json({
        success: true,
        message: '🎉 Ailenize ait tüm veriler güvenli bir transaction ile sıfırlandı. Diğer aileler kesinlikle etkilenmedi!'
      });
    }

    return NextResponse.json({
      success: true,
      message: '🎉 Kişisel verileriniz (Sağlık, Kütüphane, Bireysel Kayıtlar) başarıyla sıfırlandı. Aile ortak havuzu korundu!'
    });
  } catch (error: any) {
    console.error('Reset User Data Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
