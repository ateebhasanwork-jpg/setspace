import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useCreateMessage,
  useGetCurrentUser,
  useListMessages,
} from "@workspace/api-client-react";
import type { Message } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

function initials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName ?? "").charAt(0).toUpperCase();
  const l = (lastName ?? "").charAt(0).toUpperCase();
  return f + l || "?";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function avatarColor(name: string): string {
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function groupMessages(messages: Message[]): Array<Message | { type: "date"; label: string; key: string }> {
  const result: Array<Message | { type: "date"; label: string; key: string }> = [];
  let lastDate = "";
  for (const msg of [...messages].reverse()) {
    const dateLabel = formatDate(msg.createdAt);
    if (dateLabel !== lastDate) {
      result.push({ type: "date", label: dateLabel, key: `date-${msg.createdAt}` });
      lastDate = dateLabel;
    }
    result.push(msg);
  }
  return result.reverse();
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: me } = useGetCurrentUser();
  const { data: messages, isLoading, refetch } = useListMessages(
    { limit: 60 },
    { query: { refetchInterval: 4000 } },
  );
  const { mutateAsync: sendMessage, isPending: sending } = useCreateMessage();

  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const grouped = groupMessages(messages ?? []);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await sendMessage({ data: { content } });
      await refetch();
    } catch {}
  };

  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages?.length]);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + 16,
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: -0.3 },
    headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    messageList: { flex: 1 },
    messageListContent: { paddingHorizontal: 16, paddingVertical: 12 },
    dateSep: { alignItems: "center", marginVertical: 12 },
    dateSepText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    msgRow: { flexDirection: "row", marginBottom: 12, gap: 10 },
    msgRowMe: { flexDirection: "row-reverse" },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    avatarText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#ffffff" },
    bubble: {
      maxWidth: "72%",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleOther: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopLeftRadius: 4,
    },
    bubbleMe: {
      backgroundColor: colors.primary,
      borderTopRightRadius: 4,
    },
    senderName: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      marginBottom: 4,
    },
    messageText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 20 },
    messageTextOther: { color: colors.foreground },
    messageTextMe: { color: colors.primaryForeground },
    msgTime: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 4,
      alignSelf: "flex-end",
    },
    msgTimeMe: { color: colors.primaryForeground, opacity: 0.6 },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: insets.bottom + 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 10,
    },
    input: {
      flex: 1,
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      maxHeight: 120,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnDisabled: { backgroundColor: colors.accent, opacity: 0.4 },
    sendArrow: { fontSize: 18, color: colors.primaryForeground },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
    emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Team Chat</Text>
        <Text style={s.headerSub}>All messages are visible to everyone</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator color={colors.mutedForeground} />
          </View>
        ) : grouped.length === 0 ? (
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>No messages yet. Say hello!</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            style={s.messageList}
            contentContainerStyle={s.messageListContent}
            data={grouped}
            keyExtractor={(item) => ("type" in item ? item.key : String(item.id))}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              if ("type" in item) {
                return (
                  <View style={s.dateSep}>
                    <Text style={s.dateSepText}>{item.label}</Text>
                  </View>
                );
              }
              const isMe = item.authorId === me?.id;
              const authorName = item.author
                ? `${item.author.firstName} ${item.author.lastName ?? ""}`.trim()
                : "Unknown";
              const color = avatarColor(authorName);
              return (
                <View style={[s.msgRow, isMe && s.msgRowMe]}>
                  <View style={[s.avatar, { backgroundColor: color }]}>
                    <Text style={s.avatarText}>
                      {initials(item.author?.firstName, item.author?.lastName)}
                    </Text>
                  </View>
                  <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
                    {!isMe && <Text style={s.senderName}>{authorName}</Text>}
                    <Text style={[s.messageText, isMe ? s.messageTextMe : s.messageTextOther]}>
                      {item.content}
                    </Text>
                    <Text style={[s.msgTime, isMe && s.msgTimeMe]}>
                      {formatTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Message the team..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            returnKeyType="default"
          />
          <Pressable
            style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={s.sendArrow}>↑</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
