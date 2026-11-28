import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { withAccount } from "../src/access-gate";
import { usePractice } from "../src/practice";
import { useToday } from "../src/use-today";
import { useAction } from "../src/use-action";
import { entryInput, type Entry } from "../src/journey";
import { NightFollowupCard } from "../src/night-followup";
import {
  followupRecord,
  type NightFollowup,
} from "../src/onboarding-followups";
import {
  Body,
  Button,
  Chip,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";

function Questions() {
  const { data, putEntry, saveProfile } = usePractice();
  const today = useToday();
  const action = useAction();
  const [selected, setSelected] = useState<Entry | null>(null);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const questions = data.entries.filter(
    (entry) =>
      entry.kind === "question" &&
      !["answered", "stopped"].includes(entry.state),
  );
  const kind = selected?.meta.followup_key?.split(":")[0];
  const structured =
    selected &&
    ["reminders", "places", "interest", "priority"].includes(kind || "");
  const baselineIndex = selected?.meta.followup_key?.match(
    /^sunday:1:baseline:([0-2])$/,
  )?.[1];
  const close = () => {
    setSelected(null);
    setAnswer("");
    setScore(null);
  };
  return (
    <Page
      header={
        <TopBar
          title="Open Questions"
          onBack={() => (selected ? close() : router.back())}
        />
      }
    >
      {structured ? (
        <NightFollowupCard
          key={selected.id}
          day={today}
          reflection=""
          taskOverride={{
            key: selected.meta.followup_key!,
            kind: kind as NightFollowup["kind"],
            question: selected.title,
            targetId: selected.meta.target_id,
          }}
          onDone={close}
        />
      ) : selected ? (
        <>
          <Title>{selected.title}</Title>
          {baselineIndex !== undefined ? (
            <View style={s.wrap}>
              {Array.from({ length: 11 }, (_, number) => (
                <Chip
                  key={number}
                  label={String(number)}
                  selected={score === number}
                  onPress={() => setScore(number)}
                />
              ))}
            </View>
          ) : (
            <Field
              label="In your words"
              multiline
              value={answer}
              onChangeText={setAnswer}
              maxLength={2000}
            />
          )}
          <Button
            label="Keep my answer"
            disabled={
              baselineIndex !== undefined ? score === null : !answer.trim()
            }
            loading={action.busy}
            onPress={() =>
              action.run(async () => {
                if (baselineIndex !== undefined) {
                  const answers = [
                    ...(data.profile.baseline_answers || [null, null, null]),
                  ];
                  answers[Number(baselineIndex)] = score;
                  await saveProfile({
                    ...data.profile,
                    baseline_answers: answers,
                  });
                } else
                  await putEntry(
                    entryInput("story", selected.title, {
                      body: answer.trim(),
                      source: "Open Question · in your words",
                      source_ids: [selected.id],
                    }),
                  );
                await putEntry({ ...selected, state: "answered" });
                close();
              })
            }
          />
          {baselineIndex === undefined && (
            <TextButton
              label="Think about this with Chloe"
              onPress={() =>
                router.push({
                  pathname: "/chloe",
                  params: { mode: "discovery", question: selected.title },
                })
              }
            />
          )}
        </>
      ) : (
        <>
          <Title>A little room to think.</Title>
          <Body>
            Questions you left for another day. Come back to one whenever you
            want.
          </Body>
          {questions.map((question) => (
            <View key={question.id} style={s.card}>
              <Body>{question.title}</Body>
              <Button
                secondary
                label="Come back to this"
                onPress={() => setSelected(question)}
              />
              <TextButton
                label="Let it go"
                disabled={action.busy}
                onPress={() =>
                  action.run(async () => {
                    const reserved = question.meta.followup_key
                      ? followupRecord(data, question.meta.followup_key)
                      : undefined;
                    if (reserved)
                      await putEntry({
                        ...reserved,
                        meta: { ...reserved.meta, followup_status: "skipped" },
                      });
                    await putEntry({
                      ...question,
                      state: "stopped",
                      meta: { ...question.meta, stopped: true },
                    });
                  })
                }
              />
            </View>
          ))}
          {!questions.length && (
            <Body>
              Nothing waiting here. Your map can keep taking shape as you live.
            </Body>
          )}
        </>
      )}
      <Notice text={action.error} tone="error" />
    </Page>
  );
}
export default withAccount(Questions);
