import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { meetingsTable, meetingAttendeesTable, usersTable, notificationsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import nodemailer from "nodemailer";

const router: IRouter = Router();

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

async function getMeetingWithAttendees(meetingId: number) {
  const [meeting] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, meetingId));
  if (!meeting) return null;
  const attendeeRows = await db.select().from(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, meetingId));
  const attendeeIds = attendeeRows.map(a => a.userId);
  const attendees = attendeeIds.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, attendeeIds)) : [];
  const [organizer] = await db.select().from(usersTable).where(eq(usersTable.id, meeting.organizerId));
  return {
    ...meeting,
    scheduledAt: meeting.scheduledAt.toISOString(),
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
    organizer: organizer ? { ...organizer, createdAt: organizer.createdAt.toISOString(), updatedAt: organizer.updatedAt.toISOString() } : null,
    attendees: attendees.map(u => ({ ...u, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() }))
  };
}

router.get("/meetings", async (req, res) => {
  try {
    const meetings = await db.select().from(meetingsTable).orderBy(meetingsTable.scheduledAt);
    const result = await Promise.all(meetings.map(m => getMeetingWithAttendees(m.id)));
    res.json(result.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: "Failed to list meetings" });
  }
});

router.post("/meetings", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { title, description, scheduledAt, duration, meetingUrl, attendeeIds } = req.body;
    const [meeting] = await db.insert(meetingsTable).values({
      title, description: description ?? null,
      scheduledAt: new Date(scheduledAt),
      duration: duration ?? 60,
      meetingUrl: meetingUrl ?? null,
      organizerId: req.user.id
    }).returning();

    if (attendeeIds && attendeeIds.length > 0) {
      await db.insert(meetingAttendeesTable).values(
        attendeeIds.map((uid: string) => ({ meetingId: meeting.id, userId: uid }))
      );
      const attendees = await db.select().from(usersTable).where(inArray(usersTable.id, attendeeIds));
      for (const attendee of attendees) {
        await db.insert(notificationsTable).values({
          userId: attendee.id,
          type: "meeting_invite",
          title: `Meeting: ${title}`,
          body: `You have been invited to "${title}" on ${new Date(scheduledAt).toLocaleString()}`,
          linkUrl: `/meetings`
        });
        if (attendee.email) {
          await sendMeetingEmail(attendee.email, attendee.firstName, {
            title, scheduledAt: new Date(scheduledAt), description, meetingUrl
          });
        }
      }
    }
    const result = await getMeetingWithAttendees(meeting.id);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to create meeting" });
  }
});

router.get("/meetings/:meetingId", async (req, res) => {
  try {
    const result = await getMeetingWithAttendees(parseInt(req.params.meetingId));
    if (!result) {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to get meeting" });
  }
});

router.patch("/meetings/:meetingId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.meetingId);
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
        const [updatedMeeting] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, id));
        const newAttendees = await db.select().from(usersTable).where(inArray(usersTable.id, attendeeIds));
        for (const attendee of newAttendees) {
          await db.insert(notificationsTable).values({
            userId: attendee.id,
            type: "meeting_invite",
            title: `Meeting Updated: ${updatedMeeting?.title ?? title ?? ""}`,
            body: `The meeting has been updated`,
            linkUrl: `/meetings`
          });
          if (attendee.email && (scheduledAt || title)) {
            await sendMeetingEmail(attendee.email, attendee.firstName, {
              title: updatedMeeting?.title ?? title ?? "",
              scheduledAt: updatedMeeting?.scheduledAt ?? new Date(scheduledAt),
              description: updatedMeeting?.description,
              meetingUrl: updatedMeeting?.meetingUrl
            });
          }
        }
      }
    }
    const result = await getMeetingWithAttendees(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to update meeting" });
  }
});

router.delete("/meetings/:meetingId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await db.delete(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, parseInt(req.params.meetingId)));
    await db.delete(meetingsTable).where(eq(meetingsTable.id, parseInt(req.params.meetingId)));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete meeting" });
  }
});

export default router;
