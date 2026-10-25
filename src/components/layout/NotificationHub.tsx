'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Calendar
} from 'lucide-react';

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

const PRIORITY_THEMES = {
  critical: {
    badgeClass: 'icon-badge-rose',
    textColor: 'var(--rose)',
    tagBg: '#EF4444',
    border: 'rgba(239, 68, 68, 0.3)',
    bg: 'var(--rose-bg, rgba(244, 63, 94, 0.12))',
    Icon: AlertCircle
  },
  warning: {
    badgeClass: 'icon-badge-amber',
    textColor: 'var(--amber)',
    tagBg: '#F59E0B',
    border: 'rgba(245, 158, 11, 0.3)',
    bg: 'var(--amber-bg, rgba(245, 158, 11, 0.12))',
    Icon: AlertTriangle
  },
  info: {
    badgeClass: 'icon-badge-slate',
    textColor: 'var(--text-muted)',
    tagBg: '#6B7280',
    border: 'var(--border)',
    bg: 'var(--surface-subtle)',
    Icon: Info
  },
};

export default function NotificationHub({ notifications, critical, warning }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const totalBadge = critical + warning;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Çan Butonu (Minimum 44x44px Erişilebilir Dokunma Alanı) */}
      <button
        id="notification-bell"
        onClick={() => setOpen(!open)}
        aria-label="Bildirimler"
        aria-expanded={open}
        className="header-action-btn"
        style={{
          position: 'relative',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          background: open ? 'var(--surface-subtle)' : 'transparent',
          color: 'var(--text-main)'
        }}
        title="Bildirimler"
      >
        <span style={{ display: 'inline-flex', animation: totalBadge > 0 ? 'bell-shake 1.8s ease-in-out infinite' : 'none' }}>
          <Bell size={20} strokeWidth={1.75} />
        </span>

        {totalBadge > 0 && (
          <span
            className="tabular-nums"
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: critical > 0 ? '#EF4444' : '#F59E0B',
              color: 'white',
              borderRadius: '9999px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              fontSize: '10px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--surface)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
              lineHeight: 1
            }}
          >
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Bildirim Listesi"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '340px',
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: '440px',
            overflowY: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg), 0 16px 40px rgba(0,0,0,0.22)',
            zIndex: 1000,
            animation: 'modalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="icon-badge icon-badge-emerald" style={{ width: '30px', height: '30px', minWidth: '30px', minHeight: '30px' }}>
                <Bell size={16} strokeWidth={1.75} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>Bildirimler</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {notifications.length === 0 ? (
                    'Bekleyen bildirim yok'
                  ) : (
                    <span className="tabular-nums">
                      {notifications.length} bildirim
                      {critical > 0 && <span style={{ color: '#EF4444', fontWeight: 700 }}> · {critical} kritik</span>}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="modal-close-btn"
              aria-label="Kapat"
              style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          {/* Bildirim Listesi */}
          {notifications.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div className="icon-badge icon-badge-emerald" style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px', borderRadius: '50%' }}>
                <CheckCircle2 size={24} strokeWidth={1.75} />
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Tüm hatırlatıcılar güncel!</div>
              <div style={{ fontSize: '12px' }}>Yaklaşan acil fatura veya bakım bulunmuyor.</div>
            </div>
          ) : (
            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {notifications.map(n => {
                const theme = PRIORITY_THEMES[n.priority] || PRIORITY_THEMES.info;
                const PriorityIcon = theme.Icon;

                return (
                  <div
                    key={n.id}
                    style={{
                      padding: '12px',
                      background: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px'
                    }}
                  >
                    <div className={`icon-badge ${theme.badgeClass}`} style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}>
                      <PriorityIcon size={18} strokeWidth={1.75} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: '11px', color: theme.textColor, marginTop: '2px', lineHeight: 1.3 }}>
                        {n.subtitle}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        <span style={{ fontSize: '9px', background: theme.tagBg, color: 'white', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase' }}>
                          {n.module}
                        </span>
                        <span className="tabular-nums" style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Calendar size={11} strokeWidth={1.75} />
                          <span>{n.due_date}</span>
                        </span>
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
