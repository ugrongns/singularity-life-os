import { pgTable, text, integer, real, boolean, doublePrecision } from 'drizzle-orm/pg-core';

// 1. Aile Üyeleri & Kullanıcılar
export const familyMembers = pgTable('family_members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull().default('admin'),
  avatar: text('avatar').default('👤'),
  is_active: integer('is_active').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('web-client')
});

export const familyInvites = pgTable('family_invites', {
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

// 2. Varlık Merkezleri & Hesaplar
export const walletsAccounts = pgTable('wallets_accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  balance: doublePrecision('balance').notNull().default(0),
  credit_limit: doublePrecision('credit_limit').default(0),
  cutoff_day: integer('cutoff_day'),
  due_day: integer('due_day'),
  loan_original_amount: doublePrecision('loan_original_amount').default(0),
  loan_total_repayment: doublePrecision('loan_total_repayment').default(0),
  monthly_installment_amount: doublePrecision('monthly_installment_amount').default(0),
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
  device_id: text('device_id').default('web-client'),
  maturity_date: text('maturity_date'),
  interest_rate: doublePrecision('interest_rate'),
  interest_type: text('interest_type'),
  interest_rate_contractual: doublePrecision('interest_rate_contractual').default(4.25),
  interest_rate_late: doublePrecision('interest_rate_late').default(4.55),
  min_payment_percent: doublePrecision('min_payment_percent').default(20),
  overdraft_limit: doublePrecision('overdraft_limit').default(0),
  user_id: text('user_id')
});

// 3. Kişisel Borç & Alacak Takibi
export const personalDebtsReceivables = pgTable('personal_debts_receivables', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  person_name: text('person_name').notNull(),
  description: text('description'),
  index_type: text('index_type').notNull().default('TRY'),
  index_amount: doublePrecision('index_amount').notNull().default(0),
  interest_rate: doublePrecision('interest_rate').default(0),
  interest_period: text('interest_period').default('yearly'),
  due_date: text('due_date'),
  connected_wallet_id: text('connected_wallet_id'),
  status: text('status').notNull().default('active'),
  paid_amount: doublePrecision('paid_amount').default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

// 4. Gelir & Gider Kategorileri
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  monthly_budget_limit: doublePrecision('monthly_budget_limit').default(0),
  group_50_30_20: text('group_50_30_20').default('needs'),
  icon: text('icon').default('🏷️'),
  color: text('color').default('#10B981'),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('web-client')
});

// 4. Gelir, Gider & Taksitli İşlemler
export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  wallet_id: text('wallet_id').notNull().references(() => walletsAccounts.id),
  category_id: text('category_id').references(() => categories.id),
  member_id: text('member_id').references(() => familyMembers.id),
  merchant: text('merchant').default('Diğer'),
  amount: doublePrecision('amount').notNull(),
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
  device_id: text('device_id').default('web-client'),
  user_id: text('user_id')
});

// 5. Hedef Fonları & Kumbaralar
export const sinkingFunds = pgTable('sinking_funds', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  target_amount: doublePrecision('target_amount').notNull(),
  current_amount: doublePrecision('current_amount').notNull().default(0),
  target_date: text('target_date'),
  icon: text('icon').default('🎯'),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('web-client')
});

// 6. Çevrimdışı Senkron Kuyruğu
export const syncQueue = pgTable('sync_queue', {
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

export const vehicles = pgTable('vehicles', {
  id: text('id').primaryKey(),
  plate: text('plate').notNull(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  current_km: doublePrecision('current_km').notNull().default(0),
  fuel_type: text('fuel_type').notNull().default('Benzin'),
  color: text('color').default('#3B82F6'),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  is_active: integer('is_active').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('web-client'),
  user_id: text('user_id')
});

export const vehicleMaintenanceRecords = pgTable('vehicle_maintenance_records', {
  id: text('id').primaryKey(),
  vehicle_id: text('vehicle_id').notNull().references(() => vehicles.id),
  type: text('type').notNull().default('periyodik_bakim'),
  km_at_service: doublePrecision('km_at_service').notNull(),
  service_date: text('service_date').notNull(),
  next_service_km: doublePrecision('next_service_km'),
  next_service_date: text('next_service_date'),
  description: text('description').notNull(),
  cost: doublePrecision('cost').notNull().default(0),
  service_provider: text('service_provider').default('Özel Servis'),
  receipt_image_url: text('receipt_image_url'),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('web-client')
});

export const vehicleFuelLogs = pgTable('vehicle_fuel_logs', {
  id: text('id').primaryKey(),
  vehicle_id: text('vehicle_id').notNull().references(() => vehicles.id),
  km: doublePrecision('km').notNull(),
  fuel_station: text('fuel_station').notNull().default('Opet'),
  liters: doublePrecision('liters').notNull(),
  price_per_liter: doublePrecision('price_per_liter').notNull(),
  total_amount: doublePrecision('total_amount').notNull(),
  fuel_date: text('fuel_date').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('web-client')
});

export const vehicleLegalReminders = pgTable('vehicle_legal_reminders', {
  id: text('id').primaryKey(),
  vehicle_id: text('vehicle_id').notNull().references(() => vehicles.id),
  type: text('type').notNull(),
  due_date: text('due_date').notNull(),
  policy_no: text('policy_no'),
  cost_estimate: doublePrecision('cost_estimate').default(0),
  is_completed: integer('is_completed').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const homeMaintenanceRecords = pgTable('home_maintenance_records', {
  id: text('id').primaryKey(),
  item_type: text('item_type').notNull(),
  title: text('title').notNull(),
  last_serviced_date: text('last_serviced_date').notNull(),
  next_due_date: text('next_due_date').notNull(),
  interval_months: integer('interval_months').notNull().default(6),
  cost_estimate: doublePrecision('cost_estimate').default(0),
  status: text('status').notNull().default('ok'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const homeAppliances = pgTable('home_appliances', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
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

export const investmentAssets = pgTable('investment_assets', {
  id: text('id').primaryKey(),
  member_id: text('member_id').references(() => familyMembers.id),
  account_id: text('account_id').references(() => walletsAccounts.id),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  asset_class: text('asset_class').notNull(),
  quantity: doublePrecision('quantity').notNull().default(0),
  avg_cost: doublePrecision('avg_cost').notNull().default(0),
  cost_currency: text('cost_currency').notNull().default('TRY'),
  current_price: doublePrecision('current_price').notNull().default(0),
  current_price_currency: text('current_price_currency').notNull().default('TRY'),
  purchase_date: text('purchase_date'),
  last_updated_at: text('last_updated_at').notNull(),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  is_active: integer('is_active').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('web-client'),
  user_id: text('user_id')
});

export const investmentDividends = pgTable('investment_dividends', {
  id: text('id').primaryKey(),
  asset_id: text('asset_id').notNull().references(() => investmentAssets.id),
  dividend_date: text('dividend_date').notNull(),
  amount_per_share: doublePrecision('amount_per_share').notNull(),
  total_amount: doublePrecision('total_amount').notNull(),
  currency: text('currency').notNull().default('TRY'),
  treatment_type: text('treatment_type').notNull().default('cash_payout'),
  reinvested_quantity: doublePrecision('reinvested_quantity').default(0),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const besContracts = pgTable('bes_contracts', {
  id: text('id').primaryKey(),
  member_id: text('member_id').references(() => familyMembers.id),
  company: text('company').notNull(),
  contract_no: text('contract_no'),
  start_date: text('start_date'),
  total_principal: doublePrecision('total_principal').notNull().default(0),
  state_contribution_rate: doublePrecision('state_contribution_rate').notNull().default(0.30),
  state_contribution_amount: doublePrecision('state_contribution_amount').notNull().default(0),
  current_fund_value: doublePrecision('current_fund_value').notNull().default(0),
  monthly_payment: doublePrecision('monthly_payment').default(0),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const realEstateProperties = pgTable('real_estate_properties', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  address: text('address'),
  property_type: text('property_type').notNull().default('residential'),
  purchase_price: doublePrecision('purchase_price').default(0),
  estimated_market_value: doublePrecision('estimated_market_value').notNull().default(0),
  currency: text('currency').notNull().default('TRY'),
  monthly_rent_income: doublePrecision('monthly_rent_income').notNull().default(0),
  tenant_name: text('tenant_name'),
  tenant_phone: text('tenant_phone'),
  rent_due_day: integer('rent_due_day').default(5),
  lease_start_date: text('lease_start_date'),
  tufe_rate_percent: doublePrecision('tufe_rate_percent').default(58.5),
  deposit_amount: doublePrecision('deposit_amount').default(0),
  is_occupied: integer('is_occupied').notNull().default(1),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const realEstateCashflows = pgTable('real_estate_cashflows', {
  id: text('id').primaryKey(),
  property_id: text('property_id').notNull().references(() => realEstateProperties.id),
  type: text('type').notNull(),
  amount: doublePrecision('amount').notNull(),
  currency: text('currency').notNull().default('TRY'),
  date: text('date').notNull(),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

// ==========================================
// 📚 FAZ 4: DİJİTAL KÜTÜPHANE TABLOLARI
// ==========================================

export const books = pgTable('books', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  translator: text('translator'),
  publisher: text('publisher'),
  total_pages: integer('total_pages').notNull().default(0),
  current_page: integer('current_page').notNull().default(0),
  status: text('status').notNull().default('reading'),
  format: text('format').notNull().default('physical'),
  shelf_location: text('shelf_location').default('Salon Kitaplığı'),
  words_per_page: integer('words_per_page').default(250),
  is_lent_out: integer('is_lent_out').notNull().default(0),
  lent_to_name: text('lent_to_name'),
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
  purchase_price: doublePrecision('purchase_price'),
  notes: text('notes'),
  is_family_shared: integer('is_family_shared').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('web-client'),
  user_id: text('user_id')
});

export const readingSessions = pgTable('reading_sessions', {
  id: text('id').primaryKey(),
  book_id: text('book_id').notNull().references(() => books.id),
  start_page: integer('start_page').notNull(),
  end_page: integer('end_page').notNull(),
  pages_read: integer('pages_read').notNull(),
  duration_minutes: doublePrecision('duration_minutes').notNull(),
  session_date: text('session_date').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const bookQuotes = pgTable('book_quotes', {
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

export const userReadingProfile = pgTable('user_reading_profile', {
  id: text('id').primaryKey(),
  member_id: text('member_id').references(() => familyMembers.id),
  yearly_target_books: integer('yearly_target_books').notNull().default(24),
  calibrated_avg_wpm: doublePrecision('calibrated_avg_wpm').notNull().default(220),
  avg_seconds_per_page: doublePrecision('avg_seconds_per_page').notNull().default(84),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

// ==========================================
// 🧬 FAZ 5: SAĞLIK, BESLENME & DİYET TABLOLARI
// ==========================================

export const nutritionMeals = pgTable('nutrition_meals', {
  id: text('id').primaryKey(),
  member_id: text('member_id').references(() => familyMembers.id),
  name: text('name').notNull(),
  meal_type: text('meal_type').notNull().default('lunch'),
  calories: doublePrecision('calories').notNull().default(0),
  protein_g: doublePrecision('protein_g').notNull().default(0),
  carbs_g: doublePrecision('carbs_g').notNull().default(0),
  fat_g: doublePrecision('fat_g').notNull().default(0),
  portion_multiplier: doublePrecision('portion_multiplier').notNull().default(1.0),
  image_url: text('image_url'),
  date: text('date').notNull(),
  is_verified: integer('is_verified').notNull().default(1),
  is_family_shared: integer('is_family_shared').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  sync_status: text('sync_status').notNull().default('synced'),
  device_id: text('device_id').default('web-client'),
  user_id: text('user_id')
});

export const nutritionMealItems = pgTable('nutrition_meal_items', {
  id: text('id').primaryKey(),
  meal_id: text('meal_id').notNull().references(() => nutritionMeals.id),
  name: text('name').notNull(),
  grams: doublePrecision('grams').default(100),
  calories: doublePrecision('calories').notNull().default(0),
  protein_g: doublePrecision('protein_g').notNull().default(0),
  carbs_g: doublePrecision('carbs_g').notNull().default(0),
  fat_g: doublePrecision('fat_g').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const fastingSessions = pgTable('fasting_sessions', {
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

export const packagedFoodScans = pgTable('packaged_food_scans', {
  id: text('id').primaryKey(),
  product_name: text('product_name').notNull(),
  brand: text('brand').default('Genel'),
  barcode: text('barcode'),
  health_score: integer('health_score').notNull().default(50),
  risk_level: text('risk_level').notNull().default('clean'),
  additives_detected: text('additives_detected'),
  pesticide_risk_summary: text('pesticide_risk_summary'),
  alternative_suggestions: text('alternative_suggestions'),
  decision: text('decision').default('pending'),
  image_url: text('image_url'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const dietMealOptions = pgTable('diet_meal_options', {
  id: text('id').primaryKey(),
  meal_type: text('meal_type').notNull(),
  option_number: integer('option_number').notNull().default(1),
  title: text('title').notNull(),
  description: text('description').notNull(),
  items_checklist: text('items_checklist').notNull(),
  calories: doublePrecision('calories').notNull().default(0),
  protein_g: doublePrecision('protein_g').notNull().default(0),
  carbs_g: doublePrecision('carbs_g').notNull().default(0),
  fat_g: doublePrecision('fat_g').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const userHealthProfile = pgTable('user_health_profile', {
  id: text('id').primaryKey(),
  member_id: text('member_id').references(() => familyMembers.id),
  daily_calorie_target: doublePrecision('daily_calorie_target').notNull().default(2200),
  target_protein_g: doublePrecision('target_protein_g').notNull().default(140),
  target_carbs_g: doublePrecision('target_carbs_g').notNull().default(180),
  target_fat_g: doublePrecision('target_fat_g').notNull().default(65),
  daily_water_target_ml: doublePrecision('daily_water_target_ml').notNull().default(2500),
  consumed_water_ml: doublePrecision('consumed_water_ml').notNull().default(1250),
  active_fasting_protocol: text('active_fasting_protocol').notNull().default('16:8'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const workoutSessions = pgTable('workout_sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  date: text('date').notNull(),
  start_time: text('start_time'),
  end_time: text('end_time'),
  duration_minutes: integer('duration_minutes').default(45),
  total_volume_kg: doublePrecision('total_volume_kg').default(0),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const workoutExerciseLogs = pgTable('workout_exercise_logs', {
  id: text('id').primaryKey(),
  workout_id: text('workout_id').notNull(),
  exercise_name: text('exercise_name').notNull(),
  category: text('category').notNull().default('gogus'),
  equipment: text('equipment').notNull().default('dumbbell'),
  sets_data: text('sets_data').notNull(),
  max_weight_kg: doublePrecision('max_weight_kg').default(0),
  total_reps: integer('total_reps').default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

// ==========================================
// 🗂️ FAZ 6: DİJİTAL KASA & EVRAK YÖNETİMİ
// ==========================================

export const digitalVaultItems = pgTable('digital_vault_items', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(),
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

export const importantDates = pgTable('important_dates', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  person_name: text('person_name').notNull(),
  event_type: text('event_type').notNull(),
  event_date: text('event_date').notNull(),
  is_recurring: integer('is_recurring').notNull().default(1),
  remind_days_before: integer('remind_days_before').default(7),
  gift_ideas: text('gift_ideas'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

export const petRecords = pgTable('pet_records', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  species: text('species').notNull(),
  breed: text('breed'),
  birth_date: text('birth_date'),
  chip_no: text('chip_no'),
  vaccinations: text('vaccinations'),
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

export const supplementRoutines = pgTable('supplement_routines', {
  id: text('id').primaryKey(),
  member_id: text('member_id'),
  name: text('name').notNull(),
  dose: text('dose').notNull(),
  timing: text('timing').notNull(),
  frequency_type: text('frequency_type').notNull().default('daily'),
  interval_days: integer('interval_days').notNull().default(1),
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

export const sleepLogs = pgTable('sleep_logs', {
  id: text('id').primaryKey(),
  member_id: text('member_id'),
  bedtime: text('bedtime').notNull(),
  wake_time: text('wake_time').notNull(),
  duration_hours: doublePrecision('duration_hours').notNull(),
  quality_rating: integer('quality_rating').notNull().default(3),
  notes: text('notes'),
  date: text('date').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const moodLogs = pgTable('mood_logs', {
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

export const waterIntakeLogs = pgTable('water_intake_logs', {
  id: text('id').primaryKey(),
  member_id: text('member_id'),
  date: text('date').notNull(),
  amount_ml: integer('amount_ml').notNull().default(0),
  goal_ml: integer('goal_ml').notNull().default(2500),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const biometrics = pgTable('biometrics', {
  id: text('id').primaryKey(),
  member_id: text('member_id'),
  weight_kg: doublePrecision('weight_kg'),
  waist_cm: doublePrecision('waist_cm'),
  body_fat_percent: doublePrecision('body_fat_percent'),
  blood_pressure_sys: integer('blood_pressure_sys'),
  blood_pressure_dia: integer('blood_pressure_dia'),
  resting_heart_rate: integer('resting_heart_rate'),
  date: text('date').notNull(),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const smartScaleLogs = pgTable('smart_scale_logs', {
  id: text('id').primaryKey(),
  member_id: text('member_id'),
  user_id: text('user_id'),
  measurement_date: text('measurement_date').notNull(),
  weight_kg: doublePrecision('weight_kg').notNull(),
  bmi: doublePrecision('bmi'),
  body_fat_percent: doublePrecision('body_fat_percent'),
  body_fat_mass_kg: doublePrecision('body_fat_mass_kg'),
  skeletal_muscle_percent: doublePrecision('skeletal_muscle_percent'),
  skeletal_muscle_mass_kg: doublePrecision('skeletal_muscle_mass_kg'),
  muscle_percent: doublePrecision('muscle_percent'),
  muscle_mass_kg: doublePrecision('muscle_mass_kg'),
  water_percent: doublePrecision('water_percent'),
  water_mass_kg: doublePrecision('water_mass_kg'),
  visceral_fat_rating: doublePrecision('visceral_fat_rating'),
  bone_mass_kg: doublePrecision('bone_mass_kg'),
  bmr_calories: doublePrecision('bmr_calories'),
  protein_percent: doublePrecision('protein_percent'),
  obesity_degree_percent: doublePrecision('obesity_degree_percent'),
  metabolic_age: doublePrecision('metabolic_age'),
  fat_free_mass_kg: doublePrecision('fat_free_mass_kg'),
  actual_age: integer('actual_age'),
  height_cm: integer('height_cm'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

// ==========================================
// 🛒 FAZ 6: AKILLI MARKET LİSTESİ
// ==========================================

export const shoppingListItems = pgTable('shopping_list_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  quantity: text('quantity').notNull().default('1'),
  unit: text('unit').default('adet'),
  category: text('category').default('Market'),
  is_checked: integer('is_checked').notNull().default(0),
  source: text('source').default('manual'),
  source_ref: text('source_ref'),
  estimated_price: doublePrecision('estimated_price').default(0),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  user_id: text('user_id')
});

// ==========================================
// ⚙️ FAZ 13: SİSTEM & TELEGRAM AYARLARI
// ==========================================

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_at: text('updated_at').notNull()
});

// ==========================================
// 🔐 FAZ 15: KULLANICI KAYIT & GÜVENLİK
// ==========================================

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  full_name: text('full_name').notNull(),
  email: text('email'),
  password_hash: text('password_hash').notNull(),
  password_salt: text('password_salt').notNull(),
  quick_pin_hash: text('quick_pin_hash').notNull(),
  role: text('role').notNull().default('admin'),
  avatar_emoji: text('avatar_emoji').default('👤'),
  is_master_account: integer('is_master_account').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const authSessions = pgTable('auth_sessions', {
  token: text('token').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id),
  expires_at: text('expires_at').notNull(),
  device_name: text('device_name').default('web-client'),
  created_at: text('created_at').notNull()
});

// ==========================================
// 💸 FAZ 15: BOŞTA DURAN NAKİTE FAİZ / NEMA
// ==========================================

export const flexInterestAccounts = pgTable('flex_interest_accounts', {
  id: text('id').primaryKey(),
  account_id: text('account_id').notNull().references(() => walletsAccounts.id),
  is_active: integer('is_active').notNull().default(0),
  annual_rate: doublePrecision('annual_rate').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const flexInterestEarnings = pgTable('flex_interest_earnings', {
  id: text('id').primaryKey(),
  flex_account_id: text('flex_account_id').references(() => flexInterestAccounts.id),
  wallet_account_id: text('wallet_account_id').notNull().references(() => walletsAccounts.id),
  start_date: text('start_date').notNull(),
  end_date: text('end_date').notNull(),
  days: integer('days').notNull(),
  principal_amount: doublePrecision('principal_amount').notNull(),
  interest_rate: doublePrecision('interest_rate').notNull(),
  earned_amount: doublePrecision('earned_amount').notNull(),
  actual_amount: doublePrecision('actual_amount').notNull(),
  currency: text('currency').notNull().default('TRY'),
  notes: text('notes'),
  created_at: text('created_at').notNull()
});
