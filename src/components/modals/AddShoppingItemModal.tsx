'use client';
import { useState, useEffect } from 'react';
import { ShoppingBag, X, Tag, DollarSign, Layers } from 'lucide-react';

interface ShoppingItem {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  estimated_price?: number;
}

interface AddShoppingItemModalProps {
  isOpen: boolean;
  item?: ShoppingItem | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddShoppingItemModal({ isOpen, item, onClose, onSuccess }: AddShoppingItemModalProps) {
  const isEditing = Boolean(item?.id);
  const [name, setName] = useState(item?.name || '');
  const [quantity, setQuantity] = useState(item?.quantity || '1');
  const [unit, setUnit] = useState(item?.unit || 'adet');
  const [category, setCategory] = useState(item?.category || 'Market');
  const [estimatedPrice, setEstimatedPrice] = useState(String(item?.estimated_price || 0));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setName(item.name || '');
        setQuantity(item.quantity || '1');
        setUnit(item.unit || 'adet');
        setCategory(item.category || 'Market');
        setEstimatedPrice(String(item.estimated_price ?? 0));
      } else {
        setName('');
        setQuantity('1');
        setUnit('adet');
        setCategory('Market');
        setEstimatedPrice('0');
      }
    }
  }, [isOpen, item]);

  // ESC tuşuyla kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);

    try {
      const action = isEditing ? 'update' : 'add';
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          id: item?.id,
          name: name.trim(),
          quantity: quantity.trim() || '1',
          unit,
          category,
          estimated_price: Number(estimatedPrice) || 0
        })
      });

      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        onSuccess(isEditing ? '🛒 Ürün güncellendi!' : '🛒 Ürün listeye eklendi!');
        onClose();
      } else {
        alert(json.error || 'İşlem başarısız.');
      }
    } catch {
      alert('Kayıt hatası.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div 
        className="bottom-sheet" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div className="sheet-handle" />

        {/* Modal Başlık Barı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-emerald">
              <ShoppingBag size={18} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {isEditing ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Miktar, reyon ve tahmini fiyat belirleyin
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="modal-close-btn"
            aria-label="Kapat"
            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Ürün Adı */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>ÜRÜN ADI *</label>
            <input
              type="text"
              placeholder="Ör. Süt, Avokado, Antrikot, Domates"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ 
                width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 700, 
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)',
                minHeight: '44px'
              }}
            />
          </div>

          {/* Miktar & Birim */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>MİKTAR *</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ör. 2, 500, 1.5"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                required
                className="tabular-nums"
                style={{ 
                  width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 700,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                  marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)',
                  minHeight: '44px'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>BİRİM *</label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                style={{ 
                  width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                  marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)',
                  minHeight: '44px'
                }}
              >
                <option value="adet">adet</option>
                <option value="kg">kg</option>
                <option value="gram">gram</option>
                <option value="litre">litre</option>
                <option value="paket">paket</option>
                <option value="kutu">kutu</option>
                <option value="demet">demet</option>
              </select>
            </div>
          </div>

          {/* Kategori / Reyon & Tahmini Fiyat */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>REYON / KATEGORİ *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{ 
                  width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                  marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)',
                  minHeight: '44px'
                }}
              >
                <option value="Market">🛒 Market</option>
                <option value="Manav">🥦 Manav</option>
                <option value="Fırın">🥖 Fırın</option>
                <option value="Kasap">🥩 Kasap</option>
                <option value="Aktariye">🌿 Aktariye</option>
                <option value="Eczane">💊 Eczane</option>
                <option value="Diğer">📦 Diğer</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>TAHMİNİ FİYAT (₺)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                placeholder="Ör. 65"
                value={estimatedPrice}
                onChange={e => setEstimatedPrice(e.target.value)}
                className="tabular-nums"
                style={{ 
                  width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 700,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                  marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)',
                  minHeight: '44px'
                }}
              />
            </div>
          </div>

          {/* Kaydet Butonu */}
          <div className="modal-sticky-footer" style={{ marginTop: '8px' }}>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={submitting} 
              style={{ 
                width: '100%', 
                padding: '13px', 
                fontSize: '14px', 
                fontWeight: 900, 
                minHeight: '46px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <ShoppingBag size={17} />
              <span>{submitting ? 'Kaydediliyor...' : isEditing ? 'Değişiklikleri Kaydet' : 'Listeye Ekle'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
