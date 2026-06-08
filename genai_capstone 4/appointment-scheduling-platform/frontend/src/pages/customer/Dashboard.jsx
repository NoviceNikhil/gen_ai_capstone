import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Calendar, Clock, CheckCircle, XCircle, Search, ArrowRight, Sparkles, TrendingUp, MessageSquare, Send, X } from "lucide-react";
import { fetchCustomerDashboard } from "../../store/appointmentSlice";
import StatCard from "../../components/ui/StatCard";
import StatusBadge from "../../components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { getProviderPortrait } from "../../utils/portraits";
import { getMyAppointmentsAPI } from "../../services/apiService";

export default function CustomerDashboard() {
  const dispatch = useDispatch();
  const { dashboardStats, loading } = useSelector((s) => s.appointments);
  const { user } = useSelector((s) => s.auth);

  const [activeFilter, setActiveFilter] = useState("upcoming");
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  // Chat Drawer State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatProvider, setChatProvider] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => { 
    dispatch(fetchCustomerDashboard()); 
  }, [dispatch]);

  const stats = dashboardStats || {};

  // Handle active status filtering
  useEffect(() => {
    if (activeFilter === "upcoming" && stats.upcoming_appointments) {
      setFilteredAppointments(stats.upcoming_appointments);
      return;
    }

    setListLoading(true);
    const params = {};
    if (activeFilter !== "all") {
      params.status = activeFilter;
    }
    
    getMyAppointmentsAPI(params)
      .then((res) => {
        setFilteredAppointments(res.data?.data?.appointments || []);
      })
      .catch((err) => {
        console.error("Failed to fetch filtered appointments", err);
      })
      .finally(() => {
        setListLoading(false);
      });
  }, [activeFilter, stats.upcoming_appointments]);

  // Scroll to bottom when chat updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isTyping]);

  // Handle opening chat
  const handleOpenChat = (e, provider, apptId) => {
    e.preventDefault();
    e.stopPropagation();
    
    setChatProvider(provider);
    setChatOpen(true);
    
    // Initial friendly greetings
    setChatMessages([
      {
        id: "init",
        sender: "provider",
        text: `Hello! I'm looking forward to our scheduled session on Schedex. Do you have any specific goals or topics you would like to prepare for?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Handle sending user message and simulation sequence
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: userText,
      time: timeStr
    };

    setChatMessages(prev => [...prev, newMsg]);
    setChatInput("");
    setIsTyping(true);

    // Simulate typing delay
    setTimeout(() => {
      setIsTyping(false);
      
      let replyText = "Thank you for the update! I have carefully noted your preferences down and will make sure our session covers exactly what you need. See you soon!";
      const lower = userText.toLowerCase();

      if (lower.includes("hi") || lower.includes("hello")) {
        replyText = `Hello! It is great to connect with you here. Let me know how I can help prepare for our session.`;
      } else if (lower.includes("prep") || lower.includes("prepare") || lower.includes("document") || lower.includes("file")) {
        replyText = `For preparation, it would be extremely helpful if you could gather any recent work, logs, or specific questions you have. We will make the absolute best use of our time!`;
      } else if (lower.includes("reschedule") || lower.includes("change") || lower.includes("cancel")) {
        replyText = `If you need to change our schedule, you can easily use the standard rescheduling options on the Schedex appointments details page, or let me know your proposed time slots here!`;
      }

      setChatMessages(prev => [...prev, {
        id: `provider-${Date.now()}`,
        sender: "provider",
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 1500);
  };

  const getListTitle = () => {
    switch (activeFilter) {
      case "upcoming": return "Upcoming Sessions";
      case "completed": return "Completed Sessions";
      case "cancelled": return "Cancelled Sessions";
      default: return "All Sessions";
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in min-h-screen relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-1">
            Hello, <span className="text-primary">{user?.full_name?.split(" ")[0]}</span> 👋
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Your schedule is looking good. You have {loading ? "..." : stats.upcoming || 0} upcoming sessions.
          </p>
        </div>
        <div className="flex gap-3">
          <Button size="lg" className="group h-12 px-6" render={<Link to="/customer/providers" />}>
            <Search size={16} className="mr-2 group-hover:rotate-12 transition-transform" /> 
            Browse Marketplace
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
          label="Total Booked" 
          value={stats.total} 
          icon={Calendar} 
          color="var(--color-primary)" 
          trend={12} 
          loading={loading}
          onClick={() => setActiveFilter("all")}
          className={activeFilter === "all" ? "border-primary/80 ring-2 ring-primary/20" : "cursor-pointer"}
        />
        <StatCard 
          label="Upcoming" 
          value={stats.upcoming} 
          icon={Clock} 
          color="var(--color-status-confirmed)" 
          loading={loading}
          onClick={() => setActiveFilter("upcoming")}
          className={activeFilter === "upcoming" ? "border-primary/80 ring-2 ring-primary/20" : "cursor-pointer"}
        />
        <StatCard 
          label="Completed" 
          value={stats.completed} 
          icon={CheckCircle} 
          color="var(--color-success)" 
          trend={5} 
          loading={loading}
          onClick={() => setActiveFilter("completed")}
          className={activeFilter === "completed" ? "border-primary/80 ring-2 ring-primary/20" : "cursor-pointer"}
        />
        <StatCard 
          label="Cancelled" 
          value={stats.cancelled} 
          icon={XCircle} 
          color="var(--color-status-cancelled)" 
          loading={loading}
          onClick={() => setActiveFilter("cancelled")}
          className={activeFilter === "cancelled" ? "border-primary/80 ring-2 ring-primary/20" : "cursor-pointer"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content: Filtered Appointments */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles size={18} className="text-accent" />
              {getListTitle()}
            </h2>
            <Button variant="link" className="p-0 text-primary font-semibold text-xs uppercase tracking-wider hover:underline h-auto" render={<Link to="/customer/appointments" />}>
              View History
            </Button>
          </div>

          {loading || listLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-5 rounded-xl border border-border bg-card/40 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-muted" />
                    <div className="space-y-2">
                      <div className="w-[140px] h-[14px] bg-muted rounded" />
                      <div className="w-[100px] h-[12px] bg-muted rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-6 bg-muted rounded" />
                    <div className="w-4 h-4 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAppointments.length > 0 ? (
            <div className="grid gap-4">
              {filteredAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="sweep-card animate-entrance p-5 relative overflow-hidden"
                >
                  <div className="sweep-reveal-content flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <Link to={`/customer/appointments/${appt.id}`} className="flex items-center gap-4 flex-1">
                      <Avatar className="w-14 h-14 rounded-2xl border border-white/10 shadow-sm overflow-hidden flex-shrink-0">
                        <img 
                          src={getProviderPortrait(appt.provider?.id, appt.provider?.specialization, appt.provider?.user?.full_name)} 
                          className="w-full h-full object-cover" 
                          alt={appt.provider?.user?.full_name}
                        />
                      </Avatar>
                      <div>
                        <p className="font-bold text-base leading-none mb-1.5 hover:text-primary transition-colors flex items-center gap-2">
                          {appt.provider?.user?.full_name}
                          {appt.provider?.specialization && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                              {appt.provider.specialization}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                          <Calendar size={12} /> {appt.appointment_date} 
                          <span className="opacity-40">•</span>
                          <Clock size={12} /> {appt.time_slot}
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 pt-3 sm:pt-0 border-border/40 z-10">
                      <StatusBadge status={appt.status} />
                      
                      {appt.status !== "cancelled" && appt.status !== "rejected" && (
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-8 text-xs font-bold gap-1 px-3 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border-transparent transition-colors"
                          onClick={(e) => handleOpenChat(e, appt.provider, appt.id)}
                        >
                          <MessageSquare size={13} />
                          Chat
                        </Button>
                      )}

                      <Link to={`/customer/appointments/${appt.id}`}>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-muted rounded-full">
                          <ArrowRight size={14} className="text-muted-foreground hover:text-foreground" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Calendar size={28} className="text-muted-foreground/60" />
                </div>
                <h3 className="font-bold text-lg mb-1 text-foreground">No sessions found</h3>
                <p className="text-muted-foreground text-sm max-w-sm mb-6">
                  You don't have any appointments matching this category. Ready to browse expert providers?
                </p>
                <Button render={<Link to="/customer/providers" />}>
                  Explore Marketplace
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: Insights / Quick Actions */}
        <div className="space-y-5">
          <h2 className="text-xl font-bold tracking-tight font-heading">Quick Actions</h2>
          <Card className="border-border bg-card">
            <CardContent className="p-5 space-y-4">
              <Link 
                to="/customer/providers" 
                className="flex items-center justify-between p-4 rounded-xl bg-background border border-border hover:bg-primary/5 hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary"><Search size={16} /></div>
                  <span className="font-bold text-sm text-foreground">Find New Provider</span>
                </div>
                <ChevronRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
              
              <div className="p-5 rounded-xl bg-gradient-to-br from-accent/10 to-primary/5 border border-border relative overflow-hidden">
                <TrendingUp className="absolute -right-2 -bottom-2 w-20 h-20 text-foreground/5 -rotate-12" />
                <h4 className="font-bold text-xs mb-1 uppercase tracking-wider text-accent">Pro Tip</h4>
                <p className="text-xs text-muted-foreground leading-relaxed relative z-10 font-medium">
                  Providers who offer video consultations have a 40% higher completion rate. Check for the video badge!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Simulated Live Chat Drawer Overlay */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="drawer-backdrop fixed inset-0 bg-background/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setChatOpen(false)}
          />
          
          {/* Drawer Pane */}
          <div className="drawer-pane relative w-full max-w-md h-full bg-card border-l border-border flex flex-col shadow-2xl z-10">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border/80 flex items-center justify-between bg-surface-1">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
                    <img 
                      src={getProviderPortrait(chatProvider?.id, chatProvider?.specialization, chatProvider?.user?.full_name)} 
                      className="w-full h-full object-cover" 
                      alt={chatProvider?.user?.full_name}
                    />
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-card" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground leading-tight">
                    {chatProvider?.user?.full_name}
                  </h4>
                  <p className="text-[10px] font-bold text-accent uppercase tracking-wider">
                    {chatProvider?.specialization || "Professional Expert"}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full h-8 w-8 hover:bg-muted text-muted-foreground"
                onClick={() => setChatOpen(false)}
              >
                <X size={16} />
              </Button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-background/40">
              {chatMessages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex flex-col max-w-[80%] ${msg.sender === "user" ? "ml-auto items-end animate-slide-up" : "items-start animate-slide-up"}`}
                >
                  <div 
                    className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm font-medium ${
                      msg.sender === "user" 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-surface-1 border border-border text-foreground rounded-tl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-muted-foreground/80 mt-1 font-semibold">
                    {msg.time}
                  </span>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-2 max-w-[80%] items-start animate-pulse">
                  <div className="p-3 bg-surface-1 border border-border rounded-2xl rounded-tl-none flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-surface-1 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Message ${chatProvider?.user?.full_name?.split(" ")[0]}...`}
                className="flex-1 h-10 px-4 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 font-medium"
              />
              <Button 
                type="submit" 
                size="icon" 
                className="h-10 w-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl flex items-center justify-center transition-transform active:scale-95"
              >
                <Send size={15} />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronRight({ className, size }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

