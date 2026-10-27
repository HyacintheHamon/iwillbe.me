import React from "react";
import { View } from "react-native";
import { Body, Button, Eyebrow, Sheet, TextButton, s } from "./ui";

export type SyncConflict = {
  label: string;
  saved: string;
  draft: string;
  deleting: boolean;
};
export type ConflictChoice = "saved" | "draft" | "cancel";
export function SyncConflictSheet({
  conflict,
  choose,
}: {
  conflict: SyncConflict | null;
  choose: (choice: ConflictChoice) => void;
}) {
  return (
    <Sheet
      open={!!conflict}
      onClose={() => choose("cancel")}
      title="This changed on another device"
    >
      {conflict ? (
        <>
          <Body>
            Your {conflict.label} has a newer saved version. Your draft is still
            here. Choose which version to keep.
          </Body>
          <View style={s.card}>
            <Eyebrow>Saved on your account</Eyebrow>
            <Body>{conflict.saved}</Body>
          </View>
          <View style={s.card}>
            <Eyebrow>
              {conflict.deleting ? "Your request" : "Your draft"}
            </Eyebrow>
            <Body>{conflict.draft}</Body>
          </View>
          <Button
            label="Keep the saved version"
            onPress={() => choose("saved")}
          />
          <Button
            secondary
            label={
              conflict.deleting
                ? "Delete after reviewing"
                : "Save my draft instead"
            }
            onPress={() => choose("draft")}
          />
          <TextButton
            label="Decide later · keep my draft"
            onPress={() => choose("cancel")}
          />
        </>
      ) : null}
    </Sheet>
  );
}
