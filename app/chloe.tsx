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
import { router, useLocalSearchParams } from "expo-router";
import { draftKey, useDraft } from "../src/drafts";
import { usePractice } from "../src/practice";
import { supabase } from "../src/supabase";
import {
  Body,
  Chip,
  Button,
  C,
  ChloeMark,
  Eyebrow,
  F,
  Notice,
  Page,
  Field,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
import { entryInput, type EntryKind } from "../src/journey";
type Suggestion = {
  action: string;
  value: string;
  person: string;
  interest?: string;
  planet?: string;
  when_context?: string;
  with_person?: string;
};
export default function Chloe() {
  const { data, session, addMessages, remember, putEntry } = usePractice();
  const params = useLocalSearchParams<{ mode?: string; question?: string }>();
  const [discovery, setDiscovery] = useState<{
    kind: EntryKind;
    title: string;
    body: string;
    source_ids: string[];
  } | null>(null);
  const [mode, setMode] = useState(params.mode || "morning");
  const [question, setQuestion] = useState<string | null>(null),
    [whyProposal, setWhyProposal] = useState<{
      text: string;
      source_ids: string[];
    } | null>(null);
  const { draft, update, ready, draftError } = useDraft(
    draftKey("chloe", session?.user.id),
    { input: params.question || "" },
  );
  const input = draft.input;
  const incoming = useDraft(draftKey("chloe.incoming", session?.user.id), {
    input: "",
  });
  const setInput = (input: string) => update({ input });
  const [busy, setBusy] = useState(false),
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
    try {
      const { data: reply, error } = await supabase.functions.invoke("chloe", {
        body: { action: "chat", message: text, mode },
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
      setInput("");
      setSuggestion(reply.suggested_intention);
      setMemory(reply.memory_suggestion);
      setQuestion(reply.question || null);
      setDiscovery(reply.discovery || null);
      setWhyProposal(reply.why_proposal || null);
      setPending("");
    } catch (e) {
      setError((e as Error).message);
      setInput(text);
      setPending("");
    } finally {
      setBusy(false);
    }
  };
  if (!ready)
    return <ActivityIndicator accessibilityLabel="Restoring your message" />;
  if (!session)
    return (
      <Page header={<TopBar back={false} title="A moment with Chloe" />}>
        <ChloeMark />
        <Eyebrow>YOUR SPACE TO THINK</Eyebrow>
        <Title>Let’s find one small step.</Title>
        <Body>
          Choose an intention on your own now, or connect an account for a
          personal conversation with Chloe.
        </Body>
        <Button
          label="Choose an intention"
          onPress={() => router.push("/ritual")}
        />
        <View style={s.section}>
          <Title style={{ fontSize: 24, lineHeight: 30 }}>
            Talk it through with Chloe
          </Title>
          <Body>
            Chloe uses your saved values and reflections. Messages are processed
            by our AI provider. A conversation needs an account.
          </Body>
          <Field
            label="DRAFT FOR CHLOE · OPTIONAL"
            placeholder="What’s on your mind?"
            multiline
            value={input}
            onChangeText={setInput}
            maxLength={2000}
          />
          <Body style={{ fontSize: 13 }}>
            Your draft stays on this device. Nothing is sent until you connect
            and press Send.
          </Body>
          <Button
            secondary
            label="Connect and continue with Chloe"
            onPress={() =>
              router.push({
                pathname: "/account",
                params: { returnTo: "/chloe", reason: "chloe" },
              })
            }
          />
          <Notice text={draftError} tone="error" />
        </View>
      </Page>
    );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TopBar back={false} title="A moment with Chloe" />
      <ScrollView
        horizontal
        contentContainerStyle={{
          gap: 8,
          paddingHorizontal: 20,
          paddingBottom: 10,
        }}
        style={{ flexGrow: 0, flexShrink: 0 }}
      >
        {(
          [
            ["morning", "Today"],
            ["night", "Tonight"],
            ["discovery", "Discover"],
            ["explore", "Explore"],
            ["why", "My why"],
          ] as const
        ).map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            selected={mode === id}
            onPress={() => setMode(id)}
          />
        ))}
      </ScrollView>
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
            <TextButton
              label="Choose an intention on my own"
              onPress={() => router.push("/ritual")}
            />
          </View>
        )}
        {data.messages.map((m) => (
          <View
            key={m.id}
            style={{
              maxWidth: "90%",
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              backgroundColor: m.role === "user" ? "#2D315B" : C.white,
              borderRadius: 22,
              borderBottomRightRadius: m.role === "user" ? 6 : 22,
              borderBottomLeftRadius: m.role === "assistant" ? 6 : 22,
              padding: 17,
            }}
          >
            <Body
              style={{
                color: C.navy,
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
        {!!incoming.draft.input && (
          <View style={s.card}>
            <Eyebrow>ANOTHER SAVED DRAFT</Eyebrow>
            <Body>{incoming.draft.input}</Body>
            <Body>
              Choose which draft to continue. Switching keeps the other draft
              here; your original device copy remains saved.
            </Body>
            <TextButton
              label="Use this draft"
              onPress={() => {
                const previous = input;
                setInput(incoming.draft.input);
                incoming.update({ input: previous });
              }}
            />
            <TextButton
              label="Keep my current draft"
              onPress={() => incoming.update({ input: "" })}
            />
          </View>
        )}
        <Notice
          text={error || draftError || incoming.draftError}
          tone="error"
        />
        {discovery ? (
          <View style={s.card}>
            <Eyebrow>
              A possible {discovery.kind} · does this feel like you?
            </Eyebrow>
            <Title style={{ fontSize: 24, lineHeight: 30 }}>
              {discovery.title}
            </Title>
            <Body>{discovery.body}</Body>
            <Button
              label="Yes, add this to my galaxy"
              onPress={async () => {
                try {
                  await putEntry(
                    entryInput(discovery.kind, discovery.title, {
                      body: discovery.body,
                      state: "spark",
                      source: "Proposed by Chloe · confirmed by you",
                      source_ids: discovery.source_ids,
                    }),
                  );
                  setDiscovery(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
            <TextButton
              label="Not quite"
              onPress={() => {
                setInput(`Not quite: ${discovery.title}. `);
                setDiscovery(null);
              }}
            />
            <TextButton
              label="Leave this for now"
              onPress={() => setDiscovery(null)}
            />
          </View>
        ) : null}
        {question ? (
          <View style={s.card}>
            <Body>{question}</Body>
            <TextButton
              label="Save this question for later"
              onPress={async () => {
                try {
                  await putEntry(
                    entryInput("question", question, {
                      state: "open",
                      source: "Chloe · deferred by you",
                    }),
                  );
                  setQuestion(null);
                  setInput("Ask me something different, please.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
            <TextButton
              label="Stop asking this question"
              onPress={async () => {
                try {
                  await putEntry(
                    entryInput("question", question, {
                      state: "stopped",
                      source: "Chloe · stopped by you",
                    }),
                  );
                  setQuestion(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </View>
        ) : null}
        {whyProposal ? (
          <View style={s.card}>
            <Eyebrow>A possible next version · for you to decide</Eyebrow>
            <Body>{whyProposal.text}</Body>
            <Button
              label="Keep this as my why"
              onPress={async () => {
                try {
                  await putEntry(
                    entryInput("why", "My why", {
                      body: whyProposal.text,
                      state: "accepted",
                      source: "Proposed by Chloe · accepted by you",
                      source_ids: whyProposal.source_ids,
                    }),
                  );
                  setWhyProposal(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
            <TextButton
              label="Shape it in my words"
              onPress={async () => {
                try {
                  await putEntry(
                    entryInput("why", "A possible why", {
                      body: whyProposal.text,
                      state: "proposed",
                      source: "Proposed by Chloe",
                      source_ids: whyProposal.source_ids,
                    }),
                  );
                  router.push("/why");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
            <TextButton
              label="Keep my current why"
              onPress={() => setWhyProposal(null)}
            />
          </View>
        ) : null}
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
          editable={!busy}
          value={input}
          onChangeText={setInput}
          maxLength={2000}
          multiline
          style={{
            flex: 1,
            fontFamily: F.sans,
            fontSize: 15,
            color: C.navy,
            backgroundColor: C.white,
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
            backgroundColor: busy || !input.trim() ? C.line : C.gold,
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
