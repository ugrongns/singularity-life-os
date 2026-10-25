/**
 * Singularity Life OS - Canlı Piyasa & Yatırım Fiyatları Motoru
 * - Döviz Kurları (USD, EUR, GBP)
 * - Altın ve Kıymetli Madenler (Gram Altın, Çeyrek)
 * - TEFAS Yatırım Fonları Pay Fiyatları
 * - Kripto Para & BIST Hisse Fiyatları
 */

export interface MarketRates {
  USD_TRY: number;
  EUR_TRY: number;
  GBP_TRY: number;
  GOLD_GRAM_TRY: number;
  GOLD_CEYREK_TRY: number;
  BTC_TRY: number;
  USD_BUY?: number;
  USD_SELL?: number;
  EUR_BUY?: number;
  EUR_SELL?: number;
  GBP_BUY?: number;
  GBP_SELL?: number;
  GOLD_GRAM_BUY?: number;
  GOLD_GRAM_SELL?: number;
  GOLD_CEYREK_BUY?: number;
  GOLD_CEYREK_SELL?: number;
  USD_CHANGE?: string;
  EUR_CHANGE?: string;
  GBP_CHANGE?: string;
  GOLD_CHANGE?: string;
  source: 'truncgil' | 'tcmb' | 'er-api' | 'fallback';
  lastUpdated: string;
}

// Sunucu içi 10 dakikalık in-memory önbellek
let cachedRates: MarketRates | null = null;
let cachedTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 dakika

function parseTRNumber(str: string | undefined | null): number {
  if (!str) return 0;
  const clean = String(str).replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(clean) || 0;
}

/**
 * TCMB & Serbest Piyasa (Kapalıçarşı) Canlı Döviz ve Altın Kurlarını Çeker
 */
export async function fetchLiveExchangeRates(forceRefresh = false): Promise<MarketRates> {
  const now = Date.now();
  if (!forceRefresh && cachedRates && (now - cachedTime < CACHE_TTL_MS)) {
    return cachedRates;
  }

  const nowIso = new Date().toISOString();
  let usd = 48.75;
  let usdBuy = 48.60;
  let eur = 56.00;
  let eurBuy = 55.80;
  let gbp = 65.20;
  let gbpBuy = 65.00;
  let goldGram = 6850;
  let goldGramBuy = 6810;
  let goldCeyrek = 11100;
  let goldCeyrekBuy = 10950;
  let btcTry = 3900000;
  let usdChange = '+0.00%';
  let eurChange = '+0.00%';
  let gbpChange = '+0.00%';
  let goldChange = '+0.00%';
  let source: MarketRates['source'] = 'fallback';

  // 1. Kademe: Truncgil (Serbest Piyasa Döviz & Kapalıçarşı Altın)
  try {
    const res = await fetch('https://finans.truncgil.com/today.json', {
      headers: { 'User-Agent': 'SingularityLifeOS/1.0' },
      next: { revalidate: 600 }
    });
    if (res.ok) {
      const data = await res.json();
      const tUsd = parseTRNumber(data['USD']?.['Satış']);
      const tUsdBuy = parseTRNumber(data['USD']?.['Alış']);
      const tEur = parseTRNumber(data['EUR']?.['Satış']);
      const tEurBuy = parseTRNumber(data['EUR']?.['Alış']);
      const tGbp = parseTRNumber(data['GBP']?.['Satış']);
      const tGbpBuy = parseTRNumber(data['GBP']?.['Alış']);
      const tGold = parseTRNumber(data['gram-altin']?.['Satış']);
      const tGoldBuy = parseTRNumber(data['gram-altin']?.['Alış']);
      const tCeyrek = parseTRNumber(data['ceyrek-altin']?.['Satış']);
      const tCeyrekBuy = parseTRNumber(data['ceyrek-altin']?.['Alış']);

      if (tUsd > 0 && tEur > 0) {
        usd = tUsd;
        if (tUsdBuy > 0) usdBuy = tUsdBuy;
        eur = tEur;
        if (tEurBuy > 0) eurBuy = tEurBuy;
        if (tGbp > 0) { gbp = tGbp; if (tGbpBuy > 0) gbpBuy = tGbpBuy; }
        if (tGold > 0) { goldGram = tGold; if (tGoldBuy > 0) goldGramBuy = tGoldBuy; }
        if (tCeyrek > 0) { goldCeyrek = tCeyrek; if (tCeyrekBuy > 0) goldCeyrekBuy = tCeyrekBuy; }
        usdChange = data['USD']?.['Değişim'] || usdChange;
        eurChange = data['EUR']?.['Değişim'] || eurChange;
        gbpChange = data['GBP']?.['Değişim'] || gbpChange;
        goldChange = data['gram-altin']?.['Değişim'] || goldChange;
        source = 'truncgil';
      }
    }
  } catch (e) {
    console.warn('[MarketData] Truncgil serbest piyasa çekilemedi, TCMB deneniyor:', e);
  }

  // 2. Kademe: TCMB Resmi Gösterge Kurları (Truncgil başarısız olduysa)
  if (source === 'fallback') {
    try {
      const res = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
        next: { revalidate: 600 }
      });
      if (res.ok) {
        const xml = await res.text();
        const getTcmb = (code: string) => {
          const regex = new RegExp('<Currency[^>]*CurrencyCode="' + code + '"[\\s\\S]*?<ForexSelling>([0-9.]+)<\\/ForexSelling>');
          const m = xml.match(regex);
          return m ? parseFloat(m[1]) : 0;
        };
        const tcmbUsd = getTcmb('USD');
        const tcmbEur = getTcmb('EUR');
        const tcmbGbp = getTcmb('GBP');
        if (tcmbUsd > 0) {
          usd = tcmbUsd;
          if (tcmbEur > 0) eur = tcmbEur;
          if (tcmbGbp > 0) gbp = tcmbGbp;
          goldGram = Math.round((2715 / 31.1035) * usd * 1.03);
          goldCeyrek = Math.round(goldGram * 1.63);
          source = 'tcmb';
        }
      }
    } catch (e) {
      console.warn('[MarketData] TCMB kuru çekilemedi, open.er-api deneniyor:', e);
    }
  }

  // 3. Kademe: open.er-api.com (Global Fallback)
  if (source === 'fallback') {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        next: { revalidate: 600 }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.TRY) {
          usd = Number(data.rates.TRY);
          if (data.rates.EUR) {
            eur = (1 / Number(data.rates.EUR)) * usd;
          }
          if (data.rates.GBP) {
            gbp = (1 / Number(data.rates.GBP)) * usd;
          }
          goldGram = Math.round((2715 / 31.1035) * usd * 1.03);
          goldCeyrek = Math.round(goldGram * 1.63);
          source = 'er-api';
        }
      }
    } catch (e) {
      console.warn('[MarketData] open.er-api fallback kullanılıyor:', e);
    }
  }

  // Kripto BTC/TRY Fiyatı (CoinGecko veya kur oranı hesabı)
  try {
    const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=try', {
      next: { revalidate: 600 }
    });
    if (cryptoRes.ok) {
      const cData = await cryptoRes.json();
      if (cData?.bitcoin?.try) {
        btcTry = Math.round(cData.bitcoin.try);
      }
    }
  } catch {
    btcTry = Math.round(80000 * usd);
  }

  cachedRates = {
    USD_TRY: Math.round(usd * 100) / 100,
    USD_BUY: Math.round((usdBuy || usd * 0.997) * 100) / 100,
    USD_SELL: Math.round(usd * 100) / 100,
    EUR_TRY: Math.round(eur * 100) / 100,
    EUR_BUY: Math.round((eurBuy || eur * 0.997) * 100) / 100,
    EUR_SELL: Math.round(eur * 100) / 100,
    GBP_TRY: Math.round(gbp * 100) / 100,
    GBP_BUY: Math.round((gbpBuy || gbp * 0.997) * 100) / 100,
    GBP_SELL: Math.round(gbp * 100) / 100,
    GOLD_GRAM_TRY: Math.round(goldGram * 100) / 100,
    GOLD_GRAM_BUY: Math.round((goldGramBuy || goldGram * 0.993) * 100) / 100,
    GOLD_GRAM_SELL: Math.round(goldGram * 100) / 100,
    GOLD_CEYREK_TRY: Math.round(goldCeyrek),
    GOLD_CEYREK_BUY: Math.round(goldCeyrekBuy || goldCeyrek * 0.985),
    GOLD_CEYREK_SELL: Math.round(goldCeyrek),
    BTC_TRY: btcTry,
    USD_CHANGE: usdChange,
    EUR_CHANGE: eurChange,
    GBP_CHANGE: gbpChange,
    GOLD_CHANGE: goldChange,
    source,
    lastUpdated: nowIso
  };
  cachedTime = now;

  return cachedRates;
}

/**
 * TEFAS Fon Pay Fiyatını Takasbank / TEFAS Servisinden Sorgular
 */
export async function fetchTefasFundPrice(fundCode: string): Promise<{ price: number; name?: string } | null> {
  const code = fundCode.toUpperCase().trim();
  try {
    const res = await fetch('https://www.tefas.gov.tr/api/DB/BindHistoryInfo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: new URLSearchParams({
        fontip: 'YAT',
        fonkod: code
      }).toString()
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.data && Array.isArray(json.data) && json.data.length > 0) {
        const latest = json.data[json.data.length - 1];
        const price = parseFloat(latest.FIYAT) || 0;
        if (price > 0) {
          return { price, name: latest.FONUNVAN };
        }
      }
    }
  } catch (e) {
    console.warn(`[MarketData] TEFAS fon sorgulama hatası (${code}):`, e);
  }

  return null;
}

/**
 * Kripto Para Güncel Fiyatını CoinGecko'dan Çeker
 */
export async function fetchCryptoPrice(symbol: string): Promise<{ priceUSD: number; priceTRY: number } | null> {
  const sym = symbol.toUpperCase().trim();
  const symbolMap: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    SOL: 'solana',
    USDT: 'tether',
    USDC: 'usd-coin',
    AVAX: 'avalanche-2',
    XRP: 'ripple'
  };

  const coinId = symbolMap[sym];
  if (!coinId) return null;

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,try`);
    if (res.ok) {
      const data = await res.json();
      if (data && data[coinId]) {
        return {
          priceUSD: data[coinId].usd,
          priceTRY: data[coinId].try
        };
      }
    }
  } catch (e) {
    console.warn(`[MarketData] Kripto fiyat sorgulama hatası (${sym}):`, e);
  }

  return null;
}
