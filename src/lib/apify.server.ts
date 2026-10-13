// Server-only Apify ingestion adapter (via Lovable connector gateway).
// Actor IDs are configured here only; override with env vars.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/apify";

export type SourceKind = "linkedin" | "instagram";

export function actorIdFor(source: SourceKind): string {
  return source === "linkedin"
    ? process.env["APIFY_LINKEDIN_ACTOR_ID"] || "harvestapi~linkedin-profile-scraper"
    : process.env["APIFY_INSTAGRAM_ACTOR_ID"] || "apify~instagram-profile-scraper";
}

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const apify = process.env["APIFY_API_KEY"];
  if (!lovable) throw new Error("LOVABLE_API_KEY is not configured");
  if (!apify) throw new Error("APIFY_API_KEY is not configured (connect Apify)");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": apify,
    "Content-Type": "application/json",
  };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify request failed [${res.status}]: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

export function instagramUsername(url: string): string {
  const m = new URL(url).pathname.split("/").filter(Boolean)[0];
  if (!m) throw new Error("Instagram URL has no username");
  return m;
}

/** Actor input per documented schema of the configured actor. */
export function actorInput(source: SourceKind, url: string) {
  return source === "linkedin" ? { urls: [url] } : { usernames: [instagramUsername(url)], resultsLimit: 12 };
}

type RunData = { data: { id: string; status: string; defaultDatasetId: string; statusMessage?: string } };

export async function startRun(source: SourceKind, url: string) {
  const actor = actorIdFor(source);
  const r = await call<RunData>(`/acts/${actor}/runs?waitForFinish=30`, {
    method: "POST",
    body: JSON.stringify(actorInput(source, url)),
  });
  return { actorId: actor, runId: r.data.id, status: r.data.status, datasetId: r.data.defaultDatasetId };
}

export async function getRun(runId: string) {
  const r = await call<RunData>(`/actor-runs/${runId}`);
  return r.data;
}

export async function getItems(datasetId: string): Promise<Record<string, unknown>[]> {
  return call<Record<string, unknown>[]>(`/datasets/${datasetId}/items?limit=5&clean=true`);
}

type Any = Record<string, any>;

/** Keep only matchmaking-relevant public fields; contact data (emails/phones) is dropped. */
export function normalize(source: SourceKind, item: Any) {
  if (source === "linkedin") {
    const positions = [...(item.currentPosition ?? []), ...(item.experience ?? [])].slice(0, 6);
    return {
      name: [item.firstName, item.lastName].filter(Boolean).join(" ") || null,
      headline: item.headline ?? null,
      about: item.about ?? null,
      location: item.location?.linkedinText ?? null,
      industry: item.industry?.name ?? null,
      positions: positions.map((p: Any) => ({
        title: p.position ?? p.title ?? null,
        company: p.companyName ?? null,
        duration: p.duration ?? null,
        description: p.description ?? null,
      })),
      education: (item.profileTopEducation ?? item.education ?? []).slice(0, 4).map((e: Any) => ({
        school: e.schoolName ?? null,
        field: e.fieldOfStudy ?? null,
        period: e.period ?? null,
      })),
      skills: (item.topSkills ?? item.skills ?? []).slice(0, 15).map((s: Any) => (typeof s === "string" ? s : s.name)),
      languages: (item.languages ?? []).map((l: Any) => l.name ?? l).slice(0, 8),
      volunteering: (item.volunteering ?? []).slice(0, 4).map((v: Any) => v.role ?? v.cause ?? null),
      url: item.linkedinUrl ?? null,
    };
  }
  return {
    name: item.fullName ?? null,
    username: item.username ?? null,
    biography: item.biography ?? null,
    isPrivate: !!item.private,
    category: item.businessCategoryName ?? null,
    postsCount: item.postsCount ?? null,
    posts: (item.latestPosts ?? []).slice(0, 12).map((p: Any) => ({
      url: p.url,
      caption: typeof p.caption === "string" ? p.caption.slice(0, 600) : null,
      hashtags: p.hashtags ?? [],
      location: p.locationName ?? null,
      timestamp: p.timestamp ?? null,
      type: p.type ?? null,
    })),
    url: item.url ?? null,
  };
}
