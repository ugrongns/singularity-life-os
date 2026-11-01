import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { homeMaintenanceRecords, homeAppliances } from '@/db/schema';
import { desc, eq, and, or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { getTodayTurkeyDate } from '@/lib/date-utils';

function addMonthsSafe(baseDate: Date, months: number): string {
  const d = new Date(baseDate.getTime());
  if (isNaN(d.getTime())) return getTodayTurkeyDate();
  const currentDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const maxDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(currentDay, maxDays));
  return getTodayTurkeyDate(d);
}

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;
    const familyId = user?.family_id || (userId ? `fam-${userId}` : null);
    
    const records = userId ? await db.select().from(homeMaintenanceRecords).where(familyId ? eq(homeMaintenanceRecords.family_id, familyId) : eq(homeMaintenanceRecords.user_id, userId)) : [];
    const today = new Date();

    const processedMaintenance = (records).map((rec: any) => {
      let daysLeft: number | null = null;
      let status: 'urgent' | 'warning' | 'ok' = 'ok';

      if (rec.next_due_date) {
        const dueDate = new Date(rec.next_due_date);
        if (!isNaN(dueDate.getTime())) {
          daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          status = daysLeft <= 7 ? 'urgent' : daysLeft <= 30 ? 'warning' : 'ok';
        }
      }

      return {
        ...rec,
        days_left: daysLeft,
        status
      };
    });

    // Ev Demirbaşları & Garanti Süreleri
    const appliances = userId ? await db.select().from(homeAppliances).where(familyId ? eq(homeAppliances.family_id, familyId) : eq(homeAppliances.user_id, userId)) : [];
    const processedAppliances = (appliances).map((app: any) => {
      let daysLeftWarranty: number | null = null;
      let isWarrantyActive = false;

      if (app.warranty_expiry_date) {
        const exp = new Date(app.warranty_expiry_date);
        if (!isNaN(exp.getTime())) {
          daysLeftWarranty = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          isWarrantyActive = daysLeftWarranty > 0;
        }
      }

      return {
        ...app,
        days_left_warranty: daysLeftWarranty,
        is_warranty_active: isWarrantyActive
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        maintenanceRecords: processedMaintenance,
        appliances: processedAppliances
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await req.json();
    const { action, record_id, months = 6, ...data } = body;
    const now = new Date();
    const nowStr = now.toISOString();
    const familyId = user.family_id || `fam-${user.id}`;
    const todayStr = getTodayTurkeyDate();

    // Filtre / Bakım Yenileme (Reset Interval)
    if (action === 'reset_filter' || record_id) {
      const targetId = record_id || data.id;
      const interval = Number(months || data.months) || 6;
      const nextDate = addMonthsSafe(now, interval);

      await db.update(homeMaintenanceRecords)
        .set({
          last_serviced_date: todayStr,
          next_due_date: nextDate,
          updated_at: nowStr
        })
        .where(
          and(
            eq(homeMaintenanceRecords.id, targetId),
            or(eq(homeMaintenanceRecords.user_id, user.id), eq(homeMaintenanceRecords.family_id, familyId))
          )
        );

      return NextResponse.json({
        success: true,
        message: '🚰 Bakım sıfırlandı ve yeni periyot başlatıldı!'
      });
    }

    // Yeni Ev Bakım Kalemi Ekleme
    if (action === 'add_maintenance') {
      const id = `hm-${Date.now()}`;
      const interval = parseInt(data.interval_months, 10) || 6;
      const nextDate = addMonthsSafe(now, interval);

      await db.insert(homeMaintenanceRecords).values({
        id,
        item_type: data.item_type || 'custom',
        title: data.title || 'Ev Bakımı',
        last_serviced_date: todayStr,
        next_due_date: nextDate,
        interval_months: interval,
        cost_estimate: parseFloat(data.cost_estimate) || 0,
        status: 'ok',
        user_id: user.id,
        family_id: familyId,
        created_at: nowStr,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true, message: '🏠 Ev bakım görevi eklendi!' });
    }

    // Yeni Ev Demirbaşı & Garanti Kaydı Ekleme
    if (action === 'add_appliance') {
      const id = `app-${Date.now()}`;
      const warrantyMonths = parseInt(data.warranty_months, 10) || 24;

      // Geçersiz tarih kontrolü ile RangeError: Invalid time value koruması
      let basePurchaseDate = now;
      if (data.purchase_date) {
        const parsed = new Date(data.purchase_date);
        if (!isNaN(parsed.getTime())) {
          basePurchaseDate = parsed;
        }
      }

      const purchaseDate = getTodayTurkeyDate(basePurchaseDate);
      const expiryDate = addMonthsSafe(basePurchaseDate, warrantyMonths);

      await db.insert(homeAppliances).values({
        id,
        name: data.name || 'Ev Cihazı',
        brand: data.brand || '',
        model: data.model || '',
        purchase_date: purchaseDate,
        warranty_months: warrantyMonths,
        warranty_expiry_date: expiryDate,
        service_phone: data.service_phone || '',
        notes: data.notes || '',
        user_id: user.id,
        family_id: familyId,
        created_at: nowStr,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true, message: '📺 Ev demirbaşı & garanti kaydı oluşturuldu!' });
    }

    if (action === 'delete_appliance') {
      await db.delete(homeAppliances).where(
        and(
          eq(homeAppliances.id, data.id),
          or(eq(homeAppliances.user_id, user.id), eq(homeAppliances.family_id, familyId))
        )
      );
      return NextResponse.json({ success: true, message: 'Cihaz kaydı silindi.' });
    }

    return NextResponse.json({ success: false, error: 'Bilinmeyen işlem' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
