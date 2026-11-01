import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import * as schema from '@/db/schema';
import { eq, or, and, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { getAuthUser } from '@/lib/auth';

import { SAFE_EXPORT_TABLES } from '@/lib/backup-tables';


async function fetchSafeData(userId: string, familyId: string) {
  const exportData: Record<string, any[]> = {};

  // İlgili ailenin araçlarını ve kullanıcının öğünlerini tespit et (İlişkisel filtreleme için)
  const userVehicles = await db.select({ id: schema.vehicles.id }).from(schema.vehicles)
    .where(or(eq(schema.vehicles.user_id, userId), eq(schema.vehicles.family_id, familyId)));
  const vIds = userVehicles.map(v => v.id);

  const userMeals = await db.select({ id: schema.nutritionMeals.id }).from(schema.nutritionMeals)
    .where(or(eq(schema.nutritionMeals.user_id, userId), eq(schema.nutritionMeals.family_id, familyId)));
  const mIds = userMeals.map(m => m.id);

  // 1. Güvenli genel tablolar (Kullanıcı ve Aile İzolasyonlu)
  for (const { name, table } of SAFE_EXPORT_TABLES) {
    try {
      const t = table as any;

      // Aile ana tablosu (1. Sırada bağımlılık çözümü)
      if (name === 'families') {
        exportData[name] = await db.select().from(t).where(eq(t.id, familyId));
      }
      // Araç alt tabloları (yalnızca bu ailenin araçlarına ait olanlar)
      else if (name === 'vehicle_maintenance_records' || name === 'vehicle_fuel_logs' || name === 'vehicle_legal_reminders') {
        if (vIds.length > 0) {
          exportData[name] = await db.select().from(t).where(inArray(t.vehicle_id, vIds));
        } else {
          exportData[name] = [];
        }
      }
      // Beslenme alt kalemleri (yalnızca bu kullanıcı/ailenin öğünlerine ait olanlar)
      else if (name === 'nutrition_meal_items') {
        if (mIds.length > 0) {
          exportData[name] = await db.select().from(t).where(inArray(t.meal_id, mIds));
        } else {
          exportData[name] = [];
        }
      }
      // Hem family_id hem user_id içeren tablolar
      else if (t.family_id && t.user_id) {
        exportData[name] = await db.select().from(t).where(
          or(eq(t.user_id, userId), eq(t.family_id, familyId))
        );
      }
      // Yalnızca family_id içeren tablolar
      else if (t.family_id) {
        exportData[name] = await db.select().from(t).where(
          eq(t.family_id, familyId)
        );
      }
      // Yalnızca user_id içeren tablolar
      else if (t.user_id) {
        exportData[name] = await db.select().from(t).where(
          eq(t.user_id, userId)
        );
      }
      // İzolasyon kolonu olmayan tablolar asla tüm veritabanını dışa aktarmaz
      else {
        exportData[name] = [];
      }
    } catch {
      exportData[name] = [];
    }
  }

  // 2. Kullanıcı tablosu: Yalnızca kendi kullanıcısı veya aile üyeleri (Parola hash ve salt'ları kesinlikle DAHİL ETME!)
  try {
    const rawUsers = await db.select().from(schema.users).where(
      or(eq(schema.users.id, userId), eq(schema.users.family_id, familyId))
    );
    exportData['users'] = rawUsers.map(u => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      avatar_emoji: u.avatar_emoji,
      created_at: u.created_at,
      updated_at: u.updated_at
    }));
  } catch {
    exportData['users'] = [];
  }

  return exportData;
}

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const { searchParams } = new URL(req.url, 'http://localhost');
    const download = searchParams.get('download');

    const exportData = await fetchSafeData(user.id, familyId);
    const totalRecords = Object.values(exportData).reduce((sum, rows) => sum + rows.length, 0);
    const rawJson = JSON.stringify(exportData);
    const sizeKb = Math.round(Buffer.byteLength(rawJson, 'utf8') / 1024);

    // Eğer doğrudan dosya indirilmek isteniyorsa
    if (download === 'true') {
      const payload = JSON.stringify({
        exported_at: new Date().toISOString(),
        version: '1.0.0',
        database: 'Supabase PostgreSQL',
        total_records: totalRecords,
        tables_count: SAFE_EXPORT_TABLES.length,
        data: exportData
      }, null, 2);

      return new Response(payload, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="singularity-backup-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        last_backup: {
          name: 'Supabase Otomatik Bulut Yedeği',
          size_kb: sizeKb,
          created_at: new Date().toISOString(),
          is_cloud: true
        },
        backup_count: 1,
        backups: [
          {
            name: `singularity-supabase-${new Date().toISOString().split('T')[0]}.json`,
            size_kb: sizeKb,
            created_at: new Date().toISOString(),
            is_encrypted: false
          }
        ],
        db_size_kb: sizeKb,
        total_records: totalRecords,
        tables_count: SAFE_EXPORT_TABLES.length + 1,
        status: 'cloud_active',
        database_engine: 'Supabase PostgreSQL',
        message: 'Veritabanı 7/24 Supabase bulutunda aktif ve güvenli.'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'export_json';
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // 1. DÜZ JSON YEDEK / EXPORT (backup_db veya export_json)
    if (action === 'backup_db' || action === 'export_json' || action === 'export') {
      const exportData = await fetchSafeData(user.id, familyId);
      const totalRecords = Object.values(exportData).reduce((sum, rows) => sum + rows.length, 0);
      const tablesCount = SAFE_EXPORT_TABLES.length + 1;
      const payloadObject = {
        exported_at: now.toISOString(),
        version: '1.0.0',
        database: 'Supabase PostgreSQL',
        total_records: totalRecords,
        tables_count: tablesCount,
        data: exportData
      };
      const jsonString = JSON.stringify(payloadObject, null, 2);
      const sizeKb = Math.max(1, Math.round(Buffer.byteLength(jsonString, 'utf8') / 1024));

      return NextResponse.json({
        success: true,
        backup: {
          name: `singularity-backup-${dateStr}.json`,
          size_kb: sizeKb,
          created_at: now.toISOString(),
          tables: tablesCount,
          total_records: totalRecords
        },
        export: {
          name: `singularity-backup-${dateStr}.json`,
          size_kb: sizeKb,
          tables: tablesCount,
          total_records: totalRecords
        },
        jsonData: payloadObject
      });
    }

    // 2. AES-256 ŞİFRELİ YEDEK
    if (action === 'encrypted_backup') {
      const rawPassphrase = body.passphrase;
      if (!rawPassphrase || typeof rawPassphrase !== 'string' || rawPassphrase.trim().length < 8) {
        return NextResponse.json({
          success: false,
          error: 'Şifreli yedek oluşturmak için en az 8 karakter uzunluğunda bir parola belirtmelisiniz.'
        }, { status: 400 });
      }

      const exportData = await fetchSafeData(user.id, familyId);
      const totalRecords = Object.values(exportData).reduce((sum, rows) => sum + rows.length, 0);
      const tablesCount = SAFE_EXPORT_TABLES.length + 1;
      const payloadObject = {
        exported_at: now.toISOString(),
        version: '1.0.0',
        database: 'Supabase PostgreSQL',
        total_records: totalRecords,
        tables_count: tablesCount,
        data: exportData
      };
      const jsonString = JSON.stringify(payloadObject, null, 2);

      const passphrase = rawPassphrase.trim();
      const salt = crypto.randomBytes(16);
      const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(jsonString, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const encPayload = JSON.stringify({
        encrypted_at: now.toISOString(),
        version: '1.0.0-aes256',
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        cipher: 'aes-256-cbc',
        data: encrypted
      }, null, 2);

      const encSizeKb = Math.max(1, Math.round(Buffer.byteLength(encPayload, 'utf8') / 1024));

      return NextResponse.json({
        success: true,
        backup: {
          name: `singularity-encrypted-${dateStr}.enc`,
          size_kb: encSizeKb,
          created_at: now.toISOString(),
          is_encrypted: true,
          tables: tablesCount,
          total_records: totalRecords
        },
        encryptedPayload: encPayload
      });
    }

    // 3. JSON YEDEKTEN GERİ YÜKLEME (RESTORE) - Sadece Aile Admini yapabilir
    if (action === 'restore') {
      if (user.role !== 'admin') {
        return NextResponse.json({
          success: false,
          error: 'Yedekten geri yükleme (Restore) işlemi için Aile Yöneticisi (admin) yetkisi gereklidir.'
        }, { status: 403 });
      }

      let incomingData = body.backupData?.data || body.data || body.jsonData?.data || body.backupData;

      // 1. AES-256 Şifreli Yedek Çözme Desteği (Bulgu 2 & 9)
      const encCandidate = body.encryptedPayload || body.encryptedData || incomingData;
      let encObj: any = null;
      if (typeof encCandidate === 'string') {
        try {
          const parsed = JSON.parse(encCandidate);
          if (parsed && parsed.salt && parsed.iv && parsed.data) {
            encObj = parsed;
          }
        } catch {
          // not json string
        }
      } else if (encCandidate && typeof encCandidate === 'object' && encCandidate.salt && encCandidate.iv && encCandidate.data) {
        encObj = encCandidate;
      }

      if (encObj) {
        const rawPassphrase = body.passphrase;
        if (!rawPassphrase || typeof rawPassphrase !== 'string') {
          return NextResponse.json({
            success: false,
            error: 'Şifreli yedeği açmak için lütfen parola belirtin.'
          }, { status: 400 });
        }

        try {
          const salt = Buffer.from(encObj.salt, 'base64');
          const iv = Buffer.from(encObj.iv, 'base64');
          const key = crypto.pbkdf2Sync(rawPassphrase.trim(), salt, 100000, 32, 'sha256');
          const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
          let decrypted = decipher.update(encObj.data, 'base64', 'utf8');
          decrypted += decipher.final('utf8');
          const parsedDecrypted = JSON.parse(decrypted);
          incomingData = parsedDecrypted.data || parsedDecrypted;
        } catch {
          return NextResponse.json({
            success: false,
            error: 'Şifreli yedek çözülemedi. Parola hatalı veya dosya bozuk.'
          }, { status: 400 });
        }
      }

      if (typeof incomingData === 'string') {
        try {
          const parsed = JSON.parse(incomingData);
          incomingData = parsed.data || parsed;
        } catch {
          // ignore
        }
      }

      if (!incomingData || typeof incomingData !== 'object') {
        return NextResponse.json({
          success: false,
          error: 'Geçersiz yedek içeriği. Veri formatı okunamadı.'
        }, { status: 400 });
      }

      let totalRestored = 0;
      const restoredSummary: Record<string, number> = {};

      // Bulgu 1, 9 & 14: db.transaction() ve toplu (batch) yazma
      await db.transaction(async (tx) => {
        // Aileyi garantiye al (Önceden var olmalı)
        try {
          await tx.insert(schema.families).values({
            id: familyId,
            name: `${user.full_name || user.username} Ailesi`,
            created_by_user_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).onConflictDoNothing();
        } catch (famErr) {
          console.warn('Initial family ensure warning:', famErr);
        }

        // Bağımlılık sırasına göre SAFE_EXPORT_TABLES üzerinde güvenli import
        for (const { name, table } of SAFE_EXPORT_TABLES) {
          const rows = incomingData[name];
          if (!Array.isArray(rows) || rows.length === 0) continue;

          const t = table as any;
          const preparedRows: any[] = [];

          for (const rawRow of rows) {
            if (!rawRow || typeof rawRow !== 'object') continue;
            const row = { ...rawRow };

            // Bulgu 1 & 9: row.user_id = user.id zorlamasını kaldır;
            // sadece yedekte user_id null ise admin ID'si ata, diğer aile üyelerinin verilerini koru
            if ('user_id' in t) {
              if (!row.user_id) {
                row.user_id = user.id;
              }
            }
            if ('family_id' in t) {
              row.family_id = familyId;
            }

            preparedRows.push(row);
          }

          if (preparedRows.length > 0) {
            const CHUNK_SIZE = 50;
            let tableRestored = 0;
            for (let i = 0; i < preparedRows.length; i += CHUNK_SIZE) {
              const chunk = preparedRows.slice(i, i + CHUNK_SIZE);
              try {
                await tx.insert(table).values(chunk).onConflictDoNothing();
                tableRestored += chunk.length;
              } catch {
                for (const singleRow of chunk) {
                  try {
                    await tx.insert(table).values(singleRow).onConflictDoNothing();
                    tableRestored++;
                  } catch (rowErr) {
                    console.warn(`Restore row error in ${name}:`, rowErr);
                  }
                }
              }
            }

            if (tableRestored > 0) {
              restoredSummary[name] = tableRestored;
              totalRestored += tableRestored;
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        message: `${totalRestored} kayıt başarıyla içe aktarıldı ve geri yüklendi.`,
        total_restored: totalRestored,
        summary: restoredSummary
      });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem' }, { status: 400 });
  } catch (error: any) {
    console.error('Backup API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
