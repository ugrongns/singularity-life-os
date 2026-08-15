'use client';
import { useState } from 'react';

interface Category {
  id: string;
  name: string;
  type: string;
  monthly_budget_limit: number;
  spent_this_month: number;
  percentage: number;
  group_50_30_20?: string;
  icon?: string;
  color?: string;
}

interface BudgetLimitsProps {
  categories: Category[];
  monthlySummary: {
    selectedMonth?: string;
    totalExpense: number;
    totalIncome?: number;
    totalBudgetLimit: number;
    maxAllowedCap?: number;
    totalCreditCardLimits?: number;
    budgetScore?: {
      score: number;
      grade: string;
      breakdown: {
        needs: { planned: number; ideal: number; pct: number };
        wants: { planned: number; ideal: number; pct: number };
        savings: { planned: number; ideal: number; pct: number };
      };
    };
    monthName: string;
  };
  onUpdate?: (msg?: string) => void;
  onMonthChange?: (monthStr: string) => void;
  onOpenCategoryDetail?: (catId: string, catName: string) => void;
}

export default function BudgetLimitsCard({ categories, monthlySummary, onUpdate, onMonthChange, onOpenCategoryDetail }: BudgetLimitsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('new');
  const [name, setName] = useState('');
  const [limit, setLimit] = useState<number | ''>('');
  const [group503020, setGroup503020] = useState<'needs' | 'wants' | 'savings'>('needs');
  const [icon, setIcon] = useState('🏷️');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✅ Timezone-safe yardımcı: YYYY-MM döndürür, toISOString() UTC'ye kaydırdığından kullanılmaz
  const localMonthStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const parseMonthStr = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1); // ✅ Yerel constructor — UTC kaydı yok
  };

  const handlePrevMonth = () => {
    if (!onMonthChange) return;
    const cur = monthlySummary.selectedMonth || localMonthStr(new Date());
    const d = parseMonthStr(cur);
    d.setMonth(d.getMonth() - 1);
    onMonthChange(localMonthStr(d));
  };

  const handleNextMonth = () => {
    if (!onMonthChange) return;
    const cur = monthlySummary.selectedMonth || localMonthStr(new Date());
    const d = parseMonthStr(cur);
    d.setMonth(d.getMonth() + 1);
    onMonthChange(localMonthStr(d));
  };

  const expenseCategories = categories.filter(c => c.type !== 'income');

  // Bütçe Tavanı = Tüm Harcama Kategorilerinin Limitlerinin Toplamı
  const calculatedTotalBudgetLimit = expenseCategories.reduce((sum, c) => sum + (c.monthly_budget_limit || 0), 0);
  const displayBudgetLimit = monthlySummary.totalBudgetLimit || calculatedTotalBudgetLimit;

  // Harcama Yüzdesi (Aylık Harcama / Bütçe Tavanı)
  const totalPercentage = displayBudgetLimit > 0 
    ? Math.min(Math.round((monthlySummary.totalExpense / displayBudgetLimit) * 100), 100) 
    : 0;

  const formatTRY = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

  const openManageModal = () => {
    setErrorMsg(null);
    if (expenseCategories.length > 0) {
      const first = expenseCategories[0];
      setSelectedCategoryId(first.id);
      setName(first.name);
      setLimit(first.monthly_budget_limit || '');
      setGroup503020((first.group_50_30_20 as any) || 'needs');
      setIcon(first.icon || '🏷️');
    } else {
      setSelectedCategoryId('new');
      setName('');
      setLimit('');
      setGroup503020('needs');
      setIcon('🏷️');
    }
    setIsModalOpen(true);
  };

  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setErrorMsg(null);
    if (catId === 'new') {
      setName('');
      setLimit('');
      setGroup503020('needs');
      setIcon('🏷️');
    } else {
      const cat = expenseCategories.find(c => c.id === catId);
      if (cat) {
        setName(cat.name);
        setLimit(cat.monthly_budget_limit || '');
        setGroup503020((cat.group_50_30_20 as any) || 'needs');
        setIcon(cat.icon || '🏷️');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Kategori adı zorunludur.');
      return;
    }

    // İstemci Tarafı Maksimum Bütçe Tavanı Kontrolü (Gelir + Kart Limitleri)
    if (monthlySummary.maxAllowedCap) {
      const isEdit = selectedCategoryId !== 'new';
      const targetLimit = Number(limit) || 0;
      const otherLimitsSum = expenseCategories
        .filter(c => isEdit ? c.id !== selectedCategoryId : true)
        .reduce((sum, c) => sum + (c.monthly_budget_limit || 0), 0);
      
      const newTotal = otherLimitsSum + targetLimit;
      if (newTotal > monthlySummary.maxAllowedCap) {
        setErrorMsg(`⚠️ Toplam Limit Aşıldı! Bütçe limitlerinin toplamı (₺${newTotal.toLocaleString('tr-TR')}), Aylık Gelir + Kredi Kartı Limitleri tavanını (₺${monthlySummary.maxAllowedCap.toLocaleString('tr-TR')}) aşamaz.`);
        return;
      }
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const isEdit = selectedCategoryId !== 'new';
      const res = await fetch('/api/budget/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: isEdit ? selectedCategoryId : undefined,
          name: name.trim(),
          type: 'expense',
          monthly_budget_limit: Number(limit) || 0,
          group_50_30_20: group503020,
          icon
        })
      });

      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        if (onUpdate) onUpdate(json.message);
      } else {
        setErrorMsg(json.error || 'İşlem başarısız.');
      }
    } catch (err) {
      setErrorMsg('Sunucu hatası.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedCategoryId === 'new') return;
    const cat = expenseCategories.find(c => c.id === selectedCategoryId);
    if (!cat) return;

    if (!confirm(`"${cat.name}" kategorisini silmek istediğinize emin misiniz?`)) return;

    setDeleting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/budget/categories?id=${selectedCategoryId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        if (onUpdate) onUpdate(json.message);
      } else {
        setErrorMsg(json.error || 'Silme işlemi başarısız.');
      }
    } catch (err) {
      setErrorMsg('Sunucu hatası.');
    } finally {
      setDeleting(false);
    }
  };

  const scoreData = monthlySummary.budgetScore;

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>📊</span>
          <span>{monthlySummary.monthName} Bütçe & Nakit Akışı</span>
        </div>
      </div>

      <div className="card-action-bar">
        {onMonthChange && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--surface-subtle)', padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
            <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 800 }}>◀</button>
            <span style={{ fontSize: '12px', fontWeight: 800 }}>{monthlySummary.monthName}</span>
            <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 800 }}>▶</button>
          </div>
        )}
        <button
          onClick={openManageModal}
          className="btn-subtle"
        >
          <span>⚙️</span>
          <span>Limitleri Yönet</span>
        </button>
      </div>

      {/* Gelir ve Harcama Özeti */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <div style={{ background: 'var(--emerald-bg)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Aylık Toplam Gelir</div>
          <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--emerald)', marginTop: '2px' }}>
            +{formatTRY(monthlySummary.totalIncome || 0)}
          </div>
        </div>

        <div style={{ background: 'var(--surface-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Aylık Harcama</div>
          <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
            {formatTRY(monthlySummary.totalExpense)}
          </div>
        </div>
      </div>

      {/* Genel Harcama İlerleme Barı (Bütçe Tavanı = Kategorilerin Toplamı) */}
      <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
          <span>Harcama: {formatTRY(monthlySummary.totalExpense)}</span>
          <span style={{ color: 'var(--text-muted)' }}>Bütçe Tavanı: {formatTRY(displayBudgetLimit)}</span>
        </div>
        <div className="budget-bar-track" style={{ height: '8px' }}>
          <div 
            className="budget-bar-fill" 
            style={{ 
              width: `${totalPercentage}%`, 
              backgroundColor: totalPercentage > 85 ? 'var(--rose)' : 'var(--emerald)' 
            }} 
          />
        </div>
        {monthlySummary.maxAllowedCap && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px', textAlign: 'right' }}>
            Maks. İzin Verilen Tavan (Gelir + Kart Limitleri): <strong>{formatTRY(monthlySummary.maxAllowedCap)}</strong>
          </div>
        )}
      </div>



      {/* 🎯 50 / 30 / 20 Bütçe Sağlık Skoru & Dağılım Paneli */}
      {scoreData && (
        <div style={{
          background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
          border: '1px solid #DBEAFE', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>🎯</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#1E40AF' }}>50 / 30 / 20 Bütçe Dengesi Skoru</span>
            </div>
            <div style={{
              background: scoreData.score >= 80 ? '#10B981' : scoreData.score >= 60 ? '#3B82F6' : '#EF4444',
              color: 'white', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 900
            }}>
              {scoreData.score} / 100 — {scoreData.grade}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '6px' }}>
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>🛡️ %50 İhtiyaçlar</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                {formatTRY(scoreData.breakdown.needs.planned)}
              </div>
              <div style={{ fontSize: '9px', color: '#94A3B8' }}>Hedef: {formatTRY(scoreData.breakdown.needs.ideal)}</div>
            </div>

            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>🎉 %30 İstekler</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                {formatTRY(scoreData.breakdown.wants.planned)}
              </div>
              <div style={{ fontSize: '9px', color: '#94A3B8' }}>Hedef: {formatTRY(scoreData.breakdown.wants.ideal)}</div>
            </div>

            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>🌱 %20 Birikim/Borç</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                {formatTRY(scoreData.breakdown.savings.planned)}
              </div>
              <div style={{ fontSize: '9px', color: '#94A3B8' }}>Hedef: {formatTRY(scoreData.breakdown.savings.ideal)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Kategori Bazlı Barlar (Tıklanınca Detay Pop-up Modalı Açılır) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {expenseCategories.map(cat => (
          <div
            key={cat.id}
            className="budget-bar-item"
            onClick={() => onOpenCategoryDetail?.(cat.id, cat.name)}
            title="Harcama detaylarını görmek için tıklayın"
            style={{
              cursor: 'pointer',
              padding: '6px 8px',
              borderRadius: 'var(--radius-md)',
              transition: 'background 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{cat.icon || '🏷️'}</span>
                <span style={{ fontWeight: 600 }}>{cat.name}</span>
                {cat.group_50_30_20 && (
                  <span style={{
                    fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                    background: cat.group_50_30_20 === 'needs' ? '#E0F2FE' : cat.group_50_30_20 === 'wants' ? '#FEF3C7' : '#DCFCE7',
                    color: cat.group_50_30_20 === 'needs' ? '#0369A1' : cat.group_50_30_20 === 'wants' ? '#B45309' : '#15803D'
                  }}>
                    {cat.group_50_30_20 === 'needs' ? '%50 İhtiyaç' : cat.group_50_30_20 === 'wants' ? '%30 İstek' : '%20 Birikim'}
                  </span>
                )}
              </div>
              <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                <strong>{formatTRY(cat.spent_this_month)}</strong> / {formatTRY(cat.monthly_budget_limit)}
              </span>
            </div>
            <div className="budget-bar-track">
              <div 
                className="budget-bar-fill" 
                style={{ 
                  width: `${cat.percentage}%`,
                  backgroundColor: cat.percentage > 85 ? 'var(--rose)' : cat.percentage > 70 ? 'var(--amber)' : (cat.color || 'var(--emerald)')
                }} 
              />
            </div>
          </div>
        ))}
      </div>

      {/* Limitleri Yönet Modalı */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '460px', width: '100%',
            boxShadow: 'var(--shadow-xl)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚙️</span>
                <span>Kategori & Bütçe Limitlerini Yönet</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
                {errorMsg}
              </div>
            )}

            {/* Maksimum İzin Verilen Tavan Bilgisi */}
            {monthlySummary.maxAllowedCap && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '11px', fontWeight: 600 }}>
                <span>🛡️ Maksimum Bütçe Tavan Sınırı (Gelir + Kart Limitleri): </span>
                <strong style={{ color: '#0F172A' }}>{formatTRY(monthlySummary.maxAllowedCap)}</strong>
              </div>
            )}

            {/* Kategori Seçici */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                DÜZENLENECEK KATEGORİ SEÇİN VEYA YENİ EKLEYİN
              </label>
              <select
                value={selectedCategoryId}
                onChange={e => handleSelectCategory(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 700,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px',
                  background: 'var(--surface)'
                }}
              >
                <option value="new">＋ Yeni Kategori Ekle</option>
                {expenseCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon || '🏷️'} {cat.name} — Limit: {formatTRY(cat.monthly_budget_limit)}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>KATEGORİ ADI *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Market & Gıda veya Restoran"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AYLIK BÜTÇE LİMİTİ (₺) *</label>
                <input
                  type="number"
                  required
                  placeholder="Örn: 15000"
                  value={limit}
                  onChange={e => setLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>50 / 30 / 20 BÜTÇE KATEGORİ GRUBU *</label>
                <select
                  value={group503020}
                  onChange={e => setGroup503020(e.target.value as any)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', fontWeight: 600 }}
                >
                  <option value="needs">🛡️ %50 Zorunlu İhtiyaçlar (Kira, Fatura, Market, Ulaşım)</option>
                  <option value="wants">🎉 %30 İstekler & Yaşam Kalitesi (Restoran, Eğlence, Spor, Hobi)</option>
                  <option value="savings">🌱 %20 Tasarruf & Borç Kapatma (Yatırım, Acil Fon, Kart Borcu)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>KATEGORİ EMOJİSİ</label>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {['🛒', '🍔', '⛽', '🏠', '⚡', '💊', '✈️', '🎮', '👕', '📱', '⚽', '🎨'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setIcon(emoji)}
                      style={{
                        width: '32px', height: '32px', borderRadius: '8px', fontSize: '16px',
                        border: icon === emoji ? '2px solid var(--emerald)' : '1px solid var(--border)',
                        background: icon === emoji ? 'var(--emerald-bg)' : 'var(--surface-subtle)',
                        cursor: 'pointer'
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                {selectedCategoryId !== 'new' && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      background: '#FEF2F2', color: '#DC2626', border: '1px solid #FEE2E2',
                      borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '12px', fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Sil
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-subtle"
                  style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600 }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                  style={{ flex: 2, padding: '10px', fontSize: '13px', fontWeight: 700 }}
                >
                  {saving ? 'Kaydediliyor...' : selectedCategoryId !== 'new' ? 'Güncelle' : 'Kategori Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
