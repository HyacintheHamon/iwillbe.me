import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { usePractice } from "./practice";
import { useToday } from "./use-today";
import { useAction } from "./use-action";
import { entryInput, type Entry } from "./journey";
import { norm } from "./round2";
import {
  discoverInterests,
  discoveryHistory,
  discoveryTitles,
  type DiscoveryIdea,
} from "./round4-map";
import { Body, Button, C, F, Field, Notice, Title, s } from "./ui";

/** The same discovery choices are used by My map and the Sunday review. */
export function InterestDiscovery({
  custom = false,
  onAdded,
}: {
  custom?: boolean;
  onAdded?: (title: string) => void;
}) {
  const { data, session, putEntry } = usePractice();
  const today = useToday();
  const action = useAction();
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyPending, setHistoryPending] = useState(true);
  const [batch, setBatch] = useState(() =>
    discoverInterests(data, discoveryHistory(data, today), today),
  );
  const seen = useRef(new Set(discoveryHistory(data, today)));
  const cursor = useRef(0);
  const live = useRef({ data, putEntry, owner: session?.user.id });
  const history = useRef<Entry | undefined>(undefined);
  const batchKey = discoveryTitles(batch).join("|");
  useEffect(() => {
    live.current = { data, putEntry, owner: session?.user.id };
  }, [data, putEntry, session?.user.id]);
  useEffect(() => {
    const owner = session?.user.id;
    if (!owner || !batchKey) return;
    let active = true;
    for (const title of batchKey.split("|")) seen.current.add(title);
    const old =
      history.current ||
      live.current.data.entries.find(
        (entry) =>
          entry.kind === "preferences" && entry.title === "Interest discovery",
      );
    void live.current
      .putEntry(
        entryInput("preferences", "Interest discovery", {
          id: old?.id,
          revision: old?.revision,
          source:
            "Recent ideas, so the next visit can offer something different",
          meta: {
            ...old?.meta,
            blocks: [...seen.current].slice(-60),
            last_shown_day: today,
          },
        }),
      )
      .then((saved) => {
        if (active && live.current.owner === owner) {
          history.current = saved;
          setHistoryError("");
        }
      })
      .catch(() => {
        if (active && live.current.owner === owner)
          setHistoryError(
            "Your choices are safe. Recent suggestions could not sync yet.",
          );
      })
      .finally(() => {
        if (active) setHistoryPending(false);
      });
    return () => {
      active = false;
    };
  }, [batchKey, session?.user.id, today]);

  const add = (title: string, source: string) =>
    action.run(async () => {
      const clean = title.trim();
      if (!clean) return;
      const known = data.entries.find(
        (entry) =>
          entry.kind === "interest" && norm(entry.title) === norm(clean),
      );
      if (!known)
        await putEntry(
          entryInput("interest", clean, { state: "want_to_try", source }),
        );
      setName("");
      setNotice(
        known
          ? "This interest is already on your map."
          : "Added to Want to try. Chloe will suggest a first step.",
      );
      if (!known) onAdded?.(clean);
    });
  const next = () => {
    setHistoryPending(true);
    cursor.current += 1;
    setBatch(
      discoverInterests(data, [...seen.current], `${today}:${cursor.current}`),
    );
    setNotice("");
  };
  const group = (title: string, ideas: DiscoveryIdea[]) => (
    <View style={{ gap: 12 }}>
      <Title style={{ fontSize: 23, lineHeight: 29 }}>{title}</Title>
      {ideas.length ? (
        ideas.map((idea) => {
          const added = data.entries.some(
            (entry) =>
              entry.kind === "interest" &&
              norm(entry.title) === norm(idea.title),
          );
          return (
            <View
              key={idea.title}
              style={[
                s.card,
                {
                  borderWidth: 1,
                  borderColor: C.line,
                  borderRadius: 22,
                  gap: 10,
                },
              ]}
            >
              <Body style={{ fontFamily: F.bold, fontSize: 19 }}>
                {idea.title}
              </Body>
              <Body style={{ color: C.muted }}>{idea.reason}</Body>
              <Button
                secondary
                icon={false}
                label={added ? "Added" : "+ Want to try"}
                disabled={added || action.busy}
                onPress={() => add(idea.title, `Explore · ${idea.source}`)}
              />
            </View>
          );
        })
      ) : (
        <Body style={{ color: C.muted }}>
          {title === "Close to what you love"
            ? "You've seen the nearby ideas for now. Add your own interest, or try a different direction."
            : "You've seen these ideas for now. There is always room for one of your own."}
        </Body>
      )}
    </View>
  );
  return (
    <View style={{ gap: 24 }}>
      {custom && (
        <View style={[s.card, { gap: 12 }]}>
          <Body style={{ fontFamily: F.bold }}>Add your own</Body>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Body style={{ fontFamily: F.bold }}>iwillbe.</Body>
            <View style={{ flex: 1 }}>
              <Field
                label="An interest"
                placeholder="(something you heard of)"
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
                maxLength={80}
                onSubmitEditing={() => add(name, "Explore · your own interest")}
              />
            </View>
          </View>
          <Button
            label="Add"
            icon={false}
            disabled={!name.trim()}
            loading={action.busy}
            onPress={() => add(name, "Explore · your own interest")}
          />
        </View>
      )}
      <Notice text={notice} />
      {group("Close to what you love", batch.close)}
      {group("Something different", batch.different)}
      <Button
        secondary
        icon={false}
        label="↻ Other ideas"
        disabled={action.busy || historyPending || !batchKey}
        onPress={next}
      />
      <Notice text={action.error || historyError} tone="error" />
    </View>
  );
}
