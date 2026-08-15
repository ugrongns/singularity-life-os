import { NextResponse } from 'next/server';
import { initDatabase } from '@/db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_PATH = path.join(process.cwd(), 'singularity.db');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

export async function GET() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db') || f.endsWith('.json') || f.endsWith('.enc'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          name: f,
          size_kb: Math.round(stat.size / 1024),
          created_at: stat.birthtime.toISOString(),
          is_encrypted: f.endsWith('.enc')
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const lastBackup = files[0] || null;
    const dbStat = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : null;

    return NextResponse.json({
      success: true,
      data: {
        last_backup: lastBackup,
        backup_count: files.length,
        backups: files.slice(0, 10),
        db_size_kb: dbStat ? Math.round(dbStat.size / 1024) : 0
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    initDatabase();
    const body = await request.json();
    const { action, passphrase } = body;

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');

    if (action === 'backup_db') {
      const backupName = `singularity-backup-${dateStr}-${timeStr}.db`;
      const backupPath = path.join(BACKUP_DIR, backupName);
      fs.copyFileSync(DB_PATH, backupPath);
      const stat = fs.statSync(backupPath);

      cleanOldBackups();

      return NextResponse.json({
        success: true,
        backup: { name: backupName, size_kb: Math.round(stat.size / 1024), created_at: now.toISOString(), is_encrypted: false }
      });
    }

    // AES-256 Şifreli Yedekleme
    if (action === 'encrypted_backup') {
      const secretKey = passphrase || 'SingularityMasterKey2026';
      const backupName = `singularity-aes256-${dateStr}-${timeStr}.enc`;
      const backupPath = path.join(BACKUP_DIR, backupName);

      const dbBuffer = fs.readFileSync(DB_PATH);
      const salt = crypto.randomBytes(16);
      const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha256');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

      const encrypted = Buffer.concat([cipher.update(dbBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Format: salt (16) + iv (16) + authTag (16) + encrypted data
      const finalBuffer = Buffer.concat([salt, iv, authTag, encrypted]);
      fs.writeFileSync(backupPath, finalBuffer);

      cleanOldBackups();

      return NextResponse.json({
        success: true,
        backup: {
          name: backupName,
          size_kb: Math.round(finalBuffer.length / 1024),
          created_at: now.toISOString(),
          is_encrypted: true,
          algorithm: 'AES-256-GCM'
        }
      });
    }

    if (action === 'export_json') {
      const Database = (await import('better-sqlite3')).default;
      const sqlite = new Database(DB_PATH, { readonly: true });

      const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
      const exportData: Record<string, any[]> = {};

      for (const { name } of tables) {
        exportData[name] = sqlite.prepare(`SELECT * FROM ${name}`).all();
      }
      sqlite.close();

      const jsonStr = JSON.stringify(exportData, null, 2);
      const exportName = `singularity-export-${dateStr}.json`;
      const exportPath = path.join(BACKUP_DIR, exportName);
      fs.writeFileSync(exportPath, jsonStr, 'utf-8');

      return NextResponse.json({
        success: true,
        export: { name: exportName, size_kb: Math.round(jsonStr.length / 1024), tables: tables.length, created_at: now.toISOString() }
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function cleanOldBackups() {
  try {
    const cutoff = Date.now() - 30 * 86400000;
    const allFiles = fs.readdirSync(BACKUP_DIR);
    for (const f of allFiles) {
      const fp = path.join(BACKUP_DIR, f);
      const fstat = fs.statSync(fp);
      if (fstat.birthtime.getTime() < cutoff) {
        fs.unlinkSync(fp);
      }
    }
  } catch (e) {}
}
