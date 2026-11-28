import React, { useEffect, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Redirect, router } from "expo-router";
import * as Crypto from "expo-crypto";
import { withAccount } from "../src/access-gate";
import { usePractice } from "../src/practice";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
import {
  dayInZone,
  entryInput,
  type Entry,
  type EntryInput,
} from "../src/journey";
import { KIDS_AGES, type KidsAge } from "../src/round3-preference-rules";
import {
  PRIORITY_WORDS,
  QUICK_PICKS,
  FAITH_TRADITIONS,
} from "../src/priorities";
import {
  ONBOARDING_PEOPLE,
  ONBOARDING_PRIORITY_COUNT,
  ONBOARDING_STEP_NAMES,
  ONBOARDING_VERSION,
  onboardingEntriesToRemove,
  onboardingEntryPlan,
  selectedOnboardingPlaces,
  toggleOnboardingPick,
  validFirstWhy,
  validOnboardingPriorities,
  type OneMinuteOnboardingDraft,
} from "../src/one-minute-onboarding";
import {
  Body,
  Button,
  Chip,
  C,
  F,
  Field,
  Notice,
  Title,
  TopBar,
  s,
} from "../src/ui";
import { supabase } from "../src/supabase";

function Onboarding() {
  const { data, session, saveProfile, putEntry, removeEntry } = usePractice();
  const action = useAction();
  const latest = useRef(data);
  const activeOwner = useRef(session?.user.id);
  const savedEntries = useRef(new Map<string, Entry>());
  useEffect(() => {
    latest.current = data;
    activeOwner.current = session?.user.id;
  }, [data, session?.user.id]);
  const { draft, update, clear, ready, draftError } =
    useDraft<OneMinuteOnboardingDraft>(
      draftKey("onboarding.one-minute", session?.user.id),
      {
        step: 0,
        priorities: [],
        interests: [],
        customInterests: "",
        who: [],
        customWho: "",
        kidsAges: (data.entries.find(
          (entry) =>
            entry.kind === "preferences" && entry.title === "Kids ages",
        )?.meta.ages || []) as KidsAge[],
        faith: data.profile.faith_tradition || "",
        why: "",
        entryIds: {},
        createdPlaceIds: {},
      },
    );
  const progressQueue = useRef(Promise.resolve());
  const progressEntry = useRef<Entry | undefined>(undefined);
  const progressKey = useRef("");
  useEffect(() => {
    if (!ready || !session?.user.id || data.profile.onboarded) return;
    const key = `${session.user.id}:${draft.step}`;
    if (progressKey.current === key) return;
    progressKey.current = key;
    progressQueue.current = progressQueue.current
      .catch(() => {})
      .then(async () => {
        const existing =
          progressEntry.current ||
          latest.current.entries.find(
            (entry) =>
              entry.kind === "preferences" &&
              entry.title === "Onboarding progress",
          );
        progressEntry.current = await putEntry(
          entryInput("preferences", "Onboarding progress", {
            id: existing?.id,
            revision: existing?.revision,
            source: "Start your map progress",
            meta: {
              version: ONBOARDING_VERSION,
              step: draft.step,
              onboarding_step: ONBOARDING_STEP_NAMES[draft.step] || "Welcome",
            },
          }),
        );
      })
      .catch(() => {});
  }, [ready, session?.user.id, data.profile.onboarded, draft.step, putEntry]);

  const knownEntries = () => {
    const known = new Map(
      latest.current.entries.map((entry) => [entry.id, entry]),
    );
    for (const [id, entry] of savedEntries.current) {
      const saved = known.get(id);
      if (!saved || (saved.revision || 0) < (entry.revision || 0))
        known.set(id, entry);
    }
    return [...known.values()];
  };
  const persist = async (input: EntryInput) => {
    const existing = input.id
      ? knownEntries().find((entry) => entry.id === input.id)
      : knownEntries().find(
          (entry) => entry.kind === input.kind && entry.title === input.title,
        );
    const saved = await putEntry({
      ...input,
      id: existing?.id || input.id,
      revision: existing?.revision ?? input.revision,
    });
    savedEntries.current.set(saved.id, saved);
    return saved;
  };
  const finish = async () => {
    if (!validOnboardingPriorities(draft.priorities)) {
      update({ step: 1 });
      throw new Error("Choose exactly seven priorities to begin.");
    }
    if (!validFirstWhy(draft.why))
      throw new Error("Write at least three words for your first why.");
    const owner = session?.user.id;
    if (!owner) throw new Error("Sign in to save your map.");
    const assertOwner = () => {
      if (activeOwner.current !== owner)
        throw new Error("Your account changed. Please reopen your map.");
    };
    await progressQueue.current;
    assertOwner();
    // Stable identities make a partial save retryable without duplicates.
    const entryIds = { ...draft.entryIds };
    let plan = onboardingEntryPlan(draft, knownEntries());
    for (const entry of plan) {
      const key = entry.meta.onboarding_key;
      if (!entry.id && key) entryIds[key] ||= Crypto.randomUUID();
    }
    update({ entryIds });
    plan = onboardingEntryPlan({ ...draft, entryIds }, knownEntries());
    for (const input of plan) {
      assertOwner();
      await persist(input);
    }
    for (const entry of onboardingEntriesToRemove(knownEntries(), plan)) {
      assertOwner();
      await removeEntry(entry.id, entry.revision);
      savedEntries.current.delete(entry.id);
    }
    // Read identity before adding people. A back/untick/retry can only remove
    // places this onboarding created, never a person from an existing map.
    const result = await supabase
      .from("places")
      .select("id,label,sort_order")
      .eq("user_id", owner);
    if (result.error)
      throw new Error(
        "Your people could not load. Your choices are still here; please try again.",
      );
    assertOwner();
    const people = selectedOnboardingPlaces(draft);
    const createdPlaceIds = { ...draft.createdPlaceIds };
    const existingPlaces = result.data || [];
    let sortOrder =
      Math.max(-1, ...existingPlaces.map((place) => place.sort_order)) + 1;
    for (const label of people) {
      if (
        existingPlaces.some(
          (place) => place.label.toLowerCase() === label.toLowerCase(),
        )
      )
        continue;
      createdPlaceIds[label] ||= Crypto.randomUUID();
      update({ createdPlaceIds: { ...createdPlaceIds } });
      const saved = await supabase.from("places").upsert(
        {
          id: createdPlaceIds[label],
          user_id: owner,
          label,
          sort_order: sortOrder++,
        },
        { onConflict: "user_id,label", ignoreDuplicates: true },
      );
      if (saved.error)
        throw new Error(
          "Your people could not finish saving. Please try again; your choices are still here.",
        );
      assertOwner();
    }
    for (const [label, id] of Object.entries(createdPlaceIds)) {
      if (people.some((person) => person.toLowerCase() === label.toLowerCase()))
        continue;
      const removed = await supabase
        .from("places")
        .delete()
        .eq("user_id", owner)
        .eq("id", id);
      if (removed.error)
        throw new Error(
          "Your people could not finish updating. Please try again.",
        );
      assertOwner();
      delete createdPlaceIds[label];
    }
    update({ createdPlaceIds });
    const existingSchedule = knownEntries().find(
      (entry) =>
        entry.kind === "preferences" && entry.title === "Onboarding schedule",
    );
    const completedAt = new Date().toISOString();
    await persist(
      entryInput("preferences", "Onboarding schedule", {
        id: existingSchedule?.id,
        revision: existingSchedule?.revision,
        source: "Start your map completed",
        meta: {
          ...existingSchedule?.meta,
          version: ONBOARDING_VERSION,
          completed_at: completedAt,
          completed_day: dayInZone(
            latest.current.profile.timezone,
            new Date(completedAt),
          ),
        },
      }),
    );
    await persist(
      entryInput("preferences", "Onboarding progress", {
        id: progressEntry.current?.id,
        revision: progressEntry.current?.revision,
        source: "Start your map progress",
        meta: {
          version: ONBOARDING_VERSION,
          step: 5,
          onboarding_step: "Completed",
        },
      }),
    );
    assertOwner();
    await saveProfile({
      ...latest.current.profile,
      onboarded: true,
      values: [...draft.priorities],
      faith_tradition: draft.priorities.includes("guided by faith")
        ? draft.faith || null
        : latest.current.profile.faith_tradition || null,
    });
    assertOwner();
    // Account completion remains valid if only device-cache cleanup fails.
    await clear().catch(() => {});
    router.replace("/");
  };
  const next = () =>
    action.run(async () => {
      if (draft.step === 1 && !validOnboardingPriorities(draft.priorities))
        return;
      if (draft.step === 4) await finish();
      else update({ step: Math.min(4, draft.step + 1) });
    });
  if (!ready) return null;
  if (data.profile.onboarded) return <Redirect href="/" />;
  const disabled =
    action.busy ||
    (draft.step === 1 && !validOnboardingPriorities(draft.priorities)) ||
    (draft.step === 4 && !validFirstWhy(draft.why));
  const buttonLabel =
    draft.step === 0
      ? "Let's begin"
      : draft.step === 1
        ? `${draft.priorities.length} of 7 chosen`
        : draft.step === 4
          ? "Start my first day"
          : "Next";
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {draft.step > 0 && (
        <View style={{ paddingBottom: 8 }}>
          <TopBar
            title={`${draft.step} of 4`}
            onBack={() => {
              if (!action.busy) update({ step: draft.step - 1 });
            }}
          />
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Start your map"
            accessibilityValue={{
              min: 0,
              max: 4,
              now: draft.step,
              text: `${draft.step} of 4`,
            }}
            style={{
              height: 4,
              marginHorizontal: 24,
              borderRadius: 4,
              backgroundColor: C.line,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 4,
                width: `${draft.step * 25}%`,
                backgroundColor: C.gold,
              }}
            />
          </View>
        </View>
      )}
      <ScrollView
        key={draft.step}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 24,
          paddingTop: draft.step ? 18 : 24,
          gap: 20,
          flexGrow: 1,
        }}
      >
        {draft.step === 0 && (
          <>
            <Text
              accessibilityLabel="be.me"
              style={{
                fontFamily: F.bold,
                fontSize: 28,
                color: C.navy,
                marginBottom: 10,
              }}
            >
              be<Text style={{ color: C.gold }}>.</Text>me
            </Text>
            <Body style={{ color: C.muted, fontStyle: "italic" }}>
              Okay, let&apos;s start on a light note…
            </Body>
            <Title style={{ fontSize: 32, lineHeight: 38 }}>
              Picture the last day of your life.
            </Title>
            <Body style={{ fontSize: 19, lineHeight: 28, color: C.muted }}>
              You&apos;re smiling.
            </Body>
            <Body
              style={{ fontSize: 25, lineHeight: 33, fontFamily: F.strong }}
            >
              What did you live, give and become to leave with that smile?
            </Body>
            <View style={{ height: 1, backgroundColor: C.line }} />
            <Body>
              Every day can move you a little closer to the person you want to
              be in the end. One meaningful action a day.
            </Body>
            <View>
              <Body
                style={{ fontSize: 24, lineHeight: 33, fontFamily: F.bold }}
              >
                Sometimes easy.
              </Body>
              <Body
                style={{ fontSize: 24, lineHeight: 33, fontFamily: F.bold }}
              >
                Sometimes hard.
              </Body>
              <Body
                style={{
                  fontSize: 24,
                  lineHeight: 33,
                  fontFamily: F.bold,
                  color: C.gold,
                }}
              >
                Always forward.
              </Body>
            </View>
          </>
        )}
        {draft.step === 1 && (
          <>
            <Title style={{ fontSize: 32, lineHeight: 38 }}>
              Who do you want to be?
            </Title>
            <Body style={{ color: C.muted }}>
              Choose the 7 that matter most to you right now.
            </Body>
            <IWillBeLabel />
            <View style={s.wrap}>
              {PRIORITY_WORDS.map(({ name }) => (
                <Chip
                  key={name}
                  label={name}
                  selected={draft.priorities.includes(name)}
                  disabled={action.busy}
                  onPress={() =>
                    update({
                      priorities: toggleOnboardingPick(
                        draft.priorities,
                        name,
                        ONBOARDING_PRIORITY_COUNT,
                      ),
                    })
                  }
                />
              ))}
            </View>
            {draft.priorities.includes("guided by faith") && (
              <View style={cardStyle}>
                <Body style={{ fontFamily: F.strong, color: C.gold }}>
                  Chloe
                </Body>
                <Body style={{ fontSize: 19, fontFamily: F.strong }}>
                  Which tradition guides you?
                </Body>
                <Body style={{ color: C.muted }}>Optional, and private.</Body>
                <View style={s.wrap}>
                  {FAITH_TRADITIONS.map((tradition) => (
                    <Chip
                      key={tradition}
                      label={tradition}
                      selected={draft.faith === tradition}
                      disabled={action.busy}
                      onPress={() =>
                        update({
                          faith: draft.faith === tradition ? "" : tradition,
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
        {draft.step === 2 && (
          <>
            <Title style={{ fontSize: 32, lineHeight: 38 }}>
              What would you love to do more of?
            </Title>
            <Body style={{ color: C.muted }}>
              Tap any. Add your own if it&apos;s missing.
            </Body>
            <IWillBeLabel />
            <View style={s.wrap}>
              {QUICK_PICKS.map(({ title }) => (
                <Chip
                  key={title}
                  label={title}
                  selected={draft.interests.includes(title)}
                  disabled={action.busy}
                  onPress={() =>
                    update({
                      interests: toggleOnboardingPick(draft.interests, title),
                    })
                  }
                />
              ))}
            </View>
            <Field
              label="Add your own"
              placeholder="e.g. salsa dancing"
              value={draft.customInterests}
              maxLength={500}
              editable={!action.busy}
              onChangeText={(customInterests) => update({ customInterests })}
            />
          </>
        )}
        {draft.step === 3 && (
          <>
            <Title style={{ fontSize: 32, lineHeight: 38 }}>
              Who do you most want to show up for?
            </Title>
            <Body style={{ color: C.muted }}>Pick all that apply.</Body>
            <View style={s.wrap}>
              {ONBOARDING_PEOPLE.map(([label, place]) => (
                <Chip
                  key={place}
                  label={label}
                  selected={draft.who.includes(place)}
                  disabled={action.busy}
                  onPress={() =>
                    update({ who: toggleOnboardingPick(draft.who, place) })
                  }
                />
              ))}
            </View>
            {draft.who.includes("with my kids") && (
              <View style={cardStyle}>
                <Body style={{ fontFamily: F.strong, color: C.gold }}>
                  Chloe
                </Body>
                <Body style={{ fontSize: 19 }}>How old are your kids?</Body>
                <Body style={{ color: C.muted }}>
                  Optional. Pick all that apply.
                </Body>
                <View style={s.wrap}>
                  {KIDS_AGES.map((age) => (
                    <Chip
                      key={age}
                      label={age}
                      selected={draft.kidsAges.includes(age)}
                      disabled={action.busy}
                      onPress={() =>
                        update({
                          kidsAges: toggleOnboardingPick(draft.kidsAges, age),
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            )}
            <Field
              label="Add your own"
              placeholder="e.g. my students"
              value={draft.customWho}
              maxLength={250}
              editable={!action.busy}
              onChangeText={(customWho) => update({ customWho })}
            />
          </>
        )}
        {draft.step === 4 && (
          <>
            <Body style={{ color: C.gold }}>
              Back to that last day, smiling.
            </Body>
            <Title style={{ fontSize: 32, lineHeight: 38 }}>
              Who do you want to be remembered as?
            </Title>
            <Body style={{ color: C.muted }}>
              A first draft, in your words. You&apos;ll shape it over time.
            </Body>
            <Field
              multiline
              label="My why"
              value={draft.why}
              placeholder="Someone who made the people around them laugh, and never stopped learning."
              onChangeText={(why) => update({ why })}
              maxLength={6000}
              editable={!action.busy}
              style={{ minHeight: 180, borderColor: C.gold, borderRadius: 20 }}
            />
            {!validFirstWhy(draft.why) && (
              <Body style={{ color: C.muted, fontSize: 13, lineHeight: 19 }}>
                Write at least three words to begin.
              </Body>
            )}
            <Body style={{ color: C.muted }}>
              This is the heart of everything. Each day&apos;s one action moves
              you toward it.
            </Body>
          </>
        )}
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: 16,
          paddingTop: 12,
          gap: 10,
          backgroundColor: C.paper,
        }}
      >
        {draft.step === 0 && (
          <Body style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>
            Let&apos;s start with four quick steps. About a minute.
          </Body>
        )}
        <Notice text={action.error || draftError} tone="error" />
        <Button
          label={buttonLabel}
          disabled={disabled}
          loading={action.busy}
          onPress={next}
          icon
        />
      </View>
    </KeyboardAvoidingView>
  );
}
function IWillBeLabel() {
  return (
    <Text style={{ fontFamily: F.bold, fontSize: 28, color: C.navy }}>
      iwillbe<Text style={{ color: C.gold }}>.</Text>
    </Text>
  );
}
const cardStyle = {
  backgroundColor: C.white,
  borderWidth: 1,
  borderColor: C.line,
  borderRadius: 20,
  padding: 18,
  gap: 12,
};
export default withAccount(Onboarding);
