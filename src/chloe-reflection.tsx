import React, { useState } from "react";
import { View } from "react-native";
import type { ReflectionProposal } from "../supabase/functions/chloe/proposals";
import { outcomeLabel, shiftDay } from "./domain";
import { entriesOf, entryInput, formatCommitment } from "./journey";
import { usePractice } from "./practice";
import { useToday } from "./use-today";
import {
  Body,
  Button,
  Chip,
  Eyebrow,
  Field,
  Notice,
  TextButton,
  Title,
  s,
} from "./ui";

const energyLabels = {
  lit: "It lit me up",
  neutral: "Neutral",
  drained: "It drained me",
};
const valueLabels = {
  yes: "Keep it",
  not_sure: "Still deciding",
  not_mine: "Let it go",
};
export type PendingReflection = ReflectionProposal & {
  pending_revision?: number;
};

export function ChloeReflection({
  proposal,
  onChange,
  onSaved,
  onDismiss,
}: {
  proposal: PendingReflection;
  onChange: (proposal: PendingReflection) => void;
  onSaved: () => void;
  onDismiss: () => void;
}) {
  const { data, checkIn, putEntry } = usePractice();
  const today = useToday();
  const [step, setStep] = useState<
    "review" | "outcome" | "energy" | "value" | "replacement" | "note"
  >("review");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const intention = data.intentions.find((i) => i.id === proposal.intention_id);
  const patch = (change: Partial<ReflectionProposal>) =>
    onChange({ ...proposal, ...change });
  const leaveOpen = async (
    question: string,
    change: Partial<ReflectionProposal>,
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const existing = entriesOf(data, "question").find(
        (entry) => entry.title === question,
      );
      await putEntry(
        entryInput("question", question, {
          ...existing,
          state: existing?.state === "stopped" ? "stopped" : "open",
          source: "Night reflection · left to sit",
          meta: {
            ...existing?.meta,
            next_day: shiftDay(today, 2),
            last_asked_at: new Date().toISOString(),
            last_asked_session: `night:${today}`,
          },
        }),
      );
      patch(change);
      setNotice("Let it sit with you. We can come back to it another time.");
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!intention || intention.day !== today)
    return (
      <View style={s.card}>
        <Body>
          This draft belongs to another day. Your words remain in the
          conversation.
        </Body>
        <TextButton label="Leave this draft" onPress={onDismiss} />
      </View>
    );
  const save = async () => {
    if (!proposal.outcome || busy) return;
    if (
      proposal.replacement_value !== null &&
      (!proposal.replacement_value.trim() ||
        proposal.replacement_value.trim().toLowerCase() ===
          intention.value.toLowerCase())
    ) {
      setStep("replacement");
      setError(
        "Name the other value, or keep this as letting the first one go.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await checkIn({
        revision: proposal.pending_revision ?? 0,
        intention_id: intention.id,
        outcome: proposal.outcome,
        reflection: proposal.reflection.trim(),
        energy:
          proposal.outcome !== "not_yet" && intention.interest
            ? proposal.energy
            : null,
        value_choice:
          proposal.outcome !== "not_yet" && intention.value
            ? proposal.value_choice
            : null,
      });
      if (
        proposal.outcome !== "not_yet" &&
        proposal.value_choice === "not_mine" &&
        proposal.replacement_value?.trim()
      ) {
        const title = proposal.replacement_value.trim();
        const existing = entriesOf(data, "value").find(
          (e) => e.title.toLowerCase() === title.toLowerCase(),
        );
        await putEntry(
          entryInput("value", title, {
            ...existing,
            state: "trying",
            source: "Chosen in a night reflection",
            source_ids: Array.from(
              new Set([...(existing?.source_ids || []), intention.id]),
            ),
          }),
        );
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={s.card}>
      <Eyebrow>Tonight · ready when it feels right</Eyebrow>
      <Body>{formatCommitment(intention.action, intention.kind)}</Body>
      {step === "review" ? (
        <>
          <Title style={{ fontSize: 23, lineHeight: 30 }}>
            Your reflection
          </Title>
          <Body>
            {proposal.outcome
              ? outcomeLabel(proposal.outcome)
              : "How it went: not answered"}
          </Body>
          <TextButton
            label={
              proposal.outcome ? "Change how it went" : "Choose how it went"
            }
            onPress={() => setStep("outcome")}
          />
          {intention.interest && proposal.outcome !== "not_yet" ? (
            <>
              <Body>
                {proposal.energy
                  ? energyLabels[proposal.energy]
                  : "Energy: left open"}
              </Body>
              <TextButton
                label="Change the energy answer"
                onPress={() => setStep("energy")}
              />
            </>
          ) : null}
          {intention.value && proposal.outcome !== "not_yet" ? (
            <>
              <Body>
                {intention.value}:{" "}
                {proposal.value_choice
                  ? valueLabels[proposal.value_choice]
                  : "left open"}
                {proposal.replacement_value
                  ? ` · Trying on ${proposal.replacement_value}`
                  : ""}
              </Body>
              <TextButton
                label="Change the value answer"
                onPress={() => setStep("value")}
              />
            </>
          ) : null}
          {proposal.reflection ? <Body>{proposal.reflection}</Body> : null}
          <TextButton
            label={
              proposal.reflection ? "Edit my words" : "Add a thought · optional"
            }
            onPress={() => setStep("note")}
          />
          <Button
            label={
              data.checkIns.some((c) => c.intention_id === intention.id)
                ? "Update tonight’s reflection"
                : "Save tonight’s reflection"
            }
            disabled={!proposal.outcome}
            loading={busy}
            onPress={() => void save()}
          />
          <TextButton label="Keep just the conversation" onPress={onDismiss} />
        </>
      ) : step === "outcome" ? (
        <>
          <Title style={{ fontSize: 24, lineHeight: 31 }}>
            Did you show up?
          </Title>
          {(["yes", "partly", "not_yet"] as const).map((outcome) => (
            <Button
              secondary
              key={outcome}
              label={outcomeLabel(outcome)}
              onPress={() => {
                patch({
                  outcome,
                  ...(outcome === "not_yet"
                    ? {
                        energy: null,
                        value_choice: null,
                        replacement_value: null,
                      }
                    : {}),
                });
                setStep("review");
              }}
            />
          ))}
          <TextButton
            label="Leave this open"
            onPress={() => {
              void leaveOpen("Did you show up?", { outcome: null });
            }}
          />
        </>
      ) : step === "energy" ? (
        <>
          <Title style={{ fontSize: 24, lineHeight: 31 }}>
            How did it leave you feeling?
          </Title>
          {(["lit", "neutral", "drained"] as const).map((energy) => (
            <Button
              secondary
              key={energy}
              label={energyLabels[energy]}
              onPress={() => {
                patch({ energy });
                setStep("review");
              }}
            />
          ))}
          <TextButton
            label="Leave this open"
            onPress={() => {
              void leaveOpen("How did it leave you feeling?", { energy: null });
            }}
          />
        </>
      ) : step === "value" ? (
        <>
          <Title style={{ fontSize: 24, lineHeight: 31 }}>
            Do you choose {intention.value.toLowerCase()} again?
          </Title>
          {(["yes", "not_sure", "not_mine"] as const).map((value_choice) => (
            <Button
              secondary
              key={value_choice}
              label={valueLabels[value_choice]}
              onPress={() => {
                patch({ value_choice, replacement_value: null });
                setStep("review");
              }}
            />
          ))}
          <Button
            secondary
            label="Another value matters more"
            onPress={() => {
              patch({ value_choice: "not_mine", replacement_value: "" });
              setStep("replacement");
            }}
          />
          <TextButton
            label="Leave this open"
            onPress={() => {
              void leaveOpen(
                `Do you choose ${intention.value.toLowerCase()} again?`,
                { value_choice: null, replacement_value: null },
              );
            }}
          />
        </>
      ) : step === "replacement" ? (
        <>
          <Title style={{ fontSize: 24, lineHeight: 31 }}>
            Which value feels more like you?
          </Title>
          <Field
            label="Another value"
            maxLength={80}
            value={proposal.replacement_value || ""}
            onChangeText={(replacement_value) => patch({ replacement_value })}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {entriesOf(data, "value")
              .filter((v) => v.title !== intention.value)
              .slice(0, 5)
              .map((v) => (
                <Chip
                  key={v.id}
                  label={v.title}
                  onPress={() => patch({ replacement_value: v.title })}
                />
              ))}
          </View>
          <Button
            label="Keep this value choice"
            disabled={!proposal.replacement_value?.trim()}
            onPress={() => setStep("review")}
          />
          <TextButton
            label="Just let the first one go"
            onPress={() => {
              patch({ replacement_value: null });
              setStep("review");
            }}
          />
          <TextButton
            label="Leave this open"
            onPress={() => {
              void leaveOpen("Which value feels more like you?", {
                value_choice: null,
                replacement_value: null,
              });
            }}
          />
        </>
      ) : (
        <>
          <Field
            label="My words"
            multiline
            maxLength={2000}
            value={proposal.reflection}
            onChangeText={(reflection) => patch({ reflection })}
          />
          <Button label="Keep these words" onPress={() => setStep("review")} />
        </>
      )}
      {step !== "review" ? (
        <TextButton
          label="Back to my reflection"
          onPress={() => setStep("review")}
        />
      ) : null}
      <Notice text={error} tone="error" />
      <Notice text={notice} />
    </View>
  );
}
