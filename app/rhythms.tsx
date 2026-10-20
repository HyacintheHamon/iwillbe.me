import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import {
  entriesOf,
  entryInput,
  rhythmDue,
  REVIEW_QUESTIONS,
  PLANETS,
  type Planet,
} from "../src/journey";
import { localDay, shiftDay } from "../src/domain";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
import { supabase } from "../src/supabase";
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
export default function Rhythms() {
  const { data, session, putEntry, removeEntry } = usePractice();
  const due = rhythmDue(data);
  const period = due?.period || `moon:${localDay().slice(0, 7)}`;
  return (
    <RhythmForm
      key={period}
      {...{ period, due, data, session, putEntry, removeEntry }}
    />
  );
}
type Props = Pick<
  ReturnType<typeof usePractice>,
  "data" | "session" | "putEntry" | "removeEntry"
> & { period: string; due: ReturnType<typeof rhythmDue> };
function RhythmForm({
  period,
  due,
  data,
  session,
  putEntry,
  removeEntry,
}: Props) {
  const action = useAction();
  const [message, setMessage] = useState(""),
    [showScores, setShowScores] = useState(false),
    [backlog, setBacklog] = useState("");
  const { draft, update } = useDraft(
    draftKey(`review.${period}`, session?.user.id),
    {
      answers: [null, null, null] as (number | null)[],
      note: "",
      feedback: "",
      feedbackConsent: false,
    },
  );
  const reviews = entriesOf(data, "review");
  const monthly = due?.kind !== "weekly";
  const season = entriesOf(data, "preferences").find(
    (e) => e.title === "Season",
  );
  const saveSeason = (
    pace: "stay" | "vary" | "guide",
    orbit: Planet = season?.meta.orbit || "Be",
  ) =>
    action.run(async () => {
      await putEntry(
        entryInput("preferences", "Season", {
          id: season?.id,
          meta: { pace, orbit },
        }),
      );
    });
  const save = (defer = false) =>
    action.run(async () => {
      if (draft.feedbackConsent && draft.feedback.trim()) {
        if (!session)
          throw new Error(
            "Connect an account to send feedback. Your private reflection can be saved without sending it.",
          );
        const { error } = await supabase
          .from("product_feedback")
          .insert({ user_id: session.user.id, content: draft.feedback.trim() });
        if (error)
          throw new Error(
            "Your feedback could not be sent. Try again, or uncheck sending to keep only your private reflection.",
          );
        update({ feedbackConsent: false, feedback: "" });
      }
      await putEntry(
        entryInput("review", monthly ? "Full Moon" : "Sunday question", {
          id: reviews.find((e) => e.meta.period === period)?.id,
          body: draft.note,
          state: defer ? "deferred" : "done",
          meta: {
            period,
            answers: monthly ? draft.answers : undefined,
            version: 1,
            next_day: defer ? shiftDay(due?.day || localDay(), 3) : undefined,
          },
        }),
      );
      setMessage(
        defer
          ? "There is room for this another day."
          : "Your reflection is saved privately.",
      );
    });
  const monthlyCount = reviews.filter(
    (e) => e.meta.period?.startsWith("moon:") && e.state === "done",
  ).length;
  return (
    <Page header={<TopBar title="Your rhythms" />}>
      <Eyebrow>Room to live between reflections</Eyebrow>
      <Title>{due?.title || "A little space to look back."}</Title>
      {due ? (
        <>
          <Body>
            {monthly
              ? "A monthly pause, on your own terms. Your answers stay private and are hidden after saving."
              : "What felt most like you this week? One sentence is enough."}
          </Body>
          {monthly
            ? REVIEW_QUESTIONS.map((q, n) => (
                <View key={q} style={{ gap: 10 }}>
                  <Body>{q}</Body>
                  <View style={s.wrap}>
                    {Array.from({ length: 11 }, (_, v) => (
                      <Chip
                        key={v}
                        label={String(v)}
                        selected={draft.answers[n] === v}
                        onPress={() => {
                          const answers = [...draft.answers];
                          answers[n] = answers[n] === v ? null : v;
                          update({ answers });
                        }}
                      />
                    ))}
                  </View>
                  <Body style={{ fontSize: 12 }}>
                    0 · Not at all 10 · Very much
                  </Body>
                </View>
              ))
            : null}
          <Field
            label="A thought to keep · optional"
            multiline
            value={draft.note}
            onChangeText={(note) => update({ note })}
            maxLength={3000}
          />
          {monthly ? (
            <>
              <Field
                label="Is there anything I could do better for you? · optional"
                multiline
                value={draft.feedback}
                onChangeText={(feedback) => update({ feedback })}
                maxLength={2000}
              />
              <Chip
                label="Send this feedback to the team"
                selected={draft.feedbackConsent}
                onPress={() =>
                  update({ feedbackConsent: !draft.feedbackConsent })
                }
              />
              <Body style={{ fontSize: 12 }}>
                Only this feedback is sent with your account identifier. Your
                scores and private note are never included.
              </Body>
            </>
          ) : null}
          <Button
            label="Keep this reflection"
            loading={action.busy}
            onPress={() => save()}
          />
          <TextButton label="Another day" onPress={() => save(true)} />
        </>
      ) : (
        <Body>
          You have made room for this rhythm. Nothing else to complete today.
        </Body>
      )}
      <Notice
        text={action.error || message}
        tone={action.error ? "error" : "normal"}
      />
      <TextButton
        label="Explore for ten minutes with Chloe"
        onPress={() =>
          router.push({ pathname: "/chloe", params: { mode: "sunday" } })
        }
      />
      <TextButton
        label="Look through my telescope"
        onPress={() => router.push("/telescope")}
      />
      {monthlyCount > 0 && monthlyCount % 3 === 0 ? (
        <View style={s.card}>
          <Eyebrow>A SEASON HAS PASSED</Eyebrow>
          <Body>
            Would you like to revisit your why with what you have learned?
          </Body>
          <Button label="Revisit my why" onPress={() => router.push("/why")} />
        </View>
      ) : null}
      <TextButton
        label="A big change in my life · revisit my why"
        onPress={() => router.push("/why")}
      />
      <View style={s.section}>
        <Eyebrow>My season</Eyebrow>
        <Body>Choose the pace that fits your life now.</Body>
        <View style={s.wrap}>
          {(
            [
              ["stay", "Stay in one orbit"],
              ["vary", "Travel the orbits"],
              ["guide", "Let Chloe navigate"],
            ] as const
          ).map(([pace, label]) => (
            <Chip
              key={pace}
              label={label}
              selected={(season?.meta.pace || "guide") === pace}
              onPress={() => saveSeason(pace)}
            />
          ))}
        </View>
        {season?.meta.pace === "stay" ? (
          <View style={s.wrap}>
            {PLANETS.slice(0, 5).map((planet) => (
              <Chip
                key={planet}
                label={planet}
                selected={season.meta.orbit === planet}
                onPress={() => saveSeason("stay", planet)}
              />
            ))}
          </View>
        ) : null}
      </View>
      <View style={s.section}>
        <Eyebrow>Meaning to…</Eyebrow>
        <Body>
          Something you want to make room for, without turning it into a debt.
        </Body>
        <Field
          label="Something I have been meaning to do"
          value={backlog}
          onChangeText={setBacklog}
          maxLength={500}
        />
        <Button
          secondary
          label="Keep it for later"
          disabled={!backlog.trim()}
          onPress={() =>
            action.run(async () => {
              await putEntry(
                entryInput("backlog", backlog.trim(), {
                  state: "open",
                  meta: { passes: 0 },
                }),
              );
              setBacklog("");
            })
          }
        />
        {entriesOf(data, "backlog")
          .filter((e) => e.state === "open")
          .map((e) => (
            <View key={e.id} style={s.card}>
              <Body>{e.title}</Body>
              {(e.meta.passes || 0) >= 3 ||
              Date.parse(`${localDay()}T12:00:00`) - Date.parse(e.created_at) >
                14 * 86400000 ? (
                <Body>Still yours to do, or ready to let go?</Body>
              ) : null}
              <TextButton
                label="Make this my next intention"
                onPress={() =>
                  router.push({
                    pathname: "/ritual",
                    params: { action: e.title },
                  })
                }
              />
              <View style={s.wrap}>
                <Chip
                  label="Done"
                  onPress={() =>
                    action.run(async () => {
                      await putEntry({ ...e, state: "done" });
                    })
                  }
                />
                <Chip
                  label="Release it"
                  onPress={() =>
                    action.run(async () => {
                      await putEntry({ ...e, state: "released" });
                    })
                  }
                />
                <Chip
                  label="Not now"
                  onPress={() =>
                    action.run(async () => {
                      await putEntry({
                        ...e,
                        meta: { ...e.meta, passes: (e.meta.passes || 0) + 1 },
                      });
                    })
                  }
                />
              </View>
            </View>
          ))}
      </View>
      <View style={s.section}>
        <Eyebrow>Open questions</Eyebrow>
        <Body>
          Questions you saved for later. They will not be pushed into your next
          conversation.
        </Body>
        {entriesOf(data, "question")
          .filter((e) => e.state !== "stopped")
          .map((e) => (
            <View key={e.id} style={s.card}>
              <Body>{e.title}</Body>
              <TextButton
                label="Think about this with Chloe"
                onPress={() =>
                  router.push({
                    pathname: "/chloe",
                    params: { question: e.title },
                  })
                }
              />
              <TextButton
                label="Stop asking this"
                onPress={() =>
                  action.run(async () => {
                    await putEntry({ ...e, state: "stopped" });
                  })
                }
              />
              <TextButton
                label="Remove this question"
                onPress={() =>
                  action.run(async () => {
                    await removeEntry(e.id);
                  })
                }
              />
            </View>
          ))}
      </View>
      <TextButton
        label={showScores ? "Hide my private scores" : "Show my private scores"}
        onPress={() => setShowScores(!showScores)}
      />
      {showScores
        ? reviews
            .filter((e) => e.state === "done" && e.meta.answers)
            .map((e) => (
              <View key={e.id} style={s.card}>
                <Body>
                  {e.title} · {e.meta.period}
                </Body>
                {REVIEW_QUESTIONS.map((q, n) => (
                  <Body key={q} style={{ fontSize: 13 }}>
                    {q} {e.meta.answers?.[n] ?? "Skipped"}
                  </Body>
                ))}
              </View>
            ))
        : null}
    </Page>
  );
}
