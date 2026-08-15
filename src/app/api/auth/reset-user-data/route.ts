import { NextResponse } from 'next/server';
import { sqlite, initDatabase } from '@/db';
import { getAuthUser } from '@/lib/auth';

export async function POST() {
  try {
    initDatabase();
    const user = await getAuthUser();

    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı. Lütfen giriş yapın.' }, { status: 401 });
    }

    const allTables = [
      'family_members', 'wallets_accounts', 'personal_debts_receivables', 'categories',
      'transactions', 'sinking_funds', 'sync_queue', 'vehicles', 'vehicle_maintenance_records',
      'vehicle_fuel_logs', 'vehicle_legal_reminders', 'home_maintenance_records', 'home_appliances',
      'investment_assets', 'investment_dividends', 'bes_contracts', 'real_estate_properties',
      'real_estate_cashflows', 'books', 'reading_sessions', 'book_quotes', 'user_reading_profile',
      'nutrition_meals', 'nutrition_meal_items', 'fasting_sessions', 'packaged_food_scans',
      'diet_meal_options', 'user_health_profile', 'digital_vault_items', 'important_dates',
      'pet_records', 'supplement_routines', 'sleep_logs', 'mood_logs', 'water_intake_logs',
      'biometrics', 'shopping_list_items', 'app_settings', 'flex_interest_accounts', 'flex_interest_earnings'
    ];

    await sqlite.execute('PRAGMA foreign_keys = OFF;');
    for (const table of allTables) {
      try {
        await sqlite.execute(`DELETE FROM ${table};`);
      } catch (err) {
        console.error(`Error deleting from ${table}:`, err);
      }
    }
    await sqlite.execute('PRAGMA foreign_keys = ON;');

    return NextResponse.json({
      success: true,
      message: '🎉 Hesabınıza ait tüm veriler başarıyla sıfırlandı ve temizlendi!'
    });
  } catch (error: any) {
    console.error('Reset User Data Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
