import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../src/supabase";
import { authRedirect, useAuthRedirect } from "../src/auth-redirect";
import {
  finishAuthIntent,
  readAuthIntent,
  rememberAuthIntent,
  safeDestination,
} from "../src/auth-intent";
import { usePractice } from "../src/practice";
import { dayLabel, importConflicts } from "../src/domain";
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
  const {
    session,
    data,
    guest,
    importGuest,
    refresh,
    error: loadError,
  } = usePractice();
  const params = useLocalSearchParams<{ returnTo?: string; reason?: string }>();
  const [intent, setIntent] = useState({
    returnTo: safeDestination(params.returnTo),
    reason: params.reason || "save",
  });
  const [mode, setMode] = useState<"link" | "password" | "reset">("link");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [retryAt, setRetryAt] = useState(0),
    [now, setNow] = useState(() => Date.now());
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped_days: string[];
  } | null>(null);
  useEffect(() => {
    void (
      params.returnTo
        ? rememberAuthIntent(params.returnTo, params.reason)
        : readAuthIntent()
    )
      .then(setIntent)
      .catch(() =>
        setError(
          "Your return destination could not be saved. You can still connect.",
        ),
      );
  }, [params.returnTo, params.reason]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const submit = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await rememberAuthIntent(intent.returnTo, intent.reason);
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
          `Check ${email.trim()} for a sign-in link. It works for new and existing accounts. Open it on this device to bring your local practice with you. Your draft stays here.`,
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
      router.replace(safeDestination(intent.returnTo));
    } catch {
      setError("Could not restore your draft. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const importLocal = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await importGuest();
      setImportResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const conflicts = guest ? importConflicts(guest, data) : [];
  return (
    <Page header={<TopBar title="Your private space" />}>
      <Eyebrow>
        {intent.reason === "chloe"
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
              : "Keep what you’ve started."}
      </Title>
      {session ? (
        <>
          <Body>Connected as {session.user.email}.</Body>
          {importResult ? (
            <>
              <Notice
                text={`${importResult.imported} new intentions imported. ${importResult.skipped_days.length ? `${importResult.skipped_days.length} days already had an intention in your account; those local moments remain in your device copy.` : "Your account is ready."} Your local backup is still here.`}
              />
              <Button
                label="Continue to my practice"
                loading={busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await refresh();
                    await finishAuthIntent(session.user.id, intent.returnTo);
                    router.replace(safeDestination(intent.returnTo));
                  } catch (e) {
                    setError((e as Error).message);
                    setBusy(false);
                  }
                }}
              />
            </>
          ) : guest ? (
            <>
              <View style={s.card}>
                <Title style={{ fontSize: 24, lineHeight: 30 }}>
                  Bring your local practice?
                </Title>
                <Body>
                  {guest.entries?.length || 0} discoveries and personal notes ·{" "}
                  {guest.intentions.length} intentions · {guest.checkIns.length}{" "}
                  reflections · {guest.memories.length} notes
                </Body>
                <Body>
                  Your account’s existing profile and moments stay as they are.
                  Matching days keep the account version. Your local copy
                  remains on this device.
                </Body>
                {conflicts.length > 0 && (
                  <Notice
                    text={`Already in your account: ${conflicts.map((i) => dayLabel(i.day)).join(", ")}. These local days will stay in the device copy.`}
                  />
                )}
                <Button
                  label="Import my local practice"
                  loading={busy}
                  disabled={!!loadError}
                  onPress={importLocal}
                />
                <TextButton
                  label="Keep them separate and continue"
                  onPress={continuePractice}
                />
              </View>
            </>
          ) : (
            <Button
              label="Continue to my practice"
              loading={busy}
              onPress={continuePractice}
            />
          )}
          <Body style={{ fontSize: 13 }}>
            You can return here from Settings to retry an import. Sign out to
            revisit or export the local copy.
          </Body>
        </>
      ) : (
        <>
          <Body>
            {intent.reason === "chloe"
              ? "Chloe needs an account to use your saved values and reflections. Messages are processed by our AI provider. We’ll bring you back to your conversation."
              : "Use one email link to sign in or create your account. After connecting, choose whether to import this device’s practice."}
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
                    : "Email me a sign-in link"
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
            label="Continue on this device"
            onPress={() => router.replace(safeDestination(intent.returnTo))}
          />
        </>
      )}
      <Notice text={error || linkError || loadError} tone="error" />
    </Page>
  );
}
