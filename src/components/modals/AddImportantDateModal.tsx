'use client';
import { useState } from 'react';

interface ImportantDate {
  id?: string;
  title: string;
  person_name: string;
  event_type: string;
  event_date: string;
  remind_days_before?: number;
  gift_ideas?: string;
  notes?: string;
}

interface AddImportantDateModalProps {
  isOpen: boolean;
  item?: ImportantDate | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddImportantDateModal({ isOpen, item, onClose, onSuccess }: AddImportantDateModalProps) {
  const isEditing = Boolean(item?.id);
  const [title, setTitle] = useState(item?.title || '');
  const [personName, setPersonName] = useState(item?.person_name || '');
  const [eventType, setEventType] = useState(item?.event_type || 'birthday');
  const [eventDate, setEventDate] = useState(item?.event_date || '01-01');
  const [remindDaysBefore, setRemindDaysBefore] = useState(String(item?.remind_days_before || 7));
  const [giftIdeas, setGiftIdeas] = useState(item?.gift_ideas || '');
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
          section: 'date',
          id: item?.id,
          title,
          person_name: personName,
          event_type: eventType,
          event_date: eventDate,
          remind_days_before: parseInt(remindDaysBefore) || 7,
          gift_ideas: giftIdeas,
          notes
        })
      });

      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        onSuccess(isEditing ? '🎂 Önemli gün güncellendi!' : '🎂 Yeni önemli gün eklendi!');
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
            {isEditing ? '✏️ Önemli Günü Düzenle' : '🎂 Yeni Önemli Gün / Hatırlatıcı Ekle'}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ETKİNLİK ADI *</label>
            <input
              type="text"
              placeholder="Ör. Doğum Günü, Evlilik Yıldönümü"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KİŞİ / ADİ *</label>
              <input
                type="text"
                placeholder="Ör. Eş, Anne, Mehmet"
                value={personName}
                onChange={e => setPersonName(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>TÜR *</label>
              <select
                value={eventType}
                onChange={e => setEventType(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              >
                <option value="birthday">🎂 Doğum Günü</option>
                <option value="anniversary">💍 Yıldönümü</option>
                <option value="nameday">🌹 İsim Günü / Özel Gün</option>
                <option value="custom">📅 Diğer Hatırlatma</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>TARİH (AY-GÜN Formatında) *</label>
              <input
                type="text"
                placeholder="Ör. 09-15 (15 Eylül)"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>HATIRLAT (GÜN ÖNCE)</label>
              <input
                type="number"
                value={remindDaysBefore}
                onChange={e => setRemindDaysBefore(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          {/* Hediye Fikirleri Defteri */}
          <div style={{ background: 'var(--amber-bg)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--amber)' }}>
            <label style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              🎁 HEDİYE FİKİRLERİ & NOTLAR DEFTERİ
            </label>
            <textarea
              rows={3}
              placeholder="Beğendiği parfüm, kitaplar, saat, almak istediği kulaklık..."
              value={giftIdeas}
              onChange={e => setGiftIdeas(e.target.value)}
              style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text-main)' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : isEditing ? '💾 Güncelle' : '➕ Önemli Gün Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
