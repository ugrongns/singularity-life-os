'use client';

export default function HomeBentoSkeleton() {
  const shimmerStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-subtle) 25%, var(--surface) 50%, var(--surface-subtle) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 'var(--radius-md)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* 12-Sütunlu Bento Grid Shimmer */}
      <div className="bento-grid">
        {/* Üst Sol: Hero Net Worth Skeleton (8 Sütun) */}
        <div className="col-span-8 card" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', ...shimmerStyle }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ width: '100px', height: '12px', ...shimmerStyle }} />
                <div style={{ width: '140px', height: '16px', ...shimmerStyle }} />
              </div>
            </div>
            <div style={{ width: '120px', height: '28px', borderRadius: 'var(--radius-full)', ...shimmerStyle }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '220px', height: '36px', ...shimmerStyle }} />
            <div style={{ width: '100%', height: '8px', borderRadius: 'var(--radius-full)', ...shimmerStyle }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <div style={{ height: '52px', ...shimmerStyle }} />
            <div style={{ height: '52px', ...shimmerStyle }} />
            <div style={{ height: '52px', ...shimmerStyle }} />
          </div>
        </div>

        {/* Üst Sağ: Quick Ingest Hub Skeleton (4 Sütun) */}
        <div className="col-span-4 card" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', ...shimmerStyle }} />
            <div style={{ width: '140px', height: '16px', ...shimmerStyle }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', flex: 1 }}>
            <div style={{ height: '64px', ...shimmerStyle }} />
            <div style={{ height: '64px', ...shimmerStyle }} />
            <div style={{ height: '64px', ...shimmerStyle }} />
            <div style={{ height: '64px', ...shimmerStyle }} />
          </div>

          <div style={{ height: '36px', borderRadius: 'var(--radius-md)', ...shimmerStyle }} />
        </div>

        {/* Alt Sol: Günün Özeti Feed Skeleton (6 Sütun) */}
        <div className="col-span-6 card" style={{ minHeight: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ width: '160px', height: '20px', ...shimmerStyle }} />
            <div style={{ width: '80px', height: '24px', borderRadius: 'var(--radius-full)', ...shimmerStyle }} />
          </div>
          <div style={{ height: '68px', ...shimmerStyle }} />
          <div style={{ height: '68px', ...shimmerStyle }} />
          <div style={{ height: '68px', ...shimmerStyle }} />
        </div>

        {/* Alt Sağ: Ev Operasyonları Skeleton (6 Sütun) */}
        <div className="col-span-6 card" style={{ minHeight: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ width: '180px', height: '20px', ...shimmerStyle }} />
            <div style={{ width: '90px', height: '28px', borderRadius: 'var(--radius-full)', ...shimmerStyle }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '100px', height: '32px', borderRadius: 'var(--radius-md)', ...shimmerStyle }} />
            <div style={{ width: '100px', height: '32px', borderRadius: 'var(--radius-md)', ...shimmerStyle }} />
          </div>
          <div style={{ height: '72px', ...shimmerStyle }} />
          <div style={{ height: '72px', ...shimmerStyle }} />
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
