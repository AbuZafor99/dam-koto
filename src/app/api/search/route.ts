import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export interface ProductResult {
  name: string;
  price: number;
  currency: string;
  store: string;
  url: string;
  snippet: string;
}

function generateSearchQueries(product: string): string[] {
  const q = product.trim();
  return [
    `${q} price in Bangladesh buy`,
    `${q} daraz startech best price BD`,
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

function extractPricesFromSnippets(
  results: { name: string; snippet: string; url: string; host_name: string }[]
): ProductResult[] {
  const products: ProductResult[] = [];

  for (const r of results) {
    const text = `${r.name} ${r.snippet}`;
    // Match various price patterns: ৳25,000 | ৳25000 | BDT 25,000 | 25,000 BDT | 25,000 taka | Tk 25,000 | Tk. 25,000
    const pricePatterns = [
      /৳\s*([\d,]+(?:\.\d{1,2})?)/i,
      /BDT\s*([\d,]+(?:\.\d{1,2})?)/i,
      /([\d,]+(?:\.\d{1,2})?)\s*BDT/i,
      /([\d,]+(?:\.\d{1,2})?)\s*taka/i,
      /Tk\.?\s*([\d,]+(?:\.\d{1,2})?)/i,
      /price[:\s]*([\d,]+(?:\.\d{1,2})?)/i,
      /([\d,]+(?:\.\d{1,2})?)\s*৳/i,
    ];

    let price: number | null = null;
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

    if (price !== null) {
      let name = r.name
        .replace(/\s*[-|–—]\s*.*/,"")
        .replace(/\s*price.*$/i, "")
        .replace(/\s*buy.*$/i, "")
        .replace(/\s*online.*$/i, "")
        .replace(/\s*BD\s*\d+.*$/i, "")
        .trim();
      if (name.length < 5) name = r.name.slice(0, 120);

      products.push({
        name: name.slice(0, 200),
        price: Math.round(price * 100) / 100,
        currency: "BDT",
        store: r.host_name.replace(/^www\./, ""),
        url: r.url,
        snippet: r.snippet.slice(0, 300),
      });
    }
  }

  return products;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide a product name to search." },
        { status: 400 }
      );
    }

    const sanitizedQuery = query.trim().slice(0, 200);

    const zai = await ZAI.create();

    // STEP 1: Fire 2 search queries for broader coverage
    const searchQueries = generateSearchQueries(sanitizedQuery);
    let allResults: {
      name: string;
      snippet: string;
      url: string;
      host_name: string;
    }[] = [];

    // Search sequentially to avoid 429 rate limits
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
        // Continue with results from other queries
      }
    }

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
    // Filter out obviously unrelated results first
    const queryWords = sanitizedQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const relevantResults = allResults.filter((r) => {
      const text = `${r.name} ${r.snippet}`.toLowerCase();
      // At least one significant query word should appear
      return queryWords.some((w) => text.includes(w));
    });
    const quickProducts = extractPricesFromSnippets(
      relevantResults.length > 0 ? relevantResults : allResults
    );

    // STEP 3: Run LLM extraction for deeper analysis
    // Only send results that regex couldn't extract prices from
    const resultsWithoutPrices = allResults.filter(
      (r) => !quickProducts.some((qp) => qp.url === r.url)
    );

    let llmProducts: ProductResult[] = [];

    if (resultsWithoutPrices.length > 0 || quickProducts.length < 3) {
      try {
        // If we have very few regex results, send ALL results to LLM for deeper extraction
        const resultsToSend =
          quickProducts.length < 3 ? allResults : resultsWithoutPrices;

        const searchContext = resultsToSend
          .slice(0, 12)
          .map(
            (
              r: { name: string; snippet: string; url: string; host_name: string },
              i: number
            ) =>
              `[${i + 1}] Title: ${r.name}\nSnippet: ${r.snippet}\nURL: ${r.url}\nSource: ${r.host_name}`
          )
          .join("\n\n");

        const extractionPrompt = `Extract product listings with prices from these search results for the query "${sanitizedQuery}".

CRITICAL RULES:
1. ONLY include products that are relevant to the query "${sanitizedQuery}". Skip unrelated products (e.g. if query is "iPad Air M1", skip MacBook, iPhone, accessories, etc.).
2. ONLY include products available in Bangladesh (BDT currency). Skip results from Myanmar, Nepal, India, Pakistan or other countries.
3. Look for ANY price format - BDT, ৳, Tk, taka, or even USD/INR (convert: 1 USD ≈ 110 BDT, 1 INR ≈ 1.3 BDT).
4. If a price range is given, use the lower value.
5. Each result: {"name":"product name","price":number_in_BDT,"currency":"BDT","store":"store name","url":"full url","snippet":"brief desc"}
6. Remove commas from numbers. Skip only if absolutely no price can be inferred.
7. Deduplicate - if same store appears twice, keep the more specific result.
8. Return ONLY a JSON array. Sort by price ascending.

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
          currency: "BDT",
          store: String(p.store || "Online Store").slice(0, 100),
          url: p.url,
          snippet: String(p.snippet || "").slice(0, 300),
        });
      }
    }

    // STEP 5: Filter out likely accessories (very low prices compared to median)
    let validProducts = Array.from(mergedMap.values());

    if (validProducts.length > 3) {
      const prices = validProducts.map((p) => p.price).sort((a, b) => a - b);
      const medianPrice = prices[Math.floor(prices.length / 2)];
      // Remove products priced below 10% of median (likely accessories/cases)
      const minReasonablePrice = medianPrice * 0.1;
      validProducts = validProducts.filter((p) => p.price >= minReasonablePrice);
    }

    validProducts.sort((a, b) => a.price - b.price);

    return NextResponse.json({
      products: validProducts,
      query: sanitizedQuery,
      totalResults: validProducts.length,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Something went wrong while searching. Please try again." },
      { status: 500 }
    );
  }
}
