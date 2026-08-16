import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';

export async function GET() {
  try {
    // Export all tables from Supabase as JSON backup
    const exportData: Record<string, any[]> = {};

    const tables = [
      { name: 'users', table: schema.users },
      { name: 'family_members', table: schema.familyMembers },
      { name: 'wallets_accounts', table: schema.walletsAccounts },
      { name: 'categories', table: schema.categories },
      { name: 'transactions', table: schema.transactions },
      { name: 'sinking_funds', table: schema.sinkingFunds },
      { name: 'books', table: schema.books },
      { name: 'reading_sessions', table: schema.readingSessions },
      { name: 'book_quotes', table: schema.bookQuotes },
      { name: 'vehicles', table: schema.vehicles },
      { name: 'vehicle_maintenance_records', table: schema.vehicleMaintenanceRecords },
      { name: 'vehicle_fuel_logs', table: schema.vehicleFuelLogs },
      { name: 'investment_assets', table: schema.investmentAssets },
      { name: 'real_estate_properties', table: schema.realEstateProperties },
      { name: 'supplement_routines', table: schema.supplementRoutines },
      { name: 'sleep_logs', table: schema.sleepLogs },
      { name: 'mood_logs', table: schema.moodLogs },
      { name: 'biometrics', table: schema.biometrics },
      { name: 'smart_scale_logs', table: schema.smartScaleLogs },
      { name: 'shopping_list_items', table: schema.shoppingListItems },
      { name: 'app_settings', table: schema.appSettings },
    ];

    for (const { name, table } of tables) {
      try {
        const rows = await db.select().from(table as any);
        exportData[name] = rows;
      } catch {
        exportData[name] = [];
      }
    }

    const totalRecords = Object.values(exportData).reduce((sum, rows) => sum + rows.length, 0);

    return NextResponse.json({
      success: true,
      data: {
        last_backup: null,
        backup_count: 0,
        backups: [],
        db_size_kb: 0,
        export_available: true,
        total_records: totalRecords,
        message: 'Supabase PostgreSQL üzerinde çalışıyor. Veri export için aşağıdaki endpoint\'i kullanın: /api/backup/export'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === 'export') {
      // Full JSON export from Supabase
      const exportData: Record<string, any[]> = {};
      const tableList = [
        { name: 'users', table: schema.users },
        { name: 'family_members', table: schema.familyMembers },
        { name: 'wallets_accounts', table: schema.walletsAccounts },
        { name: 'categories', table: schema.categories },
        { name: 'transactions', table: schema.transactions },
        { name: 'sinking_funds', table: schema.sinkingFunds },
        { name: 'books', table: schema.books },
        { name: 'reading_sessions', table: schema.readingSessions },
        { name: 'book_quotes', table: schema.bookQuotes },
        { name: 'vehicles', table: schema.vehicles },
        { name: 'vehicle_maintenance_records', table: schema.vehicleMaintenanceRecords },
        { name: 'vehicle_fuel_logs', table: schema.vehicleFuelLogs },
        { name: 'investment_assets', table: schema.investmentAssets },
        { name: 'real_estate_properties', table: schema.realEstateProperties },
        { name: 'supplement_routines', table: schema.supplementRoutines },
        { name: 'sleep_logs', table: schema.sleepLogs },
        { name: 'mood_logs', table: schema.moodLogs },
        { name: 'biometrics', table: schema.biometrics },
        { name: 'shopping_list_items', table: schema.shoppingListItems },
        { name: 'app_settings', table: schema.appSettings },
      ];

      for (const { name, table } of tableList) {
        try {
          const rows = await db.select().from(table as any);
          exportData[name] = rows;
        } catch {
          exportData[name] = [];
        }
      }

      const json = JSON.stringify({
        exported_at: new Date().toISOString(),
        source: 'supabase-postgresql',
        data: exportData
      }, null, 2);

      return new Response(json, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="singularity-backup-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
