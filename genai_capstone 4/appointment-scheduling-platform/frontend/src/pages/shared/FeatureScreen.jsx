import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function FeatureScreen({ title, subtitle, metrics = [], highlights = [], actions = [] }) {
  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">{title}</h1>
        <p className="text-sm md:text-base text-text-muted font-medium">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {metrics.map((metric) => (
          <div key={metric.label} className="glass-card p-5">
            <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3">{metric.label}</p>
            <p className="text-2xl font-black">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 glass-card p-6">
          <h2 className="text-xl font-black mb-5">What You Can Manage Here</h2>
          <div className="grid gap-4">
            {highlights.map((item) => (
              <article key={item.title} className="rounded-xl border border-border p-4 bg-surface-1">
                <h3 className="text-sm font-bold mb-1">{item.title}</h3>
                <p className="text-sm text-text-muted">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-black mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {actions.map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm font-bold hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <span>{action.label}</span>
                  <ArrowRight size={14} />
                </Link>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-2">Operational Note</p>
            <p className="text-sm text-text-muted leading-relaxed">
              These workflows are structured for production booking operations and can be integrated with backend APIs incrementally.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-accent font-semibold">
              <CheckCircle2 size={16} />
              Screen scaffold is ready for API wiring
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
