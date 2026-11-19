'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowRight, Sparkles, Command } from 'lucide-react';
import { matchesTurkishQuery } from '@/lib/date-utils';
import type { SearchResultItem } from '@/app/api/search/route';

interface CommandItem {
  id: string;
  label: string;
  subtitle: string;
  icon: string;
  group: 'recommended' | 'commands' | 'pages';
  keywords?: string;
  execute: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
  onTriggerAction: (actionKey: 'voice' | 'task' | 'manual' | 'receipt' | 'plate' | 'barcode') => void;
  onQuickWater: () => Promise<void>;
  onToggleTheme: () => void;
}

const PAGE_ITEMS = [
  { href: '/', label: 'Ana Sayfa (Özet Panel)', icon: '🏠', keywords: 'dashboard ozet home' },
  { href: '/tasks', label: 'Görevler & Odak (MIT & Kanban)', icon: '✅', keywords: 'gorev mit odak pomodoro kanban' },
  { href: '/budget', label: 'Finans & Bütçe', icon: '💰', keywords: 'butce finans para kart kredi fatura birikim' },
  { href: '/vehicles', label: 'Araç & Ev Filosu', icon: '🚗', keywords: 'arac ev bakim yakit muayene' },
  { href: '/library', label: 'Kütüphane & Okuma', icon: '📚', keywords: 'kitap kutuphane okuma alinti wpm' },
  { href: '/notes', label: 'Notlar & İkinci Beyin', icon: '📝', keywords: 'not markdown ikinci beyin klasor gunluk' },
  { href: '/health', label: 'Sağlık & Beslenme', icon: '🩺', keywords: 'saglik yemek kalori besin oruc antrenman' },
  { href: '/wellness', label: 'Wellness & Akıllı Tartı', icon: '✨', keywords: 'wellness tarti uyku ruh hali su takviye' },
  { href: '/habits', label: 'Alışkanlıklar & Rutinler', icon: '🔁', keywords: 'aliskanlik habit rutin seri kota rozet' },
  { href: '/shopping', label: 'Market Listesi', icon: '🛒', keywords: 'market alisveris sepet reyon' },
  { href: '/vault', label: 'Dijital Kasa', icon: '🔐', keywords: 'kasa evrak pasaport ehliyet sigorta' },
  { href: '/analytics', label: 'Bütünsel Yaşam Skoru', icon: '📊', keywords: 'skor analiz fire isi haritasi' },
  { href: '/settings', label: 'Ayarlar & Yedekleme', icon: '⚙️', keywords: 'ayarlar yedek profil aile' }
];

export default function CommandPaletteModal({
  isOpen,
  onClose,
  pathname,
  onTriggerAction,
  onQuickWater,
  onToggleTheme
}: CommandPaletteModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [remoteResults, setRemoteResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modal açıldığında inputu odakla ve state'i sıfırla
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setRemoteResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  // 2+ karakterde 180ms debounce ile API araması
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemoteResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.results)) {
          setRemoteResults(json.data.results);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setRemoteResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  const staticCommands: CommandItem[] = useMemo(() => {
    const go = (href: string) => {
      onClose();
      router.push(href);
    };

    const recommendedIds = new Set<string>();
    if (pathname.startsWith('/library')) {
      recommendedIds.add('cmd-reading');
      recommendedIds.add('cmd-barcode');
    } else if (pathname.startsWith('/budget')) {
      recommendedIds.add('cmd-manual-tx');
      recommendedIds.add('cmd-receipt');
    } else if (pathname.startsWith('/tasks')) {
      recommendedIds.add('cmd-task');
      recommendedIds.add('cmd-voice');
    } else if (pathname.startsWith('/health') || pathname.startsWith('/wellness')) {
      recommendedIds.add('cmd-water');
      recommendedIds.add('cmd-voice');
    } else if (pathname.startsWith('/vehicles')) {
      recommendedIds.add('cmd-plate');
      recommendedIds.add('cmd-receipt');
    } else {
      recommendedIds.add('cmd-task');
      recommendedIds.add('cmd-manual-tx');
    }

    const baseCommands: Omit<CommandItem, 'group'>[] = [
      {
        id: 'cmd-water',
        label: '+250 ml Su Ekle',
        subtitle: 'Bugünkü su tüketimine anında 1 bardak ekle',
        icon: '💧',
        keywords: 'su ic ekle 250 ml bardak wellness',
        execute: () => {
          onClose();
          onQuickWater();
        }
      },
      {
        id: 'cmd-task',
        label: 'Yeni Görev / Odak Belirle',
        subtitle: 'Günün 3 odağı (MIT) veya yeni yapılacak ekle',
        icon: '✅',
        keywords: 'gorev ekle mit yeni yapilacak',
        execute: () => {
          onClose();
          onTriggerAction('task');
        }
      },
      {
        id: 'cmd-manual-tx',
        label: 'Hızlı Harcama / Gelir Ekle',
        subtitle: 'Cüzdan veya kredi kartına işlem kaydet',
        icon: '💸',
        keywords: 'harcama gelir islem para butce ekle',
        execute: () => {
          onClose();
          onTriggerAction('manual');
        }
      },
      {
        id: 'cmd-receipt',
        label: 'Fiş / Fatura Tara (AI)',
        subtitle: 'Fiş fotoğrafından otomatik harcama çıkar',
        icon: '🧾',
        keywords: 'fis fatura tara ocr ai kamera',
        execute: () => {
          onClose();
          onTriggerAction('receipt');
        }
      },
      {
        id: 'cmd-voice',
        label: 'Sesli Çoklu Komut',
        subtitle: 'Doğal dille harcama, görev, su veya market ekle',
        icon: '🎙️',
        keywords: 'sesli komut mikrofon konus',
        execute: () => {
          onClose();
          onTriggerAction('voice');
        }
      },
      {
        id: 'cmd-reading',
        label: 'Okuma Seansı / Kitap Ekle',
        subtitle: 'Kütüphane sayfasına geç ve okuma kaydı aç',
        icon: '📖',
        keywords: 'kitap okuma seans kronometre',
        execute: () => go('/library')
      },
      {
        id: 'cmd-barcode',
        label: 'Barkod / ISBN Tara',
        subtitle: 'Kitap ISBN veya paketli gıda barkodu okut',
        icon: '📷',
        keywords: 'barkod isbn tara kitap gida',
        execute: () => {
          onClose();
          onTriggerAction('barcode');
        }
      },
      {
        id: 'cmd-plate',
        label: 'Araç Plaka / Yakıt Tara',
        subtitle: 'Plaka veya akaryakıt fişi tarama ekranını aç',
        icon: '🚘',
        keywords: 'plaka arac yakit benzin tara',
        execute: () => {
          onClose();
          onTriggerAction('plate');
        }
      },
      {
        id: 'cmd-theme',
        label: 'Tema Değiştir (Açık / Koyu)',
        subtitle: 'Arayüz temasını anında değiştir',
        icon: '🌓',
        keywords: 'tema dark light koyu acik gorunum',
        execute: () => {
          onToggleTheme();
          onClose();
        }
      }
    ];

    const items: CommandItem[] = [
      ...baseCommands.map(cmd => ({
        ...cmd,
        group: (recommendedIds.has(cmd.id) ? 'recommended' : 'commands') as 'recommended' | 'commands'
      })),
      ...PAGE_ITEMS.map(page => ({
        id: `page-${page.href}`,
        label: page.label,
        subtitle: `Sayfaya git → ${page.href}`,
        icon: page.icon,
        group: 'pages' as const,
        keywords: page.keywords,
        execute: () => go(page.href)
      }))
    ];

    return items;
  }, [pathname, onClose, onQuickWater, onToggleTheme, onTriggerAction, router]);

  const filteredStatic = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return staticCommands;
    return staticCommands.filter(item =>
      matchesTurkishQuery(trimmed, [item.label, item.subtitle, item.keywords])
    );
  }, [query, staticCommands]);

  const flatSelectableItems = useMemo(() => {
    const list: Array<{ key: string; label: string; subtitle: string; icon: string; section: string; onSelect: () => void }> = [];

    if (query.trim().length === 0) {
      const rec = filteredStatic.filter(i => i.group === 'recommended');
      const cmds = filteredStatic.filter(i => i.group === 'commands');
      const pages = filteredStatic.filter(i => i.group === 'pages');
      rec.forEach(i => list.push({ key: i.id, label: i.label, subtitle: i.subtitle, icon: i.icon, section: '⚡ Bu Sayfa İçin Önerilen', onSelect: i.execute }));
      cmds.forEach(i => list.push({ key: i.id, label: i.label, subtitle: i.subtitle, icon: i.icon, section: '🚀 Hızlı Komutlar', onSelect: i.execute }));
      pages.forEach(i => list.push({ key: i.id, label: i.label, subtitle: i.subtitle, icon: i.icon, section: '🧭 Modüller & Sayfalar', onSelect: i.execute }));
    } else {
      remoteResults.forEach(r =>
        list.push({
          key: r.id,
          label: r.title,
          subtitle: r.subtitle,
          icon: r.icon,
          section: `🔎 ${r.categoryLabel}`,
          onSelect: () => {
            onClose();
            router.push(r.href);
          }
        })
      );
      filteredStatic.forEach(i =>
        list.push({
          key: i.id,
          label: i.label,
          subtitle: i.subtitle,
          icon: i.icon,
          section: i.group === 'pages' ? '🧭 Modüller & Sayfalar' : '🚀 Hızlı Komutlar',
          onSelect: i.execute
        })
      );
    }

    return list;
  }, [query, filteredStatic, remoteResults, onClose, router]);

  useEffect(() => {
    if (selectedIndex >= flatSelectableItems.length) {
      setSelectedIndex(0);
    }
  }, [flatSelectableItems.length, selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatSelectableItems.length > 0) {
        setSelectedIndex(prev => (prev + 1) % flatSelectableItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatSelectableItems.length > 0) {
        setSelectedIndex(prev => (prev - 1 + flatSelectableItems.length) % flatSelectableItems.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = flatSelectableItems[selectedIndex];
      if (target) {
        target.onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  // Bölümlere göre grupla (render sırasında sırayı koru)
  const groupedSections: Array<{ title: string; items: Array<(typeof flatSelectableItems)[number] & { globalIdx: number }> }> = [];
  flatSelectableItems.forEach((item, idx) => {
    let sec = groupedSections.find(s => s.title === item.section);
    if (!sec) {
      sec = { title: item.section, items: [] };
      groupedSections.push(sec);
    }
    sec.items.push({ ...item, globalIdx: idx });
  });

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 1200,
        alignItems: 'flex-start',
        paddingTop: 'min(10vh, 72px)',
        paddingLeft: '12px',
        paddingRight: '12px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global Komut ve Arama Paleti"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '78dvh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Arama Giriş Barı */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-subtle)'
          }}
        >
          <Search size={18} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Görev, kitap, hesap, fatura, kasa ara veya komut yaz... (ör. su ekle)"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text-main)',
              fontSize: '15px',
              fontWeight: 600
            }}
          />
          {isSearching && (
            <span style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 700, flexShrink: 0 }}>
              Aranıyor...
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Sonuç Listesi */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {groupedSections.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              {isSearching
                ? 'Kayıtlar taranıyor...'
                : `"${query}" için eşleşen kayıt veya komut bulunamadı.`}
            </div>
          ) : (
            groupedSections.map(section => (
              <div key={section.title} style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    padding: '4px 10px 6px',
                    letterSpacing: '0.02em'
                  }}
                >
                  {section.title}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {section.items.map(item => {
                    const isSelected = item.globalIdx === selectedIndex;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onMouseEnter={() => setSelectedIndex(item.globalIdx)}
                        onClick={item.onSelect}
                        style={{
                          width: '100%',
                          minHeight: '46px',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          border: isSelected ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid transparent',
                          background: isSelected ? 'var(--emerald-bg)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.1s ease'
                        }}
                      >
                        <span style={{ fontSize: '18px', width: '28px', textAlign: 'center', flexShrink: 0 }}>
                          {item.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {item.label}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {item.subtitle}
                          </div>
                        </div>
                        <ArrowRight size={14} style={{ color: isSelected ? 'var(--emerald)' : 'var(--text-muted)', opacity: isSelected ? 1 : 0.4, flexShrink: 0 }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Alt Kısayol İpucu Barı */}
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)',
            gap: '8px',
            flexWrap: 'wrap'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Sparkles size={12} style={{ color: 'var(--emerald)' }} />
            Türkçe karakter duyarsız arama (ör. &quot;kitap&quot;, &quot;garanti&quot;, &quot;su ekle&quot;)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Command size={11} /> ↑↓ Seç
            </span>
            <span>↵ Aç</span>
            <span>Esc Kapat</span>
          </span>
        </div>
      </div>
    </div>
  );
}
