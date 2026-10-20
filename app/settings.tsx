import React, { useState } from "react";
import { Platform, Share, View } from "react-native";
import { router } from "expo-router";
import { BellIcon as Bell } from "phosphor-react-native/src/icons/Bell";
import { BookmarkSimpleIcon as BookmarkSimple } from "phosphor-react-native/src/icons/BookmarkSimple";
import { CloudCheckIcon as CloudCheck } from "phosphor-react-native/src/icons/CloudCheck";
import { DeviceMobileIcon as DeviceMobile } from "phosphor-react-native/src/icons/DeviceMobile";
import { usePractice } from "../src/practice";
import { supabase } from "../src/supabase";
import { cancelReminders, scheduleReminders } from "../src/reminders";
import { VALUES } from "../src/domain";
import { exportPractice } from "../src/export-practice";
import {
  Body,
  Button,
  C,
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
export default function Settings() {
  const { data, session, saveProfile, forget, remember, clearLocal, refresh } =
    usePractice();
  const [profile, setProfile] = useState(data.profile),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [memory, setMemory] = useState(""),
    [confirm, setConfirm] = useState(false),
    [confirmText, setConfirmText] = useState("");
  const run = async (fn: () => Promise<void>, success?: string) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      if (success) setNotice(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const exportData = async () => {
    const text = JSON.stringify(
      await exportPractice(data, session?.user.id),
      null,
      2,
    );
    if (Platform.OS === "web") {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "iwillbe-my-practice.json";
      a.click();
      URL.revokeObjectURL(url);
    } else
      await Share.share({ title: "My iwillbe.me practice", message: text });
  };
  const remove = async () => {
    if (confirmText !== "DELETE") return;
    await run(async () => {
      if (session) {
        const { error } = await supabase.functions.invoke("chloe", {
          body: { action: "delete_account", confirmation: "DELETE" },
        });
        if (error)
          throw new Error("Could not delete your account. Please try again.");
        await cancelReminders();
        await supabase.auth.signOut({ scope: "local" });
      } else await clearLocal();
      setConfirm(false);
      router.replace("/");
    });
  };
  return (
    <Page header={<TopBar title="Make this space yours" />}>
      <Eyebrow>YOUR PRACTICE</Eyebrow>
      <Title>{"A little more\nlike you."}</Title>
      <View style={s.row}>
        {session ? (
          <CloudCheck size={22} color={C.gold} />
        ) : (
          <DeviceMobile size={22} color={C.gold} />
        )}
        <Body style={{ fontSize: 13 }}>
          {session
            ? `Saved to your account · ${session.user.email}`
            : "Private on this device"}
        </Body>
      </View>
      {!session && (
        <Button
          secondary
          label="Connect an account"
          onPress={() => router.push("/account")}
        />
      )}
      <Field
        label="YOUR NAME"
        value={profile.display_name}
        onChangeText={(display_name) =>
          setProfile({ ...profile, display_name })
        }
        placeholder="Your first name"
        maxLength={80}
      />
      <Field
        label="YOUR NORTH STAR"
        value={profile.north_star}
        onChangeText={(north_star) => setProfile({ ...profile, north_star })}
        placeholder="Who matters to you?"
        maxLength={100}
      />
      <Body style={s.label}>VALUES YOU WANT TO LIVE</Body>
      <View style={s.wrap}>
        {VALUES.map((v) => (
          <Chip
            key={v}
            label={v}
            selected={profile.values.includes(v)}
            onPress={() =>
              setProfile({
                ...profile,
                values: profile.values.includes(v)
                  ? profile.values.filter((x) => x !== v)
                  : [...profile.values, v].slice(0, 5),
              })
            }
          />
        ))}
      </View>
      <Button
        secondary
        label="Save my preferences"
        loading={busy}
        onPress={() =>
          run(() => saveProfile(profile), "Your preferences are saved.")
        }
      />
      <View style={s.section}>
        <View style={s.row}>
          <Bell size={22} color={C.gold} />
          <Title style={{ fontSize: 24, lineHeight: 30 }}>
            A gentle reminder
          </Title>
        </View>
        <Body style={{ fontSize: 13 }}>
          {Platform.OS === "web"
            ? "Reminders can be set in the iOS or Android app."
            : "Choose a morning and evening time on this phone."}
        </Body>
        <View style={[s.row, { alignItems: "flex-start" }]}>
          <View style={{ flex: 1 }}>
            <Field
              label="MORNING"
              value={profile.morning_time}
              onChangeText={(morning_time) =>
                setProfile({ ...profile, morning_time })
              }
              placeholder="08:00"
              maxLength={5}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="EVENING"
              value={profile.evening_time}
              onChangeText={(evening_time) =>
                setProfile({ ...profile, evening_time })
              }
              placeholder="20:30"
              maxLength={5}
            />
          </View>
        </View>
        <Button
          secondary
          label="Set my reminders"
          disabled={Platform.OS === "web" || busy}
          onPress={() =>
            run(async () => {
              await scheduleReminders(
                profile.morning_time,
                profile.evening_time,
              );
              await saveProfile(profile);
            }, "Your reminders are set on this phone.")
          }
        />
        {Platform.OS !== "web" && (
          <TextButton
            label="Turn reminders off"
            onPress={() => run(cancelReminders, "Reminders are off.")}
          />
        )}
      </View>
      <View style={s.section}>
        <View style={s.row}>
          <BookmarkSimple size={22} color={C.gold} />
          <Title style={{ fontSize: 24, lineHeight: 30 }}>
            What Chloe remembers
          </Title>
        </View>
        <Body style={{ fontSize: 13 }}>
          Only notes you choose to keep. You can remove them anytime. Chloe also
          uses your saved values and recent reflections.
        </Body>
        {data.memories.map((m) => (
          <View
            key={m.id}
            style={{
              borderBottomWidth: 1,
              borderColor: C.line,
              paddingBottom: 12,
              gap: 5,
            }}
          >
            <Body>{m.content}</Body>
            <Body style={{ fontSize: 11, color: C.muted }}>{m.source}</Body>
            <TextButton
              label="Forget this"
              onPress={() => run(() => forget(m.id))}
            />
          </View>
        ))}
        <Field
          multiline
          placeholder="Something you’d like Chloe to keep in mind…"
          value={memory}
          onChangeText={setMemory}
          maxLength={1000}
        />
        <Button
          secondary
          label="Remember this"
          disabled={!memory.trim() || busy}
          onPress={() =>
            run(async () => {
              await remember(memory, "Added by you");
              setMemory("");
            }, "This note is now in your memory.")
          }
        />
      </View>
      <Notice text={notice} />
      <Notice text={error} tone="error" />
      <View style={s.section}>
        <Title style={{ fontSize: 24, lineHeight: 30 }}>
          Your space, your choice
        </Title>
        <Body style={{ fontSize: 13 }}>
          Conversations with Chloe are processed by our AI provider. Your
          journal is never public. Share only what you’re comfortable sharing.
        </Body>
        <TextButton
          label="Export my practice"
          onPress={() => run(exportData)}
        />
        {session && (
          <>
            <TextButton
              label="Refresh from my account"
              onPress={() => run(refresh, "Your practice is up to date.")}
            />
            <TextButton
              label="Sign out"
              onPress={() =>
                run(async () => {
                  await cancelReminders();
                  await supabase.auth.signOut();
                  router.replace("/");
                })
              }
            />
          </>
        )}
        <TextButton
          color="#974831"
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
        <Body style={{ fontSize: 11, textAlign: "center" }}>
          iwillbe.me · Private beta 0.1.0
        </Body>
      </View>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={session ? "Delete your account?" : "Clear this practice?"}
      >
        <Body>
          This permanently removes{" "}
          {session
            ? "your account, conversations, intentions and reflections"
            : "the practice saved on this device"}
          . Export anything you want to keep first.
        </Body>
        <Field
          label="TYPE DELETE TO CONFIRM"
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
        />
        <Notice text={error} tone="error" />
        <Button
          label="Delete permanently"
          disabled={confirmText !== "DELETE"}
          loading={busy}
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
