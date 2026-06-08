import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  Search,
  Star,
  MapPin,
  Clock,
  Filter,
  Sparkles,
  X,
  Building2,
} from "lucide-react";
import { fetchProviders } from "../../store/providerSlice";
import { getCategoriesAPI, listOrganizationsAPI } from "../../services/apiService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProviderPortrait } from "../../utils/portraits";
import Pagination from "../../components/ui/Pagination";

export default function ProviderList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: providers,
    loading,
    total,
    totalPages,
    error,
  } = useSelector((s) => s.providers);
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const pendingCategoryNameRef = useRef("");
  const [filters, setFilters] = useState({
    search: "",
    category_id: "",
    location: "",
    organization_id: "",
    min_rating: "",
    page: 1,
  });

  useEffect(() => {
    getCategoriesAPI().then((r) => {
      const cats = r.data?.data?.categories || [];
      setCategories(cats);

      // Resolve any pending chip-click that arrived before categories loaded
      const pendingName = pendingCategoryNameRef.current;
      if (pendingName) {
        const found = cats.find((c) => c.name === pendingName);
        if (found) {
          setFilters((current) => ({ ...current, category_id: found.id, page: 1 }));
        }
        pendingCategoryNameRef.current = "";
      }

      const catParam = searchParams.get("category");
      if (catParam) {
        const found = cats.find(
          (c) => c.name.toLowerCase() === catParam.toLowerCase()
        );
        if (found) {
          setFilters((current) => ({
            ...current,
            category_id: found.id,
            page: 1,
          }));
        }
      }
    });
  }, [searchParams]);

  // Fetch organizations based on current category filter
  useEffect(() => {
    const orgParams = { limit: 100 };
    if (filters.category_id) {
      orgParams.category_id = filters.category_id;
    }
    listOrganizationsAPI(orgParams)
      .then((r) => {
        setOrganizations(r.data?.data?.organizations || r.data || []);
      })
      .catch(console.error);
  }, [filters.category_id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFilters((current) => ({
        ...current,
        search: searchInput.trim(),
        page: 1,
      }));
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const requestParams = useMemo(() => ({ ...filters, limit: 12 }), [filters]);

  useEffect(() => {
    dispatch(fetchProviders(requestParams));
  }, [dispatch, requestParams]);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setFilters({ search: "", category_id: "", location: "", organization_id: "", min_rating: "", page: 1 });
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in text-foreground min-h-screen relative">
      {/* Header and summary metrics */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
            Find Your Expert
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Browse through{" "}
            <span className="text-primary font-semibold">{total}</span> verified
            professionals ready to help you scale.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full md:w-auto md:min-w-[360px]">
          <Card className="border-border bg-card p-3 text-center">
            <p className="text-xl font-extrabold text-accent">
              {categories.length}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Categories
            </p>
          </Card>
          <Card className="border-border bg-card p-3 text-center">
            <p className="text-xl font-extrabold text-primary">{total}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Verified
            </p>
          </Card>
          <Card className="border-border bg-card p-3 text-center">
            <p className="text-xl font-extrabold text-warning">4.7</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Avg Rating
            </p>
          </Card>
        </div>
      </div>

      {/* Search Bar Row */}
      <div className="mb-4">
        <div className="relative flex items-center group w-full">
          <Search
            size={16}
            className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0"
          />
          <Input
            type="text"
            className="pl-11 h-12 bg-card border-border w-full"
            placeholder="Search city + organization + expertise + name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Dropdowns Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 mb-6">
        <Select
          value={filters.category_id ? String(filters.category_id) : undefined}
          onValueChange={(val) =>
            setFilters({ ...filters, category_id: val === "all" ? "" : val, page: 1 })
          }
        >
          <SelectTrigger className="w-full h-12 bg-card border-border text-xs">
            <SelectValue placeholder="Category">
              {filters.category_id ? (
                categories.find((c) => String(c.id) === String(filters.category_id))?.name || "Category"
              ) : (
                "Category"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.location || undefined}
          onValueChange={(val) =>
            setFilters({ ...filters, location: val === "all" ? "" : val, page: 1 })
          }
        >
          <SelectTrigger className="w-full h-12 bg-card border-border text-xs">
            <SelectValue placeholder="Location">
              {filters.location ? (
                filters.location === "all" ? "Any Location" : filters.location
              ) : (
                "Location"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border">
            <SelectItem value="all">Any Location</SelectItem>
            {["Mumbai", "Bengaluru", "Pune", "Delhi", "Hyderabad", "Chennai"].map((city) => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.organization_id ? String(filters.organization_id) : undefined}
          onValueChange={(val) =>
            setFilters({ ...filters, organization_id: val === "all" ? "" : val, page: 1 })
          }
        >
          <SelectTrigger className="w-full h-12 bg-card border-border text-xs">
            <SelectValue placeholder="Organization">
              {filters.organization_id ? (
                organizations.find((org) => String(org.id) === String(filters.organization_id))?.name || "Organization"
              ) : (
                "Organization"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border">
            <SelectItem value="all">All Organizations</SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.min_rating ? String(filters.min_rating) : undefined}
          onValueChange={(val) =>
            setFilters({ ...filters, min_rating: val === "all" ? "" : val, page: 1 })
          }
        >
          <SelectTrigger className="w-full h-12 bg-card border-border text-xs">
            <SelectValue placeholder="Rating">
              {filters.min_rating ? (
                filters.min_rating === "4.5" ? "4.5+ Stars" :
                filters.min_rating === "4.0" ? "4.0+ Stars" :
                filters.min_rating === "3.0" ? "3.0+ Stars" :
                "Any Rating"
              ) : (
                "Rating"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border">
            <SelectItem value="all">Any Rating</SelectItem>
            <SelectItem value="4.5">4.5+ Stars</SelectItem>
            <SelectItem value="4.0">4.0+ Stars</SelectItem>
            <SelectItem value="3.0">3.0+ Stars</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={clearFilters}
          className="h-12 px-5 text-xs font-bold uppercase tracking-wider gap-2 cursor-pointer"
        >
          <X size={14} className="shrink-0" /> Clear
        </Button>
      </div>

      {/* Quick filters chips */}
      <div className="flex flex-wrap gap-2 mb-10">
        {[
          "Healthcare",
          "Education",
          "Business Consulting",
          "Mumbai",
          "Bengaluru",
          "Pune",
        ].map((chip) => (
          <Button
            key={chip}
            variant="outline"
            size="sm"
            onClick={() => {
              const category = categories.find((c) => c.name === chip);
              if (category) {
                // Categories already loaded — apply filter immediately
                setFilters((current) => ({
                  ...current,
                  category_id: category.id,
                  page: 1,
                }));
              } else if (categories.length === 0) {
                // Categories not yet loaded — store name to resolve once they arrive
                pendingCategoryNameRef.current = chip;
              } else {
                // Not a category chip — treat as location
                setFilters((current) => ({
                  ...current,
                  location: chip,
                  page: 1,
                }));
              }
            }}
            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground font-semibold border-border bg-card/50"
          >
            <Filter size={12} className="mr-1" /> {chip}
          </Button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-border bg-card/45">
              <CardContent className="p-6">
                <div className="flex items-start gap-5 mb-6">
                  <div className="skeleton w-16 h-16 rounded-2xl" />
                  <div className="flex-1 space-y-3">
                    <div className="skeleton w-3/4 h-[18px]" />
                    <div className="skeleton w-1/2 h-[12px]" />
                    <div className="skeleton w-1/3 h-[10px]" />
                  </div>
                </div>
                <div className="space-y-3 mb-6">
                  <div className="skeleton w-1/2 h-[14px]" />
                  <div className="skeleton w-2/3 h-[14px]" />
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="skeleton w-20 h-[22px] rounded-lg" />
                  <div className="skeleton w-16 h-[26px]" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {providers.map((p) => (
            <Link
              key={p.id}
              to={`/customer/providers/${p.id}`}
              className="block group"
            >
              <Card className="glass-card-hover border-border bg-card">
                <CardContent className="p-6 group-data-[size=sm]/card:px-6 group-data-[size=sm]/card:py-6">
                  <div className="flex items-start gap-5 mb-6">
                    <Avatar className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shadow-sm">
                      <img
                        src={getProviderPortrait(p.id, p.specialization, p.user?.full_name)}
                        className="w-full h-full object-cover"
                        alt={p.user?.full_name}
                      />
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="font-extrabold text-base truncate group-hover:text-primary transition-colors text-foreground">
                          {p.user?.full_name}
                        </p>
                        {p.is_verified && (
                          <Sparkles
                            size={14}
                            className="text-accent shrink-0"
                          />
                        )}
                      </div>
                      <p className="text-xs font-bold text-muted-foreground truncate mb-2">
                        {p.specialization}
                      </p>
                      <div className="flex items-center gap-1">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={10}
                              className={`${i < Math.floor(p.avg_rating) ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-extrabold text-foreground ml-1">
                          {parseFloat(p.avg_rating).toFixed(1)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({p.total_reviews})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                      <MapPin
                        size={14}
                        className="text-muted-foreground/60 shrink-0"
                      />
                      <span className="truncate">
                        {p.location || "Remote / Global"}
                      </span>
                    </div>
                    {p.organization && (
                      <div 
                        className="flex items-center gap-2 text-xs text-primary font-semibold hover:underline cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/customer/organizations/${p.organization.id}`);
                        }}
                      >
                        <Building2
                          size={14}
                          className="text-primary shrink-0"
                        />
                        <span className="truncate">{p.organization.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                      <Clock
                        size={14}
                        className="text-muted-foreground/60 shrink-0"
                      />
                      <span>Next Available: Tomorrow</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    {p.category && (
                      <span className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-extrabold uppercase tracking-wider text-primary">
                        {p.category.name}
                      </span>
                    )}
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Consultation</span>
                      <p className="text-xl font-black text-foreground">
                        ₹{p.consultation_fee || 199}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {providers.length === 0 && (
            <Card className="col-span-full border-border bg-card">
              <CardContent className="py-24 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
                  <Search size={28} className="text-muted-foreground" />
                </div>
                <h3 className="text-xl font-extrabold mb-1 text-foreground">
                  No experts found
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  We couldn't find any providers matching your search. Try
                  broadening your criteria.
                </p>
                <Button onClick={clearFilters} className="mt-6">
                  Clear all filters
                </Button>
              </CardContent>
            </Card>
          )}
          {providers.length > 0 && (
            <div className="col-span-full">
              <Pagination
                page={filters.page}
                totalPages={totalPages}
                onPageChange={(p) => setFilters((current) => ({ ...current, page: p }))}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
