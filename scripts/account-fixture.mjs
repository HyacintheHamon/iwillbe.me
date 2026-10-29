// Adapt single-device UI fixtures to mandatory sign-in. All Supabase traffic is
// intercepted. The dedicated sync/auth suites retain their independent servers.
export const fixtureOwner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const fixturePracticeKey = `iwillbe.practice.v2.${fixtureOwner}`;
export const fixtureDraftPrefix = `iwillbe.draft.v1.${fixtureOwner}`;

export async function installAccountFixture(context) {
  const user = {
    id: fixtureOwner,
    aud: "authenticated",
    role: "authenticated",
    email: "fixture@example.test",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-10-01T12:00:00Z",
  };
  // Deliberately invalid signature. This token can only be used by the mock.
  const expiry = Math.floor(Date.now() / 1000) + 86400 * 365;
  const jwt = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: fixtureOwner, role: "authenticated", exp: expiry })).toString("base64url")}.fixture`;
  const session = {
    user,
    access_token: jwt,
    refresh_token: "fixture",
    token_type: "bearer",
    expires_at: expiry,
    expires_in: 86400 * 365,
  };
  await context.addInitScript((value) => {
    localStorage.setItem(
      "sb-mvhqovdznrzoduntyryh-auth-token",
      JSON.stringify(value),
    );
  }, session);
  await context.route(
    "https://mvhqovdznrzoduntyryh.supabase.co/**",
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const respond = (body, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (request.method() === "OPTIONS") return respond({});
      if (url.pathname === "/auth/v1/user") return respond(user);
      if (url.pathname === "/auth/v1/token") return respond(session);
      if (url.pathname === "/auth/v1/logout") return respond({});
      if (url.pathname.startsWith("/functions/"))
        return respond({ error: "No model in this UI fixture" }, 503);
      const keys = {
        profiles: "profile",
        intentions: "intentions",
        check_ins: "checkIns",
        memories: "memories",
        journey_entries: "entries",
        messages: "messages",
      };
      const table = url.pathname.split("/").at(-1);
      if (!Object.hasOwn(keys, table))
        throw new Error(`Unexpected fixture request: ${url.pathname}`);
      const data = await request
        .frame()
        .page()
        .evaluate(
          (key) => JSON.parse(localStorage.getItem(key) || "null"),
          fixturePracticeKey,
        );
      const raw =
        table === "profiles"
          ? data?.profile
            ? [data.profile]
            : []
          : data?.[keys[table]] || [];
      const rows = raw.map((row) =>
        table === "profiles"
          ? { ...row, id: fixtureOwner, revision: row.revision || 1 }
          : table === "journey_entries"
            ? {
                id: row.id,
                user_id: fixtureOwner,
                kind: row.kind,
                entry: row,
                revision: row.revision || 1,
              }
            : { ...row, user_id: fixtureOwner, revision: row.revision || 1 },
      );
      const matches = (row) =>
        [...url.searchParams].every(([key, value]) => {
          if (["select", "order", "limit", "offset"].includes(key)) return true;
          if (value.startsWith("eq."))
            return String(row[key]) === value.slice(3);
          throw new Error(`Unhandled fixture filter: ${key}=${value}`);
        });
      const representation = (values) =>
        request.headers().accept?.includes("vnd.pgrst.object")
          ? values[0] || null
          : values;
      if (request.method() === "GET")
        return respond(representation(rows.filter(matches)));
      const payload =
        request.method() === "DELETE" ? null : request.postDataJSON();
      if (request.method() === "POST")
        return respond(representation([{ ...payload, revision: 1 }]), 201);
      const matched = rows.filter(matches);
      if (request.method() === "DELETE")
        return respond(representation(matched));
      if (request.method() === "PATCH")
        return respond(
          representation(
            matched.map((row) => ({
              ...row,
              ...payload,
              revision: row.revision + 1,
            })),
          ),
        );
      throw new Error(`Unhandled fixture method: ${request.method()}`);
    },
  );
}
