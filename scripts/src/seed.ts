import { db } from "@workspace/db";
import {
  usersTable, tasksTable, kpisTable, kpiEntriesTable, attendanceTable,
  qualityChecksTable, messagesTable, meetingsTable, meetingAttendeesTable,
  notificationsTable, videoProjectsTable, videoVersionsTable, videoCommentsTable
} from "@workspace/db/schema";

async function seed() {
  console.log("Seeding database...");

  // Clear in dependency order
  await db.delete(videoCommentsTable);
  await db.delete(videoVersionsTable);
  await db.delete(videoProjectsTable);
  await db.delete(notificationsTable);
  await db.delete(meetingAttendeesTable);
  await db.delete(meetingsTable);
  await db.delete(messagesTable);
  await db.delete(qualityChecksTable);
  await db.delete(attendanceTable);
  await db.delete(kpiEntriesTable);
  await db.delete(kpisTable);
  await db.delete(tasksTable);
  await db.delete(usersTable);

  // Users
  const users = await db.insert(usersTable).values([
    { id: "user_admin", username: "alex_ramos", firstName: "Alex", lastName: "Ramos", email: "alex@setspace.io", role: "admin", title: "Creative Director", department: "Leadership" },
    { id: "user_editor1", username: "jess_kim", firstName: "Jessica", lastName: "Kim", email: "jess@setspace.io", role: "employee", title: "Senior Video Editor", department: "Post Production" },
    { id: "user_editor2", username: "marcus_bell", firstName: "Marcus", lastName: "Bell", email: "marcus@setspace.io", role: "employee", title: "Motion Designer", department: "Motion" },
    { id: "user_editor3", username: "sofia_patel", firstName: "Sofia", lastName: "Patel", email: "sofia@setspace.io", role: "employee", title: "Video Editor", department: "Post Production" },
    { id: "user_editor4", username: "ryan_chen", firstName: "Ryan", lastName: "Chen", email: "ryan@setspace.io", role: "employee", title: "Color Grader", department: "Color" },
  ]).returning();

  console.log(`Created ${users.length} users`);

  // Tasks
  const tasks = await db.insert(tasksTable).values([
    { title: "Edit Nike Summer Campaign Reel", status: "in-progress", priority: "high", assigneeId: "user_editor1", createdById: "user_admin", dueDate: new Date(Date.now() + 3 * 86400000), description: "3-minute brand reel for Nike summer collection. Needs color grading and sound design." },
    { title: "Spotify Podcast Intro Animation", status: "review", priority: "high", assigneeId: "user_editor2", createdById: "user_admin", dueDate: new Date(Date.now() + 1 * 86400000), description: "15-second animated intro for Spotify podcast series." },
    { title: "Tesla Product Launch Video", status: "todo", priority: "urgent", assigneeId: "user_editor3", createdById: "user_admin", dueDate: new Date(Date.now() + 7 * 86400000), description: "60-second product launch teaser for Model S refresh." },
    { title: "Color Grade Wedding Highlight", status: "done", priority: "medium", assigneeId: "user_editor4", createdById: "user_admin", completedAt: new Date(Date.now() - 2 * 86400000), dueDate: new Date(Date.now() - 1 * 86400000) },
    { title: "Social Media Cutdowns — Nike", status: "todo", priority: "medium", assigneeId: "user_editor1", createdById: "user_admin", dueDate: new Date(Date.now() + 5 * 86400000), description: "15s and 30s social cutdowns from the main reel." },
    { title: "YouTube Thumbnail Design Pack", status: "in-progress", priority: "low", assigneeId: "user_editor2", createdById: "user_admin", dueDate: new Date(Date.now() + 10 * 86400000) },
  ]).returning();

  console.log(`Created ${tasks.length} tasks`);

  // KPIs
  const kpis = await db.insert(kpisTable).values([
    { name: "Videos Delivered", unit: "videos", targetValue: "10", userId: "user_editor1", period: "monthly" },
    { name: "Revision Rounds", unit: "rounds", targetValue: "2", userId: "user_editor1", period: "monthly", description: "Target: keep revisions under 2 per project" },
    { name: "Client Satisfaction", unit: "score/5", targetValue: "4.5", userId: "user_editor1", period: "monthly" },
    { name: "Animations Completed", unit: "animations", targetValue: "8", userId: "user_editor2", period: "monthly" },
    { name: "Videos Delivered", unit: "videos", targetValue: "8", userId: "user_editor3", period: "monthly" },
    { name: "Projects Graded", unit: "projects", targetValue: "12", userId: "user_editor4", period: "monthly" },
  ]).returning();

  const now = new Date();
  await db.insert(kpiEntriesTable).values([
    { kpiId: kpis[0].id, userId: "user_editor1", actualValue: "8", recordedAt: now },
    { kpiId: kpis[1].id, userId: "user_editor1", actualValue: "1.5", recordedAt: now },
    { kpiId: kpis[2].id, userId: "user_editor1", actualValue: "4.7", recordedAt: now },
    { kpiId: kpis[3].id, userId: "user_editor2", actualValue: "6", recordedAt: now },
    { kpiId: kpis[4].id, userId: "user_editor3", actualValue: "7", recordedAt: now },
    { kpiId: kpis[5].id, userId: "user_editor4", actualValue: "11", recordedAt: now },
  ]);

  console.log("Created KPIs and entries");

  // Attendance
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];

  await db.insert(attendanceTable).values([
    { userId: "user_editor1", clockIn: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 5), clockOut: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0), date: today, status: "present" },
    { userId: "user_editor2", clockIn: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30), date: today, status: "present" },
    { userId: "user_editor3", clockIn: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0), clockOut: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0), date: today, status: "present" },
    { userId: "user_editor4", clockIn: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 45), clockOut: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 30), date: today, status: "present" },
    { userId: "user_editor1", clockIn: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 9, 0), clockOut: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 30), date: yesterday, status: "present" },
    { userId: "user_editor2", clockIn: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 9, 15), clockOut: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 17, 45), date: yesterday, status: "present" },
    { userId: "user_editor3", date: yesterday, clockIn: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 11, 0), clockOut: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 15, 0), status: "partial" },
    { userId: "user_editor4", clockIn: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 9, 0), clockOut: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 18, 0), date: twoDaysAgo, status: "present" },
  ]);

  console.log("Created attendance records");

  // Quality Checks
  await db.insert(qualityChecksTable).values([
    { taskId: tasks[3].id, reviewerId: "user_admin", submitterId: "user_editor4", rating: 5, feedback: "Exceptional color work — the shadows are perfectly balanced.", status: "approved" },
    { taskId: tasks[0].id, reviewerId: "user_admin", submitterId: "user_editor1", rating: 4, feedback: "Great pacing. Please tighten the ending sequence.", status: "needs_revision" },
    { taskId: tasks[1].id, reviewerId: "user_admin", submitterId: "user_editor2", rating: 4, feedback: "Motion is smooth. Logo reveal timing needs to be 0.5s faster.", status: "needs_revision" },
  ]);

  console.log("Created quality checks");

  // Messages
  await db.insert(messagesTable).values([
    { content: "Morning team! Nike reel is looking amazing. Let's nail this one 💪", authorId: "user_admin" },
    { content: "Thanks! I'm deep in the color grading now. Should have a v2 ready by EOD.", authorId: "user_editor1" },
    { content: "Can someone review my Spotify animation? I think the timing is off on the logo.", authorId: "user_editor2" },
    { content: "I'll take a look this afternoon Marcus!", authorId: "user_admin" },
    { content: "Tesla brief just landed. This one's going to be a big one. Let's plan a quick call.", authorId: "user_editor3" },
    { content: "Set up a Zoom for 3pm — calendar invite sent!", authorId: "user_admin" },
  ]);

  console.log("Created messages");

  // Meetings
  const meetingTime = new Date(Date.now() + 2 * 3600000);
  const nextMeeting = new Date(Date.now() + 24 * 3600000);

  const [meeting1] = await db.insert(meetingsTable).values({
    title: "Tesla Campaign Kickoff",
    description: "Review creative brief, assign roles, and establish delivery timeline for Tesla Model S launch video.",
    scheduledAt: meetingTime,
    duration: 60,
    meetingUrl: "https://zoom.us/j/example123",
    organizerId: "user_admin"
  }).returning();

  const [meeting2] = await db.insert(meetingsTable).values({
    title: "Weekly Team Sync",
    description: "Review progress on all active projects. Flag blockers.",
    scheduledAt: nextMeeting,
    duration: 30,
    organizerId: "user_admin"
  }).returning();

  await db.insert(meetingAttendeesTable).values([
    { meetingId: meeting1.id, userId: "user_editor1" },
    { meetingId: meeting1.id, userId: "user_editor2" },
    { meetingId: meeting1.id, userId: "user_editor3" },
    { meetingId: meeting2.id, userId: "user_editor1" },
    { meetingId: meeting2.id, userId: "user_editor2" },
    { meetingId: meeting2.id, userId: "user_editor3" },
    { meetingId: meeting2.id, userId: "user_editor4" },
  ]);

  console.log("Created meetings");

  // Notifications
  await db.insert(notificationsTable).values([
    { userId: "user_editor1", type: "meeting_invite", title: "Tesla Campaign Kickoff", body: "You've been invited to a meeting in 2 hours", isRead: false },
    { userId: "user_editor1", type: "task_update", title: "Task feedback: Nike Campaign Reel", body: "Alex left feedback on your submission", isRead: false },
    { userId: "user_editor2", type: "meeting_invite", title: "Tesla Campaign Kickoff", body: "You've been invited to a meeting in 2 hours", isRead: false },
    { userId: "user_editor3", type: "task_assigned", title: "New task: Tesla Product Launch Video", body: "You've been assigned a new high-priority task", isRead: true },
  ]);

  console.log("Created notifications");

  // Video Projects (using placeholder paths since we don't have real uploads in seed)
  const videoProjects = await db.insert(videoProjectsTable).values([
    { title: "Nike Summer Campaign — Hero Reel", clientName: "Nike", description: "Main 3-min brand film for Nike summer 2025 collection", taskId: tasks[0].id, createdById: "user_admin", status: "active" },
    { title: "Spotify Podcast Intro", clientName: "Spotify", description: "Animated intro for The Daily Drive podcast", taskId: tasks[1].id, createdById: "user_admin", status: "active" },
    { title: "Tesla Model S Launch Teaser", clientName: "Tesla", description: "60-second launch teaser for the new Model S", taskId: tasks[2].id, createdById: "user_admin", status: "active" },
  ]).returning();

  // Video Versions (placeholder paths)
  const version1 = await db.insert(videoVersionsTable).values({
    projectId: videoProjects[0].id,
    versionNumber: 1,
    objectPath: "/objects/demo/nike-v1.mp4",
    fileName: "nike-summer-v1.mp4",
    fileSize: 524288000,
    uploadedById: "user_editor1",
    status: "needs_revision"
  }).returning();

  const version2 = await db.insert(videoVersionsTable).values({
    projectId: videoProjects[0].id,
    versionNumber: 2,
    objectPath: "/objects/demo/nike-v2.mp4",
    fileName: "nike-summer-v2.mp4",
    fileSize: 512000000,
    uploadedById: "user_editor1",
    status: "pending"
  }).returning();

  const spotifyVersion = await db.insert(videoVersionsTable).values({
    projectId: videoProjects[1].id,
    versionNumber: 1,
    objectPath: "/objects/demo/spotify-intro-v1.mp4",
    fileName: "spotify-intro-v1.mp4",
    fileSize: 15000000,
    uploadedById: "user_editor2",
    status: "pending"
  }).returning();

  // Video Comments
  await db.insert(videoCommentsTable).values([
    { versionId: version1[0].id, authorId: "user_admin", authorName: "Alex Ramos", authorType: "internal", content: "The opening sequence is too slow. Cut 3 seconds off the intro.", timestampSeconds: 12.5, isResolved: true },
    { versionId: version1[0].id, authorId: "user_editor4", authorName: "Ryan Chen", authorType: "internal", content: "The warm grade on the beach shots is not matching the product shots. Need consistency.", timestampSeconds: 45.2, isResolved: false },
    { versionId: version2[0].id, authorId: "user_admin", authorName: "Alex Ramos", authorType: "internal", content: "Much better! The pacing is great now. Approve the color on the product shots.", timestampSeconds: 30.0, isResolved: false },
    { versionId: version2[0].id, authorName: "Sarah Nike Marketing", authorType: "client", content: "Love the energy! Can we get a slightly brighter grade on the lifestyle shots?", timestampSeconds: 88.0, isResolved: false },
    { versionId: spotifyVersion[0].id, authorId: "user_admin", authorName: "Alex Ramos", authorType: "internal", content: "Logo timing is 0.5s too slow. Otherwise looks great.", timestampSeconds: 8.0, isResolved: false },
  ]);

  console.log("Created video projects and comments");
  console.log("✅ Seed complete!");
}

seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
