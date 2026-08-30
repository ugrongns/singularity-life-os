'use client';
import { useState } from 'react';

interface Pet {
  id?: string;
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

interface AddPetModalProps {
  isOpen: boolean;
  item?: Pet | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddPetModal({ isOpen, item, onClose, onSuccess }: AddPetModalProps) {
  const isEditing = Boolean(item?.id);
  const [name, setName] = useState(item?.name || '');
  const [species, setSpecies] = useState(item?.species || 'Kedi');
  const [breed, setBreed] = useState(item?.breed || '');
  const [birthDate, setBirthDate] = useState(item?.birth_date || '');
  const [chipNo, setChipNo] = useState(item?.chip_no || '');
  const [vetName, setVetName] = useState(item?.vet_name || '');
  const [vetPhone, setVetPhone] = useState(item?.vet_phone || '');
  const [vetNextDate, setVetNextDate] = useState(item?.vet_next_date || '');
  const [vaccinations, setVaccinations] = useState(item?.vaccinations || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch('/api/digital-vault', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'pet',
          id: item?.id,
          name,
          species,
          breed,
          birth_date: birthDate,
          chip_no: chipNo,
          vet_name: vetName,
          vet_phone: vetPhone,
          vet_next_date: vetNextDate,
          vaccinations,
          notes
        })
      });

      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        onSuccess(isEditing ? '🐾 Evcil hayvan karnesi güncellendi!' : '🐾 Evcil hayvan karnesi eklendi!');
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
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
            {isEditing ? '✏️ Evcil Hayvan Karnesini Düzenle' : '🐾 Yeni Evcil Hayvan Karnesi Ekle'}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>İSİM *</label>
            <input
              type="text"
              placeholder="Ör. Pamuk, Maya, Paşa"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>TÜR *</label>
              <select
                value={species}
                onChange={e => setSpecies(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              >
                <option value="Kedi">🐱 Kedi</option>
                <option value="Köpek">🐶 Köpek</option>
                <option value="Kuş">🦜 Kuş</option>
                <option value="Diğer">🐾 Diğer</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>IRK / CİNS</label>
              <input
                type="text"
                placeholder="Ör. British Shorthair, Golden"
                value={breed}
                onChange={e => setBreed(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ÇİP NUMARASI</label>
              <input
                type="text"
                placeholder="Ör. 984000123456789"
                value={chipNo}
                onChange={e => setChipNo(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>GELECEK VETERİNER / AŞI TARİHİ</label>
              <input
                type="date"
                value={vetNextDate}
                onChange={e => setVetNextDate(e.target.value)}
                style={{ width: '100%', padding: '7px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>VETERİNER ADI / KLİNİK</label>
              <input
                type="text"
                placeholder="Ör. Pati Veteriner Kliniği"
                value={vetName}
                onChange={e => setVetName(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>VETERİNER TELEFON</label>
              <input
                type="tel"
                placeholder="Ör. 0555 123 45 67"
                value={vetPhone}
                onChange={e => setVetPhone(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>AŞI TAKVİMİ & SAĞLIK NOTLARI</label>
            <textarea
              rows={3}
              placeholder="Karma Aşı: 15 Mayıs, Kuduz: 20 Haziran, Alerjisi var..."
              value={vaccinations}
              onChange={e => setVaccinations(e.target.value)}
              style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : isEditing ? '💾 Güncelle' : '➕ Karne Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}
