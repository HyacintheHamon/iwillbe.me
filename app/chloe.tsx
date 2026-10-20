import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { ArrowUpIcon as ArrowUp } from "phosphor-react-native/src/icons/ArrowUp";
import { BookmarkSimpleIcon as BookmarkSimple } from "phosphor-react-native/src/icons/BookmarkSimple";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import { supabase } from "../src/supabase";
import {
  Body,
  Button,
  C,
  ChloeMark,
  Eyebrow,
  F,
  Notice,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
type Suggestion = { action: string; value: string; person: string };
export default function Chloe() {
  const { data, session, addMessages, remember } = usePractice();
  const [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [suggestion, setSuggestion] = useState<Suggestion | null>(null),
    [memory, setMemory] = useState<string | null>(null),
    [pending, setPending] = useState("");
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!session) {
      setError(
        "Connect an account to talk with Chloe. You can choose an intention on your own anytime.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setPending(text);
    setInput("");
    try {
      const { data: reply, error } = await supabase.functions.invoke("chloe", {
        body: { action: "chat", message: text },
      });
      if (error) {
        let message =
          "Chloe is unavailable right now. Your practice is still here — try again in a moment.";
        try {
          const body = await error.context?.json();
          if (body?.code === "AI_NOT_CONFIGURED")
            message =
              "Chloe’s conversations aren’t available in this beta yet. You can still choose and reflect on your intentions.";
          else if (body?.error) message = body.error;
        } catch {}
        throw new Error(message);
      }
      await addMessages(reply.messages, session.user.id);
      setSuggestion(reply.suggested_intention);
      setMemory(reply.memory_suggestion);
      setPending("");
    } catch (e) {
      setError((e as Error).message);
      setInput(text);
      setPending("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TopBar back={false} title="A moment with Chloe" />
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: 24, gap: 19, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: true })
        }
      >
        {!data.messages.length && (
          <View style={{ gap: 18, paddingTop: 12, paddingBottom: 10 }}>
            <ChloeMark />
            <Eyebrow>YOUR SPACE TO THINK</Eyebrow>
            <Title>{"Let’s find what\nmatters today."}</Title>
            <Body>
              Bring a thought, a feeling, or something you’d like to do
              differently. We’ll find one small step together.
            </Body>
            {!session && (
              <>
                <Notice text="Chloe uses your saved values and reflections to make the conversation personal. Connect an account to begin." />
                <Button
                  secondary
                  label="Connect my account"
                  onPress={() => router.push("/account")}
                />
              </>
            )}
            <TextButton
              label="Choose an intention on my own"
              onPress={() =>
                router.push(data.profile.onboarded ? "/ritual" : "/onboarding")
              }
            />
          </View>
        )}
        {data.messages.map((m) => (
          <View
            key={m.id}
            style={{
              maxWidth: "90%",
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              backgroundColor: m.role === "user" ? C.navy : "#EEE7D8",
              borderRadius: 22,
              borderBottomRightRadius: m.role === "user" ? 6 : 22,
              borderBottomLeftRadius: m.role === "assistant" ? 6 : 22,
              padding: 17,
            }}
          >
            <Body
              style={{
                color: m.role === "user" ? C.white : C.navy,
                fontSize: 15,
                lineHeight: 23,
              }}
            >
              {m.content}
            </Body>
          </View>
        ))}
        {!!pending && (
          <View
            style={{
              alignSelf: "flex-end",
              backgroundColor: C.navy,
              borderRadius: 22,
              padding: 17,
              maxWidth: "90%",
            }}
          >
            <Body style={{ color: C.white }}>{pending}</Body>
          </View>
        )}
        {busy && (
          <View style={s.row}>
            <ChloeMark small />
            <ActivityIndicator color={C.gold} />
            <Body style={{ fontSize: 12 }}>A little space to think…</Body>
          </View>
        )}
        {!!suggestion && (
          <View style={s.card}>
            <Eyebrow>A POSSIBLE INTENTION</Eyebrow>
            <Title style={{ fontSize: 25, lineHeight: 33 }}>
              {suggestion.action}
            </Title>
            <Body style={{ fontSize: 12 }}>
              {suggestion.value} · For {suggestion.person || "myself"}
            </Body>
            <Button
              label="Make it my intention"
              onPress={() =>
                router.push({ pathname: "/ritual", params: suggestion })
              }
            />
          </View>
        )}
        {!!memory && (
          <View style={s.card}>
            <View style={s.row}>
              <BookmarkSimple size={20} color={C.gold} />
              <Eyebrow>KEEP THIS IN MIND?</Eyebrow>
            </View>
            <Body>{memory}</Body>
            <TextButton
              label="Let Chloe remember this"
              onPress={async () => {
                try {
                  await remember(memory, "Confirmed in conversation");
                  setMemory(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
            <TextButton label="Not now" onPress={() => setMemory(null)} />
          </View>
        )}
        <Notice text={error} tone="error" />
      </ScrollView>
      <View
        style={{
          padding: 16,
          borderTopWidth: 1,
          borderColor: C.line,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 10,
        }}
      >
        <TextInput
          accessibilityLabel="Message Chloe"
          placeholder="What’s on your mind?"
          placeholderTextColor={C.muted}
          value={input}
          onChangeText={setInput}
          maxLength={2000}
          multiline
          style={{
            flex: 1,
            fontFamily: F.sans,
            fontSize: 15,
            color: C.navy,
            backgroundColor: "#EEE9DF",
            borderRadius: 24,
            paddingHorizontal: 18,
            paddingVertical: 14,
            maxHeight: 120,
            minHeight: 48,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={busy || !input.trim()}
          onPress={send}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: busy || !input.trim() ? "#D8D1C3" : C.navy,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowUp size={22} color={C.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
