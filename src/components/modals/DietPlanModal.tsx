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
  const [isLoading, setIsLoading] = useState(false);

  // Form & Görünüm Durumları
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formMealType, setFormMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const [formDescription, setFormDescription] = useState('');
  const [formChecklistText, setFormChecklistText] = useState('');
  const [formCalories, setFormCalories] = useState<number | ''>('');
  const [formProtein, setFormProtein] = useState<number | ''>('');
  const [formCarbs, setFormCarbs] = useState<number | ''>('');
  const [formFat, setFormFat] = useState<number | ''>('');

  // AI Metin Ayrıştırıcı State
  const [rawDietText, setRawDietText] = useState('');
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchOptions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/health/diet');
      const json = await res.json();
      if (json.success && json.data) {
        setOptions(json.data);
        if (json.data.length > 0) {
          const defaultOpt = json.data[0];
          setSelectedOption(defaultOpt);
          const initialCheck: Record<string, boolean> = {};
          defaultOpt?.checklist?.forEach((item: string) => {
            initialCheck[item] = true;
          });
          setCheckedItems(initialCheck);
        } else {
          setSelectedOption(null);
          setCheckedItems({});
        }
      }
    } catch (err) {
      console.error('Diyet menüleri yüklenemedi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setViewMode('list');
      fetchOptions();
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

  // 1. Diyet Menüsünü Beslenmeye / Makrolara İşle
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
      } else {
        alert(json.error || 'Menü işlenemedi.');
      }
    } catch (err) {
      alert('Menü işlenemedi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Yeni Menü Moduna Geç
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormTitle('');
    setFormMealType('breakfast');
    setFormDescription('');
    setFormChecklistText('');
    setFormCalories('');
    setFormProtein('');
    setFormCarbs('');
    setFormFat('');
    setRawDietText('');
    setAiError(null);
    setViewMode('create');
  };

  // 3. Mevcut Menüyü Düzenleme Moduna Geç
  const handleOpenEdit = (opt: DietOption, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(opt.id);
    setFormTitle(opt.title);
    setFormMealType((opt.meal_type as any) || 'breakfast');
    setFormDescription(opt.description || '');
    setFormChecklistText((opt.checklist || []).join('\n'));
    setFormCalories(opt.calories || '');
    setFormProtein(opt.protein_g || '');
    setFormCarbs(opt.carbs_g || '');
    setFormFat(opt.fat_g || '');
    setRawDietText('');
    setAiError(null);
    setViewMode('edit');
  };

  // 4. Menü Sil
  const handleDeleteOption = async (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`"${title}" diyet menüsünü silmek istediğinize emin misiniz?`)) return;

    try {
      const res = await fetch(`/api/health/diet?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        onSuccess(`🗑️ "${title}" menüsü silindi.`);
        fetchOptions();
      } else {
        alert(json.error || 'Menü silinemedi.');
      }
    } catch (err) {
      alert('Silme işlemi başarısız.');
    }
  };

  // 5. AI ile Diyetisyen Metnini Ayrıştır
  const handleParseWithAI = async () => {
    if (!rawDietText.trim()) {
      setAiError('Lütfen diyetisyen mesajını veya metnini kutucuğa yapıştırın.');
      return;
    }

    setIsParsingAI(true);
    setAiError(null);

    try {
      const res = await fetch('/api/health/diet/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawDietText.trim() })
      });

      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setFormTitle(d.title || '');
        setFormMealType(d.meal_type || 'breakfast');
        setFormDescription(d.description || '');
        setFormChecklistText((d.checklist || []).join('\n'));
        setFormCalories(d.calories || 0);
        setFormProtein(d.protein_g || 0);
        setFormCarbs(d.carbs_g || 0);
        setFormFat(d.fat_g || 0);
      } else {
        setAiError(json.error || 'Metin çözümlenemedi.');
      }
    } catch (err: any) {
      setAiError('AI servisine bağlanılamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsParsingAI(false);
    }
  };

  // 6. Formu Kaydet (Create veya Edit)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Lütfen bir menü başlığı girin.');
      return;
    }

    setIsSubmitting(true);

    const checklistArray = formChecklistText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    try {
      if (viewMode === 'create') {
        const res = await fetch('/api/health/diet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            title: formTitle,
            meal_type: formMealType,
            description: formDescription,
            checklist: checklistArray,
            calories: Number(formCalories) || 0,
            protein_g: Number(formProtein) || 0,
            carbs_g: Number(formCarbs) || 0,
            fat_g: Number(formFat) || 0,
            option_number: options.length + 1
          })
        });
        const json = await res.json();
        if (json.success) {
          onSuccess('✅ Yeni diyet menüsü başarıyla eklendi!');
          setViewMode('list');
          fetchOptions();
        } else {
          alert(json.error || 'Menü kaydedilemedi.');
        }
      } else if (viewMode === 'edit' && editingId) {
        const res = await fetch('/api/health/diet', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            title: formTitle,
            meal_type: formMealType,
            description: formDescription,
            checklist: checklistArray,
            calories: Number(formCalories) || 0,
            protein_g: Number(formProtein) || 0,
            carbs_g: Number(formCarbs) || 0,
            fat_g: Number(formFat) || 0
          })
        });
        const json = await res.json();
        if (json.success) {
          onSuccess('✅ Diyet menüsü güncellendi!');
          setViewMode('list');
          fetchOptions();
        } else {
          alert(json.error || 'Güncelleme başarısız.');
        }
      }
    } catch (err) {
      alert('Kaydetme hatası.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        {/* Başlık & Aksiyon Barı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>
            {viewMode === 'list' && '📋 Diyetisyen Menü Planı & Alternatifler'}
            {viewMode === 'create' && '✨ Yeni Diyet Menüsü Tanımla'}
            {viewMode === 'edit' && '✏️ Diyet Menüsünü Düzenle'}
          </div>

          {viewMode === 'list' && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleOpenCreate}
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-full)' }}
            >
              + Yeni Menü Ekle
            </button>
          )}

          {viewMode !== 'list' && (
            <button
              type="button"
              className="btn-subtle"
              onClick={() => setViewMode('list')}
              style={{ padding: '6px 10px', fontSize: '12px' }}
            >
              ← Listeye Dön
            </button>
          )}
        </div>

        {/* ----------------- GÖRÜNÜM 1: MENÜ LİSTESİ VE UYGULAMA ----------------- */}
        {viewMode === 'list' && (
          <>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Diyetisyeninizin tanımladığı alternatif öğünlerden birini seçin, kontrol listesinden yediğiniz besinleri onaylayın.
            </p>

            {isLoading && options.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Menüler yükleniyor...
              </div>
            ) : options.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', margin: '12px 0' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🥗</div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>Henüz kayıtlı bir diyet menüsü bulunmuyor.</div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 14px' }}>
                  Diyetisyeninizin mesajını yapıştırarak saniyeler içinde yeni bir menü ekleyebilirsiniz.
                </p>
                <button type="button" className="btn-primary" onClick={handleOpenCreate} style={{ padding: '8px 16px', fontSize: '13px' }}>
                  ⚡ İlk Menüyü AI ile Ekle
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
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
                        background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ flex: 1, paddingRight: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? '#2563EB' : 'inherit' }}>
                            {opt.title}
                          </span>
                          <span style={{ fontSize: '10px', background: 'var(--surface)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            {opt.meal_type === 'breakfast' ? 'Kahvaltı' : opt.meal_type === 'lunch' ? 'Öğle' : opt.meal_type === 'dinner' ? 'Akşam' : 'Ara Öğün'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{opt.description}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                          <span>P: {opt.protein_g}g</span>
                          <span>K: {opt.carbs_g}g</span>
                          <span>Y: {opt.fat_g}g</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '14px', color: isSelected ? '#2563EB' : 'var(--text-muted)' }}>
                          {opt.calories} kcal
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            title="Menüyü Düzenle"
                            onClick={(e) => handleOpenEdit(opt, e)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            title="Menüyü Sil"
                            onClick={(e) => handleDeleteOption(opt.id, opt.title, e)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Seçilen Menü Kontrol Listesi (Checklist) */}
            {selectedOption && (
              <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
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
            {selectedOption && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
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
            )}
          </>
        )}

        {/* ----------------- GÖRÜNÜM 2: MENÜ EKLEME / DÜZENLEME FORMU & AI SİHİRBAZI ----------------- */}
        {viewMode !== 'list' && (
          <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* AI Ayrıştırma Sihirbazı Kutusu */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(147,51,234,0.08) 100%)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563EB', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚡</span> Diyetisyen Mesajını Yapıştır (AI Sihirbazı)
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Gemini AI</span>
              </div>
              <textarea
                value={rawDietText}
                onChange={e => setRawDietText(e.target.value)}
                placeholder="Diyetisyenin WhatsApp/SMS metnini buraya yapıştırın. Örn: 'Sabah: 2 haşlanmış yumurta, 5 zeytin, 1 dilim tam buğday ekmeği, 30g lor peyniri ve bol yeşillik'"
                rows={3}
                style={{
                  width: '100%',
                  fontSize: '12px',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'inherit',
                  resize: 'vertical'
                }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handleParseWithAI}
                disabled={isParsingAI || !rawDietText.trim()}
                style={{
                  alignSelf: 'flex-end',
                  padding: '6px 14px',
                  fontSize: '12px',
                  background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                  border: 'none'
                }}
              >
                {isParsingAI ? '⏳ AI Çözümlüyor...' : '⚡ AI ile Ayrıştır ve Forma Doldur'}
              </button>
              {aiError && (
                <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px' }}>{aiError}</div>
              )}
            </div>

            {/* Manuel / Düzenleme Alanları */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Öğün Başlığı *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Örn: Haşlanmış Yumurtalı Fit Kahvaltı"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Öğün Zamanı
                  </label>
                  <select
                    value={formMealType}
                    onChange={e => setFormMealType(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontSize: '13px' }}
                  >
                    <option value="breakfast">Kahvaltı</option>
                    <option value="lunch">Öğle Yemeği</option>
                    <option value="dinner">Akşam Yemeği</option>
                    <option value="snack">Ara Öğün</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Toplam Kalori (kcal)
                  </label>
                  <input
                    type="number"
                    value={formCalories}
                    onChange={e => setFormCalories(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="380"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Makrolar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    value={formProtein}
                    onChange={e => setFormProtein(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="20"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Karb (g)
                  </label>
                  <input
                    type="number"
                    value={formCarbs}
                    onChange={e => setFormCarbs(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="35"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Yağ (g)
                  </label>
                  <input
                    type="number"
                    value={formFat}
                    onChange={e => setFormFat(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="12"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Kısa Açıklama / Not
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Örn: Yüksek proteinli, tokluk süresi uzun kahvaltı alternatifi"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Malzeme Kontrol Listesi (Checklist - Her satıra bir malzeme)
                </label>
                <textarea
                  rows={4}
                  value={formChecklistText}
                  onChange={e => setFormChecklistText(e.target.value)}
                  placeholder="2 adet haşlanmış yumurta&#10;5 adet az tuzlu zeytin&#10;1 dilim tam buğday ekmeği&#10;30g lor peyniri"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontSize: '13px' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  💡 Bu malzemeler hem öğün checklistinde hem de tek tıkla Market Listenize aktarılırken kullanılır.
                </span>
              </div>
            </div>

            {/* Aksiyon Butonları */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
                style={{ flex: 1, padding: '10px' }}
              >
                {isSubmitting ? 'Kaydediliyor...' : viewMode === 'create' ? '💾 Menüyü Kaydet' : '💾 Değişiklikleri Güncelle'}
              </button>
              <button
                type="button"
                className="btn-subtle"
                onClick={() => setViewMode('list')}
                style={{ padding: '10px 16px' }}
              >
                İptal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
