import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { usePractice } from "../src/practice";
import { entriesOf, entryInput } from "../src/journey";
import { localDay, nextIntentionDay } from "../src/domain";
import { connectionRequest } from "../src/connections";
import { useAction } from "../src/use-action";
import { draftKey, useDraft } from "../src/drafts";
import * as Crypto from "expo-crypto";
import {
  Body,
  Button,
  Eyebrow,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
} from "../src/ui";
type Invitation = {
  kind: string;
  sender: string;
  message: string;
  sender_key: string;
};
export default function Invite() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { data, session, putEntry } = usePractice();
  const [inv, setInv] = useState<Invitation | null>(null),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const action = useAction();
  const { draft, update } = useDraft(
    draftKey(`invite.${token || "none"}`, session?.user.id),
    { reply: "", nonce: Crypto.randomUUID() },
  );
  const pref = entriesOf(data, "preferences").find(
    (e) => e.title === "Comet privacy",
  );
  useEffect(() => {
    let alive = true;
    if (!token) return;
    connectionRequest({ action: "view", token })
      .then((v) => {
        if (alive) setInv(v);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [token]);
  const blocked = !!inv && pref?.meta.blocks?.includes(inv.sender_key);
  const limited =
    inv?.kind === "comet" &&
    pref?.meta.last_comet_day === localDay() &&
    pref.meta.last_comet_token !== token;
  const remember = async () => {
    await putEntry(
      entryInput("preferences", "Comet privacy", {
        id: pref?.id,
        meta: {
          ...pref?.meta,
          last_comet_day: localDay(),
          last_comet_token: token,
        },
      }),
    );
  };
  return (
    <Page header={<TopBar title="A little possibility" />}>
      <Eyebrow>No account needed</Eyebrow>
      <Title>
        {done
          ? "All yours to decide."
          : inv
            ? `A note from ${inv.sender}`
            : "A small invitation."}
      </Title>
      <Notice
        text={!token ? "This link is incomplete." : error || action.error}
        tone="error"
      />
      {blocked ? (
        <Body>You have blocked invitations from this sender.</Body>
      ) : limited ? (
        <Body>
          You have already opened a comet today on this device. This one can
          wait until tomorrow.
        </Body>
      ) : inv && !done ? (
        <>
          <Body>{inv.message}</Body>
          {inv.kind === "friend" ? (
            <>
              <Field
                label="Something you think they would love"
                multiline
                value={draft.reply}
                onChangeText={(reply) => update({ reply })}
                maxLength={500}
              />
              <Body>
                Your suggestion will be shared with the person who created this
                link. They decide whether to keep it.
              </Body>
              <Button
                label="Send this suggestion"
                loading={action.busy}
                disabled={!draft.reply.trim()}
                onPress={() =>
                  action.run(async () => {
                    await connectionRequest({
                      action: "reply",
                      token,
                      content: draft.reply,
                      nonce: draft.nonce,
                    });
                    setDone(true);
                  })
                }
              />
            </>
          ) : inv.kind === "coach" ? (
            <>
              <Body>
                This invitation gives the sender no access to your practice.
                Sharing is always your choice.
              </Body>
              <Button
                label="Start my own practice"
                onPress={() => router.replace("/onboarding")}
              />
            </>
          ) : (
            <>
              <Button
                label="Try it next"
                onPress={() =>
                  action.run(async () => {
                    await remember();
                    router.replace({
                      pathname: "/ritual",
                      params: {
                        action: inv.message.slice(0, 500),
                        day: nextIntentionDay(data),
                      },
                    });
                  })
                }
              />
              <Button
                secondary
                label="Save it as a Spark"
                onPress={() =>
                  action.run(async () => {
                    await remember();
                    await putEntry(
                      entryInput("interest", inv.message.slice(0, 80), {
                        body: inv.message,
                        source: "Comet · accepted by you",
                        state: "spark",
                      }),
                    );
                    setDone(true);
                  })
                }
              />
              <TextButton
                label="Pass privately"
                onPress={() =>
                  action.run(async () => {
                    await remember();
                    setDone(true);
                  })
                }
              />
              <TextButton
                label="Block this sender"
                onPress={() =>
                  action.run(async () => {
                    await putEntry(
                      entryInput("preferences", "Comet privacy", {
                        id: pref?.id,
                        meta: {
                          ...pref?.meta,
                          blocks: [
                            ...(pref?.meta.blocks || []),
                            inv.sender_key,
                          ],
                        },
                      }),
                    );
                    setDone(true);
                  })
                }
              />
              <Body style={{ fontSize: 13 }}>
                The sender cannot see whether you accepted, saved or passed.
                Before connecting an account, the one-comet-a-day limit and
                blocked senders apply to this device.
              </Body>
            </>
          )}
        </>
      ) : null}
      <TextButton label="Back to my day" onPress={() => router.replace("/")} />
    </Page>
  );
}
