'use client';

import { useState, useEffect } from 'react';
import {
  formatMilestoneProgress,
  formatRealAdvantage,
  getYearsToFireDisplay,
  calculateFireProgress
} from '@/lib/module4-utils';

interface Milestone {
  target: number;
  progress: number;
  label: string;
}

interface Props {
  fireMetrics: {
    monthlyPassiveIncome: number;
    monthlyLivingExpense: number;
    annualExpense?: number;
    passiveCoveragePercent: number;
    fireTargetNumber: number;
    totalNetWorth: number;
    fireProgressPercent: number;
    savingsRatePercent?: number;
    monthlySavingsEst?: number;
    effectiveMonthlyIncome?: number;
    yearsToFire: number;
    isHalfway?: boolean;
    milestones?: {
      lean: Milestone;
      regular: Milestone;
      fat: Milestone;
    };
  };
  inflationMetrics?: {
    personalInflationRate: number;
    officialTuikRate: number | null;
    savingVsOfficialTuikPercent: number | null;
    basketSummary: string;
  };
  onRefresh?: () => void;
}

const defaultInflationMetrics = {
  personalInflationRate: 0,
  officialTuikRate: null as number | null,
  savingVsOfficialTuikPercent: null as number | null,
  basketSummary: 'Reel harcama verilerine dayalı kişisel enflasyon endeksi'
};

export default function FireAnalyticsCard({ fireMetrics = {} as any, inflationMetrics, onRefresh }: Props) {
  const {
    monthlyPassiveIncome = 0,
    monthlyLivingExpense = 0,
    passiveCoveragePercent = 0,
    fireTargetNumber = 0,
    totalNetWorth = 0,
    fireProgressPercent = 0,
    yearsToFire = 0
  } = fireMetrics || {};

  const safeInflation = inflationMetrics || defaultInflationMetrics;
  const {
    personalInflationRate = 0,
    officialTuikRate = null,
    savingVsOfficialTuikPercent = null
  } = safeInflation;

  const annualExpense = fireMetrics?.annualExpense || (monthlyLivingExpense * 12);
  const savingsRatePercent = fireMetrics?.savingsRatePercent ?? 0;

  const [editingTuik, setEditingTuik] = useState(false);
  const [tuikInput, setTuikInput] = useState(officialTuikRate !== null ? String(officialTuikRate) : '');
  const [savingTuik, setSavingTuik] = useState(false);
  const [tuikError, setTuikError] = useState<string | null>(null);

  useEffect(() => {
    setTuikInput(officialTuikRate !== null ? String(officialTuikRate) : '');
  }, [officialTuikRate]);

  const handleSaveTuik = async (nextVal: string | null) => {
    setSavingTuik(true);
    setTuikError(null);
    try {
      const res = await fetch('/api/analytics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officialTuikRate: nextVal === null || nextVal.trim() === '' ? null : nextVal.trim()
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setTuikError(json?.error || 'TÜFE oranı kaydedilemedi.');
        return;
      }
      setEditingTuik(false);
      if (onRefresh) onRefresh();
      else window.dispatchEvent(new CustomEvent('singularity-refresh'));
    } catch {
      setTuikError('Sunucuya bağlanılamadı.');
    } finally {
      setSavingTuik(false);
    }
  };

  // Kilometre Taşları (Lean, Regular, Fat FIRE)
  const leanTarget = fireMetrics?.milestones?.lean?.target || Math.round(fireTargetNumber * 0.7);
  const regularTarget = fireMetrics?.milestones?.regular?.target || fireTargetNumber;
  const fatTarget = fireMetrics?.milestones?.fat?.target || Math.round(fireTargetNumber * 1.5);

  const leanProgress = fireMetrics?.milestones?.lean?.progress ?? calculateFireProgress(totalNetWorth, leanTarget);
  const regularProgress = fireMetrics?.milestones?.regular?.progress ?? calculateFireProgress(totalNetWorth, regularTarget);
  const fatProgress = fireMetrics?.milestones?.fat?.progress ?? calculateFireProgress(totalNetWorth, fatTarget);

  // Tasarruf Oranı Rozeti
  const getSavingsBadge = (rate: number) => {
    if (rate >= 60) return { label: '🚀 Ekstrem Hızlandırıcı', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
    if (rate >= 40) return { label: '⚡ Hızlı FIRE', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.12)' };
    if (rate >= 20) return { label: '👍 Dengeli Tasarruf', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' };
    return { label: '🌱 Başlangıç', color: 'var(--amber)', bg: 'rgba(245, 158, 11, 0.12)' };
  };

  const savingsBadge = getSavingsBadge(savingsRatePercent);
  const yearsToFireDisplay = getYearsToFireDisplay(
    fireTargetNumber,
    totalNetWorth,
    yearsToFire,
    savingsRatePercent,
    fireMetrics?.monthlySavingsEst
  );

  const milestonesList = [
    {
      key: 'lean',
      title: 'Lean FIRE (%70 Masraf)',
      sub: 'Minimalist / Temel İhtiyaçlar',
      target: leanTarget,
      progress: leanProgress,
      color: '#10B981',
      icon: '🌱'
    },
    {
      key: 'regular',
      title: 'Regular FIRE (%100 Masraf)',
      sub: 'Mevcut Yaşam Standardı',
      target: regularTarget,
      progress: regularProgress,
      color: '#6366F1',
      icon: '🎯'
    },
    {
      key: 'fat',
      title: 'Fat FIRE (%150 Masraf)',
      sub: 'Lüks, Seyahat & Cömert Bütçe',
      target: fatTarget,
      progress: fatProgress,
      color: '#EC4899',
      icon: '💎'
    }
  ];

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Kart Başlığı & Rozet */}
      <div className="card-title-row" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '8px' }}>
        <div className="card-title">
          <span style={{ fontSize: '20px' }}>🎯</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px' }}>Finansal Özgürlük (FIRE) Motoru</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>%4 Trinity Kuralı • Erken Emeklilik & Pasif Gelir Analitiği</div>
          </div>
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: 'var(--radius-full)',
          background: 'var(--indigo-bg)', color: 'var(--indigo)', border: '1px solid rgba(99, 102, 241, 0.3)',
          whiteSpace: 'nowrap', flexShrink: 0
        }}>
          %4 Kuralı Modeli
        </span>
      </div>

      {/* 1. 4 TEMEL FIRE KPI BENTO (2x2 Bento düzeni) */}
      <div className="analytics-kpi-grid">
        {/* KPI 1: Tasarruf Oranı */}
        <div style={{
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', minWidth: 0 }}>TASARRUF ORANI</span>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>📈</span>
          </div>
          <div style={{
            fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: 900, color: savingsBadge.color,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1.1
          }}>
            %{savingsRatePercent}
          </div>
          <div style={{
            fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
            background: savingsBadge.bg, color: savingsBadge.color, width: 'fit-content', marginTop: '2px'
          }}>
            {savingsBadge.label}
          </div>
        </div>

        {/* KPI 2: Yıllık Gider */}
        <div style={{
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', minWidth: 0 }}>YILLIK GİDER</span>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>💳</span>
          </div>
          <div style={{
            fontSize: 'clamp(14px, 3.8vw, 18px)', fontWeight: 900, color: 'var(--text-main)',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            ₺{annualExpense.toLocaleString('tr-TR')}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Aylık ₺{monthlyLivingExpense.toLocaleString('tr-TR')}
          </div>
        </div>

        {/* KPI 3: FIRE Hedef Sayısı */}
        <div style={{
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', minWidth: 0 }}>HEDEF FIRE (25X)</span>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>🎯</span>
          </div>
          <div style={{
            fontSize: 'clamp(14px, 3.8vw, 18px)', fontWeight: 900, color: 'var(--indigo)',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            ₺{fireTargetNumber.toLocaleString('tr-TR')}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            %4 Güvenli Çekim
          </div>
        </div>

        {/* KPI 4: Kalan Yıl Projeksiyonu */}
        <div style={{
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', minWidth: 0 }}>KALAN SÜRE</span>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>⏳</span>
          </div>
          <div style={{
            fontSize: 'clamp(12px, 3.5vw, 17px)', fontWeight: 900, color: yearsToFireDisplay.color,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {yearsToFireDisplay.text}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>
            Mevcut Hızla
          </div>
        </div>
      </div>

      {/* 2. BÜYÜK FIRE İLERLEME & PASİF GELİR KUTUSU */}
      <div style={{
        background: 'var(--surface-subtle)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              NET VARLIK VS REGULAR FIRE HEDEFİ
            </div>
            <div style={{
              fontSize: 'clamp(15px, 4vw, 19px)', fontWeight: 900, marginTop: '4px',
              fontVariantNumeric: 'tabular-nums', color: 'var(--text-main)'
            }}>
              ₺{totalNetWorth.toLocaleString('tr-TR')} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>/ ₺{fireTargetNumber.toLocaleString('tr-TR')}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span style={{
              fontSize: '22px', fontWeight: 900, color: 'var(--indigo)',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1
            }}>
              %{fireProgressPercent}
            </span>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
              Hedef Tamamlandı
            </div>
          </div>
        </div>

        {/* Büyük İlerleme Barı */}
        <div className="budget-bar-track" style={{ height: '10px', background: 'var(--surface)', borderRadius: '6px' }}>
          <div
            className="budget-bar-fill"
            style={{
              width: `${Math.min(100, Math.max(0, fireProgressPercent))}%`,
              background: 'linear-gradient(90deg, #6366F1, #38BDF8, #10B981)',
              boxShadow: fireProgressPercent > 0 ? '0 0 12px rgba(99, 102, 241, 0.4)' : 'none',
              transition: 'width 0.8s ease'
            }}
          />
        </div>

        {/* Pasif Gelir Karşılama İndikatörü */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
          padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', fontSize: '11px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span>⚡</span>
            <span style={{ color: 'var(--text-muted)' }}>Aylık Pasif Gelir:</span>
            <strong style={{ color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
              ₺{monthlyPassiveIncome.toLocaleString('tr-TR')}
            </strong>
          </div>
          <span style={{
            fontWeight: 800, color: 'var(--emerald)', background: 'var(--emerald-bg)',
            padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap'
          }}>
            Giderin %{passiveCoveragePercent}&apos;i Pasif Karşılanıyor
          </span>
        </div>
      </div>

      {/* 3. ÜÇ KADEMELİ FIRE KİLOMETRE TAŞLARI (LEAN, REGULAR, FAT FIRE) */}
      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '10px', fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)'
        }}>
          <span>FIRE KİLOMETRE TAŞLARI (MILESTONES)</span>
          <span style={{ fontSize: '11px', color: 'var(--indigo)', fontWeight: 700 }}>Trinity Modeli</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {milestonesList.map(m => {
            const isCompleted = m.progress >= 100;
            return (
              <div
                key={m.key}
                style={{
                  background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '12px 14px',
                  display: 'flex', flexDirection: 'column', gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{m.icon}</span>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {m.title}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {m.sub}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      ₺{m.target.toLocaleString('tr-TR')}
                    </div>
                    <span style={{
                      fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                      background: isCompleted ? 'var(--emerald-bg)' : 'var(--surface)',
                      color: isCompleted ? 'var(--emerald)' : m.color,
                      border: `1px solid ${isCompleted ? 'var(--emerald)' : m.color}40`,
                      display: 'inline-block', marginTop: '2px'
                    }}>
                      {formatMilestoneProgress(m.progress, isCompleted)}
                    </span>
                  </div>
                </div>

                {/* Kilometre Taşı Çubuğu */}
                <div className="budget-bar-track" style={{ height: '6px', background: 'var(--surface)', borderRadius: '4px' }}>
                  <div
                    className="budget-bar-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, m.progress))}%`,
                      backgroundColor: m.color,
                      boxShadow: m.progress > 0 ? `0 0 8px ${m.color}60` : 'none',
                      transition: 'width 0.8s ease'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. KİŞİSEL ENFLASYON VS RESMİ TÜFE SEPETİ */}
      <div style={{
        background: 'var(--surface-subtle)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '14px', marginTop: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📊</span>
            <span>Kişisel Enflasyon vs Resmi TÜFE Sepeti</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => {
                setTuikError(null);
                setEditingTuik((prev) => !prev);
              }}
              style={{
                fontSize: '10px', background: 'var(--surface)', color: 'var(--text-main)',
                border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '4px',
                fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              {editingTuik ? 'İptal' : officialTuikRate !== null ? '✏️ TÜFE Düzenle' : '✏️ TÜFE Gir'}
            </button>
            <span style={{
              fontSize: '10px', background: 'var(--amber-bg)', color: 'var(--amber)',
              padding: '2px 6px', borderRadius: '4px', fontWeight: 800, whiteSpace: 'nowrap'
            }}>
              Reel Sepet
            </span>
          </div>
        </div>

        {editingTuik && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveTuik(tuikInput);
            }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '10px' }}
          >
            <input
              type="number"
              step="0.1"
              min="0"
              max="500"
              aria-label="Resmi TÜİK TÜFE Oranı (%)"
              placeholder="TÜFE % (örn: 48.6)"
              value={tuikInput}
              onChange={(e) => setTuikInput(e.target.value)}
              disabled={savingTuik}
              style={{
                flex: '1 1 120px',
                minWidth: 0,
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 700
              }}
            />
            <button
              type="submit"
              disabled={savingTuik}
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              {savingTuik ? '...' : 'Kaydet'}
            </button>
            {officialTuikRate !== null && (
              <button
                type="button"
                disabled={savingTuik}
                onClick={() => handleSaveTuik(null)}
                className="btn-subtle"
                style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, border: '1px solid var(--border)', whiteSpace: 'nowrap' }}
              >
                Temizle
              </button>
            )}
            {tuikError && (
              <div style={{ width: '100%', fontSize: '11px', color: '#EF4444', fontWeight: 600 }}>
                {tuikError}
              </div>
            )}
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
          <div style={{ background: 'var(--surface)', padding: '8px 6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Kişisel Enflasyon</div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--amber)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              %{personalInflationRate}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', padding: '8px 6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Resmi TÜİK TÜFE</div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              {officialTuikRate !== null ? `%${officialTuikRate}` : '—'}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', padding: '8px 6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', color: savingVsOfficialTuikPercent !== null && savingVsOfficialTuikPercent < 0 ? '#F43F5E' : 'var(--emerald)' }}>Reel Avantaj</div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: savingVsOfficialTuikPercent !== null && savingVsOfficialTuikPercent < 0 ? '#F43F5E' : 'var(--emerald)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              {savingVsOfficialTuikPercent !== null ? formatRealAdvantage(savingVsOfficialTuikPercent) : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
