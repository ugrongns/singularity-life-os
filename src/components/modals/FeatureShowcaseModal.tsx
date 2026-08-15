'use client';
import Link from 'next/link';

interface FeatureShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODULES_SHOWCASE = [
  {
    href: '/budget',
    icon: '💰',
    title: 'Finans & Bütçe',
    badge: 'Blok 1',
    description: 'Vadesiz hesaplar, kredi kartı ekstreleri, kategori limitleri ve AI Fiş/Fatura Tarama ile akıllı taksit bölme.'
  },
  {
    href: '/investments',
    icon: '📈',
    title: 'Yatırımlar & Portföy',
    badge: 'Blok 2',
    description: 'Çoklu para birimli Net Değer (₺/$/Altın/BTC), hisse/fon takibi, BES dinamik devlet katkısı ve gayrimenkul kira motoru.'
  },
  {
    href: '/vehicles',
    icon: '🚗',
    title: 'Araç & Ev Operasyonları',
    badge: 'Blok 2',
    description: 'Çift yönlü akaryakıt & servis defteri, TÜVTÜRK & Kasko hatırlatıcıları, su arıtma filtre ve demirbaş garanti takibi.'
  },
  {
    href: '/library',
    icon: '📚',
    title: 'Kütüphane & İkinci Beyin',
    badge: 'Blok 3',
    description: 'ISBN Barkod okuma, sayfa kelime kalibrasyon motoru, WPM okuma hızı ve dinamik kitap bitiş tahmini (ETA).'
  },
  {
    href: '/health',
    icon: '🧬',
    title: 'Bütünsel Sağlık & Beslenme',
    badge: 'Blok 3',
    description: 'Makro besin takibi, 16:8 Aralıklı Oruç sayacı, diyetisyen menü checklisti ve paketli gıda katkı/pestisit risk karnesi.'
  },
  {
    href: '/vault',
    icon: '🗂️',
    title: 'Dijital Kasa & Önemli Günler',
    badge: 'Blok 3',
    description: 'Pasaport, tapu, garanti ve taahhüt sözleşmeleri; yaklaşan doğum günleri ve evcil hayvan sağlık kayıtları.'
  },
  {
    href: '/wellness',
    icon: '💊',
    title: 'Wellness & Rutinler',
    badge: 'Blok 3',
    description: 'Tek tıkla takviye rutini alma & streak sayacı, uyku süresi/kalite grafiği ve 5 emojili günlük ruh hali takibi.'
  },
  {
    href: '/shopping',
    icon: '🛒',
    title: 'Akıllı Market Listesi',
    badge: 'Blok 4',
    description: 'Kategori bazlı alışveriş listesi, tahmini sepet tutarı ve diyetisyen menüsünden tek tıkla malzeme aktarımı.'
  },
  {
    href: '/analytics',
    icon: '📊',
    title: 'Yaşam Skoru & FIRE Analitiği',
    badge: 'Blok 4',
    description: '4 sütunlu Bütünsel Yaşam Skoru (0-100), pasif gelir karşılama oranı ve kişisel enflasyon endeksi.'
  },
  {
    href: '/settings',
    icon: '⚙️',
    title: 'Güvenlik & AES-256 Yedekleme',
    badge: 'Blok 4',
    description: '%100 yerel SQLite, askeri düzeyde AES-256-GCM şifreli yedekleme ve tam veri mahremiyeti.'
  }
];

export default function FeatureShowcaseModal({ isOpen, onClose }: FeatureShowcaseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        {/* Başlık */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--text-main)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px' }}>
              S
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800 }}>Singularity Life OS — Özellik Vitrini</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Kişisel & Aile Yaşam İşletim Sistemi v2.1 Master Mimarisi</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-muted)', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Özet Kartı */}
        <div style={{ background: 'linear-gradient(135deg, #111827, #1F2937)', color: 'white', padding: '16px', borderRadius: 'var(--radius-lg)', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>🌌 Zero-Friction & Bütünsel Yaşam Felsefesi</div>
          <div style={{ fontSize: '12px', color: '#D1D5DB', lineHeight: '1.5' }}>
            Ayrı ayrı kullanılan tüm finans, sağlık, araç ve ev sistemlerini tek bir yerel merkezde birleştiren, yapay zeka ve sesli komutlarla veri girme zahmetini minimuma indiren tam entegre yaşam işletim sistemi.
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '11px', color: '#9CA3AF' }}>
            <span>• <strong>10</strong> Aktif Modül</span>
            <span>• <strong>%100</strong> Yerel & Gizli</span>
            <span>• <strong>AES-256</strong> Şifreli</span>
          </div>
        </div>

        {/* Modüller Listesi */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {MODULES_SHOWCASE.map(mod => (
            <Link
              key={mod.href}
              href={mod.href}
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'inherit',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '26px', flexShrink: 0 }}>{mod.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{mod.title}</span>
                    <span style={{ fontSize: '9px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      {mod.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                    {mod.description}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>➔</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
