import React, { useState } from "react";
import { View, Text } from "react-native";
import {
  Page,
  TopBar,
  Body,
  Button,
  Chip,
  C,
  F,
  Field,
  Notice,
  TextButton,
  Title,
  s,
} from "./ui";
import { useOnboardingCatalogue } from "./onboarding-catalogue";
import { usePractice } from "./practice";
import { draftKey, useDraft } from "./drafts";
import { entryInput } from "./journey";
import { PRIORITY_GROUPS, FAITH_TRADITIONS, priorityName } from "./priorities";
export function IWillBe({
  children,
  small = false,
}: {
  children: string;
  small?: boolean;
}) {
  return (
    <Text
      adjustsFontSizeToFit
      numberOfLines={1}
      style={{
        fontFamily: F.bold,
        fontSize: small ? 20 : 28,
        lineHeight: small ? 30 : 38,
        color: C.navy,
      }}
    >
      iwillbe.<Text style={{ color: C.gold }}>{children}</Text>
    </Text>
  );
}
export function PriorityOnboarding({
  onDone,
  onBack,
}: {
  onDone: () => void;
  onBack: () => void;
}) {
  const { data, session, putEntry, saveProfile } = usePractice();
  const { priorities } = useOnboardingCatalogue();
  const groups = Object.fromEntries(
    Object.keys(PRIORITY_GROUPS).map((group) => [
      group,
      priorities.filter((p) => p.group === group).map((p) => p.name),
    ]),
  );
  const { draft, update, ready, draftError } = useDraft(
    draftKey("onboarding.priorities", session?.user.id),
    {
      step: "important",
      important: [] as string[],
      working: [] as string[],
      faith: data.profile.faith_tradition || "",
      goodAt: "",
      proposed: "",
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
  const savePriorities = () =>
    run(async () => {
      for (const old of data.entries.filter(
        (e) =>
          e.kind === "value" &&
          e.source === "Chosen in Start your map" &&
          !draft.important.includes(e.title),
      ))
        await putEntry({ ...old, state: "let_go" });
      for (const name of draft.important) {
        const prior = data.entries.find(
          (e) =>
            (e.kind === "value" || e.kind === "strength") &&
            priorityName(e.title) === name,
        );
        await putEntry(
          entryInput("value", name, {
            id: prior?.id,
            revision: prior?.revision,
            body: prior?.body || "",
            state: draft.working.includes(name) ? "working_on" : "important",
            source: "Chosen in Start your map",
            meta: {
              ...prior?.meta,
              priority_group: priorities.find((p) => p.name === name)?.group,
            },
          }),
        );
      }
      update({
        step: draft.important.includes("guided by faith") ? "faith" : "good_at",
      });
    });
  if (!ready) return null;
  return (
    <Page
      header={
        <TopBar
          title="Start your map"
          onBack={() =>
            draft.step === "important"
              ? onBack()
              : update({
                  step:
                    draft.step === "working"
                      ? "important"
                      : draft.step === "confirm"
                        ? "good_at"
                        : "working",
                })
          }
        />
      }
      footer={
        <>
          {draft.step === "important" && (
            <Button
              label="Choose what to work on"
              disabled={draft.important.length !== 10}
              onPress={() => update({ step: "working" })}
            />
          )}
          {draft.step === "working" && (
            <Button
              label="Keep my priorities"
              loading={busy}
              disabled={draft.working.length !== 3}
              onPress={savePriorities}
            />
          )}
          {draft.step === "faith" && (
            <Button
              label="Continue"
              loading={busy}
              onPress={() =>
                run(async () => {
                  await saveProfile({
                    ...data.profile,
                    faith_tradition: draft.faith || null,
                  });
                  update({ step: "good_at" });
                })
              }
            />
          )}
          {draft.step === "good_at" && (
            <Button
              label="Continue"
              disabled={!draft.goodAt.trim()}
              onPress={() =>
                update({
                  step: "confirm",
                  proposed: priorityName(draft.goodAt),
                })
              }
            />
          )}
          {draft.step === "confirm" && (
            <Button
              label="Yes, that fits"
              loading={busy}
              disabled={!draft.proposed.trim() || draft.proposed.length > 80}
              onPress={() =>
                run(async () => {
                  const name = priorityName(draft.proposed);
                  const prior = data.entries.find(
                    (e) => e.kind === "value" && priorityName(e.title) === name,
                  );
                  if (!prior)
                    await putEntry(
                      entryInput("value", name, {
                        state: "important",
                        source: "Good at · confirmed by you",
                        body: draft.goodAt,
                      }),
                    );
                  onDone();
                })
              }
            />
          )}
          <Notice text={error || draftError} tone="error" />
        </>
      }
    >
      {draft.step === "important" && (
        <>
          <Title>Who do you want to be?</Title>
          <Body>
            Choose 10 priorities that matter to you. Next, you’ll choose three
            to work on.
          </Body>
          <Body>{draft.important.length} of 10 selected</Body>
          {Object.entries(groups).map(([group, names]) => (
            <View style={{ gap: 12 }} key={group}>
              <Body style={{ fontFamily: F.strong }}>{group}</Body>
              <View style={s.wrap}>
                {names.map((name) => (
                  <Chip
                    key={name}
                    label={`iwillbe.${name}`}
                    selected={draft.important.includes(name)}
                    disabled={
                      !draft.important.includes(name) &&
                      draft.important.length >= 10
                    }
                    onPress={() =>
                      update({
                        important: draft.important.includes(name)
                          ? draft.important.filter((v) => v !== name)
                          : [...draft.important, name],
                        working: draft.working.filter((v) => v !== name),
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ))}

          <TextButton
            label="Skip priorities for now"
            onPress={() => update({ step: "good_at" })}
          />
        </>
      )}
      {draft.step === "working" && (
        <>
          <Title>Which 3 do you most want to work on?</Title>
          <Body>These will help shape your first daily actions.</Body>
          <View style={s.wrap}>
            {draft.important.map((name) => (
              <Chip
                key={name}
                label={`iwillbe.${name}`}
                selected={draft.working.includes(name)}
                disabled={
                  !draft.working.includes(name) && draft.working.length >= 3
                }
                onPress={() =>
                  update({
                    working: draft.working.includes(name)
                      ? draft.working.filter((v) => v !== name)
                      : [...draft.working, name],
                  })
                }
              />
            ))}
          </View>

          <TextButton
            label="Change my ten"
            onPress={() => update({ step: "important" })}
          />
        </>
      )}
      {draft.step === "faith" && (
        <>
          <Title>Which tradition guides you?</Title>
          <Body>
            Optional. This stays private and helps choose thoughts that fit your
            tradition.
          </Body>
          <View style={s.wrap}>
            {FAITH_TRADITIONS.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={draft.faith === name}
                onPress={() =>
                  update({ faith: draft.faith === name ? "" : name })
                }
              />
            ))}
          </View>

          <TextButton
            label="Skip"
            onPress={() =>
              run(async () => {
                await saveProfile({ ...data.profile, faith_tradition: null });
                update({ step: "good_at" });
              })
            }
          />
        </>
      )}
      {draft.step === "good_at" && (
        <>
          <Title>
            What do people often tell you you’re good at, even if it feels easy
            to you?
          </Title>
          <Field
            label="In your words"
            multiline
            value={draft.goodAt}
            onChangeText={(goodAt) => update({ goodAt })}
            maxLength={500}
          />

          <TextButton label="Leave this for later" onPress={onDone} />
        </>
      )}
      {draft.step === "confirm" && (
        <>
          <Title>Is this a priority you want to keep?</Title>
          <Body>
            You can choose a word below or use your own. Nothing is added until
            you agree.
          </Body>
          <View style={s.wrap}>
            {priorities
              .filter((p) => draft.important.includes(p.name))
              .map((p) => (
                <Chip
                  key={p.name}
                  label={p.name}
                  selected={draft.proposed === p.name}
                  onPress={() => update({ proposed: p.name })}
                />
              ))}
          </View>
          <Field
            label="A priority, in your words"
            value={draft.proposed}
            onChangeText={(proposed) => update({ proposed })}
            maxLength={80}
          />

          <TextButton label="Keep going without adding it" onPress={onDone} />
        </>
      )}
    </Page>
  );
}
