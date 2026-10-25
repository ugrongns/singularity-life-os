'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sun,
  Sunset,
  Moon,
  AlertCircle,
  Clock,
  CheckCircle2,
  BookOpen,
  Pill,
  CreditCard,
  Droplets,
  Calendar,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface PriorityActionItem {
  id: string;
  level: 'critical' | 'warning' | 'routine';
  category: string;
  title: string;
  subtitle: string;
  actionText?: string;
  badge?: string;
  onClick?: () => void;
  href?: string;
}

interface TimeContextualFeedProps {
  userName?: string;
  upcomingPayments?: any[];
  wellnessData?: any;
  fastingData?: any;
  libraryData?: any;
  homeData?: any;
  shoppingData?: any;
  onOpenReadingSession?: () => void;
  onQuickTakeSupplements?: () => void;
  onQuickAddWater?: () => void;
}

export default function TimeContextualFeed({
  userName,
  upcomingPayments = [],
  wellnessData,
  fastingData,
  libraryData,
  homeData,
  shoppingData,
  onOpenReadingSession,
  onQuickTakeSupplements,
  onQuickAddWater
}: TimeContextualFeedProps) {
  const [period, setPeriod] = useState<'morning' | 'day' | 'evening'>('morning');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 6 && hour < 12) setPeriod('morning');
      else if (hour >= 12 && hour < 18) setPeriod('day');
      else setPeriod('evening');

      setCurrentTimeStr(
        now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const greetings = {
    morning: {
      title: `Günaydın${userName ? `, ${userName}` : ''} 🌅`,
      desc: 'Bugünün rutinlerini tamamla, güne zinde ve planlı başla.',
      icon: <Sun size={20} className="text-amber-500" strokeWidth={1.75} />,
      badgeColor: 'var(--amber)'
    },
    day: {
      title: `İyi Günler${userName ? `, ${userName}` : ''} ☀️`,
      desc: 'Öncelikli finansal ödemelere, hedeflerine ve görevlerine odaklan.',
      icon: <Sun size={20} className="text-blue-500" strokeWidth={1.75} />,
      badgeColor: 'var(--blue)'
    },
    evening: {
      title: `İyi Akşamlar${userName ? `, ${userName}` : ''} 🌙`,
      desc: 'Günün finans ve sağlık özetini incele, kitabını oku ve dinlen.',
      icon: <Moon size={20} className="text-purple-500" strokeWidth={1.75} />,
      badgeColor: 'var(--purple)'
    }
  };

  // Dinamik Öncelikli Aksiyon Listesi Çıkartımı
  const actions: PriorityActionItem[] = [];

  // 1. Kritik Seviye (Rose) Kontrolleri: Yaklaşan Faturalar / Kredi Kartı Ödemeleri (3 gün ve altı)
  if (upcomingPayments && upcomingPayments.length > 0) {
    const urgentPayments = upcomingPayments.filter((p: any) => p.days_left !== undefined && p.days_left <= 3);
    urgentPayments.slice(0, 2).forEach((p: any) => {
      actions.push({
        id: `payment-${p.id}`,
        level: 'critical',
        category: 'Finans & Fatura',
        title: `${p.title}: ${Number(p.amount).toLocaleString('tr-TR')} ₺`,
        subtitle: p.days_left <= 0 ? '🚨 Bugün son ödeme günü!' : `⏳ Son ${p.days_left} gün kaldı`,
        actionText: 'Öde / İncele',
        badge: 'KRİTİK',
        href: '/budget'
      });
    });
  }

  // 1.1 Ev Bakımı Acil Durumu
  if (homeData?.maintenanceRecords) {
    const urgentHome = homeData.maintenanceRecords.filter((r: any) => r.status === 'urgent' || r.days_left <= 5);
    urgentHome.slice(0, 1).forEach((r: any) => {
      actions.push({
        id: `home-${r.id}`,
        level: 'critical',
        category: 'Ev Operasyonları',
        title: `${r.title} Bakımı`,
        subtitle: `Vadesi geldi (${r.days_left <= 0 ? 'Gecikmede' : `${r.days_left} gün kaldı`})`,
        actionText: 'Görüntüle',
        badge: 'ACİL',
        href: '/vehicles'
      });
    });
  }

  // 2. Uyarı Seviyesi (Amber): Oruç, Su, Yaklaşan Önemli Günler
  if (fastingData?.is_active) {
    actions.push({
      id: 'fasting-active',
      level: 'warning',
      category: 'Aralıklı Oruç',
      title: `${fastingData.protocol || '16:8'} Oruç Devam Ediyor`,
      subtitle: fastingData.target_end_time ? `Bitiş: ${new Date(fastingData.target_end_time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : 'Hedefe doğru ilerliyorsunuz',
      actionText: 'Durum',
      badge: 'ZAMANLI',
      href: '/health'
    });
  }

  // Su Tüketimi Kontrolü
  const waterConsumed = wellnessData?.todayWater?.amount_ml ?? 0;
  if (waterConsumed < 1500) {
    actions.push({
      id: 'water-alert',
      level: 'warning',
      category: 'Hidrasyon',
      title: `Su Hedefi: ${waterConsumed} / 2500 ml`,
      subtitle: 'Günün hidrasyon hedefine ulaşmak için su için',
      actionText: '+500ml Ekle',
      badge: 'HEDEF',
      onClick: onQuickAddWater
    });
  }

  // 3. Rutin Seviye (Emerald): Takviyeler, Kitap Okuma Hedefi, Alışveriş
  const supplements = wellnessData?.supplements;
  if (supplements && (supplements.total > 0 && supplements.taken < supplements.total)) {
    actions.push({
      id: 'supplements-todo',
      level: 'routine',
      category: 'Wellness & Takviye',
      title: `Günlük Takviyeler: ${supplements.taken} / ${supplements.total} Alındı`,
      subtitle: period === 'morning' ? 'Sabah dozlarınızı almayı unutmayın' : 'Kalan takviyelerinizi tamamlayın',
      actionText: 'Tümünü Al',
      badge: 'RUTİN',
      onClick: onQuickTakeSupplements
    });
  }

  // Aktif Kitap Okuma Hedefi
  if (libraryData?.activeReadingBook) {
    const book = libraryData.activeReadingBook;
    actions.push({
      id: `book-${book.id}`,
      level: 'routine',
      category: 'Kütüphane & Odak',
      title: `"${book.title}" Okuma Hedefi`,
      subtitle: `Sayfa: ${book.current_page || 0} / ${book.total_pages || 0} • Günlük hedef: 20 sayfa`,
      actionText: 'Şimdi Oku',
      badge: 'GELİŞİM',
      onClick: onOpenReadingSession,
      href: '/library'
    });
  }

  // Alışveriş Listesi Bekleyen Kalemler
  if (shoppingData?.summary?.remaining > 0) {
    actions.push({
      id: 'shopping-pending',
      level: 'routine',
      category: 'Market & Ev',
      title: `${shoppingData.summary.remaining} Bekleyen Alışveriş Kalemi`,
      subtitle: `Tahmini sepet: ${shoppingData.summary.remainingEstimated || 0} ₺`,
      actionText: 'Listeyi Aç',
      badge: 'PLAN',
      href: '/shopping'
    });
  }

  // Eğer hiçbir acil işlem yoksa pozitif durum kartı
  if (actions.length === 0) {
    actions.push({
      id: 'all-clear',
      level: 'routine',
      category: 'Durum Mükemmel',
      title: 'Tüm Günlük Görevler Tamamlandı 🎉',
      subtitle: 'Kritik bir ödeme veya geciken bir rutin bulunmuyor. Harika gidiyorsun!',
      actionText: 'Detaylar',
      badge: 'TAMAM',
      href: '/analytics'
    });
  }

  const getBorderColor = (level: string) => {
    if (level === 'critical') return 'rgba(244, 63, 94, 0.4)';
    if (level === 'warning') return 'rgba(245, 158, 11, 0.4)';
    return 'rgba(16, 185, 129, 0.4)';
  };

  const getBadgeStyle = (level: string) => {
    if (level === 'critical') return { background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid rgba(244, 63, 94, 0.25)' };
    if (level === 'warning') return { background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid rgba(245, 158, 11, 0.25)' };
    return { background: 'var(--emerald-bg)', color: 'var(--emerald)', border: '1px solid rgba(16, 185, 129, 0.25)' };
  };

  const getIconForCategory = (cat: string) => {
    if (cat.includes('Finans') || cat.includes('Fatura')) return <CreditCard size={16} strokeWidth={1.75} />;
    if (cat.includes('Oruç')) return <Clock size={16} strokeWidth={1.75} />;
    if (cat.includes('Hidrasyon') || cat.includes('Su')) return <Droplets size={16} strokeWidth={1.75} />;
    if (cat.includes('Takviye') || cat.includes('Wellness')) return <Pill size={16} strokeWidth={1.75} />;
    if (cat.includes('Kütüphane')) return <BookOpen size={16} strokeWidth={1.75} />;
    return <Sparkles size={16} strokeWidth={1.75} />;
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '16px',
        height: '100%',
        minHeight: '320px'
      }}
    >
      {/* Üst Karşılama Başlığı */}
      <div className="card-header-block" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            className="icon-badge"
            style={{
              background: period === 'morning' ? 'var(--amber-bg)' : period === 'day' ? 'var(--blue-bg)' : 'rgba(168, 85, 247, 0.12)',
              color: period === 'morning' ? 'var(--amber)' : period === 'day' ? 'var(--blue)' : '#A855F7'
            }}
          >
            {greetings[period].icon}
          </div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {greetings[period].title}
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {greetings[period].desc}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            className="tabular-nums"
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--text-muted)',
              background: 'var(--surface-subtle)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border)'
            }}
          >
            🕒 {currentTimeStr}
          </span>
        </div>
      </div>

      {/* Aksiyon Şeridi (Mobilde Snap-Scroll, Masaüstünde Dikey Akış) */}
      <div
        className="pill-scroll-bar"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          overflowY: 'visible',
          overflowX: 'visible',
          width: '100%',
          maskImage: 'none',
          WebkitMaskImage: 'none'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
            Günün Kritik Aksiyonları ({actions.length})
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Öncelik Sıralı
          </span>
        </div>

        {actions.map((act) => {
          const content = (
            <div
              key={act.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--surface-subtle)',
                border: `1px solid ${getBorderColor(act.level)}`,
                borderRadius: 'var(--radius-md)',
                gap: '12px',
                transition: 'all 0.15s ease',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <div
                  className="icon-badge"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    ...getBadgeStyle(act.level)
                  }}
                >
                  {getIconForCategory(act.category)}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        ...getBadgeStyle(act.level)
                      }}
                    >
                      {act.badge}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {act.category}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {act.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {act.subtitle}
                  </div>
                </div>
              </div>

              {act.actionText && (
                <div style={{ flexShrink: 0 }}>
                  {act.onClick ? (
                    <button
                      type="button"
                      onClick={act.onClick}
                      className="btn-primary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: 'var(--radius-full)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {act.actionText}
                    </button>
                  ) : act.href ? (
                    <Link
                      href={act.href}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-main)',
                        fontSize: '11px',
                        fontWeight: 700,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <span>{act.actionText}</span>
                      <ArrowRight size={12} />
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          );

          return content;
        })}
      </div>

      {/* Alt Bilgi */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '10px',
          borderTop: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <CheckCircle2 size={13} color="var(--emerald)" />
          <span>Canlı Yaşam Takibi Aktif</span>
        </span>
        <Link
          href="/analytics"
          style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 700 }}
        >
          Yaşam Skoru Analitiği →
        </Link>
      </div>
    </div>
  );
}
