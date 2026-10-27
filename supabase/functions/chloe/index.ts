import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  buildChloeContext,
  contextLookback,
  conversationHistory,
  normalizeQuestion,
  questionInMessage,
  resolveResponseQuestion,
  localContextDay,
  systemPrompt,
  MODES,
  PROMPT_VERSION,
  type HistoryMessage,
  type IntentionContext,
  type JourneyRow,
  type ReflectionContext,
} from "./prompt.ts";
import {
  reflectionProposalSchema,
  weeklyFocusSchema,
  validateReflectionProposal,
  validateWeeklyFocus,
} from "./proposals.ts";
import {
  validateOnboardingInput,
  generateOnboardingInsights,
} from "./onboarding.ts";
import {
  constrainChloeReply,
  legacyProposalInstruction,
  schemaForProposalCapability,
} from "./reply.ts";
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
const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "message",
    "suggested_intention",
    "memory_suggestion",
    "question",
    "why_proposal",
    "discovery",
    "reflection_proposal",
    "weekly_focus",
  ],
  properties: {
    reflection_proposal: reflectionProposalSchema,
    weekly_focus: weeklyFocusSchema,
    discovery: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "title", "body", "source_ids"],
          properties: {
            kind: {
              type: "string",
              enum: ["interest", "value", "strength", "person"],
            },
            title: { type: "string" },
            body: { type: "string" },
            source_ids: { type: "array", items: { type: "string" } },
          },
        },
      ],
    },
    question: { anyOf: [{ type: "null" }, { type: "string" }] },
    why_proposal: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["text", "source_ids"],
          properties: {
            text: { type: "string" },
            source_ids: { type: "array", items: { type: "string" } },
          },
        },
      ],
    },
    message: { type: "string" },
    suggested_intention: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: [
            "action",
            "value",
            "person",
            "interest",
            "planet",
            "when_context",
            "with_person",
          ],
          properties: {
            interest: { type: "string" },
            planet: {
              type: "string",
              enum: ["Be", "People", "Causes", "Passions", "Grow", "Surprise"],
            },
            when_context: { type: "string" },
            with_person: { type: "string" },
            action: { type: "string" },
            value: { type: "string" },
            person: { type: "string" },
          },
        },
      ],
    },
    memory_suggestion: { anyOf: [{ type: "null" }, { type: "string" }] },
  },
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Please sign in to continue." }, 401);
  const url = Deno.env.get("SUPABASE_URL")!,
    anon = Deno.env.get("SUPABASE_ANON_KEY")!,
    secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const scoped = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await scoped.auth.getUser(token);
  if (authError || !user)
    return json(
      { error: "Your session has expired. Please sign in again." },
      401,
    );
  let body;
  try {
    const text = await req.text();
    if (text.length > 10000)
      return json({ error: "That message is too long." }, 413);
    body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json({ error: "Invalid request." }, 400);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  try {
    if (body.action === "delete_account") {
      if (body.confirmation !== "DELETE")
        return json({ error: "Please confirm deletion." }, 400);
      const revoked = await admin.auth.admin.signOut(token, "global");
      if (revoked.error)
        return json(
          { error: "Could not revoke your sessions. Please try again." },
          503,
        );
      const removed = await admin.auth.admin.deleteUser(user.id);
      if (removed.error)
        return json(
          { error: "Could not delete your account. Please try again." },
          503,
        );
      return json({ deleted: true });
    }
    const onboardingInput =
      body.action === "onboarding_insights"
        ? validateOnboardingInput(body)
        : null;
    if (body.action === "onboarding_insights" && !onboardingInput)
      return json(
        { error: "Please keep each saved story brief and try again." },
        400,
      );
    if (
      body.action !== "onboarding_insights" &&
      (body.action !== "chat" ||
        typeof body.message !== "string" ||
        !body.message.trim() ||
        body.message.length > 2000)
    )
      return json(
        { error: "Please send a message of up to 2,000 characters." },
        400,
      );
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey)
      return json(
        {
          code: "AI_NOT_CONFIGURED",
          error: "Chloe is not available in this beta yet.",
        },
        503,
      );
    const quota = await admin.rpc("reserve_chloe_request", {
      p_user_id: user.id,
    });
    if (quota.error)
      return json({ error: "Chloe is temporarily unavailable." }, 503);
    if (!quota.data)
      return json(
        {
          error:
            "Let’s leave some space to live. You can return to Chloe in a little while.",
        },
        429,
      );
    if (onboardingInput) {
      // This action proposes only: no story, interest, strength or why is written.
      const insights = await generateOnboardingInsights(
        onboardingInput,
        apiKey,
        Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
      );
      return json(insights);
    }
    const mode =
      typeof body.mode === "string" && Object.hasOwn(MODES, body.mode)
        ? body.mode
        : "morning";
    const contextNow = new Date();
    const since = contextLookback(mode, contextNow);
    const sessionId =
      typeof body.session_id === "string" &&
      /^[a-zA-Z0-9_-]{1,80}$/.test(body.session_id)
        ? body.session_id
        : undefined;
    const area = [
      "Be",
      "People",
      "Causes",
      "Passions",
      "Grow",
      "Surprise",
    ].includes(body.area)
      ? body.area
      : undefined;
    const results = await Promise.all([
      scoped
        .from("profiles")
        .select(
          "display_name,north_star,values,interests,timezone,onboarded,morning_time,evening_time",
        )
        .eq("id", user.id)
        .maybeSingle(),
      scoped
        .from("intentions")
        .select(
          "id,day,action,value,person,interest,interest_id,value_id,planet,kind,when_context,place,with_person,created_at",
        )
        .gte("day", since.slice(0, 10))
        .order("day", { ascending: false })
        .limit(100),
      scoped
        .from("check_ins")
        .select(
          "intention_id,outcome,reflection,energy,value_choice,created_at",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100),
      scoped
        .from("memories")
        .select("id,content,source,created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      scoped
        .from("messages")
        .select("id,role,content,created_at")
        .order("created_at", { ascending: false })
        .limit(24),
      scoped
        .from("journey_entries")
        .select("id,kind,entry,updated_at")
        .order("updated_at", { ascending: false })
        .limit(mode === "why" ? 160 : 80),
      scoped
        .from("journey_entries")
        .select("id,kind,entry,updated_at")
        .eq("kind", "why")
        .eq("entry->>state", "accepted")
        .order("entry->>created_at", { ascending: false })
        .limit(1),
      scoped
        .from("journey_entries")
        .select("id,kind,entry,updated_at")
        .in("kind", ["question", "preferences", "backlog"])
        .order("updated_at", { ascending: false })
        .limit(300),
      // Future pictures may be old and must not fall out of a recent-entry limit.
      scoped
        .from("journey_entries")
        .select("id,kind,entry,updated_at")
        .eq("kind", "vision")
        .eq("entry->meta->>horizon", "year")
        .order("entry->>created_at", { ascending: false })
        .limit(1),
      scoped
        .from("journey_entries")
        .select("id,kind,entry,updated_at")
        .eq("kind", "vision")
        .eq("entry->meta->>horizon", "life")
        .order("entry->>created_at", { ascending: false })
        .limit(1),
    ]);
    if (results.some((r) => r.error))
      return json(
        { error: "Could not load your practice. Please try again." },
        503,
      );
    // Keep tuple types: mapping this heterogeneous result list erases row shapes.
    const profile = results[0].data;
    const intentions = results[1].data;
    const reflections = results[2].data;
    const memories = results[3].data;
    const history = results[4].data;
    const recentJourney = results[5].data;
    const latestWhy = results[6].data;
    const preferences = results[7].data;
    const yearVision = results[8].data;
    const lifeVision = results[9].data;
    const journey: JourneyRow[] = [
      ...(recentJourney || []),
      ...(latestWhy || []),
      ...(preferences || []),
      ...(yearVision || []),
      ...(lifeVision || []),
    ];
    const userMessageId = crypto.randomUUID();
    const context = buildChloeContext({
      mode,
      currentMessageId: userMessageId,
      profile,
      intentions: (intentions || []) as IntentionContext[],
      reflections: (reflections || []) as ReflectionContext[],
      memories: memories || [],
      history: (history || []) as HistoryMessage[],
      journey,
      sessionId,
      returningToday: body.returning_today === true,
      area,
      now: contextNow,
    });
    if ((preferences || []).length >= 300)
      context.question_policy +=
        " Some older question preferences could not fit in context. Do not proactively reopen any saved question; let the user choose one.";
    const proposalCards = body.proposal_cards === true;
    const system =
      systemPrompt(mode, context) +
      (proposalCards ? "" : legacyProposalInstruction);
    const started = Date.now();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
        max_tokens: 1200,
        system,
        output_config: {
          format: {
            type: "json_schema",
            schema: schemaForProposalCapability(schema, proposalCards),
          },
        },
        messages: [
          ...conversationHistory(
            (history || []) as HistoryMessage[],
            contextNow,
          ),
          { role: "user", content: body.message.trim() },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok)
      return json(
        { error: "Chloe is taking a pause. Please try again in a moment." },
        502,
      );
    const result = await response.json();
    const raw = result.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");
    let answer;
    try {
      answer = JSON.parse(raw);
    } catch {
      return json(
        { error: "Chloe couldn’t finish that thought. Please try again." },
        502,
      );
    }
    if (
      typeof answer.message !== "string" ||
      !answer.message.trim() ||
      answer.message.length > 6000
    )
      return json(
        { error: "Chloe couldn’t finish that thought. Please try again." },
        502,
      );
    const suggested = answer.suggested_intention;
    if (
      suggested &&
      (![
        "action",
        "value",
        "person",
        "interest",
        "when_context",
        "with_person",
      ].every((k) => typeof suggested[k] === "string") ||
        !suggested.action.trim() ||
        suggested.action.length > 500 ||
        suggested.value.length > 80 ||
        suggested.person.length > 120 ||
        suggested.interest.length > 80 ||
        suggested.when_context.length > 200 ||
        suggested.with_person.length > 120 ||
        !["Be", "People", "Causes", "Passions", "Grow", "Surprise"].includes(
          suggested.planet,
        ))
    )
      answer.suggested_intention = null;
    if (
      typeof answer.memory_suggestion !== "string" ||
      !answer.memory_suggestion.trim() ||
      answer.memory_suggestion.length > 1000
    )
      answer.memory_suggestion = null;
    const evidenceIds = new Set(context.evidence_ids);
    const userSources = new Map<string, string>([
      ...((history || []) as HistoryMessage[])
        .filter(
          (m) =>
            m.role === "user" &&
            Date.parse(m.created_at) >=
              contextNow.getTime() - 2 * 60 * 60 * 1000 &&
            localContextDay(profile?.timezone, new Date(m.created_at)) ===
              context.local_day,
        )
        .map((m) => [m.id, m.content] as [string, string]),
      [userMessageId, body.message.trim()],
    ]);
    answer.reflection_proposal = validateReflectionProposal(
      answer.reflection_proposal,
      mode,
      context.today_commitment,
      userSources,
    );
    answer.weekly_focus = validateWeeklyFocus(
      answer.weekly_focus,
      mode,
      evidenceIds,
      context.focus,
    );
    const discovery = answer.discovery;
    if (
      !discovery ||
      !["interest", "value", "strength", "person"].includes(discovery.kind) ||
      typeof discovery.title !== "string" ||
      !discovery.title.trim() ||
      discovery.title.length > 80 ||
      typeof discovery.body !== "string" ||
      discovery.body.length > 1000 ||
      !Array.isArray(discovery.source_ids) ||
      !discovery.source_ids.length ||
      discovery.source_ids.some(
        (id: unknown) => typeof id !== "string" || !evidenceIds.has(id),
      )
    )
      answer.discovery = null;
    if (
      !answer.why_proposal ||
      typeof answer.why_proposal.text !== "string" ||
      !answer.why_proposal.text.trim() ||
      answer.why_proposal.text.length > 2000 ||
      !Array.isArray(answer.why_proposal.source_ids) ||
      !answer.why_proposal.source_ids.length ||
      answer.why_proposal.source_ids.some(
        (id: unknown) => typeof id !== "string" || !evidenceIds.has(id),
      )
    )
      answer.why_proposal = null;
    answer = constrainChloeReply(
      answer,
      resolveResponseQuestion,
      proposalCards,
    );
    // Guard exact repeat violations even when the model omits its question field.
    // The user may explicitly reopen a question by selecting/typing that question.
    const repeatedDeferred = context.deferred_questions.find(
      (q) =>
        !q.eligible &&
        questionInMessage(q.question, answer.message) &&
        normalizeQuestion(body.message) !== normalizeQuestion(q.question),
    );
    if (repeatedDeferred) {
      answer.message =
        repeatedDeferred.reason === "stopped"
          ? "We can leave that question here."
          : "Let it sit with you today. We can come back to it another time.";
      answer.question = null;
      answer.suggested_intention = null;
      answer.discovery = null;
      answer.memory_suggestion = null;
      answer.why_proposal = null;
      answer.reflection_proposal = null;
      answer.weekly_focus = null;
    }
    const analytics = (preferences || []).some(
      (e: JourneyRow) =>
        e.kind === "preferences" && e.entry.meta?.analytics === true,
    );
    if (analytics)
      await admin.from("product_events").insert({
        user_id: user.id,
        event: "ai_response",
        duration_ms: Date.now() - started,
        input_tokens: result.usage?.input_tokens || 0,
        output_tokens: result.usage?.output_tokens || 0,
      });
    const now = Date.now();
    const messages = [
      {
        id: userMessageId,
        user_id: user.id,
        role: "user",
        content: body.message.trim(),
        created_at: new Date(now).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        user_id: user.id,
        role: "assistant",
        content: answer.message,
        created_at: new Date(now + 1).toISOString(),
      },
    ];
    const saved = await admin.from("messages").insert(messages);
    if (saved.error)
      return json(
        { error: "Could not save this conversation. Please try again." },
        503,
      );
    return json({
      messages: messages.map(({ user_id, ...message }) => message),
      suggested_intention: answer.suggested_intention,
      memory_suggestion: answer.memory_suggestion,
      discovery: answer.discovery,
      question: answer.question,
      why_proposal: answer.why_proposal,
      reflection_proposal: answer.reflection_proposal,
      weekly_focus: answer.weekly_focus,
      prompt_version: PROMPT_VERSION,
    });
  } catch {
    return json(
      {
        error: "Chloe is unavailable right now. Please try again in a moment.",
      },
      503,
    );
  }
});
