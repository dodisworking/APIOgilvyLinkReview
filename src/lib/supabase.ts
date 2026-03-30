import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

export const supabase = isSupabaseConfigured
  ? createClient(url as string, anon as string)
  : null;

/** True if we can persist review_links: anon client (live hub) OR server API via sync secret (Vercel-friendly). */
export function hasReviewLinkCloudPath(): boolean {
  return (
    isSupabaseConfigured ||
    Boolean(process.env.NEXT_PUBLIC_CUTDOWN_SYNC_SECRET?.trim())
  );
}
