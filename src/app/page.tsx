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

function getStoreIcon(store: string): string {
  const s = store.toLowerCase();
  if (s.includes("startech")) return "💻";
  if (s.includes("ryans")) return "🖥️";
  if (s.includes("rokomari")) return "📚";
  if (s.includes("pickaboo")) return "🎯";
  if (s.includes("gadget")) return "📱";
  if (s.includes("walton")) return "🏭";
  if (s.includes("istock")) return "📦";
  if (s.includes("dazzle")) return "✨";
  if (s.includes("aiman")) return "🏪";
  if (s.includes("hns")) return "🔧";
  return "🏪";
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
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 40%, #ffffff 100%)" }}>
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-white/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={clearSearch} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:shadow-lg group-hover:shadow-emerald-500/30 transition-shadow">
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-none tracking-tight">PriceBD</h1>
              <p className="text-[9px] text-muted-foreground leading-none mt-0.5">Compare &amp; Save</p>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
              <Shield className="w-3 h-3 text-emerald-500" />
              Verified stores only
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Globe className="w-3 h-3" />
              BD
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ─── HERO ─── */}
        <section className={`relative transition-all duration-500 ${searched ? "pt-6 pb-4" : "pt-16 pb-10 md:pt-24 md:pb-16"}`}>
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 left-1/3 w-[500px] h-[500px] bg-emerald-100 rounded-full blur-[100px] opacity-60" />
            <div className="absolute -bottom-40 right-1/3 w-[400px] h-[400px] bg-teal-100 rounded-full blur-[100px] opacity-50" />
          </div>

          <div className="max-w-3xl mx-auto px-4 text-center">
            {!searched && (
              <div className="mb-8 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 rounded-full px-4 py-1.5 text-sm text-emerald-700 font-medium">
                  <Sparkles className="w-4 h-4" />
                  AI-powered price comparison
                </div>
                <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                  Best Prices
                  <br />
                  <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                    Across Bangladesh
                  </span>
                </h2>
                <p className="text-base md:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Search any product. We scan verified Bangladeshi stores, show offer prices, and rank them lowest first.
                </p>
              </div>
            )}

            {searched && !loading && (
              <div className="mb-4 animate-in fade-in duration-300">
                <h2 className="text-lg md:text-xl font-bold text-foreground">
                  {allResults.length > 0 ? "Prices for" : "Search for"}{" "}
                  <span className="text-emerald-600">&ldquo;{currentQuery}&rdquo;</span>
                </h2>
              </div>
            )}

            {/* ─── SEARCH BAR ─── */}
            <div className="relative max-w-2xl mx-auto">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70 z-10" />
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Search product... e.g. iPad Air M1"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    className="pl-12 pr-10 h-12 md:h-[52px] text-base rounded-2xl border-2 border-emerald-200/80 focus:border-emerald-400 bg-white shadow-xl shadow-emerald-500/5 transition-all"
                  />
                  {query && !loading && (
                    <button onClick={clearSearch} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {showSuggestions && filteredSuggestions.length > 0 && !loading && (
                    <div ref={suggestionsRef} className="absolute top-full mt-2 left-0 right-0 bg-white border border-border/80 rounded-2xl shadow-2xl z-50 overflow-hidden">
                      {filteredSuggestions.map((s) => (
                        <button key={s} onClick={() => { setQuery(s); setShowSuggestions(false); handleSearch(s); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 transition-colors flex items-center gap-2.5">
                          <Search className="w-3.5 h-3.5 text-muted-foreground/60" />
                          <span>{s}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={() => handleSearch()} disabled={loading || !query.trim()}
                  className="h-12 md:h-[52px] px-5 md:px-7 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xl shadow-emerald-600/20 transition-all disabled:opacity-50">
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5 md:mr-1.5" /><span className="hidden md:inline">Search</span></>}
                </Button>
              </div>
            </div>

            {!searched && (
              <div className="mt-6 space-y-2.5 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Popular searches</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {POPULAR_SEARCHES.map((term) => (
                    <button key={term} onClick={() => { setQuery(term); handleSearch(term); }}
                      className="px-3.5 py-1.5 text-sm bg-white/80 border border-border/80 rounded-full hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition-all text-muted-foreground shadow-sm">
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── RESULTS SECTION ─── */}
        <section className="max-w-6xl mx-auto px-4 pb-16">
          {/* Loading */}
          {loading && (
            <div className="space-y-4">
              <div className="bg-white/80 backdrop-blur border border-border/50 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-foreground">Searching for &ldquo;{currentQuery}&rdquo;</span>
                </div>
                <div className="space-y-2.5">
                  {PROGRESS_STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = i === progressStep;
                    const isDone = i < progressStep;
                    return (
                      <div key={i} className={`flex items-center gap-2.5 text-sm transition-all duration-300 ${isActive ? "text-emerald-700 font-medium" : isDone ? "text-emerald-500" : "text-muted-foreground/40"}`}>
                        {isActive ? <RefreshCw className="w-4 h-4 animate-spin" /> : isDone ? <span className="text-emerald-500 text-xs">✓</span> : <CircleDot className="w-4 h-4" />}
                        <Icon className="w-3.5 h-3.5" />
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 w-full bg-emerald-100/80 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${((progressStep + 1) / PROGRESS_STEPS.length) * 100}%` }} />
                </div>
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/60 border border-border/30 rounded-2xl p-5">
                  <div className="flex gap-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="flex-1 space-y-2.5">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-12 animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/50 flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Prices Found</h3>
              <p className="text-muted-foreground max-w-md mx-auto text-sm">{error}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {["iPad Air M1", "Samsung Galaxy S24", "iPhone 15", "MacBook Air M2"].map((term) => (
                  <button key={term} onClick={() => { setQuery(term); handleSearch(term); }}
                    className="px-3 py-1.5 text-sm bg-white border border-border rounded-full hover:border-emerald-400 hover:bg-emerald-50 transition-all text-muted-foreground hover:text-emerald-700">
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && results.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
              {/* Stats + Filter Bar */}
              <div className="flex flex-col gap-3">
                {/* Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 border border-emerald-200/50 rounded-2xl p-4">
                  <div className="flex items-center gap-5">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Found</p>
                      <p className="text-xl font-bold text-foreground">{results.length}</p>
                    </div>
                    <div className="w-px h-8 bg-emerald-200/60" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Lowest</p>
                      <p className="text-xl font-bold text-emerald-600">৳{formatPrice(lowestPrice)}</p>
                    </div>
                    <div className="w-px h-8 bg-emerald-200/60" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Highest</p>
                      <p className="text-xl font-bold text-red-500">৳{formatPrice(highestPrice)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {((searchTime / 1000) || 0).toFixed(1)}s
                  </div>
                </div>

                {/* Filter + Savings Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="flex gap-1">
                      {([
                        { key: "all" as ConditionFilter, label: "All", count: allResults.length, activeClass: "bg-foreground text-white" },
                        { key: "new" as ConditionFilter, label: "New", count: newCount, icon: PackageCheck, activeClass: "bg-emerald-600 text-white" },
                        { key: "used" as ConditionFilter, label: "Used", count: usedCount, icon: Package, activeClass: "bg-amber-600 text-white" },
                      ]).map(({ key, label, count, icon: Icon, activeClass }) => (
                        <button key={key} onClick={() => setConditionFilter(key)}
                          className={`px-3 py-1 text-xs rounded-lg border font-medium transition-all flex items-center gap-1 ${
                            conditionFilter === key ? `${activeClass} border-transparent shadow-sm` : "bg-white text-muted-foreground border-border hover:border-emerald-300"
                          }`}>
                          {Icon && <Icon className="w-3 h-3" />}
                          {label} ({count})
                        </button>
                      ))}
                    </div>
                  </div>
                  {results.length > 1 && savings > 0 && (
                    <div className="flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200/60 rounded-lg px-3 py-1.5">
                      <BadgePercent className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-800">Save up to <strong className="text-emerald-900">৳{formatPrice(savings)}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Product Cards */}
              <div className="space-y-2">
                {results.map((product, index) => {
                  const discount = getDiscountPercent(product.price, product.originalPrice || 0);
                  return (
                    <a key={product.url + index} href={product.url} target="_blank" rel="noopener noreferrer" className="block group">
                      <div className={`relative overflow-hidden rounded-2xl border transition-all duration-200 group-hover:shadow-lg group-hover:shadow-emerald-500/5 group-hover:border-emerald-300 group-hover:-translate-y-0.5 bg-white ${
                        index === 0 ? "border-emerald-300 bg-emerald-50/40" : "border-border/60"
                      }`}>
                        {/* Best Price ribbon */}
                        {index === 0 && (
                          <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-lg">
                            BEST PRICE
                          </div>
                        )}
                        <div className="p-4 md:p-5">
                          <div className="flex items-start gap-3 md:gap-4">
                            {/* Store icon + rank */}
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-base ${
                                index === 0 ? "bg-emerald-100 ring-2 ring-emerald-300" : index === 1 ? "bg-amber-50" : index === 2 ? "bg-orange-50" : "bg-muted/50"
                              }`}>
                                {getStoreIcon(product.store)}
                              </div>
                              <span className="text-[10px] font-bold text-muted-foreground/60">#{index + 1}</span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-foreground group-hover:text-emerald-700 transition-colors line-clamp-2 text-sm md:text-[15px] leading-snug">
                                    {product.name}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                    <Badge variant="outline" className="text-[10px] font-medium h-5 bg-muted/30">
                                      <ShoppingCart className="w-2.5 h-2.5 mr-0.5" />
                                      {product.store}
                                    </Badge>
                                    {index < 3 && (
                                      <Badge className={`text-[10px] h-5 ${
                                        index === 0 ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                        index === 1 ? "bg-amber-100 text-amber-800 border-amber-200" :
                                        "bg-orange-100 text-orange-800 border-orange-200"
                                      }`}>
                                        <Star className="w-2.5 h-2.5 mr-0.5" />
                                        {index === 0 ? "Best" : index === 1 ? "2nd" : "3rd"}
                                      </Badge>
                                    )}
                                    <Badge className={`text-[10px] h-5 ${
                                      product.condition === "used"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}>
                                      {product.condition === "used" ? <Package className="w-2.5 h-2.5 mr-0.5" /> : <PackageCheck className="w-2.5 h-2.5 mr-0.5" />}
                                      {product.condition === "used" ? "Used" : "New"}
                                    </Badge>
                                    {discount > 0 && (
                                      <Badge className="text-[10px] h-5 bg-red-50 text-red-600 border-red-200 font-semibold">
                                        <BadgePercent className="w-2.5 h-2.5 mr-0.5" />
                                        {discount}% OFF
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Price section */}
                                <div className="flex items-center gap-3 flex-shrink-0 sm:ml-4 sm:text-right">
                                  <div>
                                    <p className={`text-xl md:text-2xl font-bold tracking-tight ${
                                      index === 0 ? "text-emerald-600" : index === results.length - 1 && results.length > 1 ? "text-red-500" : "text-foreground"
                                    }`}>
                                      ৳{formatPrice(product.price)}
                                    </p>
                                    {product.originalPrice && product.originalPrice > product.price && (
                                      <p className="text-[11px] text-muted-foreground line-through">
                                        ৳{formatPrice(product.originalPrice)}
                                      </p>
                                    )}
                                    {index > 0 && lowestPrice > 0 && (
                                      <p className="text-[10px] text-red-400 font-medium">+৳{formatPrice(product.price - lowestPrice)}</p>
                                    )}
                                  </div>
                                  <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
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
              <p className="text-center text-[11px] text-muted-foreground/60 pt-2">
                Offer prices shown when available &middot; Click to visit store &middot; Prices may vary
              </p>
            </div>
          )}

          {/* Empty after filter */}
          {!loading && allResults.length > 0 && results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">No {conditionFilter} products found. Try a different filter.</p>
              <Button variant="outline" size="sm" onClick={() => setConditionFilter("all")} className="mt-3">Show All</Button>
            </div>
          )}

          {/* Empty initial */}
          {!searched && !loading && (
            <div className="text-center py-12 text-muted-foreground/40">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm">Search for a product to compare prices</p>
            </div>
          )}
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t bg-white/50 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <TrendingDown className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="font-semibold text-foreground">PriceBD</span>
            <span className="text-muted-foreground/60">&mdash; Smart Price Comparison for Bangladesh</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-emerald-500" /> Verified stores</span>
            <span>Always verify prices on retailer&apos;s site</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
