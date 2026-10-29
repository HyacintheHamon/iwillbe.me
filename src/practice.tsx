import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, AppState, Platform, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import { reminderTimezone, syncReminders } from "./reminders";
import { clearOwnerDrafts } from "./drafts";
import { matchesDraft, recordSummary, withoutRevision } from "./revisions";
import {
  SyncConflictSheet,
  type ConflictChoice,
  type SyncConflict,
} from "./sync-conflict";
import { recordUsage } from "./usage";
import { supabase } from "./supabase";
import {
  emptyPractice,
  shiftDay,
  hasPractice,
  type Practice,
  type Profile,
  type Intention,
  type CheckIn,
  type Memory,
  type Message,
} from "./domain";
import {
  dayInZone,
  entryInput,
  valueState,
  interestState,
  type Entry,
  type EntryInput,
} from "./journey";
type Context = {
  putEntry: (input: EntryInput) => Promise<Entry>;
  removeEntry: (id: string, revision?: number) => Promise<void>;
  data: Practice;
  session: Session | null;
  loading: boolean;
  error: string;
  reminderError: string;
  clearAccountDeviceData: (owner: string) => Promise<void>;
  refresh: () => Promise<void>;
  saveProfile: (p: Profile) => Promise<Profile>;
  saveIntention: (
    a: string,
    v: string,
    p: string,
    day?: string,
    interest?: string,
    details?: Partial<
      Pick<
        Intention,
        | "planet"
        | "kind"
        | "when_context"
        | "place"
        | "with_person"
        | "revision"
      >
    >,
  ) => Promise<void>;
  guest: Practice | null;
  importGuest: () => Promise<{ imported: number; skipped_days: string[] }>;
  checkIn: (c: Omit<CheckIn, "created_at">) => Promise<void>;
  remember: (content: string, source: string) => Promise<void>;
  forget: (id: string, revision?: number) => Promise<void>;
  addMessages: (m: Message[], owner: string) => Promise<void>;
  clearLocal: () => Promise<void>;
};
const Ctx = createContext<Context | null>(null);
const cacheKey = (id?: string) => `iwillbe.practice.v2.${id || "guest"}`;
const newId = () => Crypto.randomUUID();
async function eraseAccountDeviceData(owner: string) {
  const results = await Promise.allSettled([
    clearOwnerDrafts(owner),
    AsyncStorage.multiRemove([cacheKey(owner), `iwillbe.practice.v1.${owner}`]),
  ]);
  if (results.some((result) => result.status === "rejected"))
    throw new Error(
      "This device could not remove all local account data. Clear this app’s local storage before sharing the device.",
    );
}
function normalisePractice(parsed: Partial<Practice>): Practice {
  const next = {
    ...emptyPractice(),
    ...parsed,
    profile: { ...emptyPractice().profile, ...parsed.profile },
  };
  if (!parsed.entries) {
    const now = new Date().toISOString();
    next.entries = [
      ...next.profile.interests.map((title) => ({
        kind: "interest" as const,
        title,
      })),
      ...next.profile.values.map((title) => ({
        kind: "value" as const,
        title,
      })),
    ].map(({ kind, title }) => ({
      ...entryInput(kind, title, {
        state: "unconfirmed",
        source: "Imported from your earlier practice",
      }),
      id: newId(),
      created_at: now,
      updated_at: now,
    }));
  }
  return next;
}
async function allOwnedRows<T>(table: string, owner: string, key = "id") {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await supabase
      .from(table)
      .select("*")
      .eq("user_id", owner)
      .order(key)
      .range(offset, offset + 499);
    if (result.error) throw result.error;
    rows.push(...(result.data as T[]));
    if (result.data.length < 500) return { data: rows, error: null };
  }
}
export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Practice>(emptyPractice),
    [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [initialised, setInitialised] = useState(false),
    [error, setError] = useState(""),
    [reminderError, setReminderError] = useState(""),
    [conflict, setConflict] = useState<SyncConflict | null>(null),
    [guest, setGuest] = useState<Practice | null>(null);
  const current = useRef(data),
    user = useRef<string | undefined>(undefined),
    generation = useRef(0),
    operations = useRef<Promise<unknown>>(Promise.resolve()),
    conflictResolver = useRef<((choice: ConflictChoice) => void) | null>(null),
    foreground = useRef<() => Promise<void>>(async () => {});
  const chooseConflict = useCallback((choice: ConflictChoice) => {
    const resolve = conflictResolver.current;
    conflictResolver.current = null;
    setConflict(null);
    resolve?.(choice);
  }, []);
  const commit = useCallback(async (next: Practice, owner = user.current) => {
    if (owner !== user.current) return;
    await AsyncStorage.setItem(cacheKey(owner), JSON.stringify(next));
    if (owner !== user.current) {
      if (owner) await AsyncStorage.removeItem(cacheKey(owner));
      return;
    }
    current.current = next;
    setData(next);
    void syncReminders(next).then(
      () => {
        if (owner === user.current) setReminderError("");
      },
      () => {
        if (owner === user.current)
          setReminderError(
            "Your practice is saved, but reminders could not be updated. Check reminders in Settings.",
          );
      },
    );
  }, []);
  const load = useCallback(
    async (s: Session | null, background = false) => {
      const request = ++generation.current;
      const previousOwner = user.current;
      user.current = s?.user.id;
      if (!background) setLoading(true);
      setError("");
      if (!background) {
        current.current = emptyPractice();
        setData(current.current);
      }
      try {
        if (previousOwner && previousOwner !== s?.user.id) {
          chooseConflict("cancel");
          await eraseAccountDeviceData(previousOwner);
        }
        if (!background) {
          const cached =
            (await AsyncStorage.getItem(cacheKey(s?.user.id))) ||
            (await AsyncStorage.getItem(
              `iwillbe.practice.v1.${s?.user.id || "guest"}`,
            ));
          if (request !== generation.current) return;
          if (cached) {
            current.current = normalisePractice(JSON.parse(cached));
            await AsyncStorage.setItem(
              cacheKey(s?.user.id),
              JSON.stringify(current.current),
            );
            setData(current.current);
          }
        }
        const local =
          (await AsyncStorage.getItem(cacheKey())) ||
          (await AsyncStorage.getItem("iwillbe.practice.v1.guest"));
        if (request !== generation.current) return;
        setGuest(
          local && hasPractice(JSON.parse(local))
            ? normalisePractice(JSON.parse(local))
            : null,
        );
        if (s) {
          const results = await Promise.all([
            supabase
              .from("profiles")
              .select("*")
              .eq("id", s.user.id)
              .maybeSingle(),
            allOwnedRows<Intention>("intentions", s.user.id),
            allOwnedRows<CheckIn>("check_ins", s.user.id, "intention_id"),
            allOwnedRows<Memory>("memories", s.user.id),
            supabase
              .from("messages")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(60),
            allOwnedRows<{ entry: Entry; revision: number }>(
              "journey_entries",
              s.user.id,
            ),
          ]);
          const failed = results.find((r) => r.error);
          if (failed?.error) throw failed.error;
          if (request !== generation.current) return;
          await commit(
            {
              profile: results[0].data
                ? { ...emptyPractice().profile, ...results[0].data }
                : emptyPractice().profile,
              intentions: results[1].data.sort((a, b) =>
                b.day.localeCompare(a.day),
              ),
              checkIns: results[2].data || [],
              memories: results[3].data.sort((a, b) =>
                b.created_at.localeCompare(a.created_at),
              ),
              messages: [...(results[4].data || [])].reverse(),
              entries: results[5].data.map((r) => ({
                ...r.entry,
                revision: r.revision,
              })),
            },
            s.user.id,
          );
        }
        if (s && !background)
          recordUsage(current.current, s.user.id, "session_started");
        return true;
      } catch (e) {
        if (request === generation.current)
          setError(
            e instanceof Error
              ? e.message
              : "Could not refresh your practice. Your saved copy is still here.",
          );
        return false;
      } finally {
        if (request === generation.current) {
          setSession(s);
          setLoading(false);
          setInitialised(true);
        }
      }
    },
    [commit, chooseConflict],
  );
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (alive) void load(session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "INITIAL_SESSION") return;
      if (s?.user.id !== user.current || event === "SIGNED_OUT")
        setTimeout(() => {
          if (alive) void load(s);
        }, 0);
      else setSession(s);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [load]);
  const applyRemote = async (
    table: string,
    row: Record<string, unknown> | null,
    key: string,
    owner: string,
  ) => {
    if (user.current !== owner) return;
    const next = { ...current.current };
    if (table === "profiles")
      next.profile = row ? (row as Profile) : emptyPractice().profile;
    if (table === "intentions")
      next.intentions = [
        ...current.current.intentions.filter(
          (i) => i.id !== key && (!row || i.day !== row.day),
        ),
        ...(row ? [row as Intention] : []),
      ].sort((a, b) => b.day.localeCompare(a.day));
    if (table === "check_ins")
      next.checkIns = [
        ...current.current.checkIns.filter((c) => c.intention_id !== key),
        ...(row ? [row as CheckIn] : []),
      ];
    if (table === "memories")
      next.memories = [
        ...current.current.memories.filter((m) => m.id !== key),
        ...(row ? [row as Memory] : []),
      ];
    if (table === "journey_entries")
      next.entries = [
        ...current.current.entries.filter((e) => e.id !== key),
        ...(row
          ? [{ ...(row.entry as Entry), revision: Number(row.revision) }]
          : []),
      ];
    await commit(next, owner);
  };
  const write = async (
    table: string,
    input: object,
    _onConflict?: string,
    deleting = false,
  ) => {
    const owner = user.current;
    if (!owner) return;
    const row = input as Record<string, unknown>;
    const keyName = table === "check_ins" ? "intention_id" : "id";
    let key = String(table === "profiles" ? owner : row[keyName]);
    const existing =
      table === "profiles"
        ? current.current.profile
        : table === "intentions"
          ? current.current.intentions.find(
              (i) => i.id === key || i.day === row.day,
            )
          : table === "check_ins"
            ? current.current.checkIns.find((c) => c.intention_id === key)
            : table === "journey_entries"
              ? current.current.entries.find((e) => e.id === key)
              : current.current.memories.find((m) => m.id === key);
    const nested = row.entry as Entry | undefined;
    let expected =
      typeof row.revision === "number"
        ? row.revision
        : typeof nested?.revision === "number"
          ? nested.revision
          : (existing?.revision ?? (existing && table !== "profiles" ? -1 : 0));
    if (expected < 0)
      throw new Error(
        "Refresh your account before saving this older copy. Your draft is still here.",
      );
    for (;;) {
      if (user.current !== owner)
        throw new Error(
          "Your account changed. Your draft was not saved to another account.",
        );
      const payload = {
        ...withoutRevision(row),
        [keyName]: key,
        ...(table === "profiles" ? {} : { user_id: owner }),
        ...(nested ? { entry: withoutRevision({ ...nested, id: key }) } : {}),
      };
      const mutation = deleting
        ? supabase
            .from(table)
            .delete()
            .eq(keyName, key)
            .eq(table === "profiles" ? "id" : "user_id", owner)
            .eq("revision", expected)
            .select("*")
            .maybeSingle()
        : expected > 0
          ? supabase
              .from(table)
              .update(payload)
              .eq(keyName, key)
              .eq(table === "profiles" ? "id" : "user_id", owner)
              .eq("revision", expected)
              .select("*")
              .maybeSingle()
          : supabase.from(table).insert(payload).select("*").single();
      const result = await mutation;
      if (result.data && !result.error) {
        if (user.current !== owner)
          throw new Error(
            "Your account changed. Please open your account again.",
          );
        if (nested && result.data.entry) {
          Object.assign(nested, result.data.entry, {
            revision: result.data.revision,
          });
          row.revision = result.data.revision;
          row.id = result.data.id;
        } else Object.assign(row, result.data);
        return;
      }
      if (result.error && result.error.code !== "23505")
        throw new Error(
          result.error.code === "23514"
            ? "This saved item cannot be changed in that way. Refresh your account and review it; your draft is still here."
            : "Could not save to your account. Check your connection and try again; your draft is still here.",
        );
      let query = supabase
        .from(table)
        .select("*")
        .eq(table === "profiles" ? "id" : "user_id", owner);
      query =
        table === "intentions" && row.day
          ? query.eq("day", row.day)
          : query.eq(keyName, key);
      const { data: latest, error: readError } = await query.maybeSingle();
      if (readError)
        throw new Error(
          "Could not load the newer saved version. Your draft is still here; please try again.",
        );
      if (user.current !== owner)
        throw new Error("Your account changed. No further changes were made.");
      if (deleting && !latest) return;
      if (!deleting && matchesDraft(payload, latest)) {
        if (nested && latest.entry) {
          Object.assign(nested, latest.entry, { revision: latest.revision });
          row.revision = latest.revision;
          row.id = latest.id;
        } else Object.assign(row, latest);
        return;
      }
      const label =
        table === "profiles"
          ? "profile"
          : table === "intentions"
            ? "commitment"
            : table === "check_ins"
              ? "reflection"
              : table === "memories"
                ? "memory"
                : "saved note";
      const choice = await new Promise<ConflictChoice>((resolve) => {
        conflictResolver.current = resolve;
        setConflict({
          label,
          saved: recordSummary(latest),
          draft: deleting
            ? "Remove this item from my account."
            : recordSummary(row),
          deleting,
        });
      });
      if (user.current !== owner)
        throw new Error("Your account changed. No further changes were made.");
      if (choice === "saved") {
        await applyRemote(table, latest, key, owner);
        throw new Error(
          "The saved version was kept. Your draft is still here if you want to edit it.",
        );
      }
      if (choice === "cancel")
        throw new Error("Nothing was overwritten. Your draft is still here.");
      // Only an explicit choice after reviewing both versions permits rebasing.
      // A concurrent edit between this choice and PATCH opens a new review.
      expected = latest ? Number(latest.revision) : 0;
      if (latest) key = String(latest[keyName]);
      if (!Number.isInteger(expected) || expected < 0)
        throw new Error(
          "Refresh your account before saving. Your draft is still here.",
        );
    }
  };
  const enqueue = <T,>(work: () => Promise<T>, owner: string | undefined) => {
    const task = operations.current
      .catch(() => undefined)
      .then(() => {
        if (owner !== user.current)
          throw new Error("Your account changed. Please try again.");
        return work();
      });
    operations.current = task;
    return task;
  };
  const value: Context = {
    data,
    putEntry: async (input) => {
      const owner = user.current;
      const prior = current.current.entries.find((e) => e.id === input.id);
      const now = new Date().toISOString();
      const entry: Entry = {
        ...input,
        id: input.id || newId(),
        created_at: prior?.created_at || now,
        updated_at: now,
      };
      if (
        entry.kind === "interest" &&
        ["love", "into_it"].includes(entry.state)
      ) {
        const paused =
          prior && interestState(current.current, prior) === "On pause";
        const explicitlyIntoIt =
          prior && ["love", "into_it", "craft", "all_in"].includes(prior.state);
        const linked = new Set(
          current.current.intentions
            .filter(
              (i) =>
                prior &&
                (i.interest_id
                  ? i.interest_id === prior.id
                  : i.interest === prior.title),
            )
            .map((i) => i.id),
        );
        const secondLit = current.current.checkIns
          .filter(
            (c) =>
              linked.has(c.intention_id) &&
              c.outcome !== "not_yet" &&
              c.energy === "lit",
          )
          .map((c) => c.created_at)
          .sort()[1];
        entry.meta = {
          ...entry.meta,
          into_it_since: paused
            ? now
            : prior?.meta.into_it_since ||
              (explicitlyIntoIt ? prior.updated_at : secondLit || now),
        };
      }
      if (
        entry.kind === "interest" &&
        ["craft", "all_in"].includes(entry.state) &&
        current.current.entries.filter(
          (e) =>
            e.id !== entry.id &&
            e.kind === "interest" &&
            ["craft", "all_in"].includes(e.state),
        ).length >= 2
      )
        throw new Error(
          "Keep a little room to go deeper. Return one of your All in possibilities to exploring first.",
        );
      if (entry.title.length > 500 || entry.body.length > 6000)
        throw new Error(
          "Please keep the title under 500 and the note under 6,000 characters.",
        );
      await write(
        "journey_entries",
        { id: entry.id, kind: entry.kind, entry, updated_at: now },
        "id",
      );
      await commit(
        {
          ...current.current,
          entries: [
            ...current.current.entries.filter((e) => e.id !== entry.id),
            entry,
          ],
        },
        owner,
      );
      if (entry.kind === "review" && entry.state === "done")
        recordUsage(current.current, owner, "review_saved");
      return entry;
    },
    removeEntry: async (id, revision) => {
      const owner = user.current;
      const entry = current.current.entries.find((e) => e.id === id);
      await write("journey_entries", { id, entry, revision }, undefined, true);
      await commit(
        {
          ...current.current,
          entries: current.current.entries.filter((e) => e.id !== id),
        },
        owner,
      );
    },
    session,
    loading,
    error,
    reminderError,
    clearAccountDeviceData: async (owner) => {
      // Fence in-flight saves before removing local files. The auth event will
      // restore the separate guest backup after sign-out finishes.
      if (user.current === owner) {
        user.current = undefined;
        generation.current += 1;
        chooseConflict("cancel");
        current.current = emptyPractice();
        setData(current.current);
        setSession(null);
      }
      const results = await Promise.allSettled([
        clearOwnerDrafts(owner),
        operations.current.catch(() => {}),
      ]);
      await AsyncStorage.multiRemove([
        cacheKey(owner),
        `iwillbe.practice.v1.${owner}`,
      ]);
      if (results.some((result) => result.status === "rejected"))
        throw new Error(
          "This device could not remove every unfinished account draft. Clear this app’s local storage before sharing the device.",
        );
    },
    guest,
    importGuest: async () => {
      if (!user.current || !guest)
        throw new Error("Connect an account before importing.");
      const owner = user.current;
      const { data: result, error } = await supabase.rpc(
        "import_local_practice",
        { practice: guest },
      );
      if (error)
        throw new Error(
          "Nothing was overwritten. Import could not finish; please retry. Your local copy is safe.",
        );
      if (owner !== user.current)
        throw new Error(
          "Your account changed. Please open your account again.",
        );
      return result;
    },
    refresh: async () => {
      if (!(await load(session, true)))
        throw new Error("Could not refresh your practice. Please try again.");
    },
    saveProfile: async (profile) => {
      const owner = user.current;
      const saved = { ...profile };
      await write("profiles", saved);
      await commit({ ...current.current, profile: saved }, owner);
      return saved;
    },
    saveIntention: async (
      action,
      value,
      person,
      day = dayInZone(current.current.profile.timezone),
      interest = "",
      details = {},
    ) => {
      const today = dayInZone(current.current.profile.timezone);
      if (![today, shiftDay(today, 1)].includes(day))
        throw new Error("Choose today or tomorrow for a new intention.");
      const owner = user.current;
      const existing = current.current.intentions.find((i) => i.day === day);
      if (
        existing &&
        current.current.checkIns.some((c) => c.intention_id === existing.id)
      )
        throw new Error(
          "This intention already has a reflection. Choose tomorrow for a fresh intention.",
        );
      const intention: Intention = {
        ...details,
        id: existing?.id || newId(),
        day,
        interest: interest.trim(),
        action: action.trim(),
        value,
        person: person.trim(),
        created_at: existing?.created_at || new Date().toISOString(),
      };
      if (value.length > 80 || person.length > 120 || interest.length > 80)
        throw new Error(
          "Please keep values under 80 and names under 120 characters.",
        );
      if (!intention.action || intention.action.length > 500)
        throw new Error("Please write an intention under 500 characters.");
      for (const [kind, title] of [
        ["interest", interest],
        ["value", value],
      ] as const) {
        if (
          title &&
          !current.current.entries.some(
            (e) => e.kind === kind && e.title === title,
          )
        ) {
          const now = new Date().toISOString();
          const entry: Entry = {
            ...entryInput(kind, title, {
              state: kind === "value" ? "trying" : "spark",
              source: "Chosen for a daily intention",
            }),
            id: newId(),
            created_at: now,
            updated_at: now,
          };
          await write(
            "journey_entries",
            { id: entry.id, kind, entry, updated_at: now },
            "id",
          );
          await commit(
            {
              ...current.current,
              entries: [...current.current.entries, entry],
            },
            owner,
          );
        }
      }
      intention.interest_id =
        current.current.entries.find(
          (e) => e.kind === "interest" && e.title === interest,
        )?.id || null;
      intention.value_id =
        current.current.entries.find(
          (e) => e.kind === "value" && e.title === value,
        )?.id || null;
      await write("intentions", intention, "user_id,day");
      recordUsage(
        current.current,
        owner,
        current.current.intentions.length ? "intention_saved" : "activation",
      );
      await commit(
        {
          ...current.current,
          intentions: [
            intention,
            ...current.current.intentions.filter(
              (i) => i.day !== intention.day,
            ),
          ],
        },
        owner,
      );
      if (owner !== user.current)
        throw new Error("Your account changed. Please try again.");
      const chosenValue = current.current.entries.find(
        (e) => e.kind === "value" && e.id === intention.value_id,
      );
      if (
        chosenValue &&
        valueState(current.current, chosenValue) === "Let go"
      ) {
        const now = new Date().toISOString();
        const retried: Entry = {
          ...chosenValue,
          state: "trying",
          updated_at: now,
        };
        try {
          await write(
            "journey_entries",
            {
              id: retried.id,
              kind: retried.kind,
              entry: retried,
              updated_at: now,
            },
            "id",
          );
          await commit(
            {
              ...current.current,
              entries: current.current.entries.map((e) =>
                e.id === retried.id ? retried : e,
              ),
            },
            owner,
          );
        } catch {
          throw new Error(
            "Your intention was saved. The value update could not finish; please retry.",
          );
        }
      }
    },
    checkIn: async (input) => {
      const owner = user.current;
      const intention = current.current.intentions.find(
        (i) => i.id === input.intention_id,
      );
      if (
        !intention ||
        intention.day > dayInZone(current.current.profile.timezone)
      )
        throw new Error(
          "You can reflect on this intention once its day arrives.",
        );
      if (
        !["yes", "partly", "not_yet"].includes(input.outcome) ||
        input.reflection.length > 2000
      )
        throw new Error(
          "Please choose an outcome and keep the note under 2,000 characters.",
        );
      const prior = current.current.checkIns.find(
        (c) => c.intention_id === input.intention_id,
      );
      const row = {
        ...input,
        created_at: prior?.created_at || new Date().toISOString(),
      };
      await write("check_ins", row, "intention_id");
      recordUsage(current.current, owner, "reflection_saved");
      await commit(
        {
          ...current.current,
          checkIns: [
            ...current.current.checkIns.filter(
              (c) => c.intention_id !== row.intention_id,
            ),
            row,
          ],
        },
        owner,
      );
      // A nullable/skipped answer is not a new decision about the value.
      if (
        !intention.value ||
        !input.value_choice ||
        input.outcome === "not_yet"
      )
        return;
      if (owner !== user.current)
        throw new Error("Your account changed. Please try again.");
      const existingValue = current.current.entries.find(
        (entry) =>
          entry.kind === "value" &&
          (intention.value_id
            ? entry.id === intention.value_id
            : entry.title === intention.value),
      );
      const linkedIntentions = new Set(
        current.current.intentions
          .filter((i) =>
            i.value_id && existingValue
              ? i.value_id === existingValue.id
              : i.value === intention.value,
          )
          .map((i) => i.id),
      );
      const keptChoices = current.current.checkIns.filter(
        (c) =>
          linkedIntentions.has(c.intention_id) &&
          c.outcome !== "not_yet" &&
          c.value_choice === "yes",
      ).length;
      const nextState =
        input.value_choice === "not_mine"
          ? "let_go"
          : input.value_choice === "not_sure"
            ? "trying"
            : keptChoices >= 2
              ? "mine"
              : "trying";
      const now = new Date().toISOString();
      const chosenValue: Entry = {
        ...(existingValue ||
          entryInput("value", intention.value, {
            source: "Chosen in a night reflection",
          })),
        id: existingValue?.id || intention.value_id || newId(),
        created_at: existingValue?.created_at || now,
        updated_at: now,
        state: nextState,
        source_ids: Array.from(
          new Set([...(existingValue?.source_ids || []), intention.id]),
        ),
      };
      try {
        await write(
          "journey_entries",
          {
            id: chosenValue.id,
            kind: "value",
            entry: chosenValue,
            updated_at: now,
          },
          "id",
        );
        await commit(
          {
            ...current.current,
            entries: [
              ...current.current.entries.filter((e) => e.id !== chosenValue.id),
              chosenValue,
            ],
          },
          owner,
        );
      } catch {
        throw new Error(
          "Your reflection was saved. The value update could not finish; please retry.",
        );
      }
    },
    remember: async (content, source) => {
      const owner = user.current;
      const row: Memory = {
        id: newId(),
        content: content.trim(),
        source,
        created_at: new Date().toISOString(),
      };
      if (!row.content || row.content.length > 1000)
        throw new Error("Keep this note under 1,000 characters.");
      await write("memories", row);
      await commit(
        { ...current.current, memories: [row, ...current.current.memories] },
        owner,
      );
    },
    forget: async (id, revision) => {
      const owner = user.current;
      const memory = current.current.memories.find((m) => m.id === id);
      await write(
        "memories",
        { ...(memory || { id }), revision },
        undefined,
        true,
      );
      await commit(
        {
          ...current.current,
          memories: current.current.memories.filter((m) => m.id !== id),
        },
        owner,
      );
    },
    addMessages: async (messages, owner) => {
      if (owner !== user.current)
        throw new Error(
          "Your account changed. This reply was not added to another practice.",
        );
      await commit(
        {
          ...current.current,
          messages: [...current.current.messages, ...messages].slice(-100),
        },
        owner,
      );
    },
    clearLocal: async () => {
      if (user.current)
        throw new Error("Sign out before clearing local practice.");
      await clearOwnerDrafts("guest");
      await AsyncStorage.multiRemove([
        "iwillbe.auth.intent",
        "iwillbe.practice.v1.guest",
      ]);
      await commit(emptyPractice());
      setGuest(null);
    },
  };
  // Async screen callbacks retain this render's account. A reply that arrives
  // after sign-out must not enqueue an old account edit into guest practice.
  const enqueueFromView = <T,>(work: () => Promise<T>) =>
    enqueue(work, session?.user.id);
  const safeValue: Context = {
    ...value,
    putEntry: (input) => {
      const revision =
        input.revision ??
        current.current.entries.find((e) => e.id === input.id)?.revision ??
        0;
      return enqueueFromView(() => value.putEntry({ ...input, revision }));
    },
    removeEntry: (
      id,
      revision = current.current.entries.find((e) => e.id === id)?.revision ??
        0,
    ) => enqueueFromView(() => value.removeEntry(id, revision)),
    saveProfile: (profile) => {
      const revision =
        profile.revision ?? current.current.profile.revision ?? 0;
      return enqueueFromView(() => value.saveProfile({ ...profile, revision }));
    },
    saveIntention: (
      action,
      selectedValue,
      person,
      day = dayInZone(current.current.profile.timezone),
      interest,
      details = {},
    ) => {
      const revision =
        details.revision ??
        current.current.intentions.find((i) => i.day === day)?.revision ??
        0;
      return enqueueFromView(() =>
        value.saveIntention(action, selectedValue, person, day, interest, {
          ...details,
          revision,
        }),
      );
    },
    checkIn: (input) => {
      const revision =
        input.revision ??
        current.current.checkIns.find(
          (c) => c.intention_id === input.intention_id,
        )?.revision ??
        0;
      return enqueueFromView(() => value.checkIn({ ...input, revision }));
    },
    remember: (...args) => enqueueFromView(() => value.remember(...args)),
    forget: (
      id,
      revision = current.current.memories.find((m) => m.id === id)?.revision ??
        0,
    ) => enqueueFromView(() => value.forget(id, revision)),
    clearLocal: () => enqueueFromView(() => value.clearLocal()),
    addMessages: (...args) => enqueueFromView(() => value.addMessages(...args)),
    refresh: () => enqueueFromView(() => value.refresh()),
  };
  foreground.current = async () => {
    if (!initialised || loading) return;
    await enqueue(async () => {
      if (session && !(await load(session, true))) return;
      try {
        const zone = await reminderTimezone();
        if (zone && zone !== current.current.profile.timezone)
          await value.saveProfile({
            ...current.current.profile,
            timezone: zone,
          });
        await syncReminders(current.current);
        setReminderError("");
      } catch {
        setReminderError(
          "Your practice is still here, but reminders or the phone timezone could not be updated. Check reminders in Settings.",
        );
      }
    }, user.current);
  };
  useEffect(() => {
    let running = false;
    const resume = () => {
      if (running) return;
      running = true;
      void foreground
        .current()
        .catch(() => {
          setError(
            "Could not refresh your account. Your saved copy and drafts are still here.",
          );
        })
        .finally(() => {
          running = false;
        });
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") resume();
    });
    if (Platform.OS === "web") window.addEventListener("focus", resume);
    // A cold native launch can already be active without an AppState change.
    // Apply the same timezone/reminder refresh after the first account load.
    if (initialised && Platform.OS !== "web") resume();
    return () => {
      subscription.remove();
      if (Platform.OS === "web") window.removeEventListener("focus", resume);
    };
  }, [initialised]);
  return (
    <Ctx.Provider value={safeValue}>
      <View style={{ flex: 1, display: loading ? "none" : "flex" }}>
        {initialised && children}
      </View>
      {loading && (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F7F6F2",
            position: "absolute",
            inset: 0,
            zIndex: 100,
          }}
        >
          <ActivityIndicator color="#48634F" />
        </View>
      )}
      <SyncConflictSheet conflict={conflict} choose={chooseConflict} />
    </Ctx.Provider>
  );
}
export function usePractice() {
  const value = useContext(Ctx);
  if (!value) throw new Error("PracticeProvider missing");
  return value;
}
