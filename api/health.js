export default async function handler(req, res) {
  const startedAt = Date.now();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (!["GET", "HEAD"].includes(req.method)) {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  const env = {
    app: {
      APP_URL: Boolean(process.env.APP_URL),
      PUBLIC_SITE_URL: Boolean(process.env.PUBLIC_SITE_URL)
    },

    supabase: {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    },

    livekit: {
      LIVEKIT_URL: Boolean(process.env.LIVEKIT_URL),
      LIVEKIT_API_KEY: Boolean(process.env.LIVEKIT_API_KEY),
      LIVEKIT_API_SECRET: Boolean(process.env.LIVEKIT_API_SECRET)
    },

    stripe: {
      STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
      STRIPE_WEBHOOK_SECRET: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      STRIPE_CLIENT_ID: Boolean(process.env.STRIPE_CLIENT_ID),
      STRIPE_PUBLISHABLE_KEY: Boolean(process.env.STRIPE_PUBLISHABLE_KEY),
      STRIPE_PLATFORM_COUNTRY: Boolean(process.env.STRIPE_PLATFORM_COUNTRY),
      STRIPE_PLATFORM_FEE_BPS: Boolean(process.env.STRIPE_PLATFORM_FEE_BPS),
      AUTO_APPROVE_PAYOUTS: Boolean(process.env.AUTO_APPROVE_PAYOUTS)
    }
  };

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  const missingRequired = [];

  if (!supabaseUrl) missingRequired.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseKey) missingRequired.push("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const checks = {
    api: {
      ok: true,
      message: "Rich Bizness API is online"
    },

    env,

    supabase: {
      ok: false,
      checked: false,
      status: null,
      message: "Supabase not checked"
    },

    livekit: {
      ok: Boolean(
        process.env.LIVEKIT_URL &&
        process.env.LIVEKIT_API_KEY &&
        process.env.LIVEKIT_API_SECRET
      ),
      message:
        process.env.LIVEKIT_URL &&
        process.env.LIVEKIT_API_KEY &&
        process.env.LIVEKIT_API_SECRET
          ? "LiveKit env ready"
          : "LiveKit env incomplete"
    },

    stripe: {
      ok: Boolean(
        process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_WEBHOOK_SECRET
      ),
      message:
        process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_WEBHOOK_SECRET
          ? "Stripe env ready"
          : "Stripe env incomplete"
    }
  };

  if (supabaseUrl && supabaseKey) {
    checks.supabase.checked = true;

    try {
      const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/profiles?select=id&limit=1`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        }
      });

      checks.supabase.ok = response.ok;
      checks.supabase.status = response.status;

      if (response.ok) {
        checks.supabase.message = "Supabase connected";
      } else {
        const text = await response.text().catch(() => "");
        checks.supabase.message = text || "Supabase responded with an error";
      }
    } catch (error) {
      checks.supabase.ok = false;
      checks.supabase.message = error?.message || "Supabase connection failed";
    }
  } else {
    checks.supabase.message = "Missing Supabase environment variables";
  }

  const ok =
    checks.api.ok &&
    checks.supabase.ok &&
    missingRequired.length === 0;

  const payload = {
    ok,
    service: "Rich Bizness Mobile API",
    route: "/api/health",
    status: ok ? "ok" : "warning",
    timestamp: new Date().toISOString(),
    latency_ms: Date.now() - startedAt,
    missing_required: missingRequired,
    checks
  };

  if (req.method === "HEAD") {
    return res.status(ok ? 200 : 503).end();
  }

  return res.status(ok ? 200 : 503).json(payload);
}
