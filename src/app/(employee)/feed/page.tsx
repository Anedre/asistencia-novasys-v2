"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Lock,
  Loader2,
  Megaphone,
  Users,
  ImageIcon,
  X,
  Smile,
  Cake,
  Trophy,
  Calendar,
  Flag,
  TrendingUp,
  Hash,
  Sparkles,
  Building2,
  UserCircle,
  BarChart3,
  CalendarCheck,
  Trophy as TrophyIcon,
} from "lucide-react";
import {
  useFeed,
  useCreatePost,
} from "@/hooks/use-feed";
import { useTodayStatus, useWeekSummary } from "@/hooks/use-attendance";
import { FeedEmbed } from "@/components/feed/feed-embed";
import type { PostEmbed } from "@/lib/types/post";
import { PostCard } from "@/components/feed/post-card";
import { useSession } from "next-auth/react";
import { useMyProfile } from "@/hooks/use-employee";
import { useHREvents } from "@/hooks/use-hr";
import { useTenantConfig } from "@/hooks/use-tenant";
import { useTenantTimezone, todayInTz } from "@/hooks/use-timezone";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PostVisibility } from "@/lib/types/post";
import type { BirthdayEntry, AnniversaryEntry } from "@/lib/types";

/* ── Constants ─────────────────────────────────────────────────── */

const MAX_CHARS = 500;

const VISIBILITY_OPTIONS: {
  value: PostVisibility;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "company", label: "Empresa", icon: Globe },
  { value: "area", label: "Mi Área", icon: Users },
  { value: "private", label: "Solo yo", icon: Lock },
];

type FeedTab = "all" | "company" | "area";

/* ── Helpers ───────────────────────────────────────────────────── */

function ComposerAvatar({ name, src }: { name: string; src?: string }) {
  if (src) {
    return <img src={src} alt={name} className="size-10 rounded-full object-cover shrink-0 ring-1 ring-border" />;
  }
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0 ring-1 ring-primary/20">
      {initials}
    </div>
  );
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

/* ── Skeletons ─────────────────────────────────────────────────── */

function FeedSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 px-4 py-5 animate-pulse">
          <Skeleton className="size-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function FeedPage() {
  const { data: session } = useSession();
  const { data: profileData } = useMyProfile();
  const { data, isLoading } = useFeed();
  const createPost = useCreatePost();
  const { data: tenant } = useTenantConfig();
  const tz = useTenantTimezone();
  const todayDate = todayInTz(tz);
  const monthStr = todayDate.substring(0, 7);
  const { data: hrData } = useHREvents(monthStr);

  /* attendance data for share */
  const { data: todayStatus } = useTodayStatus();
  const { data: weekData } = useWeekSummary(0);

  /* state */
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("company");
  const [isFocused, setIsFocused] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const [pendingEmbed, setPendingEmbed] = useState<PostEmbed | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* derived */
  const posts = data?.posts ?? [];
  const currentUserId = (session?.user as { employeeId?: string })?.employeeId ?? "";
  const currentArea = (session?.user as { area?: string })?.area ?? "";
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
  const userName = (session?.user as { name?: string })?.name ?? "Usuario";
  const userAvatar = profileData?.PhotoURL ?? (session?.user as { image?: string })?.image ?? undefined;

  const charCount = content.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canPublish = (content.trim().length > 0 || imagePreview || pendingEmbed) && !isOverLimit && !createPost.isPending;
  const showActionBar = isFocused || content.trim().length > 0 || !!imagePreview || !!pendingEmbed;

  /* filtered posts by tab */
  const filteredPosts = useMemo(() => {
    let list = posts;
    if (activeTab === "company") list = list.filter((p) => p.Visibility === "company");
    if (activeTab === "area") list = list.filter((p) => p.Visibility === "area" && p.TargetArea === currentArea);
    const pinned = list.filter((p) => p.IsPinned);
    const regular = list.filter((p) => !p.IsPinned);
    return [...pinned, ...regular];
  }, [posts, activeTab, currentArea]);

  /* HR data for sidebar */
  const todayBirthdays = useMemo(() => {
    const birthdays: BirthdayEntry[] = hrData?.birthdays ?? [];
    const dayStr = todayDate.substring(5);
    return birthdays.filter((b) => b.eventDate.substring(5) === dayStr);
  }, [hrData, todayDate]);

  const upcomingBirthdays = useMemo(() => {
    const birthdays: BirthdayEntry[] = hrData?.birthdays ?? [];
    const dayStr = todayDate.substring(5);
    return birthdays.filter((b) => b.eventDate.substring(5) !== dayStr).slice(0, 3);
  }, [hrData, todayDate]);

  const todayAnniversaries = useMemo(() => {
    const anniversaries: AnniversaryEntry[] = hrData?.anniversaries ?? [];
    const dayStr = todayDate.substring(5);
    return anniversaries.filter((a) => a.eventDate.substring(5) === dayStr);
  }, [hrData, todayDate]);

  const upcomingHolidays = useMemo(() => {
    const holidays = tenant?.settings?.holidays ?? [];
    const today = new Date(todayDate + "T12:00:00");
    return holidays
      .map((h) => ({ ...h, daysUntil: Math.floor((new Date(h.date + "T12:00:00").getTime() - today.getTime()) / 86400000) }))
      .filter((h) => h.daysUntil > 0 && h.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 3);
  }, [tenant, todayDate]);

  /* trending topics (fake from post content) */
  const trendingTopics = useMemo(() => {
    const words = new Map<string, number>();
    for (const p of posts) {
      const tokens = p.Content.split(/\s+/).filter((w) => w.length > 4);
      for (const t of tokens) {
        const w = t.toLowerCase().replace(/[^a-záéíóúñ]/g, "");
        if (w.length > 4) words.set(w, (words.get(w) ?? 0) + 1);
      }
    }
    return [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word, count]) => ({ word, count }));
  }, [posts]);

  /* auto-grow */
  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => { autoGrow(); }, [content, autoGrow]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (composerRef.current && !composerRef.current.contains(e.target as Node) && content.trim().length === 0 && !imagePreview && !pendingEmbed) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [content, imagePreview]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    // Delay so the opening click doesn't immediately close
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handleClick); };
  }, [showEmojiPicker]);

  const insertEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("La imagen no debe superar 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleShareToday = () => {
    if (!todayStatus) return;
    setPendingEmbed({
      type: "attendance_today",
      data: {
        date: todayStatus.date,
        status: todayStatus.status,
        firstIn: todayStatus.firstInLocal?.substring(0, 5) ?? "--:--",
        lastOut: todayStatus.lastOutLocal?.substring(0, 5) ?? "--:--",
        breakMinutes: todayStatus.breakMinutes,
        workedMinutes: todayStatus.workedMinutes,
        workedHHMM: todayStatus.workedHHMM,
        plannedMinutes: todayStatus.plannedMinutes,
        deltaMinutes: todayStatus.deltaMinutes,
      },
    });
    if (!content.trim()) setContent("Mi jornada de hoy 📊");
    setIsFocused(true);
  };

  const handleShareWeek = () => {
    if (!weekData) return;
    setPendingEmbed({
      type: "week_summary",
      data: {
        fromDate: weekData.fromDate,
        toDate: weekData.toDate,
        totalWorkedHHMM: weekData.totalWorkedHHMM,
        totalPlannedMinutes: weekData.totalPlannedMinutes,
        totalDeltaMinutes: weekData.totalDeltaMinutes,
        days: weekData.days.map((d) => ({
          date: d.date,
          weekday: d.weekday,
          workedMinutes: d.workedMinutes,
          status: d.status,
        })),
      },
    });
    if (!content.trim()) setContent("Mi resumen semanal 📅");
    setIsFocused(true);
  };

  const handleShareAchievement = () => {
    const completed = weekData?.days.filter((d) => ["OK", "CLOSED", "REGULARIZED"].includes(d.status)).length ?? 0;
    const balance = weekData?.totalDeltaMinutes ?? 0;
    setPendingEmbed({
      type: "achievement",
      data: {
        title: balance >= 0 ? "¡Semana completa!" : "¡Sigo avanzando!",
        description: balance >= 0 ? "Balance positivo esta semana" : "Cada día cuenta",
        stat: `${completed}`,
        statLabel: "jornadas",
        icon: balance >= 0 ? "trophy" : "flame",
      },
    });
    if (!content.trim()) setContent(balance >= 0 ? "¡Gran semana! 🏆" : "¡Seguimos adelante! 💪");
    setIsFocused(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublish) return;
    try {
      await createPost.mutateAsync({
        content: content.trim() || (pendingEmbed ? "Compartió datos de asistencia" : ""),
        visibility,
        ...(pendingEmbed && { embed: pendingEmbed }),
      });
      setContent("");
      setVisibility("company");
      setImagePreview(null);
      setPendingEmbed(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsFocused(false);
      toast.success("¡Publicación creada!");
    } catch { toast.error("Error al crear publicación"); }
  };

  const currentVis = VISIBILITY_OPTIONS.find((o) => o.value === visibility)!;
  const VisIcon = currentVis.icon;

  return (
    <div className="mx-auto max-w-5xl flex gap-6">
      {/* ════════════════════════════════════════════════════════════ */}
      {/* MAIN FEED COLUMN                                           */}
      {/* ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 max-w-xl">
        {/* Header + Tabs */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
          <div className="px-4 pt-3 pb-0">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">Feed</h1>
          </div>
          <div className="flex border-b-0 px-1">
            {([
              { key: "all" as FeedTab, label: "Para ti", icon: Sparkles },
              { key: "company" as FeedTab, label: "Empresa", icon: Building2 },
              { key: "area" as FeedTab, label: "Mi Área", icon: Users },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative",
                  activeTab === tab.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div ref={composerRef} className={cn("border-b transition-all duration-200", isFocused ? "bg-card shadow-sm" : "")}>
          <form onSubmit={handleSubmit} className="px-4 py-4">
            <div className="flex gap-3">
              <ComposerAvatar name={userName} src={userAvatar} />
              <div className="flex-1 min-w-0">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  placeholder="¿Qué quieres compartir con tu equipo?"
                  rows={1}
                  className={cn(
                    "w-full resize-none bg-transparent text-[15px] leading-relaxed",
                    "placeholder:text-muted-foreground/50",
                    "border-0 outline-none ring-0 focus:ring-0 focus:outline-none",
                    "py-2 min-h-[44px] transition-[min-height] duration-200",
                    isFocused && "min-h-[80px]",
                  )}
                />
                {imagePreview && (
                  <div className="relative mt-2 rounded-xl overflow-hidden border">
                    <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover" />
                    <button type="button" onClick={() => { setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors">
                      <X className="size-4" />
                    </button>
                  </div>
                )}
                {/* Embed preview */}
                {pendingEmbed && (
                  <div className="relative">
                    <FeedEmbed embed={pendingEmbed} />
                    <button type="button" onClick={() => setPendingEmbed(null)}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors z-10">
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}
                <div className={cn(
                  "flex items-center justify-between gap-3 pt-3 border-t border-border/40 transition-all duration-200 ease-out",
                  showActionBar ? "opacity-100 max-h-24 mt-2" : "opacity-0 max-h-0 overflow-hidden mt-0 pt-0 border-t-0",
                )}>
                  <div className="flex items-center gap-1">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full p-2 text-primary hover:bg-primary/10 transition-colors" title="Agregar imagen">
                      <ImageIcon className="size-4" />
                    </button>
                    <div className="relative" ref={emojiRef}>
                      <button type="button" onClick={() => setShowEmojiPicker((p) => !p)}
                        className={cn("rounded-full p-2 text-primary hover:bg-primary/10 transition-colors", showEmojiPicker && "bg-primary/10")} title="Emoji">
                        <Smile className="size-4" />
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute left-0 top-full mt-2 z-50 w-[280px] rounded-xl border bg-popover shadow-xl animate-in fade-in zoom-in-95 duration-150">
                          <div className="p-2 border-b">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase px-1">Emojis</p>
                          </div>
                          <div className="p-2 max-h-48 overflow-y-auto">
                            <p className="text-[9px] text-muted-foreground px-1 mb-1">Caras</p>
                            <div className="grid grid-cols-8 gap-0.5 mb-2">
                              {["😀","😂","🥲","😍","🤩","😎","🤔","😅","😊","🥳","😤","🫡","🤗","😏","🙃","😴"].map((e) => (
                                <button key={e} type="button" onClick={() => insertEmoji(e)}
                                  className="flex size-8 items-center justify-center rounded-lg text-base hover:bg-muted transition-all hover:scale-125">{e}</button>
                              ))}
                            </div>
                            <p className="text-[9px] text-muted-foreground px-1 mb-1">Gestos</p>
                            <div className="grid grid-cols-8 gap-0.5 mb-2">
                              {["👍","👏","🔥","💪","🙌","🤝","✌️","🫶","❤️","💯","⭐","✨","🎉","🚀","🎯","💡"].map((e) => (
                                <button key={e} type="button" onClick={() => insertEmoji(e)}
                                  className="flex size-8 items-center justify-center rounded-lg text-base hover:bg-muted transition-all hover:scale-125">{e}</button>
                              ))}
                            </div>
                            <p className="text-[9px] text-muted-foreground px-1 mb-1">Trabajo</p>
                            <div className="grid grid-cols-8 gap-0.5">
                              {["💼","📊","📅","☕","🏆","✅","❌","⏰","📢","📝","🗓️","💻","📈","🔔","🎓","🏅"].map((e) => (
                                <button key={e} type="button" onClick={() => insertEmoji(e)}
                                  className="flex size-8 items-center justify-center rounded-lg text-base hover:bg-muted transition-all hover:scale-125">{e}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mx-1 h-5 w-px bg-border" />
                    <button type="button" onClick={handleShareToday} className="rounded-full p-2 text-blue-500 hover:bg-blue-500/10 transition-colors" title="Compartir mi jornada">
                      <BarChart3 className="size-4" />
                    </button>
                    <button type="button" onClick={handleShareWeek} className="rounded-full p-2 text-violet-500 hover:bg-violet-500/10 transition-colors" title="Compartir mi semana">
                      <CalendarCheck className="size-4" />
                    </button>
                    <button type="button" onClick={handleShareAchievement} className="rounded-full p-2 text-amber-500 hover:bg-amber-500/10 transition-colors" title="Compartir logro">
                      <TrophyIcon className="size-4" />
                    </button>
                    <div className="mx-1 h-5 w-px bg-border" />
                    <button type="button" onClick={() => { const idx = VISIBILITY_OPTIONS.findIndex((o) => o.value === visibility); setVisibility(VISIBILITY_OPTIONS[(idx + 1) % VISIBILITY_OPTIONS.length].value); }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
                      <VisIcon className="size-3.5" />{currentVis.label}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    {charCount > 0 && (
                      <>
                        <div className="relative size-5">
                          <svg className="size-5 -rotate-90" viewBox="0 0 20 20">
                            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
                            <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2"
                              strokeDasharray={`${Math.min(1, charCount / MAX_CHARS) * 50.26} 50.26`}
                              className={cn(isOverLimit ? "stroke-destructive" : charCount > MAX_CHARS * 0.8 ? "stroke-amber-500" : "stroke-primary")} />
                          </svg>
                        </div>
                        <div className="h-5 w-px bg-border" />
                      </>
                    )}
                    <Button type="submit" size="sm" disabled={!canPublish} className="rounded-full px-5 h-8 text-xs font-semibold">
                      {createPost.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Publicar"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Posts */}
        {isLoading ? (
          <FeedSkeleton />
        ) : filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20">
              <Megaphone className="size-10 text-primary" />
            </div>
            <h3 className="mt-5 text-lg font-semibold bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">¡Empieza la conversación!</h3>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              {activeTab === "all" ? "Sé el primero en compartir algo con tu equipo." : "No hay publicaciones en esta categoría."}
            </p>
            <Button className="mt-6 rounded-full px-6" onClick={() => { textareaRef.current?.focus(); setIsFocused(true); }}>
              Crear publicación
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredPosts.map((post) => (
              <PostCard key={post.PostID} post={post} currentUserId={currentUserId} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* SIDEBAR (hidden on mobile)                                  */}
      {/* ════════════════════════════════════════════════════════════ */}
      <aside className="hidden lg:block w-72 xl:w-80 shrink-0 space-y-4 pt-4">
        {/* Cumpleaños del día */}
        {todayBirthdays.length > 0 && (
          <SidebarCard title="🎂 Cumpleaños hoy" icon={Cake} iconColor="text-pink-500" accent="border-pink-200 dark:border-pink-900/30 bg-gradient-to-br from-pink-50/50 to-card dark:from-pink-950/10">
            {todayBirthdays.map((b) => (
              <div key={b.employeeId} className="flex items-center gap-2.5 py-1.5">
                <div className="flex size-8 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-950/30 text-xs font-semibold text-pink-600">
                  {getInitials(b.employeeName)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.employeeName}</p>
                  <p className="text-[11px] text-muted-foreground">{b.area}</p>
                </div>
              </div>
            ))}
          </SidebarCard>
        )}

        {/* Aniversarios del día */}
        {todayAnniversaries.length > 0 && (
          <SidebarCard title="🏆 Aniversarios hoy" icon={Trophy} iconColor="text-amber-500" accent="border-amber-200 dark:border-amber-900/30 bg-gradient-to-br from-amber-50/50 to-card dark:from-amber-950/10">
            {todayAnniversaries.map((a) => (
              <div key={a.employeeId} className="flex items-center gap-2.5 py-1.5">
                <div className="flex size-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30 text-xs font-semibold text-amber-600">
                  {getInitials(a.employeeName)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.employeeName}</p>
                  <p className="text-[11px] text-muted-foreground">{a.years} años en la empresa</p>
                </div>
              </div>
            ))}
          </SidebarCard>
        )}

        {/* Próximos cumpleaños */}
        {upcomingBirthdays.length > 0 && (
          <SidebarCard title="Próximos cumpleaños" icon={Calendar} iconColor="text-violet-500" accent="border-violet-200 dark:border-violet-900/30">
            {upcomingBirthdays.map((b) => (
              <div key={b.employeeId} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                    {getInitials(b.employeeName)}
                  </div>
                  <p className="text-sm truncate">{b.employeeName.split(" ")[0]}</p>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(b.eventDate + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </SidebarCard>
        )}

        {/* Próximos feriados */}
        {upcomingHolidays.length > 0 && (
          <SidebarCard title="Próximos feriados" icon={Flag} iconColor="text-indigo-500" accent="border-indigo-200 dark:border-indigo-900/30">
            {upcomingHolidays.map((h) => (
              <div key={h.date} className="flex items-center justify-between py-1.5">
                <p className="text-sm truncate">{h.name}</p>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {h.daysUntil === 1 ? "Mañana" : `${h.daysUntil}d`}
                </Badge>
              </div>
            ))}
          </SidebarCard>
        )}

        {/* Trending (palabras frecuentes) */}
        {trendingTopics.length > 0 && (
          <SidebarCard title="Tendencias" icon={TrendingUp} iconColor="text-emerald-500" accent="border-emerald-200 dark:border-emerald-900/30">
            {trendingTopics.map((t, i) => (
              <div key={t.word} className="py-1.5">
                <p className="text-[11px] text-muted-foreground">Tendencia #{i + 1}</p>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">#{t.word}</p>
                <p className="text-[11px] text-muted-foreground">{t.count} menciones</p>
              </div>
            ))}
          </SidebarCard>
        )}

        {/* Stats rápidos */}
        <SidebarCard title="Actividad" icon={Sparkles} iconColor="text-blue-500" accent="border-blue-200 dark:border-blue-900/30 bg-gradient-to-br from-blue-50/30 to-card dark:from-blue-950/10">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/50 p-2.5 text-center">
              <p className="text-lg font-bold">{posts.length}</p>
              <p className="text-[10px] text-muted-foreground">Publicaciones</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2.5 text-center">
              <p className="text-lg font-bold">{posts.reduce((a, p) => a + (p.Comments?.length ?? 0), 0)}</p>
              <p className="text-[10px] text-muted-foreground">Comentarios</p>
            </div>
          </div>
        </SidebarCard>

        {/* Footer */}
        <div className="px-1 pt-2">
          <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
            Novasys Asistencia · Feed Social · {new Date().getFullYear()}
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ── Sidebar Card Component ────────────────────────────────────── */

function SidebarCard({
  title,
  icon: Icon,
  iconColor,
  accent,
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-4 transition-shadow hover:shadow-sm", accent || "bg-card")}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("size-4", iconColor)} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
