import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '48px', marginBottom: '10px' }}>404</h1>
      <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Sayfa Bulunamadı</h2>
      <Link href="/" className="btn-primary" style={{ textDecoration: 'none', padding: '10px 20px', borderRadius: '8px' }}>
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}
