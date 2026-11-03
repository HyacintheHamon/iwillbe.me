import React from "react";
import { Platform, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Landing } from "../src/landing";
import { usePractice } from "../src/practice";
import { dayLabel, outcomeLabel, shiftDay } from "../src/domain";
import {
  currentWhy,
  rhythmDue,
  returningToPractice,
  formatCommitment,
} from "../src/journey";
import { useToday } from "../src/use-today";
import {
  Body,
  CommitReveal,
  Button,
  C,
  Eyebrow,
  Notice,
  Page,
  TextButton,
  Title,
  s,
} from "../src/ui";
export default function Home() {
  const { session } = usePractice();
  return session ? <Today /> : <Landing />;
}

function Today() {
  const { data, session, error, reminderError } = usePractice();
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const today = useToday(),
    tomorrow = shiftDay(today, 1);
  const intention = data.intentions.find((i) => i.day === today);
  const next = data.intentions.find((i) => i.day === tomorrow);
  const checked = data.checkIns.find((c) => c.intention_id === intention?.id);
  const why = currentWhy(data);
  const rhythm = rhythmDue(data);
  const newVisitor = !data.profile.onboarded && !data.intentions.length;
  const returning = returningToPractice(data, today);
  const begin = () =>
    router.push({ pathname: "/ritual", params: { day: today } });
  return (
    <Page
      header={
        <View
          style={[
            s.row,
            {
              justifyContent: "space-between",
              paddingHorizontal: 24,
              height: 60,
            },
          ]}
        >
          <Title style={{ fontSize: 27, lineHeight: 36 }}>iwillbe.me</Title>
          <TextButton label="Ask Chloe" onPress={() => router.push("/chloe")} />
        </View>
      }
      footer={
        <Button
          label={
            newVisitor
              ? "Start your map"
              : !intention
                ? data.intentions.length
                  ? "Choose today’s action"
                  : "Choose my first action"
                : checked
                  ? "My map"
                  : "Reflect on today"
          }
          onPress={
            newVisitor
              ? () => router.push("/onboarding")
              : !intention
                ? begin
                : () => router.push(checked ? "/galaxy" : "/reflect")
          }
        />
      }
      contentStyle={{ paddingTop: 12, gap: 16 }}
    >
      <Eyebrow>
        {intention ? "YOUR DAILY PRACTICE" : "ONE SMALL INTENTION"}
      </Eyebrow>
      <Title
        style={{
          fontSize: 32,
          lineHeight: 35.2,
        }}
      >
        {!intention
          ? newVisitor
            ? "A life that feels like yours."
            : returning
              ? "What’s true for you right now?"
              : "Who will you be today?"
          : checked
            ? "A little more you."
            : "Your action for today."}
      </Title>
      <Body>
        {!intention
          ? newVisitor
            ? "Discover what draws you. Try one small thing. Notice what you want to keep."
            : returning
              ? "Start with what’s here today."
              : "Choose one action connected to what matters to you."
          : checked
            ? "Every small step becomes part of your story."
            : `One small promise${data.profile.display_name ? `, ${data.profile.display_name}` : ""}. Room to be human.`}
      </Body>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Shape my why"
        onPress={() => router.push("/why")}
        style={s.card}
      >
        <Eyebrow>MY WHY</Eyebrow>
        <Body numberOfLines={2}>
          {why?.body ||
            "Still forming. Your actions and stories will help it take shape."}
        </Body>
        <Body style={{ color: C.gold }}>Shape my why →</Body>
      </Pressable>
      {!newVisitor && !intention ? (
        <TextButton
          label="Night check-in"
          onPress={() => router.push("/reflect")}
        />
      ) : null}
      {!newVisitor && !returning && rhythm ? (
        <View style={s.card}>
          <Eyebrow>A LITTLE SPACE TO LOOK BACK</Eyebrow>
          <Body>{rhythm.title}</Body>
          <TextButton
            label="When I have a moment"
            onPress={() => router.push("/rhythms")}
          />
        </View>
      ) : null}
      {saved && (
        <Notice
          text={`Your intention for ${saved === today ? "today" : saved === tomorrow ? "tomorrow" : dayLabel(saved)} is saved${session ? " to your account" : " on this device"}.`}
        />
      )}
      {intention && (
        <CommitReveal active={saved === today}>
          <View style={s.card}>
            <Eyebrow>TODAY’S ONE THING</Eyebrow>
            <Title style={{ fontSize: 25, lineHeight: 33 }}>
              {formatCommitment(intention.action, intention.kind)}
            </Title>
            <Body>
              {[
                intention.value,
                intention.interest,
                intention.for_me
                  ? "For me"
                  : intention.for_whom || intention.person
                    ? `For ${intention.for_whom || intention.person}`
                    : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </Body>
            {intention.when_context || intention.place ? (
              <Body style={{ fontSize: 13 }}>
                {[intention.when_context, intention.place]
                  .filter(Boolean)
                  .join(" · ")}
              </Body>
            ) : null}
            {checked ? (
              <>
                <Body>{outcomeLabel(checked.outcome)}</Body>
                {!!checked.reflection && <Body>{checked.reflection}</Body>}
                <TextButton
                  label="Edit my reflection"
                  onPress={() =>
                    router.push({
                      pathname: "/reflect",
                      params: { id: intention.id },
                    })
                  }
                />
              </>
            ) : (
              <TextButton label="Adjust my intention" onPress={begin} />
            )}
          </View>
        </CommitReveal>
      )}
      {next && (
        <View style={s.card}>
          <Eyebrow>TOMORROW · {dayLabel(tomorrow)}</Eyebrow>
          <Body>
            {next?.action ||
              "Leave a little room for the person you want to be."}
          </Body>
        </View>
      )}
      {data.intentions.length > 0 && (
        <>
          {!session && (
            <View style={s.section}>
              <Title style={{ fontSize: 24, lineHeight: 30 }}>
                Keep your practice with you.
              </Title>
              <Body>
                Your intentions are on this device. Connect an account to bring
                them to another device.
              </Body>
              <Button
                secondary
                label="Save across devices"
                onPress={() =>
                  router.push({
                    pathname: "/account",
                    params: { returnTo: "/", reason: "save" },
                  })
                }
              />
            </View>
          )}
          {!data.profile.display_name && (
            <TextButton
              label="Personalise my practice · optional"
              onPress={() => router.push("/settings")}
            />
          )}
          {Platform.OS !== "web" && saved && (
            <TextButton
              label="Set a gentle reminder · optional"
              onPress={() => router.push("/settings")}
            />
          )}
          {!returning ? (
            <View style={s.section}>
              <Eyebrow>YOUR RECENT MOMENTS</Eyebrow>
              {[...data.intentions]
                .filter((i) => i.day < today)
                .sort((a, b) => b.day.localeCompare(a.day))
                .slice(0, 3)
                .map((i) => (
                  <TextButton
                    key={i.id}
                    label={`${dayLabel(i.day)} · ${i.action}`}
                    onPress={() =>
                      router.push({
                        pathname: "/history",
                        params: { id: i.id },
                      })
                    }
                  />
                ))}
              <Button
                secondary
                label="View all my history"
                onPress={() => router.push("/history")}
              />
            </View>
          ) : null}
        </>
      )}
      <Notice text={error} tone="error" />
      {reminderError ? (
        <View style={s.card}>
          <Notice text={reminderError} />
          <TextButton
            label="Check my reminders"
            onPress={() => router.push("/settings")}
          />
        </View>
      ) : null}
    </Page>
  );
}
