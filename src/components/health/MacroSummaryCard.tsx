'use client';

interface MacroSummaryProps {
  summary: {
    consumed: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };
    targets: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };
    percentages: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  };
  waterData?: {
    consumed_ml: number;
    target_ml: number;
    percentage: number;
  };
  onOpenPlateScan: () => void;
  onOpenDietModal?: () => void;
  onOpenAddMeal?: () => void;
  onOpenEditProfile?: () => void;
  onAddWater?: (amount: number) => void;
}

export default function MacroSummaryCard({
  summary,
  waterData,
  onOpenPlateScan,
  onOpenDietModal,
  onOpenAddMeal,
  onOpenEditProfile,
  onAddWater
}: MacroSummaryProps) {
  const { consumed, targets, percentages } = summary;
  const water = waterData || { consumed_ml: 1250, target_ml: 2500, percentage: 50 };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>🥗</span>
          <span>Günlük Beslenme & Makrolar</span>
        </div>
      </div>

      <div className="card-action-bar">
        {onOpenDietModal && (
          <button className="btn-subtle" onClick={onOpenDietModal}>
            📋 Diyet Menüsü
          </button>
        )}
        <button className="btn-subtle" onClick={onOpenPlateScan}>
          📸 Tabak Tara (AI)
        </button>
        {onOpenAddMeal && (
          <button className="btn-primary" onClick={onOpenAddMeal}>
            + Manuel Öğün
          </button>
        )}
        {onOpenEditProfile && (
          <button className="btn-subtle" onClick={onOpenEditProfile}>
            ⚙️ Hedefleri Düzenle
          </button>
        )}
      </div>

      {/* Kalori Özeti */}
      <div style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Alınan Kalori</div>
          <div className="tabular-nums" style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>
            {consumed.calories} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {targets.calories} kcal</span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ background: 'var(--emerald-bg)', color: 'var(--emerald)', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
            %{percentages.calories} Doluluk
          </span>
        </div>
      </div>

      {/* Makro İlerleme Barları (Protein, Karbonhidrat, Yağ) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Protein */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
            <span style={{ color: '#3B82F6' }}>🥩 Protein</span>
            <span className="tabular-nums">{consumed.protein_g}g / {targets.protein_g}g (%{percentages.protein})</span>
          </div>
          <div className="progress-bar" style={{ height: '6px' }}>
            <div className="progress-fill" style={{ width: `${percentages.protein}%`, backgroundColor: '#3B82F6' }} />
          </div>
        </div>

        {/* Karbonhidrat */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
            <span style={{ color: '#F59E0B' }}>🌾 Karbonhidrat</span>
            <span className="tabular-nums">{consumed.carbs_g}g / {targets.carbs_g}g (%{percentages.carbs})</span>
          </div>
          <div className="progress-bar" style={{ height: '6px' }}>
            <div className="progress-fill" style={{ width: `${percentages.carbs}%`, backgroundColor: '#F59E0B' }} />
          </div>
        </div>

        {/* Yağ */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
            <span style={{ color: '#EC4899' }}>🥑 Sağlıklı Yağ</span>
            <span className="tabular-nums">{consumed.fat_g}g / {targets.fat_g}g (%{percentages.fat})</span>
          </div>
          <div className="progress-bar" style={{ height: '6px' }}>
            <div className="progress-fill" style={{ width: `${percentages.fat}%`, backgroundColor: '#EC4899' }} />
          </div>
        </div>
      </div>

      {/* 💧 Günlük Su Tüketimi Takibi */}
      <div style={{ background: '#EFF6FF', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '10px 12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E40AF' }}>
            💧 Su Tüketimi: {water.consumed_ml} / {water.target_ml} ml
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB' }}>
            %{water.percentage}
          </span>
        </div>

        <div className="progress-bar" style={{ height: '6px' }}>
          <div className="progress-fill" style={{ width: `${water.percentage}%`, backgroundColor: '#3B82F6' }} />
        </div>

        {onAddWater && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
            <button 
              className="btn-subtle" 
              onClick={() => onAddWater(250)}
              style={{ flex: 1, background: 'white', padding: '4px', fontSize: '11px', fontWeight: 600, color: '#2563EB', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)' }}
            >
              +250 ml Bardak
            </button>
            <button 
              className="btn-subtle" 
              onClick={() => onAddWater(500)}
              style={{ flex: 1, background: 'white', padding: '4px', fontSize: '11px', fontWeight: 600, color: '#2563EB', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)' }}
            >
              +500 ml Şişe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
