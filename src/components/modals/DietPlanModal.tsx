'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Plus,
  ArrowLeft,
  X,
  Check,
  Edit2,
  Trash2,
  ShoppingCart,
  Send,
  Flame,
  CheckSquare,
  Square,
  Copy
} from 'lucide-react';

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
          meal_type: selectedOption.meal_type,
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
        setFormTitle(d.title || 'Diyetisyen Menüsü');
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

  const handleAddSample = (sampleText: string) => {
    setRawDietText(sampleText);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bottom-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: viewMode === 'list' ? '600px' : '960px',
          width: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          transition: 'max-width 0.25s ease-in-out'
        }}
      >
        <div className="sheet-handle" style={{ margin: '8px auto 4px' }} />

        {/* Üst Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {viewMode === 'list' && 'Diyetisyen Menü Planları & Alternatifler'}
                {viewMode === 'create' && 'AI Diyetisyen Sihirbazı & Yeni Menü'}
                {viewMode === 'edit' && 'Diyet Menüsünü Düzenle'}
              </h3>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {viewMode === 'list' ? 'Kayıtlı alternatifleri seçin veya yenisini ekleyin' : 'WhatsApp/SMS metninden otomatik ayrıştırıcı'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {viewMode === 'list' ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenCreate}
                style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Menü</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setViewMode('list')}
                style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Menü Listesi</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Gövdesi */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {/* ----------------- GÖRÜNÜM 1: LİSTE MODU ----------------- */}
          {viewMode === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {isLoading && options.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Menüler yükleniyor...
                </div>
              ) : options.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px 16px',
                    background: 'var(--surface-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🥗</div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                    Henüz kayıtlı bir diyet menüsü bulunmuyor
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px auto 16px', maxWidth: '340px' }}>
                    Diyetisyeninizin WhatsApp veya SMS mesajını yapıştırarak saniyeler içinde yeni bir alternatif menü oluşturabilirsiniz.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleOpenCreate}
                    style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 800 }}
                  >
                    ✨ İlk Menüyü AI ile Ekle
                  </button>
                </div>
              ) : (
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
                          border: isSelected ? '2px solid #6366F1' : '1px solid var(--border)',
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--surface-subtle)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 800, fontSize: '14px', color: isSelected ? '#6366F1' : 'var(--text-main)' }}>
                              {opt.title}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                background: 'var(--surface)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                color: 'var(--text-muted)'
                              }}
                            >
                              {opt.meal_type === 'breakfast' ? 'Kahvaltı' : opt.meal_type === 'lunch' ? 'Öğle' : opt.meal_type === 'dinner' ? 'Akşam' : 'Ara Öğün'}
                            </span>
                          </div>
                          {opt.description && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {opt.description}
                            </div>
                          )}
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                            <span style={{ color: '#6366F1' }}>P: {opt.protein_g}g</span>
                            <span style={{ color: '#F59E0B' }}>C: {opt.carbs_g}g</span>
                            <span style={{ color: '#10B981' }}>Y: {opt.fat_g}g</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <div className="tabular-nums" style={{ fontWeight: 900, fontSize: '14px', color: isSelected ? '#6366F1' : 'var(--text-main)' }}>
                            {opt.calories} kcal
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              title="Menüyü Düzenle"
                              onClick={e => handleOpenEdit(opt, e)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Menüyü Sil"
                              onClick={e => handleDeleteOption(opt.id, opt.title, e)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}
                            >
                              <Trash2 className="w-3.5 h-3.5 hover:text-rose-500" />
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
                <div
                  style={{
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                    ⚡ Öğün Kontrol Listesi (Yenmeyenleri Çıkarın):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedOption.checklist.map(item => (
                      <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!checkedItems[item]}
                          onChange={() => toggleCheck(item)}
                          style={{ accentColor: '#6366F1' }}
                        />
                        <span style={{ textDecoration: checkedItems[item] ? 'none' : 'line-through', color: checkedItems[item] ? 'var(--text-main)' : 'var(--text-muted)' }}>
                          {item}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Alt Butonlar */}
              {selectedOption && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleApplyDiet}
                    disabled={isSubmitting}
                    style={{
                      padding: '12px',
                      fontSize: '13px',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      boxShadow: '0 3px 10px rgba(16, 185, 129, 0.25)'
                    }}
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
                    style={{ padding: '10px', fontSize: '12px', fontWeight: 700, width: '100%', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <ShoppingCart className="w-4 h-4 text-emerald-500" />
                    <span>Seçilen Malzemeleri Market Listesine Ekle</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ----------------- GÖRÜNÜM 2: MASAÜSTÜ SPLIT-VIEW AI SİHİRBAZI ----------------- */}
          {viewMode !== 'list' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '16px',
                alignItems: 'start'
              }}
            >
              {/* SOL SÜTUN: WHATSAPP / SERBEST METİN VE AI PROMPT */}
              <div
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#6366F1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span>Diyetisyen WhatsApp Mesajı</span>
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--emerald)', backgroundColor: 'var(--emerald-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                    Gemini AI Vision
                  </span>
                </div>

                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  Diyetisyeninizin WhatsApp, e-posta veya SMS ile ilettiği menü listesini aynen yapıştırın. Yapay zeka tüm kaloriyi, makroları ve alışveriş checklist'ini otomatik ayrıştıracaktır.
                </p>

                <textarea
                  value={rawDietText}
                  onChange={e => setRawDietText(e.target.value)}
                  placeholder="Örn: 'Kahvaltı Alternatif 1: 2 adet haşlanmış yumurta, 5 adet zeytin, 1 dilim tam buğday ekmeği, 30g lor peyniri, bol roka ve maydanoz'"
                  rows={6}
                  style={{
                    width: '100%',
                    fontSize: '12px',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-main)',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                />

                {/* Örnek Şablon Hapları */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleAddSample('Sabah: 2 haşlanmış köy yumurtası, 5 zeytin, 1 dilim karakılçık ekmeği, 40g süzme peynir, 1 tatlı kaşığı zeytinyağı ve söğüş domates')}
                    style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    🍳 Örnek Fit Kahvaltı
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSample('Öğle: 180g ızgara somon fileto, buharda brokoli ve karnabahar, 1 kase kinoa salatası ve 1 tatlı kaşığı zeytinyağı')}
                    style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    🐟 Örnek Somon & Kinoa
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleParseWithAI}
                  disabled={isParsingAI || !rawDietText.trim()}
                  style={{
                    padding: '10px',
                    fontSize: '12px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)'
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isParsingAI ? '⏳ AI Çözümlüyor...' : '⚡ AI ile Ayrıştır ve Canlı Önizle'}</span>
                </button>

                {aiError && (
                  <div style={{ fontSize: '11px', color: '#F43F5E', backgroundColor: 'rgba(244, 63, 94, 0.1)', padding: '6px 8px', borderRadius: '6px' }}>
                    {aiError}
                  </div>
                )}
              </div>

              {/* SAĞ SÜTUN: AI CANLI ÖNİZLEME VE DÜZENLEME FORMU */}
              <form
                onSubmit={handleSaveForm}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                    Canlı Menü Kartı & Önizleme
                  </span>
                  <span className="tabular-nums" style={{ fontSize: '14px', fontWeight: 900, color: '#10B981' }}>
                    {formCalories || 0} kcal
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Menü Başlığı *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="Örn: Haşlanmış Yumurtalı Fit Kahvaltı"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surface-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      fontWeight: 700
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Öğün Zamanı
                    </label>
                    <select
                      value={formMealType}
                      onChange={e => setFormMealType(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface-subtle)',
                        color: 'var(--text-main)',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    >
                      <option value="breakfast">Kahvaltı</option>
                      <option value="lunch">Öğle Yemeği</option>
                      <option value="dinner">Akşam Yemeği</option>
                      <option value="snack">Ara Öğün</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Toplam Kalori (kcal)
                    </label>
                    <input
                      type="number"
                      value={formCalories}
                      onChange={e => setFormCalories(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="420"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface-subtle)',
                        color: 'var(--text-main)',
                        fontSize: '12px',
                        fontWeight: 800
                      }}
                    />
                  </div>
                </div>

                {/* 3'lü Makro Dağılımı */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#6366F1', display: 'block' }}>
                      🥩 Protein (g)
                    </label>
                    <input
                      type="number"
                      value={formProtein}
                      onChange={e => setFormProtein(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="25"
                      style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 800, color: '#6366F1', outline: 'none' }}
                    />
                  </div>

                  <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#F59E0B', display: 'block' }}>
                      🌾 Karb (g)
                    </label>
                    <input
                      type="number"
                      value={formCarbs}
                      onChange={e => setFormCarbs(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="35"
                      style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 800, color: '#F59E0B', outline: 'none' }}
                    />
                  </div>

                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#10B981', display: 'block' }}>
                      🥑 Yağ (g)
                    </label>
                    <input
                      type="number"
                      value={formFat}
                      onChange={e => setFormFat(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="14"
                      style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 800, color: '#10B981', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Kısa Not / Diyetisyen Önerisi
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder="Örn: Yüksek proteinli, tokluk süresi uzun kahvaltı alternatifi"
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-main)', fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Malzeme Kontrol Listesi (Checklist - Her satıra bir malzeme)
                  </label>
                  <textarea
                    rows={4}
                    value={formChecklistText}
                    onChange={e => setFormChecklistText(e.target.value)}
                    placeholder="2 adet haşlanmış yumurta&#10;5 adet zeytin&#10;1 dilim tam buğday ekmeği"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-main)', fontSize: '12px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSubmitting}
                    style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 800 }}
                  >
                    {isSubmitting ? 'Kaydediliyor...' : viewMode === 'create' ? '💾 Menüyü Kaydet ve Listeye Ekle' : '💾 Güncellemeleri Kaydet'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setViewMode('list')}
                    style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700 }}
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
