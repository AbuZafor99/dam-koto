"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ExternalLink,
  TrendingDown,
  ShoppingCart,
  Star,
  RefreshCw,
  Globe,
  Zap,
  Clock,
  X,
  Sparkles,
  Store,
  Filter,
  Package,
  PackageCheck,
  Tag,
} from "lucide-react";

type ConditionFilter = "all" | "new" | "used";

interface ProductResult {
  name: string;
  price: number;
  originalPrice: number | null;
  currency: string;
  store: string;
  url: string;
  snippet: string;
  condition: "new" | "used";
}

interface SearchResponse {
  products: ProductResult[];
  query: string;
  totalResults: number;
  conditionFilter?: string;
  message?: string;
  error?: string;
}

const POPULAR_SEARCHES = [
  "Samsung Galaxy S24",
  "iPad Air M1",
  "iPhone 15",
  "Laptop under 50000",
  "Sony WH-1000XM5",
  "Xiaomi Redmi Note 13",
  "Walton AC 1.5 ton",
  "LG TV 43 inch",
  "Realme C67",
  "MacBook Air M2",
];

const SEARCH_SUGGESTIONS = [
  "iPad Air M1",
  "iPad Pro M4",
  "iPhone 16 Pro Max",
  "Samsung Galaxy S25 Ultra",
  "OnePlus 12",
  "MacBook Air M3",
  "ASUS ROG Laptop",
  "Sony WH-1000XM5",
  "Apple Watch Ultra",
  "AirPods Pro 2",
  "Canon EOS R50",
  "DJI Mini 4 Pro",
  "PS5 Slim",
  "Nintendo Switch OLED",
  "Walton Washing Machine",
  "Dell Monitor 27 inch",
  "Logitech MX Master 3S",
  "Razer DeathAdder V3",
];

function formatPrice(price: number): string {
  return price.toLocaleString("en-BD");
}

function getPriceColor(index: number, total: number): string {
  if (index === 0) return "text-emerald-600";
  if (index === total - 1 && total > 1) return "text-red-500";
  return "text-foreground";
}

function getRankBadge(index: number) {
  if (index === 0)
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100 text-[11px]">
        <Star className="w-3 h-3 mr-0.5" /> Best Price
      </Badge>
    );
  if (index === 1)
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 text-[11px]">
        2nd Best
      </Badge>
    );
  if (index === 2)
    return (
      <Badge className="bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-100 text-[11px]">
        3rd Best
      </Badge>
    );
  return null;
}

function getStoreIcon(store: string): string {
  const lower = store.toLowerCase();
  if (lower.includes("startech")) return "💻";
  if (lower.includes("ryans")) return "🖥️";
  if (lower.includes("rokomari")) return "📚";
  if (lower.includes("pickaboo")) return "🎯";
  if (lower.includes("gadget")) return "📱";
  if (lower.includes("walton")) return "🏭";
  if (lower.includes("apple")) return "🍎";
  if (lower.includes("samsung")) return "📱";
  if (lower.includes("istock")) return "📦";
  if (lower.includes("dazzle")) return "✨";
  if (lower.includes("aiman")) return "🏪";
  if (lower.includes("hns")) return "🔧";
  return "🏪";
}

function getStoreColor(store: string): string {
  const lower = store.toLowerCase();
  if (lower.includes("startech")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (lower.includes("ryans")) return "bg-purple-50 text-purple-700 border-purple-200";
  if (lower.includes("rokomari")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (lower.includes("pickaboo")) return "bg-orange-50 text-orange-700 border-orange-200";
  if (lower.includes("applegadgets")) return "bg-gray-50 text-gray-700 border-gray-300";
  if (lower.includes("istock")) return "bg-sky-50 text-sky-700 border-sky-200";
  if (lower.includes("dazzle")) return "bg-pink-50 text-pink-700 border-pink-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

const PROGRESS_STEPS = [
  { label: "Searching Google...", icon: Globe },
  { label: "Scanning Bangladeshi stores...", icon: Store },
  { label: "Extracting offer prices...", icon: Tag },
  { label: "Ranking by best price...", icon: TrendingDown },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [allResults, setAllResults] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number>(0);
  const [currentQuery, setCurrentQuery] = useState("");
  const [progressStep, setProgressStep] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Apply client-side condition filter
  const results = conditionFilter === "all"
    ? allResults
    : allResults.filter((r) => r.condition === conditionFilter);

  // Progress animation during search
  useEffect(() => {
    if (!loading) return;
    setProgressStep(0);
    const interval = setInterval(() => {
      setProgressStep((prev) => {
        if (prev < PROGRESS_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  // Search suggestions filter
  useEffect(() => {
    if (query.trim().length > 0) {
      const filtered = SEARCH_SUGGESTIONS.filter((s) =>
        s.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions([]);
    }
  }, [query]);

  // Click outside to close suggestions
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = useCallback(
    async (searchQuery?: string) => {
      const q = searchQuery || query;
      if (!q.trim()) return;

      setQuery(q);
      setShowSuggestions(false);
      setConditionFilter("all");
      setLoading(true);
      setSearched(true);
      setError(null);
      setAllResults([]);
      setCurrentQuery(q);
      const startTime = Date.now();

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, condition: "all" }),
        });

        const data: SearchResponse = await res.json();
        setSearchTime(Date.now() - startTime);

        if (data.error) {
          setError(data.error);
          setAllResults([]);
        } else if (data.products.length === 0) {
          setError(
            data.message ||
              `No prices found for "${q}". Try a more specific product name.`
          );
          setAllResults([]);
        } else {
          setAllResults(data.products);
        }
      } catch {
        setError("Network error. Please check your connection and try again.");
        setAllResults([]);
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setShowSuggestions(false);
      handleSearch();
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setSearched(false);
    setAllResults([]);
    setError(null);
    setCurrentQuery("");
    setConditionFilter("all");
    inputRef.current?.focus();
  };

  const newCount = allResults.filter((r) => r.condition === "new").length;
  const usedCount = allResults.filter((r) => r.condition === "used").length;

  const lowestPrice = results.length > 0 ? results[0].price : 0;
  const highestPrice =
    results.length > 0 ? results[results.length - 1].price : 0;
  const savings = highestPrice - lowestPrice;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={clearSearch}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-600 to-red-500 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-bold leading-tight text-foreground">
                PriceBD
              </h1>
              <p className="text-[10px] text-muted-foreground leading-none">
                Compare & Save
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Globe className="w-3.5 h-3.5" />
            <span>Bangladesh</span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section
          className={`relative overflow-hidden transition-all duration-500 ${
            searched ? "py-6 md:py-8" : "py-14 md:py-20"
          }`}
        >
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-72 h-72 bg-green-100 rounded-full blur-3xl opacity-40" />
            <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-red-100 rounded-full blur-3xl opacity-30" />
          </div>

          <div className="max-w-3xl mx-auto px-4 text-center">
            {!searched && (
              <div className="mb-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 text-sm text-green-800">
                  <Zap className="w-4 h-4" />
                  Smart price comparison for Bangladesh
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                  Find the{" "}
                  <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                    Best Price
                  </span>
                  <br />
                  Across All Stores
                </h2>
                <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                  Search any product and we scan multiple Bangladeshi stores
                  instantly. Always showing offer prices. Save money on every purchase.
                </p>
              </div>
            )}

            {searched && !loading && (
              <div className="mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-foreground">
                  {allResults.length > 0
                    ? "Prices for"
                    : "Searching for"}{" "}
                  <span className="text-green-600">
                    &ldquo;{currentQuery}&rdquo;
                  </span>
                </h2>
                {allResults.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Found {allResults.length} prices across{" "}
                    {new Set(allResults.map((r) => r.store)).size} store
                    {new Set(allResults.map((r) => r.store)).size > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Search any product... e.g. iPad Air M1, Samsung Galaxy S24"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    className="pl-11 pr-10 h-12 md:h-14 text-base rounded-xl border-2 border-green-200 focus:border-green-500 shadow-lg shadow-green-500/10"
                  />
                  {query && !loading && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* Autocomplete */}
                  {showSuggestions && filteredSuggestions.length > 0 && !loading && (
                    <div
                      ref={suggestionsRef}
                      className="absolute top-full mt-1 left-0 right-0 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      {filteredSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            setQuery(suggestion);
                            setShowSuggestions(false);
                            handleSearch(suggestion);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 transition-colors flex items-center gap-2"
                        >
                          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => handleSearch()}
                  disabled={loading || !query.trim()}
                  className="h-12 md:h-14 px-6 md:px-8 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg shadow-green-600/25 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-5 h-5 md:mr-2" />
                      <span className="hidden md:inline">Search</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Popular searches */}
            {!searched && (
              <div className="mt-6 space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <p className="text-sm text-muted-foreground">Try searching:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {POPULAR_SEARCHES.map((term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setQuery(term);
                        handleSearch(term);
                      }}
                      className="px-3 py-1.5 text-sm bg-white border border-border rounded-full hover:border-green-400 hover:bg-green-50 transition-colors text-muted-foreground hover:text-green-700"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Results Section */}
        <section className="max-w-6xl mx-auto px-4 pb-16">
          {/* Loading State */}
          {loading && (
            <div className="space-y-5">
              <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <Sparkles className="w-5 h-5 text-green-600 animate-pulse" />
                  <span className="text-sm font-medium text-foreground">
                    Searching for &ldquo;{currentQuery}&rdquo;
                  </span>
                </div>
                <div className="space-y-2">
                  {PROGRESS_STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = i === progressStep;
                    const isDone = i < progressStep;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                          isActive
                            ? "text-green-700 font-medium"
                            : isDone
                            ? "text-emerald-600"
                            : "text-muted-foreground/50"
                        }`}
                      >
                        {isActive ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : isDone ? (
                          <span className="text-emerald-500">✓</span>
                        ) : (
                          <span className="text-muted-foreground/30">○</span>
                        )}
                        <Icon className="w-3.5 h-3.5" />
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 w-full bg-green-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${((progressStep + 1) / PROGRESS_STEPS.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-4 md:p-5">
                    <div className="flex gap-4">
                      <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Prices Found
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto text-sm">
                {error}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <p className="w-full text-xs text-muted-foreground mb-2">Try one of these:</p>
                {["iPad Air M1", "Samsung Galaxy S24", "iPhone 15", "MacBook Air M2"].map(
                  (term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setQuery(term);
                        handleSearch(term);
                      }}
                      className="px-3 py-1.5 text-sm bg-white border border-border rounded-full hover:border-green-400 hover:bg-green-50 transition-colors text-muted-foreground hover:text-green-700"
                    >
                      {term}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && results.length > 0 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-500">
              {/* Stats Bar + Filter */}
              <div className="space-y-3">
                {/* Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        Results
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {results.length}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-green-200" />
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        Lowest
                      </p>
                      <p className="text-xl font-bold text-emerald-600">
                        ৳{formatPrice(lowestPrice)}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-green-200" />
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        Highest
                      </p>
                      <p className="text-xl font-bold text-red-500">
                        ৳{formatPrice(highestPrice)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {((searchTime / 1000) || 0).toFixed(1)}s
                  </div>
                </div>

                {/* Condition Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-medium">Filter:</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setConditionFilter("all")}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-all font-medium ${
                        conditionFilter === "all"
                          ? "bg-green-600 text-white border-green-600 shadow-sm"
                          : "bg-white text-muted-foreground border-border hover:border-green-300 hover:text-green-700"
                      }`}
                    >
                      All ({allResults.length})
                    </button>
                    <button
                      onClick={() => setConditionFilter("new")}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-all font-medium flex items-center gap-1 ${
                        conditionFilter === "new"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-white text-muted-foreground border-border hover:border-emerald-300 hover:text-emerald-700"
                      }`}
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      New ({newCount})
                    </button>
                    <button
                      onClick={() => setConditionFilter("used")}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-all font-medium flex items-center gap-1 ${
                        conditionFilter === "used"
                          ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                          : "bg-white text-muted-foreground border-border hover:border-amber-300 hover:text-amber-700"
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      Used ({usedCount})
                    </button>
                  </div>
                </div>

                {/* Savings callout */}
                {results.length > 1 && savings > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2 text-sm">
                    <Zap className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-emerald-800">
                      You could save up to{" "}
                      <strong className="text-emerald-900">৳{formatPrice(savings)}</strong>{" "}
                      by choosing the best price!
                    </span>
                  </div>
                )}
              </div>

              {/* Product Cards */}
              <div className="space-y-2.5">
                {results.map((product, index) => (
                  <a
                    key={product.url + index}
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <Card
                      className={`overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-green-300 border-2 group-hover:translate-y-[-1px] ${
                        index === 0
                          ? "border-emerald-200 bg-emerald-50/30"
                          : ""
                      }`}
                    >
                      <CardContent className="p-4 md:p-5">
                        <div className="flex items-start gap-3 md:gap-4">
                          {/* Rank */}
                          <div className="flex flex-col items-center gap-1 flex-shrink-0">
                            <div
                              className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-base md:text-lg ${
                                index === 0
                                  ? "bg-emerald-100 ring-2 ring-emerald-300"
                                  : index === 1
                                  ? "bg-amber-50"
                                  : index === 2
                                  ? "bg-orange-50"
                                  : "bg-muted"
                              }`}
                            >
                              {getStoreIcon(product.store)}
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground">
                              #{index + 1}
                            </span>
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground group-hover:text-green-700 transition-colors line-clamp-2 text-sm md:text-base">
                                  {product.name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  <Badge
                                    variant="outline"
                                    className={`text-[11px] font-normal ${getStoreColor(product.store)}`}
                                  >
                                    <ShoppingCart className="w-3 h-3 mr-0.5" />
                                    {product.store}
                                  </Badge>
                                  {getRankBadge(index)}
                                  {product.condition === "used" ? (
                                    <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[11px]">
                                      <Package className="w-3 h-3 mr-0.5" />
                                      Used
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                                      <PackageCheck className="w-3 h-3 mr-0.5" />
                                      New
                                    </Badge>
                                  )}
                                </div>
                                {product.snippet && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                    {product.snippet}
                                  </p>
                                )}
                              </div>

                              {/* Price */}
                              <div className="flex items-center gap-2 flex-shrink-0 sm:ml-4">
                                <div className="text-right">
                                  {/* Offer price (main) */}
                                  <p
                                    className={`text-lg md:text-xl font-bold ${getPriceColor(index, results.length)}`}
                                  >
                                    ৳{formatPrice(product.price)}
                                  </p>
                                  {/* Original price (strikethrough) */}
                                  {product.originalPrice && product.originalPrice > product.price && (
                                    <p className="text-[11px] text-muted-foreground line-through">
                                      ৳{formatPrice(product.originalPrice)}
                                    </p>
                                  )}
                                  {/* Price difference */}
                                  {index > 0 && lowestPrice > 0 && (
                                    <p className="text-[11px] text-red-400">
                                      +৳{formatPrice(product.price - lowestPrice)} more
                                    </p>
                                  )}
                                  {/* Discount percentage */}
                                  {product.originalPrice && product.originalPrice > product.price && (
                                    <p className="text-[11px] text-emerald-600 font-semibold">
                                      {Math.round(
                                        ((product.originalPrice - product.price) /
                                          product.originalPrice) *
                                          100
                                      )}
                                      % off
                                    </p>
                                  )}
                                </div>
                                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-green-600 transition-colors flex-shrink-0" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                ))}
              </div>

              {/* Footer info */}
              <div className="text-center text-xs text-muted-foreground pt-3 space-y-1">
                <p>
                  Showing offer/sale prices when available. Original prices shown with strikethrough.
                </p>
                <p>
                  Click on a product to visit the store for the latest price and availability.
                </p>
              </div>
            </div>
          )}

          {/* No results after filter */}
          {!loading && allResults.length > 0 && results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">
                No {conditionFilter} products found for &ldquo;{currentQuery}&rdquo;.
                Try switching to a different filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConditionFilter("all")}
                className="mt-3"
              >
                Show All Products
              </Button>
            </div>
          )}

          {/* Empty initial state */}
          {!searched && !loading && (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">
                Search for a product to compare prices across Bangladeshi stores
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-green-600 to-red-500 flex items-center justify-center">
              <TrendingDown className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-foreground">PriceBD</span>
            <span>— Smart Price Comparison for Bangladesh</span>
          </div>
          <p>Prices sourced from online stores. Always verify on the retailer&apos;s site.</p>
        </div>
      </footer>
    </div>
  );
}
