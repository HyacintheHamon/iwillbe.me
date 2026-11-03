import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { afterSignIn } from "../src/access";
import { supabase } from "../src/supabase";
import { authRedirect, useAuthRedirect } from "../src/auth-redirect";
import {
  finishAuthIntent,
  readAuthIntent,
  rememberAuthIntent,
  safeDestination,
} from "../src/auth-intent";
import { usePractice } from "../src/practice";
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
  s,
} from "../src/ui";
export default function Account() {
  const linkError = useAuthRedirect();
  const { session, data, error: loadError } = usePractice();
  const params = useLocalSearchParams<{
    returnTo?: string;
    reason?: string;
    question?: string;
  }>();
  const [intent, setIntent] = useState({
    returnTo: safeDestination(params.returnTo),
    reason: params.reason || "join",
    question: params.question || "",
  });
  const [mode, setMode] = useState<"link" | "password" | "reset">("link");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [retryAt, setRetryAt] = useState(0),
    [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    void (
      params.returnTo
        ? rememberAuthIntent(params.returnTo, params.reason, params.question)
        : readAuthIntent()
    )
      .then(setIntent)
      .catch(() =>
        setError(
          "Your return destination could not be saved. You can still connect.",
        ),
      );
  }, [params.returnTo, params.reason, params.question]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const destination = afterSignIn(intent.returnTo, data.profile.onboarded);
  const joining = intent.reason === "join";
  const continueLabel =
    destination === "/onboarding" ? "Meet Chloe" : "Continue to my practice";
  const returnToPractice = () => {
    if (intent.returnTo === "/chloe" && intent.question)
      router.replace({
        pathname: "/chloe",
        params: { question: intent.question, mode: "discovery" },
      });
    else router.replace(destination);
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await rememberAuthIntent(intent.returnTo, intent.reason, intent.question);
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: authRedirect("reset-password") },
        );
        if (error) throw error;
        setNotice(
          "If this address has an account, a reset link is on its way. Check spam too.",
        );
        setRetryAt(Date.now() + 60000);
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: authRedirect("account") },
        });
        if (error) throw error;
        setNotice(
          `Check ${email.trim()} for your sign-in link. Open it to ${joining ? "finish creating your account and meet Chloe" : "return to your practice"}. Check your spam folder too.`,
        );
        setRetryAt(Date.now() + 60000);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const continuePractice = async () => {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      await finishAuthIntent(session.user.id, intent.returnTo);
      returnToPractice();
    } catch {
      setError("Could not restore your draft. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page header={<TopBar title="Your private space" />}>
      <Eyebrow>
        {joining
          ? "JOIN THE BETA"
          : intent.reason === "chloe"
            ? "CONTINUE WITH CHLOE"
            : "YOUR PRACTICE, WITH YOU"}
      </Eyebrow>
      <Title>
        {session
          ? "You’re connected."
          : mode === "reset"
            ? "A fresh way in."
            : intent.reason === "chloe"
              ? "A private space to talk."
              : joining
                ? "Create your account."
                : "Welcome back."}
      </Title>
      {session ? (
        <>
          <Body>Connected as {session.user.email}.</Body>
          <Button
            label={continueLabel}
            loading={busy}
            onPress={continuePractice}
          />
        </>
      ) : (
        <>
          <Body>
            {intent.reason === "chloe"
              ? "Chloe needs an account to use your saved priorities and reflections. Messages are processed by our AI provider. We’ll bring you back to your conversation."
              : joining
                ? "First, your own space. Then Chloe will guide you through interest picks and short stories. Your answers will save to your account."
                : "Enter your email to return to your practice. New here? The same link can create your account."}
          </Body>
          <View style={s.card}>
            <Eyebrow>Before you start</Eyebrow>
            <Body style={{ fontSize: 13, lineHeight: 20 }}>
              Your reflections are private to your account. When you talk to
              Chloe, Anthropic processes your messages and relevant saved
              context to write a reply. You can delete your practice from
              Settings.
            </Body>
            <TextButton
              label="Read the privacy note"
              onPress={() => router.push("/privacy")}
            />
          </View>
          <Field
            label="EMAIL"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          {mode === "password" && (
            <Field
              label="PASSWORD"
              placeholder="Your password"
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
            />
          )}
          <Notice text={notice} />
          <Button
            label={
              mode === "password"
                ? "Sign in with password"
                : remaining
                  ? `Send another link in ${remaining}s`
                  : mode === "reset"
                    ? "Send reset link"
                    : "Send me a sign-in link"
            }
            disabled={
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
              (mode === "password" ? !password : remaining > 0)
            }
            loading={busy}
            onPress={submit}
          />
          <TextButton
            label={
              mode === "link"
                ? "Use my existing password"
                : "Use an email sign-in link"
            }
            onPress={() => {
              setMode(mode === "link" ? "password" : "link");
              setError("");
              setNotice("");
            }}
          />
          {mode === "password" && (
            <TextButton
              label="Forgot my password"
              onPress={() => setMode("reset")}
            />
          )}
          <TextButton
            label="Back to the introduction"
            onPress={() => router.replace("/")}
          />
        </>
      )}
      <Notice text={error || linkError || loadError} tone="error" />
    </Page>
  );
}
