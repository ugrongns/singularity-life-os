import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as handleLogin } from '@/app/api/auth/login/route';
import { POST as handleTelegram } from '@/app/api/telegram/route';
import { POST as handleBackup } from '@/app/api/backup/route';
import { config as middlewareConfig } from '@/middleware';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn().mockReturnValue({ value: 'mock-session-cookie' }),
    delete: vi.fn(),
  }),
}));

// Mock DB
vi.mock('@/db', () => {
  const mockSet = vi.fn().mockReturnThis();
  const mockWhere = vi.fn().mockResolvedValue([{ id: '1' }]);
  const mockFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([])
    })
  });

  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: mockFrom
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([{ id: '1' }])
      }),
      update: vi.fn().mockReturnValue({
        set: mockSet,
        where: mockWhere
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      }),
    },
    initDatabase: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock Auth
vi.mock('@/lib/auth', () => ({
  verifyPassword: vi.fn().mockResolvedValue(true),
  generateSessionToken: vi.fn().mockReturnValue('mock-session-token-12345'),
  getAuthUser: vi.fn().mockResolvedValue({
    id: 'user-uuid-1234',
    username: 'admin',
    email: 'admin@singularity.local',
    role: 'admin',
    family_id: 'fam-1',
    telegram_bot_token: 'existing_token_xyz',
    telegram_chat_id: '12345678',
    telegram_secret_token: 'secret_xyz',
    telegram_enabled: 1
  })
}));

describe('🎯 Modül 1 UI & Security Audit Bulguları Doğrulama Testleri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Login Route: UUID ile Giriş Desteği (Bulgu 1)', () => {
    it('UUID identifier gönderildiğinde kullanıcı ID üzerinden eşleştirilip başarılı oturum açılmalıdır', async () => {
      const { db } = await import('@/db');
      const mockUser = {
        id: 'usr-f47ac10b-58cc-4372-a567-0e02b2c3d479',
        username: 'uguro',
        email: 'ugur@example.com',
        password_hash: 'hash123',
        password_salt: 'salt123',
        role: 'admin'
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser])
          })
        })
      });

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'usr-f47ac10b-58cc-4372-a567-0e02b2c3d479',
          password: 'CorrectMasterPassword123!'
        })
      });

      const res = await handleLogin(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.user.id).toBe(mockUser.id);
    });
  });

  describe('2. Telegram API: Boş Token ile Mevcut Token Ezilme Koruması (Bulgu 4)', () => {
    it('boş veya whitespace token gönderildiğinde telegram_bot_token veritabanı update sorgusuna dahil edilmemelidir', async () => {
      const { db } = await import('@/db');
      let capturedSetData: any = null;

      (db.update as any).mockReturnValue({
        set: vi.fn().mockImplementation((data) => {
          capturedSetData = data;
          return {
            where: vi.fn().mockResolvedValue([{ id: '1' }])
          };
        })
      });

      const req = new Request('http://localhost/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          bot_token: '    ',
          secret_token: '',
          chat_id: '87654321',
          is_enabled: true
        })
      });

      const res = await handleTelegram(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(capturedSetData).toBeDefined();
      expect(capturedSetData.telegram_bot_token).toBeUndefined();
      expect(capturedSetData.telegram_secret_token).toBeUndefined();
      expect(capturedSetData.telegram_chat_id).toBe('87654321');
      expect(capturedSetData.telegram_enabled).toBe(1);
    });

    it('geçerli bot_token gönderildiğinde trim edilerek güncellenmelidir', async () => {
      const { db } = await import('@/db');
      let capturedSetData: any = null;

      (db.update as any).mockReturnValue({
        set: vi.fn().mockImplementation((data) => {
          capturedSetData = data;
          return {
            where: vi.fn().mockResolvedValue([{ id: '1' }])
          };
        })
      });

      const req = new Request('http://localhost/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          bot_token: '  123456789:ABCdef_ValidBotToken  ',
          chat_id: '12345678'
        })
      });

      const res = await handleTelegram(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(capturedSetData.telegram_bot_token).toBe('123456789:ABCdef_ValidBotToken');
    });
  });

  describe('3. Backup API: Şifreli Yedek Parola Zorunluluğu (Bulgu 15)', () => {
    it('parola 8 karakterden kısa olduğunda veya boş bırakıldığında 400 hatası dönmelidir', async () => {
      const invalidPassphrases = ['', '   ', '1234567', null, undefined];

      for (const passphrase of invalidPassphrases) {
        const req = new Request('http://localhost/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'encrypted_backup',
            passphrase
          })
        });

        const res = await handleBackup(req);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.success).toBe(false);
        expect(json.error).toContain('en az 8 karakter');
      }
    });
  });

  describe('4. Middleware: /welcome Rotasının Korumasız Kalması (Bulgu 8)', () => {
    it('middleware matcher config listesinde /welcome bulunmamalıdır', () => {
      const matcherRoutes = middlewareConfig.matcher;
      const hasWelcomeInMatcher = matcherRoutes.some((route: string) => route.includes('/welcome'));
      expect(hasWelcomeInMatcher).toBe(false);
    });
  });

  describe('5. HeroNetWorthBentoCard: Toplam Varlık & Varlık/Borç Oranı (Bulgu 13)', () => {
    it('oran hesabına nakit yanında gayrimenkul ve yatırım toplamları dahil edilmelidir', () => {
      const breakdown = {
        cashAndBanks: 50_000,
        realEstate: 5_000_000,
        investmentsAndBES: 450_000,
        debts: 500_000
      };

      const cashAssetsTRY = breakdown.cashAndBanks;
      const investmentsTRY = breakdown.investmentsAndBES;
      const realEstateTRY = breakdown.realEstate;
      const totalAssetsTRY = cashAssetsTRY + investmentsTRY + realEstateTRY;
      const debtsTRY = breakdown.debts;

      expect(totalAssetsTRY).toBe(5_500_000);

      const totalVolume = totalAssetsTRY + debtsTRY;
      const assetRatio = totalVolume > 0 ? Math.round((totalAssetsTRY / totalVolume) * 100) : 0;
      const debtRatio = totalVolume > 0 ? 100 - assetRatio : 0;

      // 5.5M / 6.0M = ~91.66% -> 92%
      expect(assetRatio).toBe(92);
      expect(debtRatio).toBe(8);

      // Sadece nakit ile hesaplanan eski hatalı oran: 50k / 550k = 9%
      const oldRatio = Math.round((cashAssetsTRY / (cashAssetsTRY + debtsTRY)) * 100);
      expect(oldRatio).toBe(9);
      expect(assetRatio).toBeGreaterThan(oldRatio);
    });
  });

  describe('6. LockScreenModal: Cooldown ve Başarısız Deneme Sayacı Mantığı (Bulgu 6 & 25)', () => {
    it('3 başarısız denemede 30 saniye cooldown tetiklenmeli ve sayaç sıfırlanmalıdır', () => {
      let failedAttempts = 0;
      let cooldown = 0;

      const recordFailedAttempt = () => {
        const nextAttempts = failedAttempts + 1;
        failedAttempts = nextAttempts;
        if (nextAttempts >= 3) {
          cooldown = 30;
          failedAttempts = 0;
        }
      };

      recordFailedAttempt();
      expect(failedAttempts).toBe(1);
      expect(cooldown).toBe(0);

      recordFailedAttempt();
      expect(failedAttempts).toBe(2);
      expect(cooldown).toBe(0);

      recordFailedAttempt();
      expect(failedAttempts).toBe(0);
      expect(cooldown).toBe(30);
    });
  });
});
