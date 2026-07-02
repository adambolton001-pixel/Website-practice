// =====================================================================
//  Aegis Edge Function: notify
// ---------------------------------------------------------------------
//  Sends a parent update ("on board" / "arrived safely" / "5 minutes
//  away") by app push and/or SMS, honouring per-family, per-channel
//  consent — then records what was sent in parent_updates + audit_log.
//
//  Privacy design: this runs server-side with the SERVICE ROLE, so
//  parent contact details (phone numbers, push tokens) and provider
//  secrets (Twilio) NEVER reach the on-vehicle client. The client sends
//  only { child_id, run_id, kind }. Messages carry the child's minimised
//  display name and the school — never a home address.
//
//  Deploy:   supabase functions deploy notify        (verify_jwt is on
//            by default — the platform rejects unauthenticated calls)
//  Secrets:  supabase secrets set TWILIO_ACCOUNT_SID=... \
//            TWILIO_AUTH_TOKEN=... TWILIO_FROM=+44...
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

type Kind = "onboard" | "arrived" | "eta";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Service-role client: bypasses RLS. Every read below is therefore
  // gated by the explicit authorisation checks that follow.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // -- 1. Who is calling? The platform has already verified the JWT
  //       signature; resolve it to an auth user, then to a profile.
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth?.user) return json({ error: "Not signed in" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("id, operator_id, staff_id, role, full_name")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile) return json({ error: "No profile for this user" }, 403);

  // -- 2. Validate the request body.
  let body: { child_id?: string; run_id?: string; kind?: Kind };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const { child_id, run_id, kind } = body;
  if (!child_id || !run_id || !["onboard", "arrived", "eta"].includes(kind ?? "")) {
    return json({ error: "Expected { child_id, run_id, kind: onboard|arrived|eta }" }, 400);
  }

  // -- 3. Authorise: a manager of this operator, or a driver/PA actually
  //       assigned to this run. Anyone else gets a flat 403.
  const { data: run } = await admin
    .from("runs")
    .select("id, operator_id, school, driver_staff_id, pa_staff_id")
    .eq("id", run_id)
    .maybeSingle();
  if (!run || run.operator_id !== profile.operator_id) {
    return json({ error: "Run not found" }, 403);
  }
  const isManager = profile.role === "manager";
  const isRunStaff = profile.staff_id !== null &&
    (run.driver_staff_id === profile.staff_id || run.pa_staff_id === profile.staff_id);
  if (!isManager && !isRunStaff) {
    return json({ error: "Not authorised for this run" }, 403);
  }

  // The child must belong to the same run (and therefore operator).
  const { data: child } = await admin
    .from("children")
    .select("id, run_id, operator_id, display_name")
    .eq("id", child_id)
    .maybeSingle();
  if (!child || child.run_id !== run.id || child.operator_id !== profile.operator_id) {
    return json({ error: "Child is not on this run" }, 403);
  }

  // -- 4. Rate limit: a stuck button or double-tap must not spam a
  //       parent. One update per child per kind per 60 seconds.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await admin
    .from("parent_updates")
    .select("id")
    .eq("child_id", child_id)
    .eq("kind", kind!)
    .gte("sent_at", since)
    .limit(1);
  if (recent && recent.length > 0) {
    return json({ error: "Duplicate update suppressed (same update sent in the last minute)" }, 429);
  }

  // -- 5. Build the message (minimised: display name + school only).
  const school = run.school ?? "school";
  const message = {
    onboard: `${child.display_name} is on board and on the way to ${school}.`,
    arrived: `${child.display_name} has arrived safely at ${school}.`,
    eta: `The bus is about 5 minutes away from picking up ${child.display_name}.`,
  }[kind as Kind];

  // -- 6. Fan out to every consenting contact for this child. Provider
  //       failures are logged but never lose the record of the attempt.
  const { data: contacts } = await admin
    .from("parent_contacts")
    .select("name, push_token, phone, consent_app, consent_sms")
    .eq("child_id", child_id);

  let sentApp = false;
  let sentSms = false;
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM");

  for (const c of contacts ?? []) {
    if (c.consent_app && c.push_token) {
      sentApp = true; // record the attempt even if the provider is down
      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: c.push_token, title: "Aegis", body: message }),
        });
      } catch (err) {
        console.error("Expo push failed:", err);
      }
    }
    if (c.consent_sms && c.phone && sid && token && from) {
      sentSms = true;
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${sid}:${token}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: c.phone, From: from, Body: message }),
        });
      } catch (err) {
        console.error("Twilio SMS failed:", err);
      }
    }
  }

  const channels = sentApp && sentSms
    ? "app + sms"
    : sentApp
      ? "app"
      : sentSms
        ? "sms"
        : "not sent — no consent";

  // -- 7. Record what happened: the manager-visible feed + the audit log.
  await admin.from("parent_updates").insert({
    operator_id: profile.operator_id,
    child_id,
    run_id,
    kind,
    channels,
    message,
    sent_by_name: profile.full_name,
  });
  await admin.from("audit_log").insert({
    operator_id: profile.operator_id,
    actor_id: profile.id,
    actor_role: profile.role,
    actor_name: profile.full_name,
    action: `Parent update (${kind}) — ${channels}`,
    entity: `child:${child_id}`,
  });

  return json({ ok: true, channels });
});
