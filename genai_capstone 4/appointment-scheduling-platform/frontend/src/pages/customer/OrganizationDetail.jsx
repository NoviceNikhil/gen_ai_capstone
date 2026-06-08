import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getOrganizationAPI, getProvidersAPI } from "../../services/apiService";
import { ArrowLeft, MapPin, Building2, Star, Sparkles, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { getProviderPortrait } from "../../utils/portraits";
import Pagination from "../../components/ui/Pagination";

const isSafeLogoUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return !["localhost", "127.0.0.1"].includes(parsed.hostname);
  } catch {
    return false;
  }
};

export default function OrganizationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProviders, setTotalProviders] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getOrganizationAPI(id),
      getProvidersAPI({ organization_id: id, limit: 12, page }),
    ])
      .then(([orgRes, provRes]) => {
        setOrg(orgRes.data);
        setProviders(provRes.data?.data?.providers || []);
        setTotalPages(provRes.data?.data?.total_pages || 1);
        setTotalProviders(provRes.data?.data?.total || 0);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load organization details.");
      })
      .finally(() => setLoading(false));
  }, [id, page]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto min-h-screen">
        <div className="animate-pulse space-y-6">
          <div className="skeleton w-32 h-[40px] rounded-lg" />
          <div className="skeleton w-full h-[250px] rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            <div className="skeleton h-[250px] rounded-xl" />
            <div className="skeleton h-[250px] rounded-xl" />
            <div className="skeleton h-[250px] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="p-8 max-w-7xl mx-auto min-h-screen">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2" size={16} /> Back
        </Button>
        <Card className="border-border bg-card">
          <CardContent className="py-24 text-center">
            <Building2 size={48} className="mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-black mb-2">Organization Not Found</h2>
            <p className="text-muted-foreground">{error || "This organization does not exist or is not approved."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in min-h-screen relative">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2" size={16} /> Back
      </Button>

      {/* Org Header */}
      <Card className="border-border bg-card mb-10 overflow-hidden">
        <div className="h-32 bg-primary/10 relative">
          <div className="absolute -bottom-12 left-8 border-4 border-card rounded-2xl overflow-hidden bg-card w-24 h-24 flex items-center justify-center">
            {isSafeLogoUrl(org.logo_url) ? (
              <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover" />
            ) : (
              <Building2 size={40} className="text-primary/50" />
            )}
          </div>
        </div>
        <CardContent className="pt-16 pb-8 px-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-black mb-2">{org.name}</h1>
              <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                {org.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={16} /> {org.location}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Star size={16} className="text-warning fill-warning" />
                  {providers.length > 0
                    ? (providers.reduce((sum, p) => sum + parseFloat(p.avg_rating), 0) / providers.length).toFixed(1)
                    : "New"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-accent/10 text-accent font-bold text-xs uppercase">
                  {totalProviders} Providers
                </span>
              </div>
            </div>
          </div>
          {org.description && (
            <p className="mt-6 text-foreground/80 leading-relaxed max-w-3xl">
              {org.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Providers Grid */}
      <h2 className="text-2xl font-black mb-6">Our Experts</h2>
      
      {providers.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-24 text-center">
            <Search size={48} className="mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-bold mb-2 text-foreground">No Providers Yet</h3>
            <p className="text-muted-foreground">This organization has not listed any experts yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {providers.map((p) => (
            <Link key={p.id} to={`/customer/providers/${p.id}`} className="block group">
              <Card className="glass-card-hover border-border bg-card h-full">
                <CardContent className="p-6">
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
                        {p.is_verified && <Sparkles size={14} className="text-accent shrink-0" />}
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
                        <span className="text-[10px] text-muted-foreground">({p.total_reviews})</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                    {p.category && (
                      <span className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-extrabold uppercase tracking-wider text-primary">
                        {p.category.name}
                      </span>
                    )}
                    <p className="text-lg font-extrabold text-accent">
                      ₹{p.consultation_fee || 199}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      
      {providers.length > 0 && (
        <Pagination 
          page={page} 
          totalPages={totalPages} 
          onPageChange={setPage} 
        />
      )}
    </div>
  );
}
