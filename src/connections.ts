import { supabase } from "./supabase";
export async function connectionRequest(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("connections", {
    body,
  });
  if (error) {
    let message = "Could not open this invitation. Please try again.";
    try {
      const result = await error.context?.json();
      if (result?.error) message = result.error;
    } catch {}
    throw new Error(message);
  }
  return data;
}
export const publicOrigin = () =>
  typeof window !== "undefined"
    ? window.location.origin
    : "https://iwillbe-me.vercel.app";
