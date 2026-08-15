'use client';
import { useState, useEffect, useRef } from 'react';

interface Notification {
  id: string;
  title: string;
  subtitle: string;
  module: string;
  icon: string;
  days_left: number;
  priority: 'critical' | 'warning' | 'info';
  due_date: string;
}

interface Props {
  notifications: Notification[];
  critical: number;
  warning: number;
}

const PRIORITY_COLORS = {
  critical: { bg: '#FEF2F2', border: 'rgba(239,68,68,0.25)', text: '#DC2626', badge: '#EF4444' },
  warning:  { bg: '#FFFBEB', border: 'rgba(245,158,11,0.25)', text: '#D97706', badge: '#F59E0B' },
  info:     { bg: 'var(--surface-subtle)', border: 'var(--border)', text: 'var(--text-muted)', badge: '#6B7280' },
};

export default function NotificationHub({ notifications, critical, warning }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const totalBadge = critical + warning;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Çan Butonu */}
      <button
        id="notification-bell"
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative', border: 'none', cursor: 'pointer',
          width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', transition: 'background 0.2s',
          background: open ? 'var(--surface-subtle)' : 'transparent'
        } as React.CSSProperties}
        title="Bildirimler"
      >
        <span style={{ fontSize: '20px', animation: totalBadge > 0 ? 'bell-shake 1.5s ease-in-out infinite' : 'none' }}>🔔</span>
        {totalBadge > 0 && (
          <span style={{
            position: 'absolute', top: '3px', right: '3px',
            background: critical > 0 ? '#EF4444' : '#F59E0B',
            color: 'white', borderRadius: '50%', width: '16px', height: '16px',
            fontSize: '9px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid white'
          }}>
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: 'absolute', top: '44px', right: 0,
          width: '320px', maxHeight: '420px', overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          zIndex: 1000
        }}>
          {/* Header */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>🔔 Bildirimler</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {notifications.length === 0 ? 'Bekleyen bildirim yok' : `${notifications.length} bildirim`}
                {critical > 0 && <span style={{ color: '#EF4444', fontWeight: 700 }}> · {critical} kritik</span>}
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--text-muted)' }}>✕</button>
          </div>

          {/* Bildirim Listesi */}
          {notifications.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
              Tüm hatırlatıcılar güncel!
            </div>
          ) : (
            <div style={{ padding: '6px' }}>
              {notifications.map(n => {
                const colors = PRIORITY_COLORS[n.priority];
                return (
                  <div key={n.id} style={{ padding: '10px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 'var(--radius-md)', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{n.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                        <div style={{ fontSize: '11px', color: colors.text, marginTop: '1px' }}>{n.subtitle}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                          <span style={{ fontSize: '9px', background: colors.badge, color: 'white', padding: '1px 4px', borderRadius: '2px', fontWeight: 700 }}>
                            {n.module}
                          </span>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>📅 {n.due_date}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bell shake animation */}
      <style>{`
        @keyframes bell-shake {
          0%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(-8deg); }
          20% { transform: rotate(8deg); }
          30% { transform: rotate(-5deg); }
          40% { transform: rotate(5deg); }
          50%, 90% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
