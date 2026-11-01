import { describe, it, expect, vi, beforeEach } from 'vitest';

// Route Handlers to verify
import { GET as getVaultFile } from '../src/app/api/digital-vault/file/route';
import { POST as handleLibraryPost } from '../src/app/api/library/route';
import { POST as handleVehiclesPost } from '../src/app/api/vehicles/route';
import { POST as handleVehicleMaintenancePost } from '../src/app/api/vehicles/maintenance/route';
import { GET as getWater, POST as handleWaterPost } from '../src/app/api/health/water/route';
import { POST as handleShoppingListPost } from '../src/app/api/shopping-list/route';
import { POST as handleScaleLogsPost } from '../src/app/api/wellness/scale-logs/route';
import { GET as getDigitalVault } from '../src/app/api/digital-vault/route';
import { POST as handleDietPost } from '../src/app/api/health/diet/route';
import { POST as handleUploadCover } from '../src/app/api/library/upload-cover/route';
import { POST as handleScanInvoice } from '../src/app/api/home-operations/scan-invoice/route';
import { POST as handleScanDocument } from '../src/app/api/digital-vault/scan-document/route';
import { POST as handleScanReceipt } from '../src/app/api/shopping-list/scan-receipt/route';

import { normalizeBookCategory } from '../src/lib/book-categories';
import { getAuthUser } from '../src/lib/auth';

// Setup Mocks
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/lib/ai-vision', () => ({
  parseReceiptImage: vi.fn().mockResolvedValue({ amount: 100, items: [] }),
  parseVaultDocumentImage: vi.fn().mockResolvedValue({ title: 'Mock Document' }),
  parseApplianceInvoiceImage: vi.fn().mockResolvedValue({ brand: 'Mock Brand' })
}));

vi.mock('@/db', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
    transaction: (...args: any[]) => mockTransaction(...args),
  },
  initDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}));

function createSelectChain(data: any[]) {
  const obj: any = {};
  obj.from = vi.fn(() => obj);
  obj.where = vi.fn(() => obj);
  obj.orderBy = vi.fn(() => obj);
  obj.limit = vi.fn(() => Promise.resolve(data));
  obj.innerJoin = vi.fn(() => obj);
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(data).then(onFulfilled, onRejected);
  return obj;
}

function createUpdateChain(result: any = []) {
  const obj: any = { lastSet: null };
  obj.set = vi.fn((setObj: any) => {
    obj.lastSet = setObj;
    return obj;
  });
  obj.where = vi.fn(() => Promise.resolve(result));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(result).then(onFulfilled, onRejected);
  return obj;
}

function createInsertChain() {
  const obj: any = { lastValues: null, allValues: [] };
  obj.values = vi.fn((vals: any) => {
    obj.lastValues = vals;
    obj.allValues.push(vals);
    return Promise.resolve([vals]);
  });
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve([]).then(onFulfilled, onRejected);
  return obj;
}

function createDeleteChain() {
  const obj: any = {};
  obj.where = vi.fn(() => Promise.resolve([]));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve([]).then(onFulfilled, onRejected);
  return obj;
}

describe('🎯 Modül 3 Denetim Raporu Doğrulama Testleri (TDD Verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        select: (...args: any[]) => mockSelect(...args),
        insert: (...args: any[]) => mockInsert(...args),
        update: (...args: any[]) => mockUpdate(...args),
        delete: (...args: any[]) => mockDelete(...args),
      };
      return cb(tx);
    });
  });

  // =========================================================================
  // 1. KASA DOSYA İNDİRME GÜVENLİK TESTLERİ (BULGU 1)
  // =========================================================================
  describe('1. Kasa Dosya İndirmede Yetki ve 404 Kalkanı (Bulgu 1)', () => {
    it('vaultRecord === null (kayıtsız veya DBde bulunmayan dosya) durumunda doğrudan 404 dönmeli, yetkisiz disk okuması engellenmeli', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-1',
        family_id: 'fam-1',
        is_master_account: 0
      });

      // DB'de eşleşen kayıt bulunamadı
      mockSelect.mockReturnValue(createSelectChain([]));

      const req = new Request('http://localhost/api/digital-vault/file?filename=secret-document.pdf');
      const res = await getVaultFile(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Belge bulunamadı');
    });

    it('Başka kullanıcıya/aileye ait vaultRecord için 403 Forbidden dönmeli', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-attacker',
        family_id: 'fam-attacker',
        is_master_account: 0
      });

      // Belge kurban aileye ait
      mockSelect.mockReturnValue(createSelectChain([{
        id: 'vault-victim-1',
        user_id: 'usr-victim',
        family_id: 'fam-victim',
        title: 'Özel Kimlik',
        document_image_url: 'data:application/pdf;base64,JVBERi0xLjcK...',
        is_family_shared: 0
      }]));

      const req = new Request('http://localhost/api/digital-vault/file?id=vault-victim-1');
      const res = await getVaultFile(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Yetkisiz erişim');
    });

    it('Kullanıcı kendi ID si ile başkasına ait dosya adını (parameter confusion) çekmeye çalıştığında 403 ile engellenmelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-attacker',
        family_id: 'fam-attacker',
        is_master_account: 0
      });

      // Saldırganın kendi adına kayıtlı bir belgesi var
      mockSelect.mockReturnValue(createSelectChain([{
        id: 'vault-attacker-1',
        user_id: 'usr-attacker',
        family_id: 'fam-attacker',
        title: 'Saldırgan Belgesi',
        document_image_url: '/uploads/vault/my_own_doc.pdf',
        is_family_shared: 0
      }]));

      // Saldırgan kendi id'sini verip başkasının dosya adını parametre olarak sızdırmaya çalışıyor
      const req = new Request('http://localhost/api/digital-vault/file?id=vault-attacker-1&filename=victim_secret.pdf');
      const res = await getVaultFile(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('eşleşmiyor');
    });
  });

  // =========================================================================
  // 2. KİTAP VE ARAÇ GÜNCELLEMELERİNDE IDOR ENGELİ (BULGULAR 2, 3, 4)
  // =========================================================================
  describe('2. Kitap ve Araç Güncellemelerinde BOLA / IDOR Kalkanı (Bulgular 2, 3, 4)', () => {
    it('Kitap güncelleme eylemlerinde (toggle_lent, update_details, update_words_per_page, sayfa) başka kullanıcıya ait ID ile işlem 403 ile engellenmelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-attacker',
        family_id: 'fam-attacker',
        is_master_account: 0
      });

      // Saldırgan kurbanın kitabını hedefliyor, DB auth filtresi boş döner
      mockSelect.mockReturnValue(createSelectChain([]));

      // 1. toggle_lent denemesi
      const req1 = new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_lent', book_id: 'book-victim', is_lent_out: 1, lent_to_name: 'Hırsız' })
      });
      const res1 = await handleLibraryPost(req1);
      expect(res1.status).toBe(403);

      // 2. update_details denemesi
      const req2 = new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_details', book_id: 'book-victim', title: 'Hacked Title' })
      });
      const res2 = await handleLibraryPost(req2);
      expect(res2.status).toBe(403);

      // 3. update_words_per_page denemesi
      const req3 = new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_words_per_page', book_id: 'book-victim', words_per_page: 500 })
      });
      const res3 = await handleLibraryPost(req3);
      expect(res3.status).toBe(403);

      // 4. Hızlı sayfa güncelleme denemesi
      const req4 = new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: 'book-victim', current_page: 150 })
      });
      const res4 = await handleLibraryPost(req4);
      expect(res4.status).toBe(403);
    });

    it('Araç yasal hatırlatıcı işlemlerinde ve bakım kaydında başka araca ait ID ile işlem 403 ile engellenmelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-attacker',
        family_id: 'fam-attacker'
      });

      // Araç saldırgana ait değil (boş dönüyor)
      mockSelect.mockReturnValue(createSelectChain([]));

      // 1. add_legal denemesi
      const req1 = new Request('http://localhost/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_legal', vehicle_id: 'veh-victim', type: 'muayene', due_date: '2026-12-01' })
      });
      const res1 = await handleVehiclesPost(req1);
      expect(res1.status).toBe(403);

      // 2. update_legal_dates denemesi
      const req2 = new Request('http://localhost/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_legal_dates', vehicle_id: 'veh-victim', muayene_date: '2026-12-01' })
      });
      const res2 = await handleVehiclesPost(req2);
      expect(res2.status).toBe(403);

      // 3. auto_generate_legal denemesi
      const req3 = new Request('http://localhost/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_generate_legal', vehicle_id: 'veh-victim' })
      });
      const res3 = await handleVehiclesPost(req3);
      expect(res3.status).toBe(403);

      // 4. vehicle maintenance post denemesi
      const req4 = new Request('http://localhost/api/vehicles/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_id: 'veh-victim', km_at_service: '60000', cost: 3500 })
      });
      const res4 = await handleVehicleMaintenancePost(req4);
      expect(res4.status).toBe(403);
    });
  });

  // =========================================================================
  // 3. SU SAYACINDA YENİ GÜN SIFIRLANMASI (BULGU 11)
  // =========================================================================
  describe('3. Gece Yarısı Su Sayacı Devri ve Sıfırlanması (Bulgu 11)', () => {
    it('Yeni gün başladığında bugün için su kaydı yoksa dünün tüketimi aktarılmamalı, 0 ml kabul edilmelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-1',
        family_id: 'fam-1'
      });

      // 1. çağrı: userHealthProfile (dünden kalan 2500ml var)
      // 2. çağrı: waterIntakeLogs (bugün için kayıt YOK)
      mockSelect
        .mockReturnValueOnce(createSelectChain([{
          id: 'hp-1',
          user_id: 'usr-1',
          consumed_water_ml: 2500, // Dünden kalan değer
          daily_water_target_ml: 2500
        }]))
        .mockReturnValueOnce(createSelectChain([])); // Bugün için log yok

      const res = await getWater();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.consumed_ml).toBe(0); // Dünden kalan 2500ml sıfırlanmış olarak 0ml dönmeli!
      expect(data.data.percentage).toBe(0);
    });

    it('Yeni günün ilk su içme kaydı dünün değerini eklemek yerine 0 dan başlatmalıdır', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-1',
        family_id: 'fam-1'
      });

      // Profilde dünden kalan 2200 ml var ama bugün için log yok
      mockSelect
        .mockReturnValueOnce(createSelectChain([{
          id: 'hp-1',
          user_id: 'usr-1',
          consumed_water_ml: 2200,
          daily_water_target_ml: 2500
        }]))
        .mockReturnValueOnce(createSelectChain([])); // Bugün log yok

      const updateChain = createUpdateChain();
      mockUpdate.mockReturnValue(updateChain);
      const insertChain = createInsertChain();
      mockInsert.mockReturnValue(insertChain);

      const req = new Request('http://localhost/api/health/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ml: 300 })
      });

      const res = await handleWaterPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.consumed_ml).toBe(300); // 2200 + 300 = 2500 DEĞİL, 0 + 300 = 300 ml olmalı!
    });
  });

  // =========================================================================
  // 4. ALIŞVERİŞ LİSTESİ ATOMİK BAKİYE DÜŞÜMÜ (BULGULAR 5 & 10)
  // =========================================================================
  describe('4. Alışveriş Listesi Atomik SQL Bakiye Düşümü & İzolasyon (Bulgular 5, 10)', () => {
    it('checkout_to_wallet eylemi bakiyeyi atomik SQL decrement ifadesi ile güncellemelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-1',
        family_id: 'fam-1'
      });

      // 1. checked shoppingListItems
      const checkedItems = [
        { id: 'item-1', name: 'Süt', estimated_price: 40, is_checked: 1 },
        { id: 'item-2', name: 'Yumurta', estimated_price: 60, is_checked: 1 }
      ];
      // 2. wallet
      const wallet = [{
        id: 'wal-1',
        name: 'Vadesiz Hesap',
        balance: 1000,
        type: 'checking',
        user_id: 'usr-1',
        family_id: 'fam-1'
      }];
      // 3. categories
      const categories = [{ id: 'cat-market', name: 'Market' }];

      mockSelect
        .mockReturnValueOnce(createSelectChain(checkedItems))
        .mockReturnValueOnce(createSelectChain(wallet))
        .mockReturnValueOnce(createSelectChain(categories));

      const updateChain = createUpdateChain();
      mockUpdate.mockReturnValue(updateChain);
      const insertChain = createInsertChain();
      mockInsert.mockReturnValue(insertChain);
      mockDelete.mockReturnValue(createDeleteChain());

      const req = new Request('http://localhost/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout_to_wallet', wallet_id: 'wal-1' })
      });

      const res = await handleShoppingListPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Atomik SQL ifadesi doğrulaması
      expect(updateChain.lastSet).toBeDefined();
      expect(typeof updateChain.lastSet.balance).toBe('object'); // Drizzle SQL expression object
    });

    it('shopping-list toggle ve delete işlemleri başka kullanıcının ürünü için 403 dönmelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-attacker',
        family_id: 'fam-attacker'
      });

      // Kullanıcının listesinde ürün bulunamadı
      mockSelect.mockReturnValue(createSelectChain([]));

      // 1. toggle denemesi
      const req1 = new Request('http://localhost/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id: 'victim-item' })
      });
      const res1 = await handleShoppingListPost(req1);
      expect(res1.status).toBe(403);

      // 2. delete denemesi
      const req2 = new Request('http://localhost/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: 'victim-item' })
      });
      const res2 = await handleShoppingListPost(req2);
      expect(res2.status).toBe(403);
    });
  });

  // =========================================================================
  // 5. KİTAP KATEGORİSİ EŞLEŞTİRMESİNDE KISA TOKEN KORUMASI (BULGU 24)
  // =========================================================================
  describe('5. Kitap Kategorisi Normalizasyonunda Kısa Token Aşırı Eşleşme Koruması (Bulgu 24)', () => {
    it('"Art" kategorisi "Bilgisayar (Artificial Intelligence)" ile değil, "Sanat" ile eşleşmelidir', () => {
      expect(normalizeBookCategory('Art')).toBe('Sanat');
      expect(normalizeBookCategory('art')).toBe('Sanat');
    });

    it('"Holding" gibi kelimeler içinde "din" geçiyor diye "Din" kategorisine atanmamalıdır', () => {
      const result = normalizeBookCategory('Holding Management');
      expect(result).not.toBe('Din');
    });

    it('"Part" veya "Smart" kelimeleri "Sanat (Art)" kategorisi ile eşleşmemelidir', () => {
      const result = normalizeBookCategory('Smart Systems');
      expect(result).not.toBe('Sanat');
    });
  });

  // =========================================================================
  // 6. ÖNEMLİ GÜNLERDE DD.MM.YYYY VE BASE64 LİSTELEME GÜVENLİĞİ (BULGU 17 & 19)
  // =========================================================================
  describe('6. Dijital Kasa Tarih Formatı ve Liste Güvenliği (Bulgular 17 & 19)', () => {
    it('DD.MM.YYYY formatındaki tarihler (örn: 15.04.1990) 5 yıllık takvim sapmasına yol açmamalıdır', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-1',
        family_id: 'fam-1'
      });

      mockSelect
        .mockReturnValueOnce(createSelectChain([])) // vault items
        .mockReturnValueOnce(createSelectChain([
          { id: 'date-1', title: 'Doğum Günü', event_date: '15.04.1990' }
        ])) // important dates
        .mockReturnValueOnce(createSelectChain([])); // pets

      const res = await getDigitalVault();
      const data = await res.json();

      expect(res.status).toBe(200);
      const dates = data.data.importantDates;
      expect(dates.length).toBe(1);
      // next_date bu yıl veya gelecek yılın 15 Nisan günü olmalı (asla 1990 gün sonrası değil)
      expect(dates[0].next_date).toMatch(/-04-15$/);
      expect(dates[0].days_left).toBeLessThanOrEqual(366);
    });

    it('Kasa listelemesinde (GET) dev Base64 string doğrudan JSON a basılmamalı, file linkine çevrilmelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-1',
        family_id: 'fam-1'
      });

      const hugeBase64 = 'data:application/pdf;base64,' + 'A'.repeat(50000);
      mockSelect
        .mockReturnValueOnce(createSelectChain([
          { id: 'v-1', title: 'Tapu', document_image_url: hugeBase64 }
        ]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]));

      const res = await getDigitalVault();
      const data = await res.json();

      expect(res.status).toBe(200);
      const vaultItem = data.data.vaultItems[0];
      expect(vaultItem.document_image_url).toBe('/api/digital-vault/file?id=v-1');
      expect(vaultItem.has_file).toBe(true);
    });

    it('Bugün olan doğum günlerinde sayaç 0 gün göstermeli, gelecek yıla (365 güne) atlamamalıdır', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-1',
        family_id: 'fam-1'
      });

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const todayDateStr = `${dd}.${mm}.1995`;

      mockSelect
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([
          { id: 'date-today', title: 'Bugünkü Doğum Günü', event_date: todayDateStr }
        ]))
        .mockReturnValueOnce(createSelectChain([]));

      const res = await getDigitalVault();
      const data = await res.json();

      expect(res.status).toBe(200);
      const dates = data.data.importantDates;
      expect(dates.length).toBe(1);
      expect(dates[0].days_left).toBe(0);
    });
  });

  // =========================================================================
  // 7. AKILLI TARTI LOGLARINDA NEGATİF AĞIRLIK VE GEÇMİŞ TARİH KORUMASI (BULGU 15)
  // =========================================================================
  describe('7. Akıllı Tartı Kayıtlarında Veri Bütünlüğü (Bulgu 15)', () => {
    it('Negatif veya 0 ağırlık değerleri 400 Bad Request ile reddedilmelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-1',
        family_id: 'fam-1'
      });

      const invalidWeights = [-5, 0, 'abc', '-75.5'];

      for (const w of invalidWeights) {
        const req = new Request('http://localhost/api/wellness/scale-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weight_kg: w })
        });

        const res = await handleScaleLogsPost(req);
        expect(res.status).toBe(400);
      }
    });

    it('2024 ve 2025 gibi geçerli geçmiş ölçüm tarihleri bugüne zorla ezilmemelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-1',
        family_id: 'fam-1'
      });

      const insertChain = createInsertChain();
      mockInsert.mockReturnValue(insertChain);

      const req = new Request('http://localhost/api/wellness/scale-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_kg: 82.5, measurement_date: '2025-06-15 08:30:00' })
      });

      const res = await handleScaleLogsPost(req);
      expect(res.status).toBe(200);
      expect(insertChain.allValues[0].measurement_date).toBe('2025-06-15 08:30:00');
    });
  });

  // =========================================================================
  // 8. DİYET MENÜLERİNDE 0 MAKRO DEĞERLERİNİN KORUNMASI (BULGU 14)
  // =========================================================================
  describe('8. Diyet Menüsü Makrolarında Falsy 0 Değerlerinin Korunması (Bulgu 14)', () => {
    it('0 gram yağ veya 0 gram karbonhidrat içeren menülerde 0 değeri ezilmemelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-1',
        family_id: 'fam-1'
      });

      mockSelect.mockReturnValue(createSelectChain([])); // familyMembers
      const insertChain = createInsertChain();
      mockInsert.mockReturnValue(insertChain);

      const req = new Request('http://localhost/api/health/diet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_title: 'Sıfır Yağlı Protein Öğünü',
          calories: 250,
          protein_g: 50,
          carbs_g: 0,
          fat_g: 0
        })
      });

      const res = await handleDietPost(req);
      expect(res.status).toBe(200);
      expect(insertChain.lastValues.fat_g).toBe(0); // 15'e ezilmemeli!
      expect(insertChain.lastValues.carbs_g).toBe(0); // 35'e ezilmemeli!
    });
  });

  // =========================================================================
  // 9. DOSYA YÜKLEMEDE UZANTI VE MIME GÜVENLİK FİLTRESİ (BULGU 7)
  // =========================================================================
  describe('9. Dosya Yüklemelerinde Katı Uzantı ve MIME Kalkanı (Bulgu 7)', () => {
    it('.exe veya .sh gibi zararlı uzantılar sahte image/jpeg MIME tipi ile yüklense dahi 400 ile engellenmelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'usr-1',
        family_id: 'fam-1'
      });

      // 1. upload-cover rotası
      const maliciousFile1 = new File(['fake-exe-content'], 'malware.exe', { type: 'image/jpeg' });
      const formData1 = new FormData();
      formData1.append('file', maliciousFile1);

      const req1 = new Request('http://localhost/api/library/upload-cover', {
        method: 'POST',
        body: formData1
      });
      const res1 = await handleUploadCover(req1);
      expect(res1.status).toBe(400);

      // 2. scan-invoice rotası
      const maliciousFile2 = new File(['fake-script'], 'exploit.sh', { type: 'image/png' });
      const formData2 = new FormData();
      formData2.append('file', maliciousFile2);

      const req2 = new Request('http://localhost/api/home-operations/scan-invoice', {
        method: 'POST',
        body: formData2
      });
      const res2 = await handleScanInvoice(req2);
      expect(res2.status).toBe(400);

      // 3. scan-document rotası
      const formData3 = new FormData();
      formData3.append('file', new File(['malicious'], 'payload.exe', { type: 'application/pdf' }));
      const req3 = new Request('http://localhost/api/digital-vault/scan-document', {
        method: 'POST',
        body: formData3
      });
      const res3 = await handleScanDocument(req3);
      expect(res3.status).toBe(400);

      // 4. scan-receipt rotası
      const formData4 = new FormData();
      formData4.append('file', new File(['malicious'], 'script.php', { type: 'image/jpeg' }));
      const req4 = new Request('http://localhost/api/shopping-list/scan-receipt', {
        method: 'POST',
        body: formData4
      });
      const res4 = await handleScanReceipt(req4);
      expect(res4.status).toBe(400);
    });
  });

  // =========================================================================
  // 10. ÇAPRAZ MODÜL EVENT BUS KULLANICI / AİLE İZOLASYONU (BULGULAR 9 & 10)
  // =========================================================================
  describe('10. Event Bus Çapraz Modül Bildirimlerinde Kullanıcı/Aile İzolasyonu (Bulgular 9 & 10)', () => {
    it('shopping-list checkout_to_wallet eylemi TRANSACTION_CREATED olayında userId ve familyId göndermelidir', async () => {
      const { eventBus, EVENTS } = await import('../src/lib/events');
      const emitSpy = vi.spyOn(eventBus, 'emit');

      (getAuthUser as any).mockResolvedValue({
        id: 'usr-buyer',
        family_id: 'fam-buyer'
      });

      mockSelect
        .mockReturnValueOnce(createSelectChain([{ id: 'item-1', name: 'Zeytin', estimated_price: 80, is_checked: 1 }]))
        .mockReturnValueOnce(createSelectChain([{ id: 'wal-1', balance: 500, type: 'checking', user_id: 'usr-buyer' }]))
        .mockReturnValueOnce(createSelectChain([{ id: 'cat-market', name: 'Market' }]));

      mockUpdate.mockReturnValue(createUpdateChain());
      mockInsert.mockReturnValue(createInsertChain());
      mockDelete.mockReturnValue(createDeleteChain());

      const req = new Request('http://localhost/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout_to_wallet', wallet_id: 'wal-1' })
      });

      const res = await handleShoppingListPost(req);
      expect(res.status).toBe(200);

      expect(emitSpy).toHaveBeenCalledWith(
        EVENTS.TRANSACTION_CREATED,
        expect.objectContaining({
          userId: 'usr-buyer',
          familyId: 'fam-buyer'
        })
      );

      emitSpy.mockRestore();
    });
  });
});
