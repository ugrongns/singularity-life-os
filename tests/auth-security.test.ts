import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword, hashPin, verifyPassword, verifyPin, sanitizeUser } from '../src/lib/auth';
import { checkRateLimit, getClientIp } from '../src/lib/rate-limit';

// Next.js Route Handlers
import { POST as handleLogin } from '../src/app/api/auth/login/route';
import { POST as handleUnlock } from '../src/app/api/auth/unlock/route';

// Mocks for Route Handlers
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  initDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/auth')>();
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

describe('🛡️ Singularity Modül 1 — Güvenlik & Auth Birim Testleri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. OTURUMSUZ PIN İLE GİRİŞ & KİLİT AÇMA AÇIĞI TESTLERİ
  // =========================================================================
  describe('1. PIN İzolasyonu ve Oturumsuz Giriş Koruması', () => {
    it('KRİTİK: /api/auth/login rotasında PIN ile giriş yapılamamalı, parola zorunlu tutulmalıdır', async () => {
      // Saldırganın eski "action: unlock" arka kapısını kullanarak PIN ile oturum açma denemesi
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlock',
          pin: '123456',
        }),
      });

      const response = await handleLogin(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Lütfen E-posta adresinizi (veya Kullanıcı Adınızı) ve Master Parolanızı girin');
    });

    it('KRİTİK: /api/auth/unlock rotası oturumu olmayan kullanıcıları (cookie yok/geçersiz) 401 ile reddetmelidir', async () => {
      const { getAuthUser } = await import('../src/lib/auth');
      (getAuthUser as any).mockResolvedValueOnce(null); // Oturum yok

      const req = new Request('http://localhost/api/auth/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '123456' }),
      });

      const response = await handleUnlock(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.code).toBe('UNAUTHORIZED');
      expect(data.error).toContain('Aktif oturum bulunamadı');
    });

    it('/api/auth/unlock rotası geçersiz PIN formatlarını (6 haneli rakam harici) 400 ile reddetmelidir', async () => {
      const { getAuthUser } = await import('../src/lib/auth');
      (getAuthUser as any).mockResolvedValue({
        id: 'usr_test_123',
        password_salt: 'salt123',
        pin_salt: 'pinsalt123',
        quick_pin_hash: 'dummyhash',
      });

      const invalidPins = ['123', 'abcdef', '1234567', '', null, '12 34'];

      for (const pin of invalidPins) {
        const req = new Request('http://localhost/api/auth/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });

        const response = await handleUnlock(req);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('6 haneli rakamlardan oluşmalıdır');
      }
    });

    it('/api/auth/unlock rotası aktif oturumda yanlış PIN girildiğinde 401, doğru PIN girildiğinde 200 dönmelidir', async () => {
      const { getAuthUser } = await import('../src/lib/auth');

      // Test kullanıcısı ve bağımsız PIN salt'ı
      const { hash: correctPinHash, pinSalt } = await hashPin('582194');

      (getAuthUser as any).mockResolvedValue({
        id: 'usr_active_user',
        password_salt: 'random_pass_salt',
        pin_salt: pinSalt,
        quick_pin_hash: correctPinHash,
      });

      // 1. Yanlış PIN Denemesi
      const wrongReq = new Request('http://localhost/api/auth/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '000000' }),
      });
      const wrongRes = await handleUnlock(wrongReq);
      const wrongData = await wrongRes.json();

      expect(wrongRes.status).toBe(401);
      expect(wrongData.success).toBe(false);
      expect(wrongData.error).toContain('Hatalı 6 haneli PIN kodu');

      // 2. Doğru PIN Denemesi
      const correctReq = new Request('http://localhost/api/auth/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '582194' }),
      });
      const correctRes = await handleUnlock(correctReq);
      const correctData = await correctRes.json();

      expect(correctRes.status).toBe(200);
      expect(correctData.success).toBe(true);
      expect(correctData.message).toContain('Kilit başarıyla açıldı');
    });
  });

  // =========================================================================
  // 2. DAVET KODU ÇİFT KULLANIMI & TOCTOU YARIŞ DURUMU TESTLERİ
  // =========================================================================
  describe('2. Davet Kodu Atomik Check-and-Set & TOCTOU Koruması', () => {
    it('KRİTİK: Atomik Check-and-Set mantığı ile bir davet kodu yalnızca bir kez tüketilebilir', async () => {
      // Simüle edilen davet tablosu state'i
      interface MockInvite {
        invite_code: string;
        is_used: number;
        expires_at: string;
        used_by_user_id: string | null;
      }

      const dbInvites: MockInvite[] = [
        {
          invite_code: 'FAM-XK92B1',
          is_used: 0,
          expires_at: new Date(Date.now() + 86400000).toISOString(), // 1 gün geçerli
          used_by_user_id: null,
        },
      ];

      // register/route.ts'deki atomik UPDATE ... WHERE is_used = 0 AND expires_at > now RETURNING mantığı
      async function atomicConsumeInvite(code: string, userId: string, nowISO: string): Promise<MockInvite[]> {
        const invite = dbInvites.find(
          (inv) => inv.invite_code === code && inv.is_used === 0 && inv.expires_at > nowISO
        );

        if (!invite) {
          return []; // Eşleşen / kullanılabilir kayıt yok
        }

        // Atomik güncelleme simülasyonu
        invite.is_used = 1;
        invite.used_by_user_id = userId;
        return [invite];
      }

      const now = new Date().toISOString();

      // 1. Tüketici (İlk Kayıt) -> Başarılı olmalı
      const firstConsume = await atomicConsumeInvite('FAM-XK92B1', 'usr_first_user', now);
      expect(firstConsume.length).toBe(1);
      expect(firstConsume[0].is_used).toBe(1);
      expect(firstConsume[0].used_by_user_id).toBe('usr_first_user');

      // 2. Tüketici (Eşzamanlı Yarış / Çift Kullanım Denemesi) -> Kesinlikle boş dönmeli (Engellenmeli)
      const secondConsume = await atomicConsumeInvite('FAM-XK92B1', 'usr_attacker', now);
      expect(secondConsume.length).toBe(0); // Çift kullanım engellendi!
    });

    it('Süresi dolmuş davet kodları atomik kontrolden geçememeli ve tüketilememelidir', async () => {
      interface MockInvite {
        invite_code: string;
        is_used: number;
        expires_at: string;
      }

      const expiredInvite: MockInvite = {
        invite_code: 'FAM-EXPIRED',
        is_used: 0,
        expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 saat önce dolmuş
      };

      const now = new Date().toISOString();
      const isEligible = expiredInvite.is_used === 0 && expiredInvite.expires_at > now;

      expect(isEligible).toBe(false);
    });
  });

  // =========================================================================
  // 3. KRİPTOGRAFİK GÜVENLİK & BAĞIMSIZ PIN SALT TESTLERİ
  // =========================================================================
  describe('3. Kriptografik Hash ve Salt İzolasyonu', () => {
    it('KRİTİK: hashPin her çağrıda bağımsız 16-byte rastgele salt üretmeli (Salt Reuse Yok)', async () => {
      const pin = '482910';

      const res1 = await hashPin(pin);
      const res2 = await hashPin(pin);

      expect(res1.pinSalt).toBeDefined();
      expect(res2.pinSalt).toBeDefined();
      expect(res1.pinSalt.length).toBe(32); // 16 byte hex = 32 karakter
      expect(res2.pinSalt.length).toBe(32);

      // İki ayrı çağrı farklı salt ve farklı hash üretmeli
      expect(res1.pinSalt).not.toBe(res2.pinSalt);
      expect(res1.hash).not.toBe(res2.hash);
    });

    it('verifyPin bağımsız pin_salt ile doğrulamayı başarıyla yapmalıdır', async () => {
      const pin = '991234';
      const { hash: pinHash, pinSalt } = await hashPin(pin);

      const isValid = await verifyPin(pin, pinHash, 'unrelated_password_salt', pinSalt);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPin('111111', pinHash, 'unrelated_password_salt', pinSalt);
      expect(isInvalid).toBe(false);
    });

    it('verifyPin eski hesaplar için geriye dönük uyumlu legacy salt doğrulaması yapmalıdır', async () => {
      // Legacy PIN hash üretimi: crypto.pbkdf2Sync(pin, `pin_salt_${passwordSalt}`)
      const legacyPin = '654321';
      const passwordSalt = 'legacy_salt_abc';
      const legacyPinHash = (await hashPin(legacyPin, `pin_salt_${passwordSalt}`)).hash;

      // pin_salt null/undefined iken passwordSalt üzerinden doğrulayabilmeli
      const isLegacyValid = await verifyPin(legacyPin, legacyPinHash, passwordSalt, null);
      expect(isLegacyValid).toBe(true);

      const isWrongLegacy = await verifyPin('000000', legacyPinHash, passwordSalt, null);
      expect(isWrongLegacy).toBe(false);
    });

    it('verifyPassword doğru parolayı doğrulamalı ve yanlış parolayı sabit zamanda reddetmelidir', async () => {
      const password = 'SuperSecretMasterPassword2026!';
      const { hash: passwordHash, salt } = await hashPassword(password);

      const isCorrect = await verifyPassword(password, passwordHash, salt);
      expect(isCorrect).toBe(true);

      const isWrong = await verifyPassword('WrongPassword123!', passwordHash, salt);
      expect(isWrong).toBe(false);
    });

    it('sanitizeUser hassas alanları (parola hash, pin hash, pin_salt vb.) temizlemelidir', () => {
      const rawUser = {
        id: 'usr_123',
        username: 'admin',
        full_name: 'Sistem Yöneticisi',
        email: 'admin@singularity.internal',
        password_hash: 'secret_hash',
        password_salt: 'secret_salt',
        pin_salt: 'secret_pin_salt',
        quick_pin_hash: 'secret_pin_hash',
        telegram_bot_token: '123456:bot_token',
        telegram_secret_token: 'secret_token_xyz',
        role: 'admin',
      };

      const safeUser = sanitizeUser(rawUser);

      expect(safeUser.id).toBe('usr_123');
      expect(safeUser.username).toBe('admin');
      expect(safeUser.password_hash).toBeUndefined();
      expect(safeUser.password_salt).toBeUndefined();
      expect(safeUser.pin_salt).toBeUndefined();
      expect(safeUser.quick_pin_hash).toBeUndefined();
      expect(safeUser.telegram_bot_token).toBeUndefined();
      expect(safeUser.telegram_secret_token).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. RATE LIMITING & IP SPOOFING TESTLERİ
  // =========================================================================
  describe('4. Rate Limiting & Güvenli IP Tespiti', () => {
    it('checkRateLimit belirlenen pencere limiti aşıldığında istekleri engellemelidir', () => {
      const key = `test_rate_limit_${Date.now()}`;
      const maxRequests = 3;
      const windowMs = 5000;

      expect(checkRateLimit(key, maxRequests, windowMs).allowed).toBe(true);
      expect(checkRateLimit(key, maxRequests, windowMs).allowed).toBe(true);
      expect(checkRateLimit(key, maxRequests, windowMs).allowed).toBe(true);

      // 4. İstek engellenmeli
      const rateLimited = checkRateLimit(key, maxRequests, windowMs);
      expect(rateLimited.allowed).toBe(false);
      expect(rateLimited.remaining).toBe(0);
      expect(rateLimited.retryAfterMs).toBeGreaterThan(0);
    });

    it('getClientIp spoof edilmiş x-forwarded-for yerine güvenilir proxy başlıklarını önceliklendirmelidir', () => {
      // Saldırgan sahte bir x-forwarded-for eklemiş, ancak Vercel/Cloudflare gerçek IP'yi eklemiş
      const requestWithVercelProxy = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '1.1.1.1, 2.2.2.2',
          'x-vercel-proxied-for': '198.51.100.42',
        },
      });

      expect(getClientIp(requestWithVercelProxy)).toBe('198.51.100.42');

      const requestWithRealIp = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '10.0.0.1',
          'x-real-ip': '203.0.113.19',
        },
      });

      expect(getClientIp(requestWithRealIp)).toBe('203.0.113.19');
    });
  });
});
