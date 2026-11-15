import React from 'react';

export interface PageLoadingStateProps {
  icon: string;
  title: string;
  description?: string;
  color?: string;
  fullScreen?: boolean;
}

export default function PageLoadingState({
  icon,
  title,
  description,
  color = '#3B82F6',
  fullScreen = false
}: PageLoadingStateProps) {
  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: fullScreen ? '20px' : '72px 20px',
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        userSelect: 'none'
      }}
    >
      {/* 🔮 Animasyonlu Simge Kozası (Floating Glow Pod) */}
      <div
        style={{
          width: '76px',
          height: '76px',
          borderRadius: '24px',
          background: 'var(--surface)',
          border: `1.5px solid ${color}40`,
          boxShadow: `0 8px 28px -4px ${color}33, inset 0 0 16px ${color}1a`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '18px',
          animation: 'floatGlow 2.5s ease-in-out infinite',
          position: 'relative'
        }}
      >
        <span
          style={{
            fontSize: '36px',
            lineHeight: 1,
            display: 'inline-block',
            animation: 'iconPulse 2.5s ease-in-out infinite'
          }}
          role="img"
          aria-label={title}
        >
          {icon}
        </span>
      </div>

      {/* 📝 Başlık & Açıklama */}
      <h3
        style={{
          fontSize: '16px',
          fontWeight: 800,
          color: 'var(--text-main)',
          margin: 0,
          letterSpacing: '-0.3px'
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            margin: '6px 0 0',
            maxWidth: '380px',
            lineHeight: 1.45
          }}
        >
          {description}
        </p>
      )}

      {/* ⚡ Akıcı İlerleme Çubuğu (Shimmer Bar) */}
      <div
        style={{
          width: '130px',
          height: '3px',
          background: 'var(--surface-subtle)',
          borderRadius: '999px',
          overflow: 'hidden',
          marginTop: '16px',
          position: 'relative'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '60%',
            height: '100%',
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            borderRadius: '999px',
            animation: 'shimmerBar 1.4s ease-in-out infinite'
          }}
        />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        {content}
      </div>
    );
  }

  return content;
}
