"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Shield,
  ArrowUpRight,
  BadgePercent,
  CircleDot,
  ChevronRight,
  Flame,
  CheckCircle2,
  ArrowRight,
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
  cached?: boolean;
  message?: string;
  error?: string;
}

const POPULAR_SEARCHES = [
  "Samsung Galaxy S24", "iPad Air M1", "iPhone 15",
  "Laptop under 50000", "Sony WH-1000XM5",
  "Xiaomi Redmi Note 13", "Walton AC 1.5 ton", "MacBook Air M2",
];

const SEARCH_SUGGESTIONS = [
  "iPad Air M1", "iPad Pro M4", "iPhone 16 Pro Max",
  "Samsung Galaxy S25 Ultra", "OnePlus 12", "MacBook Air M3",
  "ASUS ROG Laptop", "Sony WH-1000XM5", "Apple Watch Ultra",
  "AirPods Pro 2", "PS5 Slim", "Walton Washing Machine",
];

function formatPrice(price: number): string {
  return price.toLocaleString("en-BD");
}

function getDiscountPercent(price: number, original: number): number {
  if (!original || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
}

function getStoreColor(store: string): string {
  const s = store.toLowerCase();
  if (s.includes("startech")) return "bg-blue-500";
  if (s.includes("ryans")) return "bg-purple-500";
  if (s.includes("pickaboo")) return "bg-pink-500";
  if (s.includes("gadget")) return "bg-orange-500";
  if (s.includes("walton")) return "bg-green-600";
  if (s.includes("rokomari")) return "bg-yellow-600";
  if (s.includes("istock")) return "bg-teal-500";
  if (s.includes("dazzle")) return "bg-fuchsia-500";
  if (s.includes("aiman")) return "bg-indigo-500";
  if (s.includes("hns")) return "bg-slate-500";
  return "bg-gray-500";
}

function getStoreInitial(store: string): string {
  const s = store.toLowerCase();
  if (s.includes("startech")) return "ST";
  if (s.includes("ryans")) return "RY";
  if (s.includes("pickaboo")) return "PB";
  if (s.includes("gadget")) return "GA";
  if (s.includes("walton")) return "WL";
  if (s.includes("rokomari")) return "RK";
  if (s.includes("istock")) return "IS";
  if (s.includes("dazzle")) return "DZ";
  return store.slice(0, 2).toUpperCase();
}

const PROGRESS_STEPS = [
  { label: "Searching stores...", icon: Globe },
  { label: "Scanning prices...", icon: Store },
  { label: "Extracting offers...", icon: Tag },
  { label: "Ranking results...", icon: TrendingDown },
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

  const results = conditionFilter === "all"
    ? allResults
    : allResults.filter((r) => r.condition === conditionFilter);

  useEffect(() => {
    if (!loading) return;
    setProgressStep(0);
    const interval = setInterval(() => {
      setProgressStep((prev) => (prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 1400);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (query.trim().length > 0) {
      setFilteredSuggestions(
        SEARCH_SUGGESTIONS.filter((s) => s.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
      );
    } else {
      setFilteredSuggestions([]);
    }
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
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
        } else if (data.products.length === 0) {
          setError(data.message || `No prices found for "${q}". Try a different product name.`);
        } else {
          setAllResults(data.products);
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { setShowSuggestions(false); handleSearch(); }
    if (e.key === "Escape") setShowSuggestions(false);
  };

  const clearSearch = () => {
    setQuery(""); setSearched(false); setAllResults([]); setError(null);
    setCurrentQuery(""); setConditionFilter("all");
    inputRef.current?.focus();
  };

  const newCount = allResults.filter((r) => r.condition === "new").length;
  const usedCount = allResults.filter((r) => r.condition === "used").length;
  const lowestPrice = results.length > 0 ? results[0].price : 0;
  const highestPrice = results.length > 0 ? results[results.length - 1].price : 0;
  const savings = highestPrice - lowestPrice;

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbfc]">
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <button onClick={clearSearch} className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <TrendingDown className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">PriceBD</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 rounded-md px-2 py-0.5">
              <Shield className="w-3 h-3 text-emerald-500" />
              Verified
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ─── HERO ─── */}
        <section className={`relative transition-all duration-500 ${searched ? "pt-4 pb-3" : "pt-12 pb-8 md:pt-20 md:pb-14"}`}>
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 left-1/3 w-[500px] h-[500px] bg-emerald-50 rounded-full blur-[120px] opacity-80" />
            <div className="absolute -bottom-40 right-1/3 w-[400px] h-[400px] bg-teal-50 rounded-full blur-[120px] opacity-60" />
          </div>

          <div className="max-w-2xl mx-auto px-4 text-center">
            {!searched && (
              <div className="mb-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 text-xs text-emerald-700 font-medium">
                  <Zap className="w-3 h-3" />
                  AI-powered price comparison
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-[1.1]">
                  Find the Best Prices
                  <br />
                  <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                    Across Bangladesh
                  </span>
                </h2>
                <p className="text-sm md:text-base text-gray-500 max-w-md mx-auto">
                  Search any product. We scan Bangladeshi stores, show offer prices, and rank them lowest first.
                </p>
              </div>
            )}

            {searched && !loading && (
              <div className="mb-3 animate-in fade-in duration-300">
                <h2 className="text-sm md:text-base font-semibold text-gray-900">
                  {allResults.length > 0 ? "Prices for" : "Search for"}{" "}
                  <span className="text-emerald-600">&ldquo;{currentQuery}&rdquo;</span>
                </h2>
              </div>
            )}

            {/* ─── SEARCH BAR ─── */}
            <div className="relative max-w-xl mx-auto">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Search product... e.g. iPhone 15"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    className="pl-10 pr-9 h-11 text-sm rounded-xl border border-gray-200 focus:border-emerald-400 bg-white shadow-sm focus:shadow-md focus:shadow-emerald-500/5 transition-all"
                  />
                  {query && !loading && (
                    <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {showSuggestions && filteredSuggestions.length > 0 && !loading && (
                    <div ref={suggestionsRef} className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                      {filteredSuggestions.map((s) => (
                        <button key={s} onClick={() => { setQuery(s); setShowSuggestions(false); handleSearch(s); }}
                          className="w-full text-left px-3.5 py-2 text-sm hover:bg-emerald-50 transition-colors flex items-center gap-2 text-gray-700">
                          <Search className="w-3 h-3 text-gray-400" />
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={() => handleSearch()} disabled={loading || !query.trim()}
                  className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all disabled:opacity-50">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {!searched && (
              <div className="mt-5 space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Popular searches</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {POPULAR_SEARCHES.map((term) => (
                    <button key={term} onClick={() => { setQuery(term); handleSearch(term); }}
                      className="px-3 py-1 text-xs bg-white border border-gray-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all text-gray-500">
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── RESULTS SECTION ─── */}
        <section className="max-w-5xl mx-auto px-4 pb-16">
          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              <div className="bg-white border border-gray-200/80 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-gray-700">Searching for &ldquo;{currentQuery}&rdquo;</span>
                </div>
                <div className="space-y-2">
                  {PROGRESS_STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = i === progressStep;
                    const isDone = i < progressStep;
                    return (
                      <div key={i} className={`flex items-center gap-2 text-xs transition-all duration-300 ${isActive ? "text-emerald-700 font-medium" : isDone ? "text-emerald-500" : "text-gray-300"}`}>
                        {isActive ? <RefreshCw className="w-3 h-3 animate-spin" /> : isDone ? <CheckCircle2 className="w-3 h-3" /> : <CircleDot className="w-3 h-3" />}
                        <Icon className="w-3 h-3" />
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${((progressStep + 1) / PROGRESS_STEPS.length) * 100}%` }} />
                </div>
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-4">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/5" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-10 animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1.5">No Prices Found</h3>
              <p className="text-gray-500 max-w-sm mx-auto text-xs">{error}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {["iPad Air M1", "Samsung Galaxy S24", "iPhone 15", "MacBook Air M2"].map((term) => (
                  <button key={term} onClick={() => { setQuery(term); handleSearch(term); }}
                    className="px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 transition-all text-gray-500 hover:text-emerald-700">
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && results.length > 0 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-500">
              {/* Stats Row */}
              <div className="flex flex-col gap-2.5">
                {/* Stats bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-gray-200/80 rounded-xl p-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Found</p>
                      <p className="text-lg font-bold text-gray-900">{results.length}</p>
                    </div>
                    <div className="w-px h-7 bg-gray-200" />
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Lowest</p>
                      <p className="text-lg font-bold text-emerald-600">৳{formatPrice(lowestPrice)}</p>
                    </div>
                    <div className="w-px h-7 bg-gray-200" />
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Highest</p>
                      <p className="text-lg font-bold text-gray-400">৳{formatPrice(highestPrice)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    {((searchTime / 1000) || 0).toFixed(1)}s
                  </div>
                </div>

                {/* Filter + Savings Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3 h-3 text-gray-400" />
                    <div className="flex gap-1">
                      {([
                        { key: "all" as ConditionFilter, label: "All", count: allResults.length, activeClass: "bg-gray-900 text-white" },
                        { key: "new" as ConditionFilter, label: "New", count: newCount, icon: PackageCheck, activeClass: "bg-emerald-600 text-white" },
                        { key: "used" as ConditionFilter, label: "Used", count: usedCount, icon: Package, activeClass: "bg-amber-500 text-white" },
                      ]).map(({ key, label, count, icon: Icon, activeClass }) => (
                        <button key={key} onClick={() => setConditionFilter(key)}
                          className={`px-2.5 py-0.5 text-[11px] rounded-md border font-medium transition-all flex items-center gap-1 ${
                            conditionFilter === key ? `${activeClass} border-transparent` : "bg-white text-gray-500 border-gray-200 hover:border-emerald-300"
                          }`}>
                          {Icon && <Icon className="w-2.5 h-2.5" />}
                          {label} ({count})
                        </button>
                      ))}
                    </div>
                  </div>
                  {results.length > 1 && savings > 0 && (
                    <div className="flex items-center gap-1 text-[11px] bg-emerald-50 border border-emerald-100 rounded-md px-2.5 py-1">
                      <BadgePercent className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-800">Save up to <strong>৳{formatPrice(savings)}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Product Cards */}
              <div className="space-y-1.5">
                {results.map((product, index) => {
                  const discount = getDiscountPercent(product.price, product.originalPrice || 0);
                  return (
                    <a key={product.url + index} href={product.url} target="_blank" rel="noopener noreferrer" className="block group">
                      <div className={`relative overflow-hidden rounded-xl border transition-all duration-200 group-hover:shadow-md group-hover:border-emerald-200 group-hover:-translate-y-px bg-white ${
                        index === 0 ? "border-emerald-200" : "border-gray-200/80"
                      }`}>
                        {/* Best Price badge */}
                        {index === 0 && (
                          <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-bl-lg flex items-center gap-1">
                            <Flame className="w-2.5 h-2.5" />
                            BEST PRICE
                          </div>
                        )}
                        <div className="p-3.5 md:p-4">
                          <div className="flex items-start gap-3">
                            {/* Store avatar */}
                            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                              <div className={`w-9 h-9 rounded-lg ${getStoreColor(product.store)} flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}>
                                {getStoreInitial(product.store)}
                              </div>
                              <span className="text-[9px] font-medium text-gray-300">#{index + 1}</span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-2 text-[13px] leading-snug">
                                    {product.name}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                    <Badge variant="outline" className="text-[9px] font-medium h-4 bg-gray-50 border-gray-200 text-gray-600">
                                      {product.store}
                                    </Badge>
                                    <Badge className={`text-[9px] h-4 ${
                                      product.condition === "used"
                                        ? "bg-amber-50 text-amber-700 border-amber-100"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    }`}>
                                      {product.condition === "used" ? "Used" : "New"}
                                    </Badge>
                                    {discount > 0 && (
                                      <Badge className="text-[9px] h-4 bg-red-50 text-red-600 border-red-100 font-bold">
                                        -{discount}%
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Price section */}
                                <div className="flex items-center gap-2 flex-shrink-0 sm:ml-3 sm:text-right">
                                  <div>
                                    <p className={`text-lg md:text-xl font-bold tracking-tight ${
                                      index === 0 ? "text-emerald-600" : "text-gray-900"
                                    }`}>
                                      ৳{formatPrice(product.price)}
                                    </p>
                                    {product.originalPrice && product.originalPrice > product.price && (
                                      <p className="text-[10px] text-gray-400 line-through">
                                        ৳{formatPrice(product.originalPrice)}
                                      </p>
                                    )}
                                    {index > 0 && lowestPrice > 0 && (
                                      <p className="text-[9px] text-red-400 font-medium">+৳{formatPrice(product.price - lowestPrice)} more</p>
                                    )}
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>

              {/* Footer note */}
              <p className="text-center text-[10px] text-gray-400 pt-1.5">
                Offer prices shown when available · Click to visit store · Prices may vary
              </p>
            </div>
          )}

          {/* Empty after filter */}
          {!loading && allResults.length > 0 && results.length === 0 && (
            <div className="text-center py-6">
              <p className="text-gray-500 text-xs">No {conditionFilter} products found. Try a different filter.</p>
              <Button variant="outline" size="sm" onClick={() => setConditionFilter("all")} className="mt-2 text-xs">Show All</Button>
            </div>
          )}

          {/* Empty initial */}
          {!searched && !loading && (
            <div className="text-center py-10 text-gray-300">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2" />
              <p className="text-xs">Search for a product to compare prices</p>
            </div>
          )}
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-gray-200/60 bg-white/50 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-1.5 text-[10px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <TrendingDown className="w-2 h-2 text-white" />
            </div>
            <span className="font-semibold text-gray-600">PriceBD</span>
            <span>— Smart Price Comparison for Bangladesh</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5 text-emerald-500" /> Verified stores</span>
            <span>Always verify prices on retailer&apos;s site</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
