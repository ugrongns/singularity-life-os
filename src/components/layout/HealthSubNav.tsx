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
          background: isHealth ? 'white' : 'transparent',
          color: isHealth ? '#4F46E5' : 'var(--text-muted)',
          boxShadow: isHealth ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
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
          background: isWellness ? 'white' : 'transparent',
          color: isWellness ? '#059669' : 'var(--text-muted)',
          boxShadow: isWellness ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.2s'
        }}
      >
        🧘 Yaşam Merkezi, Su & Takviyeler
      </Link>
    </div>
  );
}
