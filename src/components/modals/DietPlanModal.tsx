'use client';
import { useState, useEffect } from 'react';

interface DietOption {
  id: string;
  meal_type: string;
  option_number: number;
  title: string;
  description: string;
  checklist: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface DietModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function DietPlanModal({ isOpen, onClose, onSuccess }: DietModalProps) {
  const [options, setOptions] = useState<DietOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<DietOption | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/health/diet')
        .then(res => res.json())
        .then(json => {
          if (json.success && json.data) {
            setOptions(json.data);
            setSelectedOption(json.data[0] || null);
            const initialCheck: Record<string, boolean> = {};
            json.data[0]?.checklist?.forEach((item: string) => {
              initialCheck[item] = true;
            });
            setCheckedItems(initialCheck);
          }
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectOption = (opt: DietOption) => {
    setSelectedOption(opt);
    const initialCheck: Record<string, boolean> = {};
    opt.checklist?.forEach(item => {
      initialCheck[item] = true;
    });
    setCheckedItems(initialCheck);
  };

  const toggleCheck = (item: string) => {
    setCheckedItems(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const handleApplyDiet = async () => {
    if (!selectedOption) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/health/diet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          option_id: selectedOption.id,
          custom_title: selectedOption.title,
          calories: selectedOption.calories,
          protein_g: selectedOption.protein_g,
          carbs_g: selectedOption.carbs_g,
          fat_g: selectedOption.fat_g
        })
      });
      const json = await res.json();
      if (json.success) {
        onSuccess(json.message);
        onClose();
      }
    } catch (err) {
      alert('Menü işlenemedi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="sheet-handle"></div>
        <div style={{ fontSize: '17px', fontWeight: 700 }}>📋 Diyetisyen Menü Planı & Alternatifler</div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Diyetisyeninizin tanımladığı alternatif öğünlerden birini seçin ve kontrol listesinden yediğiniz besinleri onaylayın.
        </p>

        {/* Alternatif Seçici */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map(opt => {
            const isSelected = selectedOption?.id === opt.id;
            return (
              <div 
                key={opt.id}
                onClick={() => handleSelectOption(opt)}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected ? '2px solid #3B82F6' : '1px solid var(--border)',
                  background: isSelected ? '#EFF6FF' : 'var(--surface-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? '#1E40AF' : 'inherit' }}>
                    {opt.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.description}</div>
                </div>
                <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '14px', color: isSelected ? '#2563EB' : 'var(--text-muted)' }}>
                  {opt.calories} kcal
                </div>
              </div>
            );
          })}
        </div>

        {/* Seçilen Menü Kontrol Listesi (Checklist) */}
        {selectedOption && (
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700 }}>⚡ Öğün Checklist (Yenmeyenleri Çıkarın):</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedOption.checklist.map(item => (
                <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={!!checkedItems[item]} 
                    onChange={() => toggleCheck(item)} 
                  />
                  <span style={{ textDecoration: checkedItems[item] ? 'none' : 'line-through', color: checkedItems[item] ? 'inherit' : 'var(--text-muted)' }}>
                    {item}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Butonlar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            className="btn-primary" 
            onClick={handleApplyDiet}
            disabled={isSubmitting}
            style={{ padding: '12px' }}
          >
            {isSubmitting ? 'İşleniyor...' : '✅ Bu Menüyü Uygula ve Beslenmeye İşle'}
          </button>
          
          <button 
            type="button"
            className="btn-subtle"
            onClick={async () => {
              if (!selectedOption) return;
              const ingredients = selectedOption.checklist
                .filter(item => checkedItems[item])
                .map(item => ({
                  name: item.replace(/\(.*?\)/g, '').trim(),
                  quantity: '1',
                  unit: 'adet',
                  category: 'Market'
                }));
              const res = await fetch('/api/shopping-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'generate_from_diet',
                  diet_option_id: selectedOption.id,
                  ingredients
                })
              });
              const json = await res.json();
              if (json.success) {
                onSuccess(`🛒 ${ingredients.length} adet diyet malzemesi Akıllı Market Listesine başarıyla eklendi!`);
                onClose();
              }
            }}
            style={{ padding: '10px', fontSize: '13px', width: '100%', border: '1px solid var(--border)' }}
          >
            🛒 Seçilen Malzemeleri Market Listesine Ekle
          </button>
        </div>
      </div>
    </div>
  );
}
