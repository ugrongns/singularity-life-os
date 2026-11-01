import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { getAuthUser, verifyPassword, clearAuthSessionCache } from '@/lib/auth';
import {
  users,
  authSessions,
  families,
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
  supplementIntakeLogs,
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
  shoppingListItems,
  recurringBills,
  appSettings
} from '@/db/schema';
import { eq, or, like } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser({ includeSecrets: true });

    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { password } = body;

    if (!password) {
      return NextResponse.json({ success: false, error: 'Hesabınızı silmek için mevcut master parolanızı girmelisiniz.' }, { status: 400 });
    }

    // Parola doğrulaması (asenkron, event-loop dostu)
    const isPasswordValid = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!isPasswordValid) {
      return NextResponse.json({ success: false, error: 'Girdiğiniz master parola hatalı. Hesap silinemedi.' }, { status: 403 });
    }

    const userId = user.id;
    const familyId = user.family_id || `fam-${userId}`;
    const isMasterAdmin = user.role === 'admin';

    // Tüm silme işlemlerini atomik transaction içerisinde gerçekleştir
    await db.transaction(async (tx) => {
      // 1. Kütüphane & İkinci Beyin
      const userBooks = await tx.select({ id: books.id }).from(books).where(eq(books.user_id, userId));
      for (const b of userBooks) {
        await tx.delete(readingSessions).where(eq(readingSessions.book_id, b.id));
        await tx.delete(bookQuotes).where(eq(bookQuotes.book_id, b.id));
      }
      await tx.delete(books).where(eq(books.user_id, userId));
      await tx.delete(userReadingProfile).where(eq(userReadingProfile.user_id, userId));

      // 2. Beslenme, Sağlık & Spor
      const userMeals = await tx.select({ id: nutritionMeals.id }).from(nutritionMeals).where(eq(nutritionMeals.user_id, userId));
      for (const m of userMeals) {
        await tx.delete(nutritionMealItems).where(eq(nutritionMealItems.meal_id, m.id));
      }
      await tx.delete(nutritionMeals).where(eq(nutritionMeals.user_id, userId));
      await tx.delete(workoutExerciseLogs).where(eq(workoutExerciseLogs.user_id, userId));
      await tx.delete(workoutSessions).where(eq(workoutSessions.user_id, userId));
      await tx.delete(fastingSessions).where(eq(fastingSessions.user_id, userId));
      await tx.delete(packagedFoodScans).where(eq(packagedFoodScans.user_id, userId));
      await tx.delete(foodNutrientProfiles).where(eq(foodNutrientProfiles.user_id, userId));
      await tx.delete(waterIntakeLogs).where(eq(waterIntakeLogs.user_id, userId));
      await tx.delete(smartScaleLogs).where(eq(smartScaleLogs.user_id, userId));
      await tx.delete(biometrics).where(eq(biometrics.user_id, userId));
      await tx.delete(userHealthProfile).where(eq(userHealthProfile.user_id, userId));

      // 3. Uyku, Ruh Hali & Rutinler (FK sırasına göre: önce loglar, sonra rutinler)
      await tx.delete(sleepLogs).where(eq(sleepLogs.user_id, userId));
      await tx.delete(moodLogs).where(eq(moodLogs.user_id, userId));
      await tx.delete(supplementIntakeLogs).where(eq(supplementIntakeLogs.user_id, userId));
      await tx.delete(supplementRoutines).where(eq(supplementRoutines.user_id, userId));

      // 4. Finans, Cüzdanlar, Faturalar & Borçlar (Önce transactions, sonra wallets)
      await tx.delete(personalDebtsReceivables).where(eq(personalDebtsReceivables.user_id, userId));
      await tx.delete(transactions).where(eq(transactions.user_id, userId));
      await tx.delete(recurringBills).where(
        isMasterAdmin ? or(eq(recurringBills.user_id, userId), eq(recurringBills.family_id, familyId)) : eq(recurringBills.user_id, userId)
      );
      await tx.delete(walletsAccounts).where(
        isMasterAdmin ? or(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.family_id, familyId)) : eq(walletsAccounts.user_id, userId)
      );

      // 5. Araç & Ev Operasyonları (Eğer aile admini ise ailesine ait kayıtları da temizle)
      const userVehicles = await tx.select({ id: vehicles.id }).from(vehicles).where(
        isMasterAdmin ? or(eq(vehicles.user_id, userId), eq(vehicles.family_id, familyId)) : eq(vehicles.user_id, userId)
      );
      for (const v of userVehicles) {
        await tx.delete(vehicleFuelLogs).where(eq(vehicleFuelLogs.vehicle_id, v.id));
        await tx.delete(vehicleMaintenanceRecords).where(eq(vehicleMaintenanceRecords.vehicle_id, v.id));
        await tx.delete(vehicleLegalReminders).where(eq(vehicleLegalReminders.vehicle_id, v.id));
      }
      await tx.delete(vehicles).where(isMasterAdmin ? or(eq(vehicles.user_id, userId), eq(vehicles.family_id, familyId)) : eq(vehicles.user_id, userId));
      
      if (isMasterAdmin) {
        await tx.delete(sinkingFunds).where(eq(sinkingFunds.family_id, familyId));
        await tx.delete(homeMaintenanceRecords).where(eq(homeMaintenanceRecords.family_id, familyId));
        await tx.delete(homeAppliances).where(eq(homeAppliances.family_id, familyId));
        await tx.delete(shoppingListItems).where(eq(shoppingListItems.family_id, familyId));
        await tx.delete(digitalVaultItems).where(eq(digitalVaultItems.family_id, familyId));
        await tx.delete(importantDates).where(eq(importantDates.family_id, familyId));
        await tx.delete(petRecords).where(eq(petRecords.family_id, familyId));
        await tx.delete(familyInvites).where(eq(familyInvites.family_id, familyId));
        await tx.delete(familyMembers).where(eq(familyMembers.family_id, familyId));
      } else {
        await tx.delete(digitalVaultItems).where(eq(digitalVaultItems.user_id, userId));
        await tx.delete(familyMembers).where(eq(familyMembers.user_id, userId));
      }

      // 6. Oturumlar ve Kullanıcı Hesabı
      await tx.delete(authSessions).where(eq(authSessions.user_id, userId));
      await tx.delete(users).where(eq(users.id, userId));

      // Master admin hesabını silerken haneyi de tamamen temizle
      if (isMasterAdmin) {
        await tx.delete(families).where(eq(families.id, familyId));
        await tx.delete(appSettings).where(like(appSettings.key, 'telegram_%'));
      }
    });

    // 7. Cookie ve oturum önbelleğini temizle
    const cookieStore = await cookies();
    cookieStore.delete('singularity_session');
    clearAuthSessionCache();

    return NextResponse.json({
      success: true,
      message: '✅ Hesabınız ve tüm verileriniz kalıcı ve güvenli olarak silindi. Singularity OS deneyiminiz için teşekkür ederiz.'
    });
  } catch (error: any) {
    console.error('Delete Account Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
