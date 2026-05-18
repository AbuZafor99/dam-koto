import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

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

// Domains to completely exclude from results
const BLOCKED_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "m.youtube.com",
  "facebook.com",
  "fb.com",
  "m.facebook.com",
  "instagram.com",
  "twitter.com",
  "tiktok.com",
  "pinterest.com",
  "reddit.com",
  "quora.com",
  "linkedin.com",
  "wikipedia.org",
  "medium.com",
  "daraz.com.bd",
  "daraz.com",
  "daraz.pk",
  "daraz.lk",
  "daraz.com.np",
  "bikroy.com",
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

function generateSearchQueries(product: string): string[] {
  const q = product.trim();
  return [
    `${q} price in Bangladesh buy`,
    `${q} startech ryans best price BD`,
  ];
}

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

function detectCondition(
  name: string,
  snippet: string
): "new" | "used" {
  const text = `${name} ${snippet}`.toLowerCase();
  const usedKeywords = [
    "used",
    "second hand",
    "pre-owned",
    "refurbished",
    "open box",
    "sold",
    "[sold]",
    "almost new",
    "like new",
    "condition:",
    "slightly used",
    "hand used",
    "old",
    "exchange",
    "trade",
    "resale",
  ];
  const newKeywords = [
    "brand new",
    "new arrival",
    "latest",
    "official",
    "warranty",
    "original",
    "sealed",
    "brand new condition",
    "100% new",
  ];

  // Check for new keywords first (stronger signal)
  for (const kw of newKeywords) {
    if (text.includes(kw)) return "new";
  }

  // Check for used keywords
  for (const kw of usedKeywords) {
    if (text.includes(kw)) return "used";
  }

  // Default to new (most search results are for new products)
  return "new";
}

function extractOfferPriceFromText(text: string): {
  price: number | null;
  originalPrice: number | null;
} {
  // Patterns that indicate offer/sale price (the CURRENT price customer pays)
  // These patterns specifically look for "was X now Y" or "X → Y" formats
  const offerPatterns = [
    // "৳53,990৳72,990" (Daraz format: offer price then original)
    /৳\s*([\d,]+(?:\.\d{1,2})?)\s*৳\s*([\d,]+(?:\.\d{1,2})?)/,
    // "Current price is: ৳75,500" ... "Original price was: ৳83,900"
    /current\s+price\s+(?:is\s*:?\s*)?৳?\s*([\d,]+(?:\.\d{1,2})?)/i,
    // "now ৳75,500" or "now BDT 75,500"
    /now\s+(?:৳|BDT|Tk\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    // "was ৳83,900" ... after "now" or "current"
    /original\s+price\s+(?:was\s*:?\s*)?৳?\s*([\d,]+(?:\.\d{1,2})?)/i,
    // "Save ৳X" or "Off ৳X" patterns
    /(\d+)%\s*off/i,
  ];

  // Try to find offer price first
  // Pattern 1: "৳53,990৳72,990" - offer first, original second
  const darazFormat = text.match(
    /৳\s*([\d,]+(?:\.\d{1,2})?)\s*৳\s*([\d,]+(?:\.\d{1,2})?)/
  );
  if (darazFormat) {
    const first = parseFloat(darazFormat[1].replace(/,/g, ""));
    const second = parseFloat(darazFormat[2].replace(/,/g, ""));
    if (first > 100 && second > 100 && first !== second) {
      // The smaller one is the offer price
      const offerPrice = Math.min(first, second);
      const originalPrice = Math.max(first, second);
      return { price: offerPrice, originalPrice };
    }
  }

  // Pattern 2: "Current price is ৳75,500 ... Original price was ৳83,900"
  const currentPriceMatch = text.match(
    /current\s+price\s+(?:is\s*:?\s*)?(?:৳|BDT|Tk\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i
  );
  const originalPriceMatch = text.match(
    /original\s+price\s+(?:was\s*:?\s*)?(?:৳|BDT|Tk\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (currentPriceMatch && originalPriceMatch) {
    const current = parseFloat(currentPriceMatch[1].replace(/,/g, ""));
    const original = parseFloat(originalPriceMatch[1].replace(/,/g, ""));
    if (current > 100 && original > 100) {
      return {
        price: Math.min(current, original),
        originalPrice: Math.max(current, original),
      };
    }
  }

  // Pattern 3: "now ৳X" / "was ৳Y"
  const nowPriceMatch = text.match(
    /now\s+(?:৳|BDT|Tk\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i
  );
  const wasPriceMatch = text.match(
    /was\s+(?:৳|BDT|Tk\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (nowPriceMatch && wasPriceMatch) {
    const now = parseFloat(nowPriceMatch[1].replace(/,/g, ""));
    const was = parseFloat(wasPriceMatch[1].replace(/,/g, ""));
    if (now > 100 && was > 100) {
      return { price: Math.min(now, was), originalPrice: Math.max(now, was) };
    }
  }

  // Pattern 4: "starts from BDT 46,500" - use the starting price
  const startsFromMatch = text.match(
    /starts?\s+from\s+(?:৳|BDT|Tk\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (startsFromMatch) {
    const p = parseFloat(startsFromMatch[1].replace(/,/g, ""));
    if (p > 100) return { price: p, originalPrice: null };
  }

  return { price: null, originalPrice: null };
}

function extractPricesFromSnippets(
  results: { name: string; snippet: string; url: string; host_name: string }[]
): ProductResult[] {
  const products: ProductResult[] = [];

  for (const r of results) {
    const text = `${r.name} ${r.snippet}`;

    // First try offer price extraction (smarter)
    const offerResult = extractOfferPriceFromText(text);
    let price: number | null = offerResult.price;
    let originalPrice: number | null = offerResult.originalPrice;

    // Fallback: basic price patterns if offer extraction didn't find anything
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
        originalPrice:
          originalPrice !== null
            ? Math.round(originalPrice * 100) / 100
            : null,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query;
    const conditionFilter = body.condition || "all"; // "all", "new", "used"

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide a product name to search." },
        { status: 400 }
      );
    }

    const sanitizedQuery = query.trim().slice(0, 200);

    const zai = await ZAI.create();

    // STEP 1: Fire search queries for broader coverage
    const searchQueries = generateSearchQueries(sanitizedQuery);
    let allResults: {
      name: string;
      snippet: string;
      url: string;
      host_name: string;
    }[] = [];

    for (const sq of searchQueries) {
      try {
        const resp = await zai.functions.invoke("web_search", {
          query: sq,
          num: 10,
        });
        if (Array.isArray(resp)) {
          allResults.push(...resp);
        }
      } catch (e) {
        console.error("Search query failed:", sq, e);
      }
    }

    // Filter out blocked domains (YouTube, Facebook, etc.)
    allResults = allResults.filter((r) => !isBlockedDomain(r.url));

    allResults = deduplicateResults(allResults);

    if (allResults.length === 0) {
      return NextResponse.json({
        products: [],
        query: sanitizedQuery,
        totalResults: 0,
        message: `No results found for "${sanitizedQuery}". Try a more specific product name.`,
      });
    }

    // STEP 2: Fast regex-based price extraction (instant, no LLM needed)
    const queryWords = sanitizedQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const relevantResults = allResults.filter((r) => {
      const text = `${r.name} ${r.snippet}`.toLowerCase();
      return queryWords.some((w) => text.includes(w));
    });
    const quickProducts = extractPricesFromSnippets(
      relevantResults.length > 0 ? relevantResults : allResults
    );

    // STEP 3: Run LLM extraction for deeper analysis
    const resultsWithoutPrices = allResults.filter(
      (r) => !quickProducts.some((qp) => qp.url === r.url)
    );

    let llmProducts: ProductResult[] = [];

    if (resultsWithoutPrices.length > 0 || quickProducts.length < 3) {
      try {
        const resultsToSend =
          quickProducts.length < 3 ? allResults : resultsWithoutPrices;

        const searchContext = resultsToSend
          .slice(0, 12)
          .map(
            (
              r: {
                name: string;
                snippet: string;
                url: string;
                host_name: string;
              },
              i: number
            ) =>
              `[${i + 1}] Title: ${r.name}\nSnippet: ${r.snippet}\nURL: ${r.url}\nSource: ${r.host_name}`
          )
          .join("\n\n");

        const extractionPrompt = `Extract product listings with prices from these search results for the query "${sanitizedQuery}".

CRITICAL RULES:
1. ONLY include products that are relevant to the query "${sanitizedQuery}". Skip unrelated products.
2. ONLY include products available in Bangladesh (BDT currency). Skip results from Myanmar, Nepal, India, Pakistan or other countries.
3. DO NOT include results from Daraz, Facebook Marketplace, Bikroy, YouTube, or social media sites.
4. ALWAYS prefer the OFFER/SALE/DISCOUNT price over the original price. If both "was X now Y" or "original X, current Y" are shown, use the LOWER/OFFER price as "price" and the HIGHER/ORIGINAL price as "originalPrice".
5. Look for ANY price format - BDT, ৳, Tk, taka, or even USD/INR (convert: 1 USD ≈ 110 BDT, 1 INR ≈ 1.3 BDT).
6. If a price range is given (e.g. "BDT 46,500 to BDT 164,000"), use the lower value as price and the higher as originalPrice.
7. Determine condition: "new" if brand new/sealed/warranty, "used" if second hand/refurbished/sold/pre-owned/old.
8. Each result: {"name":"product name","price":offer_price_in_BDT,"originalPrice":original_price_in_BDT_or_null,"currency":"BDT","store":"store name","url":"full url","snippet":"brief desc","condition":"new" or "used"}
9. Remove commas from numbers. Skip only if absolutely no price can be inferred.
10. Deduplicate - if same store appears twice, keep the more specific result.
11. Return ONLY a JSON array. Sort by price ascending.

Results:
${searchContext}`;

        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "Output only a valid JSON array of product objects. No markdown, no explanation, just the array.",
            },
            { role: "user", content: extractionPrompt },
          ],
          temperature: 0.1,
          max_tokens: 2500,
        });

        const responseText =
          completion.choices?.[0]?.message?.content || "[]";
        let cleanResponse = responseText.trim();
        if (cleanResponse.startsWith("```")) {
          cleanResponse = cleanResponse
            .replace(/^```(?:json)?\n?/, "")
            .replace(/\n?```$/, "");
        }

        try {
          const parsed = JSON.parse(cleanResponse);
          if (Array.isArray(parsed)) llmProducts = parsed;
        } catch {
          const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              llmProducts = JSON.parse(jsonMatch[0]);
            } catch {
              llmProducts = [];
            }
          }
        }
      } catch (e) {
        console.error("LLM extraction failed:", e);
      }
    }

    // STEP 4: Merge regex + LLM results, deduplicate by URL
    const mergedMap = new Map<string, ProductResult>();

    for (const p of quickProducts) {
      mergedMap.set(p.url.toLowerCase(), p);
    }

    for (const p of llmProducts) {
      if (!p.name || typeof p.price !== "number" || p.price <= 0 || !p.url)
        continue;
      const key = p.url.toLowerCase();
      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          name: String(p.name).slice(0, 200),
          price: Math.round(p.price * 100) / 100,
          originalPrice:
            typeof p.originalPrice === "number" && p.originalPrice > p.price
              ? Math.round(p.originalPrice * 100) / 100
              : null,
          currency: "BDT",
          store: String(p.store || "Online Store").slice(0, 100),
          url: p.url,
          snippet: String(p.snippet || "").slice(0, 300),
          condition: p.condition === "used" ? "used" : "new",
        });
      }
    }

    // STEP 5: Filter out likely accessories (very low prices compared to median)
    let validProducts = Array.from(mergedMap.values());

    if (validProducts.length > 3) {
      const prices = validProducts
        .map((p) => p.price)
        .sort((a, b) => a - b);
      const medianPrice = prices[Math.floor(prices.length / 2)];
      const minReasonablePrice = medianPrice * 0.1;
      validProducts = validProducts.filter(
        (p) => p.price >= minReasonablePrice
      );
    }

    // STEP 6: Apply condition filter
    if (conditionFilter !== "all") {
      validProducts = validProducts.filter(
        (p) => p.condition === conditionFilter
      );
    }

    validProducts.sort((a, b) => a.price - b.price);

    return NextResponse.json({
      products: validProducts,
      query: sanitizedQuery,
      totalResults: validProducts.length,
      conditionFilter,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Something went wrong while searching. Please try again." },
      { status: 500 }
    );
  }
}
