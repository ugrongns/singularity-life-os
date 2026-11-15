import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('🎨 Singularity UI: Sayfa Açılış Animasyonları & Yükleme Mimarisi Doğrulama', () => {
  const srcAppDir = path.resolve(__dirname, '../src/app');

  it('Kök loading.tsx (Sistem Açılışı) dosyası mevcut olmalı ve PageLoadingState içermelidir', () => {
    const loadingPath = path.join(srcAppDir, 'loading.tsx');
    expect(fs.existsSync(loadingPath)).toBe(true);

    const content = fs.readFileSync(loadingPath, 'utf-8');
    expect(content).toContain('PageLoadingState');
    expect(content).toContain('Singularity Life OS Başlatılıyor...');
    expect(content).toContain('fullScreen={true}');
  });

  it('PageLoadingState bileşeni ve gerekli animasyon sınıfları tanımlı olmalıdır', () => {
    const componentPath = path.resolve(__dirname, '../src/components/ui/PageLoadingState.tsx');
    expect(fs.existsSync(componentPath)).toBe(true);

    const cssPath = path.resolve(__dirname, '../src/styles/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    expect(cssContent).toContain('@keyframes floatGlow');
    expect(cssContent).toContain('@keyframes shimmerBar');
    expect(cssContent).toContain('@keyframes iconPulse');
  });

  it('Tüm temel modül sayfaları (Bütçe, Sağlık, Kütüphane, Görevler vb.) PageLoadingState kullanmalıdır', () => {
    const modulePages = [
      { name: 'budget', file: path.join(srcAppDir, 'budget/page.tsx'), icon: '💰', color: '#10B981' },
      { name: 'health', file: path.join(srcAppDir, 'health/page.tsx'), icon: '🧬', color: '#EF4444' },
      { name: 'library', file: path.join(srcAppDir, 'library/page.tsx'), icon: '📚', color: '#3B82F6' },
      { name: 'tasks', file: path.join(srcAppDir, 'tasks/page.tsx'), icon: '🎯', color: '#F59E0B' },
      { name: 'vehicles', file: path.join(srcAppDir, 'vehicles/page.tsx'), icon: '🚗', color: '#06B6D4' },
      { name: 'vault', file: path.join(srcAppDir, 'vault/page.tsx'), icon: '🔒', color: '#6366F1' },
      { name: 'shopping', file: path.join(srcAppDir, 'shopping/page.tsx'), icon: '🛒', color: '#F59E0B' },
      { name: 'analytics', file: path.join(srcAppDir, 'analytics/page.tsx'), icon: '📊', color: '#10B981' },
      { name: 'settings', file: path.join(srcAppDir, 'settings/page.tsx'), icon: '⚙️', color: '#6B7280' },
    ];

    for (const mod of modulePages) {
      expect(fs.existsSync(mod.file)).toBe(true);
      const content = fs.readFileSync(mod.file, 'utf-8');
      expect(content).toContain('PageLoadingState');
      expect(content).toContain(mod.icon);
      expect(content).toContain(mod.color);
    }
  });

  it('WellnessTrackerClient bileşeni PageLoadingState kullanmalıdır', () => {
    const wellnessClientPath = path.resolve(__dirname, '../src/components/wellness/WellnessTrackerClient.tsx');
    expect(fs.existsSync(wellnessClientPath)).toBe(true);

    const content = fs.readFileSync(wellnessClientPath, 'utf-8');
    expect(content).toContain('PageLoadingState');
    expect(content).toContain('✨');
    expect(content).toContain('#8B5CF6');
  });
});
