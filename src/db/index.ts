import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import os from 'os';

// Vercel / Serverless ortamlarda sadece geçici /tmp klasörüne yazılabilir
const isServerless = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';
const DB_PATH = isServerless 
  ? path.join(os.tmpdir(), 'singularity.db') 
  : path.join(process.cwd(), 'singularity.db');

export const sqlite = new Database(DB_PATH);
try {
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
} catch (e) {
  console.warn('Pragma warning:', e);
}

export const db = drizzle(sqlite, { schema });

export function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      avatar TEXT DEFAULT '👤',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      device_id TEXT DEFAULT 'mac-local'
    );

    CREATE TABLE IF NOT EXISTS family_invites (
      id TEXT PRIMARY KEY,
      invite_code TEXT NOT NULL UNIQUE,
      created_by_user_id TEXT NOT NULL,
      family_role TEXT NOT NULL DEFAULT 'member',
      expires_at TEXT NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0,
      used_by_user_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallets_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      credit_limit REAL DEFAULT 0,
      cutoff_day INTEGER,
      due_day INTEGER,
      currency TEXT NOT NULL DEFAULT 'TRY',
      color TEXT DEFAULT '#111827',
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      device_id TEXT DEFAULT 'mac-local'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      monthly_budget_limit REAL DEFAULT 0,
      icon TEXT DEFAULT '🏷️',
      color TEXT DEFAULT '#10B981',
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      device_id TEXT DEFAULT 'mac-local'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL REFERENCES wallets_accounts(id),
      category_id TEXT REFERENCES categories(id),
      member_id TEXT REFERENCES family_members(id),
      merchant TEXT DEFAULT 'Diğer',
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'TRY',
      transaction_date TEXT NOT NULL,
      notes TEXT,
      is_installment INTEGER NOT NULL DEFAULT 0,
      installment_number INTEGER DEFAULT 1,
      total_installments INTEGER DEFAULT 1,
      parent_transaction_id TEXT,
      receipt_image_url TEXT,
      is_verified INTEGER NOT NULL DEFAULT 1,
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      device_id TEXT DEFAULT 'mac-local'
    );

    CREATE TABLE IF NOT EXISTS sinking_funds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0,
      target_date TEXT,
      icon TEXT DEFAULT '🎯',
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      device_id TEXT DEFAULT 'mac-local'
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      plate TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      current_km REAL NOT NULL DEFAULT 0,
      fuel_type TEXT NOT NULL DEFAULT 'Benzin',
      color TEXT DEFAULT '#3B82F6',
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      device_id TEXT DEFAULT 'mac-local'
    );

    CREATE TABLE IF NOT EXISTS vehicle_maintenance_records (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
      type TEXT NOT NULL DEFAULT 'periyodik_bakim',
      km_at_service REAL NOT NULL,
      service_date TEXT NOT NULL,
      next_service_km REAL,
      next_service_date TEXT,
      description TEXT NOT NULL,
      cost REAL NOT NULL DEFAULT 0,
      service_provider TEXT DEFAULT 'Özel Servis',
      receipt_image_url TEXT,
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      device_id TEXT DEFAULT 'mac-local'
    );

    CREATE TABLE IF NOT EXISTS vehicle_fuel_logs (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
      km REAL NOT NULL,
      fuel_station TEXT NOT NULL DEFAULT 'Opet',
      liters REAL NOT NULL,
      price_per_liter REAL NOT NULL,
      total_amount REAL NOT NULL,
      fuel_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      device_id TEXT DEFAULT 'mac-local'
    );

    CREATE TABLE IF NOT EXISTS vehicle_legal_reminders (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
      type TEXT NOT NULL,
      due_date TEXT NOT NULL,
      policy_no TEXT,
      cost_estimate REAL DEFAULT 0,
      is_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS home_maintenance_records (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL,
      title TEXT NOT NULL,
      last_serviced_date TEXT NOT NULL,
      next_due_date TEXT NOT NULL,
      interval_months INTEGER NOT NULL DEFAULT 6,
      cost_estimate REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ok',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS home_appliances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      purchase_date TEXT,
      warranty_months INTEGER DEFAULT 24,
      warranty_expiry_date TEXT,
      service_phone TEXT,
      receipt_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investment_assets (
      id TEXT PRIMARY KEY,
      member_id TEXT REFERENCES family_members(id),
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      avg_cost REAL NOT NULL DEFAULT 0,
      cost_currency TEXT NOT NULL DEFAULT 'TRY',
      current_price REAL NOT NULL DEFAULT 0,
      current_price_currency TEXT NOT NULL DEFAULT 'TRY',
      purchase_date TEXT,
      last_updated_at TEXT NOT NULL,
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      device_id TEXT DEFAULT 'mac-local'
    );

    CREATE TABLE IF NOT EXISTS investment_dividends (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES investment_assets(id),
      dividend_date TEXT NOT NULL,
      amount_per_share REAL NOT NULL,
      total_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'TRY',
      treatment_type TEXT NOT NULL DEFAULT 'cash_payout',
      reinvested_quantity REAL DEFAULT 0,
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bes_contracts (
      id TEXT PRIMARY KEY,
      member_id TEXT REFERENCES family_members(id),
      company TEXT NOT NULL,
      contract_no TEXT,
      start_date TEXT,
      total_principal REAL NOT NULL DEFAULT 0,
      state_contribution_rate REAL NOT NULL DEFAULT 0.30,
      state_contribution_amount REAL NOT NULL DEFAULT 0,
      current_fund_value REAL NOT NULL DEFAULT 0,
      monthly_payment REAL DEFAULT 0,
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS real_estate_properties (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      address TEXT,
      property_type TEXT NOT NULL DEFAULT 'residential',
      purchase_price REAL DEFAULT 0,
      estimated_market_value REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'TRY',
      monthly_rent_income REAL NOT NULL DEFAULT 0,
      tenant_name TEXT,
      tenant_phone TEXT,
      rent_due_day INTEGER DEFAULT 5,
      lease_start_date TEXT,
      tufe_rate_percent REAL DEFAULT 58.5,
      deposit_amount REAL DEFAULT 0,
      is_occupied INTEGER NOT NULL DEFAULT 1,
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS real_estate_cashflows (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES real_estate_properties(id),
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'TRY',
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      translator TEXT,
      publisher TEXT,
      total_pages INTEGER NOT NULL DEFAULT 0,
      current_page INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'reading',
      format TEXT NOT NULL DEFAULT 'physical',
      shelf_location TEXT DEFAULT 'Salon Kitaplığı',
      words_per_page INTEGER DEFAULT 250,
      is_lent_out INTEGER NOT NULL DEFAULT 0,
      lent_to_name TEXT,
      lent_date TEXT,
      cover_url TEXT,
      isbn TEXT,
      summary TEXT,
      rating INTEGER DEFAULT 5,
      category TEXT DEFAULT 'Kişisel Gelişim',
      start_date TEXT,
      finish_date TEXT,
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      device_id TEXT DEFAULT 'mac-local'
    );

    CREATE TABLE IF NOT EXISTS reading_sessions (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES books(id),
      start_page INTEGER NOT NULL,
      end_page INTEGER NOT NULL,
      pages_read INTEGER NOT NULL,
      duration_minutes REAL NOT NULL,
      session_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS book_quotes (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES books(id),
      page_number INTEGER,
      quote_text TEXT NOT NULL,
      reflection_note TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_reading_profile (
      id TEXT PRIMARY KEY,
      member_id TEXT REFERENCES family_members(id),
      yearly_target_books INTEGER NOT NULL DEFAULT 24,
      calibrated_avg_wpm REAL NOT NULL DEFAULT 220,
      avg_seconds_per_page REAL NOT NULL DEFAULT 84,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_meals (
      id TEXT PRIMARY KEY,
      member_id TEXT REFERENCES family_members(id),
      name TEXT NOT NULL,
      meal_type TEXT NOT NULL DEFAULT 'lunch',
      calories REAL NOT NULL DEFAULT 0,
      protein_g REAL NOT NULL DEFAULT 0,
      carbs_g REAL NOT NULL DEFAULT 0,
      fat_g REAL NOT NULL DEFAULT 0,
      portion_multiplier REAL NOT NULL DEFAULT 1.0,
      image_url TEXT,
      date TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 1,
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      device_id TEXT DEFAULT 'mac-local'
    );

    CREATE TABLE IF NOT EXISTS nutrition_meal_items (
      id TEXT PRIMARY KEY,
      meal_id TEXT NOT NULL REFERENCES nutrition_meals(id),
      name TEXT NOT NULL,
      grams REAL DEFAULT 100,
      calories REAL NOT NULL DEFAULT 0,
      protein_g REAL NOT NULL DEFAULT 0,
      carbs_g REAL NOT NULL DEFAULT 0,
      fat_g REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fasting_sessions (
      id TEXT PRIMARY KEY,
      member_id TEXT REFERENCES family_members(id),
      protocol TEXT NOT NULL DEFAULT '16:8',
      start_time TEXT NOT NULL,
      target_end_time TEXT NOT NULL,
      actual_end_time TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS packaged_food_scans (
      id TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      brand TEXT DEFAULT 'Genel',
      barcode TEXT,
      health_score INTEGER NOT NULL DEFAULT 50,
      risk_level TEXT NOT NULL DEFAULT 'clean',
      additives_detected TEXT,
      pesticide_risk_summary TEXT,
      alternative_suggestions TEXT,
      decision TEXT DEFAULT 'pending',
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS diet_meal_options (
      id TEXT PRIMARY KEY,
      meal_type TEXT NOT NULL,
      option_number INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      items_checklist TEXT NOT NULL,
      calories REAL NOT NULL DEFAULT 0,
      protein_g REAL NOT NULL DEFAULT 0,
      carbs_g REAL NOT NULL DEFAULT 0,
      fat_g REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_health_profile (
      id TEXT PRIMARY KEY,
      member_id TEXT REFERENCES family_members(id),
      daily_calorie_target REAL NOT NULL DEFAULT 2200,
      target_protein_g REAL NOT NULL DEFAULT 140,
      target_carbs_g REAL NOT NULL DEFAULT 180,
      target_fat_g REAL NOT NULL DEFAULT 65,
      daily_water_target_ml REAL NOT NULL DEFAULT 2500,
      consumed_water_ml REAL NOT NULL DEFAULT 1250,
      active_fasting_protocol TEXT NOT NULL DEFAULT '16:8',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Safe migrations for newly added columns
  try { sqlite.exec(`ALTER TABLE books ADD COLUMN format TEXT DEFAULT 'physical';`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE books ADD COLUMN shelf_location TEXT DEFAULT 'Salon Kitaplığı';`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE books ADD COLUMN words_per_page INTEGER DEFAULT 250;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE books ADD COLUMN is_lent_out INTEGER DEFAULT 0;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE books ADD COLUMN lent_to_name TEXT;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE books ADD COLUMN lent_date TEXT;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE books ADD COLUMN summary TEXT;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE books ADD COLUMN purchased_date TEXT;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE books ADD COLUMN purchased_from TEXT;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE books ADD COLUMN purchase_price REAL;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE books ADD COLUMN notes TEXT;`); } catch (e) {}

  try { sqlite.exec(`ALTER TABLE real_estate_properties ADD COLUMN lease_start_date TEXT;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE real_estate_properties ADD COLUMN tufe_rate_percent REAL DEFAULT 58.5;`); } catch (e) {}

  try { sqlite.exec(`ALTER TABLE packaged_food_scans ADD COLUMN decision TEXT DEFAULT 'pending';`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE user_health_profile ADD COLUMN daily_water_target_ml REAL DEFAULT 2500;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE user_health_profile ADD COLUMN consumed_water_ml REAL DEFAULT 1250;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE supplement_routines ADD COLUMN remaining_pills INTEGER;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE supplement_routines ADD COLUMN total_pills INTEGER;`); } catch (e) {}
  try { sqlite.exec(`ALTER TABLE mood_logs ADD COLUMN stress_level INTEGER DEFAULT 2;`); } catch (e) {}

  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // ==========================================
  // FAZ 6: YENİ TABLOLAR OLUŞTUR (CREATE IF NOT EXISTS)
  // ==========================================
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS digital_vault_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      owner TEXT DEFAULT 'Kullanıcı',
      issuer TEXT,
      issue_date TEXT,
      expiry_date TEXT,
      remind_days_before INTEGER DEFAULT 30,
      document_number TEXT,
      document_image_url TEXT,
      notes TEXT,
      is_family_shared INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS important_dates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      person_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_date TEXT NOT NULL,
      is_recurring INTEGER NOT NULL DEFAULT 1,
      remind_days_before INTEGER DEFAULT 7,
      gift_ideas TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pet_records (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT,
      birth_date TEXT,
      chip_no TEXT,
      vaccinations TEXT,
      vet_name TEXT,
      vet_phone TEXT,
      vet_next_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplement_routines (
      id TEXT PRIMARY KEY,
      member_id TEXT,
      name TEXT NOT NULL,
      dose TEXT NOT NULL,
      timing TEXT NOT NULL,
      is_taken_today INTEGER NOT NULL DEFAULT 0,
      streak_days INTEGER NOT NULL DEFAULT 0,
      remaining_pills INTEGER,
      total_pills INTEGER,
      last_taken_date TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sleep_logs (
      id TEXT PRIMARY KEY,
      member_id TEXT,
      bedtime TEXT NOT NULL,
      wake_time TEXT NOT NULL,
      duration_hours REAL NOT NULL,
      quality_rating INTEGER NOT NULL DEFAULT 3,
      notes TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mood_logs (
      id TEXT PRIMARY KEY,
      member_id TEXT,
      mood_emoji TEXT NOT NULL,
      mood_score INTEGER NOT NULL,
      energy_level INTEGER DEFAULT 3,
      stress_level INTEGER DEFAULT 2,
      note TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS water_intake_logs (
      id TEXT PRIMARY KEY,
      member_id TEXT,
      date TEXT NOT NULL,
      amount_ml INTEGER NOT NULL DEFAULT 0,
      goal_ml INTEGER NOT NULL DEFAULT 2500,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS biometrics (
      id TEXT PRIMARY KEY,
      member_id TEXT,
      weight_kg REAL,
      waist_cm REAL,
      body_fat_percent REAL,
      blood_pressure_sys INTEGER,
      blood_pressure_dia INTEGER,
      resting_heart_rate INTEGER,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shopping_list_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      quantity TEXT NOT NULL DEFAULT '1',
      unit TEXT DEFAULT 'adet',
      category TEXT DEFAULT 'Market',
      is_checked INTEGER NOT NULL DEFAULT 0,
      source TEXT DEFAULT 'manual',
      source_ref TEXT,
      estimated_price REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      quick_pin_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      avatar_emoji TEXT DEFAULT '👤',
      is_master_account INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      device_name TEXT DEFAULT 'web-client',
      created_at TEXT NOT NULL
    );
  `);

  // Safe migrations for supplement_routines
  try {
    sqlite.exec(`ALTER TABLE supplement_routines ADD COLUMN frequency_type TEXT NOT NULL DEFAULT 'daily';`);
  } catch {}
  try {
    sqlite.exec(`ALTER TABLE supplement_routines ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 1;`);
  } catch {}

  // Safe migrations for wallets_accounts (KMH & Interest Rates)
  try { sqlite.exec(`ALTER TABLE wallets_accounts ADD COLUMN interest_rate_contractual REAL DEFAULT 4.25;`); } catch {}
  try { sqlite.exec(`ALTER TABLE wallets_accounts ADD COLUMN interest_rate_late REAL DEFAULT 4.55;`); } catch {}
  try { sqlite.exec(`ALTER TABLE wallets_accounts ADD COLUMN min_payment_percent REAL DEFAULT 20;`); } catch {}
  try { sqlite.exec(`ALTER TABLE wallets_accounts ADD COLUMN overdraft_limit REAL DEFAULT 0;`); } catch {}

  // Multi-user data isolation migrations
  const userIsolatedTables = [
    'wallets_accounts',
    'investment_assets',
    'vehicles',
    'fasting_sessions',
    'transactions',
    'digital_vault_items',
    'books',
    'supplement_routines',
    'shopping_list_items',
    'bes_contracts',
    'real_estate_properties',
    'vehicle_fuel_logs',
    'vehicle_maintenance_records',
    'vehicle_legal_reminders',
    'home_maintenance_records',
    'home_appliances',
    'personal_debts_receivables',
    'important_dates',
    'nutrition_meals',
    'packaged_food_scans',
    'user_health_profile',
    'user_reading_profile'
  ];

  for (const table of userIsolatedTables) {
    try {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN user_id TEXT;`);
    } catch {}
  }

  // Auto-seed default categories if categories table is empty
  try {
    const catCount = (sqlite.prepare(`SELECT count(*) as count FROM categories`).get() as { count: number }).count;
    if (catCount === 0) {
      const now = new Date().toISOString();
      const defaultCats = [
        { id: 'cat-market', name: 'Market & Gıda', type: 'expense', monthly_budget_limit: 15000, group_50_30_20: 'needs', icon: '🛒', color: '#10B981', created_at: now, updated_at: now },
        { id: 'cat-fatura', name: 'Faturalar & Abonelikler', type: 'expense', monthly_budget_limit: 5000, group_50_30_20: 'needs', icon: '⚡', color: '#3B82F6', created_at: now, updated_at: now },
        { id: 'cat-kira', name: 'Kira & Konut', type: 'expense', monthly_budget_limit: 20000, group_50_30_20: 'needs', icon: '🏠', color: '#8B5CF6', created_at: now, updated_at: now },
        { id: 'cat-arac', name: 'Ulaşım & Akaryakıt', type: 'expense', monthly_budget_limit: 7500, group_50_30_20: 'needs', icon: '🚗', color: '#F59E0B', created_at: now, updated_at: now },
        { id: 'cat-sosyal', name: 'Restoran & Keyif', type: 'expense', monthly_budget_limit: 8000, group_50_30_20: 'wants', icon: '🍽️', color: '#EC4899', created_at: now, updated_at: now },
        { id: 'cat-maas', name: 'Maaş & Gelir', type: 'income', monthly_budget_limit: 0, group_50_30_20: 'savings', icon: '💰', color: '#10B981', created_at: now, updated_at: now }
      ];
      const stmt = sqlite.prepare(`INSERT INTO categories (id, name, type, monthly_budget_limit, group_50_30_20, icon, color, created_at, updated_at) VALUES (@id, @name, @type, @monthly_budget_limit, @group_50_30_20, @icon, @color, @created_at, @updated_at)`);
      for (const cat of defaultCats) {
        stmt.run(cat);
      }
    }
  } catch (err) {
    console.warn('Default category seeding notice:', err);
  }

  // Assign any orphan data from initial database setup to master user
  try {
    const masterUser = sqlite.prepare(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`).get() as { id: string } | undefined;
    if (masterUser?.id) {
      for (const table of userIsolatedTables) {
        try {
          sqlite.exec(`UPDATE ${table} SET user_id = '${masterUser.id}' WHERE user_id IS NULL;`);
        } catch {}
      }
    }
  } catch {}
}

