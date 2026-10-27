import React, { useEffect, useRef, useState } from "react";
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
import * as Crypto from "expo-crypto";
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
import {
  entriesOf,
  entryInput,
  returningToPractice,
  suggestedPlanet,
  formatCommitment,
  type EntryKind,
} from "../src/journey";
import { useToday } from "../src/use-today";
import { shiftDay } from "../src/domain";
import {
  ChloeReflection,
  type PendingReflection,
} from "../src/chloe-reflection";
import type { WeeklyFocusProposal } from "../supabase/functions/chloe/proposals";
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
  const { session } = usePractice();
  return <ChloeSession key={session?.user.id || "guest"} />;
}
function ChloeSession() {
  const { data, session, addMessages, remember, putEntry } = usePractice();
  const ownerRef = useRef(session?.user.id);
  const params = useLocalSearchParams<{ mode?: string; question?: string }>();
  const today = useToday();
  const [sessionId, setSessionId] = useState(() => Crypto.randomUUID());
  const [returningToday] = useState(() => returningToPractice(data, today));
  const [notice, setNotice] = useState("");
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [showHistory, setShowHistory] = useState(false);
  const [selectedQuestionDone, setSelectedQuestionDone] = useState(false);
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
    {
      input: params.question || "",
      reflection: null as PendingReflection | null,
      weeklyFocus: null as WeeklyFocusProposal | null,
    },
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
  const activeProposal =
    mode === "night" && draft.reflection
      ? "reflection"
      : suggestion
        ? "intention"
        : whyProposal
          ? "why"
          : discovery
            ? "discovery"
            : ["sunday", "explore"].includes(mode) && draft.weeklyFocus
              ? "focus"
              : memory
                ? "memory"
                : null;
  useEffect(() => {
    ownerRef.current = session?.user.id;
    return () => {
      ownerRef.current = undefined;
    };
  }, [session?.user.id]);
  const send = async (message?: string) => {
    const text = (message ?? input).trim();
    if (!text || busy) return;
    if (!session) {
      setError(
        "Connect an account to talk with Chloe. You can choose an intention on your own anytime.",
      );
      return;
    }
    const owner = session.user.id;
    const assertOwner = () => {
      if (ownerRef.current !== owner)
        throw new Error(
          "Your account changed. This conversation stays with its original account.",
        );
    };
    setBusy(true);
    setError("");
    setPending(text);
    try {
      const skipped =
        /^(skip\b|i don.t know(?: yet)?[.!]?$|not now[.!]?$|ask me something)/i.test(
          text,
        );
      if (skipped && question)
        await putEntry(
          entryInput("question", question, {
            id: entriesOf(data, "question").find((e) => e.title === question)
              ?.id,
            state: "open",
            source: "Chloe · left to sit",
            meta: {
              last_asked_at: new Date().toISOString(),
              last_asked_session: sessionId,
            },
          }),
        );
      assertOwner();
      const { data: reply, error } = await supabase.functions.invoke("chloe", {
        body: {
          action: "chat",
          proposal_cards: true,
          message: text,
          mode,
          session_id: sessionId,
          returning_today: returningToday,
          area: suggestedPlanet(data, today),
        },
      });
      assertOwner();
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
      await addMessages(reply.messages, owner);
      assertOwner();
      update({
        ...(message === undefined || message === input ? { input: "" } : {}),
        ...(reply.reflection_proposal
          ? {
              reflection: {
                ...reply.reflection_proposal,
                pending_revision:
                  data.checkIns.find(
                    (c) =>
                      c.intention_id === reply.reflection_proposal.intention_id,
                  )?.revision ?? 0,
              },
            }
          : {}),
        ...(reply.weekly_focus ? { weeklyFocus: reply.weekly_focus } : {}),
      });
      if (message === params.question) setSelectedQuestionDone(true);
      setSuggestion(reply.suggested_intention);
      setMemory(reply.memory_suggestion);
      setQuestion(reply.question || null);
      setDiscovery(reply.discovery || null);
      setWhyProposal(reply.why_proposal || null);
      try {
        const asked = entriesOf(data, "question").find(
          (e) => e.title === reply.question,
        );
        if (asked)
          await putEntry({
            ...asked,
            meta: {
              ...asked.meta,
              last_asked_at: new Date().toISOString(),
              last_asked_session: sessionId,
            },
          });
        assertOwner();
        const answered = entriesOf(data, "question").find(
          (e) => e.title === question,
        );
        if (answered && !skipped)
          await putEntry({ ...answered, state: "answered", body: text });
        assertOwner();
      } catch {
        assertOwner();
        setNotice(
          "Your conversation is saved. The question’s status could not be updated yet.",
        );
      }
      setPending("");
    } catch (e) {
      if (ownerRef.current !== owner) return;
      setError((e as Error).message);
      if (message === undefined) setInput(text);
      setPending("");
    } finally {
      if (ownerRef.current === owner) setBusy(false);
    }
  };
  if (!ready)
    return <ActivityIndicator accessibilityLabel="Restoring your message" />;
  if (!session)
    return (
      <Page header={<TopBar back={false} title="A moment with Chloe" />}>
        <ChloeMark />
        <Eyebrow>About two minutes · one small step</Eyebrow>
        <Title>Let’s find one small step.</Title>
        <Body>
          Choose an intention on your own now, or connect an account for a
          personal conversation with Chloe.
        </Body>
        {params.question ? (
          <View style={s.card}>
            <Eyebrow>Your Open Question</Eyebrow>
            <Body>{params.question}</Body>
            <Body style={{ fontSize: 13 }}>
              This question will come with you when you connect. Your other
              draft stays saved.
            </Body>
          </View>
        ) : null}
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
                params: {
                  returnTo: "/chloe",
                  reason: "chloe",
                  question: params.question || "",
                },
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
            ["sunday", "Sunday Explore"],
            ["fullmoon", "Monthly"],
            ["why", "My why"],
          ] as const
        ).map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            selected={mode === id}
            disabled={busy}
            onPress={() => {
              if (busy) return;
              setMode(id);
              setStartedAt(new Date().toISOString());
              setSessionId(Crypto.randomUUID());
              setQuestion(null);
              setSuggestion(null);
              setDiscovery(null);
              setMemory(null);
              setWhyProposal(null);
            }}
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
        {params.question && !selectedQuestionDone ? (
          <View style={s.card}>
            <Eyebrow>Your Open Question</Eyebrow>
            <Body>{params.question}</Body>
            <Button
              label="Think about this question"
              loading={busy}
              onPress={() => {
                void send(params.question);
              }}
            />
            <Body style={{ fontSize: 13 }}>
              Your other draft stays in the message box.
            </Body>
          </View>
        ) : null}
        {!params.question &&
        !data.messages.some((m) => m.created_at >= startedAt) &&
        !pending ? (
          <View style={s.card}>
            <Body>
              {mode === "night"
                ? "A brief look at today, then let the night be yours."
                : mode === "sunday" || mode === "explore"
                  ? "A little room to notice what is taking shape."
                  : "One small question, then a step out in your life."}
            </Body>
            <Button
              label={
                mode === "night"
                  ? "Begin tonight"
                  : mode === "sunday"
                    ? "Begin Sunday Explore"
                    : "Begin this moment"
              }
              loading={busy}
              onPress={() =>
                void send(
                  mode === "night"
                    ? "Let's reflect on today."
                    : mode === "sunday"
                      ? "Let's look at this week."
                      : "Help me begin with one question.",
                )
              }
            />
          </View>
        ) : null}
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
        {data.messages.some((m) => m.created_at < startedAt) ? (
          <TextButton
            label={
              showHistory
                ? "Hide earlier conversations"
                : "Earlier conversations"
            }
            onPress={() => setShowHistory(!showHistory)}
          />
        ) : null}
        {data.messages
          .filter((m) => showHistory || m.created_at >= startedAt)
          .map((m) => (
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
              backgroundColor: "#2D315B",
              borderRadius: 22,
              padding: 17,
              maxWidth: "90%",
            }}
          >
            <Body style={{ color: C.navy }}>{pending}</Body>
          </View>
        )}
        {busy && (
          <View style={s.row}>
            <ChloeMark small />
            <ActivityIndicator color={C.gold} />
            <Body style={{ fontSize: 12 }}>A little space to think…</Body>
          </View>
        )}
        {draft.reflection && activeProposal === "reflection" ? (
          <ChloeReflection
            key={draft.reflection.intention_id}
            proposal={draft.reflection}
            onChange={(reflection) => update({ reflection })}
            onSaved={() => {
              update({ reflection: null });
              setQuestion(null);
              setNotice("Saved. Let the rest of the night be yours.");
            }}
            onDismiss={() => update({ reflection: null })}
          />
        ) : null}
        {draft.weeklyFocus && activeProposal === "focus" ? (
          <View style={s.card}>
            <Eyebrow>A little direction for your mornings</Eyebrow>
            <Body>{draft.weeklyFocus.reason}</Body>
            <Body>
              This week I’ll lean toward {draft.weeklyFocus.area} in your
              mornings.
            </Body>
            <Button
              label="Yes, use this focus"
              onPress={async () => {
                const focus = draft.weeklyFocus;
                if (!focus) return;
                try {
                  const prefs = entriesOf(data, "preferences").find(
                    (e) => e.title === "Season",
                  );
                  if (
                    prefs?.meta.pace === "stay" &&
                    prefs.meta.orbit !== focus.area
                  )
                    throw new Error(
                      "Your fixed focus has changed. Keep it, or choose a new focus in Rhythms.",
                    );
                  await putEntry(
                    entryInput("preferences", "Season", {
                      ...prefs,
                      source: "Confirmed in Sunday Explore",
                      source_ids: focus.source_ids,
                      meta: {
                        ...prefs?.meta,
                        focus_area: focus.area,
                        focus_until: shiftDay(today, 6),
                      },
                    }),
                  );
                  update({ weeklyFocus: null });
                  setNotice("Your mornings will carry this forward.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
            <TextButton
              label="Keep my current focus"
              onPress={() => update({ weeklyFocus: null })}
            />
          </View>
        ) : null}
        {!!suggestion && activeProposal === "intention" && (
          <View style={s.card}>
            <Eyebrow>A POSSIBLE INTENTION</Eyebrow>
            <Title style={{ fontSize: 25, lineHeight: 33 }}>
              {formatCommitment(suggestion.action)}
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
        {!!memory && activeProposal === "memory" && (
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
        {discovery && activeProposal === "discovery" ? (
          <View style={s.card}>
            <Eyebrow>
              A possible {discovery.kind} · does this feel like you?
            </Eyebrow>
            <Title style={{ fontSize: 24, lineHeight: 30 }}>
              {discovery.title}
            </Title>
            <Body>{discovery.body}</Body>
            <Button
              label={
                discovery.kind === "interest"
                  ? "Add as a Maybe"
                  : discovery.kind === "value"
                    ? "Try this value on"
                    : discovery.kind === "person"
                      ? "Add to People I admire"
                      : "Keep this strength"
              }
              onPress={async () => {
                try {
                  await putEntry(
                    entryInput(discovery.kind, discovery.title, {
                      body: discovery.body,
                      id: entriesOf(data, discovery.kind).find(
                        (e) =>
                          e.title.toLowerCase() ===
                          discovery.title.toLowerCase(),
                      )?.id,
                      state:
                        entriesOf(data, discovery.kind).find(
                          (e) =>
                            e.title.toLowerCase() ===
                            discovery.title.toLowerCase(),
                        )?.state ||
                        (discovery.kind === "interest"
                          ? "spark"
                          : discovery.kind === "value"
                            ? "trying"
                            : "active"),
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
            <Eyebrow>Room to let it sit</Eyebrow>
            <TextButton
              label="Save this question for later"
              onPress={async () => {
                try {
                  await putEntry(
                    entryInput("question", question, {
                      id: entriesOf(data, "question").find(
                        (e) => e.title === question,
                      )?.id,
                      state: "open",
                      source: "Chloe · deferred by you",
                      meta: {
                        last_asked_at: new Date().toISOString(),
                        last_asked_session: sessionId,
                      },
                    }),
                  );
                  setQuestion(null);
                  setNotice(
                    "Let it sit with you today. We can come back to it another time.",
                  );
                  setInput("");
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
                      id: entriesOf(data, "question").find(
                        (e) => e.title === question,
                      )?.id,
                      state: "stopped",
                      source: "Chloe · stopped by you",
                      meta: {
                        last_asked_at: new Date().toISOString(),
                        last_asked_session: sessionId,
                      },
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
        {whyProposal && activeProposal === "why" ? (
          <View style={s.card}>
            <Eyebrow>Here’s what I’m starting to hear</Eyebrow>
            <Body>{whyProposal.text}</Body>
            <Body style={{ fontSize: 13 }}>
              {whyProposal.source_ids
                .map(
                  (id) =>
                    data.entries.find((e) => e.id === id)?.title ||
                    data.intentions.find((i) => i.id === id)?.action ||
                    data.messages.find((m) => m.id === id && m.role === "user")
                      ?.content,
                )
                .filter(Boolean)
                .map((piece) => `“${piece}”`)
                .join(" · ")}
            </Body>
            <Body>Want to update your why?</Body>
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
        <Notice text={notice} />
        <TextButton
          label="Ask me something else"
          onPress={() => {
            void send("Ask me something else.");
          }}
        />
        <TextButton label="Done for now" onPress={() => router.replace("/")} />
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
          onPress={() => {
            void send();
          }}
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
