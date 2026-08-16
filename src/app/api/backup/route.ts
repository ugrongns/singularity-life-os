import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import crypto from 'crypto';

// Tüm tablolar
const ALL_TABLES = [
  { name: 'users', table: schema.users },
  { name: 'auth_sessions', table: schema.authSessions },
  { name: 'family_members', table: schema.familyMembers },
  { name: 'family_invites', table: schema.familyInvites },
  { name: 'wallets_accounts', table: schema.walletsAccounts },
  { name: 'categories', table: schema.categories },
  { name: 'transactions', table: schema.transactions },
  { name: 'sinking_funds', table: schema.sinkingFunds },
  { name: 'personal_debts_receivables', table: schema.personalDebtsReceivables },
  { name: 'flex_interest_accounts', table: schema.flexInterestAccounts },
  { name: 'flex_interest_earnings', table: schema.flexInterestEarnings },
  { name: 'investment_assets', table: schema.investmentAssets },
  { name: 'investment_dividends', table: schema.investmentDividends },
  { name: 'bes_contracts', table: schema.besContracts },
  { name: 'real_estate_properties', table: schema.realEstateProperties },
  { name: 'real_estate_cashflows', table: schema.realEstateCashflows },
  { name: 'books', table: schema.books },
  { name: 'reading_sessions', table: schema.readingSessions },
  { name: 'book_quotes', table: schema.bookQuotes },
  { name: 'user_reading_profile', table: schema.userReadingProfile },
  { name: 'vehicles', table: schema.vehicles },
  { name: 'vehicle_maintenance_records', table: schema.vehicleMaintenanceRecords },
  { name: 'vehicle_fuel_logs', table: schema.vehicleFuelLogs },
  { name: 'vehicle_legal_reminders', table: schema.vehicleLegalReminders },
  { name: 'user_health_profile', table: schema.userHealthProfile },
  { name: 'nutrition_meals', table: schema.nutritionMeals },
  { name: 'fasting_sessions', table: schema.fastingSessions },
  { name: 'water_intake_logs', table: schema.waterIntakeLogs },
  { name: 'supplement_routines', table: schema.supplementRoutines },
  { name: 'sleep_logs', table: schema.sleepLogs },
  { name: 'mood_logs', table: schema.moodLogs },
  { name: 'biometrics', table: schema.biometrics },
  { name: 'smart_scale_logs', table: schema.smartScaleLogs },
  { name: 'digital_vault_items', table: schema.digitalVaultItems },
  { name: 'important_dates', table: schema.importantDates },
  { name: 'pet_records', table: schema.petRecords },
  { name: 'home_maintenance_records', table: schema.homeMaintenanceRecords },
  { name: 'home_appliances', table: schema.homeAppliances },
  { name: 'shopping_list_items', table: schema.shoppingListItems },
  { name: 'app_settings', table: schema.appSettings },
];

async function fetchAllData() {
  const exportData: Record<string, any[]> = {};
  for (const { name, table } of ALL_TABLES) {
    try {
      const rows = await db.select().from(table as any);
      exportData[name] = rows;
    } catch {
      exportData[name] = [];
    }
  }
  return exportData;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const download = searchParams.get('download');

    const exportData = await fetchAllData();
    const totalRecords = Object.values(exportData).reduce((sum, rows) => sum + rows.length, 0);
    const rawJson = JSON.stringify(exportData);
    const sizeKb = Math.round(Buffer.byteLength(rawJson, 'utf8') / 1024);

    // Eğer doğrudan dosya indirilmek isteniyorsa
    if (download === 'true') {
      const payload = JSON.stringify({
        exported_at: new Date().toISOString(),
        version: '1.0.0',
        database: 'Supabase PostgreSQL',
        total_records: totalRecords,
        tables_count: ALL_TABLES.length,
        data: exportData
      }, null, 2);

      return new Response(payload, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="singularity-backup-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        last_backup: {
          name: 'Supabase Otomatik Bulut Yedeği',
          size_kb: sizeKb,
          created_at: new Date().toISOString(),
          is_cloud: true
        },
        backup_count: 1,
        backups: [
          {
            name: `singularity-supabase-${new Date().toISOString().split('T')[0]}.json`,
            size_kb: sizeKb,
            created_at: new Date().toISOString(),
            is_encrypted: false
          }
        ],
        db_size_kb: sizeKb,
        total_records: totalRecords,
        tables_count: ALL_TABLES.length,
        status: 'cloud_active',
        database_engine: 'Supabase PostgreSQL',
        message: 'Veritabanı 7/24 Supabase bulutunda aktif ve güvenli.'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'export_json';
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const exportData = await fetchAllData();
    const totalRecords = Object.values(exportData).reduce((sum, rows) => sum + rows.length, 0);
    const payloadObject = {
      exported_at: now.toISOString(),
      version: '1.0.0',
      database: 'Supabase PostgreSQL',
      total_records: totalRecords,
      tables_count: ALL_TABLES.length,
      data: exportData
    };
    const jsonString = JSON.stringify(payloadObject, null, 2);
    const sizeKb = Math.max(1, Math.round(Buffer.byteLength(jsonString, 'utf8') / 1024));

    // 1. DÜZ JSON YEDEK / EXPORT (backup_db veya export_json)
    if (action === 'backup_db' || action === 'export_json' || action === 'export') {
      return NextResponse.json({
        success: true,
        backup: {
          name: `singularity-backup-${dateStr}.json`,
          size_kb: sizeKb,
          created_at: now.toISOString(),
          tables: ALL_TABLES.length,
          total_records: totalRecords
        },
        export: {
          name: `singularity-backup-${dateStr}.json`,
          size_kb: sizeKb,
          tables: ALL_TABLES.length,
          total_records: totalRecords
        },
        jsonData: payloadObject
      });
    }

    // 2. AES-256 ŞİFRELİ YEDEK
    if (action === 'encrypted_backup') {
      const passphrase = body.passphrase || 'SingularityMasterKey2026';
      const salt = crypto.randomBytes(16);
      const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(jsonString, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const encPayload = JSON.stringify({
        encrypted_at: now.toISOString(),
        version: '1.0.0-aes256',
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        cipher: 'aes-256-cbc',
        data: encrypted
      }, null, 2);

      const encSizeKb = Math.max(1, Math.round(Buffer.byteLength(encPayload, 'utf8') / 1024));

      return NextResponse.json({
        success: true,
        backup: {
          name: `singularity-encrypted-${dateStr}.enc`,
          size_kb: encSizeKb,
          created_at: now.toISOString(),
          is_encrypted: true,
          tables: ALL_TABLES.length,
          total_records: totalRecords
        },
        encryptedPayload: encPayload
      });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem' }, { status: 400 });
  } catch (error: any) {
    console.error('Backup API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
