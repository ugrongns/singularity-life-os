'use client';

interface PortfolioHeroProps {
  summary: {
    totalPortfolioTRY: number;
    totalPortfolioPLTRY: number;
    totalPortfolioPLPercent: number;
    totalStockTRY: number;
    totalGoldTRY: number;
    totalCryptoTRY: number;
    totalBesFundTRY: number;
    totalBesStateContributionTRY: number;
  };
  allocation: {
    stocks: number;
    gold: number;
    crypto: number;
    bes: number;
  };
  onOpenDividendModal: () => void;
  onOpenAddAssetModal: () => void;
}

export default function PortfolioHeroCard({ summary, allocation, onOpenDividendModal, onOpenAddAssetModal }: PortfolioHeroProps) {
  const formatMoney = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);
  const isProfit = summary.totalPortfolioPLTRY >= 0;

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>📈</span>
          <span>Yatırım Portföyü & Varlık Dağılımı</span>
        </div>
      </div>

      <div className="card-action-bar">
        <button className="btn-primary" onClick={onOpenAddAssetModal}>
          + Varlık Ekle
        </button>
        <button className="btn-subtle" onClick={onOpenDividendModal}>
          + Temettü Kaydet
        </button>
      </div>

      {/* Portföy Büyüklüğü ve Toplam Kâr/Zarar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--surface-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Toplam Portföy Değeri</div>
          <div className="tabular-nums" style={{ fontSize: '24px', fontWeight: 800, marginTop: '2px' }}>
            {formatMoney(summary.totalPortfolioTRY)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Gerçekleşmemiş K/Z</div>
          <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 700, color: isProfit ? 'var(--emerald)' : 'var(--rose)', marginTop: '2px' }}>
            {isProfit ? '+' : ''}{formatMoney(summary.totalPortfolioPLTRY)} (%{summary.totalPortfolioPLPercent})
          </div>
        </div>
      </div>

      {/* Çok Renkli Varlık Dağılım Çubuğu (Allocation Bar) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
          <span>Varlık Dağılımı</span>
          <span>100% Portföy</span>
        </div>
        <div style={{ height: '10px', borderRadius: '999px', display: 'flex', overflow: 'hidden', gap: '2px', background: '#E5E7EB' }}>
          {allocation.stocks > 0 && <div style={{ width: `${allocation.stocks}%`, background: '#3B82F6' }} title={`Hisseler: %${allocation.stocks}`} />}
          {allocation.gold > 0 && <div style={{ width: `${allocation.gold}%`, background: '#F59E0B' }} title={`Altın: %${allocation.gold}`} />}
          {allocation.bes > 0 && <div style={{ width: `${allocation.bes}%`, background: '#10B981' }} title={`BES: %${allocation.bes}`} />}
          {allocation.crypto > 0 && <div style={{ width: `${allocation.crypto}%`, background: '#8B5CF6' }} title={`Kripto: %${allocation.crypto}`} />}
        </div>
      </div>

      {/* Dağılım Etiketleri */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', paddingTop: '4px' }}>
        <div style={{ background: 'var(--blue-bg)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hisseler</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#3B82F6' }}>%{allocation.stocks}</div>
        </div>
        <div style={{ background: 'var(--amber-bg)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Altın</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#F59E0B' }}>%{allocation.gold}</div>
        </div>
        <div style={{ background: 'var(--emerald-bg)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BES (%30 D.)</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981' }}>%{allocation.bes}</div>
        </div>
        <div style={{ background: '#F5F3FF', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kripto</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#8B5CF6' }}>%{allocation.crypto}</div>
        </div>
      </div>
    </div>
  );
}
