import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const { mockGetAuthUser, mockSelect, mockFetchLiveRates } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockSelect: vi.fn(),
  mockFetchLiveRates: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock('@/db', () => ({
  initDatabase: vi.fn().mockResolvedValue(undefined),
  db: {
    select: mockSelect,
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
  },
}));

vi.mock('@/lib/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market-data')>();
  return {
    ...actual,
    fetchLiveExchangeRates: mockFetchLiveRates,
  };
});

import { POST as scanFoodPost } from '../src/app/api/health/scan-food/route';
import { GET as analyticsGet } from '../src/app/api/analytics/route';

describe('Mock Data Cleanup Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1', role: 'admin' });
    mockFetchLiveRates.mockResolvedValue({
      USD_TRY: 0,
      EUR_TRY: 0,
      GBP_TRY: 0,
      GOLD_GRAM_TRY: 0,
      GOLD_CEYREK_TRY: 0,
      BTC_TRY: 0,
      source: 'unavailable',
      lastUpdated: new Date().toISOString(),
    });
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      then: (resolve: any) => Promise.resolve([]).then(resolve),
    };
    mockSelect.mockReturnValue(chain);
  });

  it('scan-food rejects plate requests without an image instead of returning mock chicken & bulgur', async () => {
    const req = new Request('http://localhost/api/health/scan-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'plate' }),
    });
    const res = await scanFoodPost(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('analytics API returns null officialTuikRate instead of hardcoded 48.6', async () => {
    const res = await analyticsGet();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.inflationMetrics.officialTuikRate).toBeNull();
    expect(json.data.inflationMetrics.savingVsOfficialTuikPercent).toBeNull();
    expect(mockFetchLiveRates).toHaveBeenCalledTimes(1);
  });

  it('removed load-sample-data route, demo login, and hardcoded vehicle/currency mock values from codebase', () => {
    const root = path.resolve(__dirname, '..');
    expect(fs.existsSync(path.join(root, 'src/app/api/auth/load-sample-data/route.ts'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'test-pooler-users.js'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'ui_preview.html'))).toBe(false);

    const landing = fs.readFileSync(path.join(root, 'src/components/landing/LandingPage.tsx'), 'utf8');
    expect(landing).not.toContain('Password123!');
    expect(landing).not.toContain('handleDemoLogin');

    const hero = fs.readFileSync(path.join(root, 'src/components/home/HeroNetWorthBentoCard.tsx'), 'utf8');
    expect(hero).not.toContain('|| 45000');
    expect(hero).not.toContain('|| 34.5');
    expect(hero).not.toContain('|| 3100');

    const receiptModal = fs.readFileSync(path.join(root, 'src/components/modals/ReceiptScanModal.tsx'), 'utf8');
    expect(receiptModal).not.toContain('Volvo XC60');
    expect(receiptModal).not.toContain("'veh-1'");

    const vehiclesPage = fs.readFileSync(path.join(root, 'src/app/vehicles/page.tsx'), 'utf8');
    expect(vehiclesPage).not.toContain('veh-bmw-320i');

    const vehiclesRoute = fs.readFileSync(path.join(root, 'src/app/api/vehicles/route.ts'), 'utf8');
    expect(vehiclesRoute).not.toContain('6.2');
    expect(vehiclesRoute).not.toContain('2.76');
    expect(vehiclesRoute).not.toContain('2027-03-15');

    const vehicleLegal = fs.readFileSync(path.join(root, 'src/lib/vehicle-legal.ts'), 'utf8');
    expect(vehicleLegal).not.toContain('TRF-POL-84920');

    const shoppingRoute = fs.readFileSync(path.join(root, 'src/app/api/shopping-list/route.ts'), 'utf8');
    expect(shoppingRoute).not.toContain('add_preset');

    const voiceModal = fs.readFileSync(path.join(root, 'src/components/modals/VoiceCommandModal.tsx'), 'utf8');
    expect(voiceModal).not.toContain('HAZIR SESLİ TEST KOMUTLARI');

    const marketData = fs.readFileSync(path.join(root, 'src/lib/market-data.ts'), 'utf8');
    expect(marketData).not.toContain('2715');

    const macroSummary = fs.readFileSync(path.join(root, 'src/components/health/MacroSummaryCard.tsx'), 'utf8');
    expect(macroSummary).not.toContain('consumed_ml: 1250');

    const budgetPage = fs.readFileSync(path.join(root, 'src/app/budget/page.tsx'), 'utf8');
    expect(budgetPage).not.toContain('|| 38.5');
    expect(budgetPage).not.toContain('|| 3200');

    const schemaFile = fs.readFileSync(path.join(root, 'src/db/schema.ts'), 'utf8');
    expect(schemaFile).not.toContain("default('Salon Kitaplığı')");
    expect(schemaFile).not.toContain("default('Opet')");
    expect(schemaFile).not.toContain('default(1250)');

    expect(fs.existsSync(path.join(root, 'Yedek'))).toBe(false);
  });
});
