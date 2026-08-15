import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// 1. Aile Üyeleri & Kullanıcılar
export const familyMembers = sqliteTable('family_members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull().default('admin'),
  avatar: text('avatar').default('👤'),
  is_active: integer('is_active').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('mac-local')
});

export const familyInvites = sqliteTable('family_invites', {
  id: text('id').primaryKey(),
  invite_code: text('invite_code').notNull().unique(),
  created_by_user_id: text('created_by_user_id').notNull(),
  family_role: text('family_role').notNull().default('member'),
  target_name: text('target_name'),
  expires_at: text('expires_at').notNull(),
  is_used: integer('is_used').notNull().default(0),
  used_by_user_id: text('used_by_user_id'),
  created_at: text('created_at').notNull()
});

// 2. Varlık Merkezleri & Hesaplar (Vadesiz, Kredi Kartı, Nakit, Kasa)
export const walletsAccounts = sqliteTable('wallets_accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'bank', 'credit_card', 'cash', 'vault', 'loan', 'time_deposit', 'brokerage', 'crypto_exchange', 'crypto_wallet'
  balance: real('balance').notNull().default(0),
  credit_limit: real('credit_limit').default(0),
  cutoff_day: integer('cutoff_day'),
  due_day: integer('due_day'),
  loan_original_amount: real('loan_original_amount').default(0),
  loan_total_repayment: real('loan_total_repayment').default(0),
  monthly_installment_amount: real('monthly_installment_amount').default(0),
  total_installments: integer('total_installments').default(1),
  first_installment_date: text('first_installment_date'),
  deposited_account_id: text('deposited_account_id'),
  currency: text('currency').notNull().default('TRY'),
  color: text('color').default('#111827'),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  is_active: integer('is_active').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('mac-local'),
  // Vadeli Mevduat & Kredi Kartı / KMH Faiz Alanları
  maturity_date: text('maturity_date'),
  interest_rate: real('interest_rate'),
  interest_type: text('interest_type'), // 'simple' | 'compound'
  interest_rate_contractual: real('interest_rate_contractual').default(4.25), // Akdi Faiz (%/Ay)
  interest_rate_late: real('interest_rate_late').default(4.55), // Gecikme Faizi (%/Ay)
  min_payment_percent: real('min_payment_percent').default(20), // Asgari Ödeme Oranı (%)
  overdraft_limit: real('overdraft_limit').default(0), // KMH / Ek Hesap Limiti
  user_id: text('user_id')
});

// 3. Kişisel Borç & Alacak Takibi
export const personalDebtsReceivables = sqliteTable('personal_debts_receivables', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'debt' (Borç Aldım) | 'receivable' (Borç Verdim)
  person_name: text('person_name').notNull(),
  description: text('description'),
  index_type: text('index_type').notNull().default('TRY'), // 'TRY' | 'GOLD' | 'USD' | 'EUR'
  index_amount: real('index_amount').notNull().default(0), // Endeks birimi cinsinden tutar
  interest_rate: real('interest_rate').default(0), // Yıllık veya aylık faiz oranı (%)
  interest_period: text('interest_period').default('yearly'), // 'yearly' | 'monthly'
  due_date: text('due_date'), // Vade tarihi
  connected_wallet_id: text('connected_wallet_id'), // Nakit çıkış/giriş yapılan hesap
  status: text('status').notNull().default('active'), // 'active' | 'partial' | 'closed'
  paid_amount: real('paid_amount').default(0), // Şimdiye kadar ödenen / tahsil edilen TL tutar
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

// 4. Gelir & Gider Kategorileri
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  monthly_budget_limit: real('monthly_budget_limit').default(0),
  group_50_30_20: text('group_50_30_20').default('needs'), // 'needs' (%50), 'wants' (%30), 'savings' (%20)
  icon: text('icon').default('🏷️'),
  color: text('color').default('#10B981'),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('mac-local')
});

// 4. Gelir, Gider & Taksitli İşlemler
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  wallet_id: text('wallet_id').notNull().references(() => walletsAccounts.id),
  category_id: text('category_id').references(() => categories.id),
  member_id: text('member_id').references(() => familyMembers.id),
  merchant: text('merchant').default('Diğer'),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('TRY'),
  transaction_date: text('transaction_date').notNull(),
  notes: text('notes'),
  is_installment: integer('is_installment').notNull().default(0),
  installment_number: integer('installment_number').default(1),
  total_installments: integer('total_installments').default(1),
  parent_transaction_id: text('parent_transaction_id'),
  receipt_image_url: text('receipt_image_url'),
  is_verified: integer('is_verified').notNull().default(1),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('mac-local'),
  user_id: text('user_id')
});

// 5. Hedef Fonları & Kumbaralar
export const sinkingFunds = sqliteTable('sinking_funds', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  target_amount: real('target_amount').notNull(),
  current_amount: real('current_amount').notNull().default(0),
  target_date: text('target_date'),
  icon: text('icon').default('🎯'),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('mac-local')
});

// 6. Çevrimdışı Senkron Kuyruğu
export const syncQueue = sqliteTable('sync_queue', {
  id: text('id').primaryKey(),
  table_name: text('table_name').notNull(),
  record_id: text('record_id').notNull(),
  action: text('action').notNull(),
  payload: text('payload').notNull(),
  status: text('status').notNull().default('pending'),
  created_at: text('created_at').notNull()
});

// ==========================================
// 🚗 FAZ 2: ARAÇ & EV FİLOSU TABLOLARI
// ==========================================

export const vehicles = sqliteTable('vehicles', {
  id: text('id').primaryKey(),
  plate: text('plate').notNull(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  current_km: real('current_km').notNull().default(0),
  fuel_type: text('fuel_type').notNull().default('Benzin'),
  color: text('color').default('#3B82F6'),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  is_active: integer('is_active').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('mac-local'),
  user_id: text('user_id')
});

export const vehicleMaintenanceRecords = sqliteTable('vehicle_maintenance_records', {
  id: text('id').primaryKey(),
  vehicle_id: text('vehicle_id').notNull().references(() => vehicles.id),
  type: text('type').notNull().default('periyodik_bakim'),
  km_at_service: real('km_at_service').notNull(),
  service_date: text('service_date').notNull(),
  next_service_km: real('next_service_km'),
  next_service_date: text('next_service_date'),
  description: text('description').notNull(),
  cost: real('cost').notNull().default(0),
  service_provider: text('service_provider').default('Özel Servis'),
  receipt_image_url: text('receipt_image_url'),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('mac-local')
});

export const vehicleFuelLogs = sqliteTable('vehicle_fuel_logs', {
  id: text('id').primaryKey(),
  vehicle_id: text('vehicle_id').notNull().references(() => vehicles.id),
  km: real('km').notNull(),
  fuel_station: text('fuel_station').notNull().default('Opet'),
  liters: real('liters').notNull(),
  price_per_liter: real('price_per_liter').notNull(),
  total_amount: real('total_amount').notNull(),
  fuel_date: text('fuel_date').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('mac-local')
});

export const vehicleLegalReminders = sqliteTable('vehicle_legal_reminders', {
  id: text('id').primaryKey(),
  vehicle_id: text('vehicle_id').notNull().references(() => vehicles.id),
  type: text('type').notNull(),
  due_date: text('due_date').notNull(),
  policy_no: text('policy_no'),
  cost_estimate: real('cost_estimate').default(0),
  is_completed: integer('is_completed').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

// Ev Operasyonları: Su Arıtma Filtreleri (3, 6, 12 ay) & Kombi/Petek Bakımı
export const homeMaintenanceRecords = sqliteTable('home_maintenance_records', {
  id: text('id').primaryKey(),
  item_type: text('item_type').notNull(), // 'water_filter_3m' | 'water_filter_6m' | 'water_filter_1y' | 'boiler' | 'ac' | 'custom'
  title: text('title').notNull(), // 'Sediment Ön Filtre (3 Aylık)'
  last_serviced_date: text('last_serviced_date').notNull(),
  next_due_date: text('next_due_date').notNull(),
  interval_months: integer('interval_months').notNull().default(6),
  cost_estimate: real('cost_estimate').default(0),
  status: text('status').notNull().default('ok'), // 'ok' | 'warning' | 'urgent'
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

// Ev Demirbaşları & Garanti Süreleri Takibi
export const homeAppliances = sqliteTable('home_appliances', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // Örn: 'Buzdolabı', 'Klima', 'Robot Süpürge'
  brand: text('brand'),
  model: text('model'),
  purchase_date: text('purchase_date'),
  warranty_months: integer('warranty_months').default(24),
  warranty_expiry_date: text('warranty_expiry_date'),
  service_phone: text('service_phone'),
  receipt_url: text('receipt_url'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

// ==========================================
// 📈 FAZ 3: YATIRIMLAR & GAYRİMENKUL TABLOLARI
// ==========================================

export const investmentAssets = sqliteTable('investment_assets', {
  id: text('id').primaryKey(),
  member_id: text('member_id').references(() => familyMembers.id),
  account_id: text('account_id').references(() => walletsAccounts.id),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  asset_class: text('asset_class').notNull(),
  quantity: real('quantity').notNull().default(0),
  avg_cost: real('avg_cost').notNull().default(0),
  cost_currency: text('cost_currency').notNull().default('TRY'),
  current_price: real('current_price').notNull().default(0),
  current_price_currency: text('current_price_currency').notNull().default('TRY'),
  purchase_date: text('purchase_date'),
  last_updated_at: text('last_updated_at').notNull(),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  is_active: integer('is_active').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('mac-local'),
  user_id: text('user_id')
});

export const investmentDividends = sqliteTable('investment_dividends', {
  id: text('id').primaryKey(),
  asset_id: text('asset_id').notNull().references(() => investmentAssets.id),
  dividend_date: text('dividend_date').notNull(),
  amount_per_share: real('amount_per_share').notNull(),
  total_amount: real('total_amount').notNull(),
  currency: text('currency').notNull().default('TRY'),
  treatment_type: text('treatment_type').notNull().default('cash_payout'),
  reinvested_quantity: real('reinvested_quantity').default(0),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const besContracts = sqliteTable('bes_contracts', {
  id: text('id').primaryKey(),
  member_id: text('member_id').references(() => familyMembers.id),
  company: text('company').notNull(),
  contract_no: text('contract_no'),
  start_date: text('start_date'),
  total_principal: real('total_principal').notNull().default(0),
  state_contribution_rate: real('state_contribution_rate').notNull().default(0.30), // Dinamik parametre
  state_contribution_amount: real('state_contribution_amount').notNull().default(0),
  current_fund_value: real('current_fund_value').notNull().default(0),
  monthly_payment: real('monthly_payment').default(0),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const realEstateProperties = sqliteTable('real_estate_properties', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  address: text('address'),
  property_type: text('property_type').notNull().default('residential'),
  purchase_price: real('purchase_price').default(0),
  estimated_market_value: real('estimated_market_value').notNull().default(0),
  currency: text('currency').notNull().default('TRY'),
  monthly_rent_income: real('monthly_rent_income').notNull().default(0),
  tenant_name: text('tenant_name'),
  tenant_phone: text('tenant_phone'),
  rent_due_day: integer('rent_due_day').default(5),
  lease_start_date: text('lease_start_date'), // Sözleşme başlangıç
  tufe_rate_percent: real('tufe_rate_percent').default(58.5), // 12 aylık ortalama TÜFE yasal tavan
  deposit_amount: real('deposit_amount').default(0),
  is_occupied: integer('is_occupied').notNull().default(1),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const realEstateCashflows = sqliteTable('real_estate_cashflows', {
  id: text('id').primaryKey(),
  property_id: text('property_id').notNull().references(() => realEstateProperties.id),
  type: text('type').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('TRY'),
  date: text('date').notNull(),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

// ==========================================
// 📚 FAZ 4: DİJİTAL KÜTÜPHANE TABLOLARI
// ==========================================

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  translator: text('translator'),
  publisher: text('publisher'),
  total_pages: integer('total_pages').notNull().default(0),
  current_page: integer('current_page').notNull().default(0),
  status: text('status').notNull().default('reading'),
  format: text('format').notNull().default('physical'), // 'physical' | 'ebook' | 'audiobook'
  shelf_location: text('shelf_location').default('Salon Kitaplığı'),
  words_per_page: integer('words_per_page').default(250), // N_kelime (Kalibre edilmiş sayfa kelime sayısı)
  is_lent_out: integer('is_lent_out').notNull().default(0), // 1: Emanet verildi
  lent_to_name: text('lent_to_name'), // 'Ahmet Yılmaz'
  lent_date: text('lent_date'),
  cover_url: text('cover_url'),
  isbn: text('isbn'),
  summary: text('summary'),
  rating: integer('rating').default(5),
  category: text('category').default('Kişisel Gelişim'),
  start_date: text('start_date'),
  finish_date: text('finish_date'),
  purchased_date: text('purchased_date'),
  purchased_from: text('purchased_from'),
  purchase_price: real('purchase_price'),
  notes: text('notes'),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('mac-local'),
  user_id: text('user_id')
});

export const readingSessions = sqliteTable('reading_sessions', {
  id: text('id').primaryKey(),
  book_id: text('book_id').notNull().references(() => books.id),
  start_page: integer('start_page').notNull(),
  end_page: integer('end_page').notNull(),
  pages_read: integer('pages_read').notNull(),
  duration_minutes: real('duration_minutes').notNull(),
  session_date: text('session_date').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const bookQuotes = sqliteTable('book_quotes', {
  id: text('id').primaryKey(),
  book_id: text('book_id').notNull().references(() => books.id),
  page_number: integer('page_number'),
  quote_text: text('quote_text').notNull(),
  reflection_note: text('reflection_note'),
  is_favorite: integer('is_favorite').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const userReadingProfile = sqliteTable('user_reading_profile', {
  id: text('id').primaryKey(),
  member_id: text('member_id').references(() => familyMembers.id),
  yearly_target_books: integer('yearly_target_books').notNull().default(24),
  calibrated_avg_wpm: real('calibrated_avg_wpm').notNull().default(220),
  avg_seconds_per_page: real('avg_seconds_per_page').notNull().default(84),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

// ==========================================
// 🧬 FAZ 5: SAĞLIK, BESLENME & DİYET TABLOLARI
// ==========================================

export const nutritionMeals = sqliteTable('nutrition_meals', {
  id: text('id').primaryKey(),
  member_id: text('member_id').references(() => familyMembers.id),
  name: text('name').notNull(),
  meal_type: text('meal_type').notNull().default('lunch'),
  calories: real('calories').notNull().default(0),
  protein_g: real('protein_g').notNull().default(0),
  carbs_g: real('carbs_g').notNull().default(0),
  fat_g: real('fat_g').notNull().default(0),
  portion_multiplier: real('portion_multiplier').notNull().default(1.0),
  image_url: text('image_url'),
  date: text('date').notNull(),
  is_verified: integer('is_verified').notNull().default(1),
  is_family_shared: integer('is_family_shared').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('mac-local'),
  user_id: text('user_id')
});

export const nutritionMealItems = sqliteTable('nutrition_meal_items', {
  id: text('id').primaryKey(),
  meal_id: text('meal_id').notNull().references(() => nutritionMeals.id),
  name: text('name').notNull(),
  grams: real('grams').default(100),
  calories: real('calories').notNull().default(0),
  protein_g: real('protein_g').notNull().default(0),
  carbs_g: real('carbs_g').notNull().default(0),
  fat_g: real('fat_g').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const fastingSessions = sqliteTable('fasting_sessions', {
  id: text('id').primaryKey(),
  member_id: text('member_id').references(() => familyMembers.id),
  protocol: text('protocol').notNull().default('16:8'),
  start_time: text('start_time').notNull(),
  target_end_time: text('target_end_time').notNull(),
  actual_end_time: text('actual_end_time'),
  is_active: integer('is_active').notNull().default(1),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const packagedFoodScans = sqliteTable('packaged_food_scans', {
  id: text('id').primaryKey(),
  product_name: text('product_name').notNull(),
  brand: text('brand').default('Genel'),
  barcode: text('barcode'),
  health_score: integer('health_score').notNull().default(50),
  risk_level: text('risk_level').notNull().default('clean'),
  additives_detected: text('additives_detected'),
  pesticide_risk_summary: text('pesticide_risk_summary'),
  alternative_suggestions: text('alternative_suggestions'),
  decision: text('decision').default('pending'), // 'consumed' | 'rejected' | 'pending'
  image_url: text('image_url'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const dietMealOptions = sqliteTable('diet_meal_options', {
  id: text('id').primaryKey(),
  meal_type: text('meal_type').notNull(), // 'breakfast' | 'lunch' | 'dinner'
  option_number: integer('option_number').notNull().default(1), // 1, 2, 3
  title: text('title').notNull(), // '🥣 Seçenek 1: Yulaf Lapası & Meyve'
  description: text('description').notNull(),
  items_checklist: text('items_checklist').notNull(), // JSON: ["50g Yulaf", "200ml Badem Sütü", "1 Muz"]
  calories: real('calories').notNull().default(0),
  protein_g: real('protein_g').notNull().default(0),
  carbs_g: real('carbs_g').notNull().default(0),
  fat_g: real('fat_g').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const userHealthProfile = sqliteTable('user_health_profile', {
  id: text('id').primaryKey(),
  member_id: text('member_id').references(() => familyMembers.id),
  daily_calorie_target: real('daily_calorie_target').notNull().default(2200),
  target_protein_g: real('target_protein_g').notNull().default(140),
  target_carbs_g: real('target_carbs_g').notNull().default(180),
  target_fat_g: real('target_fat_g').notNull().default(65),
  daily_water_target_ml: real('daily_water_target_ml').notNull().default(2500),
  consumed_water_ml: real('consumed_water_ml').notNull().default(1250),
  active_fasting_protocol: text('active_fasting_protocol').notNull().default('16:8'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

// ==========================================
// 🗂️ FAZ 6: DİJİTAL KASA & EVRAK YÖNETİMİ
// ==========================================

export const digitalVaultItems = sqliteTable('digital_vault_items', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(), // 'passport'|'id_card'|'title_deed'|'warranty'|'insurance'|'contract'|'license'
  owner: text('owner').default('Kullanıcı'),
  issuer: text('issuer'),
  issue_date: text('issue_date'),
  expiry_date: text('expiry_date'),
  remind_days_before: integer('remind_days_before').default(30),
  document_number: text('document_number'),
  document_image_url: text('document_image_url'),
  notes: text('notes'),
  is_family_shared: integer('is_family_shared').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const importantDates = sqliteTable('important_dates', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  person_name: text('person_name').notNull(),
  event_type: text('event_type').notNull(), // 'birthday'|'anniversary'|'nameday'|'custom'
  event_date: text('event_date').notNull(), // 'MM-DD' format
  is_recurring: integer('is_recurring').notNull().default(1),
  remind_days_before: integer('remind_days_before').default(7),
  gift_ideas: text('gift_ideas'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const petRecords = sqliteTable('pet_records', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  species: text('species').notNull(), // 'Kedi'|'Köpek'|'Kuş'
  breed: text('breed'),
  birth_date: text('birth_date'),
  chip_no: text('chip_no'),
  vaccinations: text('vaccinations'), // JSON array
  vet_name: text('vet_name'),
  vet_phone: text('vet_phone'),
  vet_next_date: text('vet_next_date'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

// ==========================================
// 💊 FAZ 6: WELLNESS — TAKVİYE, UYKU & RUH HALİ
// ==========================================

export const supplementRoutines = sqliteTable('supplement_routines', {
  id: text('id').primaryKey(),
  member_id: text('member_id'),
  name: text('name').notNull(),
  dose: text('dose').notNull(),
  timing: text('timing').notNull(), // 'morning'|'evening'|'with_meal'|'as_needed'
  frequency_type: text('frequency_type').notNull().default('daily'), // 'daily' | 'interval' | 'as_needed'
  interval_days: integer('interval_days').notNull().default(1), // Örn: 2 (2 günde bir), 7 (Haftalık), 30 (Aylık)
  is_taken_today: integer('is_taken_today').notNull().default(0),
  streak_days: integer('streak_days').notNull().default(0),
  remaining_pills: integer('remaining_pills'),
  total_pills: integer('total_pills'),
  last_taken_date: text('last_taken_date'),
  notes: text('notes'),
  is_active: integer('is_active').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const sleepLogs = sqliteTable('sleep_logs', {
  id: text('id').primaryKey(),
  member_id: text('member_id'),
  bedtime: text('bedtime').notNull(),
  wake_time: text('wake_time').notNull(),
  duration_hours: real('duration_hours').notNull(),
  quality_rating: integer('quality_rating').notNull().default(3),
  notes: text('notes'),
  date: text('date').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const moodLogs = sqliteTable('mood_logs', {
  id: text('id').primaryKey(),
  member_id: text('member_id'),
  mood_emoji: text('mood_emoji').notNull(),
  mood_score: integer('mood_score').notNull(),
  energy_level: integer('energy_level').default(3),
  stress_level: integer('stress_level').default(2),
  note: text('note'),
  date: text('date').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const waterIntakeLogs = sqliteTable('water_intake_logs', {
  id: text('id').primaryKey(),
  member_id: text('member_id'),
  date: text('date').notNull(),
  amount_ml: integer('amount_ml').notNull().default(0),
  goal_ml: integer('goal_ml').notNull().default(2500),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const biometrics = sqliteTable('biometrics', {
  id: text('id').primaryKey(),
  member_id: text('member_id'),
  weight_kg: real('weight_kg'),
  waist_cm: real('waist_cm'),
  body_fat_percent: real('body_fat_percent'),
  blood_pressure_sys: integer('blood_pressure_sys'),
  blood_pressure_dia: integer('blood_pressure_dia'),
  resting_heart_rate: integer('resting_heart_rate'),
  date: text('date').notNull(),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const smartScaleLogs = sqliteTable('smart_scale_logs', {
  id: text('id').primaryKey(),
  member_id: text('member_id'),
  user_id: text('user_id'),
  measurement_date: text('measurement_date').notNull(),
  weight_kg: real('weight_kg').notNull(),
  bmi: real('bmi'),
  body_fat_percent: real('body_fat_percent'),
  body_fat_mass_kg: real('body_fat_mass_kg'),
  skeletal_muscle_percent: real('skeletal_muscle_percent'),
  skeletal_muscle_mass_kg: real('skeletal_muscle_mass_kg'),
  muscle_percent: real('muscle_percent'),
  muscle_mass_kg: real('muscle_mass_kg'),
  water_percent: real('water_percent'),
  water_mass_kg: real('water_mass_kg'),
  visceral_fat_rating: real('visceral_fat_rating'),
  bone_mass_kg: real('bone_mass_kg'),
  bmr_calories: real('bmr_calories'),
  protein_percent: real('protein_percent'),
  obesity_degree_percent: real('obesity_degree_percent'),
  metabolic_age: real('metabolic_age'),
  fat_free_mass_kg: real('fat_free_mass_kg'),
  actual_age: integer('actual_age'),
  height_cm: integer('height_cm'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

// ==========================================
// 🛒 FAZ 6: AKILLI MARKET LİSTESİ
// ==========================================

export const shoppingListItems = sqliteTable('shopping_list_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  quantity: text('quantity').notNull().default('1'),
  unit: text('unit').default('adet'),
  category: text('category').default('Market'),
  is_checked: integer('is_checked').notNull().default(0),
  source: text('source').default('manual'), // 'manual'|'diet_plan'
  source_ref: text('source_ref'),
  estimated_price: real('estimated_price').default(0),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

// ==========================================
// ⚙️ FAZ 13: SİSTEM & TELEGRAM AYARLARI
// ==========================================

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_at: text('updated_at').notNull()
});

// ==========================================
// 🔐 FAZ 15: KULLANICI KAYIT & GÜVENLİK
// ==========================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  full_name: text('full_name').notNull(),
  email: text('email'),
  password_hash: text('password_hash').notNull(),
  password_salt: text('password_salt').notNull(),
  quick_pin_hash: text('quick_pin_hash').notNull(),
  role: text('role').notNull().default('admin'), // 'admin' | 'member'
  avatar_emoji: text('avatar_emoji').default('👤'),
  is_master_account: integer('is_master_account').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const authSessions = sqliteTable('auth_sessions', {
  token: text('token').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id),
  expires_at: text('expires_at').notNull(),
  device_name: text('device_name').default('web-client'),
  created_at: text('created_at').notNull()
});

// ==========================================
// 💸 FAZ 15: BOŞTA DURAN NAKİTE FAİZ / NEMA
// ==========================================

export const flexInterestAccounts = sqliteTable('flex_interest_accounts', {
  id: text('id').primaryKey(),
  account_id: text('account_id').notNull().references(() => walletsAccounts.id),
  is_active: integer('is_active').notNull().default(0), // 1 = Aktif, 0 = Pasif
  annual_rate: real('annual_rate').notNull().default(0), // Yıllık faiz oranı %
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const flexInterestEarnings = sqliteTable('flex_interest_earnings', {
  id: text('id').primaryKey(),
  flex_account_id: text('flex_account_id').references(() => flexInterestAccounts.id),
  wallet_account_id: text('wallet_account_id').notNull().references(() => walletsAccounts.id),
  start_date: text('start_date').notNull(),
  end_date: text('end_date').notNull(),
  days: integer('days').notNull(),
  principal_amount: real('principal_amount').notNull(),
  interest_rate: real('interest_rate').notNull(),
  earned_amount: real('earned_amount').notNull(), // Hesaplanan faiz geliri
  actual_amount: real('actual_amount').notNull(), // Kullanıcı tarafından manuel düzeltilen/girilen net faiz
  currency: text('currency').notNull().default('TRY'),
  notes: text('notes'),
  created_at: text('created_at').notNull()
});


