"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarBadge,
} from "@/components/ui/avatar";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  MessageCircle,
  Plus,
  Send,
  ArrowLeft,
  Loader2,
  Users,
  Search,
  X,
  Hash,
  CalendarDays,
  ClipboardCheck,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useChannels,
  useMessages,
  useSendMessage,
  useCreateChannel,
} from "@/hooks/use-messaging";
import type { ChatChannel } from "@/lib/types/channel";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

interface EmployeeOption {
  EmployeeID: string;
  FullName: string;
}

function normalizeEmployee(raw: Record<string, unknown>): EmployeeOption {
  return {
    EmployeeID:
      (raw.EmployeeID as string) ?? (raw.employeeId as string) ?? "",
    FullName:
      (raw.FullName as string) ?? (raw.fullName as string) ?? "Sin nombre",
  };
}

/** Two-letter initials from a display name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.slice(0, 2) || "??").toUpperCase();
}

/** Deterministic color from a string */
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-indigo-500",
] as const;

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/** Relative timestamp for channel list */
function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0)
    return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7)
    return d.toLocaleDateString("es-PE", { weekday: "short" });
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
}

/** Time-only string for message bubbles */
function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date label for separators */
function dateLabelFor(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff < 7) return d.toLocaleDateString("es-PE", { weekday: "long" });
  return d.toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedChannelId = searchParams.get("channel");

  const { data: channelsData, isLoading: channelsLoading } = useChannels();
  const { data: messagesData, isLoading: messagesLoading } =
    useMessages(selectedChannelId);
  const sendMessage = useSendMessage(selectedChannelId);
  const createChannel = useCreateChannel();

  const [messageText, setMessageText] = useState("");
  const [showMobileThread, setShowMobileThread] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");

  // Create-channel dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newChannelType, setNewChannelType] = useState<"direct" | "group">("direct");
  const [newChannelName, setNewChannelName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<EmployeeOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeList, setEmployeeList] = useState<EmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  // Quick-share popover
  const [showShareMenu, setShowShareMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentUserId = (session?.user as { employeeId?: string })?.employeeId;

  const channels = channelsData?.channels ?? [];
  const messages = messagesData?.messages ?? [];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mobile thread
  useEffect(() => {
    if (selectedChannelId) setShowMobileThread(true);
  }, [selectedChannelId]);

  // Fetch employees when dialog opens
  const fetchEmployees = useCallback(async () => {
    if (employeeList.length > 0) return;
    setEmployeesLoading(true);
    try {
      const res = await fetch("/api/admin/employees");
      if (res.ok) {
        const data = await res.json();
        const raw = (data.employees ?? data ?? []) as Record<string, unknown>[];
        setEmployeeList(raw.map(normalizeEmployee));
      }
    } catch {
      // silently fail
    } finally {
      setEmployeesLoading(false);
    }
  }, [employeeList.length]);

  useEffect(() => {
    if (createOpen) fetchEmployees();
  }, [createOpen, fetchEmployees]);

  // Channel helpers
  const getChannelDisplayName = useCallback(
    (channel: ChatChannel) => {
      if (channel.Name) return channel.Name;
      if (channel.Type === "direct" && currentUserId) {
        const otherId = channel.Members.find((m) => m !== currentUserId);
        if (otherId && channel.MemberNames[otherId])
          return channel.MemberNames[otherId];
      }
      const names = Object.entries(channel.MemberNames)
        .filter(([id]) => id !== currentUserId)
        .map(([, name]) => name);
      return names.join(", ") || "Canal";
    },
    [currentUserId],
  );

  // Filtered channels (search)
  const filteredChannels = useMemo(() => {
    if (!channelSearch.trim()) return channels;
    const q = channelSearch.toLowerCase();
    return channels.filter((ch) =>
      getChannelDisplayName(ch).toLowerCase().includes(q),
    );
  }, [channels, channelSearch, getChannelDisplayName]);

  // Filtered employees (create dialog)
  const filteredEmployees = useMemo(
    () =>
      employeeList.filter(
        (emp) =>
          emp.EmployeeID !== currentUserId &&
          !selectedMembers.some((m) => m.EmployeeID === emp.EmployeeID) &&
          (emp.FullName ?? "").toLowerCase().includes(employeeSearch.toLowerCase()),
      ),
    [employeeList, currentUserId, selectedMembers, employeeSearch],
  );

  const selectChannel = (channelId: string) => {
    router.push(`/messages?channel=${encodeURIComponent(channelId)}`);
  };

  const handleBackToList = () => {
    setShowMobileThread(false);
    router.push("/messages");
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedChannelId) return;
    const text = messageText.trim();
    setMessageText("");
    await sendMessage.mutateAsync({ content: text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleCreateChannel = async () => {
    if (selectedMembers.length === 0) return;
    if (newChannelType === "group" && !newChannelName.trim()) return;

    const result = await createChannel.mutateAsync({
      name: newChannelType === "group" ? newChannelName.trim() : undefined,
      type: newChannelType,
      members: selectedMembers.map((m) => ({
        id: m.EmployeeID,
        name: m.FullName,
      })),
    });

    setCreateOpen(false);
    setNewChannelName("");
    setSelectedMembers([]);
    setEmployeeSearch("");
    setNewChannelType("direct");
    if (result.channel) selectChannel(result.channel.ChannelID);
  };

  /** Quick-share helpers: send a formatted text message */
  const sendQuickShare = async (content: string) => {
    if (!selectedChannelId) return;
    setShowShareMenu(false);
    await sendMessage.mutateAsync({ content });
  };

  const shareAttendance = () => {
    const now = new Date();
    const time = now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    const date = now.toLocaleDateString("es-PE", { day: "numeric", month: "long" });
    sendQuickShare(
      `\u{1F4CB} *Registro de asistencia*\n\u{1F4C5} ${date}\n\u{23F0} Hora: ${time}\n\u2705 Estado: Presente`,
    );
  };

  const shareEvent = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toLocaleDateString("es-PE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    sendQuickShare(
      `\u{1F389} *Evento compartido*\n\u{1F4C5} ${date}\n\u{1F4CD} Oficina principal\n\u{1F465} Todos los miembros del equipo`,
    );
  };

  // =======================================================================
  // CHANNEL LIST
  // =======================================================================

  const selectedChannel = channels.find((c) => c.ChannelID === selectedChannelId);

  const channelListPanel = (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold tracking-tight">Mensajes</h2>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <Button size="sm" className="h-8 gap-1.5 rounded-full px-3 text-xs" />
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo
          </DialogTrigger>

          {/* -- Create channel dialog -- */}
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nueva conversacion</DialogTitle>
              <DialogDescription>
                Crea un mensaje directo o un grupo de chat.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Type switcher */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setNewChannelType("direct"); setSelectedMembers([]); }}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    newChannelType === "direct"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  Mensaje directo
                </button>
                <button
                  type="button"
                  onClick={() => setNewChannelType("group")}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    newChannelType === "group"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  Grupo
                </button>
              </div>

              {/* Group name */}
              {newChannelType === "group" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nombre del grupo</Label>
                  <Input
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="Ej: Equipo Backend"
                  />
                </div>
              )}

              {/* Member search */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Agregar miembros</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="pl-9"
                  />
                </div>

                {employeesLoading && (
                  <p className="text-xs text-muted-foreground animate-pulse">
                    Cargando empleados...
                  </p>
                )}

                {employeeSearch && filteredEmployees.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border">
                    {filteredEmployees.slice(0, 12).map((emp) => (
                      <button
                        key={emp.EmployeeID}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          setSelectedMembers((prev) => [...prev, emp]);
                          setEmployeeSearch("");
                        }}
                      >
                        <Avatar size="sm">
                          <AvatarFallback
                            className={cn(
                              "text-[10px] text-white font-semibold",
                              colorFor(emp.EmployeeID),
                            )}
                          >
                            {getInitials(emp.FullName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{emp.FullName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected members */}
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedMembers.map((m) => (
                    <span
                      key={m.EmployeeID}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-1 pr-2 text-xs font-medium text-primary"
                    >
                      <Avatar size="sm">
                        <AvatarFallback
                          className={cn(
                            "text-[9px] text-white font-semibold",
                            colorFor(m.EmployeeID),
                          )}
                        >
                          {getInitials(m.FullName)}
                        </AvatarFallback>
                      </Avatar>
                      {m.FullName.split(" ")[0]}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMembers((prev) =>
                            prev.filter((p) => p.EmployeeID !== m.EmployeeID),
                          )
                        }
                        className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" size="sm" />}>
                Cancelar
              </DialogClose>
              <Button
                size="sm"
                onClick={handleCreateChannel}
                disabled={
                  createChannel.isPending ||
                  selectedMembers.length === 0 ||
                  (newChannelType === "group" && !newChannelName.trim())
                }
              >
                {createChannel.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Crear conversacion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={channelSearch}
            onChange={(e) => setChannelSearch(e.target.value)}
            placeholder="Buscar conversacion..."
            className="h-9 rounded-full bg-muted/50 pl-9 text-sm border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Channel list */}
      <ScrollArea className="flex-1">
        {channelsLoading ? (
          <div className="space-y-1 p-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <MessageCircle className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {channelSearch ? "Sin resultados" : "No tienes conversaciones"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {channelSearch
                ? "Intenta con otro termino"
                : "Crea una nueva para empezar"}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredChannels.map((channel) => {
              const isActive = selectedChannelId === channel.ChannelID;
              const displayName = getChannelDisplayName(channel);
              const isDirect = channel.Type === "direct";

              return (
                <button
                  key={channel.ChannelID}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all",
                    "hover:bg-accent/50 active:scale-[0.99]",
                    isActive && "bg-accent",
                  )}
                  onClick={() => selectChannel(channel.ChannelID)}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar>
                      <AvatarFallback
                        className={cn(
                          "text-xs font-semibold text-white",
                          colorFor(channel.ChannelID),
                        )}
                      >
                        {isDirect ? getInitials(displayName) : <Hash className="h-4 w-4" />}
                      </AvatarFallback>
                      {isDirect && (
                        <AvatarBadge className="bg-emerald-500" />
                      )}
                    </Avatar>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{displayName}</p>
                      {channel.LastMessageAt && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatRelative(channel.LastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="flex-1 truncate text-xs text-muted-foreground">
                        {channel.LastMessage ? (
                          <>
                            {channel.LastMessageBy && (
                              <span className="font-medium">
                                {channel.LastMessageBy.split(" ")[0]}:{" "}
                              </span>
                            )}
                            {channel.LastMessage}
                          </>
                        ) : (
                          <span className="italic">Sin mensajes aun</span>
                        )}
                      </p>
                      {/* Unread dot (placeholder -- would be wired to unread count) */}
                      {/* Uncomment below when UnreadCount is available:
                      {channel.UnreadCount > 0 && (
                        <Badge className="h-4.5 min-w-[18px] px-1 text-[10px]">
                          {channel.UnreadCount}
                        </Badge>
                      )} */}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // =======================================================================
  // MESSAGE THREAD
  // =======================================================================

  const threadPanel = selectedChannelId ? (
    <div className="flex h-full flex-col bg-background">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 bg-card/80 backdrop-blur-sm">
        <Button
          size="sm"
          variant="ghost"
          className="md:hidden -ml-2"
          onClick={handleBackToList}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {selectedChannel && (
          <>
            <Avatar>
              <AvatarFallback
                className={cn(
                  "text-xs font-semibold text-white",
                  colorFor(selectedChannel.ChannelID),
                )}
              >
                {selectedChannel.Type === "direct"
                  ? getInitials(getChannelDisplayName(selectedChannel))
                  : <Hash className="h-4 w-4" />}
              </AvatarFallback>
              {selectedChannel.Type === "direct" && (
                <AvatarBadge className="bg-emerald-500" />
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {getChannelDisplayName(selectedChannel)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {selectedChannel.Type === "direct"
                  ? "En linea"
                  : `${selectedChannel.Members.length} miembro${selectedChannel.Members.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-4 space-y-1">
          {messagesLoading ? (
            <div className="space-y-4 py-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn("flex gap-2", i % 2 === 0 ? "justify-end" : "")}
                >
                  {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
                  <div className="space-y-1">
                    <Skeleton className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-48" : "w-56")} />
                    <Skeleton className="h-2.5 w-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Send className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No hay mensajes aun
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Envia el primero para iniciar la conversacion
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOwn = msg.SenderID === currentUserId;
              const prev = messages[idx - 1];
              const showDateSep = !prev || !isSameDay(prev.CreatedAt, msg.CreatedAt);
              const showSender =
                !isOwn && (!prev || prev.SenderID !== msg.SenderID || showDateSep);

              return (
                <div key={msg.MessageID}>
                  {/* Date separator */}
                  {showDateSep && (
                    <div className="flex items-center justify-center py-3">
                      <div className="rounded-full bg-muted/80 px-3 py-1">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {dateLabelFor(msg.CreatedAt)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Message row */}
                  <div
                    className={cn(
                      "flex items-end gap-2 py-0.5",
                      isOwn ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    {/* Avatar (only for others, only on sender change) */}
                    {!isOwn ? (
                      showSender ? (
                        <Avatar size="sm" className="mb-5 shrink-0">
                          <AvatarFallback
                            className={cn(
                              "text-[10px] font-semibold text-white",
                              colorFor(msg.SenderID),
                            )}
                          >
                            {getInitials(msg.SenderName)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-6 shrink-0" />
                      )
                    ) : null}

                    {/* Bubble */}
                    <div
                      className={cn(
                        "max-w-[75%] flex flex-col",
                        isOwn ? "items-end" : "items-start",
                      )}
                    >
                      {showSender && (
                        <span className="mb-0.5 ml-1 text-[11px] font-medium text-muted-foreground">
                          {msg.SenderName.split(" ")[0]}
                        </span>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                          isOwn
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md",
                        )}
                      >
                        {msg.Content}
                      </div>
                      <span className="mt-0.5 px-1 text-[10px] text-muted-foreground/70">
                        {formatBubbleTime(msg.CreatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Quick-share buttons */}
      {showShareMenu && (
        <div className="flex items-center gap-2 border-t bg-card/60 px-4 py-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <button
            type="button"
            onClick={shareAttendance}
            className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />
            Compartir asistencia
          </button>
          <button
            type="button"
            onClick={shareEvent}
            className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
            Compartir evento
          </button>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSend} className="border-t bg-card/80 px-3 py-3">
        <div className="mx-auto max-w-3xl flex items-end gap-2">
          {/* Plus / share toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 w-9 shrink-0 rounded-full p-0 transition-transform duration-200",
              showShareMenu && "rotate-45",
            )}
            onClick={() => setShowShareMenu(!showShareMenu)}
          >
            <Plus className="h-5 w-5" />
          </Button>

          {/* Text input */}
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              rows={1}
              className={cn(
                "w-full resize-none rounded-2xl border bg-muted/50 py-2.5 pl-4 pr-10 text-sm",
                "placeholder:text-muted-foreground/60",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "max-h-32 overflow-y-auto",
              )}
              style={{ minHeight: "40px" }}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              tabIndex={-1}
            >
              <Smile className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Send button */}
          <Button
            type="submit"
            size="sm"
            disabled={!messageText.trim() || sendMessage.isPending}
            className={cn(
              "h-9 w-9 shrink-0 rounded-full p-0 transition-all duration-200",
              messageText.trim()
                ? "scale-100 opacity-100"
                : "scale-90 opacity-50",
            )}
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  ) : (
    /* Empty state */
    <div className="flex h-full flex-col items-center justify-center bg-background p-8 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <MessageCircle className="h-9 w-9 text-primary" />
      </div>
      <p className="text-lg font-semibold text-foreground">
        Tus mensajes
      </p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Selecciona una conversacion o crea una nueva para empezar a chatear con tu equipo.
      </p>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger
          render={
            <Button className="mt-5 gap-2 rounded-full" />
          }
        >
          <Plus className="h-4 w-4" />
          Nueva conversacion
        </DialogTrigger>
      </Dialog>
    </div>
  );

  // =======================================================================
  // LAYOUT
  // =======================================================================

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-8rem)]">
      <div className="flex h-full overflow-hidden rounded-xl border bg-card shadow-sm">
        {/* Desktop: both panels */}
        <div className="hidden md:flex md:w-[340px] lg:w-[380px] shrink-0 border-r">
          {channelListPanel}
        </div>
        <div className="hidden md:flex md:flex-1 md:max-w-4xl">{threadPanel}</div>

        {/* Mobile: one or the other */}
        <div className="flex flex-1 md:hidden">
          {showMobileThread && selectedChannelId ? threadPanel : channelListPanel}
        </div>
      </div>
    </div>
  );
}
