import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import {
  digitalVaultItems, importantDates, petRecords,
  vehicleLegalReminders, homeMaintenanceRecords,
  walletsAccounts, recurringBills
} from '@/db/schema';
import { eq, sql, or, and } from 'drizzle-orm';
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
    await initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;
    const familyId = user?.family_id;

    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    const notifications: Notification[] = [];

    // 1. Dijital Kasa — Evrak bitiş uyarıları
    const vaultItems = userId ? await db.select().from(digitalVaultItems).where(or(eq(digitalVaultItems.user_id, userId), eq(digitalVaultItems.is_family_shared, 1))) : [];
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
    const dates = userId ? await db.select().from(importantDates).where(eq(importantDates.user_id, userId)) : [];
    for (const d of dates) {
      if (!d.event_date) continue;
      const parts = d.event_date.split(/[-/.]/);
      let mm: number, dd: number;
      if (parts.length >= 3) {
        // YYYY-MM-DD formatı
        mm = parseInt(parts[1], 10);
        dd = parseInt(parts[2], 10);
      } else {
        // MM-DD formatı
        mm = parseInt(parts[0] || '1', 10);
        dd = parseInt(parts[1] || '1', 10);
      }

      if (isNaN(mm) || isNaN(dd)) continue;

      const thisYear = new Date(today.getFullYear(), mm - 1, dd);
      let eventDate = thisYear;
      if (thisYear < today) {
        eventDate = new Date(today.getFullYear() + 1, mm - 1, dd);
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
    const legalReminders = await db.select().from(vehicleLegalReminders).where(eq(vehicleLegalReminders.is_completed, 0));
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
    const homeMaint = await db.select().from(homeMaintenanceRecords).where(eq(homeMaintenanceRecords.status, 'warning'));
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

    // 5. Kredi kartı ödeme tarihleri (7 gün içindekiler)
    const accounts = userId
      ? await db.select().from(walletsAccounts).where(
          and(
            eq(walletsAccounts.is_active, 1),
            familyId
              ? or(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.family_id, familyId))
              : eq(walletsAccounts.user_id, userId)
          )
        )
      : [];

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
            subtitle: `${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(acc.balance)} — ${daysLeft <= 0 ? 'Bugün!' : `${daysLeft} gün kaldı`}`,
            module: 'Finans',
            icon: '💳',
            days_left: daysLeft,
            priority: daysLeft <= 2 ? 'critical' : 'warning',
            due_date: cardDue.toISOString().split('T')[0]
          });
        }
      }
    }

    // 6. Periyodik Faturalar & Abonelikler (Ödenmemiş ve vadesi yaklaşanlar / geçenler)
    const bills = userId
      ? await db.select().from(recurringBills).where(
          and(
            eq(recurringBills.status, 'active'),
            familyId
              ? or(eq(recurringBills.user_id, userId), eq(recurringBills.family_id, familyId))
              : eq(recurringBills.user_id, userId)
          )
        )
      : [];

    const curYear = today.getFullYear();
    const curMonth = today.getMonth();
    const currentMonthStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;

    for (const bill of bills) {
      // Bu ay için zaten ödendi olarak işaretlenmişse bildirim verme
      if (bill.last_paid_month === currentMonthStr) continue;

      // Yıllık periyot ise ve bu ay vade ayı değilse atla
      if (bill.period === 'yearly' && bill.due_month && bill.due_month !== (curMonth + 1)) {
        continue;
      }

      // Vade gününü ayın gün sayısına sınırla (clamping)
      const maxDaysInCurMonth = new Date(curYear, curMonth + 1, 0).getDate();
      const dueDayClamped = Math.min(bill.due_day || 1, maxDaysInCurMonth);
      const billDue = new Date(curYear, curMonth, dueDayClamped);

      // Kalan gün sayısı
      const daysLeft = Math.ceil((billDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // 7 gün öncesinden başlayarak veya vadesi geçmişse (son 60 gün içinde) bildir
      if (daysLeft <= 7 && daysLeft >= -60) {
        const typeEmoji: Record<string, string> = {
          utility: '⚡',
          subscription: '📺',
          tax: '🏛️',
          other: '🧾'
        };
        const icon = typeEmoji[bill.type] || '🧾';
        const formattedAmount = new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: 'TRY',
          maximumFractionDigits: 0
        }).format(bill.amount || 0);

        let subtitle = '';
        if (daysLeft < 0) {
          subtitle = `${formattedAmount} — ${Math.abs(daysLeft)} gün gecikti!`;
        } else if (daysLeft === 0) {
          subtitle = `${formattedAmount} — Bugün son ödeme günü!`;
        } else {
          subtitle = `${formattedAmount} — ${daysLeft} gün kaldı`;
        }

        notifications.push({
          id: `bill-${bill.id}`,
          title: bill.name,
          subtitle,
          module: 'Faturalar',
          icon,
          days_left: daysLeft,
          priority: daysLeft <= 2 ? 'critical' : 'warning',
          due_date: billDue.toISOString().split('T')[0]
        });
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
