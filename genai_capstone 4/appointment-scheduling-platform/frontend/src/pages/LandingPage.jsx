import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { Calendar, ArrowRight, Shield, Zap, Clock, Award, ChevronDown, ChevronUp, Quote, Mail, MapPin, PhoneCall } from "lucide-react";
import { FaTwitter, FaGithub, FaLinkedin } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

const CountUp = ({ end, suffix = "", duration = 2000, decimals = 0 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      const ease = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
      setCount(end * ease);
      if (percentage < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <>{count.toFixed(decimals)}{suffix}</>;
};
const FEATURES = [
  {
    icon: Zap,
    title: "Instant Booking Engine",
    desc: "Experience zero latency. Book your next session in under 15 seconds with our hyper-optimized scheduling engine. Say goodbye to endless email threads and waiting times.",
    color: "var(--color-status-confirmed)"
  },
  {
    icon: Award,
    title: "Top-Tier Vetted Experts",
    desc: "Every provider is manually vetted for credentials, experience, and quality, ensuring you only ever book with the absolute best in the industry. Quality is our standard.",
    color: "var(--color-success)"
  },
  {
    icon: Shield,
    title: "Protected Payments",
    desc: "Your transactions are shielded with industry-standard AES-256 encryption via Razorpay. Pay once, book securely, rest easy with full refund guarantees for early cancellations.",
    color: "var(--color-info)"
  },
  {
    icon: Clock,
    title: "Dynamic Availability",
    desc: "Real-time conflict resolution ensures no double-bookings ever. Our continuous state-machine keeps your schedule airtight and perfectly synchronized across timezones.",
    color: "var(--color-status-pending)"
  },
  {
    icon: Calendar,
    title: "Smart Reminders",
    desc: "Never miss a session. Receive automated, timely notifications via email and SMS before your appointments to keep your schedule running perfectly on time.",
    color: "var(--color-primary)"
  },
  {
    icon: MapPin,
    title: "Local & Global Reach",
    desc: "Whether you need a local professional or a global consultant, our platform bridges the gap, offering specialized experts tailored to your exact geographical and professional needs.",
    color: "var(--color-accent)"
  }
];

const CATEGORIES = [
  { name: "Healthcare", icon: "🏥", color: "from-emerald-500/10 to-green-500/10" },
  { name: "Beauty", icon: "💆", color: "from-pink-500/10 to-rose-500/10" },
  { name: "Legal", icon: "⚖️", color: "from-slate-500/10 to-gray-500/10" },
  { name: "Consulting", icon: "💼", color: "from-amber-500/10 to-orange-500/10" },
  { name: "Education", icon: "📚", color: "from-emerald-500/10 to-teal-500/10" },
  { name: "Fitness", icon: "🏋️", color: "from-cyan-500/10 to-blue-500/10" },
  { name: "Home Services", icon: "🔧", color: "from-orange-500/10 to-amber-500/10" },
  { name: "Mental Health", icon: "🧠", color: "from-teal-500/10 to-emerald-500/10" },
];

const FAQ_ITEMS = [
  {
    q: "How does the instant vetting conflict system work?",
    a: "Schedex acts as a continuous state-machine integrated with your provider's calendar. When they specify availability, any booked slots or real-time conflicts automatically trigger checks, ensuring no slot can ever be double-booked across any timezone."
  },
  {
    q: "How are payments managed and is it secure?",
    a: "Every transaction is processed with maximum security via Razorpay Checkout. Fees are locked immediately upon scheduling and only settled securely under verified session logs. We never store your credit card information directly."
  },
  {
    q: "Can I easily reschedule or request cancellations?",
    a: "Absolutely. Schedex allows inline customer-led rescheduling or cancellation directly from the appointment details interface. Our cancellation policies are transparent, and free cancellations are typically available up to 24 hours prior to the session."
  },
  {
    q: "Are the service professionals verified?",
    a: "Yes. Every single provider on our platform undergoes a strict manual vetting process. We verify their credentials, experience, and past reviews to ensure a premium standard of service."
  },
  {
    q: "Can I use Schedex for my entire organization?",
    a: "Certainly! We offer specialized administrative dashboards and organization-level management tools, making it easy to manage schedules, track payments, and onboard multiple providers under one unified clinic or firm."
  }
];

const TESTIMONIALS = [
  {
    quote: "Schedex completely revolutionized how we run our therapy clinic. Booking rates increased by 45% within three weeks of integration, and double-bookings are a thing of the past.",
    author: "Dr. Sarah Jenkins",
    role: "Clinical Director, HealthSpace",
    portrait: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80"
  },
  {
    quote: "The Razorpay integration and instant scheduling checks solved our manual coordination issues entirely. Customer feedback has been outstanding since day one.",
    author: "Rajesh Malhotra",
    role: "Founder, Peak Consulting Group",
    portrait: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80"
  },
  {
    quote: "As an independent consultant, managing time zones and payments was a nightmare. Schedex automated everything, allowing me to focus entirely on my clients.",
    author: "Elena Rodriguez",
    role: "Senior Marketing Consultant",
    portrait: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
  }
];

export default function LandingPage() {
  const { isAuthenticated, role } = useSelector((s) => s.auth);
  const dashMap = { customer: "/customer/dashboard", provider: "/provider/dashboard", admin: "/admin/dashboard" };

  const [openFaq, setOpenFaq] = useState(null);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const STEPS = [
    {
      title: "1. Choose your Category",
      desc: "Browse vetted professionals across healthcare, legal, beauty, consulting, and more.",
      detail: "Manually vetted experts only."
    },
    {
      title: "2. Select Perfect Slot",
      desc: "Real-time calendar syncing ensures zero double-booking or scheduling friction.",
      detail: "Locks availability instantly."
    },
    {
      title: "3. Pay & Meet Seamlessly",
      desc: "Complete booking with secure Razorpay checkouts and launch your session.",
      detail: "100% money-back guarantee."
    }
  ];

  return (
    <div className="relative isolate overflow-hidden min-h-screen bg-transparent">
      {/* ── Bounded Hero Background Elements (Optimized to First Fold) ── */}
      <div className="absolute top-0 left-0 right-0 h-[100vh] min-h-[750px] max-h-[1000px] overflow-hidden -z-20 pointer-events-none">
        <div className="absolute inset-0 bg-blue-950/30" />
        <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-[radial-gradient(var(--color-primary)_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.05] dark:opacity-[0.09]" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 blur-[64px] rounded-full animate-pulse-slow will-change-transform transform-gpu" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-accent/5 blur-[64px] rounded-full animate-blob will-change-transform transform-gpu" />
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        >
          <source src="/mushroom.mp4" type="video/mp4" />
        </video>
        {/* Soft bottom fade to blend background elements seamlessly with content below */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
      </div>

      {/* ── Hero Section ────────────────────────────────── */}
      <section className="relative px-6 pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

          {/* Left Column: Heading & CTAs */}
          <div className="col-span-1 lg:col-span-6 flex flex-col text-left">
            <div className="inline-flex items-center gap-2 self-start px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6 animate-fade-in">
              <SparkleIcon className="w-3 h-3 text-accent animate-spin-slow" /> Over <CountUp end={10000} suffix="+" /> Appointments Completed
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] mb-5 animate-slide-up text-foreground">
              The New Standard in <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary animate-gradient-x font-black inline-block animate-heartbeatText">
                Modern Scheduling.
              </span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed animate-fade-in [animation-delay:200ms]">
              Eliminate back-and-forth emails. Book, manage, and scale your services
              with a platform designed for the speed of modern life.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center animate-fade-in [animation-delay:400ms]">
              {isAuthenticated ? (
                <Button size="lg" className="px-8 h-12 text-sm font-semibold shadow-brand group cursor-pointer" render={<Link to={dashMap[role]} />}>
                  Back to Dashboard <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              ) : (
                <>
                  <Button size="lg" className="px-8 h-12 text-sm font-semibold shadow-brand group cursor-pointer" render={<Link to="/signup" />}>
                    Get Started for Free <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <Button size="lg" variant="outline" className="px-8 h-12 text-sm font-semibold border-border hover:bg-muted/10 cursor-pointer" render={<Link to="/login" />}>
                    Sign In
                  </Button>
                </>
              )}
            </div>

            {/* Micro Stats */}
            <div className="grid grid-cols-3 gap-4 mt-10 pt-6 border-t border-border/50 animate-fade-in [animation-delay:500ms]">
              <div>
                <p className="text-xl md:text-2xl font-black text-foreground"><CountUp end={99.9} decimals={1} suffix="%" duration={1500} /></p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Uptime</p>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-foreground"><CountUp end={15} suffix="s" duration={1500} /></p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Booking speed</p>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-foreground">Secure</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Razorpay checkouts</p>
              </div>
            </div>
          </div>

          {/* Right Column: Premium Mockup Graphic */}
          <div className="col-span-1 lg:col-span-6 relative flex justify-center lg:justify-end animate-fade-in [animation-delay:300ms]">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/20 blur-[100px] rounded-full animate-pulse-slow -z-10" />
            <div className="absolute top-1/4 right-1/4 w-56 h-56 bg-accent/20 blur-[80px] rounded-full animate-blob -z-10" />

            <div className="relative glass-card border border-border/80 shadow-2xl rounded-2xl overflow-hidden animate-float min-w-full lg:min-w-[105%] lg:-mr-6 scale-95 origin-right">
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-transparent to-transparent z-10 pointer-events-none" />
              <img
                src="/image.png"
                alt="Schedex Scheduling Dashboard Mockup"
                className="w-full h-auto object-contain shadow-brand transform hover:scale-[1.02] transition-transform duration-500"
              />
            </div>
          </div>

        </div>
      </section>

      {/* ── Feature Grid ────────────────────────────────── */}
      <section className="px-6 py-16 bg-muted/20 border-y border-border/50 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none opacity-50" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-extrabold mb-3 text-foreground tracking-tight">Engineered for Excellence</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">Built with precision for the most demanding, fast-paced service environments.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc, color }, idx) => (
              <Card
                key={title}
                className="bg-card border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 animate-fade-in group hover:-translate-y-1"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-white/5 border border-border/60 shadow-sm group-hover:scale-110 group-hover:border-primary/40 transition-all duration-300">
                    <Icon size={20} style={{ color }} />
                  </div>
                  <h3 className="text-base font-bold mb-2 tracking-tight text-foreground group-hover:text-primary transition-colors">{title}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works Step-by-Step Visualizer ─────────── */}
      <section className="px-6 py-16 border-b border-border/50 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-4xl font-extrabold mb-3 text-foreground tracking-tight">Three Steps to Perfection</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">We've simplified scheduling so you can focus on what matters most.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Interactive Step Selector */}
          <div className="col-span-1 lg:col-span-5 space-y-4">
            {STEPS.map((step, idx) => (
              <div
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`p-5 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col gap-1.5 ${activeStep === idx
                    ? "bg-card border-primary shadow-brand shadow-primary/5 translate-x-2"
                    : "bg-transparent border-border/50 hover:border-border hover:bg-muted/10"
                  }`}
              >
                <h4 className={`font-bold text-base ${activeStep === idx ? "text-primary" : "text-foreground"}`}>
                  {step.title}
                </h4>
                <p className="text-muted-foreground text-xs leading-relaxed">{step.desc}</p>
                {activeStep === idx && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-accent mt-1 inline-flex items-center gap-1">
                    ✓ {step.detail}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Right Column: Rich Visual Preview */}
          <div className="col-span-1 lg:col-span-7 bg-card border border-border/80 shadow-2xl rounded-2xl p-6 relative overflow-hidden min-h-[300px] flex flex-col justify-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] rounded-full" />

            {activeStep === 0 && (
              <div className="space-y-5 animate-fade-in scale-95">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🏥</span>
                  <div>
                    <h3 className="text-lg font-bold">Healthcare Experts</h3>
                    <p className="text-[11px] text-muted-foreground">Certified pediatricians, therapists, & specialists</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {["Therapy", "Consulting", "Legal", "Beauty", "Fitness", "Design"].map((cat) => (
                    <div key={cat} className="p-2.5 border border-border/80 rounded-lg text-center font-bold text-xs bg-muted/20">
                      {cat}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeStep === 1 && (
              <div className="space-y-5 animate-fade-in scale-95">
                <div className="border border-border/80 rounded-xl p-4 bg-muted/10">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-sm">Select Appointment Slot</span>
                    <span className="text-xs text-primary font-bold">May 2026</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {["09:00 AM", "10:30 AM", "01:00 PM", "03:30 PM"].map((t, i) => (
                      <button key={t} className={`p-1.5 border rounded-md text-[10px] font-bold transition-all ${i === 1 ? "bg-primary text-white border-primary" : "border-border hover:bg-primary/5"
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground text-center font-semibold">🔄 Conflicting slots are automatically greyed out in real time.</p>
              </div>
            )}

            {activeStep === 2 && (
              <div className="space-y-5 animate-fade-in text-center scale-95">
                <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto text-accent text-2xl">
                  ✓
                </div>
                <div>
                  <h3 className="text-lg font-bold">Booking Confirmed</h3>
                  <p className="text-[11px] text-muted-foreground mt-1">Receipt, session links & reminders have been dispatched.</p>
                </div>
                <div className="inline-flex gap-2 items-center justify-center px-4 py-2 border border-border/60 bg-muted/10 rounded-lg text-[10px] uppercase tracking-wider font-bold">
                  <span>Razorpay Payment Verified</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Category Showcase ────────────────────────────── */}
      <section className="px-6 py-16 border-b border-border/50 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-10 gap-4">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-4xl font-extrabold mb-3 text-foreground tracking-tight">Discover Top Providers</h2>
            <p className="text-muted-foreground text-sm">From routine medical consultations to professional legal advisory, find verified experts.</p>
          </div>
          <Button variant="link" className="p-0 text-primary font-bold group h-auto cursor-pointer text-sm" render={<Link to="/customer/providers" className="inline-flex items-center gap-1" />}>
            View all categories <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORIES.map(({ name, icon, color }, idx) => (
            <Link
              key={name}
              to={isAuthenticated ? `/customer/providers?category=${encodeURIComponent(name)}` : "/signup"}
              className="glass-card-hover p-6 text-center animate-fade-in group flex flex-col items-center justify-center border border-border bg-card shadow-sm"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="text-3xl mb-3 grayscale group-hover:grayscale-0 transition-all transform group-hover:scale-110 duration-300">{icon}</div>
              <p className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{name}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Testimonials Section ────────────────────────── */}
      <section className="px-6 py-16 bg-muted/10 border-b border-border/50 overflow-hidden relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/5 blur-[120px] rounded-full -z-10" />
        <div className="max-w-4xl mx-auto text-center relative">
          <h2 className="text-2xl md:text-4xl font-extrabold mb-10 text-foreground tracking-tight">Trusted by Professionals</h2>

          <div className="relative min-h-[180px] flex items-center justify-center">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className={`transition-all duration-500 absolute w-full max-w-xl px-4 ${activeTestimonial === idx
                    ? "opacity-100 translate-y-0 relative z-10 scale-100"
                    : "opacity-0 translate-y-4 absolute pointer-events-none scale-95"
                  }`}
              >
                <Quote className="w-8 h-8 text-primary/10 mx-auto mb-4" />
                <p className="text-base md:text-lg font-medium text-foreground leading-relaxed italic mb-6">
                  "{t.quote}"
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Avatar className="w-10 h-10 rounded-full border border-border/80 overflow-hidden shadow-sm">
                    <img src={t.portrait} className="w-full h-full object-cover" alt={t.author} />
                  </Avatar>
                  <div className="text-left">
                    <h4 className="font-extrabold text-xs text-foreground">{t.author}</h4>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 mt-8 z-10 relative">
            {TESTIMONIALS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTestimonial(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${activeTestimonial === idx ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
                  }`}
                aria-label={`Testimonial slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ Accordion Section ────────────────────────── */}
      <section className="px-6 py-16 max-w-3xl mx-auto border-b border-border/50">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-4xl font-extrabold mb-3 text-foreground tracking-tight">Frequently Asked Questions</h2>
          <p className="text-muted-foreground text-sm">Everything you need to know about the Schedex platform.</p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => (
            <Card key={idx} className="border border-border bg-card overflow-hidden transition-all duration-300">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full px-5 py-4 flex items-center justify-between font-bold text-sm text-foreground hover:bg-primary/5 transition-colors text-left cursor-pointer"
              >
                <span>{item.q}</span>
                {openFaq === idx ? (
                  <ChevronUp size={16} className="text-primary shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                )}
              </button>

              <div
                className={`transition-all duration-300 ease-in-out ${openFaq === idx
                    ? "max-h-[300px] border-t border-border/50 opacity-100 p-5 bg-muted/10"
                    : "max-h-0 opacity-0 pointer-events-none"
                  }`}
                style={{ overflow: "hidden" }}
              >
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  {item.a}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Final Call to Action ─────────────────────────── */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-5xl mx-auto">
          <Card className="bg-card border-border p-12 md:p-20 relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-80 h-80 bg-primary/10 blur-[120px] rounded-full group-hover:scale-110 transition-transform duration-1000" />
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-80 h-80 bg-primary/5 blur-[120px] rounded-full group-hover:scale-110 transition-transform duration-1000" />

            <CardContent className="relative z-10 flex flex-col items-center p-0">
              <h2 className="text-3xl md:text-5xl font-extrabold mb-6 tracking-tight text-foreground leading-tight">Start Redefining Your Schedule</h2>
              <p className="text-muted-foreground text-sm md:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                Join thousands of customers and service professionals who rely on Schedex to eliminate friction and book instantly.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
                <Button size="lg" className="px-10 h-13 font-semibold shadow-brand cursor-pointer" render={<Link to="/signup?role=customer" />}>
                  Join as Customer
                </Button>
                <Button size="lg" variant="outline" className="px-10 h-13 font-semibold border-border hover:bg-muted/10 cursor-pointer" render={<Link to="/signup?role=provider" />}>
                  Register as Provider
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="pt-20 pb-10 border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">

            {/* Brand & Newsletter */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary text-primary-foreground shadow-lg">
                  <Calendar size={22} />
                </div>
                <span className="font-heading font-extrabold text-2xl tracking-tight text-foreground">Schedex</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-sm">
                The new standard in modern scheduling. Book, manage, and scale your services with zero latency and absolute security.
              </p>
              <div className="space-y-3 max-w-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">Subscribe to our newsletter</p>
                <div className="flex gap-2">
                  <Input placeholder="Enter your email" className="bg-background border-border text-sm h-10" />
                  <Button className="h-10 px-4">Subscribe</Button>
                </div>
              </div>
            </div>

            {/* Links Column 1 */}
            <div>
              <h4 className="font-bold text-foreground mb-5">Product</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Changelog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">API Documentation</a></li>
              </ul>
            </div>

            {/* Links Column 2 */}
            <div>
              <h4 className="font-bold text-foreground mb-5">Solutions</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Healthcare</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Legal Practices</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Consulting Firms</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Salons & Beauty</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Enterprise</a></li>
              </ul>
            </div>

            {/* Links Column 3 */}
            <div>
              <h4 className="font-bold text-foreground mb-5">Company</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Partners</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-medium">
              <p>© 2026 Schedex Platforms Inc. All rights reserved.</p>
              <div className="flex gap-4">
                <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-foreground transition-colors">Cookie Settings</a>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <a href="#" className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all">
                <FaTwitter size={16} />
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all">
                <FaGithub size={16} />
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all">
                <FaLinkedin size={16} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SparkleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" /><path d="M3 5h4" /><path d="m19 17 3 3" /><path d="m22 17-3 3" />
    </svg>
  );
}
