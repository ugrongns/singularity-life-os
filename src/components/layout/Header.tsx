'use client';
import { ReactNode } from 'react';

interface HeaderProps {
  notificationSlot?: ReactNode;
}

export default function Header({ notificationSlot }: HeaderProps) {
  const today = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <header className="app-header">
      <div className="brand-badge">
        <div className="brand-icon">S</div>
        <div>
          <div className="brand-title">Singularity Life OS</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Kişisel & Aile Yönetim Merkezi</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {notificationSlot}
        <div className="status-pill">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--emerald)' }}></span>
          <span>Yerel Sunucu</span>
          <span>•</span>
          <span>{today}</span>
        </div>
      </div>
    </header>
  );
}
