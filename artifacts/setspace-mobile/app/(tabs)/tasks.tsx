import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useGetCurrentUser,
  useListTasks,
  useUpdateTask,
} from "@workspace/api-client-react";
import type { Task } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

const FILTERS = [
  { label: "My Tasks", assigneeMe: true, status: undefined },
  { label: "Pending", assigneeMe: true, status: "todo" },
  { label: "In Progress", assigneeMe: true, status: "in_progress" },
  { label: "Done", assigneeMe: true, status: "done" },
];

function priorityLabel(p: string) {
  switch (p) {
    case "urgent": return "Urgent";
    case "high": return "High";
    case "medium": return "Medium";
    default: return "Low";
  }
}

function priorityColor(p: string, destructive: string): string {
  if (p === "urgent") return destructive;
  if (p === "high") return "#f59e0b";
  if (p === "medium") return "#3b82f6";
  return "#6b7280";
}

function nextStatus(current: string): string {
  if (current === "todo") return "in_progress";
  if (current === "in_progress") return "done";
  return "todo";
}

function nextStatusLabel(current: string): string {
  if (current === "todo") return "Start";
  if (current === "in_progress") return "Complete";
  return "Reopen";
}

function statusColor(status: string, foreground: string, destructive: string): string {
  if (status === "done") return "#22c55e";
  if (status === "in_progress") return "#3b82f6";
  return foreground;
}

function formatDue(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
}

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filterIdx, setFilterIdx] = useState(0);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { data: me } = useGetCurrentUser();
  const filter = FILTERS[filterIdx];

  const params = {
    ...(filter.assigneeMe && me?.id ? { assigneeId: me.id } : {}),
    ...(filter.status ? { status: filter.status } : {}),
  };

  const { data: tasks, isLoading, refetch } = useListTasks(
    Object.keys(params).length > 0 ? params : undefined,
  );
  const { mutateAsync: updateTask } = useUpdateTask();

  const handleAdvance = async (task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpdatingId(task.id);
    try {
      await updateTask({ taskId: task.id, data: { status: nextStatus(task.status) } });
      await refetch();
    } catch {}
    setUpdatingId(null);
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + 20,
      paddingHorizontal: 20,
      paddingBottom: 4,
    },
    headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: -0.5 },
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
    },
    filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingTop: 4 },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: 16,
      marginBottom: 10,
    },
    cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
    priorityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    priorityText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    taskTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, lineHeight: 20 },
    taskDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 10, lineHeight: 18 },
    cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    metaTextOverdue: { color: colors.destructive },
    advanceBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    advanceBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground },
    emptyContainer: { flex: 1, alignItems: "center", paddingTop: 80 },
    emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Tasks</Text>
      </View>

      <View style={s.filterRow}>
        {FILTERS.map((f, i) => (
          <Pressable
            key={f.label}
            style={[
              s.filterChip,
              {
                backgroundColor: i === filterIdx ? colors.primary : colors.card,
                borderColor: i === filterIdx ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              setFilterIdx(i);
              Haptics.selectionAsync();
            }}
          >
            <Text
              style={[
                s.filterChipText,
                { color: i === filterIdx ? colors.primaryForeground : colors.foreground },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : (
        <FlatList
          style={s.list}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 24 }]}
          data={tasks ?? []}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          scrollEnabled={(tasks ?? []).length > 0}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.mutedForeground}
            />
          }
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Text style={s.emptyText}>No tasks here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const dueLabel = formatDue(item.dueDate);
            const isOverdue = dueLabel?.includes("overdue") ?? false;
            const pc = priorityColor(item.priority, colors.destructive);
            const isUpdating = updatingId === item.id;
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.priorityBadge, { backgroundColor: pc + "22" }]}>
                    <Text style={[s.priorityText, { color: pc }]}>{priorityLabel(item.priority)}</Text>
                  </View>
                  <Text style={s.taskTitle}>{item.title}</Text>
                </View>
                {item.description ? (
                  <Text style={s.taskDesc} numberOfLines={2}>{item.description}</Text>
                ) : null}
                <View style={s.cardBottom}>
                  <View style={s.metaRow}>
                    {dueLabel && (
                      <Text style={[s.metaText, isOverdue && s.metaTextOverdue]}>
                        {dueLabel}
                      </Text>
                    )}
                    {item.assignee && (
                      <Text style={s.metaText}>
                        {item.assignee.firstName} {item.assignee.lastName ?? ""}
                      </Text>
                    )}
                  </View>
                  {item.status !== "done" && (
                    <Pressable style={s.advanceBtn} onPress={() => handleAdvance(item)} disabled={isUpdating}>
                      {isUpdating ? (
                        <ActivityIndicator color={colors.mutedForeground} size="small" />
                      ) : (
                        <Text style={s.advanceBtnText}>{nextStatusLabel(item.status)}</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
