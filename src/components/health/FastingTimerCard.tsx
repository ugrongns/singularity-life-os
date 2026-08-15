'use client';
import { useState } from 'react';

interface FastingProps {
  fastingData: {
    isActive: boolean;
    protocol: string;
    elapsedText?: string;
    remainingText?: string;
    progressPercent?: number;
    currentPhase?: string;
    phaseColor?: string;
    phaseDescription?: string;
  };
  onToggleFasting: (action: 'start' | 'end') => void;
}

export default function FastingTimerCard({ fastingData, onToggleFasting }: FastingProps) {
  const [isToggling, setIsToggling] = useState(false);

  const handleAction = async (action: 'start' | 'end') => {
    setIsToggling(true);
    await onToggleFasting(action);
    setIsToggling(false);
  };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>⏳</span>
          <span>Aralıklı Oruç ({fastingData.protocol || '16:8'})</span>
        </div>
        <span style={{ fontSize: '12px', fontWeight: 700, color: fastingData.isActive ? 'var(--emerald)' : 'var(--text-muted)' }}>
          {fastingData.isActive ? '● Canlı Devam Ediyor' : '○ Pasif'}
        </span>
      </div>

      {fastingData.isActive ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Canlı Süre Kartı */}
          <div style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Geçen Süre</div>
              <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
                {fastingData.elapsedText}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Hedefe Kalan</div>
              <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 800, color: '#6366F1', marginTop: '2px' }}>
                {fastingData.remainingText}
              </div>
            </div>
          </div>

          {/* İlerleme Çubuğu */}
          <div className="budget-bar-track" style={{ height: '8px' }}>
            <div className="budget-bar-fill" style={{ width: `${fastingData.progressPercent}%`, backgroundColor: '#6366F1' }} />
          </div>

          {/* Biyolojik Faz Rozeti */}
          <div style={{ background: '#FFFBEB', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '10px 12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#D97706' }}>
              {fastingData.currentPhase}
            </div>
            <div style={{ fontSize: '11px', color: '#92400E', lineHeight: 1.4 }}>
              {fastingData.phaseDescription}
            </div>
          </div>

          {/* Orucu Bitir Butonu */}
          <button 
            className="btn-secondary" 
            onClick={() => handleAction('end')}
            disabled={isToggling}
            style={{ padding: '8px', fontSize: '12px', color: 'var(--rose)' }}
          >
            {isToggling ? 'İşleniyor...' : '🛑 Orucu Tamamla / Yemek Penceresini Aç'}
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Şu an aktif bir oruç seansı bulunmuyor. Yemek pencerenizi kapatıp yeni seans başlatabilirsiniz.
          </div>
          <button 
            className="btn-primary" 
            onClick={() => handleAction('start')}
            disabled={isToggling}
            style={{ padding: '10px', fontSize: '13px', width: 'auto', alignSelf: 'center' }}
          >
            {isToggling ? 'Başlatılıyor...' : '🚀 16:8 Orucu Başlat'}
          </button>
        </div>
      )}
    </div>
  );
}
