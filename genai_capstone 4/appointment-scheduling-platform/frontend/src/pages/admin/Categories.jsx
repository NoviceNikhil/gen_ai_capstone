import { useEffect, useState } from "react";
import {
  getCategoriesAPI,
  createCategoryAPI,
  updateCategoryAPI,
  deleteCategoryAPI,
  getAdminAppointmentsAPI
} from "../../services/apiService";
import { AdminBarChart } from "@/components/admin/AdminCharts";
import { useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Tag,
  Sparkles,
  AlertCircle,
  Stethoscope,
  Home,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {[...Array(4)].map((_, idx) => (
      <div key={idx} className="skeleton w-full h-[180px]" />
    ))}
  </div>
);

const iconMap = {
  stethoscope: Stethoscope,
  sparkles: Sparkles,
  home: Home,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
};

const renderCategoryIcon = (icon) => {
  // If icon is a Lucide key name, render the component
  if (iconMap[icon]) {
    const IconComponent = iconMap[icon];
    return (
      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <IconComponent className="w-6 h-6 text-primary" />
      </div>
    );
  }

  // If it's an emoji or single character
  if (icon && icon.length <= 2) {
    return (
      <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border/40 flex items-center justify-center text-2xl shrink-0">
        {icon}
      </div>
    );
  }

  // If it's an image URL
  if (icon && (icon.startsWith("/") || icon.startsWith("http"))) {
    return (
      <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
        <img
          src={icon}
          alt="category icon"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.replaceWith(document.createTextNode("📋"));
          }}
        />
      </div>
    );
  }

  // Default fallback
  return (
    <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border/40 flex items-center justify-center text-2xl shrink-0">
      📋
    </div>
  );
};

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", icon: "" });
  const [appointments, setAppointments] = useState([]);

  const load = () => {
    setLoading(true);
    Promise.all([
      getCategoriesAPI(),
      getAdminAppointmentsAPI({ limit: 100 })
    ])
      .then(([catRes, apptRes]) => {
        setCategories(catRes.data?.data?.categories || []);
        setAppointments(apptRes.data?.data?.appointments || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const categoryImpact = useMemo(() => {
    const counts = {};
    for (const a of appointments) {
      const k = a.category?.name || "Uncategorized";
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ x: name, y: count }))
      .sort((a, b) => b.y - a.y)
      .slice(0, 5);
  }, [appointments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const promise = editId
      ? updateCategoryAPI(editId, form)
      : createCategoryAPI(form);

    toast.promise(promise, {
      loading: editId ? "Updating taxonomy..." : "Creating new category...",
      success: editId ? "Taxonomy updated" : "Category created successfully",
      error: (err) => err.response?.data?.message || "Action failed",
    });

    try {
      await promise;
      setShowForm(false);
      setEditId(null);
      setForm({ name: "", description: "", icon: "" });
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (cat) => {
    setEditId(cat.id);
    setForm({
      name: cat.name,
      description: cat.description || "",
      icon: cat.icon || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure? This may affect existing providers in this category.",
      )
    )
      return;
    try {
      await toast.promise(deleteCategoryAPI(id), {
        loading: "Deleting category...",
        success: "Category removed",
        error: "Deletion failed",
      });
      load();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Tag className="text-primary size-7" /> Taxonomy
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Define and organize service categories for the platform marketplace.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(true);
            setEditId(null);
            setForm({ name: "", description: "", icon: "" });
          }}
          className="gap-1.5 cursor-pointer shadow-lg hover:shadow-brand/20 transition-all duration-200"
        >
          <Plus size={16} /> New Category
        </Button>
      </div>

      {loading ? (
        <GridSkeleton />
      ) : (
        <div className="space-y-6">
          {categoryImpact.length > 0 && (
            <AdminBarChart
              title="Category Impact"
              subtitle="Most popular categories by appointment volume"
              data={categoryImpact}
              xKey="x"
              height={220}
              bars={[{ dataKey: "y", name: "Appointments", fill: "#C4441A" }]}
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat) => (
            <Card key={cat.id} variant="glass-hover" className="p-6">
              <CardContent className="p-0 flex flex-col justify-between h-full">
                <div className="flex items-start gap-4">
                  {renderCategoryIcon(cat.icon)}
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-text-muted mt-1.5 leading-relaxed line-clamp-2">
                      {cat.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40">
                  <div
                    className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${cat.is_active ? "text-success" : "text-text-faint"}`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${cat.is_active ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-text-faint"}`}
                    />
                    {cat.is_active ? "Active" : "Archived"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => startEdit(cat)}
                      variant="ghost"
                      size="icon-sm"
                      className="text-text-muted hover:text-foreground hover:bg-surface-2/60 cursor-pointer"
                      title="Edit Category"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      onClick={() => handleDelete(cat.id)}
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full py-20 text-center border border-dashed border-border/40 rounded-2xl bg-surface-1/10 backdrop-blur-xs flex flex-col items-center">
              <AlertCircle size={40} className="text-text-faint/80 mb-3" />
              <p className="font-bold text-sm text-foreground">
                No Taxonomy Defined
              </p>
              <p className="text-xs text-text-muted mt-0.5 mb-6">
                Start by creating your first service category.
              </p>
              <Button
                onClick={() => setShowForm(true)}
                variant="outline"
                className="cursor-pointer"
              >
                Get Started
              </Button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Edit/Create Form */}

      {/* Category Modal Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edit Category" : "New Category"}
            </DialogTitle>
            <DialogDescription>
              Configure the marketplace categorization properties.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Label Name
                </label>
                <Input
                  placeholder="e.g. Specialized Healthcare"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Icon Emoji/Token
                </label>
                <Input
                  placeholder="🏥 or Lucide Key"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Marketplace Description
              </label>
              <textarea
                className="w-full resize-none rounded-lg border border-border-light bg-surface-1/60 text-foreground transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-3 placeholder:text-text-faint/60 text-sm h-28"
                placeholder="How should this category be presented to customers?"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => setShowForm(false)}
                variant="outline"
                className="cursor-pointer"
              >
                Discard
              </Button>
              <Button type="submit" className="cursor-pointer gap-1.5">
                <Check size={14} />{" "}
                {editId ? "Save Changes" : "Deploy Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
