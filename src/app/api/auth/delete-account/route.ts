import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { getAuthUser, verifyPassword } from '@/lib/auth';
import {
  users,
  authSessions,
  familyMembers,
  familyInvites,
  walletsAccounts,
  transactions,
  categories,
  sinkingFunds,
  personalDebtsReceivables,
  books,
  readingSessions,
  bookQuotes,
  userReadingProfile,
  vehicles,
  vehicleMaintenanceRecords,
  vehicleFuelLogs,
  vehicleLegalReminders,
  userHealthProfile,
  nutritionMeals,
  nutritionMealItems,
  fastingSessions,
  waterIntakeLogs,
  supplementRoutines,
  sleepLogs,
  moodLogs,
  biometrics,
  smartScaleLogs,
  workoutSessions,
  workoutExerciseLogs,
  dietMealOptions,
  packagedFoodScans,
  foodNutrientProfiles,
  digitalVaultItems,
  importantDates,
  petRecords,
  homeMaintenanceRecords,
  homeAppliances,
  shoppingListItems
} from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();

    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { password } = body;

    if (!password) {
      return NextResponse.json({ success: false, error: 'Hesabınızı silmek için mevcut master parolanızı girmelisiniz.' }, { status: 400 });
    }

    // Parola doğrulaması
    const isPasswordValid = verifyPassword(password, user.password_hash, user.password_salt);
    if (!isPasswordValid) {
      return NextResponse.json({ success: false, error: 'Girdiğiniz master parola hatalı. Hesap silinemedi.' }, { status: 403 });
    }

    const userId = user.id;
    const familyId = user.family_id || `fam-${userId}`;
    const isMasterAdmin = user.role === 'admin';

    // 1. Kütüphane & İkinci Beyin
    const userBooks = await db.select({ id: books.id }).from(books).where(eq(books.user_id, userId));
    for (const b of userBooks) {
      await db.delete(readingSessions).where(eq(readingSessions.book_id, b.id));
      await db.delete(bookQuotes).where(eq(bookQuotes.book_id, b.id));
    }
    await db.delete(books).where(eq(books.user_id, userId));
    await db.delete(userReadingProfile).where(eq(userReadingProfile.user_id, userId));

    // 2. Beslenme, Sağlık & Spor
    const userMeals = await db.select({ id: nutritionMeals.id }).from(nutritionMeals).where(eq(nutritionMeals.user_id, userId));
    for (const m of userMeals) {
      await db.delete(nutritionMealItems).where(eq(nutritionMealItems.meal_id, m.id));
    }
    await db.delete(nutritionMeals).where(eq(nutritionMeals.user_id, userId));
    await db.delete(workoutExerciseLogs).where(eq(workoutExerciseLogs.user_id, userId));
    await db.delete(workoutSessions).where(eq(workoutSessions.user_id, userId));
    await db.delete(fastingSessions).where(eq(fastingSessions.user_id, userId));
    await db.delete(packagedFoodScans).where(eq(packagedFoodScans.user_id, userId));
    await db.delete(foodNutrientProfiles).where(eq(foodNutrientProfiles.user_id, userId));
    await db.delete(dietMealOptions).where(eq(dietMealOptions.user_id, userId));
    await db.delete(waterIntakeLogs).where(eq(waterIntakeLogs.user_id, userId));
    await db.delete(smartScaleLogs).where(eq(smartScaleLogs.user_id, userId));
    await db.delete(biometrics).where(eq(biometrics.user_id, userId));
    await db.delete(userHealthProfile).where(eq(userHealthProfile.user_id, userId));

    // 3. Uyku, Ruh Hali & Rutinler
    await db.delete(sleepLogs).where(eq(sleepLogs.user_id, userId));
    await db.delete(moodLogs).where(eq(moodLogs.user_id, userId));
    await db.delete(supplementRoutines).where(eq(supplementRoutines.user_id, userId));

    // 4. Finans, Cüzdanlar & Borçlar
    await db.delete(personalDebtsReceivables).where(eq(personalDebtsReceivables.user_id, userId));
    await db.delete(transactions).where(eq(transactions.user_id, userId));
    await db.delete(walletsAccounts).where(eq(walletsAccounts.user_id, userId));
    await db.delete(sinkingFunds).where(eq(sinkingFunds.user_id, userId));

    // 5. Araç & Ev Operasyonları (Eğer aile admini ise ailesine ait kayıtları da temizle)
    const userVehicles = await db.select({ id: vehicles.id }).from(vehicles).where(
      isMasterAdmin ? or(eq(vehicles.user_id, userId), eq(vehicles.family_id, familyId)) : eq(vehicles.user_id, userId)
    );
    for (const v of userVehicles) {
      await db.delete(vehicleFuelLogs).where(eq(vehicleFuelLogs.vehicle_id, v.id));
      await db.delete(vehicleMaintenanceRecords).where(eq(vehicleMaintenanceRecords.vehicle_id, v.id));
      await db.delete(vehicleLegalReminders).where(eq(vehicleLegalReminders.vehicle_id, v.id));
    }
    await db.delete(vehicles).where(isMasterAdmin ? or(eq(vehicles.user_id, userId), eq(vehicles.family_id, familyId)) : eq(vehicles.user_id, userId));
    
    if (isMasterAdmin) {
      await db.delete(homeMaintenanceRecords).where(eq(homeMaintenanceRecords.family_id, familyId));
      await db.delete(homeAppliances).where(eq(homeAppliances.family_id, familyId));
      await db.delete(shoppingListItems).where(eq(shoppingListItems.family_id, familyId));
      await db.delete(digitalVaultItems).where(eq(digitalVaultItems.family_id, familyId));
      await db.delete(importantDates).where(eq(importantDates.family_id, familyId));
      await db.delete(petRecords).where(eq(petRecords.family_id, familyId));
      await db.delete(familyInvites).where(eq(familyInvites.family_id, familyId));
      await db.delete(familyMembers).where(eq(familyMembers.family_id, familyId));
    } else {
      await db.delete(digitalVaultItems).where(eq(digitalVaultItems.user_id, userId));
      await db.delete(familyMembers).where(eq(familyMembers.user_id, userId));
    }

    // 6. Oturumlar ve Kullanıcı Hesabı
    await db.delete(authSessions).where(eq(authSessions.user_id, userId));
    await db.delete(users).where(eq(users.id, userId));

    // 7. Cookie temizleme
    const cookieStore = await cookies();
    cookieStore.delete('singularity_session');

    return NextResponse.json({
      success: true,
      message: '✅ Hesabınız ve tüm verileriniz kalıcı olarak silindi. Singularity OS deneyiminiz için teşekkür ederiz.'
    });
  } catch (error: any) {
    console.error('Delete Account Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
