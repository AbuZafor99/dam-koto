import { NextRequest, NextResponse } from "next/server";

export interface ProductResult {
  name: string;
  price: number;
  originalPrice: number | null;
  currency: string;
  store: string;
  url: string;
  snippet: string;
  condition: "new" | "used";
}

// ─── SECURITY: Rate Limiter (in-memory, per-IP) ───
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300_000);

// ─── SECURITY: Input Sanitization ───
function sanitizeQuery(query: string): string {
  return query
    .replace(/[<>"'&]/g, "") // Remove HTML chars
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'");
}

function stripHtmlTags(text: string): string {
  return decodeHtmlEntities(text.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeDuckDuckGoRedirect(url: string): string {
  try {
    const normalizedUrl = url.startsWith("//") ? `https:${url}` : url;
    const parsed = new URL(normalizedUrl);
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
  } catch {
    // Return the original URL if it cannot be decoded.
  }
  return url;
}

function decodeBingRedirect(url: string): string {
  try {
    const normalizedUrl = url.startsWith("//") ? `https:${url}` : url;
    const parsed = new URL(normalizedUrl);
    const encodedTarget = parsed.searchParams.get("u");
    if (!encodedTarget) return url;

    const base64Target = encodedTarget.startsWith("a1") ? encodedTarget.slice(2) : encodedTarget;
    const paddedBase64 = base64Target.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (paddedBase64.length % 4)) % 4);
    const decodedTarget = Buffer.from(`${paddedBase64}${padding}`, "base64").toString("utf8");
    if (decodedTarget.startsWith("http")) return decodedTarget;
  } catch {
    // Return the original URL if it cannot be decoded.
  }

  return url;
}

function getZaiConfig() {
  const apiKey = process.env.ZAI_API_KEY;
  const baseUrl = process.env.ZAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";

  if (!apiKey) {
    throw new Error("Missing ZAI_API_KEY environment variable.");
  }

  return { apiKey, baseUrl };
}

async function invokeChatCompletion(prompt: string): Promise<string> {
  const { apiKey, baseUrl } = getZaiConfig();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Z-AI-From": "Z",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "Output only a valid JSON array of product objects. No markdown, no explanation, just the array." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2500,
      thinking: { type: "disabled" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Chat completion failed with status ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "[]";
}

async function fetchSearchResults(query: string): Promise<
  { name: string; snippet: string; url: string; host_name: string }[]
> {
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en-US&cc=US`;
  const response = await fetch(searchUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status}`);
  }

  const html = await response.text();
  const results: { name: string; snippet: string; url: string; host_name: string }[] = [];
  const resultRegex = /<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>[\s\S]*?<div class="b_caption"[^>]*><p[^>]*>([\s\S]*?)<\/p>/gi;

  let match: RegExpExecArray | null;
  while ((match = resultRegex.exec(html)) && results.length < 20) {
    const cleanedUrl = validateAndCleanUrl(decodeBingRedirect(decodeHtmlEntities(match[1])));
    if (!cleanedUrl || isBlockedDomain(cleanedUrl)) continue;

    const name = stripHtmlTags(match[2]);
    const snippet = stripHtmlTags(match[3]);
    if (!name) continue;

    results.push({
      name: name.slice(0, 200),
      snippet: snippet.slice(0, 300),
      url: cleanedUrl,
      host_name: new URL(cleanedUrl).hostname.replace(/^www\./, ""),
    });
  }

  return deduplicateResults(results);
}

// ─── CACHING: In-memory cache (5 min TTL) ───
const searchCache = new Map<string, { data: ProductResult[]; expiresAt: number }>();
const CACHE_TTL = 5 * 60_000; // 5 minutes

// ─── Blocked Domains ───
const BLOCKED_DOMAINS = [
  "youtube.com", "youtu.be", "m.youtube.com",
  "facebook.com", "fb.com", "m.facebook.com",
  "instagram.com", "twitter.com", "tiktok.com",
  "pinterest.com", "reddit.com", "quora.com",
  "linkedin.com", "wikipedia.org", "medium.com",
  "daraz.com.bd", "daraz.com", "daraz.pk", "daraz.lk", "daraz.com.np",
  "bikroy.com", "alibaba.com", "aliexpress.com",
  "google.com", "google.com.bd", "bing.com",
];

function isBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
  } catch {
    return true;
  }
}

// ─── Accessory Keywords (to filter out unrelated cheap items) ───
const ACCESSORY_PATTERNS = [
  /\bcase\b/i, /\bcover\b/i, /\bscreen\s*protector/i, /\btempered\s*glass/i,
  /\bcharger\b/i, /\bcable\b/i, /\badapter\b/i, /\bheadphone\b/i,
  /\bearbuds?\b/i, /\bear\s*phone/i, /\bstand\b/i, /\bholder\b/i,
  /\bmount\b/i, /\bstrap\b/i, /\bband\b/i, /\bprotector\b/i,
  /\bshield\b/i, /\bskin\b/i, /\bsticker\b/i, /\bdecal\b/i,
  /\bpouch\b/i, /\bsleeve\b/i, /\bcarry\s*case/i, /\bkeyboard\b/i,
  /\bmouse\b/i, /\bpen\b/i, /\bstylus\b/i, /\bpower\s*bank/i,
  /\bhub\b/i, /\bdock\b/i, /\bmat\b/i, /\bpad\b/i,
];

function isLikelyAccessory(name: string, snippet: string): boolean {
  const text = `${name} ${snippet}`;
  return ACCESSORY_PATTERNS.some((pattern) => pattern.test(text));
}

// ─── URL Validation & Cleanup ───
function validateAndCleanUrl(url: string): string | null {
  try {
    let cleanedUrl = url;

    // Decode Google redirect URLs: https://www.google.com/url?q=ENCODED_URL&...
    const googleRedirectMatch = cleanedUrl.match(/[?&]q=([^&]+)/);
    if (googleRedirectMatch && (cleanedUrl.includes("google.com/url") || cleanedUrl.includes("google.com.bd/url"))) {
      cleanedUrl = decodeURIComponent(googleRedirectMatch[1]);
    }

    // Decode any URL-encoded URLs that might be nested
    try {
      const doubleDecoded = decodeURIComponent(cleanedUrl);
      if (doubleDecoded.startsWith("http")) cleanedUrl = doubleDecoded;
    } catch { /* already decoded */ }

    const parsed = new URL(cleanedUrl);

    // Must be http or https
    if (!["http:", "https:"].includes(parsed.protocol)) return null;

    // Must have a valid hostname with a TLD
    if (!parsed.hostname.includes(".")) return null;

    // Remove tracking parameters that don't affect the page
    const trackingParams = [
      "srsltid", "utm_source", "utm_medium", "utm_campaign",
      "utm_content", "utm_term", "ref", "affiliate_id", "click_id",
      "gclid", "fbclid", "msclkid", "sa", "ved", "usg", "source", "oq",
    ];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));

    // Remove trailing slash for consistency
    let result = parsed.toString();
    if (result.endsWith("/")) result = result.slice(0, -1);

    return result;
  } catch {
    return null;
  }
}

// ─── Relevance Scoring ───
function computeRelevanceScore(
  name: string,
  snippet: string,
  query: string
): number {
  const queryLower = query.toLowerCase().trim();
  const textLower = `${name} ${snippet}`.toLowerCase();

  // Split query into significant words (length > 2)
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
  if (queryWords.length === 0) return 1;

  let score = 0;

  // Full query match in name = highest relevance
  if (name.toLowerCase().includes(queryLower)) {
    score += 10;
  }

  // Full query match in snippet
  if (textLower.includes(queryLower)) {
    score += 5;
  }

  // Individual word matches
  let wordMatchCount = 0;
  for (const word of queryWords) {
    if (textLower.includes(word)) {
      wordMatchCount++;
    }
  }

  // Proportion of query words found (0 to 1)
  score += (wordMatchCount / queryWords.length) * 8;

  // Penalize if it's an accessory
  if (isLikelyAccessory(name, snippet)) {
    score -= 15;
  }

  // Bonus if the name starts with the product name
  if (name.toLowerCase().startsWith(queryLower.split(" ")[0])) {
    score += 3;
  }

  return score;
}

// ─── Search Query Generation ───
function generateSearchQueries(product: string): string[] {
  const q = product.trim();
  return [
    `${q} price in Bangladesh buy`,
    `${q} best price BD buy online -daraz -facebook`,
  ];
}

// ─── Deduplication ───
function deduplicateResults(
  results: { name: string; snippet: string; url: string; host_name: string }[]
) {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.url.toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Condition Detection ───
function detectCondition(name: string, snippet: string): "new" | "used" {
  const text = `${name} ${snippet}`.toLowerCase();
  const newKeywords = [
    "brand new", "new arrival", "official warranty", "sealed",
    "brand new condition", "100% new", "factory sealed",
  ];
  const usedKeywords = [
    "used", "second hand", "pre-owned", "refurbished", "open box",
    "sold", "[sold]", "almost new", "like new", "condition:",
    "slightly used", "hand used", "exchange", "resale",
  ];

  for (const kw of newKeywords) {
    if (text.includes(kw)) return "new";
  }
  for (const kw of usedKeywords) {
    if (text.includes(kw)) return "used";
  }
  return "new";
}

// ─── Offer Price Extraction ───
function extractOfferPriceFromText(text: string): {
  price: number | null;
  originalPrice: number | null;
} {
  // "৳53,990৳72,990" format
  const dualPrice = text.match(/৳\s*([\d,]+(?:\.\d{1,2})?)\s*৳\s*([\d,]+(?:\.\d{1,2})?)/);
  if (dualPrice) {
    const first = parseFloat(dualPrice[1].replace(/,/g, ""));
    const second = parseFloat(dualPrice[2].replace(/,/g, ""));
    if (first > 100 && second > 100 && first !== second) {
      return { price: Math.min(first, second), originalPrice: Math.max(first, second) };
    }
  }

  // "Current price" + "Original price"
  const currentMatch = text.match(/current\s+price\s+(?:is\s*:?\s*)?(?:৳|BDT|Tk\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const originalMatch = text.match(/original\s+price\s+(?:was\s*:?\s*)?(?:৳|BDT|Tk\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (currentMatch && originalMatch) {
    const current = parseFloat(currentMatch[1].replace(/,/g, ""));
    const original = parseFloat(originalMatch[1].replace(/,/g, ""));
    if (current > 100 && original > 100) {
      return { price: Math.min(current, original), originalPrice: Math.max(current, original) };
    }
  }

  // "now X" / "was Y"
  const nowMatch = text.match(/now\s+(?:৳|BDT|Tk\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const wasMatch = text.match(/was\s+(?:৳|BDT|Tk\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (nowMatch && wasMatch) {
    const now = parseFloat(nowMatch[1].replace(/,/g, ""));
    const was = parseFloat(wasMatch[1].replace(/,/g, ""));
    if (now > 100 && was > 100) {
      return { price: Math.min(now, was), originalPrice: Math.max(now, was) };
    }
  }

  // "starts from X"
  const startsMatch = text.match(/starts?\s+from\s+(?:৳|BDT|Tk\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (startsMatch) {
    const p = parseFloat(startsMatch[1].replace(/,/g, ""));
    if (p > 100) return { price: p, originalPrice: null };
  }

  return { price: null, originalPrice: null };
}

// ─── Regex Price Extraction ───
function extractPricesFromSnippets(
  results: { name: string; snippet: string; url: string; host_name: string }[]
): ProductResult[] {
  const products: ProductResult[] = [];

  for (const r of results) {
    const text = `${r.name} ${r.snippet}`;
    const offerResult = extractOfferPriceFromText(text);
    let price: number | null = offerResult.price;
    let originalPrice: number | null = offerResult.originalPrice;

    if (price === null) {
      const pricePatterns = [
        /৳\s*([\d,]+(?:\.\d{1,2})?)/i,
        /BDT\s*([\d,]+(?:\.\d{1,2})?)/i,
        /([\d,]+(?:\.\d{1,2})?)\s*BDT/i,
        /([\d,]+(?:\.\d{1,2})?)\s*taka/i,
        /Tk\.?\s*([\d,]+(?:\.\d{1,2})?)/i,
        /([\d,]+(?:\.\d{1,2})?)\s*৳/i,
      ];

      for (const pattern of pricePatterns) {
        const match = text.match(pattern);
        if (match) {
          const num = parseFloat(match[1].replace(/,/g, ""));
          if (num > 100 && num < 10000000) {
            price = num;
            break;
          }
        }
      }
    }

    if (price !== null) {
      let name = r.name
        .replace(/\s*[-|–—]\s*.*/, "")
        .replace(/\s*price.*$/i, "")
        .replace(/\s*buy.*$/i, "")
        .replace(/\s*online.*$/i, "")
        .replace(/\s*BD\s*\d+.*$/i, "")
        .trim();
      if (name.length < 5) name = r.name.slice(0, 120);

      const condition = detectCondition(r.name, r.snippet);

      products.push({
        name: name.slice(0, 200),
        price: Math.round(price * 100) / 100,
        originalPrice: originalPrice !== null ? Math.round(originalPrice * 100) / 100 : null,
        currency: "BDT",
        store: r.host_name.replace(/^www\./, ""),
        url: r.url,
        snippet: r.snippet.slice(0, 300),
        condition,
      });
    }
  }

  return products;
}

// ─── MAIN HANDLER ───
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const ip = request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    // Parse body safely
    let body: { query?: string; condition?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const rawQuery = body.query;
    if (!rawQuery || typeof rawQuery !== "string" || rawQuery.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide a product name to search." },
        { status: 400 }
      );
    }

    const sanitizedQuery = sanitizeQuery(rawQuery);
    if (sanitizedQuery.length < 2) {
      return NextResponse.json(
        { error: "Search query too short. Please enter at least 2 characters." },
        { status: 400 }
      );
    }

    const conditionFilter = body.condition === "new" || body.condition === "used"
      ? body.condition
      : "all";

    // CACHE: Check if we have recent results
    const cacheKey = `${sanitizedQuery}:${conditionFilter}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json({
        products: cached.data,
        query: sanitizedQuery,
        totalResults: cached.data.length,
        conditionFilter,
        cached: true,
      });
    }

    // STEP 1: Search queries
    const searchQueries = generateSearchQueries(sanitizedQuery);
    let allResults: { name: string; snippet: string; url: string; host_name: string }[] = [];

    for (const sq of searchQueries) {
      try {
        const resp = await fetchSearchResults(sq);
        if (Array.isArray(resp)) allResults.push(...resp);
      } catch (e) {
        console.error("Search query failed:", sq, e);
      }
    }

    // Filter blocked domains + validate URLs + clean URLs
    allResults = allResults
      .filter((r) => !isBlockedDomain(r.url))
      .filter((r) => validateAndCleanUrl(r.url) !== null)
      .map((r) => ({ ...r, url: validateAndCleanUrl(r.url)! }));

    allResults = deduplicateResults(allResults);

    if (allResults.length === 0) {
      return NextResponse.json({
        products: [],
        query: sanitizedQuery,
        totalResults: 0,
        message: `No results found for "${sanitizedQuery}". Try a more specific product name.`,
      });
    }

    // STEP 2: Compute relevance scores for all results
    const scoredResults = allResults.map((r) => ({
      ...r,
      relevance: computeRelevanceScore(r.name, r.snippet, sanitizedQuery),
    }));

    // Sort by relevance (descending) - most relevant first
    scoredResults.sort((a, b) => b.relevance - a.relevance);

    // STEP 3: Filter out clearly irrelevant results (relevance < 1)
    const minRelevance = 1;
    let relevantResults = scoredResults.filter((r) => r.relevance >= minRelevance);

    // If we filtered too aggressively, fall back to top results by relevance
    if (relevantResults.length === 0) {
      relevantResults = scoredResults.slice(0, 10);
    }

    // STEP 4: Extract prices from relevant results using regex
    const quickProducts = extractPricesFromSnippets(relevantResults);

    // STEP 5: LLM extraction for deeper results (with improved prompt)
    const resultsWithoutPrices = relevantResults.filter(
      (r) => !quickProducts.some((qp) => qp.url === r.url)
    );

    let llmProducts: ProductResult[] = [];

    if (resultsWithoutPrices.length > 0 || quickProducts.length < 3) {
      try {
        const resultsToSend = quickProducts.length < 3 ? relevantResults : resultsWithoutPrices;
        const searchContext = resultsToSend
          .slice(0, 12)
          .map((r: { name: string; snippet: string; url: string; host_name: string; relevance?: number }, i: number) =>
            `[${i + 1}] Title: ${r.name}\nSnippet: ${r.snippet}\nURL: ${r.url}\nSource: ${r.host_name}`
          )
          .join("\n\n");

        const extractionPrompt = `Extract product listings with prices from these search results for the query "${sanitizedQuery}".

CRITICAL RULES:
1. ONLY include products that are ACTUALLY the "${sanitizedQuery}" device/product itself. Do NOT include accessories like cases, covers, chargers, screen protectors, cables, earbuds, stands, or any add-on products.
2. ONLY include products available in Bangladesh (BDT). Skip Myanmar, Nepal, India, Pakistan.
3. DO NOT include results from Daraz, Facebook Marketplace, Bikroy, YouTube, or social media.
4. ALWAYS prefer the OFFER/SALE/DISCOUNT price. If "was X now Y" or "original X, current Y", use LOWER as "price", HIGHER as "originalPrice".
5. Look for ANY price format - BDT, ৳, Tk, taka, or USD/INR (convert: 1 USD ≈ 110 BDT, 1 INR ≈ 1.3 BDT).
6. If a price range is given (e.g. "BDT 46,500 to BDT 164,000"), use lower as price, higher as originalPrice.
7. Determine condition: "new" if brand new/sealed/warranty, "used" if second hand/refurbished/sold/pre-owned.
8. The "url" field MUST be the EXACT product page URL from the results. Do NOT modify or fabricate URLs. The URL must be the direct link to the product page, not a search page or category page.
9. Each result: {"name":"product name","price":offer_price_BDT,"originalPrice":original_BDT_or_null,"currency":"BDT","store":"store name","url":"exact url from results","snippet":"brief desc","condition":"new" or "used"}
10. Remove commas from numbers. Skip if no price can be inferred.
11. Deduplicate - if same store appears twice, keep the more specific result.
12. Return ONLY a JSON array. Sort by price ascending.
13. IMPORTANT: If a product name contains words like "case", "cover", "protector", "charger", "cable", "adapter", "earbuds", "headphone", "stand", "holder" combined with "${sanitizedQuery}", it is an ACCESSORY, NOT the product itself. SKIP it.

Results:
${searchContext}`;

        const responseText = await invokeChatCompletion(extractionPrompt);
        let cleanResponse = responseText.trim();
        if (cleanResponse.startsWith("```")) {
          cleanResponse = cleanResponse.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        try {
          const parsed = JSON.parse(cleanResponse);
          if (Array.isArray(parsed)) llmProducts = parsed;
        } catch {
          const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try { llmProducts = JSON.parse(jsonMatch[0]); } catch { llmProducts = []; }
          }
        }
      } catch (e) {
        console.error("LLM extraction failed:", e);
      }
    }

    // STEP 6: Merge & deduplicate
    const mergedMap = new Map<string, ProductResult>();

    for (const p of quickProducts) {
      mergedMap.set(p.url.toLowerCase(), p);
    }

    for (const p of llmProducts) {
      if (!p.name || typeof p.price !== "number" || p.price <= 0 || !p.url) continue;
      // Validate LLM URL
      const cleanedUrl = validateAndCleanUrl(p.url);
      if (!cleanedUrl) continue;
      if (isBlockedDomain(cleanedUrl)) continue;

      const key = cleanedUrl.toLowerCase();
      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          name: String(p.name).slice(0, 200),
          price: Math.round(p.price * 100) / 100,
          originalPrice: typeof p.originalPrice === "number" && p.originalPrice > p.price
            ? Math.round(p.originalPrice * 100) / 100 : null,
          currency: "BDT",
          store: String(p.store || new URL(cleanedUrl).hostname.replace(/^www\./, "")).slice(0, 100),
          url: cleanedUrl,
          snippet: String(p.snippet || "").slice(0, 300),
          condition: p.condition === "used" ? "used" : "new",
        });
      }
    }

    // STEP 7: Filter accessories and irrelevant prices using smart clustering
    let validProducts = Array.from(mergedMap.values());

    // Remove obvious accessories by name
    validProducts = validProducts.filter((p) => !isLikelyAccessory(p.name, p.snippet));

    // Smart price filtering: remove outliers that are likely accessories
    if (validProducts.length > 3) {
      const prices = validProducts.map((p) => p.price).sort((a, b) => a - b);

      // Calculate price clusters using a simple approach:
      // Find the median, then remove anything below 30% of median
      const medianPrice = prices[Math.floor(prices.length / 2)];

      // More aggressive: use the 25th percentile as the lower bound
      const p25 = prices[Math.floor(prices.length * 0.25)];

      // The minimum acceptable price is 30% of the 25th percentile price
      // This ensures we don't remove legitimate but cheaper products
      // but we do remove obvious accessories (which are usually < 10% of the product price)
      const minAcceptablePrice = p25 * 0.3;

      validProducts = validProducts.filter((p) => p.price >= minAcceptablePrice);
    }

    // STEP 8: Apply condition filter
    if (conditionFilter !== "all") {
      validProducts = validProducts.filter((p) => p.condition === conditionFilter);
    }

    // Sort by price ascending (lowest first)
    validProducts.sort((a, b) => a.price - b.price);

    // CACHE: Store results
    searchCache.set(cacheKey, { data: validProducts, expiresAt: Date.now() + CACHE_TTL });

    // SECURITY: Add headers to response
    return NextResponse.json(
      { products: validProducts, query: sanitizedQuery, totalResults: validProducts.length, conditionFilter },
      {
        headers: {
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Something went wrong while searching. Please try again." },
      { status: 500 }
    );
  }
}
