'use client';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  asset_class: string;
  quantity: number;
  avg_cost: number;
  cost_currency: string;
  current_price: number;
  current_price_currency: string;
  marketValueTRY: number;
  totalCostTRY: number;
  profitLossTRY: number;
  profitLossPercent: number;
  purchase_date?: string;
}

interface BES {
  id: string;
  company: string;
  contract_no?: string;
  total_principal: number;
  state_contribution_amount: number;
  current_fund_value: number;
  start_date?: string;
}

interface Props {
  assets: Asset[];
  besContracts: BES[];
}

export default function StockGoldList({ assets, besContracts }: Props) {
  const formatMoney = (val: number, curr = 'TRY') => {
    if (curr === 'GOLD') return `${(val || 0).toLocaleString('tr-TR')} ₺ (Altın)`;
    const validCur = ['TRY', 'USD', 'EUR', 'GBP'].includes(curr) ? curr : 'TRY';
    try {
      return new Intl.NumberFormat('tr-TR', { 
        style: 'currency', 
        currency: validCur, 
        maximumFractionDigits: validCur === 'USD' || validCur === 'EUR' ? 2 : 0 
      }).format(val || 0);
    } catch {
      return `${(val || 0).toLocaleString('tr-TR')} ₺`;
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
    } catch {
      return null;
    }
  };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>📊</span>
          <span>Varlık & Pozisyon Listesi</span>
        </div>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
          {assets.length + besContracts.length} Pozisyon
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {assets.map(asset => {
          const isProfit = asset.profitLossTRY >= 0;
          const formattedDate = formatDate(asset.purchase_date);

          return (
            <div 
              key={asset.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: 'var(--surface-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: '14px' }}>{asset.symbol}</span>
                  <span style={{ fontSize: '11px', background: asset.asset_class === 'gold_metal' ? 'var(--amber-bg)' : asset.asset_class === 'crypto' ? '#F5F3FF' : 'var(--blue-bg)', color: asset.asset_class === 'gold_metal' ? '#F59E0B' : asset.asset_class === 'crypto' ? '#8B5CF6' : '#3B82F6', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    {asset.asset_class === 'gold_metal' ? 'Altın' : asset.asset_class === 'crypto' ? 'Kripto' : asset.asset_class === 'us_stock' ? 'ABD' : 'BIST'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {asset.quantity} Adet • Maliyet: {formatMoney(asset.avg_cost, asset.cost_currency)}
                </div>
                {formattedDate && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    📅 Alış: {formattedDate}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 800 }}>
                  {formatMoney(asset.marketValueTRY)}
                </div>
                <div className="tabular-nums" style={{ fontSize: '12px', fontWeight: 700, color: isProfit ? 'var(--emerald)' : 'var(--rose)', marginTop: '2px' }}>
                  {isProfit ? '+' : ''}{formatMoney(asset.profitLossTRY)} (%{asset.profitLossPercent})
                </div>
              </div>
            </div>
          );
        })}

        {/* BES Sözleşmeleri */}
        {besContracts.map(bes => {
          const formattedDate = formatDate(bes.start_date);
          return (
            <div 
              key={bes.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: 'var(--emerald-bg)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--emerald)' }}>🛡️ {bes.company}</span>
                  <span style={{ fontSize: '11px', background: 'white', color: 'var(--emerald)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    BES + %30 D.K.
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Ana Para: {formatMoney(bes.total_principal)} • Devlet Katkısı: +{formatMoney(bes.state_contribution_amount)}
                </div>
                {formattedDate && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    📅 Başlangıç: {formattedDate}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--emerald)' }}>
                  {formatMoney(bes.current_fund_value)}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Fon Değeri
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
