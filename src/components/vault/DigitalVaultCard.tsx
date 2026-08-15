'use client';
import { useState } from 'react';

interface VaultItem {
  id: string;
  title: string;
  type: string;
  owner: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  document_number?: string;
  document_image_url?: string;
  notes?: string;
  days_left: number | null;
  alert_level: 'ok' | 'warning' | 'critical';
  visa_warning?: boolean;
}

interface ImportantDate {
  id: string;
  title: string;
  person_name: string;
  event_type: string;
  event_date: string;
  remind_days_before?: number;
  gift_ideas?: string;
  notes?: string;
  days_left: number;
  next_date: string;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  birth_date?: string;
  chip_no?: string;
  vaccinations?: string;
  vet_name?: string;
  vet_phone?: string;
  vet_next_date?: string;
  notes?: string;
}

interface Props {
  vaultItems: VaultItem[];
  importantDates: ImportantDate[];
  pets: Pet[];
  onOpenAddVault: (item?: VaultItem) => void;
  onOpenAddDate: (item?: ImportantDate) => void;
  onOpenAddPet: (item?: Pet) => void;
  onRefresh: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  passport: '🛂', id_card: '🪪', title_deed: '🏠', warranty: '🛡️',
  insurance: '🏥', contract: '📄', license: '📋', other: '📁'
};

const TYPE_LABELS: Record<string, string> = {
  passport: 'Pasaport', id_card: 'Kimlik Kartı', title_deed: 'Tapu',
  warranty: 'Garanti', insurance: 'Sigorta', contract: 'Sözleşme',
  license: 'Ehliyet / Ruhsat', other: 'Diğer'
};

const EVENT_ICONS: Record<string, string> = {
  birthday: '🎂', anniversary: '💍', nameday: '🌹', custom: '📅'
};

export default function DigitalVaultCard({
  vaultItems,
  importantDates,
  pets,
  onOpenAddVault,
  onOpenAddDate,
  onOpenAddPet,
  onRefresh
}: Props) {
  const [tab, setTab] = useState<'vault' | 'dates' | 'pets'>('vault');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  const handleDelete = async (id: string, section: 'vault' | 'date' | 'pet') => {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/digital-vault?id=${id}&section=${section}`, { method: 'DELETE' });
      const j = await res.json();
      if (j.success) onRefresh();
    } catch {
      alert('Silme hatası.');
    }
  };

  // Filtreleme mantığı
  const filteredVault = vaultItems.filter(item => {
    const matchesSearch = (item.title + ' ' + (item.owner || '') + ' ' + (item.document_number || '') + ' ' + (item.notes || ''))
      .toLowerCase().includes(searchQuery.toLowerCase());
    
    if (categoryFilter === 'passport_id') return matchesSearch && (item.type === 'passport' || item.type === 'id_card');
    if (categoryFilter === 'deed_contract') return matchesSearch && (item.type === 'title_deed' || item.type === 'contract');
    if (categoryFilter === 'insurance_warranty') return matchesSearch && (item.type === 'insurance' || item.type === 'warranty' || item.type === 'license');
    return matchesSearch;
  });

  const filteredDates = importantDates.filter(d => 
    (d.title + ' ' + d.person_name + ' ' + (d.gift_ideas || '') + ' ' + (d.notes || ''))
      .toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPets = pets.filter(p =>
    (p.name + ' ' + p.species + ' ' + (p.breed || '') + ' ' + (p.chip_no || '') + ' ' + (p.vet_name || ''))
      .toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="card">
      {/* Üst Kart Başlık */}
      <div className="card-title-row">
        <div className="card-title">
          <span>🗂️</span>
          <span>Dijital Kasa & Önemli Günler</span>
        </div>
      </div>

      <div className="card-action-bar">
        {tab === 'vault' && (
          <>
            <button
              className="btn-subtle"
              onClick={() => onOpenAddVault()}
            >
              📸 Fotoğraf Tara (AI)
            </button>
            <button className="btn-primary" onClick={() => onOpenAddVault()}>
              + Manuel Ekle
            </button>
          </>
        )}
        {tab === 'dates' && (
          <button className="btn-primary" onClick={() => onOpenAddDate()}>
            + Yeni Gün Ekle
          </button>
        )}
        {tab === 'pets' && (
          <button className="btn-primary" onClick={() => onOpenAddPet()}>
            + Yeni Karne Ekle
          </button>
        )}
      </div>

      {/* Ana Sekme Seçici */}
      <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', marginBottom: '14px' }}>
        <button
          className={`choice-pill ${tab === 'vault' ? 'selected' : ''}`}
          onClick={() => setTab('vault')}
          style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 800 }}
        >
          📁 Dijital Kasa ({vaultItems.length})
        </button>
        <button
          className={`choice-pill ${tab === 'dates' ? 'selected' : ''}`}
          onClick={() => setTab('dates')}
          style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 800 }}
        >
          🎂 Önemli Günler ({importantDates.length})
        </button>
        <button
          className={`choice-pill ${tab === 'pets' ? 'selected' : ''}`}
          onClick={() => setTab('pets')}
          style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 800 }}
        >
          🐾 Evcil Hayvan Karnesi ({pets.length})
        </button>
      </div>

      {/* Arama & Kategori Filtreleme Çubuğu */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder={tab === 'vault' ? '🔍 Belge, kisi veya seri no ara...' : tab === 'dates' ? '🔍 Kişi, doğum günü veya hediye ara...' : '🔍 Evcil hayvan, çip no veya veteriner ara...'}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '8px 12px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
        />

        {tab === 'vault' && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setCategoryFilter('all')}
              style={{
                padding: '4px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                border: categoryFilter === 'all' ? '1px solid #4F46E5' : '1px solid var(--border)',
                background: categoryFilter === 'all' ? '#EEF2FF' : 'white',
                color: categoryFilter === 'all' ? '#4F46E5' : 'var(--text-main)', cursor: 'pointer'
              }}
            >
              Tümü
            </button>
            <button
              onClick={() => setCategoryFilter('passport_id')}
              style={{
                padding: '4px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                border: categoryFilter === 'passport_id' ? '1px solid #4F46E5' : '1px solid var(--border)',
                background: categoryFilter === 'passport_id' ? '#EEF2FF' : 'white',
                color: categoryFilter === 'passport_id' ? '#4F46E5' : 'var(--text-main)', cursor: 'pointer'
              }}
            >
              🛂 Pasaport & Kimlik
            </button>
            <button
              onClick={() => setCategoryFilter('deed_contract')}
              style={{
                padding: '4px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                border: categoryFilter === 'deed_contract' ? '1px solid #4F46E5' : '1px solid var(--border)',
                background: categoryFilter === 'deed_contract' ? '#EEF2FF' : 'white',
                color: categoryFilter === 'deed_contract' ? '#4F46E5' : 'var(--text-main)', cursor: 'pointer'
              }}
            >
              🏠 Tapu & Kontrat
            </button>
            <button
              onClick={() => setCategoryFilter('insurance_warranty')}
              style={{
                padding: '4px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                border: categoryFilter === 'insurance_warranty' ? '1px solid #4F46E5' : '1px solid var(--border)',
                background: categoryFilter === 'insurance_warranty' ? '#EEF2FF' : 'white',
                color: categoryFilter === 'insurance_warranty' ? '#4F46E5' : 'var(--text-main)', cursor: 'pointer'
              }}
            >
              🏥 Sigorta & Garanti
            </button>
          </div>
        )}
      </div>

      {/* 1. DİJİTAL KASA LİSTESİ */}
      {tab === 'vault' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredVault.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Kayıtlı belge bulunmuyor.
            </div>
          ) : (
            filteredVault.map(item => {
              const icon = TYPE_ICONS[item.type] || '📁';
              const label = TYPE_LABELS[item.type] || 'Diğer';

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '12px',
                    background: item.alert_level === 'critical' ? '#FEF2F2' : item.alert_level === 'warning' ? '#FFFBEB' : 'var(--surface-subtle)',
                    border: item.alert_level === 'critical' ? '1px solid rgba(239,68,68,0.4)' : item.alert_level === 'warning' ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {/* Pasaport Vize Uyarısı */}
                  {item.visa_warning && (
                    <div style={{ background: '#DC2626', color: 'white', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚠️ PASAPORT UYARISI:</span>
                      <span>Son 6 aydan (180 gün) az kaldı! Birçok ülke vize vermez / seyahat edilemez!</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '24px' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '6px', flexWrap: 'wrap', fontWeight: 600 }}>
                          <span>👤 {item.owner}</span>
                          <span>•</span>
                          <span>🏷️ {label}</span>
                          {item.issuer && <span>• {item.issuer}</span>}
                          {item.document_number && <span>• No: {item.document_number}</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      {item.days_left !== null && (
                        <span style={{
                          fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--radius-full)',
                          background: item.alert_level === 'critical' ? '#FCA5A5' : item.alert_level === 'warning' ? '#FDE68A' : '#D1FAE5',
                          color: item.alert_level === 'critical' ? '#991B1B' : item.alert_level === 'warning' ? '#92400E' : '#065F46'
                        }}>
                          {item.days_left <= 0 ? '🔴 Süresi Doldu' : `${item.days_left} Gün Kaldı`}
                        </span>
                      )}
                      {item.expiry_date && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Son Tarih: {item.expiry_date}
                        </div>
                      )}
                    </div>
                  </div>

                  {item.notes && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'white', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                      📝 {item.notes}
                    </div>
                  )}

                  {/* Belge Görseli / PDF ve Düzenle/Sil Butonları */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
                    <div>
                      {item.document_image_url ? (
                        <button
                          type="button"
                          onClick={() => setPreviewDocUrl(item.document_image_url || null)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE',
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          🖼️ Yüklü Belgeyi Gör / İndir
                        </button>
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Ek belge görseli yok</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => onOpenAddVault(item)}
                        style={{ fontSize: '11px', padding: '3px 8px', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ✏️ Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, 'vault')}
                        style={{ fontSize: '11px', padding: '3px 8px', background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        🗑️ Sil
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. ÖNEMLİ GÜNLER LİSTESİ */}
      {tab === 'dates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredDates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Kayıtlı önemli gün bulunmuyor.
            </div>
          ) : (
            filteredDates.map(item => {
              const icon = EVENT_ICONS[item.event_type] || '📅';

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '12px',
                    background: item.days_left <= 7 ? '#FFFBEB' : 'var(--surface-subtle)',
                    border: item.days_left <= 7 ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '24px' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {item.title} ({item.person_name})
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                          Tarih: {item.event_date} (Gelecek: {item.next_date})
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--radius-full)',
                      background: item.days_left <= 7 ? '#FDE68A' : '#E0E7FF',
                      color: item.days_left <= 7 ? '#92400E' : '#3730A3'
                    }}>
                      {item.days_left === 0 ? '🎉 Bugün!' : `${item.days_left} Gün Kaldı`}
                    </span>
                  </div>

                  {/* Hediye Fikirleri Defteri Koyu Sarı Kutu */}
                  {item.gift_ideas && (
                    <div style={{ background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.3)', padding: '8px 10px', borderRadius: '6px', fontSize: '11px', color: '#92400E' }}>
                      🎁 <strong>Hediye Fikirleri & Notlar:</strong> {item.gift_ideas}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => onOpenAddDate(item)}
                      style={{ fontSize: '11px', padding: '3px 8px', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✏️ Düzenle / Hediye Ekle
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, 'date')}
                      style={{ fontSize: '11px', padding: '3px 8px', background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      🗑️ Sil
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. EVCİL HAYVAN KARNESİ */}
      {tab === 'pets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredPets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Kayıtlı evcil hayvan karnesi bulunmuyor.
            </div>
          ) : (
            filteredPets.map(pet => {
              const icon = pet.species === 'Kedi' ? '🐱' : pet.species === 'Köpek' ? '🐶' : pet.species === 'Kuş' ? '🦜' : '🐾';

              return (
                <div
                  key={pet.id}
                  style={{
                    padding: '12px',
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '28px' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {pet.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '6px', fontWeight: 600 }}>
                          <span>Tür: {pet.species}</span>
                          {pet.breed && <span>• Cins: {pet.breed}</span>}
                          {pet.chip_no && <span>• Çip No: {pet.chip_no}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {pet.vet_next_date && (
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', color: '#166534', fontWeight: 700 }}>
                      🩺 Gelecek Veteriner / Aşı Randevusu: {pet.vet_next_date} {pet.vet_name ? `(${pet.vet_name})` : ''}
                    </div>
                  )}

                  {pet.vaccinations && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'white', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                      💉 <strong>Aşılar & Notlar:</strong> {pet.vaccinations}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => onOpenAddPet(pet)}
                      style={{ fontSize: '11px', padding: '3px 8px', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✏️ Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(pet.id, 'pet')}
                      style={{ fontSize: '11px', padding: '3px 8px', background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      🗑️ Sil
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Belge Fotoğrafı / PDF Önizleme Modalı */}
      {previewDocUrl && (
        <div className="modal-overlay" onClick={() => setPreviewDocUrl(null)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '16px', fontWeight: 800 }}>🖼️ Belge Önizleme</div>
              <button type="button" onClick={() => setPreviewDocUrl(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ textAlign: 'center', margin: '10px 0' }}>
              {previewDocUrl.endsWith('.pdf') ? (
                <iframe src={previewDocUrl} style={{ width: '100%', height: '450px', border: 'none', borderRadius: '8px' }} title="PDF Belge" />
              ) : (
                <img src={previewDocUrl} alt="Belge" style={{ maxWidth: '100%', maxHeight: '450px', borderRadius: '8px', objectFit: 'contain' }} />
              )}
            </div>

            <div style={{ textAlign: 'right', marginTop: '12px' }}>
              <a
                href={previewDocUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{ textDecoration: 'none', display: 'inline-block', padding: '8px 16px', fontSize: '13px' }}
              >
                ⬇️ Cihaza İndir
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
