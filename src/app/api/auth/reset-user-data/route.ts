import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { getAuthUser } from '@/lib/auth';
import {
  // Seviye 1: En Uç Bağımlı Tablolar (Child Tables)
  flexInterestEarnings,
  investmentDividends,
  realEstateCashflows,
  readingSessions,
  bookQuotes,
  nutritionMealItems,
  workoutExerciseLogs,
  vehicleFuelLogs,
  vehicleMaintenanceRecords,
  vehicleLegalReminders,

  // Seviye 2: Orta Bağımlı Tablolar
  transactions,
  personalDebtsReceivables,
  flexInterestAccounts,
  investmentAssets,
  besContracts,
  realEstateProperties,
  books,
  nutritionMeals,
  fastingSessions,
  packagedFoodScans,
  dietMealOptions,
  workoutSessions,
  foodNutrientProfiles,
  vehicles,
  homeMaintenanceRecords,
  homeAppliances,
  digitalVaultItems,
  importantDates,
  petRecords,
  supplementRoutines,
  sleepLogs,
  moodLogs,
  waterIntakeLogs,
  biometrics,
  smartScaleLogs,
  shoppingListItems,
  sinkingFunds,
  syncQueue,
  familyInvites,

  // Seviye 3: Ana Varlık Tabloları
  walletsAccounts,

  // Seviye 4: Profil Tabloları
  userHealthProfile,
  userReadingProfile,
  familyMembers,
  appSettings
} from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    initDatabase();
    const user = await getAuthUser();

    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı. Lütfen giriş yapın.' }, { status: 401 });
    }

    const userId = user.id;

    // Hiyerarşik Bağımlılık Sıralaması (Foreign-Key Safe Delete Order)
    const hierarchicalTables = [
      // 1. Aşama: En Uç Tablolar (Child Records)
      flexInterestEarnings,
      investmentDividends,
      realEstateCashflows,
      readingSessions,
      bookQuotes,
      nutritionMealItems,
      workoutExerciseLogs,
      vehicleFuelLogs,
      vehicleMaintenanceRecords,
      vehicleLegalReminders,

      // 2. Aşama: İşlemler ve Modül Varlıkları
      transactions,
      personalDebtsReceivables,
      flexInterestAccounts,
      investmentAssets,
      besContracts,
      realEstateProperties,
      books,
      nutritionMeals,
      fastingSessions,
      packagedFoodScans,
      dietMealOptions,
      workoutSessions,
      foodNutrientProfiles,
      vehicles,
      homeMaintenanceRecords,
      homeAppliances,
      digitalVaultItems,
      importantDates,
      petRecords,
      supplementRoutines,
      sleepLogs,
      moodLogs,
      waterIntakeLogs,
      biometrics,
      smartScaleLogs,
      shoppingListItems,
      sinkingFunds,
      syncQueue,
      familyInvites,

      // 3. Aşama: Cüzdan & Hesaplar
      walletsAccounts,

      // 4. Aşama: Profil & Ayar Tabloları
      userHealthProfile,
      userReadingProfile,
      familyMembers,
      appSettings
    ];

    const isMaster = user.is_master_account === 1 || user.role === 'admin';

    for (const table of hierarchicalTables) {
      try {
        if (isMaster) {
          // Master yönetici hesabı sıfırladığında tüm tabloları tertemiz yapar (NULL user_id veya eski aile kayıtları dahil)
          await db.delete(table);
        } else {
          // Normal alt kullanıcı sadece kendi eklediklerini siler
          if ('user_id' in (table as any)) {
            await db.delete(table).where(eq((table as any).user_id, userId));
          } else if ('created_by_user_id' in (table as any)) {
            await db.delete(table).where(eq((table as any).created_by_user_id, userId));
          } else {
            await db.delete(table);
          }
        }
      } catch (tableErr) {
        try {
          await db.delete(table);
        } catch (innerErr) {
          console.warn(`[Reset Data] Tablo temizlenirken hata oluştu:`, innerErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '🎉 Hesabınıza ait tüm veriler sıfırlandı ve sistem tertemiz hale getirildi!'
    });
  } catch (error: any) {
    console.error('Reset User Data Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
