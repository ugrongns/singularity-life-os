'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function HealthSubNav() {
  const pathname = usePathname();

  const isHealth = pathname === '/health';
  const isWellness = pathname === '/wellness';

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      marginBottom: '16px',
      background: 'var(--surface-subtle)',
      padding: '6px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)'
    }}>
      <Link
        href="/health"
        style={{
          flex: 1,
          textAlign: 'center',
          padding: '8px 12px',
          fontSize: '13px',
          fontWeight: 800,
          borderRadius: '6px',
          textDecoration: 'none',
          background: isHealth ? 'var(--surface)' : 'transparent',
          color: isHealth ? 'var(--blue)' : 'var(--text-muted)',
          border: isHealth ? '1px solid var(--border)' : '1px solid transparent',
          boxShadow: isHealth ? 'var(--shadow-sm)' : 'none',
          transition: 'all 0.2s'
        }}
      >
        🥗 Beslenme, Makrolar & Oruç
      </Link>

      <Link
        href="/wellness"
        style={{
          flex: 1,
          textAlign: 'center',
          padding: '8px 12px',
          fontSize: '13px',
          fontWeight: 800,
          borderRadius: '6px',
          textDecoration: 'none',
          background: isWellness ? 'var(--surface)' : 'transparent',
          color: isWellness ? 'var(--emerald)' : 'var(--text-muted)',
          border: isWellness ? '1px solid var(--border)' : '1px solid transparent',
          boxShadow: isWellness ? 'var(--shadow-sm)' : 'none',
          transition: 'all 0.2s'
        }}
      >
        🧘 Yaşam Merkezi, Su & Takviyeler
      </Link>
    </div>
  );
}
