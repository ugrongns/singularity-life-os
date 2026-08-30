'use client';
import { useState } from 'react';

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const action = isEditing ? 'update' : 'add';
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          id: item?.id,
          name,
          quantity,
          unit,
          category,
          estimated_price: Number(estimatedPrice) || 0
        })
      });

      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        onSuccess(isEditing ? '🛒 Ürün güncellendi!' : '🛒 Ürün sepete eklendi!');
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
            {isEditing ? '✏️ Ürünü Düzenle' : '🛒 Market Listesine Ürün Ekle'}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ÜRÜN ADI *</label>
            <input
              type="text"
              placeholder="Ör. Süt, Avokado, Antrikot, Domates"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>MİKTAR *</label>
              <input
                type="text"
                placeholder="Ör. 2, 500, 1.5"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>BİRİM *</label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KATEGORİ *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
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
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>TAHMİNİ FİYAT (₺)</label>
              <input
                type="number"
                placeholder="Ör. 65"
                value={estimatedPrice}
                onChange={e => setEstimatedPrice(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : isEditing ? '💾 Güncelle' : '➕ Sepete Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
