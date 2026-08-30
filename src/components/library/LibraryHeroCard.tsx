import { useState } from 'react';

interface LibraryHeroProps {
  profile: {
    yearly_target_books: number;
    completedBooksCount: number;
    targetProgressPercent: number;
    calibrated_avg_wpm: number;
    avgMinutesPerPage: string;
  };
  activeBook?: {
    id: string;
    title: string;
    author: string;
    total_pages: number;
    current_page: number;
    cover_url?: string;
    eta?: {
      remainingPages: number;
      hoursLeft: number;
      minutesLeft: number;
      text: string;
      progressPercent: number;
    };
  };
  onOpenSession: () => void;
  onOpenQuotes: () => void;
  onOpenBookDetail?: (book: any) => void;
  onUpdate?: (msg?: string) => void;
}

export default function LibraryHeroCard({ profile, activeBook, onOpenSession, onOpenQuotes, onOpenBookDetail, onUpdate }: LibraryHeroProps) {
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(String(profile.yearly_target_books || 24));
  const [savingTarget, setSavingTarget] = useState(false);

  const percent = activeBook
    ? (activeBook.eta?.progressPercent ?? (activeBook.total_pages > 0 ? Math.min(100, Math.round((activeBook.current_page / activeBook.total_pages) * 100)) : 0))
    : 0;
  const remaining = activeBook
    ? (activeBook.eta?.remainingPages ?? Math.max(0, activeBook.total_pages - activeBook.current_page))
    : 0;
  const etaText = activeBook?.eta?.text || '';

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInput || isNaN(Number(targetInput))) return;
    setSavingTarget(true);
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_target', yearly_target_books: Number(targetInput) })
      });
      const json = await res.json();
      if (json.success) {
        setIsEditingTarget(false);
        if (onUpdate) onUpdate(json.message);
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
      }
    } catch {
      //
    } finally {
      setSavingTarget(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>📚</span>
          <span>Dijital Kütüphane & Okuma Hızı</span>
        </div>
      </div>

      <div className="card-action-bar">
        <button className="btn-subtle" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={onOpenQuotes}>
          Alıntı Defteri ➔
        </button>
      </div>

      {/* 2026 Yıllık Hedef & WPM Hızı */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>2026 Yıllık Okuma Hedefi</div>
            <button
              type="button"
              onClick={() => setIsEditingTarget(!isEditingTarget)}
              style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: '0 4px' }}
            >
              {isEditingTarget ? 'Kapat' : '✏️ Hedefi Değiştir'}
            </button>
          </div>

          {isEditingTarget ? (
            <form onSubmit={handleSaveTarget} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
              <input
                type="number"
                min={1}
                max={500}
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                style={{ width: '70px', padding: '4px 8px', fontSize: '13px', fontWeight: 800, border: '1px solid var(--blue)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
              />
              <button
                type="submit"
                disabled={savingTarget}
                style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none', background: 'var(--blue)', color: 'white', cursor: 'pointer' }}
              >
                {savingTarget ? '...' : 'Kaydet'}
              </button>
            </form>
          ) : (
            <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px', color: 'var(--text-main)' }}>
              {profile.completedBooksCount} / {profile.yearly_target_books} Kitap Tamamlandı
            </div>
          )}

          <div className="budget-bar-track" style={{ height: '6px', marginTop: '8px' }}>
            <div className="budget-bar-fill" style={{ width: `${profile.targetProgressPercent}%`, backgroundColor: '#10B981' }} />
          </div>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Kalibre Edilmiş Hız</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#6366F1', marginTop: '2px' }}>
            ⚡ {profile.calibrated_avg_wpm} WPM
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            ~{profile.avgMinutesPerPage} dk / sayfa
          </div>
        </div>
      </div>

      {/* Şu An Okunan Kitap Odağı & Akıllı Bitiş Süresi (ETA) */}
      {activeBook ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div 
              style={{ cursor: onOpenBookDetail ? 'pointer' : 'default', flex: 1, display: 'flex', gap: '12px', alignItems: 'center' }}
              onClick={() => onOpenBookDetail && onOpenBookDetail(activeBook)}
            >
              {activeBook.cover_url ? (
                <img
                  src={activeBook.cover_url}
                  alt={activeBook.title}
                  style={{ width: '42px', height: '58px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                <div style={{
                  width: '42px', height: '58px', borderRadius: '6px',
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                  flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                  📖
                </div>
              )}

              <div>
                <span style={{ fontSize: '10px', background: '#EEF2FF', color: '#6366F1', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                  ŞU AN OKUNUYOR
                </span>
                <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '4px', color: 'var(--text-main)' }}>{activeBook.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{activeBook.author}</div>
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {etaText && (
                <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 800, color: '#6366F1' }}>
                  ⏳ {etaText}
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {remaining} Sayfa Kaldı
              </div>
            </div>
          </div>

          {/* Sayfa İlerleme Çubuğu */}
          <div 
            style={{ cursor: onOpenBookDetail ? 'pointer' : 'default' }}
            onClick={() => onOpenBookDetail && onOpenBookDetail(activeBook)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              <span>Sayfa {activeBook.current_page} / {activeBook.total_pages}</span>
              <span className="tabular-nums">%{percent}</span>
            </div>
            <div className="budget-bar-track" style={{ height: '8px' }}>
              <div className="budget-bar-fill" style={{ width: `${percent}%`, backgroundColor: '#6366F1' }} />
            </div>
          </div>

          {/* Hızlı Seans Kaydet Butonu */}
          <button 
            className="btn-secondary" 
            onClick={onOpenSession}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '8px' }}
          >
            <span>⏱️</span>
            <span>Okuma Seansı Kaydet (+Sayfa / Kalibre Et)</span>
          </button>
        </div>
      ) : (
        <div style={{ border: '1px border-dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', background: 'var(--surface-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>📖</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Şu an aktif okunan kitap yok.</div>
        </div>
      )}
    </div>
  );
}
