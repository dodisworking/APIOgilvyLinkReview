import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { queryCutdownAppDataWithSupabaseClient } from "@/lib/data-service";
import type { ManualTrackerStatus } from "@/types";

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

function unauthorized() {
  return NextResponse.json(
    {
      error:
        "Unauthorized. Set CUTDOWN_SYNC_SECRET and NEXT_PUBLIC_CUTDOWN_SYNC_SECRET to the same value.",
    },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  const expected = getExpectedSyncSecret();
  const sent = request.headers.get("x-cutdown-sync-secret")?.trim();
  if (!expected || sent !== expected) {
    return unauthorized();
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const cutdown = await queryCutdownAppDataWithSupabaseClient(supabase);
  return NextResponse.json({ cutdown });
}

type PostBody =
  | { op: "insert"; row: Record<string, unknown> }
  | { op: "update"; linkId: string; patch: Record<string, unknown> }
  | { op: "delete"; linkId: string }
  | {
      op: "updateVideo";
      videoId: string;
      isApproved?: boolean;
      manualStatus?: ManualTrackerStatus | null;
    };

export async function POST(request: Request) {
  const expected = getExpectedSyncSecret();
  const sent = request.headers.get("x-cutdown-sync-secret")?.trim();
  if (!expected || sent !== expected) {
    return unauthorized();
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.op === "insert") {
      if (!body.row || typeof body.row !== "object") {
        return NextResponse.json({ error: "row required" }, { status: 400 });
      }
      const { error } = await supabase.from("review_links").insert(body.row);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.op === "update") {
      if (!body.linkId) {
        return NextResponse.json({ error: "linkId required" }, { status: 400 });
      }
      const { error } = await supabase.from("review_links").update(body.patch).eq("id", body.linkId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.op === "delete") {
      if (!body.linkId) {
        return NextResponse.json({ error: "linkId required" }, { status: 400 });
      }
      const { error } = await supabase.from("review_links").delete().eq("id", body.linkId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.op === "updateVideo") {
      if (!body.videoId) {
        return NextResponse.json({ error: "videoId required" }, { status: 400 });
      }
      const up: Record<string, unknown> = {};
      if ("isApproved" in body) {
        up.is_approved = body.isApproved;
      }
      if ("manualStatus" in body) {
        up.manual_status = body.manualStatus ?? null;
      } else if ("isApproved" in body) {
        up.manual_status = null;
      }
      const { error } = await supabase.from("videos").update(up).eq("id", body.videoId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
