'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Zap,
  Shield,
  Activity,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Play,
  Square
} from 'lucide-react';

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
    startTime?: string;
    targetEndTime?: string;
  };
  onToggleFasting: (action: 'start' | 'end', protocol?: string) => void;
}

const FASTING_PROTOCOLS = [
  { id: '16:8', label: '16:8 Standart', hours: 16, tag: 'Popüler' },
  { id: '18:6', label: '18:6 İleri Düzey', hours: 18, tag: 'Yağ Yakımı' },
  { id: '20:4', label: '20:4 Savaşçı', hours: 20, tag: 'Derin' },
  { id: 'OMAD', label: '23:1 OMAD', hours: 23, tag: 'Tek Öğün' },
  { id: '24h', label: '24s Otofaji', hours: 24, tag: 'Yenilenme' }
];

export default function FastingTimerCard({ fastingData, onToggleFasting }: FastingProps) {
  const [selectedProtocol, setSelectedProtocol] = useState(fastingData.protocol || '16:8');
  const [isToggling, setIsToggling] = useState(false);

  // SVG Radial Circle Hesaplaması
  const radius = 68;
  const strokeWidth = 10;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progressPercent = Math.min(100, Math.max(0, fastingData.progressPercent || 0));
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const handleAction = async (action: 'start' | 'end') => {
    setIsToggling(true);
    await onToggleFasting(action, selectedProtocol);
    setIsToggling(false);
  };

  const currentColor = fastingData.phaseColor || '#8B5CF6';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* 1. Başlık Çubuğu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              color: '#8B5CF6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Clock className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Aralıklı Oruç & Otofaji Sayacı
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Zero Fasting & Biyolojik Faz Algoritması
            </div>
          </div>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '999px',
            backgroundColor: fastingData.isActive ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-subtle)',
            color: fastingData.isActive ? '#10B981' : 'var(--text-muted)',
            border: `1px solid ${fastingData.isActive ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: fastingData.isActive ? '#10B981' : 'var(--text-muted)',
              boxShadow: fastingData.isActive ? '0 0 6px #10B981' : 'none'
            }}
          />
          {fastingData.isActive ? `Aktif (${fastingData.protocol || '16:8'})` : 'Pasif'}
        </span>
      </div>

      {fastingData.isActive ? (
        /* AKTİF ORUÇ GÖRÜNÜMÜ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'space-between' }}>
          {/* Dairesel SVG Sayaç */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 0',
              position: 'relative'
            }}
          >
            <div style={{ position: 'relative', width: `${radius * 2}px`, height: `${radius * 2}px` }}>
              <svg
                height={radius * 2}
                width={radius * 2}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
              >
                <defs>
                  <linearGradient id="fastingRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                </defs>

                {/* Arka Plan İzi */}
                <circle
                  stroke="var(--border)"
                  fill="transparent"
                  strokeWidth={strokeWidth}
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />

                {/* Dinamik İlerleme Çemberi */}
                <circle
                  stroke="url(#fastingRingGradient)"
                  fill="transparent"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  style={{
                    strokeDashoffset,
                    transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  strokeLinecap="round"
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
              </svg>

              {/* Daire İçi Sayaç Metni */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Geçen Süre
                </span>
                <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', marginTop: '1px' }}>
                  {fastingData.elapsedText || '00:00'}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#8B5CF6',
                    marginTop: '2px'
                  }}
                >
                  %{progressPercent}
                </div>
              </div>
            </div>
          </div>

          {/* İki Sütunlu Metrik Kutusu: Geçen vs Hedefe Kalan */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Geçen Süre</div>
              <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                {fastingData.elapsedText}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Hedefe Kalan</div>
              <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 800, color: '#8B5CF6', marginTop: '2px' }}>
                {fastingData.remainingText || 'Tamamlandı'}
              </div>
            </div>
          </div>

          {/* Metabolik Faz Kartı */}
          <div
            style={{
              backgroundColor: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#8B5CF6' }}>
                {fastingData.currentPhase || 'Metabolik Faz Analizi'}
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
              {fastingData.phaseDescription || 'Hücreler glikojen depolarını boşaltıyor ve yağ yakım moduna geçiş yapıyor.'}
            </p>
          </div>

          {/* Orucu Bitir Butonu */}
          <button
            type="button"
            onClick={() => handleAction('end')}
            disabled={isToggling}
            style={{
              width: '100%',
              padding: '11px',
              fontSize: '12px',
              fontWeight: 800,
              backgroundColor: 'rgba(244, 63, 94, 0.1)',
              color: '#F43F5E',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Square className="w-4 h-4 text-rose-500" />
            <span>{isToggling ? 'İşleniyor...' : '🛑 Orucu Tamamla & Yeme Penceresini Aç'}</span>
          </button>
        </div>
      ) : (
        /* PASİF / PROTOKOL SEÇİMİ GÖRÜNÜMÜ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Hedefinize uygun aralıklı oruç protokolünü seçerek yeni bir seans başlatın:
            </div>

            {/* Segmented Protokol Hapları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
              {FASTING_PROTOCOLS.map(proto => {
                const isSelected = selectedProtocol === proto.id;
                return (
                  <button
                    key={proto.id}
                    type="button"
                    onClick={() => setSelectedProtocol(proto.id)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid #8B5CF6' : '1px solid var(--border)',
                      backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.12)' : 'var(--surface-subtle)',
                      color: isSelected ? '#8B5CF6' : 'var(--text-main)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '3px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 800 }}>{proto.id}</span>
                    <span style={{ fontSize: '10px', color: isSelected ? '#8B5CF6' : 'var(--text-muted)' }}>
                      {proto.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Protokol Açıklama Kartı */}
          <div
            style={{
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Seçili Protokol: {selectedProtocol}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {selectedProtocol === '16:8' && '16 saat oruç, 8 saat yemek penceresi. Yağ yakımı ve kan şekeri optimizasyonu için altın standart.'}
              {selectedProtocol === '18:6' && '18 saat oruç, 6 saat yemek penceresi. Hızlandırılmış ketozis ve glikojen boşalımı sağlar.'}
              {selectedProtocol === '20:4' && '20 saat oruç, 4 saat yemek. Savaşçı diyeti; otofaji sürecini erken tetikler.'}
              {selectedProtocol === 'OMAD' && 'Günde tek öğün (23:1). Yüksek insülin duyarlılığı ve maksimum kalori kontrolü.'}
              {selectedProtocol === '24h' && '24 saat tam oruç. Kök hücre yenilenmesi ve tam hücresel temizlik (otofaji).'}
            </div>
          </div>

          {/* Başlat Butonu */}
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleAction('start')}
            disabled={isToggling}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isToggling ? 'Başlatılıyor...' : `🚀 ${selectedProtocol} Orucu Başlat`}</span>
          </button>
        </div>
      )}
    </div>
  );
}
