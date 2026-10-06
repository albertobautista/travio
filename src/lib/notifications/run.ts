import "server-only";

import ChangesDigestEmail from "@/emails/changes-digest";
import TripReminderEmail from "@/emails/trip-reminder";
import { activityDate } from "@/lib/activities/itinerary";
import { appUrl } from "@/lib/email/app-url";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient, emailsOf } from "@/lib/supabase/admin";
import { DEFAULT_TIME_ZONE, formatTripDates, todayIn } from "@/lib/trips/dates";
import { formatLocalMoment, instantToZonedTime } from "@/lib/zoned-time";

import { isChangesFrequency } from "./options";
import { oneClickUnsubscribeUrl, preferencesOf, preferencesUrl, unsubscribeUrl } from "./preferences";
import { MAX_LINES_PER_TRIP, summarizeTrip, summaryDue, type TripEvent } from "./summary";

/** trip_events older than this are deleted: every summary has gone out by then. */
const KEEP_EVENTS_DAYS = 30;

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Hour of the day "at home". People don't store a time zone yet: Mexico City for everyone. */
function homeHour(now: Date) {
  return Number(instantToZonedTime(now, DEFAULT_TIME_ZONE).time.slice(0, 2));
}

/**
 * One run of the notification job (called every 10 minutes, see
 * /api/avisos/enviar): change summaries that are due, reminders for trips
 * starting tomorrow, and cleanup. Runs with the secret key: there's no user.
 */
export async function runNotifications(now = new Date()) {
  const base = await appUrl();
  const summaries = await sendDueSummaries(now, base);
  const reminders = await sendDueReminders(now, base);
  await createAdminClient()
    .from("trip_events")
    .delete()
    .lt("created_at", new Date(now.getTime() - KEEP_EVENTS_DAYS * 86_400_000).toISOString());
  return { summaries, reminders };
}

async function sendDueSummaries(now: Date, base: string) {
  const admin = createAdminClient();
  const cutoff = now.toISOString();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();

  // People who never opened their preferences have no row, but their default
  // is a daily summary: create rows for the members of trips that changed.
  const { data: recent } = await admin.from("trip_events").select("trip_id").gt("created_at", dayAgo);
  const changedTrips = [...new Set((recent ?? []).map((e) => e.trip_id))];
  if (changedTrips.length > 0) {
    const { data: members } = await admin.from("trip_members").select("user_id").in("trip_id", changedTrips);
    await preferencesOf((members ?? []).map((m) => m.user_id));
  }

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("user_id, changes, changes_sent_until, unsubscribe_token")
    .neq("changes", "off");
  const hour = homeHour(now);
  const due = (prefs ?? []).filter((p) =>
    summaryDue(isChangesFrequency(p.changes) ? p.changes : "daily", p.changes_sent_until ? new Date(p.changes_sent_until) : null, now, hour),
  );

  let sent = 0;
  for (const p of due) {
    // First summary: the last day.
    const since = p.changes_sent_until ?? dayAgo;
    const { data: memberships } = await admin.from("trip_members").select("trip_id").eq("user_id", p.user_id);
    const tripIds = (memberships ?? []).map((m) => m.trip_id);

    const { data: events } = tripIds.length
      ? await admin
          .from("trip_events")
          .select("trip_id, actor_id, entity, entity_id, action, detail, created_at")
          .in("trip_id", tripIds)
          .neq("actor_id", p.user_id) // never your own changes
          .gt("created_at", since)
          .lte("created_at", cutoff)
          .order("created_at")
      : { data: [] };

    if (events && events.length > 0) {
      const list = events as TripEvent[];
      const [{ data: trips }, { data: actors }, emails] = await Promise.all([
        admin.from("trips").select("id, name").in("id", [...new Set(list.map((e) => e.trip_id))]),
        admin.from("profiles").select("id, display_name").in("id", [...new Set(list.map((e) => e.actor_id))]),
        emailsOf([p.user_id]),
      ]);
      const nameOf = (id: string) => actors?.find((a) => a.id === id)?.display_name?.trim().split(/\s+/)[0] || "Alguien";
      const sections = (trips ?? [])
        .map((t) => {
          const lines = summarizeTrip(list.filter((e) => e.trip_id === t.id), nameOf);
          return { name: t.name, url: `${base}/viajes/${t.id}/itinerario`, lines: lines.slice(0, MAX_LINES_PER_TRIP), more: Math.max(0, lines.length - MAX_LINES_PER_TRIP) };
        })
        .filter((s) => s.lines.length > 0);
      const to = emails.get(p.user_id);
      if (to && sections.length > 0) {
        const period = p.changes === "hourly" ? "en la última hora" : "desde ayer";
        const { sent: ok } = await sendEmail({
          to,
          subject: sections.length === 1 ? `Cambios en ${sections[0].name}` : `Cambios en ${sections.length} de tus viajes`,
          unsubscribeUrl: oneClickUnsubscribeUrl(base, p.unsubscribe_token),
          email: ChangesDigestEmail({
            trips: sections,
            period,
            preferencesUrl: preferencesUrl(base),
            unsubscribeUrl: unsubscribeUrl(base, p.unsubscribe_token),
          }),
        });
        // If sending failed, leave the cursor: next run tries again.
        if (!ok) continue;
        sent++;
      }
    }
    await admin.from("notification_preferences").update({ changes_sent_until: cutoff }).eq("user_id", p.user_id);
  }
  return sent;
}

async function sendDueReminders(now: Date, base: string) {
  // "Tomorrow" and "9:00 or later" at home, so it arrives the day before, in the morning.
  if (homeHour(now) < 9) return 0;
  const tomorrow = addDays(todayIn(DEFAULT_TIME_ZONE, now), 1);
  const admin = createAdminClient();
  const { data: trips } = await admin.from("trips").select("id, name, start_date, end_date").eq("start_date", tomorrow);
  let sent = 0;

  for (const trip of trips ?? []) {
    const [{ data: members }, { data: activities }, { data: legs }, { count: documents }] = await Promise.all([
      admin.from("trip_members").select("user_id").eq("trip_id", trip.id),
      admin.from("activities").select("title, starts_at, timezone, category").eq("trip_id", trip.id).order("starts_at"),
      admin.from("transportations").select("origin_name, destination_name, departs_at, departs_timezone").eq("trip_id", trip.id).order("departs_at"),
      admin.from("files").select("id", { count: "exact", head: true }).eq("trip_id", trip.id),
    ]);
    const userIds = (members ?? []).map((m) => m.user_id);
    const [prefs, emails] = await Promise.all([preferencesOf(userIds), emailsOf(userIds)]);

    const firstDay = [
      ...(legs ?? [])
        .filter((l) => instantToZonedTime(l.departs_at, l.departs_timezone).date === trip.start_date)
        .map((l) => ({ at: l.departs_at, text: `${formatLocalMoment(l.departs_at, l.departs_timezone).split(" · ")[1]} · ${l.origin_name} → ${l.destination_name}` })),
      ...(activities ?? [])
        .filter((a) => a.category !== "transfer" && activityDate(a) === trip.start_date)
        .map((a) => ({ at: a.starts_at, text: `${instantToZonedTime(a.starts_at, a.timezone).time} · ${a.title}` })),
    ]
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(0, 6)
      .map((x) => x.text);

    for (const userId of userIds) {
      const p = prefs.get(userId);
      const to = emails.get(userId);
      if (!p?.reminders || !to) continue;
      // Claim it first: if two runs overlap, only one sends.
      const { data: claimed } = await admin
        .from("trip_reminders_sent")
        .upsert({ trip_id: trip.id, user_id: userId, start_date: trip.start_date! }, { onConflict: "trip_id,user_id,start_date", ignoreDuplicates: true })
        .select("trip_id");
      if (!claimed || claimed.length === 0) continue;
      const { sent: ok } = await sendEmail({
        to,
        subject: `Mañana empieza ${trip.name}`,
        unsubscribeUrl: oneClickUnsubscribeUrl(base, p.unsubscribe_token),
        email: TripReminderEmail({
          tripName: trip.name,
          dates: formatTripDates(trip.start_date, trip.end_date),
          firstDay,
          documents: documents ?? 0,
          tripUrl: `${base}/viajes/${trip.id}`,
          documentsUrl: `${base}/viajes/${trip.id}/documentos`,
          preferencesUrl: preferencesUrl(base),
          unsubscribeUrl: unsubscribeUrl(base, p.unsubscribe_token),
        }),
      });
      if (ok) sent++;
      else await admin.from("trip_reminders_sent").delete().match({ trip_id: trip.id, user_id: userId, start_date: trip.start_date! });
    }
  }
  return sent;
}
