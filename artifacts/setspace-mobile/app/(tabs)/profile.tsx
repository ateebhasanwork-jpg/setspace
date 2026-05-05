import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Alert,
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
  useListNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

function initials(first?: string | null, last?: string | null): string {
  return ((first ?? "").charAt(0) + (last ?? "").charAt(0)).toUpperCase() || "?";
}

function formatNotifTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function notifTypeColor(type: string): string {
  switch (type) {
    case "task": return "#3b82f6";
    case "attendance": return "#22c55e";
    case "message": return "#8b5cf6";
    default: return "#6b7280";
  }
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  const { data: me, isLoading: meLoading } = useGetCurrentUser();
  const { data: notifications, isLoading: notifsLoading, refetch: refetchNotifs } = useListNotifications();
  const { mutateAsync: markRead } = useMarkNotificationRead();
  const { mutateAsync: markAllRead, isPending: markingAll } = useMarkAllNotificationsRead();

  const unreadCount = (notifications ?? []).filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await markAllRead();
      await refetchNotifs();
    } catch {}
  };

  const handleMarkRead = async (n: Notification) => {
    if (n.isRead) return;
    try {
      await markRead({ notificationId: n.id });
      await refetchNotifs();
    } catch {}
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
        },
      },
    ]);
  };

  const avatarBg = "#1f1f1f";

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    profileSection: {
      paddingTop: insets.top + 24,
      paddingHorizontal: 20,
      paddingBottom: 28,
      alignItems: "center",
    },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: avatarBg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    avatarText: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground },
    userName: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: -0.4 },
    userRole: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 4, textTransform: "capitalize" },
    userDept: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    section: { paddingHorizontal: 20, marginBottom: 28 },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    sectionTitle: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    markAllBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    markAllText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    unreadBadge: {
      backgroundColor: colors.destructive,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginLeft: 8,
    },
    unreadBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#ffffff" },
    badgeRow: { flexDirection: "row", alignItems: "center" },
    notifCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: 14,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    notifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
    notifContent: { flex: 1 },
    notifTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    notifTitleRead: { fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    notifBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2, lineHeight: 18 },
    notifTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 4 },
    emptyNotif: {
      paddingVertical: 24,
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
    },
    emptyNotifText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    logoutBtn: {
      marginHorizontal: 20,
      marginBottom: insets.bottom + 24,
      height: 50,
      backgroundColor: "#1e0808",
      borderWidth: 1,
      borderColor: colors.destructive,
      borderRadius: colors.radius,
      alignItems: "center",
      justifyContent: "center",
    },
    logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.destructive },
    loadingRow: { alignItems: "center", paddingVertical: 20 },
  });

  return (
    <View style={s.container}>
      <FlatList
        data={notifications ?? []}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={meLoading || notifsLoading}
            onRefresh={refetchNotifs}
            tintColor={colors.mutedForeground}
          />
        }
        ListHeaderComponent={
          <>
            <View style={s.profileSection}>
              {meLoading ? (
                <ActivityIndicator color={colors.mutedForeground} />
              ) : (
                <>
                  <View style={s.avatarCircle}>
                    <Text style={s.avatarText}>{initials(me?.firstName, me?.lastName)}</Text>
                  </View>
                  <Text style={s.userName}>
                    {me?.firstName ?? "—"} {me?.lastName ?? ""}
                  </Text>
                  {me?.role ? <Text style={s.userRole}>{me.role}</Text> : null}
                </>
              )}
            </View>

            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.badgeRow}>
                  <Text style={s.sectionTitle}>Notifications</Text>
                  {unreadCount > 0 && (
                    <View style={s.unreadBadge}>
                      <Text style={s.unreadBadgeText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
                {unreadCount > 0 && (
                  <Pressable style={s.markAllBtn} onPress={handleMarkAllRead} disabled={markingAll}>
                    {markingAll ? (
                      <ActivityIndicator color={colors.mutedForeground} size="small" />
                    ) : (
                      <Text style={s.markAllText}>Mark all read</Text>
                    )}
                  </Pressable>
                )}
              </View>

              {notifsLoading && (
                <View style={s.loadingRow}>
                  <ActivityIndicator color={colors.mutedForeground} />
                </View>
              )}
              {!notifsLoading && (notifications ?? []).length === 0 && (
                <View style={s.emptyNotif}>
                  <Text style={s.emptyNotifText}>No notifications</Text>
                </View>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[s.section, { paddingTop: 0, paddingBottom: 0, marginBottom: 0 }]}
            onPress={() => handleMarkRead(item)}
          >
            <View style={[s.notifCard, item.isRead && { opacity: 0.6 }]}>
              <View style={[s.notifDot, { backgroundColor: notifTypeColor(item.type) }]} />
              <View style={s.notifContent}>
                <Text style={[s.notifTitle, item.isRead && s.notifTitleRead]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.body ? <Text style={s.notifBody} numberOfLines={2}>{item.body}</Text> : null}
                <Text style={s.notifTime}>{formatNotifTime(item.createdAt)}</Text>
              </View>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutText}>Sign Out</Text>
          </Pressable>
        }
      />
    </View>
  );
}
