'use client';
import { useState, useEffect } from 'react';
import { Tag, X, Trash2, Calendar, CreditCard, Wallet, User, Plus, Edit3, Check, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';

interface CategoryDetailModalProps {
  isOpen: boolean;
  categoryId: string | null;
  categoryName?: string;
  monthStr: string;
  onClose: () => void;
  onUpdate: (msg?: string) => void;
  onAddExpense?: (categoryId: string) => void;
}

export default function CategoryDetailModal({
  isOpen,
  categoryId,
  categoryName,
  monthStr,
  onClose,
  onUpdate,
  onAddExpense
}: CategoryDetailModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inline Bütçe Limiti Düzenleme State
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);

  // Fiş Görseli Önizleme Lightbox State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // Kart Kalemleri Aç/Kapa State
  const [expandedTxIds, setExpandedTxIds] = useState<Record<string, boolean>>({});

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val || 0);

  const fetchCategoryDetails = async () => {
    if (!categoryId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/budget/category-details?category_id=${categoryId}&month=${monthStr}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setLimitInput(String(json.data.category?.monthly_budget_limit || ''));
      }
    } catch (err) {
      console.error('Fetch category details error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && categoryId) {
      fetchCategoryDetails();
      setIsEditingLimit(false);
      setLimitError(null);
      setPreviewImage(null);
    }
  }, [isOpen, categoryId, monthStr]);

  // ESC Tuşuyla Kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (previewImage) {
          setPreviewImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewImage, onClose]);

  if (!isOpen || !categoryId) return null;

  // Harcama Silme İşlemi
  const handleDeleteTx = async (txId: string, merchant: string) => {
    if (!confirm(`"${merchant}" harcama kaydını silmek ve tutarı bakiye iadesi olarak hesaba aktarmak istediğinize emin misiniz?`)) return;

    setDeletingId(txId);
    try {
      const res = await fetch(`/api/transactions?id=${txId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchCategoryDetails();
        onUpdate(json.message);
      } else {
        alert(json.error || 'Silme işlemi başarısız.');
      }
    } catch {
      alert('Sunucu hatası.');
    } finally {
      setDeletingId(null);
    }
  };

  // Bütçe Limiti Kaydetme / Güncelleme
  const handleSaveBudgetLimit = async () => {
    const numLimit = Number(limitInput.replace(/\D/g, ''));
    if (isNaN(numLimit) || numLimit < 0) {
      setLimitError('Lütfen geçerli bir bütçe tutarı girin.');
      return;
    }

    setSavingLimit(true);
    setLimitError(null);

    try {
      const cat = data?.category;
      const res = await fetch('/api/budget/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: categoryId,
          name: cat?.name || categoryName,
          type: cat?.type || 'expense',
          monthly_budget_limit: numLimit,
          group_50_30_20: cat?.group_50_30_20 || 'needs',
          icon: cat?.icon || '🏷️',
          color: cat?.color || '#10B981'
        })
      });

      const json = await res.json();
      if (json.success) {
        setIsEditingLimit(false);
        fetchCategoryDetails();
        onUpdate(json.message || 'Bütçe limiti güncellendi!');
      } else {
        setLimitError(json.error || 'Limit kaydedilemedi.');
      }
    } catch (err: any) {
      setLimitError(err.message || 'Bağlantı hatası.');
    } finally {
      setSavingLimit(false);
    }
  };

  const toggleExpand = (txId: string) => {
    setExpandedTxIds(prev => ({ ...prev, [txId]: !prev[txId] }));
  };

  const monthDate = new Date(monthStr + '-01');
  const monthName = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(monthDate);

  // 50/30/20 Rozet Yapılandırması
  const groupRules: Record<string, { label: string; bg: string; color: string; border: string }> = {
    needs: { label: '🏠 Zorunlu İhtiyaç (%50)', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    wants: { label: '🎯 Yaşam & Keyfi (%30)', bg: '#FAF5FF', color: '#7E22CE', border: '#E9D5FF' },
    savings: { label: '💎 Tasarruf / Yatırım (%20)', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
  };
  const categoryRule = groupRules[data?.category?.group_50_30_20] || groupRules.needs;

  // Notlardan ürün kalemlerini ayıklama yardımcısı
  const parseNotesDetails = (notes?: string) => {
    if (!notes) return { text: '', items: [] };
    // Örn: "1 kalem market fişi (UNCA 20 ML SOL) - Ref: 123"
    const match = notes.match(/\((.*?)\)/);
    if (match && match[1]) {
      const itemsList = match[1].split(',').map(s => s.trim()).filter(Boolean);
      return { text: notes.replace(/\(.*?\)/, '').trim(), items: itemsList };
    }
    return { text: notes, items: [] };
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
          <div className="sheet-handle" />

          {/* ======================================================== */}
          {/* HEADER: KATEGORİ KİMLİĞİ & 50/30/20 ROZETİ */}
          {/* ======================================================== */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: data?.category?.color ? `${data.category.color}15` : 'var(--amber-bg)',
                  border: `1.5px solid ${data?.category?.color || '#F59E0B'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {data?.category?.icon || '🏷️'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>
                    {data?.category?.name || categoryName || 'Kategori Harcamaları'}
                  </h2>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      background: categoryRule.bg,
                      color: categoryRule.color,
                      border: `1px solid ${categoryRule.border}`
                    }}
                  >
                    {categoryRule.label}
                  </span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {monthName} ayı bütçe performansı ve harcama dökümü
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Kapat"
              style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', borderRadius: '50%' }}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '2px', minHeight: 0 }}>
            {/* ======================================================== */}
            {/* 1. BÜTÇE İLERLEME & REHBERLİK KARTI (FINANCIAL INTEL) */}
            {/* ======================================================== */}
            {data && (
              <div
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {/* Durum A: Limit Tanımlanmış */}
                {data.monthlyBudgetLimit > 0 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          AYLIK BÜTÇE KULLANIMI
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }} className="tabular-nums">
                          {formatMoney(data.totalSpent)}{' '}
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                            / {formatMoney(data.monthlyBudgetLimit)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {data.remainingBudget !== null && data.remainingBudget >= 0 ? (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              background: '#ECFDF5',
                              color: '#047857',
                              border: '1px solid #A7F3D0',
                              padding: '4px 10px',
                              borderRadius: '9999px'
                            }}
                            className="tabular-nums"
                          >
                            ✓ {formatMoney(data.remainingBudget)} Kalan
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              background: '#FEF2F2',
                              color: '#991B1B',
                              border: '1px solid #FECACA',
                              padding: '4px 10px',
                              borderRadius: '9999px'
                            }}
                            className="tabular-nums"
                          >
                            ⚠️ {formatMoney(Math.abs(data.remainingBudget || 0))} Aşım
                          </span>
                        )}

                        <button
                          onClick={() => setIsEditingLimit(true)}
                          title="Bütçe Limitini Değiştir"
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--text-muted)'
                          }}
                        >
                          <Edit3 size={13} />
                          <span>Limiti Değiştir</span>
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar (0-100% ve Aşım Durumu) */}
                    <div>
                      <div className="budget-bar-track" style={{ height: '10px', borderRadius: '5px' }}>
                        <div
                          className="budget-bar-fill"
                          style={{
                            width: `${Math.min(100, data.budgetPercentage)}%`,
                            backgroundColor:
                              data.budgetPercentage > 100
                                ? '#EF4444'
                                : data.budgetPercentage > 75
                                ? '#F59E0B'
                                : '#10B981',
                            transition: 'width 0.5s ease'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <span>%0</span>
                        <span style={{ fontWeight: 800, color: data.budgetPercentage > 100 ? '#EF4444' : 'var(--text-main)' }}>
                          %{data.budgetPercentage} Harcandı
                        </span>
                        <span>%100</span>
                      </div>
                    </div>

                    {/* Finansal Rehberlik Mesajı */}
                    {data.isCurrentMonth && data.daysRemaining > 0 && (
                      <div
                        style={{
                          background: data.remainingBudget >= 0 ? '#F0FDF4' : '#FEF2F2',
                          border: `1px solid ${data.remainingBudget >= 0 ? '#BBF7D0' : '#FECACA'}`,
                          color: data.remainingBudget >= 0 ? '#166534' : '#991B1B',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>{data.remainingBudget >= 0 ? '💡' : '🚨'}</span>
                        <div style={{ lineHeight: '1.4' }}>
                          {data.remainingBudget >= 0 ? (
                            <>
                              Ay sonuna <strong>{data.daysRemaining} gün</strong> kaldı. Kategori tavanını aşmamak için günlük güvenli harcama limitiniz: <strong className="tabular-nums">~{formatMoney(data.dailyAllowance || 0)} / gün</strong>.
                            </>
                          ) : (
                            <>
                              Bu ayki bütçe tavanı <strong>{formatMoney(Math.abs(data.remainingBudget))}</strong> tutarında aşıldı. Finansal disiplin için ay sonuna kadar harcamaları durdurmanız önerilir.
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Durum B: Limit Tanımlanmamış */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '24px' }}>🎯</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                          Aylık Bütçe Limiti Belirlenmemiş
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Bu ay yapılan harcama: <strong className="tabular-nums" style={{ color: '#EF4444' }}>{formatMoney(data.totalSpent)}</strong>
                        </div>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      Harcamalarınızı kontrol altında tutmak ve limit aşımlarında anlık akıllı uyarılar almak için bu kategoriye aylık bir tavan belirleyin.
                    </p>
                    {!isEditingLimit && (
                      <div>
                        <button
                          onClick={() => setIsEditingLimit(true)}
                          className="btn-primary"
                          style={{
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            minHeight: '38px',
                            background: 'var(--emerald)'
                          }}
                        >
                          <span>🎯</span>
                          <span>Aylık Bütçe Limiti Belirle</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Inline Limit Belirleme / Düzenleme Formu */}
                {isEditingLimit && (
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1.5px solid var(--primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px',
                      marginTop: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)' }}>
                      YENİ AYLIK BÜTÇE LİMİTİ (₺)
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={limitInput}
                        onChange={e => setLimitInput(e.target.value)}
                        placeholder="Örn: 2500"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          fontSize: '14px',
                          fontWeight: 800,
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          background: 'var(--surface-subtle)'
                        }}
                      />
                      <button
                        onClick={handleSaveBudgetLimit}
                        disabled={savingLimit}
                        className="btn-primary"
                        style={{
                          padding: '8px 16px',
                          fontSize: '12px',
                          fontWeight: 700,
                          minHeight: '38px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Check size={14} />
                        <span>{savingLimit ? 'Kaydediliyor...' : 'Kaydet'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingLimit(false);
                          setLimitError(null);
                        }}
                        className="btn-subtle"
                        style={{
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          minHeight: '38px'
                        }}
                      >
                        Vazgeç
                      </button>
                    </div>
                    {limitError && (
                      <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600 }}>
                        {limitError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* 2. MİNİ KPI BENTO ÇUBUĞU */}
            {/* ======================================================== */}
            {data && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Toplam Harcama</div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#DC2626', marginTop: '2px' }} className="tabular-nums">
                    {formatMoney(data.totalSpent)}
                  </div>
                </div>
                <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>İşlem Adedi</div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }} className="tabular-nums">
                    {data.txCount || 0} Adet
                  </div>
                </div>
                <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ortalama Sepet</div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }} className="tabular-nums">
                    {formatMoney(data.averageSpent || 0)}
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 3. İŞLEMLER VE FİŞ DETAY LİSTESİ */}
            {/* ======================================================== */}
            <div style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  BU AYIN HARCAMA KALEMLERİ ({data?.transactions?.length || 0})
                </span>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  İşlem detayları yükleniyor...
                </div>
              ) : data?.transactions?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛒</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>Bu ay henüz harcama kaydı yok.</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>Aşağıdaki butona dokunarak bu kategoriye doğrudan yeni harcama ekleyebilirsiniz.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data?.transactions?.map((tx: any) => {
                    const isExpanded = expandedTxIds[tx.id];
                    const noteInfo = parseNotesDetails(tx.notes);
                    const formattedDate = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' }).format(new Date(tx.transaction_date));

                    return (
                      <div
                        key={tx.id}
                        style={{
                          background: 'var(--surface-subtle)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Üst Satır: Satıcı Adı & Tutar & Silme */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                                {tx.merchant || 'Harcama'}
                              </span>
                              {tx.is_installment === 1 && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    background: '#EEF2FF',
                                    color: '#4F46E5',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    fontWeight: 800,
                                    border: '1px solid #C7D2FE'
                                  }}
                                >
                                  Taksit {tx.installment_number}/{tx.total_installments}
                                </span>
                              )}
                            </div>

                            {/* Meta Bilgi Çubuğu: Tarih • Kart/Cüzdan • Aile Üyesi */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-muted)' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Calendar size={12} />
                                <span>{formattedDate}</span>
                              </span>
                              <span>•</span>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  background: 'var(--surface)',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border)'
                                }}
                              >
                                {tx.wallet_type === 'credit_card' ? <CreditCard size={11} /> : <Wallet size={11} />}
                                <span>{tx.wallet_name}</span>
                              </span>
                              {tx.member_name && (
                                <>
                                  <span>•</span>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <span>{tx.member_avatar || '👤'}</span>
                                    <span>{tx.member_name}</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 900, color: '#DC2626' }}>
                              -{formatMoney(tx.amount)}
                            </div>
                            <button
                              onClick={() => handleDeleteTx(tx.id, tx.merchant)}
                              disabled={deletingId === tx.id}
                              title="Harcamayı Sil ve Bakiyeyi İade Et"
                              style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '6px',
                                color: 'var(--rose)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Trash2 size={14} strokeWidth={2} />
                            </button>
                          </div>
                        </div>

                        {/* Fiş Kalemleri & Görsel Butonları */}
                        {(noteInfo.items.length > 0 || tx.receipt_image_url || noteInfo.text) && (
                          <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '6px', marginTop: '2px' }}>
                            {/* Ürün Listesi Varsa Kompakt Haplar */}
                            {noteInfo.items.length > 0 && (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>ÜRÜNLER:</span>
                                {noteInfo.items.map((item, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: '11px',
                                      background: 'var(--surface)',
                                      border: '1px solid var(--border)',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      color: 'var(--text-main)',
                                      fontWeight: 600
                                    }}
                                  >
                                    💊 {item}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Detay & Fiş Butonları */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                              {tx.receipt_image_url && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(tx.receipt_image_url)}
                                  className="btn-subtle"
                                  style={{
                                    fontSize: '11px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: '#EEF2FF',
                                    color: '#4F46E5',
                                    border: '1px solid #C7D2FE',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <ImageIcon size={12} />
                                  <span>Fiş Fotoğrafını Gör</span>
                                </button>
                              )}

                              {noteInfo.text && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(tx.id)}
                                  style={{
                                    fontSize: '11px',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 4px'
                                  }}
                                >
                                  <span>Notlar</span>
                                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                              )}
                            </div>

                            {/* Genişletilmiş Not Alanı */}
                            {isExpanded && noteInfo.text && (
                              <div
                                style={{
                                  background: 'var(--surface)',
                                  padding: '8px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: '11px',
                                  color: 'var(--text-muted)',
                                  marginTop: '6px',
                                  border: '1px solid var(--border)'
                                }}
                              >
                                {noteInfo.text}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* MODAL FOOTER: HIZLI HARCAMA EKLE & KAPAT */}
          {/* ======================================================== */}
          <div
            className="modal-sticky-footer"
            style={{
              display: 'flex',
              gap: '10px',
              paddingTop: '14px',
              marginTop: '10px',
              borderTop: '1px solid var(--border)'
            }}
          >
            {onAddExpense && (
              <button
                type="button"
                onClick={() => onAddExpense(categoryId)}
                className="btn-primary"
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'var(--emerald)'
                }}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Bu Kategoriye Harcama Ekle</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn-subtle"
              style={{
                flex: onAddExpense ? undefined : 1,
                minWidth: '100px',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 700,
                minHeight: '44px'
              }}
            >
              Kapat
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FİŞ FOTOĞRAFI TAM EKRAN LIGHTBOX */}
      {/* ======================================================== */}
      {previewImage && (
        <div
          className="modal-overlay"
          style={{ zIndex: 11000, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setPreviewImage(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: '-44px',
                right: '0',
                background: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              <X size={20} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Fiş Fotoğrafı"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                borderRadius: 'var(--radius-lg)',
                objectFit: 'contain',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
