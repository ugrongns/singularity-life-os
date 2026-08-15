'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '36px', marginBottom: '10px' }}>⚠️ Bir Hata Oluştu</h1>
      <p style={{ color: '#6B7280', marginBottom: '20px' }}>{error.message || 'Beklenmeyen bir hata meydana geldi.'}</p>
      <button onClick={() => reset()} className="btn-primary" style={{ padding: '10px 20px', borderRadius: '8px' }}>
        Yeniden Dene
      </button>
    </div>
  );
}
