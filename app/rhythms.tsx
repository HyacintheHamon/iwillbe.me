import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import {
  currentVision,
  currentWhy,
  entriesOf,
  entryInput,
  rhythmDue,
  PLANETS,
  nextWhyQuestion,
  suggestedPlanet,
  weeklyNotices,
  weekPeriod,
  whyRevisitDue,
  type Planet,
} from "../src/journey";
import { shiftDay } from "../src/domain";
import { useToday } from "../src/use-today";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
import { POSSIBILITIES } from "../src/catalog";
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
  const { data } = usePractice();
  const due = rhythmDue(data);
  const [mode, setMode] = useState<"weekly" | "monthly">(
    due?.kind === "monthly" ? "monthly" : "weekly",
  );
  return <RhythmForm key={mode} mode={mode} setMode={setMode} />;
}
function RhythmForm({
  mode,
  setMode,
}: {
  mode: "weekly" | "monthly";
  setMode: (mode: "weekly" | "monthly") => void;
}) {
  const { data, session, putEntry, removeEntry } = usePractice();
  const today = useToday();
  const monthly = mode === "monthly";
  const period = monthly ? `moon:${today.slice(0, 7)}` : weekPeriod(today);
  const prior = entriesOf(data, "review").find((e) => e.meta.period === period);
  const action = useAction();
  const [message, setMessage] = useState(""),
    [backlog, setBacklog] = useState("");
  const { draft, update, ready, draftError } = useDraft(
    draftKey(`brief.review.${period}`, session?.user.id),
    {
      step: prior?.state === "done" ? 3 : 0,
      note: prior?.body || "",
      focus: suggestedPlanet(data, shiftDay(today, 1)),
      picture: "",
    },
  );
  const notices = weeklyNotices(data, today);
  const season = entriesOf(data, "preferences").find(
    (e) => e.title === "Season",
  );
  const year = currentVision(data, "year");
  const why = currentWhy(data);
  const [question] = useState(() => nextWhyQuestion(data, today));
  const lived = data.intentions
    .filter(
      (i) =>
        i.day <= today &&
        data.checkIns.some(
          (c) =>
            c.intention_id === i.id &&
            c.outcome !== "not_yet" &&
            c.energy === "lit",
        ),
    )
    .sort((a, b) => b.day.localeCompare(a.day))[0];
  const sourcePossibility = POSSIBILITIES.find(
    (item) => item.title === lived?.interest,
  );
  const suggestion =
    sourcePossibility &&
    (POSSIBILITIES.find(
      (item) =>
        sourcePossibility.related.includes(item.id) &&
        !entriesOf(data, "interest").some((e) => e.title === item.title),
    ) ||
      sourcePossibility);
  const saveSeason = (
    pace: "stay" | "vary" | "guide",
    orbit: Planet = season?.meta.orbit || "Be",
  ) =>
    action.run(async () => {
      await putEntry(
        entryInput("preferences", "Season", {
          id: season?.id,
          meta: { ...season?.meta, pace, orbit },
        }),
      );
    });
  const saveQuestion = (skip = false) =>
    action.run(async () => {
      if (skip || !draft.note.trim()) {
        const existing = entriesOf(data, "question").find(
          (e) => e.title === question,
        );
        if (question && existing?.state !== "stopped")
          await putEntry(
            entryInput("question", question, {
              id: existing?.id,
              state: "open",
              source: "Sunday Explore · left to sit",
              meta: {
                last_asked_at: new Date().toISOString(),
                last_asked_session: period,
              },
            }),
          );
        setMessage("Let it sit with you. We can come back to it another time.");
      } else {
        const existing = entriesOf(data, "story").find(
          (e) => e.title === question && e.meta.period === period,
        );
        await putEntry(
          entryInput("story", question || "A thought from Sunday", {
            id: existing?.id,
            body: draft.note.trim(),
            source: "Sunday Explore · in your words",
            meta: { period },
          }),
        );
      }
      update({ step: 2 });
    });
  const finish = () =>
    action.run(async () => {
      await putEntry(
        entryInput("review", monthly ? "Monthly check-in" : "Sunday Explore", {
          id: prior?.id,
          body: draft.note.trim(),
          state: "done",
          source: "A private reflection",
          source_ids: notices.map((n) => n.sourceId),
          meta: { period, version: 2 },
        }),
      );
      if (!monthly) {
        const focus = entriesOf(data, "preferences").find(
          (e) => e.title === "Weekly focus",
        );
        await putEntry(
          entryInput("preferences", "Weekly focus", {
            id: focus?.id,
            meta: { focus_area: draft.focus, focus_until: shiftDay(today, 7) },
          }),
        );
      }
      update({ step: 3 });
      setMessage("Saved privately. Take it with you into the week.");
    });
  const revisit = whyRevisitDue(data, today);
  return (
    <Page header={<TopBar title="Your rhythms" />}>
      <View style={s.wrap}>
        <Chip
          label="Sunday Explore"
          selected={!monthly}
          onPress={() => setMode("weekly")}
        />
        <Chip
          label="Monthly check-in"
          selected={monthly}
          onPress={() => setMode("monthly")}
        />
      </View>
      <Eyebrow>
        {monthly
          ? "A little room to look ahead"
          : "About ten minutes · whenever you have room"}
      </Eyebrow>
      {ready && draft.step === 0 ? (
        <>
          <Title>
            {monthly
              ? "Is this still the life you want?"
              : "Here’s what I noticed about you this week"}
          </Title>
          {monthly ? (
            <>
              <Eyebrow>One year out</Eyebrow>
              <Body>
                {year?.body ||
                  "Your picture is still forming. You can give it a little space when you’re ready."}
              </Body>
              {year ? (
                <View style={s.wrap}>
                  <Chip
                    label="Still true"
                    selected={draft.picture === "true"}
                    onPress={() =>
                      action.run(async () => {
                        if (draft.picture !== "true")
                          await putEntry(
                            entryInput("vision", "One year out", {
                              body: year.body,
                              source: "Reaffirmed at your monthly check-in",
                              meta: {
                                ...year.meta,
                                period,
                                version: (year.meta.version || 1) + 1,
                              },
                            }),
                          );
                        update({ picture: "true", step: 2 });
                      })
                    }
                  />
                  <Chip
                    label="Tweak it"
                    onPress={() => router.push("/telescope")}
                  />
                  <Chip
                    label="Something’s changed"
                    onPress={() =>
                      router.push({
                        pathname: "/telescope",
                        params: { changed: "true" },
                      })
                    }
                  />
                </View>
              ) : (
                <Button
                  label="Picture One year out"
                  onPress={() => router.push("/telescope")}
                />
              )}
              <TextButton
                label="Let this sit for now"
                onPress={() => update({ step: 2 })}
              />
            </>
          ) : (
            <>
              {notices.length ? (
                notices.map((notice) => (
                  <View key={notice.sourceId + notice.text} style={s.card}>
                    <Body>{notice.text}</Body>
                    <TextButton
                      label="See this moment"
                      onPress={() =>
                        router.push(
                          notice.sourceId === lived?.id ||
                            data.intentions.some(
                              (i) => i.id === notice.sourceId,
                            )
                            ? {
                                pathname: "/history",
                                params: { id: notice.sourceId },
                              }
                            : "/galaxy",
                        )
                      }
                    />
                  </View>
                ))
              ) : (
                <Body>
                  There’s room to notice something now. Start with a moment you
                  remember from this week.
                </Body>
              )}
              <Button
                label="Make a little space"
                onPress={() => update({ step: 1 })}
              />
            </>
          )}
        </>
      ) : null}
      {ready && draft.step === 1 ? (
        <>
          <Title>{question || "A little room to notice."}</Title>
          <Body>One thought is enough. Your why can keep evolving.</Body>
          <Field
            label="A thought to keep"
            multiline
            value={draft.note}
            onChangeText={(note) => update({ note })}
            maxLength={3000}
          />
          <Button
            label="Keep this thought"
            disabled={!draft.note.trim()}
            loading={action.busy}
            onPress={() => saveQuestion()}
          />
          <TextButton
            label="I don’t know yet"
            onPress={() => saveQuestion(true)}
          />
        </>
      ) : null}
      {ready && draft.step === 2 ? (
        <>
          <Title>
            {monthly
              ? "Carry what still feels true."
              : "Something worth exploring."}
          </Title>
          {!monthly && suggestion ? (
            <View style={s.card}>
              <Eyebrow>{suggestion.title}</Eyebrow>
              <Body>
                {sourcePossibility?.title} lit you up.{" "}
                {suggestion.title === sourcePossibility?.title
                  ? "There may be more to explore there."
                  : `This is another way into ${sourcePossibility?.domain.toLowerCase()}.`}
              </Body>
              <Body>{suggestion.first}</Body>
              <Body style={{ fontSize: 13 }}>
                {suggestion.time} · {suggestion.cost}
              </Body>
              <TextButton
                label="Keep this as a Maybe"
                onPress={() =>
                  action.run(async () => {
                    if (
                      !entriesOf(data, "interest").some(
                        (e) => e.title === suggestion.title,
                      )
                    )
                      await putEntry(
                        entryInput("interest", suggestion.title, {
                          state: "spark",
                          body: suggestion.description,
                          source: `Sunday Explore · connected to ${sourcePossibility?.title}`,
                          source_ids: lived ? [lived.id] : [],
                        }),
                      );
                    setMessage("Kept in your Possibilities.");
                  })
                }
              />
              <TextButton
                label="Explore it in real life"
                onPress={() =>
                  router.push({
                    pathname: "/ritual",
                    params: {
                      action: suggestion.first,
                      interest: suggestion.title,
                    },
                  })
                }
              />
            </View>
          ) : !monthly ? (
            <TextButton
              label="Browse a few possibilities"
              onPress={() => router.push("/explore")}
            />
          ) : null}
          {!monthly ? (
            <>
              <Body>
                {season?.meta.pace === "stay"
                  ? `Your mornings will stay with ${season.meta.orbit || "Be"}.`
                  : `This week I’ll lean toward ${draft.focus} in your mornings. Sound right?`}
              </Body>
              {season?.meta.pace !== "stay" ? (
                <View style={s.wrap}>
                  {PLANETS.slice(0, 5).map((area) => (
                    <Chip
                      key={area}
                      label={area}
                      selected={draft.focus === area}
                      onPress={() => update({ focus: area })}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Body>
                {why?.body ||
                  "Your why is still forming. Your days will give it words."}
              </Body>
              {revisit ? (
                <View style={s.card}>
                  <Eyebrow>Why revisit · about fifteen minutes</Eyebrow>
                  <Body>
                    Bring your recent moments, your current why and both
                    pictures of your future together.
                  </Body>
                  <Button
                    label="Revisit my why"
                    onPress={() =>
                      router.push({
                        pathname: "/why",
                        params: { revisit: "true" },
                      })
                    }
                  />
                </View>
              ) : null}
            </>
          )}
          <Button
            label={monthly ? "Keep this reflection" : "Sounds right"}
            loading={action.busy}
            onPress={finish}
          />
        </>
      ) : null}
      {ready && draft.step === 3 ? (
        <>
          <Title>A little room to live.</Title>
          <Body>
            {monthly
              ? "Keep what feels true. Let the rest take shape in your days."
              : "Your mornings will carry this forward. Go live a little."}
          </Body>
          <Button label="Back to today" onPress={() => router.replace("/")} />
        </>
      ) : null}
      <Notice
        text={action.error || draftError || message}
        tone={action.error || draftError ? "error" : "normal"}
      />
      <TextButton
        label={
          monthly
            ? "Talk through this month with Chloe"
            : "Keep exploring with Chloe"
        }
        onPress={() =>
          router.push({
            pathname: "/chloe",
            params: { mode: monthly ? "fullmoon" : "sunday" },
          })
        }
      />
      {!currentVision(data, "year") || !currentVision(data, "life") ? (
        <View style={s.card}>
          <Eyebrow>If you have a moment</Eyebrow>
          <Body>
            One year out and Later in life can give your days a direction.
            There’s no hurry.
          </Body>
          <TextButton
            label="Look a little further"
            onPress={() => router.push("/telescope")}
          />
        </View>
      ) : null}
      {draft.step === 3 ? (
        <TextButton
          label="Ask a friend: What do you think I’d love?"
          onPress={() => router.push("/connections")}
        />
      ) : null}
      <View style={s.section}>
        <Eyebrow>My focus</Eyebrow>
        <Body>Choose how your mornings begin.</Body>
        <View style={s.wrap}>
          {(
            [
              ["stay", "Focus on one area"],
              ["vary", "Rotate areas"],
              ["guide", "Let Chloe choose"],
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
            {PLANETS.slice(0, 5).map((area) => (
              <Chip
                key={area}
                label={area}
                selected={season.meta.orbit === area}
                onPress={() => saveSeason("stay", area)}
              />
            ))}
          </View>
        ) : null}
      </View>
      <View style={s.section}>
        <Eyebrow>Meaning To</Eyebrow>
        <Body>Room for another day. Letting it go is a choice too.</Body>
        <Field
          label="Something I’ve been meaning to do"
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
              Date.parse(`${today}T12:00:00Z`) - Date.parse(e.created_at) >=
                14 * 86400000 ? (
                <Body>Do it this week, or let it go?</Body>
              ) : null}
              <TextButton
                label="Do this today"
                onPress={() =>
                  router.push({
                    pathname: "/ritual",
                    params: { action: e.title, backlog: e.id },
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
                      setMessage("Letting it go is a choice too.");
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
        {entriesOf(data, "backlog")
          .filter((e) => ["done", "released"].includes(e.state))
          .slice(-5)
          .map((e) => (
            <Body key={e.id} style={{ fontSize: 13 }}>
              {e.title} · {e.state === "done" ? "Done" : "Released"}
            </Body>
          ))}
      </View>
      <View style={s.section}>
        <Eyebrow>Open Questions</Eyebrow>
        <Body>
          Let these sit with you. Chloe may offer one another day, never twice
          in a row.
        </Body>
        {entriesOf(data, "question")
          .filter((e) => !["stopped", "answered"].includes(e.state))
          .map((e) => (
            <View key={e.id} style={s.card}>
              <Body>{e.title}</Body>
              <TextButton
                label="Think about this with Chloe"
                onPress={() =>
                  router.push({
                    pathname: "/chloe",
                    params: { question: e.title, mode: "discovery" },
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
        label="One year out and Later in life"
        onPress={() => router.push("/telescope")}
      />
      <TextButton
        label="A big change in my life · revisit my why"
        onPress={() =>
          router.push({ pathname: "/why", params: { revisit: "true" } })
        }
      />
    </Page>
  );
}
