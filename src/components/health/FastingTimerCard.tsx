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
  onToggleFasting: (action: 'start' | 'end', protocol?: string) => void;
}

const FASTING_PROTOCOLS = [
  { id: '16:8', label: '16:8 Standart', hours: 16, category: 'Günlük' },
  { id: '14:10', label: '14:10 Başlangıç', hours: 14, category: 'Günlük' },
  { id: '12:12', label: '12:12 Sirkadiyen', hours: 12, category: 'Günlük' },
  { id: '18:6', label: '18:6 İleri Düzek', hours: 18, category: 'Günlük' },
  { id: '20:4', label: '20:4 Savaşçı', hours: 20, category: 'Günlük' },
  { id: 'OMAD', label: '23:1 OMAD (Tek Öğün)', hours: 23, category: 'Günlük' },
  { id: '24h', label: '🧬 24 Sa Otofaji', hours: 24, category: 'Derin Otofaji' },
  { id: '36h', label: '🧬 36 Sa Derin Temizlik', hours: 36, category: 'Derin Otofaji' },
  { id: '48h', label: '👑 48 Sa Kök Hücre', hours: 48, category: 'Derin Otofaji' },
  { id: '72h', label: '🛡️ 72 Sa Bağışıklık Sıfırlama', hours: 72, category: 'Derin Otofaji' }
];

export default function FastingTimerCard({ fastingData, onToggleFasting }: FastingProps) {
  const [selectedProtocol, setSelectedProtocol] = useState('16:8');
  const [isToggling, setIsToggling] = useState(false);

  const handleAction = async (action: 'start' | 'end') => {
    setIsToggling(true);
    await onToggleFasting(action, selectedProtocol);
    setIsToggling(false);
  };

  const activeProtoObj = FASTING_PROTOCOLS.find(p => p.id === fastingData.protocol) || FASTING_PROTOCOLS[0];

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>⏳</span>
          <span>Aralıklı Oruç & Otofaji ({fastingData.protocol || '16:8'})</span>
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
              <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 800, color: fastingData.phaseColor || '#6366F1', marginTop: '2px' }}>
                {fastingData.remainingText}
              </div>
            </div>
          </div>

          {/* İlerleme Çubuğu */}
          <div className="budget-bar-track" style={{ height: '8px' }}>
            <div className="budget-bar-fill" style={{ width: `${fastingData.progressPercent}%`, backgroundColor: fastingData.phaseColor || '#6366F1' }} />
          </div>

          {/* Biyolojik Faz Rozeti */}
          <div style={{ background: 'var(--surface-subtle)', border: `1px solid ${fastingData.phaseColor || 'var(--border)'}`, padding: '10px 12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: fastingData.phaseColor || 'var(--text-main)' }}>
              {fastingData.currentPhase}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {fastingData.phaseDescription}
            </div>
          </div>

          {/* Orucu Bitir Butonu */}
          <button 
            className="btn-secondary" 
            onClick={() => handleAction('end')}
            disabled={isToggling}
            style={{ padding: '10px', fontSize: '12px', color: 'var(--rose)', fontWeight: 800 }}
          >
            {isToggling ? 'İşleniyor...' : '🛑 Orucu Tamamla / Yemek Penceresini Aç'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Lütfen başlatmak istediğiniz aralıklı oruç veya otofaji protokolünü seçin:
          </div>

          {/* Protokol Seçim Menüsü */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Oruç / Otofaji Protokolü:
            </label>
            <select
              value={selectedProtocol}
              onChange={e => setSelectedProtocol(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontWeight: 800,
                fontSize: '13px',
                background: 'var(--surface-subtle)',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <optgroup label="☀️ Günlük Aralıklı Oruç">
                <option value="16:8">16:8 Standart (16 sa Oruç / 8 sa Yemek)</option>
                <option value="14:10">14:10 Başlangıç (14 sa Oruç / 10 sa Yemek)</option>
                <option value="12:12">12:12 Sirkadiyen Ritim (12 sa Oruç)</option>
                <option value="18:6">18:6 İleri Düzek (18 sa Oruç / 6 sa Yemek)</option>
                <option value="20:4">20:4 Savaşçı Diyeti (20 sa Oruç)</option>
                <option value="OMAD">23:1 OMAD (Günde Tek Öğün)</option>
              </optgroup>
              <optgroup label="🧬 Derin Otofaji & Yenilenme Uyumları">
                <option value="24h">🧬 24 Saat: Tam Otofaji & Glikojen Sıfırlaması</option>
                <option value="36h">🧬 36 Saat: Derin Otofaji & Hücresel Temizlik</option>
                <option value="48h">👑 48 Saat: Kök Hücre & Büyüme Hormonu Zirvesi</option>
                <option value="72h">🛡️ 72 Saat: Bağışıklık Sistemi Sıfırlaması</option>
              </optgroup>
            </select>
          </div>

          <button 
            className="btn-primary" 
            onClick={() => handleAction('start')}
            disabled={isToggling}
            style={{ padding: '12px', fontSize: '13px', fontWeight: 800, background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}
          >
            {isToggling ? 'Başlatılıyor...' : `🚀 ${selectedProtocol} Orucu Başlat`}
          </button>
        </div>
      )}
    </div>
  );
}

