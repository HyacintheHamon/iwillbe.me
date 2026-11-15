import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "./supabase";
import { usePractice } from "./practice";
import type { Place, Someday, Moment, MomentType, Summary } from "./round2";

export function useRound2() {
  const { session } = usePractice();
  const owner = session?.user.id;
  const liveOwner = useRef(owner);
  useEffect(() => {
    liveOwner.current = owner;
  }, [owner]);
  const [loadedOwner, setLoadedOwner] = useState<string | undefined>();
  const [places, setPlaces] = useState<Place[]>([]);
  const [someday, setSomeday] = useState<Someday[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    if (!owner) return;
    const results = await Promise.all([
      supabase
        .from("places")
        .select("*")
        .eq("user_id", owner)
        .order("sort_order"),
      supabase
        .from("someday_items")
        .select("*")
        .eq("user_id", owner)
        .order("created_at"),
      supabase
        .from("chloe_moments")
        .select("type,session_id,asked_at")
        .eq("user_id", owner)
        .order("asked_at", { ascending: false })
        .limit(100),
      supabase
        .from("checkin_summaries")
        .select("day,hard_day,summary,opener_line")
        .eq("user_id", owner)
        .order("day", { ascending: false })
        .limit(8),
    ]);
    if (liveOwner.current !== owner) return;
    const failure = results.find((x) => x.error);
    if (failure) {
      setError("Your map could not load. Please try again.");
      return;
    }
    setLoadedOwner(owner);
    setPlaces(results[0].data || []);
    setSomeday(results[1].data || []);
    setMoments(results[2].data || []);
    setSummaries(results[3].data || []);
    setReady(true);
    setError("");
  }, [owner]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const addPlace = async (label: string) => {
    const result = await supabase
      .from("places")
      .upsert(
        { user_id: owner, label: label.trim(), sort_order: places.length },
        { onConflict: "user_id,label" },
      )
      .select()
      .single();
    if (result.error) throw new Error("That place could not save. Try again.");
    setPlaces((old) => [
      ...old.filter((p) => p.id !== result.data.id),
      result.data,
    ]);
    return result.data as Place;
  };
  const saveSomeday = async (
    input: Partial<Someday> & Pick<Someday, "text" | "horizon">,
  ) => {
    const { revision, ...fields } = input;
    const result = input.id
      ? await supabase
          .from("someday_items")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", input.id)
          .eq("user_id", owner!)
          .eq("revision", revision || 1)
          .select()
          .maybeSingle()
      : await supabase
          .from("someday_items")
          .insert({ ...fields, user_id: owner })
          .select()
          .single();
    if (result.error || !result.data)
      throw new Error(
        "This item could not save, or changed on another device. Reopen it and try again.",
      );
    setSomeday((old) => [
      ...old.filter((s) => s.id !== result.data.id),
      result.data,
    ]);
    return result.data as Someday;
  };
  const recordMoment = async (
    type: MomentType,
    sessionId: string,
    hardDay = false,
  ) => {
    const { data, error } = await supabase.functions.invoke("chloe", {
      body: {
        action: "round2_moment",
        type,
        session_id: sessionId,
        hard_day: hardDay,
      },
    });
    if (error || data?.error) throw new Error("Please try again in a moment.");
    if (data.moment) setMoments((old) => [data.moment, ...old]);
    return !!data.moment;
  };
  return {
    places: loadedOwner === owner ? places : [],
    someday: loadedOwner === owner ? someday : [],
    moments: loadedOwner === owner ? moments : [],
    summaries: loadedOwner === owner ? summaries : [],
    error,
    ready: ready && loadedOwner === owner,
    refresh,
    addPlace,
    saveSomeday,
    recordMoment,
  };
}
