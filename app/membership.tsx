import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import { connectionRequest } from "../src/connections";
import { useAction } from "../src/use-action";
import {
  Body,
  Button,
  Eyebrow,
  Field,
  Notice,
  Page,
  Title,
  TopBar,
  s,
} from "../src/ui";
export default function Membership() {
  const { session } = usePractice();
  const [code, setCode] = useState(""),
    [redeemed, setRedeemed] = useState(false);
  const action = useAction();
  return (
    <Page header={<TopBar title="Your membership" />}>
      <Eyebrow>Founding beta</Eyebrow>
      <Title>Room to explore, freely.</Title>
      <Body>
        The beta includes your daily practice, galaxy, Chloe, exploration and
        reflections. There is no payment or trial countdown.
      </Body>
      <View style={s.card}>
        <Eyebrow>ALWAYS AT THE HEART</Eyebrow>
        <Body>
          A daily intention, someone to show up for, and a short weekly why
          question.
        </Body>
      </View>
      <Title style={{ fontSize: 24, lineHeight: 32 }}>A sponsored place</Title>
      <Body>
        If your organisation gave you an access code, enter it here. They cannot
        see your journal, reflections, scores or conversations.
      </Body>
      <Field
        label="Access code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        maxLength={100}
      />
      {session ? (
        <Button
          label="Apply my code"
          disabled={!code.trim()}
          loading={action.busy}
          onPress={() =>
            action.run(async () => {
              await connectionRequest({ action: "redeem", code });
              setRedeemed(true);
              setCode("");
            })
          }
        />
      ) : (
        <Button
          label="Connect to use a code"
          onPress={() =>
            router.push({
              pathname: "/account",
              params: { returnTo: "/membership", reason: "save" },
            })
          }
        />
      )}
      <Notice
        text={
          action.error || (redeemed ? "Your sponsored place is saved." : "")
        }
        tone={action.error ? "error" : "normal"}
      />
    </Page>
  );
}
