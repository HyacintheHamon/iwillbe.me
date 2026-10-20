import React, { useState } from "react";
import { Image, View } from "react-native";
import { router } from "expo-router";
import { POSSIBILITIES, SPARK_ART, type Possibility } from "../src/catalog";
import { usePractice } from "../src/practice";
import { entryInput, entriesOf } from "../src/journey";
import { nextIntentionDay } from "../src/domain";
import { useAction } from "../src/use-action";
import {
  Body,
  Button,
  Chip,
  Eyebrow,
  Field,
  Notice,
  Page,
  Sheet,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
export default function Explore() {
  const { data, putEntry } = usePractice();
  const [domain, setDomain] = useState("All"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Possibility | null>(null),
    [message, setMessage] = useState("");
  const action = useAction();
  const dismissed = entriesOf(data, "preferences").find(
    (e) => e.title === "Explorer choices",
  );
  const excluded = dismissed?.source_ids || [];
  const saveSpark = (item: Possibility) =>
    action.run(async () => {
      if (!entriesOf(data, "interest").some((e) => e.title === item.title))
        await putEntry(
          entryInput("interest", item.title, {
            state: "spark",
            source: "Saved from Explore",
            body: item.description,
          }),
        );
      setMessage(`${item.title} is saved as a Spark.`);
      setSelected(null);
    });
  return (
    <Page header={<TopBar title="Possibilities" />}>
      <Eyebrow>A little beyond the familiar</Eyebrow>
      <Title>What could you try?</Title>
      <Body>
        Follow a curiosity. Every possibility starts with something small.
      </Body>
      <Field
        label="Find a possibility"
        value={query}
        onChangeText={setQuery}
        placeholder="Making, nature, teaching…"
      />
      <View style={s.wrap}>
        {["All", ...new Set(POSSIBILITIES.map((p) => p.domain))].map((d) => (
          <Chip
            key={d}
            label={d}
            selected={domain === d}
            onPress={() => setDomain(d)}
          />
        ))}
      </View>
      <Notice
        text={message || action.error}
        tone={action.error ? "error" : "normal"}
      />
      {POSSIBILITIES.filter(
        (p) =>
          !excluded.includes(p.id) &&
          (domain === "All" || p.domain === domain) &&
          `${p.title} ${p.domain}`.toLowerCase().includes(query.toLowerCase()),
      ).map((item) => (
        <View key={item.id} style={s.card}>
          <Image
            source={SPARK_ART[item.image as keyof typeof SPARK_ART]}
            style={{ width: "100%", height: 150, borderRadius: 14 }}
          />
          <Eyebrow>{item.domain}</Eyebrow>
          <Title style={{ fontSize: 24, lineHeight: 30 }}>{item.title}</Title>
          <Body>{item.description}</Body>
          <TextButton
            label={`Explore ${item.title}`}
            onPress={() => setSelected(item)}
          />
        </View>
      ))}
      {excluded.length ? (
        <TextButton
          label="Show possibilities I passed on"
          onPress={() =>
            action.run(async () => {
              await putEntry({ ...dismissed!, source_ids: [] });
            })
          }
        />
      ) : null}
      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || ""}
      >
        {selected ? (
          <>
            <Image
              source={SPARK_ART[selected.image as keyof typeof SPARK_ART]}
              style={{ width: "100%", height: 180, borderRadius: 18 }}
            />
            <Body>{selected.description}</Body>
            <Eyebrow>A first try</Eyebrow>
            <Body>{selected.first}</Body>
            <Body>
              {selected.time} · {selected.cost}
            </Body>
            <Body style={{ fontSize: 13 }}>
              Start at your own pace. Local availability and access vary; no
              booking is made here.
            </Body>
            <Eyebrow>Why it might fit</Eyebrow>
            <Body>
              {entriesOf(data, "interest").some((e) =>
                POSSIBILITIES.some(
                  (p) => p.title === e.title && p.domain === selected.domain,
                ),
              )
                ? `You have chosen other sparks in ${selected.domain.toLowerCase()}. This is another way to explore that curiosity.`
                : "A new possibility to explore. You decide whether it feels like you."}
            </Body>
            <Button
              label="Try this next"
              onPress={() => {
                const item = selected;
                setSelected(null);
                router.push({
                  pathname: "/ritual",
                  params: {
                    action: item.first,
                    interest: item.title,
                    day: nextIntentionDay(data),
                  },
                });
              }}
            />
            <Button
              secondary
              label="Save as a Spark"
              loading={action.busy}
              onPress={() => saveSpark(selected)}
            />
            <TextButton
              label="Not for me"
              onPress={() =>
                action.run(async () => {
                  await putEntry(
                    entryInput("preferences", "Explorer choices", {
                      id: dismissed?.id,
                      source_ids: [...excluded, selected.id],
                    }),
                  );
                  setSelected(null);
                })
              }
            />
            <Eyebrow>Follow another thread</Eyebrow>
            {selected.related.map((id) => {
              const related = POSSIBILITIES.find((p) => p.id === id)!;
              return (
                <TextButton
                  key={id}
                  label={related.title}
                  onPress={() => setSelected(related)}
                />
              );
            })}
            <Notice text={action.error} tone="error" />
          </>
        ) : null}
      </Sheet>
    </Page>
  );
}
