import React, { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { usePractice } from "../src/practice";
import {
  dayLabel,
  matchesDimension,
  outcomeLabel,
  type Dimension,
} from "../src/domain";
import { useToday } from "../src/use-today";
import {
  Body,
  Button,
  Chip,
  Eyebrow,
  Field,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
export default function History() {
  const { data } = usePractice();
  const today = useToday();
  const { id, dimension, label } = useLocalSearchParams<{
    id?: string;
    dimension?: Dimension;
    label?: string;
  }>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  if (id) {
    const intention = data.intentions.find((i) => i.id === id);
    const reflection = data.checkIns.find((c) => c.intention_id === id);
    return (
      <Page header={<TopBar title="Your moment" />}>
        {intention ? (
          <>
            <Eyebrow>{dayLabel(intention.day)}</Eyebrow>
            <Title>{intention.action}</Title>
            <Body>
              {intention.value}
              {intention.interest ? ` · ${intention.interest}` : ""} · For{" "}
              {intention.person || "myself"}
            </Body>
            {reflection ? (
              <View style={s.card}>
                <Eyebrow>{outcomeLabel(reflection.outcome)}</Eyebrow>
                <Body>
                  {reflection.reflection || "You kept this reflection simple."}
                </Body>
              </View>
            ) : (
              <Body>
                {intention.day > today
                  ? "This intention is waiting for tomorrow."
                  : "This day is still open. You can reflect on it now."}
              </Body>
            )}
            {intention.day <= today && (
              <Button
                label={
                  reflection ? "Edit this reflection" : "Reflect on this moment"
                }
                onPress={() =>
                  router.push({ pathname: "/reflect", params: { id } })
                }
              />
            )}
            <TextButton
              label="View all my history"
              onPress={() => router.replace("/history")}
            />
          </>
        ) : (
          <>
            <Title>Moment not found.</Title>
            <Button
              label="View my history"
              onPress={() => router.replace("/history")}
            />
          </>
        )}
      </Page>
    );
  }
  const items = [...data.intentions]
    .filter((i) => {
      const reflected = data.checkIns.some((c) => c.intention_id === i.id);
      return (
        (!dimension || !label || matchesDimension(i, dimension, label)) &&
        (filter === "All" ||
          (filter === "To reflect"
            ? !reflected && i.day <= today
            : filter === "Upcoming"
              ? i.day > today
              : reflected)) &&
        `${i.day} ${dayLabel(i.day)} ${i.action} ${i.value} ${i.interest || ""} ${i.person}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      );
    })
    .sort((a, b) => b.day.localeCompare(a.day));
  return (
    <Page header={<TopBar title="Your history" />}>
      <Eyebrow>
        {label ? `${dimension} · ${label}` : "EVERY SMALL MOMENT"}
      </Eyebrow>
      <Title>Your practice, over time.</Title>
      <Field
        label="SEARCH YOUR HISTORY"
        placeholder="Date, value, interest, person or action"
        value={search}
        onChangeText={setSearch}
      />
      <View style={s.wrap}>
        {["All", "To reflect", "Reflected", "Upcoming"].map((v) => (
          <Chip
            key={v}
            label={v}
            selected={filter === v}
            onPress={() => setFilter(v)}
          />
        ))}
      </View>
      {label && (
        <TextButton
          label="Clear galaxy filter"
          onPress={() => router.replace("/history")}
        />
      )}
      <Body>
        {items.length} {items.length === 1 ? "moment" : "moments"}
      </Body>
      {items.map((i) => (
        <View key={i.id} style={s.card}>
          <Eyebrow>{dayLabel(i.day)}</Eyebrow>
          <Body>
            {i.value}
            {i.interest ? ` · ${i.interest}` : ""} · For {i.person || "myself"}
          </Body>
          <TextButton
            label={i.action}
            onPress={() =>
              router.push({ pathname: "/history", params: { id: i.id } })
            }
          />
          <Body style={{ fontSize: 13 }}>
            {i.day > today
              ? "Upcoming"
              : data.checkIns.some((c) => c.intention_id === i.id)
                ? "Reflected"
                : "Open for reflection"}
          </Body>
        </View>
      ))}
      {!items.length && (
        <Body>
          {data.intentions.length
            ? "No moments match. Try another search or filter."
            : "Your first intention will start your history."}
        </Body>
      )}
    </Page>
  );
}
