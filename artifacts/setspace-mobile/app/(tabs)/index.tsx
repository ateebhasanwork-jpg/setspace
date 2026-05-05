import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useClockIn,
  useClockOut,
  useGetCurrentUser,
  useGetTodayAttendance,
  useListTasks,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function priorityDotColor(priority: string, destructive: string, muted: string): string {
  if (priority === "urgent") return destructive;
  if (priority === "high") return "#f59e0b";
  if (priority === "medium") return "#3b82f6";
  return muted;
}

function statusLabel(status: string) {
  switch (status) {
    case "todo": return "To Do";
    case "in_progress": return "In Progress";
    case "done": return "Done";
    default: return status;
  }
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: me } = useGetCurrentUser();
  const {
    data: attendance,
    isLoading: attendanceLoading,
    refetch: refetchAttendance,
  } = useGetTodayAttendance();
  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = useListTasks(
    me?.id ? { assigneeId: me.id } : undefined,
  );

  const { mutateAsync: clockInFn, isPending: clockingIn } = useClockIn();
  const { mutateAsync: clockOutFn, isPending: clockingOut } = useClockOut();

  const onRefresh = useCallback(() => {
    refetchAttendance();
    refetchTasks();
  }, [refetchAttendance, refetchTasks]);

  const handleClockToggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (attendance && !attendance.clockOut) {
        await clockOutFn();
      } else {
        await clockInFn();
      }
      refetchAttendance();
    } catch {}
  };

  const isClockedIn = !!(attendance && !attendance.clockOut);
  const pendingTasks = (tasks ?? []).filter((t) => t.status !== "done");
  const doneTasks = (tasks ?? []).filter((t) => t.status === "done");

  const clockInTime = attendance?.clockIn
    ? new Date(attendance.clockIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : null;
  const clockOutTime = attendance?.clockOut
    ? new Date(attendance.clockOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + 20,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    greeting: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    name: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: -0.5, marginTop: 2 },
    dateText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 4 },
    section: { paddingHorizontal: 20, marginBottom: 28 },
    sectionTitle: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 12,
    },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: 20,
    },
    attendanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    statusSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 3 },
    clockBtn: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 104,
      borderWidth: 1,
    },
    clockBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    statsRow: { flexDirection: "row", gap: 12 },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: 16,
      alignItems: "center",
    },
    statNumber: { fontSize: 32, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: -1 },
    statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 4, textAlign: "center" },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    taskItem: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 6, gap: 12 },
    priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
    taskTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground },
    taskStatus: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", paddingVertical: 8 },
    loadingRow: { alignItems: "center", paddingVertical: 12 },
  });

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={attendanceLoading || tasksLoading}
            onRefresh={onRefresh}
            tintColor={colors.mutedForeground}
          />
        }
      >
        <View style={s.header}>
          <Text style={s.greeting}>{getGreeting()}</Text>
          <Text style={s.name}>
            {me?.firstName ? `${me.firstName}${me.lastName ? " " + me.lastName : ""}` : "—"}
          </Text>
          <Text style={s.dateText}>{today}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Attendance</Text>
          <View style={s.card}>
            {attendanceLoading ? (
              <View style={s.loadingRow}><ActivityIndicator color={colors.mutedForeground} /></View>
            ) : (
              <View style={s.attendanceRow}>
                <View>
                  <View style={s.statusRow}>
                    <View style={[s.statusDot, { backgroundColor: isClockedIn ? "#22c55e" : attendance?.clockOut ? colors.mutedForeground : "#f59e0b" }]} />
                    <Text style={s.statusLabel}>
                      {isClockedIn ? "Clocked In" : attendance?.clockOut ? "Clocked Out" : "Not Clocked In"}
                    </Text>
                  </View>
                  {clockInTime && (
                    <Text style={s.statusSub}>
                      {isClockedIn ? `Since ${clockInTime}` : `${clockInTime} – ${clockOutTime ?? "—"}`}
                    </Text>
                  )}
                </View>
                {!attendance?.clockOut && (
                  <Pressable
                    style={[
                      s.clockBtn,
                      {
                        backgroundColor: isClockedIn ? "#1e0808" : "#081e08",
                        borderColor: isClockedIn ? colors.destructive : "#22c55e",
                      },
                    ]}
                    onPress={handleClockToggle}
                    disabled={clockingIn || clockingOut}
                  >
                    {clockingIn || clockingOut ? (
                      <ActivityIndicator color={isClockedIn ? colors.destructive : "#22c55e"} size="small" />
                    ) : (
                      <Text style={[s.clockBtnText, { color: isClockedIn ? colors.destructive : "#22c55e" }]}>
                        {isClockedIn ? "Clock Out" : "Clock In"}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Today</Text>
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statNumber}>{pendingTasks.length}</Text>
              <Text style={s.statLabel}>Pending</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statNumber}>{doneTasks.length}</Text>
              <Text style={s.statLabel}>Completed</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>My Tasks</Text>
          <View style={s.card}>
            {tasksLoading ? (
              <View style={s.loadingRow}><ActivityIndicator color={colors.mutedForeground} /></View>
            ) : pendingTasks.length === 0 ? (
              <Text style={s.emptyText}>All caught up!</Text>
            ) : (
              pendingTasks.slice(0, 5).map((task, i) => (
                <React.Fragment key={task.id}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={s.taskItem}>
                    <View style={[s.priorityDot, { backgroundColor: priorityDotColor(task.priority, colors.destructive, colors.mutedForeground) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
                      <Text style={s.taskStatus}>{statusLabel(task.status)}</Text>
                    </View>
                  </View>
                </React.Fragment>
              ))
            )}
          </View>
        </View>

        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>
    </View>
  );
}
