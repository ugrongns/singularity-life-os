import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { investmentAssets, besContracts, walletsAccounts } from '@/db/schema';
import { eq, desc, and , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const USD_RATE = 36.50;
    const EUR_RATE = 39.80;
    const GOLD_GRAM_RATE = 3180;

    const assets = userId
      ? await db.select().from(investmentAssets).where(and(eq(investmentAssets.is_active, 1), or(eq(investmentAssets.user_id, userId), eq(investmentAssets.is_family_shared, 1)))).orderBy(desc(investmentAssets.created_at))
      : [];
    const besList = userId
      ? await db.select().from(besContracts).where(or(eq(besContracts.user_id, userId), eq(besContracts.is_family_shared, 1))).orderBy(desc(besContracts.created_at))
      : [];
    const accounts = userId
      ? await db.select().from(walletsAccounts).where(and(eq(walletsAccounts.is_active, 1), or(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.is_family_shared, 1))))
      : [];
    const accountMap = new Map((accounts).map((a: any) => [a.id, a.name]));

    let totalStockTRY = 0;
    let totalStockCostTRY = 0;
    let totalGoldTRY = 0;
    let totalGoldCostTRY = 0;
    let totalCryptoTRY = 0;
    let totalCryptoCostTRY = 0;
    let totalCashTRY = 0;
    let totalCashCostTRY = 0;

    const processedAssets = (assets).map((asset: any) => {
      const isUSD = asset.current_price_currency === 'USD';
      const isEUR = asset.current_price_currency === 'EUR';
      const rate = isUSD ? USD_RATE : isEUR ? EUR_RATE : 1.0;
      const costRate = asset.cost_currency === 'USD' ? USD_RATE : asset.cost_currency === 'EUR' ? EUR_RATE : 1.0;

      const unitPrice = asset.asset_class === 'cash_fiat' ? (asset.current_price || 1) : asset.current_price;
      const unitCost = asset.asset_class === 'cash_fiat' ? (asset.avg_cost || 1) : asset.avg_cost;

      const marketValueTRY = asset.quantity * unitPrice * rate;
      const totalCostTRY = asset.quantity * unitCost * costRate;
      const profitLossTRY = marketValueTRY - totalCostTRY;
      const profitLossPercent = totalCostTRY > 0 ? ((profitLossTRY / totalCostTRY) * 100) : 0;

      if (asset.asset_class === 'bist_stock' || asset.asset_class === 'us_stock') {
        totalStockTRY += marketValueTRY;
        totalStockCostTRY += totalCostTRY;
      } else if (asset.asset_class === 'gold_metal' || asset.asset_class === 'commodity') {
        totalGoldTRY += marketValueTRY;
        totalGoldCostTRY += totalCostTRY;
      } else if (asset.asset_class === 'crypto' || asset.asset_class === 'stablecoin') {
        totalCryptoTRY += marketValueTRY;
        totalCryptoCostTRY += totalCostTRY;
      } else if (asset.asset_class === 'cash_fiat') {
        totalCashTRY += marketValueTRY;
        totalCashCostTRY += totalCostTRY;
      }

      return {
        ...asset,
        account_name: asset.account_id ? accountMap.get(asset.account_id) : null,
        marketValueTRY,
        totalCostTRY,
        profitLossTRY,
        profitLossPercent: Math.round(profitLossPercent * 10) / 10
      };
    });

    const totalBesFundTRY = (besList).reduce((sum: number, b: any) => sum + b.current_fund_value, 0);
    const totalBesPrincipalTRY = (besList).reduce((sum: number, b: any) => sum + b.total_principal, 0);
    const totalBesStateContributionTRY = (besList).reduce((sum: number, b: any) => sum + b.state_contribution_amount, 0);

    const totalPortfolioTRY = totalStockTRY + totalGoldTRY + totalCryptoTRY + totalCashTRY + totalBesFundTRY;
    const totalPortfolioCostTRY = totalStockCostTRY + totalGoldCostTRY + totalCryptoCostTRY + totalCashCostTRY + totalBesPrincipalTRY;
    const totalPortfolioPLTRY = totalPortfolioTRY - totalPortfolioCostTRY;
    const totalPortfolioPLPercent = totalPortfolioCostTRY > 0 ? ((totalPortfolioPLTRY / totalPortfolioCostTRY) * 100) : 0;

    const investmentAccountTypes = ['brokerage', 'crypto_exchange', 'crypto_wallet'];
    const investmentAccountsList = (accounts).filter((a: any) => investmentAccountTypes.includes(a.type));

    const allocation = {
      stocks: totalPortfolioTRY > 0 ? Math.round((totalStockTRY / totalPortfolioTRY) * 100) : 0,
      gold: totalPortfolioTRY > 0 ? Math.round((totalGoldTRY / totalPortfolioTRY) * 100) : 0,
      crypto: totalPortfolioTRY > 0 ? Math.round((totalCryptoTRY / totalPortfolioTRY) * 100) : 0,
      cash: totalPortfolioTRY > 0 ? Math.round((totalCashTRY / totalPortfolioTRY) * 100) : 0,
      bes: totalPortfolioTRY > 0 ? Math.round((totalBesFundTRY / totalPortfolioTRY) * 100) : 0
    };

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalPortfolioTRY,
          totalPortfolioCostTRY,
          totalPortfolioPLTRY,
          totalPortfolioPLPercent: Math.round(totalPortfolioPLPercent * 10) / 10,
          totalStockTRY,
          totalGoldTRY,
          totalCryptoTRY,
          totalCashTRY,
          totalBesFundTRY,
          totalBesStateContributionTRY
        },
        allocation,
        assets: processedAssets,
        besContracts: besList,
        accounts: investmentAccountsList
      }
    });
  } catch (error: any) {
    console.error('Investments API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();

    const {
      type = 'asset',
      account_id,
      symbol,
      name,
      asset_class = 'bist_stock',
      quantity,
      avg_cost,
      cost_currency = 'TRY',
      current_price,
      current_price_currency = 'TRY',
      purchase_date,
      // BES Alanları
      company,
      contract_no,
      start_date,
      total_principal,
      current_fund_value,
      monthly_payment
    } = body;

    const now = new Date().toISOString();
    const transactionTimestamp = purchase_date || now;

    if (type === 'bes') {
      const principal = parseFloat(total_principal) || 0;
      const stateContribution = principal * 0.30;
      const fundVal = parseFloat(current_fund_value) || (principal + stateContribution);

      await db.insert(besContracts).values({
        id: `bes-${Date.now()}`,
        member_id: 'member-ugur',
        company: company || 'Bireysel Emeklilik',
        contract_no: contract_no || null,
        start_date: start_date || transactionTimestamp,
        total_principal: principal,
        state_contribution_rate: 0.30,
        state_contribution_amount: stateContribution,
        current_fund_value: fundVal,
        monthly_payment: parseFloat(monthly_payment) || 0,
        is_family_shared: 1,
        created_at: now,
        updated_at: now
      });

      return NextResponse.json({
        success: true,
        message: `${company} BES sözleşmesi (%30 devlet katkısıyla birlikte) başarıyla portföyünüze eklendi!`
      });
    }

    if (!symbol || !name || !quantity) {
      return NextResponse.json({ success: false, error: 'Sembol, isim ve miktar zorunludur.' }, { status: 400 });
    }

    const assetId = `asset-${Date.now()}`;
    const qty = parseFloat(quantity);
    const cost = parseFloat(avg_cost) || (asset_class === 'cash_fiat' ? 1 : 0);
    const price = parseFloat(current_price) || cost || (asset_class === 'cash_fiat' ? 1 : 0);

    await db.insert(investmentAssets).values({
      id: assetId,
      member_id: 'member-ugur',
      account_id: account_id || null,
      symbol: symbol.toUpperCase(),
      name,
      asset_class,
      quantity: qty,
      avg_cost: cost,
      cost_currency,
      current_price: price,
      current_price_currency,
      purchase_date: transactionTimestamp,
      last_updated_at: now,
      is_family_shared: 1,
      is_active: 1,
      created_at: now,
      updated_at: now,
      sync_status: 'synced',
      device_id: 'mac-local'
    });

    return NextResponse.json({
      success: true,
      message: `✅ ${symbol.toUpperCase()} (${name}) başarıyla portföyünüze eklendi!`
    });
  } catch (error: any) {
    console.error('Add Asset Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url, 'http://localhost');
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Asset ID zorunludur.' }, { status: 400 });
    }

    await db.delete(investmentAssets).where(user.is_master_account === 1 ? eq(investmentAssets.id, id) : and(eq(investmentAssets.id, id), eq(investmentAssets.user_id, user.id)));

    return NextResponse.json({ success: true, message: 'Varlık portföyden silindi.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
