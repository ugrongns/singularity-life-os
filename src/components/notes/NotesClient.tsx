'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Pin,
  Archive,
  Trash2,
  FolderPlus,
  Eye,
  Edit3,
  ArrowLeft,
  Save,
  Users,
  Lock
} from 'lucide-react';
import { matchesTurkishQuery, toTurkeyDay } from '@/lib/date-utils';
import {
  NOTE_TEMPLATES,
  NoteTemplate,
  estimateReadingMinutes,
  extractNoteSnippet,
  parseTagsJson,
  parseSafeMarkdownBlocks
} from '@/lib/notes-utils';
import PageLoadingState from '@/components/ui/PageLoadingState';

interface NoteItem {
  id: string;
  folder_id?: string | null;
  title: string;
  content: string;
  tags_json: string;
  is_pinned: number;
  is_archived: number;
  is_family_shared: number;
  linked_book_id?: string | null;
  linked_task_id?: string | null;
  linked_sinking_fund_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface FolderItem {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export default function NotesClient() {
  const [loading, setLoading] = useState(true);
  const [notesList, setNotesList] = useState<NoteItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [linkableBooks, setLinkableBooks] = useState<Array<{ id: string; title: string }>>([]);
  const [linkableTasks, setLinkableTasks] = useState<Array<{ id: string; title: string }>>([]);
  const [linkableFunds, setLinkableFunds] = useState<Array<{ id: string; name: string }>>([]);

  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all'); // 'all' | 'pinned' | 'archived' | folderId
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);

  // Editör state'i
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftTagsInput, setDraftTagsInput] = useState('');
  const [draftFolderId, setDraftFolderId] = useState<string>('');
  const [draftFamilyShared, setDraftFamilyShared] = useState(false);
  const [draftLinkedBookId, setDraftLinkedBookId] = useState<string>('');
  const [draftLinkedTaskId, setDraftLinkedTaskId] = useState<string>('');
  const [draftLinkedFundId, setDraftLinkedFundId] = useState<string>('');
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Klasör ekleme
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes');
      const json = await res.json();
      if (json.success && json.data) {
        const fetchedNotes: NoteItem[] = json.data.notes || [];
        setNotesList(fetchedNotes);
        setFolders(json.data.folders || []);
        setLinkableBooks(json.data.linkableBooks || []);
        setLinkableTasks(json.data.linkableTasks || []);
        setLinkableFunds(json.data.linkableFunds || []);
        if (fetchedNotes.length > 0 && !activeNoteId) {
          loadNoteIntoEditor(fetchedNotes[0]);
        }
      }
    } catch {
      showToast('Notlar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [activeNoteId]);

  useEffect(() => {
    void fetchNotes();
    const onRefresh = () => void fetchNotes();
    window.addEventListener('singularity-refresh', onRefresh);
    return () => window.removeEventListener('singularity-refresh', onRefresh);
  }, [fetchNotes]);

  const loadNoteIntoEditor = (note: NoteItem) => {
    setActiveNoteId(note.id);
    setDraftTitle(note.title);
    setDraftContent(note.content);
    setDraftTagsInput(parseTagsJson(note.tags_json).join(', '));
    setDraftFolderId(note.folder_id || '');
    setDraftFamilyShared(note.is_family_shared === 1);
    setDraftLinkedBookId(note.linked_book_id || '');
    setDraftLinkedTaskId(note.linked_task_id || '');
    setDraftLinkedFundId(note.linked_sinking_fund_id || '');
    setPreviewMode(false);
  };

  const handleCreateFromTemplate = async (tmpl: NoteTemplate) => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_note',
        title: tmpl.defaultTitle,
        content: tmpl.content,
        folder_id: !['all', 'pinned', 'archived'].includes(selectedFolderFilter) ? selectedFolderFilter : null
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      setActiveNoteId(json.id);
      setIsMobileEditorOpen(true);
      await fetchNotes();
      const created = (await (await fetch('/api/notes')).json())?.data?.notes?.find((n: NoteItem) => n.id === json.id);
      if (created) loadNoteIntoEditor(created);
    }
  };

  const handleSaveNote = async () => {
    if (!activeNoteId || saving) return;
    setSaving(true);
    try {
      const tags = draftTagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_note',
          id: activeNoteId,
          title: draftTitle,
          content: draftContent,
          tags,
          folder_id: draftFolderId || null,
          is_family_shared: draftFamilyShared ? 1 : 0,
          linked_book_id: draftLinkedBookId || null,
          linked_task_id: draftLinkedTaskId || null,
          linked_sinking_fund_id: draftLinkedFundId || null
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast('✅ Not kaydedildi.');
        await fetchNotes();
      } else {
        showToast(json.error || 'Not kaydedilemedi.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (noteId: string) => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_pin', id: noteId })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      await fetchNotes();
    }
  };

  const handleToggleArchive = async (noteId: string) => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_archive', id: noteId })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      await fetchNotes();
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Bu notu kalıcı olarak silmek istediğinize emin misiniz?')) return;
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_note', id: noteId })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      setActiveNoteId(null);
      setIsMobileEditorOpen(false);
      await fetchNotes();
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_folder', name: newFolderName.trim() })
    });
    const json = await res.json();
    if (json.success) {
      setNewFolderName('');
      setShowFolderForm(false);
      showToast(json.message);
      await fetchNotes();
    }
  };

  const insertMarkdownSnippet = (prefix: string) => {
    setDraftContent(prev => (prev ? `${prev}\n${prefix}` : prefix));
    textareaRef.current?.focus();
  };

  const filteredNotes = useMemo(() => {
    return notesList.filter(n => {
      if (selectedFolderFilter === 'archived') {
        if (n.is_archived !== 1) return false;
      } else {
        if (n.is_archived === 1) return false;
        if (selectedFolderFilter === 'pinned' && n.is_pinned !== 1) return false;
        if (!['all', 'pinned', 'archived'].includes(selectedFolderFilter) && n.folder_id !== selectedFolderFilter) {
          return false;
        }
      }
      return matchesTurkishQuery(searchQuery, [n.title, n.content, n.tags_json]);
    });
  }, [notesList, selectedFolderFilter, searchQuery]);

  const activeNote = notesList.find(n => n.id === activeNoteId) || null;
  const markdownBlocks = useMemo(() => parseSafeMarkdownBlocks(draftContent), [draftContent]);

  if (loading) {
    return (
      <PageLoadingState
        icon="📝"
        title="İkinci Beyin & Notlar Yükleniyor..."
        description="Klasörler, Markdown notlar ve kitap/görev bağlantıları hazırlanıyor"
        color="#6366F1"
      />
    );
  }

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {toastMsg && (
        <div className="toast-glass" role="status" aria-live="polite" style={{ zIndex: 1100 }}>
          {toastMsg}
        </div>
      )}

      {/* Üst Başlık & Şablonla Hızlı Oluştur */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '21px', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
            📝 İkinci Beyin &amp; Markdown Notlar
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Klasörlü notlar, 4 şablon, kitap alıntısı ve görev/birikim bağlantıları
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {NOTE_TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => void handleCreateFromTemplate(t)}
              className={t.id === 'blank' ? 'btn-primary' : 'btn-subtle'}
              style={{
                padding: '7px 11px',
                fontSize: '11px',
                fontWeight: 800,
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>{t.icon}</span>
              <span>{t.id === 'blank' ? '+ Boş Not' : t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Klasör Şeridi */}
      <div className="no-scrollbar" style={{ display: 'flex', gap: '6px', alignItems: 'center', overflowX: 'auto', paddingBottom: '2px' }}>
        {[
          { id: 'all', label: '📚 Tüm Notlar' },
          { id: 'pinned', label: '📌 Sabitlenenler' },
          { id: 'archived', label: '📦 Arşiv' }
        ].map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelectedFolderFilter(f.id)}
            style={{
              padding: '5px 11px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 800,
              border: `1px solid ${selectedFolderFilter === f.id ? '#6366F1' : 'var(--border)'}`,
              background: selectedFolderFilter === f.id ? 'rgba(99, 102, 241, 0.14)' : 'var(--surface-subtle)',
              color: selectedFolderFilter === f.id ? '#6366F1' : 'var(--text-main)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              cursor: 'pointer'
            }}
          >
            {f.label}
          </button>
        ))}

        {folders.map(folder => (
          <button
            key={folder.id}
            type="button"
            onClick={() => setSelectedFolderFilter(folder.id)}
            style={{
              padding: '5px 11px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 800,
              border: `1px solid ${selectedFolderFilter === folder.id ? folder.color : 'var(--border)'}`,
              background: selectedFolderFilter === folder.id ? 'rgba(99, 102, 241, 0.14)' : 'var(--surface-subtle)',
              color: selectedFolderFilter === folder.id ? folder.color : 'var(--text-main)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              cursor: 'pointer'
            }}
          >
            {folder.icon} {folder.name}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setShowFolderForm(prev => !prev)}
          style={{
            padding: '5px 10px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 700,
            border: '1px dashed var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            cursor: 'pointer'
          }}
        >
          <FolderPlus size={13} /> Klasör
        </button>
      </div>

      {showFolderForm && (
        <form onSubmit={handleCreateFolder} style={{ display: 'flex', gap: '8px', maxWidth: '360px' }}>
          <input
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Yeni klasör adı..."
            className="input"
            style={{ flex: 1, fontSize: '12px' }}
          />
          <button type="submit" className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 800 }}>
            Ekle
          </button>
        </form>
      )}

      {/* Split View: Sol Liste + Sağ Editör */}
      <div className="notes-split-grid">
        {/* SOL SÜTUN: Not Listesi */}
        <div className={`notes-list-pane card ${isMobileEditorOpen ? 'is-mobile-hidden' : ''}`} style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Notlarda veya etiketlerde ara..."
              className="input"
              style={{ width: '100%', paddingLeft: '30px', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '62vh', overflowY: 'auto' }}>
            {filteredNotes.length === 0 ? (
              <div style={{ padding: '28px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                Bu görünümde henüz not yok. Yukarıdan bir şablon seçerek başlayabilirsiniz.
              </div>
            ) : (
              filteredNotes.map(n => {
                const isSelected = n.id === activeNoteId;
                const tags = parseTagsJson(n.tags_json);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      loadNoteIntoEditor(n);
                      setIsMobileEditorOpen(true);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: `1px solid ${isSelected ? '#6366F1' : 'var(--border)'}`,
                      background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--surface-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.is_pinned === 1 && '📌 '}
                        {n.title}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {n.is_family_shared === 1 ? '👨‍👩‍👧' : '🔒'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {extractNoteSnippet(n.content, 72) || 'Boş içerik...'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                      <span>{toTurkeyDay(n.updated_at) || ''} • {estimateReadingMinutes(n.content)} dk</span>
                      {tags.length > 0 && <span>#{tags[0]}</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* SAĞ SÜTUN: Markdown Editör & Önizleme */}
        <div className={`notes-editor-pane card ${!isMobileEditorOpen ? 'is-mobile-hidden' : ''}`} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!activeNote ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Düzenlemek için soldan bir not seçin veya yukarıdan yeni not oluşturun.
            </div>
          ) : (
            <>
              {/* Editör Üst Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setIsMobileEditorOpen(false)}
                  className="notes-mobile-back-btn btn-subtle"
                  style={{ display: 'none', padding: '5px 10px', fontSize: '11px', fontWeight: 800, alignItems: 'center', gap: '4px' }}
                >
                  <ArrowLeft size={14} /> Liste
                </button>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(prev => !prev)}
                    className="btn-subtle"
                    style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {previewMode ? <Edit3 size={13} /> : <Eye size={13} />}
                    <span>{previewMode ? 'Düzenle' : 'Önizle'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftFamilyShared(prev => !prev)}
                    style={{
                      padding: '6px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: `1px solid ${draftFamilyShared ? '#10B981' : 'var(--border)'}`,
                      background: draftFamilyShared ? 'var(--emerald-bg)' : 'var(--surface-subtle)',
                      color: draftFamilyShared ? '#10B981' : 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {draftFamilyShared ? <Users size={13} /> : <Lock size={13} />}
                    <span>{draftFamilyShared ? 'Aileyle Paylaşılıyor' : 'Kişisel'}</span>
                  </button>
                  <button type="button" onClick={() => handleTogglePin(activeNote.id)} className="btn-subtle" style={{ padding: '6px 8px' }} title="Sabitle">
                    <Pin size={14} />
                  </button>
                  <button type="button" onClick={() => handleToggleArchive(activeNote.id)} className="btn-subtle" style={{ padding: '6px 8px' }} title="Arşivle">
                    <Archive size={14} />
                  </button>
                  <button type="button" onClick={() => handleDeleteNote(activeNote.id)} className="btn-subtle" style={{ padding: '6px 8px', color: '#DC2626' }} title="Sil">
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveNote}
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Save size={14} />
                    <span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
                  </button>
                </div>
              </div>

              {/* Başlık & Meta */}
              <input
                type="text"
                value={draftTitle}
                onChange={e => setDraftTitle(e.target.value)}
                placeholder="Not başlığı..."
                style={{
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  padding: '6px 2px',
                  fontSize: '18px',
                  fontWeight: 900,
                  background: 'transparent',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px' }}>
                <input
                  type="text"
                  value={draftTagsInput}
                  onChange={e => setDraftTagsInput(e.target.value)}
                  placeholder="Etiketler (virgülle: fikir, okuma)"
                  className="input"
                  style={{ fontSize: '11px' }}
                />
                <select value={draftFolderId} onChange={e => setDraftFolderId(e.target.value)} className="input" style={{ fontSize: '11px' }}>
                  <option value="">Klasörsüz</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
                  ))}
                </select>
                <select value={draftLinkedBookId} onChange={e => setDraftLinkedBookId(e.target.value)} className="input" style={{ fontSize: '11px' }}>
                  <option value="">📚 Kitap Bağla (Yok)</option>
                  {linkableBooks.map(b => (
                    <option key={b.id} value={b.id}>📚 {b.title}</option>
                  ))}
                </select>
                <select value={draftLinkedTaskId} onChange={e => setDraftLinkedTaskId(e.target.value)} className="input" style={{ fontSize: '11px' }}>
                  <option value="">✅ Görev Bağla (Yok)</option>
                  {linkableTasks.map(t => (
                    <option key={t.id} value={t.id}>✅ {t.title}</option>
                  ))}
                </select>
                <select value={draftLinkedFundId} onChange={e => setDraftLinkedFundId(e.target.value)} className="input" style={{ fontSize: '11px' }}>
                  <option value="">🎯 Hedef Bağla (Yok)</option>
                  {linkableFunds.map(f => (
                    <option key={f.id} value={f.id}>🎯 {f.name}</option>
                  ))}
                </select>
              </div>

              {/* Yatay Markdown Araç Çubuğu */}
              {!previewMode && (
                <div className="no-scrollbar" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                  {[
                    { label: 'H1', snip: '# ' },
                    { label: 'H2', snip: '## ' },
                    { label: 'Alıntı', snip: '> ' },
                    { label: '• Liste', snip: '- ' },
                    { label: '☑ Görev', snip: '- [ ] ' }
                  ].map(tool => (
                    <button
                      key={tool.label}
                      type="button"
                      onClick={() => insertMarkdownSnippet(tool.snip)}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)',
                        color: 'var(--text-main)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Editör veya Güvenli React Markdown Önizleme */}
              {previewMode ? (
                <div
                  style={{
                    minHeight: '340px',
                    padding: '14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    lineHeight: 1.55
                  }}
                >
                  {markdownBlocks.map((b, idx) => {
                    if (b.type === 'spacer') return <div key={idx} style={{ height: '6px' }} />;
                    if (b.type === 'h1') return <h1 key={idx} style={{ fontSize: '19px', fontWeight: 900, margin: '4px 0' }}>{b.text}</h1>;
                    if (b.type === 'h2') return <h2 key={idx} style={{ fontSize: '16px', fontWeight: 800, margin: '4px 0' }}>{b.text}</h2>;
                    if (b.type === 'h3') return <h3 key={idx} style={{ fontSize: '14px', fontWeight: 800, margin: '2px 0' }}>{b.text}</h3>;
                    if (b.type === 'quote') return <blockquote key={idx} style={{ margin: '4px 0', padding: '6px 12px', borderLeft: '3px solid #6366F1', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '6px', fontSize: '13px' }}>{b.text}</blockquote>;
                    if (b.type === 'checklist') return <div key={idx} style={{ fontSize: '13px', display: 'flex', gap: '6px' }}><span>{b.checked ? '☑️' : '⬜'}</span><span style={{ textDecoration: b.checked ? 'line-through' : 'none' }}>{b.text}</span></div>;
                    if (b.type === 'bullet') return <div key={idx} style={{ fontSize: '13px', paddingLeft: '8px' }}>• {b.text}</div>;
                    return <p key={idx} style={{ margin: 0, fontSize: '13px' }}>{b.text}</p>;
                  })}
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={draftContent}
                  onChange={e => setDraftContent(e.target.value)}
                  placeholder="Markdown formatında notlarınızı yazın... (# Başlık, > Alıntı, - [ ] Yapılacak)"
                  rows={14}
                  style={{
                    width: '100%',
                    minHeight: '340px',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    lineHeight: 1.55,
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .notes-split-grid {
          display: grid;
          grid-template-columns: 330px minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }
        @media (max-width: 959px) {
          .notes-split-grid {
            grid-template-columns: 1fr;
          }
          .is-mobile-hidden {
            display: none !important;
          }
          .notes-mobile-back-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
}
