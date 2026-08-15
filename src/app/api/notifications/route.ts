import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import {
  digitalVaultItems, importantDates, petRecords,
  vehicleLegalReminders, homeMaintenanceRecords,
  realEstateProperties, walletsAccounts
} from '@/db/schema';
import { eq, sql , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

interface Notification {
  id: string;
  title: string;
  subtitle: string;
  module: string;
  icon: string;
  days_left: number;
  priority: 'critical' | 'warning' | 'info';
  due_date: string;
}

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    const notifications: Notification[] = [];

    // 1. Dijital Kasa — Evrak bitiş uyarıları
    const vaultItems = userId ? db.select().from(digitalVaultItems).where(or(eq(digitalVaultItems.user_id, userId), eq(digitalVaultItems.is_family_shared, 1))).all() : [];
    for (const item of vaultItems) {
      if (!item.expiry_date) continue;
      const expDate = new Date(item.expiry_date);
      const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const threshold = item.remind_days_before || 30;
      if (daysLeft <= threshold) {
        const typeLabels: Record<string, string> = {
          passport: '🛂 Pasaport', warranty: '🛡️ Garanti',
          contract: '📄 Taahhüt', insurance: '🏥 Sigorta',
          id_card: '🪪 Kimlik', license: '📋 Ehliyet', title_deed: '🏠 Tapu'
        };
        notifications.push({
          id: `vault-${item.id}`,
          title: item.title,
          subtitle: daysLeft <= 0 ? 'Süresi doldu!' : `${daysLeft} gün içinde bitiyor`,
          module: 'Dijital Kasa',
          icon: typeLabels[item.type] || '📄',
          days_left: daysLeft,
          priority: daysLeft <= 0 ? 'critical' : daysLeft <= 14 ? 'warning' : 'info',
          due_date: item.expiry_date
        });
      }
    }

    // 2. Önemli Günler — Yaklaşan doğum günleri vs.
    const dates = userId ? db.select().from(importantDates).where(eq(importantDates.user_id, userId)).all() : [];
    for (const d of dates) {
      const [mm, ddStr] = d.event_date.split('-');
      const thisYear = new Date(today.getFullYear(), parseInt(mm) - 1, parseInt(ddStr));
      let eventDate = thisYear;
      if (thisYear < today) {
        eventDate = new Date(today.getFullYear() + 1, parseInt(mm) - 1, parseInt(ddStr));
      }
      const daysLeft = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const threshold = d.remind_days_before || 7;
      if (daysLeft <= threshold) {
        const typeEmoji: Record<string, string> = { birthday: '🎂', anniversary: '💍', nameday: '🌹', custom: '📅' };
        notifications.push({
          id: `date-${d.id}`,
          title: d.title,
          subtitle: daysLeft === 0 ? 'Bugün!' : `${daysLeft} gün kaldı`,
          module: 'Önemli Günler',
          icon: typeEmoji[d.event_type] || '📅',
          days_left: daysLeft,
          priority: daysLeft <= 1 ? 'critical' : daysLeft <= 3 ? 'warning' : 'info',
          due_date: eventDate.toISOString().split('T')[0]
        });
      }
    }

    // 3. Araç yasal hatırlatıcılar
    const legalReminders = db.select().from(vehicleLegalReminders).where(eq(vehicleLegalReminders.is_completed, 0)).all();
    for (const leg of legalReminders) {
      const legDate = new Date(leg.due_date);
      const daysLeft = Math.ceil((legDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30) {
        const typeLabel = leg.type === 'muayene' ? '🔧 TÜVTÜRK Muayene' : leg.type === 'kasko' ? '🚗 Kasko' : '📋 Trafik Sigortası';
        notifications.push({
          id: `vehicle-${leg.id}`,
          title: typeLabel,
          subtitle: `${daysLeft} gün kaldı`,
          module: 'Araç',
          icon: '🚗',
          days_left: daysLeft,
          priority: daysLeft <= 7 ? 'critical' : daysLeft <= 14 ? 'warning' : 'info',
          due_date: leg.due_date
        });
      }
    }

    // 4. Ev Bakım Uyarıları
    const homeMaint = db.select().from(homeMaintenanceRecords).where(eq(homeMaintenanceRecords.status, 'warning')).all();
    for (const h of homeMaint) {
      const dueDate = new Date(h.next_due_date);
      const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30) {
        notifications.push({
          id: `home-${h.id}`,
          title: h.title,
          subtitle: daysLeft <= 0 ? 'Vadesi geçti!' : `${daysLeft} gün kaldı`,
          module: 'Ev Bakımı',
          icon: '🏠',
          days_left: daysLeft,
          priority: daysLeft <= 0 ? 'critical' : 'warning',
          due_date: h.next_due_date
        });
      }
    }

    // 5. Kredi kartı ödeme tarihleri (3 gün içindekiler)
    const accounts = db.select().from(walletsAccounts).where(eq(walletsAccounts.is_active, 1)).all();
    for (const acc of accounts) {
      if (acc.type === 'credit_card' && acc.balance > 0 && acc.due_day) {
        const currentMonth = today.getMonth();
        const currentYear  = today.getFullYear();
        let cardDue = new Date(currentYear, currentMonth, acc.due_day);
        if (cardDue < today) cardDue = new Date(currentYear, currentMonth + 1, acc.due_day);
        const daysLeft = Math.ceil((cardDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 7) {
          notifications.push({
            id: `card-${acc.id}`,
            title: `${acc.name} Ekstre Ödemesi`,
            subtitle: `${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(acc.balance)} — ${daysLeft} gün kaldı`,
            module: 'Finans',
            icon: '💳',
            days_left: daysLeft,
            priority: daysLeft <= 2 ? 'critical' : 'warning',
            due_date: cardDue.toISOString().split('T')[0]
          });
        }
      }
    }

    // Tarihe göre sırala
    notifications.sort((a, b) => a.days_left - b.days_left);

    const criticalCount = notifications.filter(n => n.priority === 'critical').length;
    const warningCount  = notifications.filter(n => n.priority === 'warning').length;

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        total: notifications.length,
        critical: criticalCount,
        warning: warningCount
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
