'use client';
import { useState, useRef } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Check, 
  Trash2, 
  Edit3, 
  CreditCard, 
  Camera, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw,
  Sparkles,
  ShoppingBag,
  TrendingDown
} from 'lucide-react';

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
  onToast?: (msg: string) => void;
}

const CAT_ICONS: Record<string, string> = {
  Manav: '🥦', 
  Kasap: '🥩', 
  Fırın: '🥖', 
  Market: '🛒',
  Aktariye: '🌿', 
  Eczane: '💊', 
  Diğer: '📦'
};

const formatTRY = (v: number) => 
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);

function parseQuickItem(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let name = trimmed;
  let quantity = '1';
  let unit = 'adet';
  let category = 'Market';

  // Pattern matching: "Süt 2 litre", "Elma 1.5 kg", "Ekmek 3 adet", "Peynir 500 gr"
  const match = trimmed.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*(kg|kilo|gram|gr|g|litre|lt|l|adet|paket|kutu|demet|tane)?$/i);
  if (match) {
    name = match[1].trim();
    quantity = match[2].replace(',', '.');
    if (match[3]) {
      const u = match[3].toLowerCase();
      if (['kg', 'kilo'].includes(u)) unit = 'kg';
      else if (['gram', 'gr', 'g'].includes(u)) unit = 'gram';
      else if (['litre', 'lt', 'l'].includes(u)) unit = 'litre';
      else if (['paket'].includes(u)) unit = 'paket';
      else if (['kutu'].includes(u)) unit = 'kutu';
      else if (['demet'].includes(u)) unit = 'demet';
      else unit = 'adet';
    }
  }

  // Akıllı reyon çıkarımı
  const nameLower = name.toLowerCase();
  const MANAV_WORDS = ['domates', 'salatalık', 'biber', 'patates', 'soğan', 'marul', 'havuç', 'elma', 'muz', 'portakal', 'mandalina', 'limon', 'çilek', 'üzüm', 'maydanoz', 'ıspanak', 'avokado'];
  const FIRIN_WORDS = ['ekmek', 'simit', 'poğaça', 'börek', 'pide', 'lavaş', 'baget'];
  const KASAP_WORDS = ['kıyma', 'kuşbaşı', 'antrikot', 'bonfile', 'tavuk', 'pirzola', 'köfte', 'sucuk', 'sosis', 'balık', 'somon'];
  const AKTARIYE_WORDS = ['ceviz', 'fındık', 'badem', 'fıstık', 'kaju', 'yulaf', 'chia', 'kinoa', 'baharat', 'kekik', 'nane', 'ıhlamur'];
  const ECZANE_WORDS = ['vitamin', 'aspirin', 'parol', 'şurup', 'krem', 'bandaj', 'takviye'];

  if (MANAV_WORDS.some(w => nameLower.includes(w))) category = 'Manav';
  else if (FIRIN_WORDS.some(w => nameLower.includes(w))) category = 'Fırın';
  else if (KASAP_WORDS.some(w => nameLower.includes(w))) category = 'Kasap';
  else if (AKTARIYE_WORDS.some(w => nameLower.includes(w))) category = 'Aktariye';
  else if (ECZANE_WORDS.some(w => nameLower.includes(w))) category = 'Eczane';

  return { name, quantity, unit, category };
}

export default function ShoppingListCard({
  items,
  summary,
  categoryTotals,
  onOpenAddItem,
  onOpenCheckout,
  onRefresh,
  onToast
}: Props) {
  const [quickInput, setQuickInput] = useState('');
  const [addingQuick, setAddingQuick] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [presetFilter, setPresetFilter] = useState<'all' | 'diet' | 'grocery' | 'produce'>('all');
  const [scanningAI, setScanningAI] = useState(false);
  const [addingPreset, setAddingPreset] = useState<string | null>(null);
  const [isCartExpanded, setIsCartExpanded] = useState(true);

  const quickInputRef = useRef<HTMLInputElement>(null);

  const handleToggle = async (id: string) => {
    try {
      await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id })
      });
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
    } catch {
      //
    }
  };

  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickInput.trim()) return;

    const parsed = parseQuickItem(quickInput);
    if (!parsed) return;

    setAddingQuick(true);
    try {
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          name: parsed.name,
          quantity: parsed.quantity,
          unit: parsed.unit,
          category: parsed.category,
          estimated_price: 0
        })
      });
      const json = await res.json();
      if (json.success) {
        setQuickInput('');
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        if (onRefresh) onRefresh();
        if (onToast) onToast(`🛒 "${parsed.name}" listeye eklendi!`);
      }
    } catch {
      if (onToast) onToast('Ekleme hatası oluştu.');
    } finally {
      setAddingQuick(false);
      if (quickInputRef.current) quickInputRef.current.focus();
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      });
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
      if (onToast) onToast('Ürün listeden silindi.');
    } catch {
      //
    }
  };

  const handleClearChecked = async () => {
    if (!confirm('Sepetteki alınan tüm ürünleri listeden temizlemek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_checked' })
      });
      const j = await res.json();
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
      if (onToast) onToast(`🧹 ${j.deleted || 0} adet ürün temizlendi.`);
    } catch {
      //
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Tüm alışveriş listenizi sıfırlamak istediğinize emin misiniz?')) return;
    try {
      await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all' })
      });
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
      if (onToast) onToast('Tüm alışveriş listesi sıfırlandı.');
    } catch {
      //
    }
  };

  const handleAddPreset = async (preset: 'diet' | 'grocery' | 'produce') => {
    setAddingPreset(preset);
    try {
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_preset', preset })
      });
      const j = await res.json();
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
      if (onToast && j.message) onToast(j.message);
    } catch {
      //
    } finally {
      setAddingPreset(null);
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
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
      if (onToast && json.message) onToast(json.message);
    } catch {
      if (onToast) onToast('Fiş AI tarama hatası.');
    } finally {
      setScanningAI(false);
    }
  };

  // Filtreleme
  const DIET_KEYWORDS = ['avokado', 'yulaf', 'yumurta', 'badem', 'chia', 'diyet', 'protein', 'kinoa', 'ceviz', 'kefir', 'somon'];
  const GROCERY_KEYWORDS = ['ekmek', 'peynir', 'zeytin', 'tuvalet', 'deterjan', 'süt', 'makarna', 'un', 'şeker', 'pirinç', 'bulgur', 'bakliyat', 'yağ', 'çay', 'kahve', 'salça', 'yoğurt', 'kaşar', 'tuz', 'sabun', 'şampuan', 'peçete'];
  const PRODUCE_KEYWORDS = ['marul', 'domates', 'salatalık', 'zeytinyağı', 'limon', 'elma', 'muz', 'patates', 'soğan', 'biber', 'havuç', 'yeşillik', 'portakal', 'mandalina', 'maydanoz', 'ıspanak'];

  const filteredItems = items.filter(item => {
    const nameLower = item.name.toLowerCase();
    const matchesSearch = nameLower.includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;

    let matchesPreset = true;
    if (presetFilter === 'diet') {
      matchesPreset = DIET_KEYWORDS.some(k => nameLower.includes(k)) || item.source === 'diet_plan';
    } else if (presetFilter === 'grocery') {
      matchesPreset = GROCERY_KEYWORDS.some(k => nameLower.includes(k)) || (item.category === 'Fırın');
    } else if (presetFilter === 'produce') {
      matchesPreset = PRODUCE_KEYWORDS.some(k => nameLower.includes(k)) || (item.category === 'Manav');
    }

    return matchesSearch && matchesCat && matchesPreset;
  });

  // Ayrıştırma: Alınacaklar vs Sepettekiler
  const uncheckedItems = filteredItems.filter(i => i.is_checked === 0);
  const checkedItems = filteredItems.filter(i => i.is_checked === 1);

  // Alınacakları Reyonlara (Kategorilere) göre grupla
  const uncheckedByAisle: Record<string, ShoppingItem[]> = {};
  for (const item of uncheckedItems) {
    const cat = item.category || 'Market';
    if (!uncheckedByAisle[cat]) uncheckedByAisle[cat] = [];
    uncheckedByAisle[cat].push(item);
  }

  const donePercent = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
  const checkedEstimated = summary.checkedEstimated || (summary.totalEstimated - summary.remainingEstimated);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* 2 Sütunlu Masaüstü / Tek Sütunlu Mobil Split Izgara */}
      <div className="shopping-split-grid">
        {/* SOL SÜTUN: ALINACAKLAR & REYONLAR */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          {/* Üst Kart Başlık Barı */}
          <div className="card-header-block" style={{ marginBottom: 0, gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div className="icon-badge icon-badge-emerald" style={{ flexShrink: 0 }}>
                <ShoppingCart size={18} strokeWidth={1.75} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
                  Alışveriş & Kiler
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Akıllı Market Listesi
                </h2>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <label 
                className="btn-subtle" 
                style={{ 
                  cursor: 'pointer', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  fontSize: '11px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 800,
                  whiteSpace: 'nowrap'
                }}
              >
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScanReceipt} disabled={scanningAI} />
                <Camera size={13} />
                <span>{scanningAI ? 'Okunuyor...' : 'Fiş Tara (AI)'}</span>
              </label>

              {onOpenAddItem && (
                <button 
                  type="button"
                  onClick={() => onOpenAddItem()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 800,
                    background: 'var(--blue)',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Plus size={14} />
                  <span>Detaylı Ekle</span>
                </button>
              )}
            </div>
          </div>

          {/* Hızlı Seri Ürün Ekleme Girişi (Inline Quick-Add with Enter) */}
          <form 
            onSubmit={handleQuickAdd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '4px 6px 4px 12px',
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box'
            }}
          >
            <span style={{ color: 'var(--emerald)', fontSize: '16px', fontWeight: 800, flexShrink: 0 }}>＋</span>
            <input
              ref={quickInputRef}
              type="text"
              placeholder="Hızlı ürün ekle... (Örn: Süt 2L, Domates 1kg) [Enter]"
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                padding: '6px 0',
                width: '100%'
              }}
            />
            <button
              type="submit"
              disabled={addingQuick || !quickInput.trim()}
              style={{
                fontSize: '12px',
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 800,
                flexShrink: 0,
                background: 'var(--blue)',
                color: '#FFFFFF',
                border: 'none',
                cursor: 'pointer',
                margin: 0,
                width: 'auto'
              }}
            >
              {addingQuick ? '...' : 'Ekle'}
            </button>
          </form>

          {/* Hazır Paket Hapları & Filtreler */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', width: '100%', minWidth: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>⚡ Paketler:</span>
            
            <button
              type="button"
              onClick={() => setPresetFilter('all')}
              style={{
                fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                border: presetFilter === 'all' ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: presetFilter === 'all' ? 'var(--blue-bg)' : 'var(--surface-subtle)',
                color: presetFilter === 'all' ? 'var(--blue)' : 'var(--text-muted)'
              }}
            >
              Tümü
            </button>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <button
                type="button"
                onClick={() => setPresetFilter('diet')}
                style={{
                  fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '6px 0 0 6px', cursor: 'pointer',
                  border: presetFilter === 'diet' ? '1px solid var(--emerald)' : '1px solid var(--border)',
                  background: presetFilter === 'diet' ? 'var(--emerald-bg)' : 'var(--surface-subtle)',
                  color: presetFilter === 'diet' ? 'var(--emerald)' : 'var(--text-muted)'
                }}
              >
                🥑 Diyet
              </button>
              <button
                type="button"
                title="Diyet Paketini Listeye Ekle"
                disabled={Boolean(addingPreset)}
                onClick={() => handleAddPreset('diet')}
                style={{
                  fontSize: '10px', fontWeight: 800, padding: '4px 6px', borderRadius: '0 6px 6px 0', cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--emerald)'
                }}
              >
                +
              </button>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <button
                type="button"
                onClick={() => setPresetFilter('grocery')}
                style={{
                  fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '6px 0 0 6px', cursor: 'pointer',
                  border: presetFilter === 'grocery' ? '1px solid var(--amber)' : '1px solid var(--border)',
                  background: presetFilter === 'grocery' ? 'var(--amber-bg)' : 'var(--surface-subtle)',
                  color: presetFilter === 'grocery' ? 'var(--amber)' : 'var(--text-muted)'
                }}
              >
                🍞 Temel Gıda
              </button>
              <button
                type="button"
                title="Temel Gıda Paketini Listeye Ekle"
                disabled={Boolean(addingPreset)}
                onClick={() => handleAddPreset('grocery')}
                style={{
                  fontSize: '10px', fontWeight: 800, padding: '4px 6px', borderRadius: '0 6px 6px 0', cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--amber)'
                }}
              >
                +
              </button>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <button
                type="button"
                onClick={() => setPresetFilter('produce')}
                style={{
                  fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '6px 0 0 6px', cursor: 'pointer',
                  border: presetFilter === 'produce' ? '1px solid var(--indigo)' : '1px solid var(--border)',
                  background: presetFilter === 'produce' ? 'var(--indigo-bg)' : 'var(--surface-subtle)',
                  color: presetFilter === 'produce' ? 'var(--indigo)' : 'var(--text-muted)'
                }}
              >
                🥗 Manav
              </button>
              <button
                type="button"
                title="Manav Paketini Listeye Ekle"
                disabled={Boolean(addingPreset)}
                onClick={() => handleAddPreset('produce')}
                style={{
                  fontSize: '10px', fontWeight: 800, padding: '4px 6px', borderRadius: '0 6px 6px 0', cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--indigo)'
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Arama & Kategori Filtreleme Çubuğu */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', minWidth: 0 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <input
                type="text"
                placeholder="Listede ara..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 30px',
                  fontSize: '12px',
                  background: 'var(--surface)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxSizing: 'border-box'
                }}
              />
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{
                padding: '8px 10px',
                fontSize: '12px',
                fontWeight: 700,
                background: 'var(--surface-subtle)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                flexShrink: 0
              }}
            >
              <option value="all">Tüm Reyonlar</option>
              <option value="Manav">🥦 Manav</option>
              <option value="Kasap">🥩 Kasap</option>
              <option value="Fırın">🥖 Fırın</option>
              <option value="Market">🛒 Market</option>
              <option value="Aktariye">🌿 Aktariye</option>
              <option value="Eczane">💊 Eczane</option>
              <option value="Diğer">📦 Diğer</option>
            </select>
          </div>

          {/* Reyon Bazlı Alınacaklar Listesi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px', width: '100%', minWidth: 0 }}>
            {Object.keys(uncheckedByAisle).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                <div style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>Alınacak Ürün Kalmadı!</div>
                Tüm ürünleri sepete attınız veya listeniz boş. Yukarıdan hızlıca yeni ürün ekleyebilirsiniz.
              </div>
            ) : (
              Object.entries(uncheckedByAisle).map(([aisle, aisleItems]) => {
                const aisleIcon = CAT_ICONS[aisle] || '📦';
                const aisleTotal = aisleItems.reduce((sum, item) => sum + (item.estimated_price || 0), 0);

                return (
                  <div key={aisle} style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', minWidth: 0 }}>
                    {/* Reyon Başlığı */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{aisleIcon}</span>
                        <span>{aisle} Reyonu</span>
                        <span style={{ fontSize: '10px', background: 'var(--surface-subtle)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
                          {aisleItems.length}
                        </span>
                      </div>
                      {aisleTotal > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                          {formatTRY(aisleTotal)}
                        </span>
                      )}
                    </div>

                    {/* Reyondaki Ürünler (Genişletilmiş ürün başlık alanı + kompakt aksiyonlar) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', minWidth: 0 }}>
                      {aisleItems.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleToggle(item.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.15s ease',
                            boxShadow: 'var(--shadow-sm)',
                            gap: '8px',
                            width: '100%',
                            minWidth: 0,
                            boxSizing: 'border-box'
                          }}
                        >
                          {/* Sol: Onay Butonu & Geniş Ürün Bilgisi */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              <div
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  border: '2px solid var(--border)',
                                  background: 'var(--surface)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                              />
                            </div>

                            {/* Ürün Adı & Miktar (Artık 180px+ nefes alanına sahip) */}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', display: 'flex', gap: '4px', fontWeight: 600 }}>
                                <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{item.quantity} {item.unit}</span>
                                {item.source === 'diet_plan' && <span style={{ color: 'var(--emerald)', fontWeight: 800 }}>• Diyet</span>}
                              </div>
                            </div>
                          </div>

                          {/* Sağ: Fiyat & Kompakt Eylemler (Maksimum 60px alan kaplar) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            {item.estimated_price > 0 && (
                              <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 900, color: 'var(--text-main)', whiteSpace: 'nowrap', marginRight: '4px' }}>
                                {formatTRY(item.estimated_price)}
                              </span>
                            )}

                            {onOpenAddItem && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenAddItem(item);
                                }}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0
                                }}
                                title="Düzenle"
                              >
                                <Edit3 size={13} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => handleDelete(item.id, e)}
                              style={{
                                width: '28px',
                                height: '28px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0
                              }}
                              title="Sil"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SAĞ SÜTUN: BÜTÇE & SEPETTEKİLER (Masaüstünde Sağ Panel, Mobilde Alt Panel) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          {/* Bütçe & Sepet İlerleme Kartı */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShoppingBag size={15} style={{ color: 'var(--emerald)' }} />
                <span>Alışveriş Bütçe Özeti</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--emerald)', background: 'var(--emerald-bg)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                %{donePercent} Tamamlandı
              </span>
            </div>

            {/* İlerleme Çubuğu */}
            <div className="budget-bar-track" style={{ height: '8px', width: '100%' }}>
              <div 
                className="budget-bar-fill" 
                style={{ 
                  width: `${donePercent}%`, 
                  backgroundColor: donePercent === 100 ? '#10B981' : '#3B82F6' 
                }} 
              />
            </div>

            {/* 3'lü Tutar Bento Kutuları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center', width: '100%', minWidth: 0 }}>
              <div style={{ background: 'var(--surface-subtle)', padding: '8px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', minWidth: 0 }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 800 }}>TOPLAM</div>
                <div className="tabular-nums" style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatTRY(summary.totalEstimated)}
                </div>
              </div>

              <div style={{ background: 'var(--emerald-bg)', padding: '8px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.3)', minWidth: 0 }}>
                <div style={{ fontSize: '9px', color: 'var(--emerald)', fontWeight: 800 }}>SEPETTE</div>
                <div className="tabular-nums" style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatTRY(checkedEstimated)}
                </div>
              </div>

              <div style={{ background: 'var(--amber-bg)', padding: '8px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.3)', minWidth: 0 }}>
                <div style={{ fontSize: '9px', color: 'var(--amber)', fontWeight: 800 }}>KALAN</div>
                <div className="tabular-nums" style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatTRY(summary.remainingEstimated)}
                </div>
              </div>
            </div>

            {/* Kategori Bazlı Dağılım */}
            {categoryTotals && Object.keys(categoryTotals).length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                {Object.entries(categoryTotals).map(([cat, total]) => (
                  <span key={cat} style={{ fontSize: '10px', fontWeight: 700, background: 'var(--surface-subtle)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                    {CAT_ICONS[cat] || '📦'} {cat}: {formatTRY(total)}
                  </span>
                ))}
              </div>
            )}

            {/* Kasada Öde / Bütçeye Aktar Masaüstü Butonu */}
            <button
              type="button"
              disabled={summary.done === 0}
              onClick={() => onOpenCheckout && onOpenCheckout()}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 900,
                background: summary.done > 0 ? '#166534' : 'var(--surface-subtle)',
                color: summary.done > 0 ? '#FFFFFF' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: summary.done > 0 ? 'pointer' : 'not-allowed',
                boxShadow: summary.done > 0 ? '0 2px 8px rgba(22, 101, 52, 0.3)' : 'none',
                minHeight: '44px',
                margin: 0
              }}
            >
              <CreditCard size={16} />
              <span>
                {summary.done > 0 
                  ? `Kasada Öde & Cüzdana İşle (${formatTRY(checkedEstimated)})` 
                  : 'Sepete Ürün Ekleyin'}
              </span>
            </button>
          </div>

          {/* Sepettekiler (Alınanlar) Kartı */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <div 
              onClick={() => setIsCartExpanded(prev => !prev)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛒</span>
                <span>Sepettekiler ({checkedItems.length} Ürün)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--emerald)' }}>
                  {formatTRY(checkedEstimated)}
                </span>
                {isCartExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {isCartExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
                {checkedItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    Henüz sepete ürün atmadınız. Sol listeden aldığınız ürünleri işaretleyin.
                  </div>
                ) : (
                  checkedItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleToggle(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'var(--surface-subtle)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        gap: '8px'
                      }}
                      title="Sepetten geri çıkarmak için tıklayın"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'var(--emerald)',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Check size={14} strokeWidth={3} />
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {item.quantity} {item.unit} • {item.category}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {item.estimated_price > 0 && (
                          <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--emerald)' }}>
                            {formatTRY(item.estimated_price)}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleDelete(item.id, e)}
                          style={{
                            width: '26px',
                            height: '26px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Sil"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Sepet Temizleme Eylemleri */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              {summary.done > 0 ? (
                <button
                  type="button"
                  onClick={handleClearChecked}
                  style={{ background: 'none', border: 'none', color: 'var(--rose)', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                >
                  🗑️ Alınanları Temizle
                </button>
              ) : <div />}

              {summary.total > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  🧹 Tüm Listeyi Sıfırla
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 📱 SADECE MOBİLDE GÖRÜNEN YAPIŞKAN KASA & SEPET DOCK BAR (.shopping-mobile-dock) */}
      {summary.done > 0 && (
        <div
          className="shopping-mobile-dock"
          style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--emerald)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 14px',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
            gap: '12px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--emerald-bg)',
                color: 'var(--emerald)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <ShoppingCart size={18} />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                🛒 {summary.done} ÜRÜN SEPETTE
              </div>
              <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatTRY(checkedEstimated)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenCheckout && onOpenCheckout()}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 900,
              background: '#166534',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              minHeight: '44px',
              whiteSpace: 'nowrap',
              margin: 0,
              width: 'auto'
            }}
          >
            <CreditCard size={15} />
            <span>Kasada Öde</span>
          </button>
        </div>
      )}
    </div>
  );
}
