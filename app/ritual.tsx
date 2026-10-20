import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { usePractice } from "../src/practice";
import {
  INTERESTS,
  SUGGESTIONS,
  VALUES,
  dayLabel,
  nextIntentionDay,
  shiftDay,
} from "../src/domain";
import { draftKey, useDraft } from "../src/drafts";
import {
  PLANETS,
  PLANET_PROMPTS,
  suggestedPlanet,
  entriesOf,
  type Planet,
} from "../src/journey";
import { useToday } from "../src/use-today";
import {
  Body,
  Button,
  Chip,
  Eyebrow,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";

export default function Ritual() {
  const { data } = usePractice();
  const params = useLocalSearchParams<{
    day?: string;
    value?: string;
    action?: string;
    person?: string;
    interest?: string;
    planet?: string;
    when_context?: string;
    with_person?: string;
  }>();
  const today = useToday();
  const tomorrow = shiftDay(today, 1);
  const day = [today, tomorrow].includes(params.day || "")
    ? params.day!
    : nextIntentionDay(data, today);
  return (
    <IntentionForm
      key={`${day}:${params.action || ""}`}
      day={day}
      today={today}
      params={params}
    />
  );
}
function IntentionForm({
  day,
  today,
  params,
}: {
  day: string;
  today: string;
  params: {
    value?: string;
    action?: string;
    person?: string;
    interest?: string;
    planet?: string;
    when_context?: string;
    with_person?: string;
  };
}) {
  const { data, session, saveIntention } = usePractice();
  const current = data.intentions.find((i) => i.day === day);
  const locked =
    !!current && data.checkIns.some((c) => c.intention_id === current.id);
  const { draft, update, clear, ready, draftError } = useDraft(
    draftKey(`ritual.${day}`, session?.user.id),
    {
      value:
        params.value ||
        (current && !INTERESTS.includes(current.value)
          ? current.value
          : data.profile.values[0]) ||
        "",
      interest:
        params.interest ||
        current?.interest ||
        (current && INTERESTS.includes(current.value) ? current.value : ""),
      action: params.action || current?.action || "",
      person: params.person || current?.person || data.profile.north_star || "",
      planet: (PLANETS.includes(params.planet as Planet)
        ? params.planet
        : current?.planet || suggestedPlanet(data, day)) as Planet,
      kind: current?.kind || "action",
      when_context: params.when_context || current?.when_context || "",
      place: current?.place || "",
      with_person: params.with_person || current?.with_person || "",
      review: false,
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await saveIntention(
        draft.action,
        draft.value,
        draft.person,
        day,
        draft.interest,
        {
          planet: draft.planet,
          kind: draft.kind,
          when_context: draft.when_context,
          place: draft.place,
          with_person: draft.with_person,
        },
      );
      await clear();
      router.replace({ pathname: "/", params: { saved: day } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changeDay = (next: string) =>
    router.replace({ pathname: "/ritual", params: { day: next } });
  if (!ready)
    return <ActivityIndicator accessibilityLabel="Restoring your draft" />;
  return (
    <Page
      header={
        <TopBar
          title="One small intention"
          onBack={() =>
            draft.review
              ? update({ review: false })
              : router.canGoBack()
                ? router.back()
                : router.replace("/")
          }
        />
      }
      footer={
        !locked && (
          <>
            <Notice text={error || draftError} tone="error" />
            <Button
              label={
                draft.review
                  ? `Save for ${day === today ? "today" : "tomorrow"}`
                  : "Review my intention"
              }
              loading={busy}
              disabled={!draft.action.trim()}
              onPress={draft.review ? save : () => update({ review: true })}
            />
          </>
        )
      }
    >
      <Eyebrow>{dayLabel(day)}</Eyebrow>
      <Title>
        {draft.review
          ? "A small promise to carry with you."
          : PLANET_PROMPTS[draft.planet]}
      </Title>
      {locked ? (
        <>
          <Notice text="You’ve already reflected on this intention. Tomorrow has room for a new one." />
          <Button
            label="Plan tomorrow"
            onPress={() => changeDay(shiftDay(today, 1))}
          />
        </>
      ) : draft.review ? (
        <>
          <View style={s.card}>
            <Eyebrow>{day === today ? "TODAY" : "TOMORROW"}, I WILL</Eyebrow>
            <Title style={{ fontSize: 25, lineHeight: 33 }}>
              {draft.action}
            </Title>
            <Body>
              {draft.value}
              {draft.interest ? ` · ${draft.interest}` : ""} · For{" "}
              {draft.person || "myself"}
            </Body>
            <Body>
              {draft.planet}
              {draft.when_context ? ` · ${draft.when_context}` : ""}
              {draft.place ? ` · ${draft.place}` : ""}
              {draft.with_person ? ` · With ${draft.with_person}` : ""}
            </Body>
          </View>
          <Body>
            Keep it small enough to fit a real day. You can adjust it until you
            reflect.
          </Body>
          <TextButton
            label="Make a small change"
            onPress={() => update({ review: false })}
          />
          <Body style={{ fontSize: 13 }}>
            {session
              ? "Saved privately to your account."
              : "Starts on this device. An account is optional; you can save across devices later."}
          </Body>
        </>
      ) : (
        <>
          {current && (
            <Body style={{ fontSize: 13 }}>
              You’re adjusting the intention already saved for this day.
            </Body>
          )}
          <View style={s.wrap}>
            <Chip
              label="Today"
              selected={day === today}
              onPress={() => changeDay(today)}
            />
            <Chip
              label="Tomorrow"
              selected={day !== today}
              onPress={() => changeDay(shiftDay(today, 1))}
            />
          </View>
          {params.action && draft.action !== params.action && (
            <TextButton
              label="Use the suggestion I just chose"
              onPress={() =>
                update({
                  action: params.action!,
                  value: params.value || draft.value,
                  interest: params.interest || draft.interest,
                  person: params.person || draft.person,
                })
              }
            />
          )}
          <Eyebrow>Where today?</Eyebrow>
          <View style={s.wrap}>
            {PLANETS.map((planet) => (
              <Chip
                key={planet}
                label={planet}
                selected={draft.planet === planet}
                onPress={() => update({ planet })}
              />
            ))}
          </View>
          <View style={s.wrap}>
            <Chip
              label="Do something"
              selected={draft.kind === "action"}
              onPress={() => update({ kind: "action" })}
            />
            <Chip
              label="Be a little more…"
              selected={draft.kind === "be"}
              onPress={() => update({ kind: "be" })}
            />
          </View>
          <Field
            label={`${day === today ? "TODAY" : "TOMORROW"}, I WILL…`}
            multiline
            placeholder="For example: put my phone away at dinner"
            value={draft.action}
            onChangeText={(action) => update({ action })}
            maxLength={500}
          />
          <Body style={s.label}>A VALUE TO PRACTISE · OPTIONAL</Body>
          <View style={s.wrap}>
            {Array.from(
              new Set([
                ...entriesOf(data, "value").map((e) => e.title),
                ...data.profile.values,
                ...VALUES,
              ]),
            ).map((v) => (
              <Chip
                key={v}
                label={v}
                selected={draft.value === v}
                onPress={() => update({ value: draft.value === v ? "" : v })}
              />
            ))}
          </View>
          <Eyebrow>NEED A STARTING POINT?</Eyebrow>
          {(
            SUGGESTIONS[draft.interest || draft.value] || SUGGESTIONS.Presence
          ).map((action) => (
            <TextButton
              key={action}
              label={action}
              onPress={() => update({ action })}
            />
          ))}
          <Field
            label="WHEN OR AFTER WHAT? · OPTIONAL"
            placeholder="After lunch, around 3…"
            value={draft.when_context}
            onChangeText={(when_context) => update({ when_context })}
            maxLength={200}
          />
          <Field
            label="WHERE? · OPTIONAL"
            value={draft.place}
            onChangeText={(place) => update({ place })}
            maxLength={120}
          />
          <Field
            label="WITH SOMEONE? · OPTIONAL"
            value={draft.with_person}
            onChangeText={(with_person) => update({ with_person })}
            maxLength={120}
          />
          <Field
            label="FOR WHOM? · OPTIONAL"
            placeholder="Myself, Sam, my family…"
            value={draft.person}
            onChangeText={(person) => update({ person })}
            maxLength={120}
          />
          <Body style={s.label}>LINK AN INTEREST · OPTIONAL</Body>
          <View style={s.wrap}>
            {Array.from(
              new Set([
                ...entriesOf(data, "interest").map((e) => e.title),
                ...data.profile.interests,
                ...INTERESTS,
              ]),
            ).map((interest) => (
              <Chip
                key={interest}
                label={interest}
                selected={draft.interest === interest}
                onPress={() =>
                  update({
                    interest: draft.interest === interest ? "" : interest,
                  })
                }
              />
            ))}
          </View>
          <TextButton
            label="Talk it through with Chloe"
            onPress={() => router.push("/chloe")}
          />
          <Body style={{ fontSize: 13 }}>
            Your draft stays here if you leave or go back.
          </Body>
        </>
      )}
    </Page>
  );
}
