'use client';

interface Props {
  fireMetrics: {
    monthlyPassiveIncome: number;
    monthlyLivingExpense: number;
    passiveCoveragePercent: number;
    fireTargetNumber: number;
    totalNetWorth: number;
    fireProgressPercent: number;
    yearsToFire: number;
    isHalfway: boolean;
  };
  inflationMetrics: {
    personalInflationRate: number;
    officialTuikRate: number;
    savingVsOfficialTuikPercent: number;
    basketSummary: string;
  };
}

export default function FireAnalyticsCard({ fireMetrics, inflationMetrics }: Props) {
  const {
    monthlyPassiveIncome,
    monthlyLivingExpense,
    passiveCoveragePercent,
    fireTargetNumber,
    totalNetWorth,
    fireProgressPercent,
    yearsToFire
  } = fireMetrics;

  const { personalInflationRate, officialTuikRate, savingVsOfficialTuikPercent } = inflationMetrics;

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>🎯</span>
          <span>Finansal Özgürlük (FIRE) & Enflasyon Analitiği</span>
        </div>
        <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'var(--indigo-bg)', color: 'var(--indigo)' }}>
          %4 Kuralı Modeli
        </span>
      </div>

      {/* 1. Pasif Gelir Karşılama Oranı */}
      <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>PASİF GELİR KARŞILAMA ORANI</div>
            <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>
              ₺{monthlyPassiveIncome.toLocaleString('tr-TR')} / ₺{monthlyLivingExpense.toLocaleString('tr-TR')} Aylık
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--emerald)' }}>
              %{passiveCoveragePercent}
            </span>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Yaşam Masrafı Karşılandı</div>
          </div>
        </div>

        <div className="budget-bar-track" style={{ height: '8px', marginTop: '6px' }}>
          <div className="budget-bar-fill" style={{ width: `${Math.min(100, passiveCoveragePercent)}%`, backgroundColor: 'var(--emerald)' }} />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
          {monthlyLivingExpense > 0
            ? `Kira ve temettü gelirleriniz aylık zorunlu yaşam giderinizin %${passiveCoveragePercent}'ini tamamen pasif karşılıyor.`
            : 'Aylık bütçe veya harcama kaydı girdiğinizde pasif gelir karşılama oranı otomatik hesaplanacaktır.'}
        </div>
      </div>

      {/* 2. FIRE Hedefine İlerleme */}
      <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>FIRE HEDEFİ (25X YILLIK GİDER)</div>
            <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '2px' }}>
              ₺{totalNetWorth.toLocaleString('tr-TR')} / ₺{fireTargetNumber.toLocaleString('tr-TR')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--indigo)' }}>
              %{fireProgressPercent}
            </span>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Tam Bağımsızlık Hedefi</div>
          </div>
        </div>

        <div className="budget-bar-track" style={{ height: '8px', marginTop: '6px' }}>
          <div className="budget-bar-fill" style={{ width: `${fireProgressPercent}%`, backgroundColor: 'var(--indigo)' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Mevcut tasarruf ve pasif getiri hızıyla:</span>
          <span style={{ fontWeight: 800, color: 'var(--indigo)', background: 'var(--indigo-bg)', padding: '2px 8px', borderRadius: '4px' }}>
            {fireTargetNumber > 0 && yearsToFire > 0 ? `~${yearsToFire} Yıl Sonra FIRE` : fireTargetNumber > 0 ? 'Hesaplanıyor' : 'Hedef İçin Veri Bekleniyor'}
          </span>
        </div>
      </div>

      {/* 3. Kişisel Enflasyon Endeksi */}
      <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--amber)' }}>
            📊 Kişisel Enflasyon vs Resmi TÜFE
          </div>
          <span style={{ fontSize: '11px', background: 'var(--amber-bg)', color: 'var(--amber)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
            Reel Sepet
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px', textAlign: 'center' }}>
          <div style={{ background: 'var(--surface)', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Kişisel Enflasyon</div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--amber)', marginTop: '2px' }}>%{personalInflationRate}</div>
          </div>
          <div style={{ background: 'var(--surface)', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Resmi TÜİK TÜFE</div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>%{officialTuikRate}</div>
          </div>
          <div style={{ background: 'var(--surface)', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', color: 'var(--emerald)' }}>Reel Avantaj</div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--emerald)', marginTop: '2px' }}>+%{savingVsOfficialTuikPercent}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
