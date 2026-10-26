import React from "react";
import {
  Image,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { GearSixIcon as GearSix } from "phosphor-react-native/src/icons/GearSix";
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
  Button,
  C,
  Eyebrow,
  Notice,
  Page,
  TextButton,
  Title,
  s,
} from "../src/ui";
export default function Today() {
  const { data, session, error } = usePractice();
  const { height } = useWindowDimensions();
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
              paddingHorizontal: 20,
              height: 60,
            },
          ]}
        >
          <Title style={{ fontSize: 27, lineHeight: 36 }}>iwillbe.me</Title>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push("/settings")}
            style={s.iconButton}
          >
            <GearSix size={23} color={C.ink} />
          </Pressable>
        </View>
      }
      footer={
        <Button
          label={
            newVisitor
              ? "Find your possibilities"
              : !intention
                ? data.intentions.length
                  ? "Choose today’s intention"
                  : "Choose my first intention"
                : checked
                  ? "My Possibilities"
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
          fontSize: height < 700 ? 34 : 42,
          lineHeight: height < 700 ? 40 : 48,
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
            : "Let your intention lead the way."}
      </Title>
      <Body>
        {!intention
          ? newVisitor
            ? "Discover what draws you. Try one small thing. Notice what you want to keep."
            : returning
              ? "Start with what’s here today."
              : "About two minutes. One small commitment to take into your day."
          : checked
            ? "Every small step becomes part of your story."
            : `One small promise${data.profile.display_name ? `, ${data.profile.display_name}` : ""}. Room to be human.`}
      </Body>
      <Image
        source={require("../assets/illustrations/galaxy-night.jpg")}
        resizeMode="cover"
        style={{
          width: "100%",
          height: Math.min(intention ? 140 : 230, height * 0.25),
        }}
      />
      {newVisitor ? (
        <TextButton label="Choose an intention instead" onPress={begin} />
      ) : (
        <View style={s.card}>
          <Eyebrow>MY WHY</Eyebrow>
          <Body>
            {why?.body ||
              "Still forming. There is no hurry to define yourself."}
          </Body>
          <TextButton
            label="Make room for my why"
            onPress={() => router.push("/why")}
          />
        </View>
      )}
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
        <View style={s.card}>
          <Eyebrow>TODAY’S ONE THING</Eyebrow>
          <Title style={{ fontSize: 25, lineHeight: 33 }}>
            {formatCommitment(intention.action, intention.kind)}
          </Title>
          <Body>
            {intention.value}
            {intention.interest ? ` · ${intention.interest}` : ""} · For{" "}
            {intention.person || "myself"}
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
      )}
      {(checked || next) && (
        <View style={s.card}>
          <Eyebrow>TOMORROW · {dayLabel(tomorrow)}</Eyebrow>
          <Body>
            {next?.action ||
              "Leave a little room for the person you want to be."}
          </Body>
          <TextButton
            label={
              next ? "Adjust tomorrow’s intention" : "Plan tomorrow’s intention"
            }
            onPress={() =>
              router.push({ pathname: "/ritual", params: { day: tomorrow } })
            }
          />
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
    </Page>
  );
}
