import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import type { Entry } from "./journey";
import type { Intention } from "./domain";
import { usePractice } from "./practice";
import { useRound2 } from "./round2-store";
import { useAction } from "./use-action";
import { Body, Button, Chip, Field, Notice, TextButton, s } from "./ui";
import { ReminderTimePicker } from "./reminder-time-picker";
import {
  downloadReminderCalendar,
  phoneTimeZone,
  scheduleReminders,
} from "./reminders";
import { validReminderTime } from "./reminder-calendar";
import {
  DAY_PLACES,
  followupInput,
  nightFollowup,
  openFollowupInput,
  type NightFollowup,
} from "./onboarding-followups";

/** One reserved optional question after the regular night check-in. */
export function NightFollowupCard({
  day,
  focus,
  reflection,
  taskOverride,
  onDone,
}: {
  day: string;
  focus?: Intention;
  reflection: string;
  taskOverride?: NightFollowup;
  onDone?: () => void;
}) {
  const { data, putEntry, saveProfile } = usePractice();
  const extra = useRound2();
  const action = useAction();
  const [task] = useState(
    () => taskOverride || nightFollowup(data, day, focus, reflection),
  );
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [wasSkipped, setWasSkipped] = useState(false);
  const [reserveError, setReserveError] = useState("");
  const [retry, setRetry] = useState(0);
  const [morning, setMorning] = useState("08:00");
  const [night, setNight] = useState("21:00");
  const [places, setPlaces] = useState<string[]>([]);
  const [customPlace, setCustomPlace] = useState("");
  const record = useRef<Entry | undefined>(undefined);
  const openRecord = useRef<Entry | undefined>(undefined);
  const request = useRef<Promise<Entry> | null>(null);
  const profile = useRef(data.profile);
  const initial = useRef(data);
  useEffect(() => {
    profile.current = data.profile;
  }, [data.profile]);
  useEffect(() => {
    if (!task) return;
    let active = true;
    if (!request.current)
      request.current = (async () => {
        const reserved =
          record.current ||
          (await putEntry(
            followupInput(
              initial.current,
              task.key,
              task.question,
              day,
              "shown",
              task.targetId,
            ),
          ));
        record.current = reserved;
        // Keep an unanswered question reachable even when the person leaves
        // with Goodnight, changes tabs, or closes the app instead of tapping Skip.
        openRecord.current = await putEntry(
          openFollowupInput(initial.current, task, day),
        );
        return reserved;
      })();
    void request.current
      .then((entry) => {
        record.current = entry;
        if (active) {
          setReady(true);
          setReserveError("");
        }
      })
      .catch(() => {
        request.current = null;
        if (active)
          setReserveError(
            "This question couldn't load. Your check-in is saved.",
          );
      });
    return () => {
      active = false;
    };
  }, [task, day, putEntry, retry]);

  const finish = async (skipped = false) => {
    if (!task || !record.current) return;
    if (skipped && !openRecord.current)
      openRecord.current = await putEntry(openFollowupInput(data, task, day));
    record.current = await putEntry({
      ...record.current,
      meta: {
        ...record.current.meta,
        followup_status: skipped ? "skipped" : "answered",
      },
    });
    if (!skipped) {
      const open =
        openRecord.current ||
        data.entries.find(
          (entry) =>
            entry.kind === "question" &&
            entry.meta.followup_key === task.key &&
            entry.state !== "stopped",
        );
      if (open) await putEntry({ ...open, state: "answered" });
    }
    setWasSkipped(skipped);
    setDone(true);
    onDone?.();
  };

  const reminders = () =>
    action.run(async () => {
      if (![morning, night].every(validReminderTime))
        throw new Error("Choose a morning time and a night time.");
      const timezone =
        Platform.OS === "web" ? profile.current.timezone : phoneTimeZone();
      profile.current = await saveProfile({
        ...profile.current,
        morning_time: morning,
        evening_time: night,
        timezone,
      });
      if (Platform.OS === "web")
        downloadReminderCalendar(morning, night, timezone);
      else await scheduleReminders(morning, night, data);
      await finish();
    });

  const changeStage = (state: string) =>
    action.run(async () => {
      const interest = data.entries.find(
        (entry) => entry.id === task?.targetId,
      );
      if (!interest)
        throw new Error("This interest changed. Reopen your map to check it.");
      await putEntry({
        ...interest,
        state,
        meta: {
          ...interest.meta,
          last_stage_asked_day: day,
          into_it_since:
            state === "into_it"
              ? interest.meta.into_it_since || new Date().toISOString()
              : undefined,
        },
      });
      await finish();
    });

  const promote = (yes: boolean) =>
    action.run(async () => {
      const priority = data.entries.find(
        (entry) => entry.id === task?.targetId,
      );
      if (!priority)
        throw new Error("This priority changed. Reopen your map to check it.");
      await putEntry({
        ...priority,
        state: yes ? "important" : "working_on",
        meta: { ...priority.meta, promotion_asked: true },
      });
      await finish();
    });

  if (!task) return null;
  if (done)
    return !wasSkipped && task.kind === "reminders" && Platform.OS === "web" ? (
      <Body style={{ fontSize: 13 }}>
        Open the calendar file and accept the reminders. You can edit the times
        in Me.
      </Body>
    ) : null;
  if (!ready)
    return (
      <View style={s.card}>
        {reserveError ? (
          <>
            <Notice text={reserveError} />
            <TextButton
              label="Try again"
              onPress={() => setRetry((value) => value + 1)}
            />
          </>
        ) : (
          <ActivityIndicator accessibilityLabel="Loading one question" />
        )}
      </View>
    );
  return (
    <View style={[s.card, { gap: 16 }]}>
      <Body style={{ fontSize: 20 }}>{task.question}</Body>
      {task.kind === "reminders" && (
        <>
          <ReminderTimePicker
            label="Morning"
            value={morning}
            onChange={setMorning}
          />
          <ReminderTimePicker label="Night" value={night} onChange={setNight} />
          <Body style={{ fontSize: 13 }}>
            {Platform.OS === "web"
              ? "Add these to your calendar to receive reminders when the app is closed."
              : "We'll ask permission to send these reminders on your phone."}
          </Body>
          <Button
            label={
              Platform.OS === "web"
                ? "Add my reminders to my calendar"
                : "Turn on my reminders"
            }
            onPress={reminders}
            loading={action.busy}
          />
        </>
      )}
      {task.kind === "places" && (
        <>
          <View style={s.wrap}>
            {DAY_PLACES.map((place) => (
              <Chip
                key={place}
                label={place}
                selected={places.includes(place)}
                disabled={action.busy}
                onPress={() =>
                  setPlaces((old) =>
                    old.includes(place)
                      ? old.filter((value) => value !== place)
                      : [...old, place],
                  )
                }
              />
            ))}
          </View>
          <Field
            label="Add your own"
            value={customPlace}
            onChangeText={setCustomPlace}
            maxLength={100}
          />
          <Button
            label="Save my places"
            disabled={!places.length && !customPlace.trim()}
            loading={action.busy}
            onPress={() =>
              action.run(async () => {
                for (const place of new Set(
                  [...places, customPlace.trim()].filter(Boolean),
                ))
                  await extra.addPlace(place);
                await finish();
              })
            }
          />
        </>
      )}
      {task.kind === "interest" && (
        <View style={{ gap: 10 }}>
          <Button
            secondary
            label="New to me"
            disabled={action.busy}
            onPress={() => changeStage("want_to_try")}
          />
          <Button
            secondary
            label="Now and then"
            disabled={action.busy}
            onPress={() => changeStage("from_time_to_time")}
          />
          <Button
            secondary
            label="A big part of my life"
            disabled={action.busy}
            onPress={() => changeStage("into_it")}
          />
        </View>
      )}
      {task.kind === "priority" && (
        <>
          <Button
            label="Yes, it's important to me"
            disabled={action.busy}
            onPress={() => promote(true)}
          />
          <TextButton
            label="Keep working on it"
            disabled={action.busy}
            onPress={() => promote(false)}
          />
        </>
      )}
      <TextButton
        label="Skip for now"
        disabled={action.busy}
        onPress={() => action.run(() => finish(true))}
      />
      <Notice text={action.error} tone="error" />
    </View>
  );
}
