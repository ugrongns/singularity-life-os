import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { getAuthUser } from '@/lib/auth';
import {
  familyMembers, walletsAccounts, personalDebtsReceivables, categories,
  transactions, sinkingFunds, syncQueue, vehicles, vehicleMaintenanceRecords,
  vehicleFuelLogs, vehicleLegalReminders, homeMaintenanceRecords, homeAppliances,
  investmentAssets, investmentDividends, besContracts, realEstateProperties,
  realEstateCashflows, books, readingSessions, bookQuotes, userReadingProfile,
  nutritionMeals, nutritionMealItems, fastingSessions, packagedFoodScans,
  dietMealOptions, userHealthProfile, digitalVaultItems, importantDates,
  petRecords, supplementRoutines, sleepLogs, moodLogs, waterIntakeLogs,
  biometrics, shoppingListItems, appSettings, flexInterestAccounts, flexInterestEarnings
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

    const userTables = [
      transactions, walletsAccounts, personalDebtsReceivables, familyMembers,
      sinkingFunds, syncQueue, vehicleMaintenanceRecords, vehicleFuelLogs,
      vehicleLegalReminders, vehicles, homeMaintenanceRecords, homeAppliances,
      investmentDividends, investmentAssets, besContracts, realEstateCashflows,
      realEstateProperties, readingSessions, bookQuotes, books, userReadingProfile,
      nutritionMealItems, nutritionMeals, fastingSessions, packagedFoodScans,
      dietMealOptions, userHealthProfile, digitalVaultItems, importantDates,
      petRecords, supplementRoutines, sleepLogs, moodLogs, waterIntakeLogs,
      biometrics, shoppingListItems, appSettings, flexInterestEarnings, flexInterestAccounts
    ];

    for (const table of userTables) {
      try {
        await db.delete(table).where(eq((table as any).user_id, userId));
      } catch (err) {
        try {
          await db.delete(table);
        } catch (innerErr) {
          console.warn('Error clearing table:', innerErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '🎉 Hesabınıza ait tüm veriler başarıyla sıfırlandı ve temizlendi!'
    });
  } catch (error: any) {
    console.error('Reset User Data Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
