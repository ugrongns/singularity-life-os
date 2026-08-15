'use client';
import { useState } from 'react';

interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  is_checked: number;
  source?: string;
  estimated_price: number;
}

interface Summary {
  total: number;
  remaining: number;
  done: number;
  totalEstimated: number;
  remainingEstimated: number;
  checkedEstimated?: number;
}

interface Props {
  items: ShoppingItem[];
  summary: Summary;
  byCategory: Record<string, ShoppingItem[]>;
  categoryTotals?: Record<string, number>;
  onOpenAddItem?: (item?: ShoppingItem) => void;
  onOpenCheckout?: () => void;
  onRefresh?: () => void;
}

const CAT_ICONS: Record<string, string> = {
  Market: '🛒', Manav: '🥦', Fırın: '🥖', Kasap: '🥩',
  Aktariye: '🌿', Eczane: '💊', Diğer: '📦'
};

const formatTRY = (v: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);

export default function ShoppingListCard({
  items,
  summary,
  categoryTotals,
  onOpenAddItem,
  onOpenCheckout,
  onRefresh
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [filterView, setFilterView] = useState<'all' | 'unchecked' | 'checked'>('unchecked');
  const [scanningAI, setScanningAI] = useState(false);
  const [presetFilter, setPresetFilter] = useState<'all' | 'diet' | 'grocery' | 'produce'>('all');

  const handleToggle = async (id: string) => {
    try {
      await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id })
      });
      if (onRefresh) onRefresh();
      else window.location.reload();
    } catch {
      alert('İşlem hatası.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      });
      if (onRefresh) onRefresh();
      else window.location.reload();
    } catch {
      alert('Silme hatası.');
    }
  };

  const handleClearChecked = async () => {
    if (!confirm('Alınan tüm ürünleri listeden temizlemek istediğinize emin misiniz?')) return;
    try {
      await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_checked' })
      });
      if (onRefresh) onRefresh();
      else window.location.reload();
    } catch {
      alert('Temizleme hatası.');
    }
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanningAI(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/shopping-list/scan-receipt', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Fiş tarandı!');
        if (onRefresh) onRefresh();
        else window.location.reload();
      } else {
        alert(json.error || 'Fiş okuma başarısız.');
      }
    } catch {
      alert('Fiş AI tarama hatası.');
    } finally {
      setScanningAI(false);
    }
  };

  // Filtreleme Mantığı (Paket Filtresi + Arama + Kategori)
  const DIET_KEYWORDS = ['avokado', 'yulaf', 'yumurta', 'badem', 'chia', 'diyet'];
  const GROCERY_KEYWORDS = ['ekmek', 'peynir', 'zeytin', 'tuvalet', 'deterjan', 'süt', 'makarna', 'un', 'şeker'];
  const PRODUCE_KEYWORDS = ['marul', 'domates', 'salatalık', 'zeytinyağı', 'limon', 'elma', 'muz', 'patates', 'soğan'];

  const filteredItems = items.filter(item => {
    const nameLower = item.name.toLowerCase();
    const matchesSearch = nameLower.includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;

    let matchesPreset = true;
    if (presetFilter === 'diet') {
      matchesPreset = DIET_KEYWORDS.some(k => nameLower.includes(k)) || item.source === 'diet_plan';
    } else if (presetFilter === 'grocery') {
      matchesPreset = GROCERY_KEYWORDS.some(k => nameLower.includes(k)) || item.category === 'Market' || item.category === 'Fırın';
    } else if (presetFilter === 'produce') {
      matchesPreset = PRODUCE_KEYWORDS.some(k => nameLower.includes(k)) || item.category === 'Manav';
    }

    if (filterView === 'unchecked') return matchesSearch && matchesCat && matchesPreset && item.is_checked === 0;
    if (filterView === 'checked') return matchesSearch && matchesCat && matchesPreset && item.is_checked === 1;
    return matchesSearch && matchesCat && matchesPreset;
  });

  const donePercent = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
  const checkedEstimated = summary.checkedEstimated || (summary.totalEstimated - summary.remainingEstimated);

  const handleClearAll = async () => {
    if (!confirm('Tüm alışveriş listenizi sıfırlamak/temizlemek istediğinize emin misiniz?')) return;
    try {
      await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all' })
      });
      if (onRefresh) onRefresh();
      else window.location.reload();
    } catch {
      alert('Sıfırlama hatası.');
    }
  };

  return (
    <div className="card">
      {/* Üst Kart Başlık */}
      <div className="card-title-row">
        <div className="card-title">
          <span>🛒</span>
          <span>Akıllı Market Listesi</span>
        </div>
      </div>

      <div className="card-action-bar">
        <label className="btn-subtle" style={{ cursor: 'pointer' }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScanReceipt} disabled={scanningAI} />
          <span>📸 {scanningAI ? 'Fiş Okunuyor...' : 'Fiş Tara (AI)'}</span>
        </label>

        {onOpenAddItem && (
          <button className="btn-primary" onClick={() => onOpenAddItem()}>
            + Ürün Ekle
          </button>
        )}
      </div>

      {/* İlerleme & Bütçe Özet Barı */}
      <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
            Tamamlanan: {summary.done} / {summary.total} Ürün (%{donePercent})
          </div>
          <div style={{ display: 'flex', gap: '10px', fontSize: '12px', fontWeight: 800 }}>
            <span style={{ color: 'var(--amber)' }}>Kalan: {formatTRY(summary.remainingEstimated)}</span>
            <span style={{ color: 'var(--emerald)' }}>Alınan: {formatTRY(checkedEstimated)}</span>
          </div>
        </div>

        <div className="progress-bar" style={{ height: '8px' }}>
          <div className="progress-fill emerald" style={{ width: `${donePercent}%` }} />
        </div>

        {/* Kategori Bazlı Fiyat Dağılımı Rozetleri */}
        {categoryTotals && Object.keys(categoryTotals).length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
            {Object.entries(categoryTotals).map(([cat, total]) => (
              <span key={cat} style={{ fontSize: '10px', fontWeight: 700, background: 'white', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                {CAT_ICONS[cat] || '📦'} {cat}: {formatTRY(total)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Paket Filtreleme Barı (Sadece seçilen listeyi açar) */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', background: '#F8FAFC', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>⚡ Paket Filtrele:</span>
        
        <button
          type="button"
          onClick={() => setPresetFilter('all')}
          style={{
            fontSize: '11px', fontWeight: 800, padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
            border: presetFilter === 'all' ? '1px solid #4F46E5' : '1px solid #CBD5E1',
            background: presetFilter === 'all' ? '#4F46E5' : 'white',
            color: presetFilter === 'all' ? 'white' : 'var(--text-main)'
          }}
        >
          ✨ Tümü
        </button>

        <button
          type="button"
          onClick={() => setPresetFilter('diet')}
          style={{
            fontSize: '11px', fontWeight: 800, padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
            border: presetFilter === 'diet' ? '1px solid #059669' : '1px solid #CBD5E1',
            background: presetFilter === 'diet' ? '#059669' : 'white',
            color: presetFilter === 'diet' ? 'white' : 'var(--text-main)'
          }}
        >
          🥑 Diyet Paketi
        </button>

        <button
          type="button"
          onClick={() => setPresetFilter('grocery')}
          style={{
            fontSize: '11px', fontWeight: 800, padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
            border: presetFilter === 'grocery' ? '1px solid #D97706' : '1px solid #CBD5E1',
            background: presetFilter === 'grocery' ? '#D97706' : 'white',
            color: presetFilter === 'grocery' ? 'white' : 'var(--text-main)'
          }}
        >
          🍞 Temel Gıda Paketi
        </button>

        <button
          type="button"
          onClick={() => setPresetFilter('produce')}
          style={{
            fontSize: '11px', fontWeight: 800, padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
            border: presetFilter === 'produce' ? '1px solid #2563EB' : '1px solid #CBD5E1',
            background: presetFilter === 'produce' ? '#2563EB' : 'white',
            color: presetFilter === 'produce' ? 'white' : 'var(--text-main)'
          }}
        >
          🥗 Manav Paketi
        </button>
      </div>

      {/* Arama & Kategori & Durum Filtreleme Çubuğu */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Ürün ara..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '160px', padding: '8px 12px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
        />

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setFilterView('unchecked')}
            style={{
              padding: '6px 10px', fontSize: '11px', fontWeight: 800, borderRadius: '6px',
              border: filterView === 'unchecked' ? '1px solid #4F46E5' : '1px solid var(--border)',
              background: filterView === 'unchecked' ? '#EEF2FF' : 'white',
              color: filterView === 'unchecked' ? '#4F46E5' : 'var(--text-main)', cursor: 'pointer'
            }}
          >
            Alınacaklar ({summary.remaining})
          </button>
          <button
            onClick={() => setFilterView('all')}
            style={{
              padding: '6px 10px', fontSize: '11px', fontWeight: 800, borderRadius: '6px',
              border: filterView === 'all' ? '1px solid #4F46E5' : '1px solid var(--border)',
              background: filterView === 'all' ? '#EEF2FF' : 'white',
              color: filterView === 'all' ? '#4F46E5' : 'var(--text-main)', cursor: 'pointer'
            }}
          >
            Tümü ({summary.total})
          </button>
        </div>
      </div>

      {/* Ürün Listesi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Listede ürün bulunmuyor.
          </div>
        ) : (
          filteredItems.map(item => {
            const icon = CAT_ICONS[item.category] || '📦';

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: item.is_checked ? '#F0FDF4' : 'var(--surface-subtle)',
                  border: `1px solid ${item.is_checked ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleToggle(item.id)}
                    style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      border: item.is_checked ? 'none' : '2px solid var(--border)',
                      background: item.is_checked ? 'var(--emerald)' : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0
                    }}
                  >
                    {item.is_checked ? <span style={{ color: 'white', fontSize: '12px', fontWeight: 800 }}>✓</span> : null}
                  </button>

                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: item.is_checked ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: item.is_checked ? 'line-through' : 'none' }}>
                      {icon} {item.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '6px', fontWeight: 600 }}>
                      <span>{item.quantity} {item.unit}</span>
                      <span>•</span>
                      <span>🏷️ {item.category}</span>
                      {item.source === 'diet_plan' && <span style={{ color: '#059669', fontWeight: 700 }}>• Diyet Menüsü</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {item.estimated_price > 0 && (
                    <span style={{ fontSize: '13px', fontWeight: 800, color: item.is_checked ? 'var(--emerald)' : 'var(--text-main)' }}>
                      {formatTRY(item.estimated_price)}
                    </span>
                  )}
                  {onOpenAddItem && (
                    <button
                      type="button"
                      onClick={() => onOpenAddItem(item)}
                      style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', opacity: 0.6 }}
                      title="Düzenle"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', opacity: 0.6 }}
                    title="Sil"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Alt Aksiyon Butonları (Alışverişi Bitir & Cüzdana İşle) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '8px' }}>
        {summary.done > 0 ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => onOpenCheckout && onOpenCheckout()}
            style={{ fontSize: '12px', padding: '8px 16px', fontWeight: 800, background: '#166534' }}
          >
            💳 Alışverişi Bitir & Cüzdana Harcama Olarak İşle ({formatTRY(checkedEstimated)})
          </button>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ürün aldıkça cüzdanınıza harcama aktarabilirsiniz</span>
        )}

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {summary.done > 0 && (
            <button
              type="button"
              onClick={handleClearChecked}
              style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              🗑️ Alınanları Temizle
            </button>
          )}

          {summary.total > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              🧹 Tüm Listeyi Sıfırla
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
