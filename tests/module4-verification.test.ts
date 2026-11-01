import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Modules under test
import { parseTurkishNumber, parseGibKarekodText, parseEBelgeHtml, parseUblTrXml, isSafeEBelgeUrl } from '../src/lib/ebelge-parser';
import { SAFE_EXPORT_TABLES } from '../src/lib/backup-tables';
import { POST as handleBackupPost, GET as handleBackupGet } from '../src/app/api/backup/route';
import { POST as handleTelegramPost, GET as handleTelegramGet } from '../src/app/api/telegram/route';
import { POST as handleVoiceCommandPost } from '../src/app/api/voice-command/route';
import { POST as handleScanReceiptPost } from '../src/app/api/scan-receipt/route';
import { POST as handleScanInvoicePost } from '../src/app/api/home-operations/scan-invoice/route';
import { POST as handleShoppingListScanReceipt } from '../src/app/api/shopping-list/scan-receipt/route';
import { RESILIENT_GEMINI_MODELS, parseReceiptImage, parseVaultDocumentImage } from '../src/lib/ai-vision';
import { parseTimeToCentiseconds, parseTimeToSeconds } from '../src/lib/workout-ocr';
import { getStravaConfig, mapStravaActivityToWorkout } from '../src/lib/strava';
import { getAuthUser } from '../src/lib/auth';

// Mocks
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
    transaction: (cb: any) => mockTransaction(cb),
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
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(data).then(onFulfilled, onRejected);
  return obj;
}

function createInsertChain() {
  const obj: any = {};
  obj.values = vi.fn(() => obj);
  obj.onConflictDoNothing = vi.fn(() => Promise.resolve({ rowCount: 1 }));
  obj.onConflictDoUpdate = vi.fn(() => Promise.resolve({ rowCount: 1 }));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve({ rowCount: 1 }).then(onFulfilled, onRejected);
  return obj;
}

function createUpdateChain() {
  const obj: any = {};
  obj.set = vi.fn(() => obj);
  obj.where = vi.fn(() => Promise.resolve({ rowCount: 1 }));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve({ rowCount: 1 }).then(onFulfilled, onRejected);
  return obj;
}

describe('🎯 Modül 4 Denetim Raporu Bulguları Doğrulama Testleri (TDD Verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockImplementation(() => createSelectChain([]));
    mockInsert.mockImplementation(() => createInsertChain());
    mockUpdate.mockImplementation(() => createUpdateChain());
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        insert: vi.fn(() => createInsertChain()),
        update: vi.fn(() => createUpdateChain()),
        select: vi.fn(() => createSelectChain([])),
      };
      return await cb(tx);
    });
  });

  // =========================================================================
  // 1. parseTurkishNumber - 1000 Kat Tutar Hatasının Önlenmesi (Bulgu 3)
  // =========================================================================
  describe('1. parseTurkishNumber ve Sayısal Doğruluk (Bulgu 3)', () => {
    it('şartnamede belirtilen kritik Türkçe formatları kuruş ve binlikleri tam ayrıştırmalıdır', () => {
      // Görevde kesin istenen 4 değer:
      expect(parseTurkishNumber("1.250,50")).toBe(1250.50);
      expect(parseTurkishNumber("1.250 TL")).toBe(1250);
      expect(parseTurkishNumber("500,25")).toBe(500.25);
      expect(parseTurkishNumber("150")).toBe(150);

      // Ekstra sınır ve milyonluk durumlar
      expect(parseTurkishNumber("1.250.000 TL")).toBe(1250000);
      expect(parseTurkishNumber("1.250.000,75 ₺")).toBe(1250000.75);
      expect(parseTurkishNumber("1,250,000")).toBe(1250000);
      expect(parseTurkishNumber("-1.250,50")).toBe(-1250.5);
      expect(parseTurkishNumber("1.25")).toBe(1.25);
      expect(parseTurkishNumber("1 250,50")).toBe(1250.5);
      expect(parseTurkishNumber("0")).toBe(0);
      expect(parseTurkishNumber("")).toBe(0);
      expect(parseTurkishNumber(null)).toBe(0);
      expect(parseTurkishNumber(undefined)).toBe(0);
      expect(parseTurkishNumber(450.75)).toBe(450.75);
    });

    it('GİB karekod ayrıştırmasında 1000 kat hata oluşmamalıdır', () => {
      const gibText = "VKN:6220529513|TKN:12345678901|TARIH:2026-10-24|SAAT:15:46:00|TOPLAM:1.250,50|KDV:125,05|ETTN:test-uuid";
      const result = parseGibKarekodText(gibText);
      expect(result).not.toBeNull();
      expect(result?.amount).toBe(1250.50);
      expect(result?.tax_amount).toBe(125.05);
    });

    it('HTML fatura tutarı ayrıştırılırken 1000 kat hata oluşmamalıdır', () => {
      const html = `
        <table>
          <tr><td>Mağaza:</td><td>MİGROS TİCARET A.Ş.</td></tr>
          <tr><td>Fatura Tarihi:</td><td>24/10/2026</td></tr>
          <tr><td>FATURA TOPLAMI:</td><td>1.250,50 TL</td></tr>
          <tr><td>TOPLAM KDV:</td><td>125,05 TL</td></tr>
        </table>
      `;
      const result = parseEBelgeHtml(html, 'https://fitbulut.com/invoice/123');
      expect(result.amount).toBe(1250.50);
      expect(result.tax_amount).toBe(125.05);
    });
  });

  // =========================================================================
  // 2. Yedekleme & Geri Yükleme Sıralaması, families ve diet_meal_options (Bulgu 1, 9, 14, 15)
  // =========================================================================
  describe('2. Backup / Restore Tablo Sıralaması ve Bütünlüğü (Bulgu 1, 9, 14, 15)', () => {
    it('SAFE_EXPORT_TABLES listesinin EN BAŞINDA families tablosu yer almalıdır (Bulgu 1 & 9)', () => {
      expect(SAFE_EXPORT_TABLES.length).toBeGreaterThan(0);
      expect(SAFE_EXPORT_TABLES[0].name).toBe('families');
    });

    it('SAFE_EXPORT_TABLES listesinde diet_meal_options tablosu yer almalıdır (Bulgu 15)', () => {
      const found = SAFE_EXPORT_TABLES.find(t => t.name === 'diet_meal_options');
      expect(found).toBeDefined();
    });

    it('Restore işlemi db.transaction() içinde çalışmalı ve aileyi en başta güvenceye almalıdır', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
        family_id: 'fam-1',
        full_name: 'Admin User'
      });

      const restorePayload = {
        action: 'restore',
        data: {
          families: [{ id: 'fam-1', name: 'Test Ailesi' }],
          wallets_accounts: [{ id: 'w-1', name: 'Nakit Cüzdan', user_id: 'member-2', family_id: 'fam-1' }]
        }
      };

      const req = new Request('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restorePayload)
      });

      const res = await handleBackupPost(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('Restore işlemi diğer aile üyelerinin user_id alanlarını ezmemelidir (Multi-tenant preservation)', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
        family_id: 'fam-1',
        full_name: 'Admin User'
      });

      let capturedRows: any[] = [];
      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          insert: vi.fn(() => ({
            values: (val: any) => {
              if (Array.isArray(val)) capturedRows.push(...val);
              else capturedRows.push(val);
              return {
                onConflictDoNothing: vi.fn().mockResolvedValue({ rowCount: 1 })
              };
            }
          }))
        };
        return await cb(tx);
      });

      const restorePayload = {
        action: 'restore',
        data: {
          wallets_accounts: [
            { id: 'w-member', name: 'Eş Cüzdanı', user_id: 'user-spouse', family_id: 'fam-1' },
            { id: 'w-legacy', name: 'Eski Cüzdan', user_id: null, family_id: 'fam-1' }
          ]
        }
      };

      const req = new Request('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restorePayload)
      });

      const res = await handleBackupPost(req);
      const json = await res.json();

      expect(json.success).toBe(true);

      const spouseWallet = capturedRows.find(r => r.id === 'w-member');
      const legacyWallet = capturedRows.find(r => r.id === 'w-legacy');

      // user-spouse ezilmemeli, korunmalı
      expect(spouseWallet?.user_id).toBe('user-spouse');
      // user_id null olan ise admin id'sini almalı
      expect(legacyWallet?.user_id).toBe('admin-1');
    });
  });

  // =========================================================================
  // 3. AES-256 Şifreli Yedek Yükleme (Encrypt -> Decrypt Restore - Bulgu 2 & 9)
  // =========================================================================
  describe('3. AES-256 Şifreli Yedekleme ve Çözme (Bulgu 2 & 9)', () => {
    it('AES-256 ile şifrelenen bir yedek doğru parola ile çözülüp restore edilebilmelidir', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
        family_id: 'fam-1',
        full_name: 'Admin User'
      });

      const testData = {
        wallets_accounts: [{ id: 'w-secure-1', name: 'Gizli Kasa Hesabı', user_id: 'admin-1', family_id: 'fam-1' }]
      };
      const passphrase = 'SuperSecretPassword123!';

      // AES-256 Şifreleme Simülasyonu (route.ts'deki encrypted_backup mantığı)
      const salt = crypto.randomBytes(16);
      const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(JSON.stringify({ data: testData }), 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const encryptedPayload = {
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        cipher: 'aes-256-cbc',
        data: encrypted
      };

      // 1. Doğru parola ile restore
      const reqValid = new Request('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          passphrase,
          encryptedPayload
        })
      });

      const resValid = await handleBackupPost(reqValid);
      const jsonValid = await resValid.json();

      expect(jsonValid.success).toBe(true);
      expect(jsonValid.total_restored).toBeGreaterThanOrEqual(1);

      // 2. Yanlış parola ile restore denemesi 400 hatası vermeli
      const reqInvalid = new Request('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          passphrase: 'WrongPassword456!',
          encryptedPayload
        })
      });

      const resInvalid = await handleBackupPost(reqInvalid);
      const jsonInvalid = await resInvalid.json();

      expect(resInvalid.status).toBe(400);
      expect(jsonInvalid.success).toBe(false);
      expect(jsonInvalid.error).toContain('Şifreli yedek çözülemedi');
    });
  });

  // =========================================================================
  // 4. Telegram Webhook Açık Röle & Secret Token Koruması (Bulgu 4, 7, 8, 20)
  // =========================================================================
  describe('4. Telegram Webhook Güvenliği ve Fotoğraf/Ses İşleme (Bulgu 4, 7, 8, 20)', () => {
    it('secret token içermeyen veya geçersiz olan webhook isteklerini anında 403 ile kesmelidir (Açık Röle Engeli)', async () => {
      process.env.TELEGRAM_SECRET_TOKEN = 'expected-secret-token-xyz';

      const fakeWebhookPayload = {
        message: {
          chat: { id: 987654321 },
          text: 'Rastgele saldırgan komutu'
        }
      };

      // Header yok
      const reqNoSecret = new Request('http://localhost:3000/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fakeWebhookPayload)
      });

      const resNoSecret = await handleTelegramPost(reqNoSecret);
      expect(resNoSecret.status).toBe(403);
      // DB sorgusu yapılmadan engellenmelidir
      expect(mockSelect).not.toHaveBeenCalled();

      // Yanlış Header
      const reqBadSecret = new Request('http://localhost:3000/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': 'wrong-secret'
        },
        body: JSON.stringify(fakeWebhookPayload)
      });

      const resBadSecret = await handleTelegramPost(reqBadSecret);
      expect(resBadSecret.status).toBe(403);
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('GET /api/telegram yapılandırmasında secret_token_masked ve has_secret_token dönmelidir (Bulgu 7)', async () => {
      (getAuthUser as any).mockResolvedValue({
        id: 'user-1',
        telegram_bot_token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        telegram_chat_id: '99887766',
        telegram_secret_token: 'mysecrettoken123',
        telegram_enabled: 1
      });

      const res = await handleTelegramGet();
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.has_secret_token).toBe(true);
      expect(json.data.secret_token_masked).toContain('...');
    });

    it('geçerli secret token ile gelen webhook metin mesajını hatasız işlemelidir (text ReferenceError önlemi)', async () => {
      process.env.TELEGRAM_SECRET_TOKEN = 'valid-secret-123';

      mockSelect.mockImplementation(() => createSelectChain([
        {
          id: 'user-1',
          telegram_chat_id: '987654321',
          telegram_secret_token: 'valid-secret-123',
          full_name: 'Test Kullanıcı',
          family_id: 'fam-1'
        }
      ]));

      const validWebhookPayload = {
        message: {
          chat: { id: 987654321 },
          text: '/start'
        }
      };

      const req = new Request('http://localhost:3000/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': 'valid-secret-123'
        },
        body: JSON.stringify(validWebhookPayload)
      });

      const res = await handleTelegramPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.replied).toContain('Singularity Life OS Botuna Hoş Geldiniz');
    });
  });

  // =========================================================================
  // 5. Resmi Gemini Modelleri ve Markdown Fence Temizliği (Bulgu 5, 10, 11)
  // =========================================================================
  describe('5. AI Vision Resmi Modeller & JSON Markdown Temizliği (Bulgu 5, 10, 11)', () => {
    it('RESILIENT_GEMINI_MODELS sadece resmi Google Gemini modellerini içermelidir (Bulgu 5)', () => {
      // gemini-3.8, gemini-3.5, gemini-3.1-flash-lite listede OLMAMALIDIR
      for (const model of RESILIENT_GEMINI_MODELS) {
        expect(model).not.toContain('gemini-3.8');
        expect(model).not.toContain('gemini-3.5');
        expect(model).not.toContain('gemini-3.1');
      }

      expect(RESILIENT_GEMINI_MODELS).toContain('gemini-2.5-flash');
      expect(RESILIENT_GEMINI_MODELS).toContain('gemini-2.0-flash');
    });

    it('parseReceiptImage markdown kod bloğu içine alınmış JSON cevabını hatasız ayrıştırmalıdır (Bulgu 10)', async () => {
      const mockRawJson = '```json\n{\n  "merchant": "MİGROS T.A.Ş.",\n  "amount": 350.50,\n  "currency": "TRY",\n  "category_suggestion": "Market & Gıda",\n  "items": []\n}\n```';

      // Global fetch simülasyonu
      const originalFetch = global.fetch;
      process.env.GEMINI_API_KEY = 'mock-key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: mockRawJson }] } }]
        })
      } as any);

      try {
        const result = await parseReceiptImage('base64dummydata');
        expect(result.merchant).toBe('MİGROS T.A.Ş.');
        expect(result.amount).toBe(350.50);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('parseVaultDocumentImage markdown kod bloğunu temizleyip belge nesnesini dönmelidir', async () => {
      const mockVaultJson = '```json\n{\n  "title": "T.C. Pasaport",\n  "type": "passport",\n  "owner": "Uğur Özdemir"\n}\n```';

      const originalFetch = global.fetch;
      process.env.GEMINI_API_KEY = 'mock-key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: mockVaultJson }] } }]
        })
      } as any);

      try {
        const result = await parseVaultDocumentImage('base64dummydata');
        expect(result.title).toBe('T.C. Pasaport');
        expect(result.type).toBe('passport');
        expect(result.owner).toBe('Uğur Özdemir');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // =========================================================================
  // 6. Workout OCR Salise 60 Kat Çarpım Hatası Düzeltmesi (Bulgu 12)
  // =========================================================================
  describe('6. Workout OCR Salise Dönüşüm Doğruluğu (Bulgu 12)', () => {
    it('parseTimeToCentiseconds saniye cinsinden sayı verildiğinde 60 kat çarpmamalı, tam 100 ile çarpmalıdır', () => {
      // 120.5 saniye = 12050 salise olmalıdır (60 kat çarparsa 723000 çıkıyordu)
      const durationSeconds = 120.5;
      const centis = parseTimeToCentiseconds(durationSeconds);
      expect(centis).toBe(12050);

      // Metin formatı "02:00.50" (2 dk 0.50 sn = 120.5 sn)
      expect(parseTimeToCentiseconds("02:00.50")).toBe(12050);
    });
  });

  // =========================================================================
  // 7. e-Belge SSRF, Body Limit ve UBL-TR XML Desteği (Bulgu 13 & 21)
  // =========================================================================
  describe('7. e-Belge SSRF ve UBL-TR XML Ayrıştırma (Bulgu 13 & 21)', () => {
    it('isSafeEBelgeUrl iç ağ IP adreslerini ve güvensiz protokolleri engellemelidir', () => {
      expect(isSafeEBelgeUrl('http://gib.gov.tr/invoice')).toBe(false); // HTTP yasak
      expect(isSafeEBelgeUrl('https://localhost:3000')).toBe(false);
      expect(isSafeEBelgeUrl('https://127.0.0.1/doc')).toBe(false);
      expect(isSafeEBelgeUrl('https://169.254.169.254/metadata')).toBe(false); // Cloud metadata
      expect(isSafeEBelgeUrl('https://192.168.1.1/admin')).toBe(false);
      expect(isSafeEBelgeUrl('https://fitbulut.com/invoice/view')).toBe(true);
      expect(isSafeEBelgeUrl('https://ebelge.gib.gov.tr/fatura')).toBe(true);
    });

    it('parseUblTrXml UBL-TR e-Fatura XML verisini tam doğrulukla ayrıştırmalıdır', () => {
      const ublXml = `<?xml version="1.0" encoding="UTF-8"?>
        <Invoice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
          <cbc:ID>GIB2026000000001</cbc:ID>
          <cbc:UUID>e5d3c2b1-1234-4567-89ab-cdef01234567</cbc:UUID>
          <cbc:IssueDate>2026-10-25</cbc:IssueDate>
          <cac:AccountingSupplierParty>
            <cac:Party>
              <cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification>
              <cac:PartyName><cbc:Name>Teknoloji Market A.Ş.</cbc:Name></cac:PartyName>
            </cac:Party>
          </cac:AccountingSupplierParty>
          <cac:TaxTotal>
            <cbc:TaxAmount currencyID="TRY">250.00</cbc:TaxAmount>
          </cac:TaxTotal>
          <cac:LegalMonetaryTotal>
            <cbc:PayableAmount currencyID="TRY">1.500,00</cbc:PayableAmount>
          </cac:LegalMonetaryTotal>
          <cac:InvoiceLine>
            <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
            <cac:Item><cbc:Name>Mekanik Klavye</cbc:Name></cac:Item>
            <cac:Price><cbc:PriceAmount currencyID="TRY">1.500,00</cbc:PriceAmount></cac:Price>
          </cac:InvoiceLine>
        </Invoice>`;

      const result = parseUblTrXml(ublXml);
      expect(result).not.toBeNull();
      expect(result?.merchant).toBe('Teknoloji Market A.Ş.');
      expect(result?.amount).toBe(1500.00);
      expect(result?.tax_amount).toBe(250.00);
      expect(result?.reference_number).toBe('GIB2026000000001');
      expect(result?.ettn).toBe('e5d3c2b1-1234-4567-89ab-cdef01234567');
      expect(result?.items.length).toBe(1);
      expect(result?.items[0].name).toBe('Mekanik Klavye');
    });
  });

  // =========================================================================
  // 8. Voice Command Güvenliği ve Dinamik Cüzdan (Bulgu 6 & 16)
  // =========================================================================
  describe('8. Voice Command Tip Doğrulaması ve Dinamik Cüzdan (Bulgu 6 & 16)', () => {
    it('Sesli komut ayrıştırmasında "1.250 TL harcadım" 1250 olarak yakalanmalıdır', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' });

      const req = new Request('http://localhost:3000/api/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: "Migros'ta 1.250 TL harcadım" })
      });

      const res = await handleVoiceCommandPost(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.actions.length).toBe(1);
      expect(json.actions[0].details.amount).toBe(1250);
      expect(json.actions[0].details.merchant).toBe('Migros');
    });

    it('execute eyleminde geçersiz tipler elenmeli ve dinamik cüzdan kullanılmalıdır', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' });

      // Kullanıcının cüzdanı 'wallet-custom-akbank'
      mockSelect.mockImplementation(() => createSelectChain([
        { id: 'wallet-custom-akbank', name: 'Akbank Vadesiz', type: 'checking', balance: 5000 }
      ]));

      const req = new Request('http://localhost:3000/api/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          actions: [
            { type: 'expense', title: 'Harcama', icon: '💳', details: { amount: 250, merchant: 'Test Market' } },
            { type: 'malformed_hack', title: 'Bad' } // Tip koruyucu ile elenmeli
          ]
        })
      });

      const res = await handleVoiceCommandPost(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      // Sadece 1 geçerli eylem yürütülmüş olmalı
      expect(json.executed.length).toBe(1);
    });
  });

  // =========================================================================
  // 9. Scan Invoice Güvenli Depolama (Bulgu 18)
  // =========================================================================
  describe('9. Scan Invoice Güvenli Depolama (Bulgu 18)', () => {
    it('scan-invoice faturayı public dizine kaydetmemeli, data URI döndürmelidir', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' });

      const formData = new FormData();
      const fakeFile = new Blob(['fake image content'], { type: 'image/jpeg' });
      formData.append('file', fakeFile, 'invoice.jpg');

      const req = new Request('http://localhost:3000/api/home-operations/scan-invoice', {
        method: 'POST',
        body: formData
      });

      const res = await handleScanInvoicePost(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      // public/uploads yoluna yazılmamalı, Data URI formatında dönmeli
      expect(json.receiptUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(json.receiptUrl).not.toContain('/uploads/');
    });
  });

  // =========================================================================
  // 10. Strava Pagination ve İzolasyon (Bulgu 19)
  // =========================================================================
  describe('10. Strava Pagination ve Kullanıcı İzolasyonu (Bulgu 19)', () => {
    it('getStravaConfig kullanıcıya özel token anahtarlarını yalıtmalı ve diğer kullanıcıya sızdırmamalıdır', async () => {
      mockSelect.mockImplementation(() => createSelectChain([
        { key: 'strava_access_token_userA', value: 'token-A' },
        { key: 'strava_refresh_token_userA', value: 'refresh-A' },
        { key: 'strava_access_token_userB', value: 'token-B' }
      ]));

      const configA = await getStravaConfig('userA');
      const configB = await getStravaConfig('userB');

      expect(configA.accessToken).toBe('token-A');
      expect(configB.accessToken).toBe('token-B');
      expect(configB.refreshToken).toBe('');
    });
  });
});
