import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { homeMaintenanceRecords, homeAppliances } from '@/db/schema';
import { desc, eq , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;
    
    const records = userId ? await db.select().from(homeMaintenanceRecords).where(eq(homeMaintenanceRecords.user_id, userId)).all() : [];
    const today = new Date();

    const processedMaintenance = (records as any[]).map((rec: any) => {
      const dueDate = new Date(rec.next_due_date);
      const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const status = daysLeft <= 7 ? 'urgent' : daysLeft <= 30 ? 'warning' : 'ok';

      return {
        ...rec,
        days_left: daysLeft,
        status
      };
    });

    // Ev Demirbaşları & Garanti Süreleri
    const appliances = userId ? await db.select().from(homeAppliances).where(eq(homeAppliances.user_id, userId)).all() : [];
    const processedAppliances = (appliances as any[]).map((app: any) => {
      let daysLeftWarranty = null;
      let isWarrantyActive = false;

      if (app.warranty_expiry_date) {
        const exp = new Date(app.warranty_expiry_date);
        daysLeftWarranty = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        isWarrantyActive = daysLeftWarranty > 0;
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
    initDatabase();
    const body = await req.json();
    const { action, record_id, months = 6, ...data } = body;
    const now = new Date();
    const nowStr = now.toISOString();

    // Filtre / Bakım Yenileme (Reset Interval)
    if (action === 'reset_filter' || record_id) {
      const targetId = record_id || data.id;
      const interval = months || data.months || 6;
      const nextDate = new Date(now.getTime() + (interval * 30 * 86400000)).toISOString().split('T')[0];

      db.update(homeMaintenanceRecords)
        .set({
          last_serviced_date: now.toISOString().split('T')[0],
          next_due_date: nextDate,
          updated_at: nowStr
        })
        .where(eq(homeMaintenanceRecords.id, targetId))
        .run();

      return NextResponse.json({
        success: true,
        message: '🚰 Bakım sıfırlandı ve yeni periyot başlatıldı!'
      });
    }

    // Yeni Ev Bakım Kalemi Ekleme
    if (action === 'add_maintenance') {
      const id = `hm-${Date.now()}`;
      const interval = parseInt(data.interval_months) || 6;
      const nextDate = new Date(now.getTime() + (interval * 30 * 86400000)).toISOString().split('T')[0];

      db.insert(homeMaintenanceRecords).values({
        id,
        item_type: data.item_type || 'custom',
        title: data.title,
        last_serviced_date: now.toISOString().split('T')[0],
        next_due_date: nextDate,
        interval_months: interval,
        cost_estimate: parseFloat(data.cost_estimate) || 0,
        status: 'ok',
        created_at: nowStr,
        updated_at: nowStr
      }).run();

      return NextResponse.json({ success: true, message: '🏠 Ev bakım görevi eklendi!' });
    }

    // Yeni Ev Demirbaşı & Garanti Kaydı Ekleme
    if (action === 'add_appliance') {
      const id = `app-${Date.now()}`;
      const warrantyMonths = parseInt(data.warranty_months) || 24;
      const purchaseDate = data.purchase_date || now.toISOString().split('T')[0];
      const expiryDate = new Date(new Date(purchaseDate).getTime() + (warrantyMonths * 30 * 86400000)).toISOString().split('T')[0];

      db.insert(homeAppliances).values({
        id,
        name: data.name,
        brand: data.brand || '',
        model: data.model || '',
        purchase_date: purchaseDate,
        warranty_months: warrantyMonths,
        warranty_expiry_date: expiryDate,
        service_phone: data.service_phone || '',
        notes: data.notes || '',
        created_at: nowStr,
        updated_at: nowStr
      }).run();

      return NextResponse.json({ success: true, message: '📺 Ev demirbaşı & garanti kaydı oluşturuldu!' });
    }

    if (action === 'delete_appliance') {
      db.delete(homeAppliances).where(eq(homeAppliances.id, data.id)).run();
      return NextResponse.json({ success: true, message: 'Cihaz kaydı silindi.' });
    }

    return NextResponse.json({ success: false, error: 'Bilinmeyen işlem' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
