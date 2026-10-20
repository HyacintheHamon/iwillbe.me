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
import { v4 as uuidv4 } from "uuid";
import { supabase } from "./supabase";
import {
  emptyPractice,
  localDay,
  type Practice,
  type Profile,
  type Intention,
  type CheckIn,
  type Memory,
  type Message,
} from "./domain";
type Context = {
  data: Practice;
  session: Session | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  saveIntention: (a: string, v: string, p: string) => Promise<void>;
  checkIn: (c: Omit<CheckIn, "created_at">) => Promise<void>;
  remember: (content: string, source: string) => Promise<void>;
  forget: (id: string) => Promise<void>;
  addMessages: (m: Message[], owner: string) => Promise<void>;
  clearLocal: () => Promise<void>;
};
const Ctx = createContext<Context | null>(null);
const cacheKey = (id?: string) => `iwillbe.practice.v1.${id || "guest"}`;
const newId = () =>
  uuidv4({ random: Crypto.getRandomValues(new Uint8Array(16)) });
export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Practice>(emptyPractice),
    [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
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
  }, []);
  const load = useCallback(
    async (s: Session | null) => {
      const request = ++generation.current;
      const previousOwner = user.current;
      user.current = s?.user.id;
      setSession(s);
      setLoading(true);
      setError("");
      current.current = emptyPractice();
      setData(current.current);
      try {
        if (previousOwner && previousOwner !== s?.user.id)
          await AsyncStorage.removeItem(cacheKey(previousOwner));
        const cached = await AsyncStorage.getItem(cacheKey(s?.user.id));
        if (request !== generation.current) return;
        if (cached) {
          const parsed = JSON.parse(cached);
          current.current = {
            ...emptyPractice(),
            ...parsed,
            profile: { ...emptyPractice().profile, ...parsed.profile },
          };
          setData(current.current);
        }
        if (s) {
          const results = await Promise.all([
            supabase
              .from("profiles")
              .select("*")
              .eq("id", s.user.id)
              .maybeSingle(),
            supabase
              .from("intentions")
              .select("*")
              .order("day", { ascending: false }),
            supabase.from("check_ins").select("*"),
            supabase
              .from("memories")
              .select("*")
              .order("created_at", { ascending: false }),
            supabase
              .from("messages")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(60),
          ]);
          const failed = results.find((r) => r.error);
          if (failed?.error) throw failed.error;
          if (request !== generation.current) return;
          await commit(
            {
              profile: results[0].data
                ? { ...emptyPractice().profile, ...results[0].data }
                : emptyPractice().profile,
              intentions: results[1].data || [],
              checkIns: results[2].data || [],
              memories: results[3].data || [],
              messages: [...(results[4].data || [])].reverse(),
            },
            s.user.id,
          );
        }
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
        if (request === generation.current) setLoading(false);
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
  const value: Context = {
    data,
    session,
    loading,
    error,
    refresh: async () => {
      if (!(await load(session)))
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
    saveIntention: async (action, value, person) => {
      const owner = user.current;
      const existing = current.current.intentions.find(
        (i) => i.day === localDay(),
      );
      if (
        existing &&
        current.current.checkIns.some((c) => c.intention_id === existing.id)
      )
        throw new Error(
          "You have already reflected on today’s intention. Come back tomorrow for a fresh start.",
        );
      const intention: Intention = {
        id: existing?.id || newId(),
        day: localDay(),
        action: action.trim(),
        value,
        person: person.trim(),
        created_at: existing?.created_at || new Date().toISOString(),
      };
      if (!intention.action || intention.action.length > 500)
        throw new Error("Please write an intention under 500 characters.");
      await write("intentions", intention, "user_id,day");
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
      const row = { ...input, created_at: new Date().toISOString() };
      await write("check_ins", row, "intention_id");
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
      await commit(emptyPractice());
    },
  };
  return (
    <Ctx.Provider value={value}>
      {loading ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F4EFE4",
          }}
        >
          <ActivityIndicator color="#AF812C" />
        </View>
      ) : (
        children
      )}
    </Ctx.Provider>
  );
}
export function usePractice() {
  const value = useContext(Ctx);
  if (!value) throw new Error("PracticeProvider missing");
  return value;
}
