import React from "react";
import { usePractice } from "../src/practice";
import { Body, Eyebrow, Page, Title, TopBar } from "../src/ui";

export default function Privacy() {
  const { session } = usePractice();
  return (
    <Page header={<TopBar title="Privacy" />}>
      <Eyebrow>Before you start</Eyebrow>
      <Title>Your own space.</Title>
      <Body>
        Your account holds your reflections, commitments and possibilities.
        Other members cannot browse them. Sharing an idea with someone is a
        separate action you choose.
      </Body>
      <Title style={{ fontSize: 23, lineHeight: 30 }}>Talking with Chloe</Title>
      <Body>
        Chloe is an AI guide. To write a reply, your messages and relevant saved
        context are sent to Anthropic. Your account data is stored using
        Supabase. This is not an end-to-end encrypted journal.
      </Body>
      <Title style={{ fontSize: 23, lineHeight: 30 }}>
        You stay in control
      </Title>
      <Body>
        You can skip any personal question. You can review and change your why,
        and decide whether to keep Chloe’s suggestions.
      </Body>
      <Body>
        {session ? "In Settings, you" : "Once signed in, you"} can export your
        practice, remove saved memories, and delete your account and saved
        practice. A local copy from an earlier guest session stays on its device
        until you clear it.
      </Body>
      <Title style={{ fontSize: 23, lineHeight: 30 }}>About the beta</Title>
      <Body>
        Chloe supports reflection and everyday choices. It is not a therapist or
        an emergency service. Optional product feedback and usage sharing are
        separate from your private reflections.
      </Body>
    </Page>
  );
}
