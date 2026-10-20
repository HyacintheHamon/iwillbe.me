import React, { useCallback, useEffect, useState } from "react";
import { Share, View } from "react-native";
import { router } from "expo-router";
import { usePractice } from "../src/practice";
import { entriesOf, entryInput } from "../src/journey";
import { dayLabel, shiftDay, localDay } from "../src/domain";
import { useAction } from "../src/use-action";
import { supabase } from "../src/supabase";
import { connectionRequest, publicOrigin } from "../src/connections";
import {
  Body,
  Button,
  Chip,
  Eyebrow,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";
type Invite = { id: string; kind: string; message: string; expires_at: string };
type Suggestion = { id: string; content: string };
export default function Connections() {
  const { data, session, putEntry } = usePractice();
  const action = useAction();
  const [kind, setKind] = useState("comet"),
    [message, setMessage] = useState(""),
    [link, setLink] = useState(""),
    [invites, setInvites] = useState<Invite[]>([]),
    [suggestions, setSuggestions] = useState<Suggestion[]>([]),
    [status, setStatus] = useState("");
  const refresh = useCallback(async () => {
    if (!session) return;
    const [a, b] = await Promise.all([
      supabase
        .from("shared_invitations")
        .select("id,kind,message,expires_at")
        .order("created_at", { ascending: false }),
      supabase.from("friend_suggestions").select("id,content"),
    ]);
    if (a.error || b.error)
      throw new Error("Could not refresh your invitations.");
    setInvites(a.data || []);
    setSuggestions(b.data || []);
  }, [session]);
  useEffect(() => {
    const handle = setTimeout(() => {
      void refresh().catch((e) => setStatus(e.message));
    }, 0);
    return () => clearTimeout(handle);
  }, [refresh]);
  const moments = data.intentions
    .filter(
      (i) =>
        i.person &&
        i.person !== "me" &&
        data.checkIns.some(
          (c) => c.intention_id === i.id && c.outcome !== "not_yet",
        ),
    )
    .sort((a, b) => b.day.localeCompare(a.day));
  return (
    <Page header={<TopBar title="Your constellation" />}>
      <Eyebrow>People, not points</Eyebrow>
      <Title>The moments you shared.</Title>
      <Body>
        A constellation of moments when you showed up for someone. No rankings,
        counts or comparisons.
      </Body>
      {moments.map((i) => (
        <View key={i.id} style={s.card}>
          <Eyebrow>
            {dayLabel(i.day)} · FOR {i.person}
          </Eyebrow>
          <Body>{i.action}</Body>
          <TextButton
            label="Share a North Star note"
            onPress={() =>
              action.run(async () => {
                await Share.share({
                  message: `You were my North Star today. ${i.action}`,
                });
              })
            }
          />
        </View>
      ))}
      {!moments.length ? (
        <Body>
          Your shared moments will appear after you reflect. Naming a person
          alone does not create one.
        </Body>
      ) : null}
      <View style={s.section}>
        <Eyebrow>Send a little possibility</Eyebrow>
        <Title style={{ fontSize: 25, lineHeight: 33 }}>
          A comet, with no obligation.
        </Title>
        <Body>
          A link a friend can open without an account. They can try it, save it,
          or pass. You will not see which they choose.
        </Body>
        <View style={s.wrap}>
          {[
            ["comet", "Send a Comet"],
            ["friend", "Ask a friend"],
            ["coach", "Invite a client"],
          ].map(([v, label]) => (
            <Chip
              key={v}
              label={label}
              selected={kind === v}
              onPress={() => {
                setKind(v);
                setLink("");
              }}
            />
          ))}
        </View>
        <Field
          label={
            kind === "friend"
              ? "What would you like to ask?"
              : kind === "coach"
                ? "Your invitation to begin a private practice"
                : "One possibility to share"
          }
          placeholder={
            kind === "friend"
              ? "What do you think I’d love to try?"
              : "Try drawing something you see on your next walk."
          }
          multiline
          value={message}
          onChangeText={setMessage}
          maxLength={1000}
        />
        {kind === "coach" ? (
          <Body>
            The client owns their practice. This link gives you no access to
            their journal. They can choose to share a weekly summary themselves.
          </Body>
        ) : null}
        {session ? (
          <Button
            label="Create invitation link"
            disabled={!message.trim()}
            loading={action.busy}
            onPress={() =>
              action.run(async () => {
                const result = await connectionRequest({
                  action: "create",
                  kind,
                  message,
                  sender: data.profile.display_name || "A friend",
                });
                setLink(`${publicOrigin()}/invite?token=${result.token}`);
                await refresh();
              })
            }
          />
        ) : (
          <Button
            label="Connect to create an invitation"
            onPress={() =>
              router.push({
                pathname: "/account",
                params: { returnTo: "/connections", reason: "save" },
              })
            }
          />
        )}
        {link ? (
          <View style={s.card}>
            <Field
              label="Invitation link · anyone with this link can open it"
              value={link}
              editable={false}
            />
            <Button
              label="Share this link"
              onPress={() =>
                action.run(async () => {
                  await Share.share({ message: link });
                })
              }
            />
          </View>
        ) : null}
      </View>
      <Notice
        text={action.error || status}
        tone={action.error ? "error" : "normal"}
      />
      {suggestions.map((item) => (
        <View key={item.id} style={s.card}>
          <Eyebrow>A FRIEND’S SUGGESTION</Eyebrow>
          <Body>{item.content}</Body>
          <Button
            label="Keep as a Spark"
            onPress={() =>
              action.run(async () => {
                await putEntry(
                  entryInput("interest", item.content.slice(0, 80), {
                    body: item.content,
                    source: "Friend suggestion · accepted by you",
                    state: "spark",
                  }),
                );
                const { error } = await supabase
                  .from("friend_suggestions")
                  .delete()
                  .eq("id", item.id);
                if (error) throw error;
                await refresh();
              })
            }
          />
          <TextButton
            label="Pass privately"
            onPress={() =>
              action.run(async () => {
                const { error } = await supabase
                  .from("friend_suggestions")
                  .delete()
                  .eq("id", item.id);
                if (error) throw error;
                await refresh();
              })
            }
          />
        </View>
      ))}
      {invites.length ? (
        <Eyebrow>Your links · no response tracking</Eyebrow>
      ) : null}
      {invites.map((inv) => (
        <View key={inv.id} style={s.card}>
          <Body>{inv.message}</Body>
          <Body style={{ fontSize: 12 }}>
            Expires {new Date(inv.expires_at).toLocaleDateString()}
          </Body>
          <TextButton
            label="Revoke this link"
            onPress={() =>
              action.run(async () => {
                const { error } = await supabase
                  .from("shared_invitations")
                  .delete()
                  .eq("id", inv.id);
                if (error) throw error;
                await refresh();
              })
            }
          />
        </View>
      ))}
      <View style={s.section}>
        <Eyebrow>A summary you choose to share</Eyebrow>
        <Body>
          This week’s summary contains only the action titles shown below,
          without reflections, scores or messages. Check it before opening your
          share sheet.
        </Body>
        {data.intentions
          .filter(
            (i) => i.day >= shiftDay(localDay(), -6) && i.day <= localDay(),
          )
          .map((i) => (
            <Body key={i.id}>
              {i.day}: {i.action}
            </Body>
          ))}
        <Button
          secondary
          label="Share these action titles"
          onPress={() =>
            action.run(async () => {
              await Share.share({
                message:
                  data.intentions
                    .filter(
                      (i) =>
                        i.day >= shiftDay(localDay(), -6) &&
                        i.day <= localDay(),
                    )
                    .map((i) => `${i.day}: ${i.action}`)
                    .join("\n") || "I am making room for a little more me.",
              });
            })
          }
        />
      </View>
      {entriesOf(data, "preferences").find((e) => e.title === "Comet privacy")
        ?.meta.blocks?.length ? (
        <TextButton
          label="Reset my blocked senders"
          onPress={() =>
            action.run(async () => {
              const pref = entriesOf(data, "preferences").find(
                (e) => e.title === "Comet privacy",
              )!;
              await putEntry({ ...pref, meta: { ...pref.meta, blocks: [] } });
            })
          }
        />
      ) : null}
    </Page>
  );
}
