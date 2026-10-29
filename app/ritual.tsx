import { withAccount } from "../src/access-gate";
import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { usePractice } from "../src/practice";
import {
  INTERESTS,
  VALUES,
  dayLabel,
  nextIntentionDay,
  shiftDay,
} from "../src/domain";
import { draftKey, useDraft } from "../src/drafts";
import {
  PLANETS,
  PLANET_OPENERS,
  suggestedPlanet,
  entriesOf,
  currentVision,
  currentWhy,
  eligibleOpenQuestion,
  entryInput,
  formatCommitment,
  returningToPractice,
  questionAvailable,
  type Planet,
} from "../src/journey";
import { morningCue } from "../src/guidance";
import { isUnreadyAnswer } from "../src/onboarding";
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

type Params = {
  day?: string;
  value?: string;
  action?: string;
  person?: string;
  interest?: string;
  planet?: string;
  when_context?: string;
  with_person?: string;
  backlog?: string;
};
const VALUE_WORDS: Record<string, string> = {
  Patience: "patient",
  Kindness: "kind",
  Curiosity: "curious",
  Courage: "brave",
  Presence: "present",
  Creativity: "creative",
  Connection: "connected",
  Balance: "balanced",
};
type Step =
  | "fresh"
  | "meaning"
  | "action"
  | "choose"
  | "fit"
  | "when"
  | "person"
  | "done";

function Ritual() {
  const { data } = usePractice();
  const params = useLocalSearchParams<Params>();
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
  params: Params;
}) {
  const { data, session, saveIntention, putEntry } = usePractice();
  const current = data.intentions.find((i) => i.day === day);
  const locked =
    !!current && data.checkIns.some((c) => c.intention_id === current.id);
  const season = entriesOf(data, "preferences").find(
    (e) => e.title === "Season",
  );
  const fixedArea = season?.meta.pace === "stay";
  const preferred = suggestedPlanet(data, day);
  const why = currentWhy(data);
  const [returning] = useState(() => returningToPractice(data, today));
  const pending = entriesOf(data, "backlog")
    .filter(
      (e) =>
        ["open", "active"].includes(e.state) &&
        (!e.meta.next_day || e.meta.next_day <= day),
    )
    .filter((e) => !fixedArea || e.meta.planet === preferred)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .find(
      (e) =>
        (e.meta.passes || 0) >= 3 ||
        e.created_at.slice(0, 10) <= shiftDay(day, -14),
    );
  const [firstBacklog] = useState(() =>
    !returning && !current && !params.action ? pending : undefined,
  );
  const { draft, update, clear, ready, draftError } = useDraft(
    draftKey(`ritual.${day}`, session?.user.id),
    {
      step: (returning && !current && !params.action
        ? "fresh"
        : firstBacklog
          ? "meaning"
          : "action") as Step,
      fresh: "",
      value:
        params.value ||
        (current && !INTERESTS.includes(current.value) ? current.value : "") ||
        "",
      interest:
        params.interest ||
        current?.interest ||
        (current && INTERESTS.includes(current.value) ? current.value : ""),
      action: params.action || current?.action || "",
      person: params.person || current?.person || "",
      planet: (fixedArea
        ? preferred
        : PLANETS.includes(params.planet as Planet) &&
            params.planet !== "Surprise"
          ? params.planet
          : current?.planet && current.planet !== "Surprise"
            ? current.planet
            : preferred) as Planet,
      kind: (current?.kind ||
        (params.value && !params.action ? "be" : "action")) as "action" | "be",
      when_context: params.when_context || current?.when_context || "",
      place: current?.place || "",
      with_person: params.with_person || current?.with_person || "",
      opener: 0,
      alternatives: [] as string[],
      saveOthers: false,
      backlog_id: params.backlog || firstBacklog?.id || "",
      skipped: false,
      revision: current?.revision ?? 0,
      whyLinked: entriesOf(data, "story").some(
        (e) =>
          e.meta.period === `why-action:${day}` &&
          e.state === "active" &&
          !!why &&
          e.source_ids.includes(why.id),
      ),
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [carried, setCarried] = useState("");
  const area = fixedArea
    ? preferred
    : draft.planet === "Surprise"
      ? preferred
      : draft.planet;
  const openers = PLANET_OPENERS[area].filter((text) =>
    questionAvailable(data, text, day),
  );
  const picture = currentVision(data, "year");
  const focusReason =
    !fixedArea &&
    season?.meta.pace !== "vary" &&
    area === preferred &&
    !params.planet &&
    !current
      ? picture?.meta.planet_notes?.[area]?.trim()
        ? `${area} is part of the life you’re picturing.`
        : data.intentions.some((i) => i.day < day && i.day >= shiftDay(day, -7))
          ? `A little room for ${area.toLowerCase()} today.`
          : ""
      : "";
  const daySeed = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000);
  const cue =
    !returning && day === today && !draft.opener && daySeed % 3 !== 2
      ? morningCue(data, day, area)
      : null;
  const openQuestion =
    !returning && day === today && daySeed % 7 === 1
      ? eligibleOpenQuestion(data, day, `morning:${day}`)
      : undefined;
  const opener =
    cue?.question ||
    (openers.length
      ? openers[(daySeed + draft.opener) % openers.length]
      : `A little room for ${area.toLowerCase()} today.`);
  const rawCommitment = formatCommitment(draft.action, draft.kind);
  const beWords = rawCommitment
    .replace(/^I will be\s+/i, "")
    .replace(/[.!]$/, "")
    .trim();
  const explicitValue = /^I will be\s+/i.test(rawCommitment)
    ? Object.entries(VALUE_WORDS).find(([name, word]) =>
        [name.toLowerCase(), word].includes(beWords.toLowerCase()),
      )
    : undefined;
  const commitment = explicitValue
    ? `I will be ${explicitValue[1]}`
    : rawCommitment;
  const selectedValue = draft.value || explicitValue?.[0] || "";
  const commitmentKind = /^I will be\b/i.test(commitment) ? "be" : draft.kind;
  const backlogId =
    draft.backlog_id ||
    (params.backlog && params.action === draft.action ? params.backlog : "");
  const selectedBacklog = entriesOf(data, "backlog").find(
    (e) => e.id === backlogId && ["open", "active"].includes(e.state),
  );
  const isBe = draft.kind === "be";
  const choices = Array.from(
    new Set([
      ...entriesOf(data, "value")
        .filter((e) => !["let_go", "released"].includes(e.state))
        .map((e) => e.title),
      ...data.profile.values,
      ...VALUES,
    ]),
  );
  const interests = entriesOf(data, "interest").filter(
    (e) =>
      !["ember", "paused", "on_pause"].includes(e.state) &&
      (!e.meta.planet || e.meta.planet === area),
  );
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveQuestion = async (question: string) => {
    if (!question.endsWith("?")) return;
    const prior = entriesOf(data, "question").find(
      (e) => e.title === question && e.state !== "answered",
    );
    if (prior?.state === "stopped") return;
    await putEntry(
      entryInput("question", question, {
        id: prior?.id,
        state: "open",
        source: "Morning · saved for later",
        meta: {
          ...prior?.meta,
          next_day: shiftDay(day, 2),
          last_asked_at: new Date().toISOString(),
          last_asked_session: `morning:${day}`,
        },
      }),
    );
  };
  const markSession = async () => {
    const prior = entriesOf(data, "preferences").find(
      (e) => e.title === "Check-in session",
    );
    await putEntry(
      entryInput("preferences", "Check-in session", {
        id: prior?.id,
        meta: {
          ...prior?.meta,
          last_check_in_at: new Date().toISOString(),
          last_question: opener,
        },
      }),
    );
  };
  const save = () =>
    run(async () => {
      if (!draft.when_context.trim())
        await saveQuestion("When will you do it?");
      const bareAction = commitment.replace(/^I will\s+/i, "").trim();
      await saveIntention(
        bareAction,
        selectedValue,
        draft.person,
        day,
        draft.interest,
        {
          planet: area,
          revision: draft.revision,
          kind: commitmentKind,
          when_context: draft.when_context.trim(),
          place: draft.place,
          with_person: draft.with_person,
        },
      );
      const whyLink = entriesOf(data, "story").find(
        (e) => e.meta.period === `why-action:${day}`,
      );
      if (why && (draft.whyLinked || whyLink))
        await putEntry(
          entryInput("story", "My why in action", {
            id: whyLink?.id,
            body: commitment,
            state: draft.whyLinked ? "active" : "released",
            source: "Connected to your why by you",
            source_ids: [why.id],
            meta: { period: `why-action:${day}`, commitment_day: day },
          }),
        );
      if (draft.saveOthers) {
        for (const title of draft.alternatives.filter(
          (a) => a !== draft.action,
        )) {
          if (
            !entriesOf(data, "backlog").some(
              (e) => e.title === title && ["open", "active"].includes(e.state),
            )
          )
            await putEntry(
              entryInput("backlog", title, {
                state: "open",
                source: "Another day, chosen by you",
                meta: { planet: area, passes: 0 },
              }),
            );
        }
      }
      for (const item of entriesOf(data, "backlog").filter(
        (e) =>
          ["open", "active"].includes(e.state) &&
          e.meta.commitment_day === day &&
          e.id !== selectedBacklog?.id,
      ))
        await putEntry({
          ...item,
          meta: { ...item.meta, commitment_day: undefined },
        });
      if (selectedBacklog && ["open", "active"].includes(selectedBacklog.state))
        await putEntry({
          ...selectedBacklog,
          meta: { ...selectedBacklog.meta, commitment_day: day, next_day: day },
        });
      await markSession();
      await clear();
      update({ step: "done", skipped: false });
    });
  const skipAction = () =>
    run(async () => {
      await saveQuestion(opener);
      await markSession();
      await clear();
      update({ step: "done", skipped: true });
    });
  const continueAction = () => {
    if (isUnreadyAnswer(draft.action)) {
      void skipAction();
      return;
    }
    const items = draft.action
      .split(/\n+/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (items.length > 1) {
      update({ alternatives: items, step: "choose" });
      return;
    }
    const needsFit =
      rawCommitment !== commitment ||
      /^(?:I\s+(?:want|hope)\s+to|I(?:'|’)ll\s+try\s+to|I\s+will\s+try\s+to)\b/i.test(
        draft.action.trim(),
      );
    update({ step: needsFit ? "fit" : "when" });
  };
  const chooseArea = (planet: Planet) => {
    const next =
      planet === "Surprise"
        ? PLANETS[(PLANETS.indexOf(area) + 1 + draft.opener) % 5]
        : planet;
    update({
      planet: next,
      opener: planet === "Surprise" ? draft.opener + 1 : 0,
    });
    setNotice(planet === "Surprise" ? `A ${next} morning, then.` : "");
  };
  const release = () =>
    run(async () => {
      if (selectedBacklog)
        await putEntry({ ...selectedBacklog, state: "released" });
      update({ backlog_id: "", step: "action" });
      setNotice("Letting it go is a choice too.");
    });
  const defer = () =>
    run(async () => {
      if (selectedBacklog)
        await putEntry({
          ...selectedBacklog,
          meta: {
            ...selectedBacklog.meta,
            passes: (selectedBacklog.meta.passes || 0) + 1,
            next_day: shiftDay(day, 3),
          },
        });
      update({ backlog_id: "", step: "action" });
      setNotice("It can wait. Let's start with today.");
    });
  const question =
    draft.step === "fresh"
      ? "What's true for you right now?"
      : draft.step === "meaning"
        ? "Do it this week, or let it go?"
        : draft.step === "choose"
          ? "Which one do you want to focus on today?"
          : draft.step === "fit"
            ? "Keep it?"
            : draft.step === "when"
              ? "When will you do it?"
              : draft.step === "person"
                ? "Who is it for?"
                : draft.step === "done"
                  ? draft.skipped
                    ? "Let it sit with you today."
                    : "Take this into your day."
                  : opener;

  if (!ready)
    return <ActivityIndicator accessibilityLabel="Restoring your morning" />;
  return (
    <Page
      header={
        <TopBar
          title="Morning"
          onBack={() => {
            if (["when", "fit", "choose"].includes(draft.step))
              update({ step: "action" });
            else if (draft.step === "person") update({ step: "when" });
            else if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
        />
      }
      footer={
        draft.step !== "done" && !locked ? (
          <>
            <Notice text={error || draftError} tone="error" />
            {draft.step === "action" ? (
              <>
                <Button
                  label="Continue"
                  disabled={!draft.action.trim()}
                  loading={busy}
                  onPress={continueAction}
                />
                <TextButton label="Skip for now" onPress={skipAction} />
              </>
            ) : draft.step === "fresh" ? (
              <>
                <Button
                  label="Continue"
                  loading={busy}
                  disabled={!draft.fresh.trim()}
                  onPress={() =>
                    run(async () => {
                      if (isUnreadyAnswer(draft.fresh)) {
                        await saveQuestion("What's true for you right now?");
                        update({ step: "action" });
                        setNotice(
                          "Let it sit with you today. We can come back to it.",
                        );
                        return;
                      }
                      await putEntry(
                        entryInput("story", "What's true for you right now?", {
                          body: draft.fresh.trim(),
                          source: "A fresh morning",
                        }),
                      );
                      update({ step: "action" });
                    })
                  }
                />
                <TextButton
                  label="Skip for now"
                  onPress={() =>
                    run(async () => {
                      await saveQuestion("What's true for you right now?");
                      update({ step: "action" });
                      setNotice(
                        "Let it sit with you today. We can come back to it.",
                      );
                    })
                  }
                />
              </>
            ) : draft.step === "fit" ? (
              <Button
                label="Yes, keep it"
                onPress={() => update({ step: "when" })}
              />
            ) : draft.step === "when" ? (
              <>
                <Button
                  label={`Save for ${day === today ? "today" : "tomorrow"}`}
                  loading={busy}
                  onPress={save}
                />
              </>
            ) : draft.step === "person" ? (
              <>
                <Button
                  label="Keep this"
                  onPress={() => update({ step: "when" })}
                />
                <TextButton
                  label="Skip for now"
                  onPress={() =>
                    run(async () => {
                      await saveQuestion("Who is it for?");
                      update({ step: "when", person: "" });
                    })
                  }
                />
              </>
            ) : null}
          </>
        ) : (
          <Notice text={error || draftError} tone="error" />
        )
      }
    >
      <Eyebrow>{dayLabel(day)} · About two minutes</Eyebrow>
      {locked ? (
        <>
          <Title>A new day can hold a different thing.</Title>
          <Body>This moment already has its reflection.</Body>
          <Button
            label="Plan tomorrow"
            onPress={() =>
              router.replace({
                pathname: "/ritual",
                params: { day: shiftDay(today, 1) },
              })
            }
          />
        </>
      ) : (
        <>
          {draft.step === "action" ? (
            <>
              <Eyebrow>Where to today?</Eyebrow>
              {fixedArea ? (
                <>
                  <Body>{preferred} is your focus.</Body>
                  <TextButton
                    label="Change my focus"
                    onPress={() => router.push("/rhythms")}
                  />
                </>
              ) : (
                <View style={s.wrap}>
                  {PLANETS.map((planet) => (
                    <Chip
                      key={planet}
                      label={planet === "Surprise" ? "Surprise me" : planet}
                      selected={area === planet}
                      onPress={() => chooseArea(planet)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : null}
          <Title>{question}</Title>
          {draft.step === "action" && (cue?.line || focusReason) ? (
            <Body>{cue?.line || focusReason}</Body>
          ) : null}
          <Notice text={notice} />
          {draft.step === "fresh" ? (
            <>
              <Body>Good to see you. Start wherever you are.</Body>
              <Field
                label="RIGHT NOW"
                multiline
                value={draft.fresh}
                onChangeText={(fresh) => update({ fresh })}
                maxLength={2000}
                placeholder="A thought, a moment, anything that's true."
              />
            </>
          ) : draft.step === "meaning" ? (
            <>
              <View style={s.card}>
                <Body>{selectedBacklog?.title}</Body>
              </View>
              <Button
                label="Do it today"
                loading={busy}
                onPress={() =>
                  update({
                    action: selectedBacklog?.title || "",
                    backlog_id: selectedBacklog?.id || "",
                    step: "when",
                  })
                }
              />
              <Button
                secondary
                label="Let it go"
                loading={busy}
                onPress={release}
              />
              <TextButton label="Not ready to decide" onPress={defer} />
            </>
          ) : draft.step === "action" ? (
            <>
              <View style={s.wrap}>
                <Chip
                  label="Today"
                  selected={day === today}
                  onPress={() =>
                    router.replace({
                      pathname: "/ritual",
                      params: { day: today },
                    })
                  }
                />
                <Chip
                  label="Tomorrow"
                  selected={day !== today}
                  onPress={() =>
                    router.replace({
                      pathname: "/ritual",
                      params: { day: shiftDay(today, 1) },
                    })
                  }
                />
              </View>
              {params.action && draft.action !== params.action ? (
                <TextButton
                  label="Use the suggestion I just chose"
                  onPress={() =>
                    update({
                      action: params.action!,
                      value: params.value || "",
                      interest: params.interest || "",
                      person: params.person || "",
                      backlog_id: params.backlog || "",
                    })
                  }
                />
              ) : null}
              <View style={s.wrap}>
                <Chip
                  label="I will…"
                  selected={!isBe}
                  onPress={() => update({ kind: "action" })}
                />
                <Chip
                  label="I will be…"
                  selected={isBe}
                  onPress={() => update({ kind: "be" })}
                />
              </View>
              <Field
                label={
                  isBe
                    ? "I WILL BE…"
                    : `${day === today ? "TODAY" : "TOMORROW"}, I WILL…`
                }
                multiline
                placeholder={
                  isBe
                    ? "Patient, brave, kind…"
                    : "Call my aunt, read a few pages, take a walk…"
                }
                value={draft.action}
                onChangeText={(action) =>
                  update({
                    action,
                    backlog_id:
                      selectedBacklog &&
                      formatCommitment(action, draft.kind) ===
                        formatCommitment(selectedBacklog.title, draft.kind)
                        ? selectedBacklog.id
                        : "",
                  })
                }
                maxLength={500}
              />
              {area === "Be" || isBe ? (
                <>
                  <Eyebrow>A value to try on</Eyebrow>
                  <View style={s.wrap}>
                    {choices.map((v) => (
                      <Chip
                        key={v}
                        label={v}
                        selected={selectedValue === v}
                        onPress={() =>
                          update({
                            value: v,
                            kind: VALUE_WORDS[v] ? "be" : "action",
                            action: VALUE_WORDS[v]
                              ? `be ${VALUE_WORDS[v]}`
                              : `practice ${v.toLowerCase()}`,
                            backlog_id: "",
                          })
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}
              {interests.length ? (
                <>
                  <Eyebrow>A possibility of yours · optional</Eyebrow>
                  <View style={s.wrap}>
                    {interests.slice(0, 6).map((e) => (
                      <Chip
                        key={e.id}
                        label={e.title}
                        selected={draft.interest === e.title}
                        onPress={() =>
                          update({
                            interest: draft.interest === e.title ? "" : e.title,
                          })
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}
              <TextButton
                label="Ask me something else"
                onPress={() =>
                  run(async () => {
                    await saveQuestion(opener);
                    update({ opener: draft.opener + 1 });
                    setNotice("Let it sit with you. Here’s another way in.");
                  })
                }
              />
              <TextButton
                label="Talk it through with Chloe"
                onPress={() =>
                  router.push({
                    pathname: "/chloe",
                    params: {
                      mode: "morning",
                      question: `Help me choose one small commitment in ${area}.${draft.action.trim() ? ` I’m considering: ${draft.action.trim()}` : ""}`,
                    },
                  })
                }
              />
            </>
          ) : draft.step === "choose" ? (
            <>
              <Body>Tomorrow’s one thing can be different.</Body>
              <Chip
                label="Save the others to Meaning To"
                selected={draft.saveOthers}
                onPress={() => update({ saveOthers: !draft.saveOthers })}
              />
              {draft.alternatives.map((action, index) => (
                <Button
                  key={`${index}:${action}`}
                  secondary
                  label={action}
                  onPress={() => update({ action, step: "when" })}
                />
              ))}
            </>
          ) : draft.step === "fit" ? (
            <>
              <View style={s.card}>
                <Body>{commitment}</Body>
              </View>
              <TextButton
                label="Change the words"
                onPress={() => update({ step: "action" })}
              />
            </>
          ) : draft.step === "when" ? (
            <>
              <View style={s.card}>
                <Body>{commitment}</Body>
                {selectedValue ? (
                  <Eyebrow>Trying on {selectedValue}</Eyebrow>
                ) : null}
              </View>
              <Field
                label="WHEN OR AFTER WHAT? · OPTIONAL"
                placeholder="After my coffee. At lunch, in the park…"
                multiline
                value={draft.when_context}
                onChangeText={(when_context) => update({ when_context })}
                maxLength={200}
              />
              <Body>
                A moment, a place, or the thing you’ll do right before is
                enough.
              </Body>
              {why ? (
                <>
                  <Chip
                    label="This expresses my why"
                    selected={draft.whyLinked}
                    onPress={() => update({ whyLinked: !draft.whyLinked })}
                  />
                  {draft.whyLinked ? (
                    <Body style={{ fontSize: 13 }}>{why.body}</Body>
                  ) : null}
                </>
              ) : null}
              <View style={s.wrap}>
                <Chip
                  label="For me"
                  selected={/^(me|myself|for me)$/i.test(draft.person)}
                  onPress={() => update({ person: "me" })}
                />
                <Chip
                  label={
                    draft.person && !/^(me|myself|for me)$/i.test(draft.person)
                      ? `For ${draft.person}`
                      : "Name someone · optional"
                  }
                  onPress={() => update({ step: "person" })}
                />
              </View>
              {draft.alternatives.length > 1 ? (
                <Chip
                  label="Save the others to Meaning To"
                  selected={draft.saveOthers}
                  onPress={() => update({ saveOthers: !draft.saveOthers })}
                />
              ) : null}
            </>
          ) : draft.step === "person" ? (
            <>
              <Field
                label="FOR"
                value={draft.person}
                onChangeText={(person) => update({ person })}
                placeholder="Me, my aunt, my neighbours…"
                maxLength={120}
              />
              <Chip
                label="For me"
                selected={/^(me|myself|for me)$/i.test(draft.person)}
                onPress={() => update({ person: "me", step: "when" })}
              />
            </>
          ) : draft.step === "done" ? (
            <>
              {draft.skipped ? (
                <Body>
                  We can come back to it. There’s nothing else to answer now.
                </Body>
              ) : (
                <>
                  <View style={s.card}>
                    <Body>
                      {commitment}
                      {draft.when_context ? ` — ${draft.when_context}` : ""}
                    </Body>
                  </View>
                  <Body>
                    {day === today
                      ? "Tonight I'll ask how it went. For now, go live it."
                      : "That's tomorrow's one thing. Leave it here for now."}
                  </Body>
                </>
              )}
              <Button
                label="Done for now"
                onPress={() => router.replace("/")}
              />
              {!draft.skipped && openQuestion && !carried ? (
                <TextButton
                  label="Carry a question today"
                  onPress={() =>
                    run(async () => {
                      const preference = entriesOf(data, "preferences").find(
                        (e) => e.title === "Check-in session",
                      );
                      await putEntry(
                        entryInput("preferences", "Check-in session", {
                          id: preference?.id,
                          meta: {
                            ...preference?.meta,
                            carried_question_id: openQuestion.id,
                            carried_question_day: day,
                          },
                        }),
                      );
                      setCarried(openQuestion.title);
                    })
                  }
                />
              ) : null}
              {carried ? (
                <>
                  <Body>{carried}</Body>
                  <Body>No need to answer now. Take it with you.</Body>
                </>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Page>
  );
}

export default withAccount(Ritual);
