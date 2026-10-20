import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import { syncReminders } from "./reminders";
import { recordUsage } from "./usage";
import { supabase } from "./supabase";
import {
  emptyPractice,
  localDay,
  shiftDay,
  hasPractice,
  type Practice,
  type Profile,
  type Intention,
  type CheckIn,
  type Memory,
  type Message,
} from "./domain";
import { entryInput, type Entry, type EntryInput } from "./journey";
type Context = {
  putEntry: (input: EntryInput) => Promise<Entry>;
  removeEntry: (id: string) => Promise<void>;
  data: Practice;
  session: Session | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  saveIntention: (
    a: string,
    v: string,
    p: string,
    day?: string,
    interest?: string,
    details?: Partial<
      Pick<
        Intention,
        "planet" | "kind" | "when_context" | "place" | "with_person"
      >
    >,
  ) => Promise<void>;
  guest: Practice | null;
  importGuest: () => Promise<{ imported: number; skipped_days: string[] }>;
  checkIn: (c: Omit<CheckIn, "created_at">) => Promise<void>;
  remember: (content: string, source: string) => Promise<void>;
  forget: (id: string) => Promise<void>;
  addMessages: (m: Message[], owner: string) => Promise<void>;
  clearLocal: () => Promise<void>;
};
const Ctx = createContext<Context | null>(null);
const cacheKey = (id?: string) => `iwillbe.practice.v2.${id || "guest"}`;
const newId = () => Crypto.randomUUID();
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
    [guest, setGuest] = useState<Practice | null>(null);
  const current = useRef(data),
    user = useRef<string | undefined>(undefined),
    generation = useRef(0);
  const commit = useCallback(async (next: Practice, owner = user.current) => {
    if (owner !== user.current) return;
    await AsyncStorage.setItem(cacheKey(owner), JSON.stringify(next));
    if (owner !== user.current) {
      if (owner) await AsyncStorage.removeItem(cacheKey(owner));
      return;
    }
    current.current = next;
    setData(next);
    void syncReminders(next).catch(() => {});
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
        if (previousOwner && previousOwner !== s?.user.id)
          await AsyncStorage.multiRemove([
            cacheKey(previousOwner),
            `iwillbe.practice.v1.${previousOwner}`,
          ]);
        const cached =
          (await AsyncStorage.getItem(cacheKey(s?.user.id))) ||
          (await AsyncStorage.getItem(
            `iwillbe.practice.v1.${s?.user.id || "guest"}`,
          ));
        if (request !== generation.current) return;
        if (cached) {
          const parsed = JSON.parse(cached);
          current.current = normalisePractice(parsed);
          await AsyncStorage.setItem(
            cacheKey(s?.user.id),
            JSON.stringify(current.current),
          );
          setData(current.current);
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
            allOwnedRows<{ entry: Entry }>("journey_entries", s.user.id),
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
              entries: results[5].data.map((r) => r.entry),
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
    [commit],
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
  const write = async (table: string, row: object, onConflict?: string) => {
    if (user.current) {
      const { error } = await supabase
        .from(table)
        .upsert({ ...row, user_id: user.current }, { onConflict });
      if (error)
        throw new Error(
          "Could not save to your account. Please check your connection and try again.",
        );
    }
  };
  const operations = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = <T,>(work: () => Promise<T>) => {
    const owner = user.current;
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
    removeEntry: async (id) => {
      const owner = user.current;
      if (owner) {
        const { error } = await supabase
          .from("journey_entries")
          .delete()
          .eq("id", id)
          .eq("user_id", owner);
        if (error) throw new Error("Could not remove this item. Please retry.");
      }
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
      if (owner) {
        const { error } = await supabase
          .from("profiles")
          .upsert({ ...profile, id: owner });
        if (error)
          throw new Error("Could not save your profile. Please try again.");
      }
      await commit({ ...current.current, profile }, owner);
    },
    saveIntention: async (
      action,
      value,
      person,
      day = localDay(),
      interest = "",
      details = {},
    ) => {
      if (![localDay(), shiftDay(localDay(), 1)].includes(day))
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
              state: "spark",
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
    },
    checkIn: async (input) => {
      const owner = user.current;
      const intention = current.current.intentions.find(
        (i) => i.id === input.intention_id,
      );
      if (!intention || intention.day > localDay())
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
    forget: async (id) => {
      const owner = user.current;
      if (owner) {
        const { error } = await supabase
          .from("memories")
          .delete()
          .eq("id", id)
          .eq("user_id", owner);
        if (error) throw error;
      }
      await commit(
        {
          ...current.current,
          memories: current.current.memories.filter((m) => m.id !== id),
        },
        owner,
      );
    },
    addMessages: async (messages, owner) => {
      if (owner !== user.current) return;
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
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(
        keys.filter(
          (key) =>
            key.startsWith("iwillbe.draft.v1.guest.") ||
            key === "iwillbe.auth.intent" ||
            key === "iwillbe.practice.v1.guest",
        ),
      );
      await commit(emptyPractice());
      setGuest(null);
    },
  };
  const safeValue: Context = {
    ...value,
    putEntry: (input) => enqueue(() => value.putEntry(input)),
    removeEntry: (id) => enqueue(() => value.removeEntry(id)),
    saveProfile: (profile) => enqueue(() => value.saveProfile(profile)),
    saveIntention: (...args) => enqueue(() => value.saveIntention(...args)),
    checkIn: (input) => enqueue(() => value.checkIn(input)),
    remember: (...args) => enqueue(() => value.remember(...args)),
    forget: (id) => enqueue(() => value.forget(id)),
    clearLocal: () => enqueue(() => value.clearLocal()),
    addMessages: (...args) => enqueue(() => value.addMessages(...args)),
  };
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
            backgroundColor: "#0D0E20",
            position: "absolute",
            inset: 0,
            zIndex: 100,
          }}
        >
          <ActivityIndicator color="#AF812C" />
        </View>
      )}
    </Ctx.Provider>
  );
}
export function usePractice() {
  const value = useContext(Ctx);
  if (!value) throw new Error("PracticeProvider missing");
  return value;
}
