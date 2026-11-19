// Singularity Life OS — İkinci Beyin & Markdown Notlar Yardımcıları (XSS Korumalı)

export interface NoteTemplate {
  id: 'blank' | 'book_summary' | 'journal' | 'project';
  label: string;
  icon: string;
  defaultTitle: string;
  content: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    label: 'Boş Not',
    icon: '📝',
    defaultTitle: 'Yeni Not',
    content: ''
  },
  {
    id: 'book_summary',
    label: 'Kitap Özeti & Çıkarımlar',
    icon: '📚',
    defaultTitle: 'Kitap Özeti:',
    content: `# Ana Fikir\n- Kitabın temel tezi nedir?\n\n## Öne Çıkan 3 Çıkarım\n1. \n2. \n3. \n\n## Uygulanacak Aksiyonlar\n- [ ] `
  },
  {
    id: 'journal',
    label: 'Günlük Journal',
    icon: '📓',
    defaultTitle: 'Günlük Yansıma',
    content: `# Bugün Neler Oldu?\n\n## Şükran & Kazanımlar\n- \n\n## Yarın İçin Tek Öncelik\n- [ ] `
  },
  {
    id: 'project',
    label: 'Proje Taslağı',
    icon: '🚀',
    defaultTitle: 'Proje Taslağı:',
    content: `# Amaç & Kapsam\n\n## Kilometre Taşları\n- [ ] Faz 1: \n- [ ] Faz 2: \n\n## Riskler & Notlar\n> `
  }
];

export function estimateReadingMinutes(content: string): number {
  const words = content
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function extractNoteSnippet(content: string, maxLength: number = 110): string {
  const plain = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength)}...`;
}

export function parseTagsJson(tagsJson?: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const arr = JSON.parse(tagsJson);
    if (!Array.isArray(arr)) return [];
    return arr.map(t => String(t).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export type MarkdownBlock =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'checklist'; checked: boolean; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'spacer' };

/**
 * XSS güvenliği için dangerouslySetInnerHTML kullanmadan Markdown metnini yapısal bloklara ayırır.
 */
export function parseSafeMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = (markdown || '').split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      blocks.push({ type: 'spacer' });
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
    } else if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2).trim() });
    } else if (line.startsWith('> ')) {
      blocks.push({ type: 'quote', text: line.slice(2).trim() });
    } else if (/^- \[( |x|X)\]\s*/.test(line)) {
      const checked = /^- \[(x|X)\]/.test(line);
      blocks.push({ type: 'checklist', checked, text: line.replace(/^- \[( |x|X)\]\s*/, '') });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({ type: 'bullet', text: line.slice(2).trim() });
    } else {
      blocks.push({ type: 'paragraph', text: line });
    }
  }

  return blocks;
}
