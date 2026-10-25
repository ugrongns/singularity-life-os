'use client';

import React, { useState } from 'react';
import { BookOpen, Clock, Zap, Trophy, Edit3, Check, Bookmark, Sparkles } from 'lucide-react';

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

export default function LibraryHeroCard({
  profile,
  activeBook,
  onOpenSession,
  onOpenQuotes,
  onOpenBookDetail,
  onUpdate
}: LibraryHeroProps) {
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
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Üst Bar: Başlık ve Alıntı Defteri Butonu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: '#6366F1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <BookOpen size={20} color="#6366F1" />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 900, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Dijital Kütüphane & Okuma Analitiği
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Literal.club & Apple Books Standardında Odaklanmış Okuma
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenQuotes}
          style={{
            height: '34px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 700,
            color: '#6366F1',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.16)';
            e.currentTarget.style.borderColor = '#6366F1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)';
          }}
        >
          <Bookmark size={14} color="#6366F1" />
          <span>Alıntı & Çıkarım Defteri</span>
          <span style={{ fontSize: '12px' }}>➔</span>
        </button>
      </div>

      {/* 2. Hero Bento Grid: Sol: "Şu An Okunuyor" Vitrini (1.2fr) | Sağ: Hedef & WPM KPI'ları (1fr) */}
      <div className="library-hero-bento">
        {/* SOL: "ŞU AN OKUNUYOR" (NOW READING) VİTRİN KARTI */}
        {activeBook ? (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              boxSizing: 'border-box'
            }}
          >
            {/* Arka plan zarif ışıltı deseni */}
            <div
              style={{
                position: 'absolute',
                top: '-30px',
                right: '-30px',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
                pointerEvents: 'none'
              }}
            />

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', width: '100%', minWidth: 0 }}>
              {/* Kitap Kapağı Vitrini */}
              <div
                onClick={() => onOpenBookDetail && onOpenBookDetail(activeBook)}
                style={{
                  width: '74px',
                  height: '108px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  cursor: onOpenBookDetail ? 'pointer' : 'default',
                  boxShadow: '0 8px 18px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  position: 'relative',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
              >
                {activeBook.cover_url ? (
                  <img
                    src={activeBook.cover_url}
                    alt={activeBook.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px'
                    }}
                  >
                    📖
                  </div>
                )}
              </div>

              {/* Kitap Bilgileri & Rozet */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'rgba(99, 102, 241, 0.16)',
                      color: '#6366F1',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Şu An Okunuyor
                  </span>
                  {etaText && (
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        color: '#10B981',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Clock size={11} color="#10B981" />
                      <span>{etaText} kaldı</span>
                    </span>
                  )}
                </div>

                <h3
                  onClick={() => onOpenBookDetail && onOpenBookDetail(activeBook)}
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    margin: '4px 0 0',
                    color: 'var(--text-main)',
                    lineHeight: '1.25',
                    cursor: onOpenBookDetail ? 'pointer' : 'default',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word'
                  }}
                  title={activeBook.title}
                >
                  {activeBook.title}
                </h3>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeBook.author}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {remaining > 0 ? (
                    <span><strong>{remaining}</strong> sayfa kaldı</span>
                  ) : (
                    <span style={{ color: '#10B981', fontWeight: 700 }}>Kitap tamamlanmak üzere! 🎉</span>
                  )}
                </div>
              </div>
            </div>

            {/* İlerleme Çubuğu & Sayfa Göstergesi */}
            <div style={{ width: '100%', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>
                <span className="tabular-nums" style={{ color: 'var(--text-main)' }}>
                  Sayfa {activeBook.current_page} / {activeBook.total_pages}
                </span>
                <span className="tabular-nums" style={{ color: '#6366F1', fontWeight: 800 }}>
                  %{percent}
                </span>
              </div>

              <div style={{ height: '7px', backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: '999px', overflow: 'hidden', width: '100%' }}>
                <div
                  style={{
                    width: `${percent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #6366F1 0%, #8B5CF6 100%)',
                    borderRadius: '999px',
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
            </div>

            {/* Hızlı Aksiyon Butonları */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', minWidth: 0, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={onOpenSession}
                style={{
                  flex: '1 1 auto',
                  minWidth: '140px',
                  height: '36px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <Clock size={14} />
                <span>Okuma Seansı Kaydet</span>
              </button>

              {onOpenBookDetail && (
                <button
                  type="button"
                  onClick={() => onOpenBookDetail(activeBook)}
                  style={{
                    flex: '0 0 auto',
                    height: '36px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>Detay</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Aktif Kitap Yoksa Gösterilen Zarif Boş Durum */
          <div
            style={{
              background: 'var(--surface-subtle)',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '10px',
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}
            >
              📖
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                Şu An Aktif Okunan Kitap Yok
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '320px' }}>
                Aşağıdaki raflarınızdan bir kitabı &quot;Okunuyor&quot; durumuna getirin veya seans kaydederek tempoyu başlatın.
              </div>
            </div>
          </div>
        )}

        {/* SAĞ: KPI VE HEDEF BENTO KUTULARI (2 Sütunlu Kompakt Izgara) */}
        <div className="library-kpi-grid">
          {/* KPI 1: YILLIK OKUMA HEDEFİ */}
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 10px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '8px',
              minWidth: 0,
              boxSizing: 'border-box'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  <Trophy size={13} color="#10B981" />
                  <span>2026 Hedefi</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingTarget(!isEditingTarget)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '2px'
                  }}
                  title="Yıllık hedefi güncelle"
                >
                  <Edit3 size={11} />
                  <span>{isEditingTarget ? 'Kapat' : 'Değiştir'}</span>
                </button>
              </div>

              {isEditingTarget ? (
                <form onSubmit={handleSaveTarget} style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={500}
                    value={targetInput}
                    onChange={e => setTargetInput(e.target.value)}
                    style={{
                      width: '54px',
                      padding: '4px 6px',
                      fontSize: '13px',
                      fontWeight: 800,
                      border: '1px solid #10B981',
                      borderRadius: '6px',
                      background: 'var(--surface)',
                      color: 'var(--text-main)'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={savingTarget}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      background: '#10B981',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <Check size={11} />
                    <span>{savingTarget ? '...' : 'Kaydet'}</span>
                  </button>
                </form>
              ) : (
                <div style={{ marginTop: '6px' }}>
                  <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', lineHeight: '1.1' }}>
                    {profile.completedBooksCount} <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>/ {profile.yearly_target_books}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    Kitap Tamamlandı
                  </div>
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, color: '#10B981', marginBottom: '4px' }}>
                <span>İlerleme</span>
                <span className="tabular-nums">%{profile.targetProgressPercent}</span>
              </div>
              <div style={{ height: '6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${profile.targetProgressPercent}%`,
                    height: '100%',
                    backgroundColor: '#10B981',
                    borderRadius: '999px',
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
            </div>
          </div>

          {/* KPI 2: OKUMA HIZI & WPM KALİBRASYONU */}
          <div
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 10px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '8px',
              minWidth: 0,
              boxSizing: 'border-box'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                <Zap size={13} color="#6366F1" />
                <span>Okuma Hızı</span>
              </div>

              <div style={{ marginTop: '6px' }}>
                <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 900, color: '#6366F1', lineHeight: '1.1' }}>
                  {profile.calibrated_avg_wpm} <span style={{ fontSize: '11px', fontWeight: 700 }}>WPM</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                  Ortalama Kelime / Dk
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                padding: '5px 7px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '10px',
                gap: '4px',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Sayfa Başı:</span>
              <span className="tabular-nums" style={{ fontWeight: 800, color: '#6366F1', whiteSpace: 'nowrap' }}>
                ~{profile.avgMinutesPerPage} dk
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
