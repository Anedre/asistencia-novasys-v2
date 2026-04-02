"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePresence, useHeartbeat, formatLastSeen, getPresenceDisplay } from "@/hooks/use-presence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
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
  Reply,
  Info,
  Pencil,
  Check,
  LogOut,
  UserPlus,
  Mail,
  Building2,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useChannels,
  useMessages,
  useSendMessage,
  useCreateChannel,
} from "@/hooks/use-messaging";
import type { ChatChannel, ChatMessage, ReplyInfo } from "@/lib/types/channel";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMOJI_LIST = [
  "\u{1F600}","\u{1F602}","\u{1F972}","\u{1F60D}","\u{1F929}","\u{1F60E}","\u{1F914}","\u{1F605}",
  "\u{1F44D}","\u{1F44F}","\u{1F64C}","\u{1F4AA}","\u{1F389}","\u{1F525}","\u2764\uFE0F","\u{1F4AF}",
  "\u2705","\u23F0","\u{1F4CB}","\u{1F4C5}","\u2615","\u{1F680}","\u2B50","\u{1F64F}",
  "\u{1F622}","\u{1F624}","\u{1F92F}","\u{1F634}","\u{1F91D}","\u{1F44B}","\u2728","\u{1F4AC}",
] as const;

const QUICK_REACTIONS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F44F}", "\u{1F525}"] as const;

const AVATAR_COLORS = [
  "bg-blue-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-violet-500",
  "bg-cyan-500","bg-pink-500","bg-teal-500","bg-orange-500","bg-indigo-500",
] as const;

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

interface EmployeeOption {
  EmployeeID: string;
  FullName: string;
}

interface EmployeeDetail {
  EmployeeID: string;
  FullName: string;
  Position?: string;
  Area?: string;
  Email?: string;
}

function normalizeEmployee(raw: Record<string, unknown>): EmployeeOption {
  return {
    EmployeeID: (raw.EmployeeID as string) ?? (raw.employeeId as string) ?? "",
    FullName: (raw.FullName as string) ?? (raw.fullName as string) ?? "Sin nombre",
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.slice(0, 2) || "??").toUpperCase();
}

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

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

function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

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
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedChannelId = searchParams.get("channel");

  const { data: channelsData, isLoading: channelsLoading } = useChannels();
  const { data: messagesData, isLoading: messagesLoading } = useMessages(selectedChannelId);
  const sendMessage = useSendMessage(selectedChannelId);
  const createChannel = useCreateChannel();

  const [messageText, setMessageText] = useState("");
  const [showMobileThread, setShowMobileThread] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");

  // Create-channel dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newChannelType, setNewChannelType] = useState<"direct" | "group">("direct");
  const [newChannelName, setNewChannelName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<EmployeeOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeList, setEmployeeList] = useState<EmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  // Quick-share & emoji
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Reply state
  const [replyTo, setReplyTo] = useState<ReplyInfo | null>(null);

  // Info panel
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [infoPanelData, setInfoPanelData] = useState<EmployeeDetail | null>(null);
  const [infoPanelLoading, setInfoPanelLoading] = useState(false);

  // Group management
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);

  // Hovered message for reactions/reply toolbar
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const currentUserId = (session?.user as { employeeId?: string })?.employeeId;

  const channels = channelsData?.channels ?? [];
  const messages = messagesData?.messages ?? [];

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mobile thread toggle
  useEffect(() => {
    if (selectedChannelId) setShowMobileThread(true);
  }, [selectedChannelId]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  // Reset info panel when channel changes
  useEffect(() => {
    setShowInfoPanel(false);
    setInfoPanelData(null);
    setEditingGroupName(false);
    setShowAddMember(false);
    setReplyTo(null);
  }, [selectedChannelId]);

  // Fetch employees when create dialog or add member opens
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
    } catch { /* silently fail */ } finally {
      setEmployeesLoading(false);
    }
  }, [employeeList.length]);

  useEffect(() => {
    if (createOpen || showAddMember) fetchEmployees();
  }, [createOpen, showAddMember, fetchEmployees]);

  // Channel display name
  const getChannelDisplayName = useCallback(
    (channel: ChatChannel) => {
      if (channel.Name) return channel.Name;
      if (channel.Type === "direct" && currentUserId) {
        const otherId = channel.Members.find((m) => m !== currentUserId);
        if (otherId && channel.MemberNames[otherId]) return channel.MemberNames[otherId];
      }
      const names = Object.entries(channel.MemberNames)
        .filter(([id]) => id !== currentUserId)
        .map(([, name]) => name);
      return names.join(", ") || "Canal";
    },
    [currentUserId],
  );

  const filteredChannels = useMemo(() => {
    if (!channelSearch.trim()) return channels;
    const q = channelSearch.toLowerCase();
    return channels.filter((ch) => getChannelDisplayName(ch).toLowerCase().includes(q));
  }, [channels, channelSearch, getChannelDisplayName]);

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

  // Presence tracking for ALL DM contacts in channel list
  const allDmContactIds = useMemo(() => {
    const ids: string[] = [];
    for (const ch of channels) {
      if (ch.Type === "direct") {
        const other = ch.Members.find((m) => m !== currentUserId);
        if (other && !ids.includes(other)) ids.push(other);
      }
    }
    return ids;
  }, [channels, currentUserId]);
  const { data: allPresenceData } = usePresence(allDmContactIds);

  const selectedChannel = channels.find((c) => c.ChannelID === selectedChannelId);

  // Presence tracking for selected channel members
  const channelMemberIds = useMemo(() => {
    if (!selectedChannel) return [];
    return selectedChannel.Members.filter((m) => m !== currentUserId);
  }, [selectedChannel, currentUserId]);
  const { data: presenceData } = usePresence(channelMemberIds);
  const { startTyping, stopTyping } = useHeartbeat();

  // Get other user's presence for DMs
  const otherUserPresence = useMemo(() => {
    if (!selectedChannel || selectedChannel.Type !== "direct" || !presenceData) return null;
    const otherId = selectedChannel.Members.find((m) => m !== currentUserId);
    if (!otherId || !presenceData[otherId]) return null;
    return presenceData[otherId];
  }, [selectedChannel, presenceData, currentUserId]);

  // Check if someone is typing in this channel
  const typingUsers = useMemo(() => {
    if (!presenceData || !selectedChannelId) return [];
    return Object.entries(presenceData)
      .filter(([, p]) => p.typingIn === selectedChannelId)
      .map(([id]) => selectedChannel?.MemberNames?.[id]?.split(" ")[0] ?? "Alguien");
  }, [presenceData, selectedChannelId, selectedChannel]);

  const addMemberFilteredEmployees = useMemo(() => {
    if (!selectedChannel) return [];
    return employeeList.filter(
      (emp) =>
        !selectedChannel.Members.includes(emp.EmployeeID) &&
        (emp.FullName ?? "").toLowerCase().includes(addMemberSearch.toLowerCase()),
    );
  }, [employeeList, selectedChannel, addMemberSearch]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

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
    stopTyping();
    const sendData: { content: string; replyTo?: ReplyInfo } = { content: text };
    if (replyTo) {
      sendData.replyTo = replyTo;
      setReplyTo(null);
    }
    await sendMessage.mutateAsync(sendData as { content: string });
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
      members: selectedMembers.map((m) => ({ id: m.EmployeeID, name: m.FullName })),
    });
    setCreateOpen(false);
    setNewChannelName("");
    setSelectedMembers([]);
    setEmployeeSearch("");
    setNewChannelType("direct");
    if (result.channel) selectChannel(result.channel.ChannelID);
  };

  const insertEmoji = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const sendQuickShare = async (content: string) => {
    if (!selectedChannelId) return;
    setShowShareMenu(false);
    await sendMessage.mutateAsync({ content });
  };

  const shareAttendance = () => {
    const now = new Date();
    const time = now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    const date = now.toLocaleDateString("es-PE", { day: "numeric", month: "long" });
    sendQuickShare(`\u{1F4CB} *Registro de asistencia*\n\u{1F4C5} ${date}\n\u23F0 Hora: ${time}\n\u2705 Estado: Presente`);
  };

  const shareEvent = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
    sendQuickShare(`\u{1F389} *Evento compartido*\n\u{1F4C5} ${date}\n\u{1F4CD} Oficina principal\n\u{1F465} Todos los miembros del equipo`);
  };

  // -- Reactions --
  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!selectedChannelId) return;
    try {
      await fetch(
        `/api/messages/channels/${encodeURIComponent(selectedChannelId)}/messages/${encodeURIComponent(msgId)}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        },
      );
      // Refetch messages to update reactions
      // The hook auto-refetches via interval, but we can force it
    } catch { /* ignore */ }
  };

  // -- Reply --
  const handleReply = (msg: ChatMessage) => {
    setReplyTo({
      messageId: msg.MessageID,
      senderName: msg.SenderName,
      content: msg.Content.length > 50 ? msg.Content.slice(0, 50) + "..." : msg.Content,
    });
    inputRef.current?.focus();
  };

  // -- Info panel --
  const toggleInfoPanel = async () => {
    if (showInfoPanel) {
      setShowInfoPanel(false);
      return;
    }
    setShowInfoPanel(true);

    if (selectedChannel?.Type === "direct" && currentUserId) {
      const otherId = selectedChannel.Members.find((m) => m !== currentUserId);
      if (otherId) {
        setInfoPanelLoading(true);
        try {
          const res = await fetch("/api/employees/directory");
          if (res.ok) {
            const data = await res.json();
            const employees = (data.employees ?? data ?? []) as Record<string, unknown>[];
            const found = employees.find(
              (e) =>
                (e.EmployeeID as string) === otherId ||
                (e.employeeId as string) === otherId,
            );
            if (found) {
              setInfoPanelData({
                EmployeeID: (found.EmployeeID as string) ?? (found.employeeId as string) ?? otherId,
                FullName: (found.FullName as string) ?? (found.fullName as string) ?? "Sin nombre",
                Position: (found.Position as string) ?? (found.position as string) ?? undefined,
                Area: (found.Area as string) ?? (found.area as string) ?? undefined,
                Email: (found.Email as string) ?? (found.email as string) ?? undefined,
              });
            }
          }
        } catch { /* ignore */ } finally {
          setInfoPanelLoading(false);
        }
      }
    }
  };

  // -- Group management --
  const handleSaveGroupName = async () => {
    if (!selectedChannelId || !groupNameDraft.trim()) return;
    setSavingGroupName(true);
    try {
      await fetch(`/api/messages/channels/${encodeURIComponent(selectedChannelId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupNameDraft.trim() }),
      });
      setEditingGroupName(false);
    } catch { /* ignore */ } finally {
      setSavingGroupName(false);
    }
  };

  const handleAddMember = async (emp: EmployeeOption) => {
    if (!selectedChannelId) return;
    setAddingMember(true);
    try {
      await fetch(`/api/messages/channels/${encodeURIComponent(selectedChannelId)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: emp.EmployeeID, memberName: emp.FullName }),
      });
      setAddMemberSearch("");
      setShowAddMember(false);
    } catch { /* ignore */ } finally {
      setAddingMember(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedChannelId) return;
    setLeavingGroup(true);
    try {
      await fetch(`/api/messages/channels/${encodeURIComponent(selectedChannelId)}/members`, {
        method: "DELETE",
      });
      setShowInfoPanel(false);
      router.push("/messages");
    } catch { /* ignore */ } finally {
      setLeavingGroup(false);
    }
  };

  // =========================================================================
  // CHANNEL LIST PANEL
  // =========================================================================

  const channelListPanel = (
    <div className="flex h-full w-full flex-col bg-card">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-base font-semibold tracking-tight">Mensajes</h2>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" className="h-7 gap-1.5 rounded-lg px-3 text-xs" />}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo
          </DialogTrigger>

          {/* Create channel dialog */}
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nueva conversacion</DialogTitle>
              <DialogDescription>Crea un mensaje directo o un grupo de chat.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Type switcher */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setNewChannelType("direct"); setSelectedMembers([]); }}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    newChannelType === "direct" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  Mensaje directo
                </button>
                <button
                  type="button"
                  onClick={() => setNewChannelType("group")}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    newChannelType === "group" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  Grupo
                </button>
              </div>
              {newChannelType === "group" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nombre del grupo</Label>
                  <Input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="Ej: Equipo Backend" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Agregar miembros</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} placeholder="Buscar por nombre..." className="pl-9" />
                </div>
                {employeesLoading && <p className="text-xs text-muted-foreground animate-pulse">Cargando empleados...</p>}
                {employeeSearch && filteredEmployees.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border">
                    {filteredEmployees.slice(0, 12).map((emp) => (
                      <button
                        key={emp.EmployeeID}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                        onClick={() => { setSelectedMembers((prev) => [...prev, emp]); setEmployeeSearch(""); }}
                      >
                        <Avatar size="sm">
                          <AvatarFallback className={cn("text-[10px] text-white font-semibold", colorFor(emp.EmployeeID))}>
                            {getInitials(emp.FullName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{emp.FullName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedMembers.map((m) => (
                    <span key={m.EmployeeID} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-1 pr-2 text-xs font-medium text-primary">
                      <Avatar size="sm">
                        <AvatarFallback className={cn("text-[9px] text-white font-semibold", colorFor(m.EmployeeID))}>
                          {getInitials(m.FullName)}
                        </AvatarFallback>
                      </Avatar>
                      {m.FullName.split(" ")[0]}
                      <button type="button" onClick={() => setSelectedMembers((prev) => prev.filter((p) => p.EmployeeID !== m.EmployeeID))} className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" size="sm" />}>Cancelar</DialogClose>
              <Button size="sm" onClick={handleCreateChannel} disabled={createChannel.isPending || selectedMembers.length === 0 || (newChannelType === "group" && !newChannelName.trim())}>
                {createChannel.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Crear conversacion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="px-4 py-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={channelSearch}
            onChange={(e) => setChannelSearch(e.target.value)}
            placeholder="Buscar conversacion..."
            className="h-9 rounded-lg bg-muted/50 pl-9 text-sm border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {channelsLoading ? (
          <div className="space-y-1 px-2 py-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-3">
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
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MessageCircle className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {channelSearch ? "Sin resultados" : "No tienes conversaciones"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {channelSearch ? "Intenta con otro termino" : "Crea una nueva para empezar"}
            </p>
          </div>
        ) : (
          <div className="px-2 py-1">
            {filteredChannels.map((channel) => {
              const isActive = selectedChannelId === channel.ChannelID;
              const displayName = getChannelDisplayName(channel);
              const isDirect = channel.Type === "direct";
              // Get presence for this DM contact
              const dmContactId = isDirect ? channel.Members.find((m) => m !== currentUserId) : null;
              const contactPresence = dmContactId && allPresenceData ? allPresenceData[dmContactId] : null;
              const badgeColor = contactPresence?.status === "online"
                ? "bg-emerald-500"
                : contactPresence?.status === "idle"
                  ? "bg-amber-500"
                  : "bg-gray-400";
              return (
                <button
                  key={channel.ChannelID}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
                    "hover:bg-accent/50",
                    isActive && "bg-accent",
                  )}
                  onClick={() => selectChannel(channel.ChannelID)}
                >
                  <div className="relative shrink-0">
                    <Avatar>
                      <AvatarFallback className={cn("text-xs font-semibold text-white", colorFor(channel.ChannelID))}>
                        {isDirect ? getInitials(displayName) : <Hash className="h-4 w-4" />}
                      </AvatarFallback>
                      {isDirect && <AvatarBadge className={badgeColor} />}
                    </Avatar>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{displayName}</p>
                      {channel.LastMessageAt && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatRelative(channel.LastMessageAt)}</span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {channel.LastMessage ? (
                        <>
                          {channel.LastMessageBy && <span className="font-medium">{channel.LastMessageBy.split(" ")[0]}: </span>}
                          {channel.LastMessage}
                        </>
                      ) : (
                        <span className="italic">Sin mensajes aun</span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // =========================================================================
  // INFO PANEL (DM / Group)
  // =========================================================================

  const infoPanelContent = selectedChannel && showInfoPanel ? (
    <div
      className={cn(
        "absolute inset-y-0 right-0 z-30 flex w-full max-w-xs flex-col border-l bg-card shadow-lg",
        "transition-transform duration-300 ease-in-out",
        showInfoPanel ? "translate-x-0" : "translate-x-full",
      )}
    >
      {/* Info panel header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h3 className="text-sm font-semibold">
          {selectedChannel.Type === "direct" ? "Informacion de contacto" : "Informacion del grupo"}
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowInfoPanel(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Avatar & name */}
          <div className="flex flex-col items-center text-center">
            <Avatar size="lg" className="!size-16 mb-3">
              <AvatarFallback className={cn("text-lg font-semibold text-white", colorFor(selectedChannel.ChannelID))}>
                {selectedChannel.Type === "direct"
                  ? getInitials(getChannelDisplayName(selectedChannel))
                  : <Hash className="h-6 w-6" />
                }
              </AvatarFallback>
            </Avatar>

            {selectedChannel.Type === "group" && editingGroupName ? (
              <div className="flex items-center gap-2 w-full max-w-[200px]">
                <Input
                  value={groupNameDraft}
                  onChange={(e) => setGroupNameDraft(e.target.value)}
                  className="h-8 text-sm text-center"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveGroupName();
                    if (e.key === "Escape") setEditingGroupName(false);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleSaveGroupName}
                  disabled={savingGroupName}
                >
                  {savingGroupName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold">{getChannelDisplayName(selectedChannel)}</p>
                {selectedChannel.Type === "group" && selectedChannel.CreatedBy === currentUserId && (
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setGroupNameDraft(selectedChannel.Name || "");
                      setEditingGroupName(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {selectedChannel.Type === "group" && (
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedChannel.Members.length} miembro{selectedChannel.Members.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* DM: contact details */}
          {selectedChannel.Type === "direct" && (
            <div className="space-y-3">
              {infoPanelLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ) : infoPanelData ? (
                <>
                  {infoPanelData.Position && (
                    <div className="flex items-center gap-3 text-sm">
                      <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Cargo</p>
                        <p className="font-medium">{infoPanelData.Position}</p>
                      </div>
                    </div>
                  )}
                  {infoPanelData.Area && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Area</p>
                        <p className="font-medium">{infoPanelData.Area}</p>
                      </div>
                    </div>
                  )}
                  {infoPanelData.Email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Correo</p>
                        <p className="font-medium break-all">{infoPanelData.Email}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">No se pudo cargar la informacion</p>
              )}
            </div>
          )}

          {/* Group: member list */}
          {selectedChannel.Type === "group" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Miembros</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setShowAddMember(!showAddMember)}
                >
                  <UserPlus className="h-3 w-3" />
                  Agregar
                </Button>
              </div>

              {/* Add member UI */}
              {showAddMember && (
                <div className="space-y-2 rounded-lg border p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={addMemberSearch}
                      onChange={(e) => setAddMemberSearch(e.target.value)}
                      placeholder="Buscar empleado..."
                      className="h-8 pl-7 text-xs"
                      autoFocus
                    />
                  </div>
                  {addMemberSearch && addMemberFilteredEmployees.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                      {addMemberFilteredEmployees.slice(0, 8).map((emp) => (
                        <button
                          key={emp.EmployeeID}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                          onClick={() => handleAddMember(emp)}
                          disabled={addingMember}
                        >
                          <Avatar size="sm">
                            <AvatarFallback className={cn("text-[9px] text-white font-semibold", colorFor(emp.EmployeeID))}>
                              {getInitials(emp.FullName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{emp.FullName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {addMemberSearch && addMemberFilteredEmployees.length === 0 && (
                    <p className="text-[11px] text-muted-foreground px-1">Sin resultados</p>
                  )}
                </div>
              )}

              {/* Members */}
              <div className="space-y-1">
                {selectedChannel.Members.map((memberId) => {
                  const name = selectedChannel.MemberNames[memberId] ?? "Desconocido";
                  const isCreator = selectedChannel.CreatedBy === memberId;
                  const isMe = memberId === currentUserId;
                  return (
                    <div key={memberId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                      <Avatar size="sm">
                        <AvatarFallback className={cn("text-[10px] text-white font-semibold", colorFor(memberId))}>
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {name}
                          {isMe && <span className="text-muted-foreground"> (tu)</span>}
                        </p>
                        {isCreator && (
                          <p className="text-[10px] text-muted-foreground">Creador</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leave group */}
              <div className="pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleLeaveGroup}
                  disabled={leavingGroup}
                >
                  {leavingGroup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                  Salir del grupo
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  ) : null;

  // =========================================================================
  // MESSAGE BUBBLE
  // =========================================================================

  const renderMessage = (msg: ChatMessage, idx: number) => {
    const isOwn = msg.SenderID === currentUserId;
    const prev = messages[idx - 1];
    const showDateSep = !prev || !isSameDay(prev.CreatedAt, msg.CreatedAt);
    const showSender = !isOwn && (!prev || prev.SenderID !== msg.SenderID || showDateSep);
    const isGroup = selectedChannel?.Type === "group";
    const isHovered = hoveredMsgId === msg.MessageID;

    // Reactions
    const reactions = msg.Reactions
      ? Object.entries(msg.Reactions).filter(([, r]) => r.userIds.length > 0)
      : [];

    return (
      <div key={msg.MessageID}>
        {/* Date separator */}
        {showDateSep && (
          <div className="flex items-center justify-center py-3">
            <div className="rounded-full bg-muted/80 px-3 py-1">
              <span className="text-[11px] font-medium text-muted-foreground">{dateLabelFor(msg.CreatedAt)}</span>
            </div>
          </div>
        )}

        {/* Message row */}
        <div
          className={cn("group relative flex items-end gap-2 py-0.5", isOwn ? "flex-row-reverse" : "flex-row")}
          onMouseEnter={() => setHoveredMsgId(msg.MessageID)}
          onMouseLeave={() => setHoveredMsgId(null)}
        >
          {/* Avatar (groups only, not DMs) */}
          {!isOwn && isGroup ? (
            showSender ? (
              <Avatar size="sm" className="mb-5 shrink-0">
                <AvatarFallback className={cn("text-[10px] font-semibold text-white", colorFor(msg.SenderID))}>
                  {getInitials(msg.SenderName)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-6 shrink-0" />
            )
          ) : !isOwn ? (
            /* DM: no avatar spacer needed */
            null
          ) : null}

          {/* Bubble wrapper */}
          <div className={cn("max-w-[75%] flex flex-col", isOwn ? "items-end" : "items-start")}>
            {/* Sender name (groups) */}
            {showSender && isGroup && (
              <span className="mb-0.5 ml-1 text-[11px] font-medium text-muted-foreground">
                {msg.SenderName.split(" ")[0]}
              </span>
            )}

            {/* Bubble */}
            <div className="relative">
              <div
                className={cn(
                  "relative rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                  isOwn
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm",
                )}
              >
                {/* WhatsApp-style tail */}
                <div
                  className={cn(
                    "absolute bottom-0 h-3 w-3",
                    isOwn
                      ? "-right-1.5 [clip-path:polygon(0_0,0_100%,100%_100%)] bg-primary"
                      : "-left-1.5 [clip-path:polygon(100%_0,0_100%,100%_100%)] bg-muted",
                  )}
                />

                {/* Reply preview */}
                {msg.ReplyTo && (
                  <div
                    className={cn(
                      "mb-1.5 rounded-lg px-2.5 py-1.5 text-xs border-l-2",
                      isOwn
                        ? "bg-primary-foreground/15 border-primary-foreground/40"
                        : "bg-background/60 border-foreground/20",
                    )}
                  >
                    <p className={cn("font-semibold text-[11px]", isOwn ? "text-primary-foreground/80" : "text-foreground/70")}>
                      {msg.ReplyTo.senderName}
                    </p>
                    <p className={cn("truncate", isOwn ? "text-primary-foreground/60" : "text-muted-foreground")}>
                      {msg.ReplyTo.content}
                    </p>
                  </div>
                )}

                {/* Content + inline timestamp */}
                <span>{msg.Content}</span>
                <span
                  className={cn(
                    "ml-2 inline-block align-bottom text-[10px] leading-none whitespace-nowrap",
                    isOwn ? "text-primary-foreground/50" : "text-muted-foreground/60",
                  )}
                >
                  {formatBubbleTime(msg.CreatedAt)}
                </span>
              </div>

              {/* Hover toolbar: reactions + reply */}
              {isHovered && (
                <div
                  className={cn(
                    "absolute -top-8 z-20 flex items-center gap-0.5 rounded-lg border bg-popover px-1 py-0.5 shadow-md",
                    "animate-in fade-in zoom-in-95 duration-100",
                    isOwn ? "right-0" : "left-0",
                  )}
                >
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded text-sm hover:bg-accent transition-colors"
                      onClick={() => toggleReaction(msg.MessageID, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                  <div className="mx-0.5 h-4 w-px bg-border" />
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    onClick={() => handleReply(msg)}
                    title="Responder"
                  >
                    <Reply className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Reactions pills */}
            {reactions.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-1 px-1">
                <TooltipProvider>
                  {reactions.map(([emoji, data]) => {
                    const hasReacted = currentUserId ? data.userIds.includes(currentUserId) : false;
                    return (
                      <Tooltip key={emoji}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors",
                                hasReacted
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : "border-border bg-background hover:bg-accent",
                              )}
                              onClick={() => toggleReaction(msg.MessageID, emoji)}
                            />
                          }
                        >
                          <span>{emoji}</span>
                          <span className="font-medium">{data.userIds.length}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {data.userNames.join(", ")}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // THREAD PANEL
  // =========================================================================

  const threadPanel = selectedChannelId ? (
    <div className="relative flex h-full w-full flex-col bg-background">
      {/* Thread header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
        <Button size="sm" variant="ghost" className="md:hidden -ml-1 h-8 w-8 p-0" onClick={handleBackToList}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {selectedChannel && (
          <>
            {/* Clickable header area to toggle info panel */}
            <button
              type="button"
              className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity"
              onClick={toggleInfoPanel}
            >
              <Avatar>
                <AvatarFallback className={cn("text-xs font-semibold text-white", colorFor(selectedChannel.ChannelID))}>
                  {selectedChannel.Type === "direct" ? getInitials(getChannelDisplayName(selectedChannel)) : <Hash className="h-4 w-4" />}
                </AvatarFallback>
                {selectedChannel.Type === "direct" && (
                  <AvatarBadge className={otherUserPresence?.status === "online" ? "bg-emerald-500" : otherUserPresence?.status === "idle" ? "bg-amber-500" : "bg-gray-400"} />
                )}
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold">{getChannelDisplayName(selectedChannel)}</p>
                <p className={cn("text-[11px]", otherUserPresence?.status === "online" ? "text-emerald-600" : "text-muted-foreground")}>
                  {typingUsers.length > 0
                    ? `${typingUsers.join(", ")} escribiendo...`
                    : selectedChannel.Type === "direct"
                      ? otherUserPresence
                        ? getPresenceDisplay(otherUserPresence.status).label + (otherUserPresence.status === "offline" && otherUserPresence.lastActivity ? ` · ${formatLastSeen(otherUserPresence.lastActivity)}` : "")
                        : "Cargando..."
                      : `${selectedChannel.Members.length} miembro${selectedChannel.Members.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 shrink-0 transition-colors",
                showInfoPanel && "bg-accent text-foreground",
              )}
              onClick={toggleInfoPanel}
            >
              <Info className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-1">
          {messagesLoading ? (
            <div className="space-y-4 py-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "justify-end" : "")}>
                  {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
                  <div className="space-y-1">
                    <Skeleton className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-48" : "w-56")} />
                    <Skeleton className="h-2.5 w-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5">
                <Send className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">Inicia la conversacion</p>
              <p className="mt-1.5 max-w-[240px] text-xs text-muted-foreground leading-relaxed">
                Envia el primer mensaje para comenzar a chatear
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => renderMessage(msg, idx))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick-share pills */}
      {showShareMenu && (
        <div className="flex items-center justify-center gap-2 border-t bg-card/60 px-4 py-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <button type="button" onClick={shareAttendance} className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
            <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />
            Compartir asistencia
          </button>
          <button type="button" onClick={shareEvent} className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
            <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
            Compartir evento
          </button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="fixed bottom-20 right-24 z-50 rounded-xl border bg-popover p-3 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-accent transition-colors"
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reply bar */}
      {replyTo && (
        <div className="flex items-center gap-3 border-t bg-muted/50 px-4 py-2 animate-in slide-in-from-bottom-1 duration-150">
          <div className="h-8 w-1 rounded-full bg-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary">{replyTo.senderName}</p>
            <p className="truncate text-xs text-muted-foreground">{replyTo.content}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground"
            onClick={() => setReplyTo(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground animate-pulse">
            {typingUsers.length === 1
              ? `${typingUsers[0]} está escribiendo...`
              : `${typingUsers.join(", ")} están escribiendo...`}
          </p>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSend} className="border-t bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          {/* Plus / share toggle */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 rounded-full transition-transform duration-200",
              showShareMenu && "rotate-45 bg-muted",
            )}
            onClick={() => setShowShareMenu(!showShareMenu)}
          >
            <Plus className="h-5 w-5" />
          </Button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={messageText}
            onChange={(e) => { setMessageText(e.target.value); if (selectedChannelId && e.target.value) startTyping(selectedChannelId); }}
            onKeyDown={handleKeyDown}
            onBlur={() => stopTyping()}
            placeholder="Escribe un mensaje..."
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-2xl border bg-muted/50 py-2.5 px-4 text-sm",
              "placeholder:text-muted-foreground/60",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-background",
              "max-h-32 overflow-y-auto",
            )}
            style={{ minHeight: "40px" }}
          />

          {/* Emoji picker */}
          <div className="shrink-0" ref={emojiPickerRef}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="h-5 w-5" />
            </Button>
          </div>

          {/* Send button */}
          <Button
            type="submit"
            size="icon"
            disabled={!messageText.trim() || sendMessage.isPending}
            className={cn(
              "h-9 w-9 shrink-0 rounded-full transition-all duration-200",
              messageText.trim() ? "scale-100 opacity-100" : "scale-90 opacity-50",
            )}
          >
            {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>

      {/* Info panel overlay */}
      {infoPanelContent}
    </div>
  ) : (
    /* Empty state */
    <div className="flex h-full w-full flex-col items-center justify-center bg-muted/10 p-8 text-center">
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <MessageCircle className="h-9 w-9 text-primary" />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-md">
          <Users className="h-4 w-4 text-primary-foreground" />
        </div>
      </div>
      <p className="text-lg font-semibold text-foreground">Tus mensajes</p>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
        Selecciona una conversacion o crea una nueva para empezar a chatear con tu equipo.
      </p>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger render={<Button className="mt-6 gap-2 rounded-full px-6" />}>
          <Plus className="h-4 w-4" />
          Nueva conversacion
        </DialogTrigger>
      </Dialog>
    </div>
  );

  // =========================================================================
  // LAYOUT
  // =========================================================================

  return (
    <div className="-m-4 md:-m-6 flex h-[calc(100vh-4rem)]">
      {/* Desktop: both panels */}
      <aside className="hidden md:flex md:flex-col md:w-80 lg:w-[360px] shrink-0 border-r overflow-hidden">
        {channelListPanel}
      </aside>
      <section className="hidden md:flex md:flex-1 flex-col min-w-0 overflow-hidden">
        {threadPanel}
      </section>

      {/* Mobile: one or the other */}
      <div className="flex flex-1 flex-col md:hidden">
        {showMobileThread && selectedChannelId ? threadPanel : channelListPanel}
      </div>
    </div>
  );
}
