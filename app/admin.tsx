import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Share, View } from "react-native";
import { withAccount } from "../src/access-gate";
import { usePractice } from "../src/practice";
import { supabase } from "../src/supabase";
import {
  earlyAccessCsv,
  isReportMonday,
  lastCompleteReportWeek,
  reportCount,
  reportOnboarding,
  shiftReportWeek,
  type EarlyAccessReport,
  type ReportParticipant,
} from "../src/early-access-report";
import {
  Body,
  Button,
  C,
  F,
  Field,
  Notice,
  Page,
  TextButton,
  Title,
  TopBar,
  s,
} from "../src/ui";

type LoadedReport = { owner: string; report: EarlyAccessReport };
function EarlyAccessAdmin() {
  const { data, session } = usePractice();
  const owner = session?.user.id;
  const [week, setWeek] = useState(() =>
      lastCompleteReportWeek(data.profile.timezone),
    ),
    [input, setInput] = useState(week),
    [loaded, setLoaded] = useState<LoadedReport | null>(null),
    [authorized, setAuthorized] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    if (!owner) return;
    void (async () => {
      const access = await supabase
        .from("early_access_report_admins")
        .select("user_id")
        .eq("user_id", owner)
        .maybeSingle();
      if (!active) return;
      if (access.error)
        throw new Error("The report could not load. Please try again.");
      if (!access.data) {
        setAuthorized(null);
        setLoaded(null);
        return;
      }
      setAuthorized(owner);
      const response = await supabase.rpc("get_early_access_report", {
        p_week_start: week,
      });
      if (!active) return;
      if (response.error || !response.data)
        throw new Error("The report could not load. Please try again.");
      setLoaded({ owner, report: response.data as EarlyAccessReport });
    })()
      .catch((cause: unknown) => {
        if (active) {
          setLoaded(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "The report could not load.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [owner, week, reload]);
  const report =
    loaded && loaded.owner === owner && authorized === owner
      ? loaded.report
      : null;
  const selectWeek = (value: string) => {
    if (!isReportMonday(value)) {
      setError("Choose a Monday in YYYY-MM-DD format.");
      return;
    }
    setError("");
    setLoading(true);
    setInput(value);
    setWeek(value);
    setReload((value) => value + 1);
  };
  const download = async () => {
    if (!report) return;
    try {
      const csv = earlyAccessCsv(report);
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([csv], { type: "text/csv;charset=utf-8" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `iwillbe-early-access-${report.week_start}.csv`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else
        await Share.share({
          title: `Early access · ${report.week_start}`,
          message: csv,
        });
    } catch {
      setError("The download could not open. Please try again.");
    }
  };
  return (
    <Page header={<TopBar title="Early access report" />}>
      {loading && !report ? (
        <ActivityIndicator
          accessibilityLabel="Loading the report"
          color={C.gold}
        />
      ) : authorized !== owner ? (
        <>
          <Title>Report access</Title>
          <Body>This page is available only to the report administrator.</Body>
          <Notice text={error} tone="error" />
          {!!error && (
            <Button
              label="Retry"
              onPress={() => {
                setError("");
                setLoading(true);
                setReload((value) => value + 1);
              }}
            />
          )}
        </>
      ) : (
        <>
          <Title>Early access</Title>
          <Body>A weekly view of how people use their practice.</Body>
          <Field
            label="Week starting (Monday)"
            placeholder="YYYY-MM-DD"
            value={input}
            onChangeText={setInput}
            maxLength={10}
          />
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <TextButton
              label="Previous week"
              onPress={() => selectWeek(shiftReportWeek(week, -1))}
            />
            <TextButton
              label="Next week"
              onPress={() => selectWeek(shiftReportWeek(week, 1))}
            />
          </View>
          <Button
            label="Show report"
            loading={loading}
            onPress={() => selectWeek(input)}
          />
          <Notice text={error} tone="error" />
          {report && (
            <>
              <Body style={{ fontFamily: F.strong }}>
                {report.week_start} to {report.week_end_exclusive} (exclusive)
              </Body>
              <Body style={{ color: C.muted, fontSize: 13, lineHeight: 20 }}>
                Each week runs Monday to Monday in the person’s own timezone.
                Onboarding shows their current progress; activity covers the
                selected week.
              </Body>
              <Button secondary label="Download CSV" onPress={download} />
              <Body style={{ color: C.muted, fontSize: 13, lineHeight: 20 }}>
                Screen opens are collected only when usage sharing is on. Not
                collected means the data is unavailable, not zero. Partial
                periods show observed opens only. Earlier nights without a focus
                may be missing. Last activity is the last observable visit or
                saved action before the end of the week.
              </Body>
              {report.participants.map((person) => (
                <PersonReport key={person.user_id} person={person} />
              ))}
              {!report.participants.length && (
                <Body>No participants had joined by the end of this week.</Body>
              )}
            </>
          )}
        </>
      )}
    </Page>
  );
}
function PersonReport({ person }: { person: ReportParticipant }) {
  const rows: [string, string][] = [
    ["Finished onboarding", person.onboarding_complete ? "Yes" : "No"],
    ["Onboarding step", reportOnboarding(person)],
    ["Days with a focus", String(person.focus_days)],
    ["Mornings with a focus", String(person.mornings_with_focus)],
    [
      "Typed / suggested",
      `${person.typed_focuses} / ${person.suggested_focuses}`,
    ],
    ["Night check-ins", reportCount(person.night_checkins)],
    ["Sunday review opened", reportCount(person.sunday_review_opened)],
    ["My map opened", reportCount(person.my_map_opened)],
    ["Future me opened", reportCount(person.future_me_opened)],
    ["Last observed activity", person.last_active_day || "Not collected"],
  ];
  return (
    <View style={s.card}>
      <Title style={{ fontSize: 22, lineHeight: 28 }}>
        {person.display_name || "Name not provided"}
      </Title>
      <Body style={{ fontSize: 14 }}>
        {person.email || "Email not provided"}
      </Body>
      <Body style={{ color: C.muted, fontSize: 12 }}>{person.timezone}</Body>
      {rows.map(([label, value]) => (
        <View
          key={label}
          style={[
            s.row,
            { justifyContent: "space-between", alignItems: "flex-start" },
          ]}
        >
          <Body style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>{label}</Body>
          <Body
            style={{
              flex: 1,
              textAlign: "right",
              fontSize: 13,
              lineHeight: 19,
              fontFamily: F.strong,
            }}
          >
            {value}
          </Body>
        </View>
      ))}
      {person.screen_metrics_status === "partial" && (
        <Body style={{ color: C.muted, fontSize: 12 }}>
          Screen opens: partial collection during this week.
        </Body>
      )}
      {person.night_checkins_coverage === "observed" && (
        <Body style={{ color: C.muted, fontSize: 12 }}>
          Nights: observed completions; earlier no-focus sessions may be
          missing.
        </Body>
      )}
    </View>
  );
}
export default withAccount(EarlyAccessAdmin);
