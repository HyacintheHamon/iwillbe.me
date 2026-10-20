import React, { useState } from "react";
import { router } from "expo-router";
import { useAuthRedirect } from "../src/auth-redirect";
import { supabase } from "../src/supabase";
import { usePractice } from "../src/practice";
import { Body, Button, Field, Notice, Page, Title, TopBar } from "../src/ui";

export default function ResetPassword() {
  const { session, loading } = usePractice();
  const linkError = useAuthRedirect();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setPassword("");
      setConfirmation("");
    } catch {
      setError(
        "Could not update your password. Request a fresh reset link and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page header={<TopBar title="A fresh way in" />}>
      <Title>{done ? "You’re all set." : "Choose a new password."}</Title>
      <Notice text={linkError || error} tone="error" />
      {done ? (
        <>
          <Body>Your password has been updated.</Body>
          <Button
            label="Back to my practice"
            onPress={() => router.replace("/")}
          />
        </>
      ) : session ? (
        <>
          <Field
            label="NEW PASSWORD"
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
          />
          <Field
            label="CONFIRM PASSWORD"
            secureTextEntry
            value={confirmation}
            onChangeText={setConfirmation}
          />
          <Button
            label="Save new password"
            loading={busy}
            disabled={password.length < 8 || password !== confirmation}
            onPress={save}
          />
        </>
      ) : (
        <>
          <Body>
            {loading
              ? "Opening your secure link…"
              : "Open the password reset link from your email to continue."}
          </Body>
          <Button
            secondary
            label="Return to sign in"
            onPress={() => router.replace("/account")}
          />
        </>
      )}
    </Page>
  );
}
