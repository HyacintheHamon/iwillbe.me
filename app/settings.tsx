import React, { useState } from "react";
import { ActivityIndicator, Platform, Share, View } from "react-native";
import { router } from "expo-router";
import { entryInput, entriesOf } from "../src/journey";
import { setDeviceLock } from "../src/privacy-lock";
import { usePractice } from "../src/practice";
import { supabase } from "../src/supabase";
import {
  cancelReminders,
  scheduleReminders,
  downloadReminderCalendar,
  phoneTimeZone,
} from "../src/reminders";
import { validReminderTime, validTimeZone } from "../src/reminder-calendar";
import { INTERESTS, VALUES } from "../src/domain";
import { draftKey, useDraft } from "../src/drafts";
import { exportPractice } from "../src/export-practice";
import {
  Body,
  Button,
  Chip,
  Eyebrow,
  Field,
  Notice,
  Page,
  Sheet,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
type Section = "profile" | "reminders" | "memory" | "account" | "delete";
export default function Settings() {
  const {
    data,
    session,
    saveProfile,
    forget,
    remember,
    clearLocal,
    clearAccountDeviceData,
    refresh,
    putEntry,
    reminderError,
  } = usePractice();
  const {
    draft: profile,
    update: updateProfile,
    ready,
    draftError,
  } = useDraft(draftKey("profile", session?.user.id), data.profile);
  const [feedback, setFeedback] = useState<
    Partial<Record<Section, { text: string; error?: boolean }>>
  >({});
  const [busy, setBusy] = useState<Section | null>(null),
    [memory, setMemory] = useState("");
  const [confirm, setConfirm] = useState(false),
    [confirmText, setConfirmText] = useState("");
  const [morning, setMorning] = useState(data.profile.morning_time),
    [evening, setEvening] = useState(data.profile.evening_time);
  const [timezone, setTimezone] = useState(data.profile.timezone);
  const [reminderRevision, setReminderRevision] = useState(
    data.profile.revision ?? 0,
  );
  const dirty = ["display_name", "north_star", "values", "interests"].some(
    (key) =>
      JSON.stringify(profile[key as keyof typeof profile]) !==
      JSON.stringify(data.profile[key as keyof typeof profile]),
  );
  const run = async (
    section: Section,
    fn: () => Promise<unknown>,
    success?: string,
  ) => {
    if (busy) return;
    setFeedback((current) => ({ ...current, [section]: undefined }));
    setBusy(section);
    try {
      await fn();
      if (success)
        setFeedback((current) => ({
          ...current,
          [section]: { text: success },
        }));
    } catch (e) {
      setFeedback((current) => ({
        ...current,
        [section]: { text: (e as Error).message, error: true },
      }));
    } finally {
      setBusy(null);
    }
  };
  const note = (section: Section) => (
    <Notice
      text={feedback[section]?.text || ""}
      tone={feedback[section]?.error ? "error" : "normal"}
    />
  );
  const changeProfile = (patch: Partial<typeof profile>) => {
    updateProfile(patch);
    setFeedback((current) => ({ ...current, profile: undefined }));
  };
  const toggle = (kind: "values" | "interests", item: string) => {
    const selected = profile[kind];
    if (!selected.includes(item) && selected.length >= 5) {
      setFeedback((current) => ({
        ...current,
        profile: {
          text: "Choose up to five. Remove one to make room for another.",
        },
      }));
      return;
    }
    changeProfile({
      [kind]: selected.includes(item)
        ? selected.filter((v) => v !== item)
        : [...selected, item],
    });
  };
  const exportData = async () => {
    const text = JSON.stringify(
      await exportPractice(data, session?.user.id),
      null,
      2,
    );
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "iwillbe-my-practice.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else
      await Share.share({ title: "My iwillbe.me practice", message: text });
  };
  const remove = () =>
    run("delete", async () => {
      if (confirmText !== "DELETE") return;
      if (session) {
        const owner = session.user.id;
        const { error } = await supabase.functions.invoke("chloe", {
          body: { action: "delete_account", confirmation: "DELETE" },
        });
        if (error)
          throw new Error("Could not delete your account. Please try again.");
        await clearAccountDeviceData(owner);
        await cancelReminders();
        const { error: signOutError } = await supabase.auth.signOut({
          scope: "local",
        });
        if (signOutError) throw signOutError;
      } else await clearLocal();
      setConfirm(false);
      router.replace("/");
    });
  if (!ready)
    return (
      <ActivityIndicator accessibilityLabel="Restoring your preferences" />
    );
  return (
    <Page header={<TopBar title="Make this space yours" />}>
      <View style={s.wrap}>
        <Chip label="My rhythms" onPress={() => router.push("/rhythms")} />
        <Chip
          label="My membership"
          onPress={() => router.push("/membership")}
        />
        <Chip label="Invitations" onPress={() => router.push("/connections")} />
      </View>
      <View style={s.section}>
        <Title style={{ fontSize: 24, lineHeight: 32 }}>My privacy</Title>
        <Body>
          Only you can see your practice. A device lock hides this app; it does
          not encrypt journal text stored by the app.
        </Body>
        {Platform.OS !== "web" ? (
          <>
            <Button
              secondary
              label="Require device unlock"
              onPress={() =>
                run(
                  "account",
                  () => setDeviceLock(true),
                  "Device lock is enabled on this phone.",
                )
              }
            />
            <TextButton
              label="Turn device lock off"
              onPress={() =>
                run(
                  "account",
                  () => setDeviceLock(false),
                  "Device lock is off.",
                )
              }
            />
          </>
        ) : session ? (
          <Button
            secondary
            label="Lock this session"
            onPress={() =>
              run("account", async () => {
                await cancelReminders();
                const { error } = await supabase.auth.signOut({
                  scope: "local",
                });
                if (error) throw error;
                await clearAccountDeviceData(session.user.id);
                router.replace("/account");
              })
            }
          />
        ) : (
          <Body>
            On a shared browser, export your practice and clear the local copy
            when you finish, or use a private browser window.
          </Body>
        )}
        <Chip
          label="Share usage measurements"
          selected={
            !!entriesOf(data, "preferences").find((e) => e.title === "Privacy")
              ?.meta.analytics
          }
          onPress={() =>
            run("account", async () => {
              const prior = entriesOf(data, "preferences").find(
                (e) => e.title === "Privacy",
              );
              await putEntry(
                entryInput("preferences", "Privacy", {
                  id: prior?.id,
                  meta: { analytics: !prior?.meta.analytics },
                }),
              );
            })
          }
        />
        <Body style={{ fontSize: 12 }}>
          Optional usage events are linked to your account to understand return
          visits, action completion and AI response time. They contain no
          journal text, messages or scores.
        </Body>
        {note("account")}
      </View>

      <Eyebrow>YOUR PRACTICE</Eyebrow>
      <Title>A little more like you.</Title>
      <Body>
        {session
          ? `Connected as ${session.user.email}`
          : "Private on this device"}
      </Body>
      <Button
        secondary
        label={session ? "Manage my account and import" : "Save across devices"}
        onPress={() =>
          router.push({
            pathname: "/account",
            params: { returnTo: "/settings", reason: "save" },
          })
        }
      />
      <View style={s.section}>
        <Title style={{ fontSize: 24, lineHeight: 30 }}>
          What matters to you
        </Title>
        <Body>These details are optional. Choose what feels useful.</Body>
        <Field
          label="YOUR NAME"
          value={profile.display_name}
          onChangeText={(display_name) => changeProfile({ display_name })}
          placeholder="Your first name"
          maxLength={80}
        />
        <Field
          label="YOUR NORTH STAR"
          value={profile.north_star}
          onChangeText={(north_star) => changeProfile({ north_star })}
          placeholder="Who matters to you?"
          maxLength={100}
        />
        <Body style={s.label}>VALUES · {profile.values.length}/5 SELECTED</Body>
        <View style={s.wrap}>
          {VALUES.map((v) => (
            <Chip
              key={v}
              label={v}
              selected={profile.values.includes(v)}
              onPress={() => toggle("values", v)}
            />
          ))}
        </View>
        <Body style={s.label}>
          INTERESTS · {profile.interests.length}/5 SELECTED
        </Body>
        <View style={s.wrap}>
          {INTERESTS.map((v) => (
            <Chip
              key={v}
              label={v}
              selected={profile.interests.includes(v)}
              onPress={() => toggle("interests", v)}
            />
          ))}
        </View>
        {dirty && (
          <Body style={{ fontSize: 13 }}>
            Unsaved preferences. Your draft stays here if you leave.
          </Body>
        )}
        <Button
          secondary
          label="Save my preferences"
          loading={busy === "profile"}
          disabled={!!busy || !dirty}
          onPress={() =>
            run(
              "profile",
              async () => {
                const saved = await saveProfile({
                  ...data.profile,
                  revision: profile.revision ?? 0,
                  display_name: profile.display_name.trim(),
                  north_star: profile.north_star.trim(),
                  values: profile.values,
                  interests: profile.interests,
                  onboarded: true,
                });
                updateProfile({ revision: saved.revision });
              },
              "Your preferences are saved.",
            )
          }
        />
        {note("profile")}
        <Notice text={draftError} tone="error" />
      </View>
      <TextButton
        label="About iwillbe.me"
        onPress={() => router.push("/about")}
      />
      <View style={s.section}>
        <Title style={{ fontSize: 24, lineHeight: 30 }}>
          A gentle reminder
        </Title>
        {Platform.OS === "web" ? (
          <>
            <Body>
              Add two gentle daily reminders to your calendar. They can reach
              you when this page is closed, through your calendar’s
              notifications.
            </Body>
            <Field
              label="MORNING · HH:MM"
              value={morning}
              onChangeText={setMorning}
              maxLength={5}
            />
            <Field
              label="NIGHT · HH:MM"
              value={evening}
              onChangeText={setEvening}
              maxLength={5}
            />
            <Field
              label="TIMEZONE"
              value={timezone}
              onChangeText={setTimezone}
              maxLength={80}
              autoCapitalize="none"
            />
            <TextButton
              label="Use this device’s timezone"
              onPress={() => setTimezone(phoneTimeZone())}
            />
            <Body style={{ fontSize: 13 }}>
              Your check-in days use this timezone too. Only the two generic
              reminders go into the calendar; your stories and commitments stay
              here. After importing, you can change or remove the reminders in
              your calendar.
            </Body>
            <Button
              secondary
              label="Download my calendar reminders"
              loading={busy === "reminders"}
              disabled={!!busy}
              onPress={() =>
                run(
                  "reminders",
                  async () => {
                    if (![morning, evening].every(validReminderTime))
                      throw new Error("Use a time like 08:00 or 20:30.");
                    if (!validTimeZone(timezone))
                      throw new Error(
                        "Choose a timezone such as America/New_York.",
                      );
                    const savedProfile = await saveProfile({
                      ...data.profile,
                      revision: reminderRevision,
                      morning_time: morning,
                      evening_time: evening,
                      timezone,
                    });
                    setReminderRevision(savedProfile.revision ?? 0);
                    downloadReminderCalendar(morning, evening, timezone);
                  },
                  "Open the downloaded file in your calendar and accept the reminders. Enable calendar notifications to receive them.",
                )
              }
            />
          </>
        ) : (
          <>
            <Body>
              Your reminders and check-in days follow this phone’s local time,
              including when you travel. We’ll ask permission when you turn
              reminders on.
            </Body>
            <Field
              label="MORNING · HH:MM"
              value={morning}
              onChangeText={setMorning}
              maxLength={5}
            />
            <Field
              label="EVENING · HH:MM"
              value={evening}
              onChangeText={setEvening}
              maxLength={5}
            />
            <Button
              secondary
              label="Set my reminders"
              loading={busy === "reminders"}
              disabled={!!busy}
              onPress={() =>
                run(
                  "reminders",
                  async () => {
                    const savedProfile = await saveProfile({
                      ...data.profile,
                      revision: reminderRevision,
                      morning_time: morning,
                      evening_time: evening,
                      timezone: phoneTimeZone(),
                    });
                    setReminderRevision(savedProfile.revision ?? 0);
                    await scheduleReminders(morning, evening, data);
                  },
                  "Your reminders are set on this phone.",
                )
              }
            />
            <TextButton
              label="Turn reminders off"
              onPress={() =>
                run("reminders", cancelReminders, "Reminders are off.")
              }
            />
          </>
        )}
        {note("reminders")}
        <Notice text={reminderError} tone="error" />
      </View>
      <View style={s.section}>
        <Title style={{ fontSize: 24, lineHeight: 30 }}>
          What Chloe remembers
        </Title>
        <Body>
          Only notes you choose to keep. You can remove them anytime. Chloe also
          uses your saved values and recent reflections.
        </Body>
        {data.memories.map((m) => (
          <View key={m.id} style={s.card}>
            <Body>{m.content}</Body>
            <Body style={{ fontSize: 13 }}>{m.source}</Body>
            <TextButton
              label={`Forget: ${m.content.slice(0, 40)}`}
              onPress={() =>
                run("memory", () => forget(m.id), "This note was removed.")
              }
            />
          </View>
        ))}
        <Field
          label="A NOTE TO REMEMBER"
          multiline
          placeholder="Something you’d like Chloe to keep in mind…"
          value={memory}
          onChangeText={setMemory}
          maxLength={1000}
        />
        <Button
          secondary
          label="Remember this"
          loading={busy === "memory"}
          disabled={!memory.trim() || !!busy}
          onPress={() =>
            run(
              "memory",
              async () => {
                await remember(memory, "Added by you");
                setMemory("");
              },
              "This note is now in your memory.",
            )
          }
        />
        {note("memory")}
      </View>
      <View style={s.section}>
        <Title style={{ fontSize: 24, lineHeight: 30 }}>
          Your space, your choice
        </Title>
        <Body>
          Conversations with Chloe are processed by our AI provider. Your
          journal is never public. Share only what you’re comfortable sharing.
        </Body>
        <TextButton
          label="Export my practice"
          onPress={() => run("account", exportData, "Your export is ready.")}
        />
        {session && (
          <>
            <Body style={{ fontSize: 13 }}>
              Signing out removes this account’s cached practice and unfinished
              drafts from this device. Your saved account data and any separate
              guest practice stay available.
            </Body>
            <TextButton
              label="Refresh from my account"
              onPress={() =>
                run("account", refresh, "Your practice is up to date.")
              }
            />
            <TextButton
              label="Sign out"
              onPress={() =>
                run("account", async () => {
                  await cancelReminders();
                  const { error } = await supabase.auth.signOut();
                  if (error) throw error;
                  await clearAccountDeviceData(session.user.id);
                  router.replace("/");
                })
              }
            />
          </>
        )}
        {note("account")}
        <TextButton
          color="#FFB7B0"
          label={
            session
              ? "Delete my account and data"
              : "Clear practice on this device"
          }
          onPress={() => {
            setConfirmText("");
            setConfirm(true);
          }}
        />
        <Body style={{ fontSize: 13 }}>iwillbe.me · Private beta</Body>
      </View>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={session ? "Delete your account?" : "Clear this practice?"}
      >
        <Body>
          This permanently removes{" "}
          {session
            ? "your account, conversations, intentions and reflections. The separate guest copy on this device remains"
            : "the practice and drafts saved on this device"}
          . Export anything you want to keep first.
        </Body>
        <Field
          label="TYPE DELETE TO CONFIRM"
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
        />
        {note("delete")}
        <Button
          label="Delete permanently"
          disabled={confirmText !== "DELETE" || !!busy}
          loading={busy === "delete"}
          onPress={remove}
        />
        <TextButton
          label="Keep my practice"
          onPress={() => setConfirm(false)}
        />
      </Sheet>
    </Page>
  );
}
