import { withAccount } from "../src/access-gate";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { usePractice } from "../src/practice";
import { supabase } from "../src/supabase";
import { draftKey, useDraft } from "../src/drafts";
import {
  PLANETS,
  PLANET_OPENERS,
  entryInput,
  formatCommitment,
  suggestedPlanet,
  type Planet,
} from "../src/journey";
import { shiftDay } from "../src/domain";
import { useToday } from "../src/use-today";
import {
  Body,
  Button,
  Chip,
  C,
  Eyebrow,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
import { IWillBe } from "../src/priority-onboarding";
import {
  loadMissions,
  ladderStep,
  missionTrio,
  missionTag,
  type Mission,
} from "../src/missions";
import { MissionCards } from "../src/mission-cards";
import { beneficiaries, detectBeneficiary } from "../src/beneficiaries";
import { SupportNotice } from "../src/support";
import { supportLevel } from "../supabase/functions/_shared/safety";
type Step = "area" | "chat" | "when" | "person" | "review" | "done";
type Turn = { role: "user" | "assistant"; text: string };
type Params = {
  day?: string;
  action?: string;
  interest?: string;
  value?: string;
  person?: string;
  planet?: string;
  mission_id?: string;
  mission_step?: string;
  when_context?: string;
  with_person?: string;
  backlog?: string;
  from_map?: string;
};
function Ritual() {
  const params = useLocalSearchParams<Params>();
  const today = useToday();
  const day = params.day === shiftDay(today, 1) ? params.day : today;
  const { session } = usePractice();
  return (
    <Morning
      key={`${session?.user.id}:${day}:${params.action || ""}`}
      params={params}
      day={day}
    />
  );
}
function Morning({ params, day }: { params: Params; day: string }) {
  const today = useToday();
  const { data, session, saveIntention, putEntry } = usePractice();
  const current = data.intentions.find((i) => i.day === day);
  const locked =
    !!current && data.checkIns.some((c) => c.intention_id === current.id);
  const initialRecipient = params.action
    ? detectBeneficiary(params.action, beneficiaries(data))
    : null;
  const [seed] = useState(() => Crypto.randomUUID());
  const { draft, update, clear, ready, draftError } = useDraft(
    draftKey(
      `morning.v2.${day}.${params.from_map ? params.mission_id || "map" : "daily"}`,
      session?.user.id,
    ),
    {
      step: (params.action ? "when" : "area") as Step,
      sessionId: seed,
      area: (params.planet || "") as Planet | "",
      input: "",
      action: params.action || current?.action || "",
      interest: params.interest || current?.interest || "",
      value: params.value || current?.value || "",
      when: params.when_context || current?.when_context || "",
      person:
        params.person ||
        (params.action
          ? initialRecipient?.name || ""
          : current?.for_me
            ? "For me"
            : current?.for_whom || current?.person || ""),
      newPerson: "",
      addingPerson: false,
      missionId:
        params.mission_id || (!params.action ? current?.mission_id : "") || "",
      missionStep: Number(params.mission_step) || current?.mission_step || 1,
      turns: [] as Turn[],
      opener: 0,
      spotted: initialRecipient?.match || "",
      support: 0,
      revision: current?.revision || 0,
      alternatives: [] as string[],
      saveOthers: false,
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ideasError, setIdeasError] = useState(""),
    [missions, setMissions] = useState<Mission[]>([]),
    [loadingIdeas, setLoadingIdeas] = useState(false),
    [ideasTag, setIdeasTag] = useState("");
  const latestIdeas = useRef(0);
  const inFlight = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = async (work: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const area =
    draft.area === "Surprise" ? suggestedPlanet(data, day) : draft.area;
  const people = beneficiaries(data);
  const openers = area ? PLANET_OPENERS[area] : [];
  const options = missionTrio(missions);
  const recommended = options.find((m) => m.size === "Normal");
  const loadIdeas = async (tag: string) => {
    const request = ++latestIdeas.current;
    setIdeasTag(tag);
    setLoadingIdeas(true);
    setIdeasError("");
    setMissions([]);
    try {
      const entry = data.entries.find(
        (e) => e.title === tag && e.kind === "interest",
      );
      const result = await loadMissions(
        tag,
        entry ? ladderStep(data, entry) : 1,
      );
      if (alive.current && request === latestIdeas.current)
        setMissions(result.missions);
    } catch (e) {
      if (alive.current && request === latestIdeas.current)
        setIdeasError((e as Error).message);
    } finally {
      if (alive.current && request === latestIdeas.current)
        setLoadingIdeas(false);
    }
  };
  const chooseAction = (action: string, mission?: Mission) => {
    if (action.trim().length > 500) {
      setError(
        "Keep today’s action to 500 characters so it stays clear and doable.",
      );
      return;
    }
    const detected = detectBeneficiary(action, people);
    update({
      action,
      step: "when",
      missionId: mission?.id || "",
      missionStep: mission?.ladder_step || 1,
      ...(mission
        ? {
            area: mission.area,
            interest: mission.priorities.some(
              (p) => missionTag(p) === missionTag(ideasTag),
            )
              ? ""
              : ideasTag,
            value: mission.priorities.some(
              (p) => missionTag(p) === missionTag(ideasTag),
            )
              ? ideasTag
              : "",
          }
        : {}),
      person: detected?.name || "",
      spotted: detected?.match || "",
    });
  };
  const begin = () =>
    run(async () => {
      if (!area) return;
      const started = await supabase.functions.invoke("chloe", {
        body: { action: "start_checkin", session_id: draft.sessionId },
      });
      if (started.error || started.data?.error)
        throw new Error("Your check-in couldn’t start. Please try again.");
      update({
        step: "chat",
        turns: [
          {
            role: "assistant",
            text:
              openers[draft.opener % openers.length] ||
              "What would you like to do today?",
          },
        ],
      });
      const entry = data.entries
        .filter(
          (e) =>
            e.kind === (area === "Be" ? "value" : "interest") &&
            !["let_go", "paused", "ember", "on_pause"].includes(e.state),
        )
        .filter(
          (e) => area === "Be" || !e.meta.planet || e.meta.planet === area,
        )
        .sort(
          (a, b) =>
            Number(
              ["working_on", "trying", "want_to_try", "tried"].includes(
                b.state,
              ),
            ) -
            Number(
              ["working_on", "trying", "want_to_try", "tried"].includes(
                a.state,
              ),
            ),
        )[0];
      const tag = params.interest || params.value || entry?.title;
      if (tag) void loadIdeas(tag);
    });
  const send = () =>
    run(async () => {
      const text = draft.input.trim();
      if (!text) return;
      const level = supportLevel(text);
      const turns = [...draft.turns, { role: "user" as const, text }];
      update({ input: "", turns, support: Math.max(draft.support, level) });
      const result = await supabase.functions.invoke("chloe", {
        body: {
          action: "chat",
          mode: "morning",
          message: text,
          area,
          session_id: draft.sessionId,
          proposal_cards: true,
          ritual: {
            action: draft.action,
            interest: ideasTag || draft.interest,
            when_context: draft.when,
            ladder_step: options[0]?.ladder_step || 1,
          },
        },
      });
      if (!alive.current) return;
      if (result.error || result.data?.error) {
        update({ input: text });
        throw new Error(
          "Chloe couldn’t reply. Your words are still here; try again or use them as your action.",
        );
      }
      const reply = result.data;
      const suggestion = reply.suggested_intention;
      const serverLevel = Number(reply.support_level) || 0;
      update({
        turns: [
          ...turns,
          {
            role: "assistant",
            text:
              reply.messages
                ?.filter((m: { role: string }) => m.role === "assistant")
                .at(-1)?.content ||
              "What would make this a concrete action today?",
          },
        ],
        support: Math.max(draft.support, level, serverLevel),
        ...(suggestion && level < 2 && serverLevel < 2
          ? {
              action: suggestion.action,
              interest: suggestion.interest || draft.interest,
              value: suggestion.value || draft.value,
              when: suggestion.when_context || draft.when,
              person: suggestion.person || "",
            }
          : {}),
      });
      if (suggestion?.interest && level < 2 && serverLevel < 2)
        void loadIdeas(suggestion.interest);
    });
  const save = () =>
    run(async () => {
      if (draft.support >= 2) return;
      await saveIntention(
        draft.action.replace(/^I will\s+/i, ""),
        draft.value,
        draft.person === "For me" ? "" : draft.person,
        day,
        draft.interest,
        {
          planet: area || "Passions",
          kind: /^I will be\b|^be\b/i.test(draft.action) ? "be" : "action",
          when_context: draft.when.trim(),
          for_whom: draft.person === "For me" ? "" : draft.person,
          for_me: draft.person === "For me",
          mission_id: draft.missionId || null,
          mission_step: draft.missionId ? draft.missionStep : null,
          revision: draft.revision,
        },
      );
      if (draft.saveOthers)
        for (const text of draft.alternatives.filter(
          (t) => t !== draft.action,
        )) {
          if (
            !data.entries.some(
              (e) =>
                e.kind === "backlog" && e.title === text && e.state === "open",
            )
          )
            await putEntry(
              entryInput("backlog", text, {
                state: "open",
                source: "Another idea for later",
                meta: { planet: area || "Passions" },
              }),
            );
        }
      if (params.backlog) {
        const entry = data.entries.find((e) => e.id === params.backlog);
        if (entry)
          await putEntry({
            ...entry,
            meta: { ...entry.meta, commitment_day: day },
          });
      }
      await clear();
      router.replace({ pathname: "/", params: { saved: day } });
    });
  if (!ready)
    return <ActivityIndicator accessibilityLabel="Restoring your action" />;
  const primaryLabel =
    draft.step === "chat"
      ? "Send to Chloe"
      : draft.step === "review"
        ? day === today
          ? "Done · save for today"
          : "Done · save for tomorrow"
        : "Continue";
  const primaryDisabled =
    draft.step === "chat"
      ? !draft.input.trim()
      : draft.step === "area"
        ? !draft.area
        : draft.step === "review"
          ? !draft.action.trim()
          : draft.step === "person" && draft.addingPerson
            ? !draft.newPerson.trim()
            : false;
  const advance = () => {
    if (draft.step === "chat") void send();
    else if (draft.step === "area") void begin();
    else if (draft.step === "when") update({ step: "person" });
    else if (draft.step === "person")
      update({
        step: "review",
        person: draft.addingPerson ? draft.newPerson.trim() : draft.person,
        addingPerson: false,
      });
    else if (draft.step === "review") void save();
  };
  return (
    <Page
      header={
        <TopBar
          title="Today’s action"
          onBack={() =>
            draft.step === "review"
              ? update({ step: "person" })
              : draft.step === "person"
                ? update({ step: "when" })
                : draft.step === "when"
                  ? update({ step: "chat" })
                  : router.replace("/")
          }
        />
      }
      footer={
        <>
          <Notice text={error || draftError} tone="error" />
          {["area", "chat", "when", "person", "review"].includes(draft.step) &&
            !locked &&
            (draft.step === "chat" || draft.support < 2) && (
              <Button
                label={primaryLabel}
                disabled={primaryDisabled}
                onPress={advance}
                loading={busy}
                commitPulse={draft.step === "review"}
              />
            )}
        </>
      }
    >
      {locked ? (
        <>
          <Title>Today’s reflection is saved.</Title>
          <Body>
            Keep this moment in your history. Tomorrow can be something
            different.
          </Body>
          <Button label="Back to Today" onPress={() => router.replace("/")} />
        </>
      ) : (
        <>
          {draft.step === "area" && (
            <>
              <Eyebrow>One action, out in your life</Eyebrow>
              <Title>Pick one area for today.</Title>
              <Body>
                Start with what matters now. Chloe will help you choose a
                concrete next step.
              </Body>
              <View style={s.wrap}>
                {PLANETS.map((value) => (
                  <Chip
                    key={value}
                    label={value === "Surprise" ? "Surprise me" : value}
                    selected={draft.area === value}
                    onPress={() => update({ area: value })}
                  />
                ))}
              </View>
            </>
          )}
          {draft.step === "chat" && (
            <>
              <View style={s.wrap}>
                {PLANETS.map((value) => (
                  <Chip
                    key={value}
                    label={value === "Surprise" ? "Surprise me" : value}
                    selected={draft.area === value}
                    onPress={() => {
                      update({
                        area: value,
                        step: "area",
                        action: "",
                        missionId: "",
                        turns: [],
                      });
                      latestIdeas.current += 1;
                      setMissions([]);
                    }}
                  />
                ))}
              </View>
              {draft.turns.map((turn, i) => (
                <View
                  key={i}
                  style={[
                    s.card,
                    {
                      backgroundColor: turn.role === "user" ? C.soft : C.white,
                      alignSelf: turn.role === "user" ? "flex-end" : "stretch",
                      maxWidth: "95%",
                    },
                  ]}
                >
                  <Body>{turn.text}</Body>
                </View>
              ))}
              {draft.support >= 2 ? (
                <SupportNotice level={draft.support} />
              ) : (
                <>
                  <TextButton
                    label="Ask me something else"
                    onPress={() =>
                      update({
                        opener: draft.opener + 1,
                        turns: [
                          ...draft.turns,
                          {
                            role: "assistant",
                            text:
                              openers[(draft.opener + 1) % openers.length] ||
                              "What have you been meaning to try?",
                          },
                        ],
                      })
                    }
                  />
                  {loadingIdeas ? (
                    <Body>Finding a few ideas…</Body>
                  ) : (
                    options.length > 0 && (
                      <>
                        <Body>
                          Something to try{ideasTag ? ` with ${ideasTag}` : ""}:
                        </Body>
                        <MissionCards
                          missions={options}
                          selected={recommended?.id || ""}
                          onSelect={(m) => chooseAction(m.mission_text, m)}
                        />
                      </>
                    )
                  )}
                  <Notice text={ideasError} />
                  {!!draft.action && (
                    <View style={s.card}>
                      <Body>{formatCommitment(draft.action)}</Body>
                      <Button
                        secondary
                        label="Use this action"
                        onPress={() => chooseAction(draft.action)}
                      />
                    </View>
                  )}
                </>
              )}
              <Field
                label="Your reply"
                placeholder="Tell Chloe, or write your own action…"
                multiline
                value={draft.input}
                onChangeText={(input) => update({ input })}
                maxLength={2000}
              />

              {draft.support < 2 && (
                <TextButton
                  label="Use my words as today’s action"
                  onPress={() => {
                    const level = supportLevel(draft.input);
                    if (level >= 2) {
                      update({ support: level });
                      return;
                    }
                    const alternatives = draft.input
                      .split(/\n+/)
                      .map((t) => t.trim())
                      .filter(Boolean);
                    if (alternatives.length > 1) update({ alternatives });
                    else if (draft.input.trim())
                      chooseAction(draft.input.trim());
                  }}
                />
              )}
              {draft.alternatives.length > 1 && (
                <>
                  <Body>Which one do you want to focus on today?</Body>
                  {draft.alternatives.map((text) => (
                    <Button
                      key={text}
                      label={text}
                      secondary
                      onPress={() => chooseAction(text)}
                    />
                  ))}
                  <Chip
                    label="Save the others for later"
                    selected={draft.saveOthers}
                    onPress={() => update({ saveOthers: !draft.saveOthers })}
                  />
                </>
              )}
            </>
          )}
          {draft.step === "when" && (
            <>
              <Body>{formatCommitment(draft.action)}</Body>
              <Title>When will you do it?</Title>
              <Field
                label="When, or right after what?"
                placeholder="After lunch, when I get home…"
                value={draft.when}
                onChangeText={(when) => update({ when })}
                maxLength={200}
              />
              <Body>You can leave this open if you don’t know yet.</Body>
            </>
          )}
          {draft.step === "person" && (
            <>
              <Title>For whom?</Title>
              <Body>
                A person, your community, or yourself. You can also leave this
                open.
              </Body>
              {!!draft.spotted && (
                <Body>Spotted in your action: {draft.spotted}.</Body>
              )}
              <View style={s.wrap}>
                {people.map((person) => (
                  <Chip
                    key={person}
                    label={person}
                    selected={draft.person === person && !draft.addingPerson}
                    onPress={() =>
                      update({
                        person: draft.person === person ? "" : person,
                        addingPerson: false,
                      })
                    }
                  />
                ))}
                <Chip
                  label="+ Someone"
                  selected={draft.addingPerson}
                  onPress={() =>
                    update({ addingPerson: !draft.addingPerson, person: "" })
                  }
                />
              </View>
              {draft.addingPerson && (
                <Field
                  label="Name"
                  value={draft.newPerson}
                  onChangeText={(newPerson) => update({ newPerson })}
                  maxLength={120}
                />
              )}
            </>
          )}
          {draft.step === "review" && (
            <>
              <Eyebrow>{day === today ? "Today" : "Tomorrow"}</Eyebrow>
              <IWillBe>
                {draft.interest || draft.value || "taking a small step"}
              </IWillBe>
              <Title>{formatCommitment(draft.action)}</Title>
              {!!draft.when && <Body>{draft.when}</Body>}
              {!!draft.person && (
                <Body>
                  {draft.person === "For me" ? "For me" : `For ${draft.person}`}
                </Body>
              )}
              <Body>I’ll ask how it went tonight.</Body>
            </>
          )}
        </>
      )}
    </Page>
  );
}
export default withAccount(Ritual);
