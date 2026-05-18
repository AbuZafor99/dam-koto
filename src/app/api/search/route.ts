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

    // Search for the product with Bangladesh context
    const searchQuery = `${sanitizedQuery} price in Bangladesh buy`;

    const searchResults = await zai.functions.invoke("web_search", {
      query: searchQuery,
      num: 15,
    });

    if (
      !searchResults ||
      !Array.isArray(searchResults) ||
      searchResults.length === 0
    ) {
      return NextResponse.json({
        products: [],
        message: "No results found. Try a different product name.",
      });
    }

    // Use LLM to extract structured product data from search results
    const searchContext = searchResults
      .map(
        (r: { name: string; snippet: string; url: string; host_name: string }, i: number) =>
          `[${i + 1}] Title: ${r.name}\nSnippet: ${r.snippet}\nURL: ${r.url}\nSource: ${r.host_name}`
      )
      .join("\n\n");

    const extractionPrompt = `You are a product price extraction assistant for Bangladesh e-commerce. Given web search results, extract product listings with their prices.

IMPORTANT RULES:
1. Extract ONLY products that have a clearly stated price in Bangladeshi Taka (BDT/৳) or that can reasonably be associated with Bangladesh pricing.
2. Each product must have: name, price (numeric value in BDT), store/website name, and the URL.
3. If the price is in a range, use the lower value.
4. Remove commas from price numbers (e.g., "25,000" → 25000).
5. If no clear price is mentioned for a result, skip it.
6. Deduplicate similar products from the same store.
7. Return a JSON array of objects with keys: "name", "price", "currency", "store", "url", "snippet"
8. The snippet should be a brief 1-line description of the product.
9. Sort results by price ascending (lowest first).
10. Return ONLY the JSON array, no other text.

Search Results:
${searchContext}

Extract product listings with prices as JSON array:`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a precise data extraction assistant. You only output valid JSON arrays. No markdown, no explanation, just the JSON array.",
        },
        {
          role: "user",
          content: extractionPrompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const responseText = completion.choices?.[0]?.message?.content || "[]";

    // Parse the LLM response - handle potential markdown code blocks
    let cleanResponse = responseText.trim();
    if (cleanResponse.startsWith("```")) {
      cleanResponse = cleanResponse
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
    }

    let products: ProductResult[];
    try {
      products = JSON.parse(cleanResponse);
    } catch {
      // If parsing fails, try to extract JSON array from the response
      const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          products = JSON.parse(jsonMatch[0]);
        } catch {
          products = [];
        }
      } else {
        products = [];
      }
    }

    // Validate and clean up products
    const validProducts = products
      .filter(
        (p: ProductResult) =>
          p.name &&
          typeof p.price === "number" &&
          p.price > 0 &&
          p.url
      )
      .map((p: ProductResult) => ({
        name: String(p.name).slice(0, 200),
        price: Math.round(p.price * 100) / 100,
        currency: p.currency || "BDT",
        store: String(p.store || new URL(p.url).hostname).slice(0, 100),
        url: p.url,
        snippet: String(p.snippet || "").slice(0, 300),
      }))
      .sort((a: ProductResult, b: ProductResult) => a.price - b.price);

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
