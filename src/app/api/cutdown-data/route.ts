import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { CutdownAppData } from "@/types";

const SINGLETON_ID = "singleton";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key);
}

function getExpectedSyncSecret(): string | undefined {
  const s =
    process.env.CUTDOWN_SYNC_SECRET?.trim() ||
    process.env.NEXT_PUBLIC_CUTDOWN_SYNC_SECRET?.trim();
  return s || undefined;
}

export async function GET() {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server sync is not configured (missing Supabase service role)." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("cutdown_workspace")
    .select("payload, updated_at")
    .eq("id", SINGLETON_ID)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.payload) {
    return NextResponse.json({ payload: null, updated_at: null });
  }

  return NextResponse.json({
    payload: data.payload as CutdownAppData,
    updated_at: data.updated_at,
  });
}

export async function POST(request: Request) {
  const expected = getExpectedSyncSecret();
  const sent = request.headers.get("x-cutdown-sync-secret")?.trim();
  if (!expected || sent !== expected) {
    return NextResponse.json(
      {
        error:
          "Unauthorized. Set CUTDOWN_SYNC_SECRET (and the same value as NEXT_PUBLIC_CUTDOWN_SYNC_SECRET for the browser) on the server.",
      },
      { status: 401 },
    );
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server sync is not configured (missing Supabase service role)." },
      { status: 503 },
    );
  }

  let body: { payload?: CutdownAppData };
  try {
    body = (await request.json()) as { payload?: CutdownAppData };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.payload || typeof body.payload !== "object") {
    return NextResponse.json({ error: "payload is required" }, { status: 400 });
  }

  const { error } = await supabase.from("cutdown_workspace").upsert(
    {
      id: SINGLETON_ID,
      payload: body.payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
