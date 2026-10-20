import React, { useState } from "react";
import { router } from "expo-router";
import { supabase } from "../src/supabase";
import { authRedirect, useAuthRedirect } from "../src/auth-redirect";
import { usePractice } from "../src/practice";
import {
  Body,
  Button,
  Eyebrow,
  Field,
  Illustration,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  art,
} from "../src/ui";
export default function Account() {
  const linkError = useAuthRedirect();
  const { session } = usePractice();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: authRedirect("reset-password") },
        );
        if (error) throw error;
        setNotice(
          "If an account exists, you’ll receive a password reset email.",
        );
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: authRedirect("account") },
        });
        if (error) throw error;
        if (data.session) router.replace("/");
        else
          setNotice(
            "Check your email to confirm your account, then come back here to sign in.",
          );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace("/");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page header={<TopBar title="Your private space" />}>
      <Eyebrow>YOUR PRACTICE, WITH YOU</Eyebrow>
      <Title>
        {mode === "signup"
          ? "Make a little\nspace of your own."
          : mode === "reset"
            ? "A fresh way in."
            : "Welcome back."}
      </Title>
      <Illustration source={art.explore} height={180} />
      {session ? (
        <>
          <Body>You’re connected as {session.user.email}.</Body>
          <Button
            label="Back to my practice"
            onPress={() => router.replace("/")}
          />
        </>
      ) : (
        <>
          <Body>
            {mode === "reset"
              ? "Enter your email and we’ll help you get back in."
              : "Save your practice across devices and have personal conversations with Chloe."}
          </Body>
          <Field
            label="EMAIL"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          {mode !== "reset" && (
            <Field
              label="PASSWORD"
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={password}
              onChangeText={setPassword}
            />
          )}
          <Notice text={error || linkError} tone="error" />
          <Notice text={notice} />
          <Button
            label={
              mode === "signup"
                ? "Create my account"
                : mode === "reset"
                  ? "Send reset email"
                  : "Sign in"
            }
            loading={busy}
            disabled={
              !email.includes("@") || (mode !== "reset" && password.length < 8)
            }
            onPress={submit}
          />
          <TextButton
            label={
              mode === "signin"
                ? "New here? Create an account"
                : "Already have an account? Sign in"
            }
            onPress={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setNotice("");
            }}
          />
          {mode === "signin" && (
            <TextButton
              label="Forgot your password?"
              onPress={() => setMode("reset")}
            />
          )}
          <Body style={{ fontSize: 12, textAlign: "center" }}>
            Your account has its own practice. Notes made without an account
            stay on this device.
          </Body>
        </>
      )}
    </Page>
  );
}
