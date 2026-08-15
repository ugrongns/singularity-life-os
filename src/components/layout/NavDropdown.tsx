'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ALL_PAGES = [
  { href: '/',            icon: '🏠', label: 'Ana Sayfa',       desc: 'Özet dashboard' },
  { href: '/budget',      icon: '💰', label: 'Finans & Bütçe',  desc: 'Hesaplar, harcamalar, bütçe limitleri' },
  { href: '/investments', icon: '📈', label: 'Yatırımlar',      desc: 'Portföy, hisseler, BES, gayrimenkul' },
  { href: '/vehicles',    icon: '🚗', label: 'Araç & Ev',       desc: 'Araç bakımı, ev operasyonları' },
  { href: '/library',     icon: '📚', label: 'Kütüphane',       desc: 'Kitaplık, okuma hızı, alıntılar' },
  { href: '/health',      icon: '🧬', label: 'Sağlık',          desc: 'Beslenme, aralıklı oruç, gıda karnesi' },
  { href: '/vault',       icon: '🗂️', label: 'Dijital Kasa',    desc: 'Belgeler, önemli günler, evcil hayvan' },
  { href: '/wellness',    icon: '💊', label: 'Wellness',        desc: 'Takviyeler, uyku, ruh hali takibi' },
  { href: '/shopping',    icon: '🛒', label: 'Market Listesi',  desc: 'Alışveriş listesi & tahmini bütçe' },
  { href: '/analytics',   icon: '📊', label: 'Yaşam Skoru & FIRE', desc: 'Bütünsel skor, FIRE hedefi, enflasyon' },
  { href: '/settings',    icon: '⚙️', label: 'Ayarlar & Yedekleme', desc: 'AES-256 şifreli yedekleme, veri export' },
];

export default function NavDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const current = ALL_PAGES.find(p => p.href === pathname) || ALL_PAGES[0];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        id="nav-dropdown-btn"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 12px', borderRadius: 'var(--radius-md)',
          background: open ? 'var(--surface-subtle)' : 'transparent',
          border: '1px solid var(--border)',
          cursor: 'pointer', fontSize: '13px', fontWeight: 600,
          color: 'var(--text-main)', transition: 'all 0.15s'
        }}
      >
        <span>{current.icon}</span>
        <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current.label}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>
          ▼
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '42px', left: 0,
          width: '260px', maxHeight: '480px', overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          zIndex: 1001
        }}>
          <div style={{ padding: '6px' }}>
            {ALL_PAGES.map((page, i) => {
              const isActive = pathname === page.href;
              const isDivider = i === 9; // Ayarlar öncesi divider
              return (
                <div key={page.href}>
                  {isDivider && <div style={{ height: '1px', background: 'var(--border)', margin: '4px 8px' }} />}
                  <Link
                    href={page.href}
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '9px 10px', borderRadius: 'var(--radius-md)',
                      background: isActive ? 'var(--surface-subtle)' : 'transparent',
                      textDecoration: 'none', transition: 'background 0.15s'
                    }}
                  >
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{page.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: isActive ? 700 : 500, fontSize: '13px', color: isActive ? 'var(--text-main)' : 'var(--text-main)' }}>
                        {page.label}
                        {isActive && <span style={{ marginLeft: '6px', fontSize: '9px', background: 'var(--emerald)', color: 'white', padding: '1px 5px', borderRadius: '4px' }}>Şu an</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {page.desc}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
