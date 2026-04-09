import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { meetingsTable, meetingAttendeesTable, notificationsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import nodemailer from "nodemailer";
import { requireAdminOrHR } from "../middleware/roles";
import { getCachedUsers, getCachedUser, getUserMap, getCached, invalidateResult } from "../lib/cache";

const router: IRouter = Router();

const MEETINGS_CACHE_KEY = "meetings";
const MEETINGS_TTL_MS = 5 * 60_000;

async function sendMeetingEmail(toEmail: string, name: string, meeting: { title: string; scheduledAt: Date; description?: string | null; meetingUrl?: string | null }) {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await transporter.sendMail({
      from: `"Setspace" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Meeting Invitation: ${meeting.title}`,
      html: `
        <h2>You have been invited to a meeting</h2>
        <p><strong>${meeting.title}</strong></p>
        <p><strong>When:</strong> ${meeting.scheduledAt.toLocaleString()}</p>
        ${meeting.description ? `<p><strong>Agenda:</strong> ${meeting.description}</p>` : ""}
        ${meeting.meetingUrl ? `<p><strong>Join:</strong> <a href="${meeting.meetingUrl}">${meeting.meetingUrl}</a></p>` : ""}
        <p>See you there!</p>
        <p>— The Setspace Team</p>
      `
    });
  } catch (err) {
    console.error("Email send failed:", err);
  }
}

/**
 * Bulk-load all meetings with attendees and organizers.
 *
 * Before: getMeetingWithAttendees() called per-meeting = 3 queries × N meetings.
 * After : 3 bulk queries total, joined in JS, result cached 60 s.
 */
async function loadAllMeetings() {
  const [meetings, allAttendeeRows, users] = await Promise.all([
    db.select().from(meetingsTable).orderBy(meetingsTable.scheduledAt),
    db.select().from(meetingAttendeesTable),
    getCachedUsers(),
  ]);

  const userMap = getUserMap(users);

  // Group attendee rows by meetingId
  const attendeesByMeeting: Record<number, string[]> = {};
  for (const row of allAttendeeRows) {
    if (!attendeesByMeeting[row.meetingId]) attendeesByMeeting[row.meetingId] = [];
    attendeesByMeeting[row.meetingId].push(row.userId);
  }

  return meetings.map(m => ({
    ...m,
    scheduledAt: m.scheduledAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    organizer: userMap[m.organizerId] ?? null,
    attendees: (attendeesByMeeting[m.id] ?? []).map(uid => userMap[uid]).filter(Boolean),
  }));
}

/**
 * GET /api/meetings
 * Served from 60-second cache. First request of each minute hits DB (3 queries);
 * all subsequent requests within the window hit memory.
 */
router.get("/meetings", async (req, res) => {
  try {
    const data = await getCached(MEETINGS_CACHE_KEY, MEETINGS_TTL_MS, loadAllMeetings);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to list meetings" });
  }
});

router.get("/meetings/:meetingId", async (req, res) => {
  try {
    const id = parseInt(String(req.params.meetingId));
    // Pull from the cached list when possible
    const cached = await getCached(MEETINGS_CACHE_KEY, MEETINGS_TTL_MS, loadAllMeetings);
    const meeting = (cached as Array<{ id: number }>).find(m => m.id === id);
    if (!meeting) { res.status(404).json({ error: "Meeting not found" }); return; }
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: "Failed to get meeting" });
  }
});

router.post("/meetings", requireAdminOrHR, async (req, res) => {
  try {
    const { title, description, scheduledAt, duration, meetingUrl, attendeeIds } = req.body;
    const [meeting] = await db.insert(meetingsTable).values({
      title, description: description ?? null,
      scheduledAt: new Date(scheduledAt),
      duration: duration ?? 60,
      meetingUrl: meetingUrl ?? null,
      organizerId: req.user!.id
    }).returning();

    if (attendeeIds && attendeeIds.length > 0) {
      await db.insert(meetingAttendeesTable).values(
        attendeeIds.map((uid: string) => ({ meetingId: meeting.id, userId: uid }))
      );
      const users = await getCachedUsers();
      const invitedUsers = users.filter(u => (attendeeIds as string[]).includes(u.id));
      await Promise.all(invitedUsers.map(async attendee => {
        await db.insert(notificationsTable).values({
          userId: attendee.id,
          type: "meeting_invite",
          title: `Meeting: ${title}`,
          body: `You have been invited to "${title}" on ${new Date(scheduledAt).toLocaleString()}`,
          linkUrl: `/meetings`
        });
        if (attendee.email) {
          sendMeetingEmail(attendee.email, attendee.firstName, {
            title, scheduledAt: new Date(scheduledAt), description, meetingUrl
          });
        }
      }));
    }

    invalidateResult(MEETINGS_CACHE_KEY);

    // Build and return the new meeting shape
    const organizer = await getCachedUser(req.user!.id);
    const users = await getCachedUsers();
    const userMap = getUserMap(users);
    const attendees = (attendeeIds ?? []).map((uid: string) => userMap[uid]).filter(Boolean);
    res.status(201).json({
      ...meeting,
      scheduledAt: meeting.scheduledAt.toISOString(),
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt.toISOString(),
      organizer: organizer ?? null,
      attendees,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create meeting" });
  }
});

router.patch("/meetings/:meetingId", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(String(req.params.meetingId));
    const { title, description, scheduledAt, duration, meetingUrl, attendeeIds } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (scheduledAt !== undefined) updates.scheduledAt = new Date(scheduledAt);
    if (duration !== undefined) updates.duration = duration;
    if (meetingUrl !== undefined) updates.meetingUrl = meetingUrl;
    await db.update(meetingsTable).set(updates).where(eq(meetingsTable.id, id));

    if (attendeeIds !== undefined) {
      await db.delete(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, id));
      if (attendeeIds.length > 0) {
        await db.insert(meetingAttendeesTable).values(
          attendeeIds.map((uid: string) => ({ meetingId: id, userId: uid }))
        );
      }
    }

    const meaningfulChange = title !== undefined || scheduledAt !== undefined || duration !== undefined || meetingUrl !== undefined || description !== undefined || attendeeIds !== undefined;
    if (meaningfulChange) {
      const [updatedMeeting] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, id));
      const currentAttendeeRows = await db.select({ userId: meetingAttendeesTable.userId }).from(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, id));
      const currentAttendeeIds = currentAttendeeRows.map(r => r.userId);
      if (currentAttendeeIds.length > 0) {
        const users = await getCachedUsers();
        const attendees = users.filter(u => currentAttendeeIds.includes(u.id));
        await Promise.all(attendees.map(async attendee => {
          await db.insert(notificationsTable).values({
            userId: attendee.id,
            type: "meeting_invite",
            title: `Meeting Updated: ${updatedMeeting?.title ?? ""}`,
            body: scheduledAt ? `Rescheduled to ${new Date(scheduledAt).toLocaleString()}` : `Meeting details have been updated`,
            linkUrl: `/meetings`
          });
          if (attendee.email && updatedMeeting) {
            sendMeetingEmail(attendee.email, attendee.firstName, {
              title: updatedMeeting.title ?? "",
              scheduledAt: updatedMeeting.scheduledAt ?? new Date(),
              description: updatedMeeting.description,
              meetingUrl: updatedMeeting.meetingUrl,
            });
          }
        }));
      }
    }

    invalidateResult(MEETINGS_CACHE_KEY);

    // Return updated meeting from a fresh load
    const freshAll = await loadAllMeetings();
    const result = freshAll.find(m => m.id === id) ?? null;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to update meeting" });
  }
});

router.delete("/meetings/:meetingId", requireAdminOrHR, async (req, res) => {
  try {
    const id = parseInt(String(req.params.meetingId));
    await db.delete(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, id));
    await db.delete(meetingsTable).where(eq(meetingsTable.id, id));
    invalidateResult(MEETINGS_CACHE_KEY);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete meeting" });
  }
});

export default router;
