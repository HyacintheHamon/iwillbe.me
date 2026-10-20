import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const hash = async (text: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 5000) return json({ error: "Request too large" }, 413);
    const body = JSON.parse(raw);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    if (body.action === "view" || body.action === "reply") {
      if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token))
        return json({ error: "This invitation is unavailable." }, 404);
      const token_hash = await hash(body.token);
      const { data: inv, error } = await admin
        .from("shared_invitations")
        .select("id,user_id,kind,sender_name,message")
        .eq("token_hash", token_hash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error || !inv)
        return json(
          { error: "This invitation has expired or was removed." },
          404,
        );
      if (body.action === "reply") {
        if (
          inv.kind !== "friend" ||
          typeof body.content !== "string" ||
          !body.content.trim() ||
          body.content.length > 500 ||
          typeof body.nonce !== "string" ||
          !/^[0-9a-f-]{36}$/.test(body.nonce)
        )
          return json(
            { error: "Please write a suggestion under 500 characters." },
            400,
          );
        const { error } = await admin.rpc("submit_friend_suggestion", {
          p_hash: token_hash,
          p_nonce: body.nonce,
          p_content: body.content.trim(),
        });
        if (error)
          return json(
            {
              error:
                "This reply could not be saved. The invitation may already have enough replies.",
            },
            409,
          );
        return json({ sent: true });
      }
      return json({
        kind: inv.kind,
        sender: inv.sender_name,
        message: inv.message,
        sender_key: await hash(`sender:${inv.user_id}`),
      });
    }
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user)
      return json(
        { error: "Connect an account to create a private invitation." },
        401,
      );
    if (body.action === "redeem") {
      if (typeof body.code !== "string" || body.code.length > 100)
        return json({ error: "Check your code." }, 400);
      const { data, error } = await admin.rpc("redeem_sponsor_code", {
        p_hash: await hash(body.code.trim().toUpperCase()),
        p_user: user.id,
      });
      if (error || !data)
        return json(
          { error: "This code is unavailable, expired or has no places left." },
          400,
        );
      return json({ redeemed: true });
    }
    if (
      body.action !== "create" ||
      !["comet", "friend", "coach"].includes(body.kind) ||
      typeof body.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 1000 ||
      typeof body.sender !== "string" ||
      body.sender.length > 80
    )
      return json({ error: "Check the invitation details." }, 400);
    // Reuse the existing atomic per-user limiter; invitation responses and declines are never tracked.
    const quota = await admin.rpc("reserve_chloe_request", {
      p_user_id: user.id,
    });
    if (quota.error || !quota.data)
      return json(
        { error: "Please leave a little space before creating another link." },
        429,
      );
    const publicToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const saved = await admin
      .from("shared_invitations")
      .insert({
        user_id: user.id,
        token_hash: await hash(publicToken),
        kind: body.kind,
        sender_name: body.sender.trim() || "A friend",
        message: body.message.trim(),
      })
      .select("id")
      .single();
    if (saved.error)
      return json({ error: "Could not create the invitation." }, 503);
    return json({ token: publicToken, id: saved.data.id });
  } catch {
    return json(
      { error: "Could not complete this request. Please try again." },
      503,
    );
  }
});
