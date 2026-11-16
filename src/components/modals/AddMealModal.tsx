'use client';
import { useState, useEffect, useCallback } from 'react';

interface AddMealModalProps {
  isOpen: boolean;
  memberId?: string | null;
  initialMealType?: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

interface MacroBase {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface SuggestionItem {
  id: string;
  name: string;
  normalizedKey: string;
  defaultGrams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  basePer100g: MacroBase;
  source: 'user_history_item' | 'user_history_meal' | 'learned_profile' | 'static_db';
  sourceBadge: string;
  mealType?: string;
}

interface ResolvedItem {
  name: string;
  normalizedKey: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  basePer100g: MacroBase;
  source: string;
  sourceBadge: string;
  quotaUsed: boolean;
}

function scaleLocalMacros(basePer100g: MacroBase, grams: number): MacroBase {
  const ratio = Math.max(0, grams) / 100;
  const protein_g = Math.round((basePer100g.protein_g || 0) * ratio * 10) / 10;
  const carbs_g = Math.round((basePer100g.carbs_g || 0) * ratio * 10) / 10;
  const fat_g = Math.round((basePer100g.fat_g || 0) * ratio * 10) / 10;
  const rawCal = Math.round((basePer100g.calories || 0) * ratio);
  const atwater = Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
  const calories =
    rawCal <= 0 && atwater > 0
      ? atwater
      : atwater > 0 && rawCal > atwater * 1.45
      ? atwater
      : atwater > 0 && carbs_g < 15 && rawCal < atwater * 0.3
      ? atwater
      : rawCal;

  return { calories, protein_g, carbs_g, fat_g };
}

function extractTypedGramsFromQuery(text: string): number | null {
  const segment = String(text || '').split(/[,;+\n]+|\s+ve\s+/i).pop()?.trim() || '';
  const match = segment.match(/(?:^|\s|\()(\d+(?:[.,]\d+)?)\s*(kg|kilo|lt|litre|g|gr|gram|ml)\.?(?:\s|\)|$)/i);
  if (!match) return null;
  const qty = parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = match[2].toLowerCase();
  const mult = unit === 'kg' || unit === 'kilo' || unit === 'lt' || unit === 'litre' ? 1000 : 1;
  return Math.max(1, Math.round(qty * mult));
}

export default function AddMealModal({ isOpen, memberId, initialMealType, onClose, onSuccess }: AddMealModalProps) {
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState(initialMealType || 'lunch');
  const [grams, setGrams] = useState('100');
  const [gramsTouched, setGramsTouched] = useState(false);
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Öğrenen Besin Hafızası & Akıllı Çözümleme durumları
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [basePer100g, setBasePer100g] = useState<MacroBase | null>(null);
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);
  const [multiBaseItems, setMultiBaseItems] = useState<ResolvedItem[] | null>(null);
  const [itemGramsDrafts, setItemGramsDrafts] = useState<Record<number, string>>({});
  const [lookupBanner, setLookupBanner] = useState<{ text: string; tone: 'memory' | 'ai' | 'warn' } | null>(null);

  const resetForm = useCallback(() => {
    setName('');
    setGrams('100');
    setGramsTouched(false);
    setCalories('');
    setProteinG('');
    setCarbsG('');
    setFatG('');
    setBasePer100g(null);
    setResolvedItems([]);
    setMultiBaseItems(null);
    setItemGramsDrafts({});
    setLookupBanner(null);
    setShowSuggestions(true);
  }, []);

  useEffect(() => {
    if (initialMealType) {
      setMealType(initialMealType);
    }
  }, [initialMealType]);

  // Yazarken %100 sıfır kota ile geçmiş ve öğrenilen besin önerilerini getir
  useEffect(() => {
    if (!isOpen || !showSuggestions) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `/api/health/nutrition/lookup?q=${encodeURIComponent(name.trim())}&limit=6`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data?.suggestions)) {
            setSuggestions(json.data.suggestions);
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setLoadingSuggestions(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, name, showSuggestions]);

  if (!isOpen) return null;

  const applyTotalsToForm = (itemsList: ResolvedItem[]) => {
    const totals = itemsList.reduce(
      (acc, it) => ({
        grams: Math.round(acc.grams + it.grams),
        calories: Math.round(acc.calories + it.calories),
        protein_g: Math.round((acc.protein_g + it.protein_g) * 10) / 10,
        carbs_g: Math.round((acc.carbs_g + it.carbs_g) * 10) / 10,
        fat_g: Math.round((acc.fat_g + it.fat_g) * 10) / 10
      }),
      { grams: 0, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );

    setGrams(String(totals.grams));
    setCalories(String(totals.calories));
    setProteinG(String(totals.protein_g));
    setCarbsG(String(totals.carbs_g));
    setFatG(String(totals.fat_g));
  };

  const handleSelectSuggestion = (sug: SuggestionItem) => {
    const typedGrams = extractTypedGramsFromQuery(name);
    const targetGrams = typedGrams || Math.max(1, Math.round(sug.defaultGrams || 100));
    const useScaled = typedGrams !== null && typedGrams !== Math.round(sug.defaultGrams || 100);
    const macros = useScaled
      ? scaleLocalMacros(sug.basePer100g, targetGrams)
      : {
          calories: Math.round(sug.calories),
          protein_g: sug.protein_g,
          carbs_g: sug.carbs_g,
          fat_g: sug.fat_g
        };

    setName(sug.name);
    if (sug.mealType) {
      setMealType(sug.mealType);
    }
    setGrams(String(targetGrams));
    setGramsTouched(true);
    setCalories(String(macros.calories));
    setProteinG(String(macros.protein_g));
    setCarbsG(String(macros.carbs_g));
    setFatG(String(macros.fat_g));
    setBasePer100g(sug.basePer100g);
    setMultiBaseItems(null);
    setItemGramsDrafts({});
    setShowSuggestions(false);
    setResolvedItems([
      {
        name: sug.name,
        normalizedKey: sug.normalizedKey,
        grams: targetGrams,
        ...macros,
        basePer100g: sug.basePer100g,
        source: sug.source,
        sourceBadge: sug.sourceBadge,
        quotaUsed: false
      }
    ]);
    setLookupBanner({
      text: `${sug.sourceBadge} — Veriler doğrudan kayıtlı hafızadan yüklendi (0 AI kotası).`,
      tone: 'memory'
    });
  };

  const handleSmartLookup = async () => {
    if (!name.trim()) return;
    setResolving(true);
    setLookupBanner(null);
    setShowSuggestions(false);

    try {
      const res = await fetch('/api/health/nutrition/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: name.trim() })
      });
      const json = await res.json();

      if (!res.ok || !json.success || !json.data) {
        setLookupBanner({
          text: json.error || 'Besin değerleri çözümlenemedi. Lütfen manuel giriş yapın.',
          tone: 'warn'
        });
        return;
      }

      const items: ResolvedItem[] = Array.isArray(json.data.items) ? json.data.items : [];
      const total = json.data.total || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, grams: 100 };
      const quotaUsedCount = Number(json.data.quotaUsedCount) || 0;
      const memoryHitCount = Number(json.data.memoryHitCount) || 0;

      setResolvedItems(items);
      setItemGramsDrafts({});
      setGramsTouched(true);
      setGrams(String(total.grams || 100));
      setCalories(String(Math.round(total.calories || 0)));
      setProteinG(String(total.protein_g ?? 0));
      setCarbsG(String(total.carbs_g ?? 0));
      setFatG(String(total.fat_g ?? 0));

      if (items.length === 1) {
        setBasePer100g(items[0].basePer100g);
        setMultiBaseItems(null);
      } else if (items.length > 1) {
        setBasePer100g(null);
        setMultiBaseItems(items);
      } else {
        setBasePer100g(null);
        setMultiBaseItems(null);
      }

      const manualCount = items.filter((it) => it.source === 'manual_required').length;
      if (manualCount > 0 && memoryHitCount === 0 && quotaUsedCount === 0) {
        setLookupBanner({
          text: '⚠️ Sistem bu besini henüz tanımıyor ve yapay zeka yanıt veremedi. Değerleri aşağıya girip kaydettiğinizde kalıcı olarak öğrenilecektir.',
          tone: 'warn'
        });
      } else if (manualCount > 0) {
        setLookupBanner({
          text: `⚠️ ${memoryHitCount + quotaUsedCount} kalem çözümlendi, ancak ${manualCount} kalem bulunamadı — lütfen eksik kalem değerini kontrol edip düzenleyin.`,
          tone: 'warn'
        });
      } else if (quotaUsedCount > 0 && memoryHitCount > 0) {
        setLookupBanner({
          text: `⚡ ${memoryHitCount} kalem geçmiş/hafızadan (0 kota), ${quotaUsedCount} yeni kalem AI ile dolduruldu. Kaydettiğinizde kalıcı hafızaya eklenecek.`,
          tone: 'ai'
        });
      } else if (quotaUsedCount > 0) {
        setLookupBanner({
          text: `🤖 ${quotaUsedCount} yeni besin AI ile dolduruldu. "Öğünü Beslenmeye Ekle" butonuna bastığınızda kalıcı hafızaya öğrenilir ve sonraki kullanımda kota harcamaz.`,
          tone: 'ai'
        });
      } else {
        setLookupBanner({
          text: `🕒 Tüm kalemler (${memoryHitCount}) kayıtlı geçmiş ve besin hafızasından getirildi (0 AI kotası).`,
          tone: 'memory'
        });
      }
    } catch {
      setLookupBanner({
        text: 'Besin çözümleme sırasında bağlantı hatası oluştu. Değerleri manuel girebilirsiniz.',
        tone: 'warn'
      });
    } finally {
      setResolving(false);
    }
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    setShowSuggestions(true);
    if (basePer100g || resolvedItems.length > 0 || lookupBanner) {
      setBasePer100g(null);
      setResolvedItems([]);
      setMultiBaseItems(null);
      setItemGramsDrafts({});
      setLookupBanner(null);
    }
  };

  const handleManualMacroChange = (setter: (val: string) => void, val: string) => {
    setter(val);
    if (basePer100g) {
      setBasePer100g(null);
    }
    if (resolvedItems.length > 0) {
      setResolvedItems([]);
      setMultiBaseItems(null);
    }
  };

  const handleGramsChange = (newVal: string) => {
    setGrams(newVal);
    setGramsTouched(true);
    const numGrams = parseFloat(newVal);
    if (!Number.isFinite(numGrams) || numGrams <= 0) {
      return;
    }

    // Çoklu kalemlerde oran kaybı olmaması için daima ilk referans anlık görüntüsünden ölçekle
    if (multiBaseItems && multiBaseItems.length > 1) {
      const baseTotal = multiBaseItems.reduce((sum, it) => sum + (it.grams || 0), 0);
      if (baseTotal <= 0) return;
      const scaleFactor = numGrams / baseTotal;
      const updated = multiBaseItems.map((item) => {
        const scaledGrams = Math.max(1, Math.round(item.grams * scaleFactor));
        const scaled = scaleLocalMacros(item.basePer100g, scaledGrams);
        return { ...item, grams: scaledGrams, ...scaled };
      });
      setResolvedItems(updated);
      setItemGramsDrafts({});
      const totals = updated.reduce(
        (acc, it) => ({
          calories: Math.round(acc.calories + it.calories),
          protein_g: Math.round((acc.protein_g + it.protein_g) * 10) / 10,
          carbs_g: Math.round((acc.carbs_g + it.carbs_g) * 10) / 10,
          fat_g: Math.round((acc.fat_g + it.fat_g) * 10) / 10
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      );
      setCalories(String(totals.calories));
      setProteinG(String(totals.protein_g));
      setCarbsG(String(totals.carbs_g));
      setFatG(String(totals.fat_g));
      return;
    }

    if (!basePer100g) {
      return;
    }
    const scaled = scaleLocalMacros(basePer100g, numGrams);
    setCalories(String(scaled.calories));
    setProteinG(String(scaled.protein_g));
    setCarbsG(String(scaled.carbs_g));
    setFatG(String(scaled.fat_g));
    if (resolvedItems.length === 1) {
      setResolvedItems([{ ...resolvedItems[0], grams: Math.round(numGrams), ...scaled }]);
    }
  };

  // Çoklu kalem listesinde kullanıcının son rakamı dahi silebilmesi için taslak metni sakla
  const handleItemGramsChange = (index: number, newGramsStr: string) => {
    setItemGramsDrafts((prev) => ({ ...prev, [index]: newGramsStr }));
    const parsed = parseFloat(newGramsStr);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const newGrams = Math.max(1, Math.round(parsed));
    const updated = resolvedItems.map((item, idx) => {
      if (idx !== index) return item;
      const scaled = scaleLocalMacros(item.basePer100g, newGrams);
      return { ...item, grams: newGrams, ...scaled };
    });

    setResolvedItems(updated);
    setMultiBaseItems(updated);
    setGramsTouched(true);
    applyTotalsToForm(updated);
  };

  const handleItemGramsBlur = (index: number) => {
    const draft = itemGramsDrafts[index];
    if (draft !== undefined && (!Number.isFinite(parseFloat(draft)) || parseFloat(draft) <= 0)) {
      setItemGramsDrafts((prev) => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const explicitGramsPayload =
        gramsTouched || resolvedItems.length > 0 ? Math.max(1, Number(grams) || 100) : undefined;

      const res = await fetch('/api/health/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_meal',
          name,
          meal_type: mealType,
          member_id: memberId || undefined,
          grams: explicitGramsPayload,
          calories: Number(calories),
          protein_g: Number(proteinG),
          carbs_g: Number(carbsG) || 0,
          fat_g: Number(fatG) || 0,
          items: resolvedItems.length > 0 ? resolvedItems : undefined
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(json.message || '🥗 Öğün eklendi ve besin hafızasına kaydedildi!');
        resetForm();
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
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
            🥗 Akıllı Öğün Ekle
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                NE YEDİNİZ? (BESİN / ÖĞÜN ADI) *
              </label>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Virgülle çoklu giriş desteklenir
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
              <input
                type="text"
                placeholder="Ör. 2 haşlanmış yumurta, 60g yulaf veya yemek adı..."
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                required
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  color: 'var(--text-main)'
                }}
              />
              <button
                type="button"
                onClick={handleSmartLookup}
                disabled={resolving || !name.trim()}
                title="Önce geçmiş kayıtları tarar; yalnızca yeni ürünler için AI kullanır"
                style={{
                  padding: '0 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  background: resolving ? 'var(--surface-subtle)' : 'rgba(16, 185, 129, 0.12)',
                  color: 'var(--text-main)',
                  cursor: resolving || !name.trim() ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: !name.trim() ? 0.5 : 1
                }}
              >
                {resolving ? '⏳ Çözülüyor...' : '✨ Değerleri Doldur'}
              </button>
            </div>
          </div>

          {/* 0 Kota Geçmiş & Öğrenilen Besin Önerileri */}
          {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
            <div
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                  🕒 DAHA ÖNCE TÜKETTİKLERİNİZ & ÖĞRENİLEN HAFIZA (0 KOTA)
                </span>
                {loadingSuggestions && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>aranıyor...</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '145px', overflowY: 'auto' }}>
                {suggestions.map((sug) => (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sug.name}{' '}
                        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
                          ({Math.round(sug.defaultGrams)}g)
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {sug.sourceBadge}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#10B981' }}>{Math.round(sug.calories)} kcal</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {sug.protein_g}P · {sug.carbs_g}K · {sug.fat_g}Y
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Kaynak ve Kota Bilgilendirme Bandı */}
          {lookupBanner && (
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border:
                  lookupBanner.tone === 'memory'
                    ? '1px solid rgba(16, 185, 129, 0.4)'
                    : lookupBanner.tone === 'ai'
                    ? '1px solid rgba(59, 130, 246, 0.4)'
                    : '1px solid rgba(245, 158, 11, 0.45)',
                background:
                  lookupBanner.tone === 'memory'
                    ? 'rgba(16, 185, 129, 0.1)'
                    : lookupBanner.tone === 'ai'
                    ? 'rgba(59, 130, 246, 0.1)'
                    : 'rgba(245, 158, 11, 0.1)',
                color: 'var(--text-main)'
              }}
            >
              {lookupBanner.text}
            </div>
          )}

          {/* Çoklu Kalem Dökümü */}
          {resolvedItems.length > 1 && (
            <div
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>
                🍽️ ÖĞÜN KALEMLERİ ({resolvedItems.length} ÜRÜN)
              </div>
              {resolvedItems.map((item, idx) => (
                <div
                  key={`${item.normalizedKey}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    fontSize: '12px',
                    padding: '5px 7px',
                    borderRadius: '6px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {item.sourceBadge} · {item.calories} kcal ({item.protein_g}P/{item.carbs_g}K/{item.fat_g}Y)
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min={1}
                      value={itemGramsDrafts[idx] !== undefined ? itemGramsDrafts[idx] : item.grams}
                      onChange={(e) => handleItemGramsChange(idx, e.target.value)}
                      onBlur={() => handleItemGramsBlur(idx)}
                      style={{
                        width: '62px',
                        padding: '4px 6px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)',
                        color: 'var(--text-main)',
                        textAlign: 'right'
                      }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>g</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ÖĞÜN TÜRÜ *</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              >
                <option value="breakfast">🌅 Kahvaltı</option>
                <option value="lunch">☀️ Öğle Yemeği</option>
                <option value="dinner">🌙 Akşam Yemeği</option>
                <option value="snack">🍎 Ara Öğün / Atıştırmalık</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                GRAMAJ / MİKTAR (G)
              </label>
              <input
                type="number"
                min={1}
                value={grams}
                onChange={(e) => handleGramsChange(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KALORİ (KCAL) *</label>
              <input
                type="number"
                value={calories}
                onChange={(e) => handleManualMacroChange(setCalories, e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>PROTEİN (GRAM) *</label>
              <input
                type="number"
                step="0.1"
                value={proteinG}
                onChange={(e) => handleManualMacroChange(setProteinG, e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KARBONHİDRAT (GRAM)</label>
              <input
                type="number"
                step="0.1"
                value={carbsG}
                onChange={(e) => handleManualMacroChange(setCarbsG, e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>YAĞ (GRAM)</label>
              <input
                type="number"
                step="0.1"
                value={fatG}
                onChange={(e) => handleManualMacroChange(setFatG, e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : '🥗 Öğünü Beslenmeye Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
