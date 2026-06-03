"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePresence, useHeartbeat, formatLastSeen, getPresenceDisplay } from "@/hooks/use-presence";
import { Skeleton } from "@/components/ui/skeleton";
import { IconSvg, Icons } from "@/components/nova/icons";
import { EmptyState } from "@/components/shared/empty-state";
import {
  useChannels,
  useMessages,
  useSendMessage,
  useCreateChannel,
} from "@/hooks/use-messaging";
import type { ChatChannel, ChatMessage, ReplyInfo } from "@/lib/types/channel";
import { MessageBubble } from "@/components/messaging/message-bubble";
import { useChatLastSeen } from "@/hooks/use-chat-last-seen";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMOJI_LIST = [
  "\u{1F600}","\u{1F602}","\u{1F972}","\u{1F60D}","\u{1F929}","\u{1F60E}","\u{1F914}","\u{1F605}",
  "\u{1F44D}","\u{1F44F}","\u{1F64C}","\u{1F4AA}","\u{1F389}","\u{1F525}","❤️","\u{1F4AF}",
  "✅","⏰","\u{1F4CB}","\u{1F4C5}","☕","\u{1F680}","⭐","\u{1F64F}",
  "\u{1F622}","\u{1F624}","\u{1F92F}","\u{1F634}","\u{1F91D}","\u{1F44B}","✨","\u{1F4AC}",
] as const;

const QUICK_REACTIONS = ["\u{1F44D}", "❤️", "\u{1F602}", "\u{1F44F}", "\u{1F525}"] as const;

// Stable avatar color palette — driven by `.avatar-bg-N` CSS classes (which
// resolve to the `--avatar-N` tokens defined in `nova-design.css`). Using
// classes instead of inline hex keeps the messaging surface themable along
// with the rest of the design system.
const AVATAR_CLASS_COUNT = 10;

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

/** Pick an `.avatar-bg-N` class deterministically from an ID. */
function avatarClassFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return `avatar-bg-${(Math.abs(h) % AVATAR_CLASS_COUNT) + 1}`;
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

// Small reusable spinner using nova-design @keyframes spin
function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
      }}
    />
  );
}

// Presence-dot color helper
function presenceDotColor(status?: string): string {
  if (status === "online") return "var(--success)";
  if (status === "idle") return "var(--warn)";
  return "var(--text-muted)";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();

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

  // Unread tracking — a real signal (no server-side read receipts): compare each
  // channel's LastMessageAt against the last time the viewer opened it,
  // persisted in localStorage. See useChatLastSeen.
  const chatSeen = useChatLastSeen();

  // Baseline once channels load, so pre-existing history isn't flagged unread;
  // only messages that arrive after you last looked count.
  useEffect(() => {
    if (!chatSeen.ready || channels.length === 0) return;
    chatSeen.seed(channels.map((c) => ({ id: c.ChannelID, at: c.LastMessageAt })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSeen.ready, channelsData]);

  // Opening a channel (or a new message while it's open) marks it seen.
  useEffect(() => {
    if (!chatSeen.ready || !selectedChannelId) return;
    const ch = channels.find((c) => c.ChannelID === selectedChannelId);
    chatSeen.markSeen(selectedChannelId, ch?.LastMessageAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSeen.ready, selectedChannelId, channelsData]);

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
  // Uses /api/employees/directory (public to all authenticated employees) instead
  // of the admin-only /api/admin/employees, so non-admins can also start chats.
  const fetchEmployees = useCallback(async () => {
    if (employeeList.length > 0) return;
    setEmployeesLoading(true);
    try {
      const res = await fetch("/api/employees/directory");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo cargar el directorio");
      }
      const data = await res.json();
      const raw = (data.employees ?? data ?? []) as Record<string, unknown>[];
      setEmployeeList(raw.map(normalizeEmployee));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error cargando empleados");
    } finally {
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
    await sendMessage.mutateAsync(sendData);
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
    sendQuickShare(`\u{1F4CB} *Registro de asistencia*\n\u{1F4C5} ${date}\n⏰ Hora: ${time}\n✅ Estado: Presente`);
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
      const res = await fetch(
        `/api/messages/channels/${encodeURIComponent(selectedChannelId)}/messages/${encodeURIComponent(msgId)}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        },
      );
      if (!res.ok) throw new Error("No se pudo registrar la reacción");
      // Invalidate messages so the new reaction count appears
      qc.invalidateQueries({ queryKey: ["messaging-messages", selectedChannelId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error con la reacción");
    }
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
      const res = await fetch(`/api/messages/channels/${encodeURIComponent(selectedChannelId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupNameDraft.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo renombrar el grupo");
      }
      qc.invalidateQueries({ queryKey: ["messaging-channels"] });
      setEditingGroupName(false);
      toast.success("Grupo renombrado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al renombrar");
    } finally {
      setSavingGroupName(false);
    }
  };

  const handleAddMember = async (emp: EmployeeOption) => {
    if (!selectedChannelId) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/messages/channels/${encodeURIComponent(selectedChannelId)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: emp.EmployeeID, memberName: emp.FullName }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo agregar el miembro");
      }
      qc.invalidateQueries({ queryKey: ["messaging-channels"] });
      setAddMemberSearch("");
      setShowAddMember(false);
      toast.success(`${emp.FullName} agregado/a al grupo`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error agregando miembro");
    } finally {
      setAddingMember(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedChannelId) return;
    setLeavingGroup(true);
    try {
      const res = await fetch(`/api/messages/channels/${encodeURIComponent(selectedChannelId)}/members`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo salir del grupo");
      }
      qc.invalidateQueries({ queryKey: ["messaging-channels"] });
      setShowInfoPanel(false);
      router.push("/messages");
      toast.success("Saliste del grupo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al salir del grupo");
    } finally {
      setLeavingGroup(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Mini avatar (replaces shadcn Avatar)
  // ---------------------------------------------------------------------------

  function MiniAvatar({
    id,
    name,
    isGroupHash,
    size = 32,
    fontSize,
    badgeStatus,
  }: {
    id: string;
    name: string;
    isGroupHash?: boolean;
    size?: number;
    fontSize?: number;
    badgeStatus?: string;
  }) {
    return (
      <div
        className={`avatar ${avatarClassFor(id)}`}
        style={{
          width: size,
          height: size,
          fontSize: fontSize ?? Math.max(10, Math.round(size * 0.32)),
          color: "#fff",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {isGroupHash ? (
          <span style={{ fontWeight: 700, fontSize: Math.round(size * 0.5) }}>#</span>
        ) : (
          <span className="avatar-text">{getInitials(name)}</span>
        )}
        {badgeStatus && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: -1,
              bottom: -1,
              width: Math.max(8, Math.round(size * 0.28)),
              height: Math.max(8, Math.round(size * 0.28)),
              borderRadius: "50%",
              background: presenceDotColor(badgeStatus),
              border: "2px solid var(--bg-elevated)",
            }}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // CHANNEL LIST PANEL
  // =========================================================================

  const channelListPanel = (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        flexDirection: "column",
        background: "var(--bg-elevated)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          height: 56,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderBottom: "1px solid var(--border)",
          padding: "0 12px 0 16px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Mensajes
        </h2>
        <button
          type="button"
          className="btn primary btn-sm"
          onClick={() => setCreateOpen(true)}
          style={{ flexShrink: 0 }}
          aria-label="Nueva conversación"
        >
          <IconSvg d={Icons.plus} size={14} />
          Nuevo
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "10px 16px" }}>
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
              display: "flex",
            }}
          >
            <IconSvg d={Icons.search} size={14} />
          </span>
          <input
            type="text"
            className="form-input"
            value={channelSearch}
            onChange={(e) => setChannelSearch(e.target.value)}
            placeholder="Buscar conversación..."
            style={{ paddingLeft: 32, height: 36, background: "var(--bg-subtle)" }}
          />
        </div>
      </div>

      {/* Channel list */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {channelsLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "4px 8px" }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: 8,
                  padding: "12px 8px",
                }}
              >
                <Skeleton className="h-10 w-10 rounded-full" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChannels.length === 0 ? (
          <EmptyState
            icon={Icons.chat}
            title={channelSearch ? "Sin resultados" : "Aún no tienes conversaciones"}
            description={
              channelSearch
                ? "Prueba con otro nombre o termino"
                : "Inicia una nueva conversación para empezar a chatear con tu equipo"
            }
          />
        ) : (
          <div style={{ padding: "4px 8px" }}>
            {filteredChannels.map((channel) => {
              const isActive = selectedChannelId === channel.ChannelID;
              const displayName = getChannelDisplayName(channel);
              const isDirect = channel.Type === "direct";
              const dmContactId = isDirect ? channel.Members.find((m) => m !== currentUserId) : null;
              const contactPresence = dmContactId && allPresenceData ? allPresenceData[dmContactId] : null;
              const myName = currentUserId ? channel.MemberNames[currentUserId] : undefined;
              const lastIsMine = !!myName && channel.LastMessageBy === myName;
              const unread =
                !isActive &&
                !lastIsMine &&
                chatSeen.isUnread(channel.ChannelID, channel.LastMessageAt);

              return (
                <button
                  key={channel.ChannelID}
                  type="button"
                  onClick={() => selectChannel(channel.ChannelID)}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: 12,
                    borderRadius: 8,
                    padding: "10px 8px",
                    textAlign: "left",
                    background: isActive ? "var(--bg-subtle)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.12s",
                    color: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "var(--bg-subtle)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <MiniAvatar
                    id={channel.ChannelID}
                    name={displayName}
                    isGroupHash={!isDirect}
                    size={40}
                    badgeStatus={isDirect ? contactPresence?.status : undefined}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: 13,
                          fontWeight: unread ? 600 : 500,
                          color: "var(--text-primary)",
                        }}
                      >
                        {displayName}
                      </p>
                      {channel.LastMessageAt && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 10,
                            fontWeight: unread ? 600 : 400,
                            color: unread ? "var(--accent-strong)" : "var(--text-muted)",
                          }}
                        >
                          {formatRelative(channel.LastMessageAt)}
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        margin: "2px 0 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                        fontWeight: unread ? 500 : 400,
                        color: unread ? "var(--text-primary)" : "var(--text-muted)",
                      }}
                    >
                      {channel.LastMessage ? (
                        <>
                          {channel.LastMessageBy && (
                            <span style={{ fontWeight: 500 }}>
                              {channel.LastMessageBy.split(" ")[0]}:{" "}
                            </span>
                          )}
                          {channel.LastMessage}
                        </>
                      ) : (
                        <span style={{ fontStyle: "italic" }}>Sin mensajes aun</span>
                      )}
                    </p>
                  </div>
                  {unread && (
                    <span
                      className="channel-row-unread-dot"
                      aria-label="Mensajes sin leer"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // =========================================================================
  // CREATE CHANNEL SHEET
  // =========================================================================

  const createChannelSheet = createOpen ? (
    <div className="sheet-backdrop" onClick={() => setCreateOpen(false)}>
      <div
        className="sheet"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <div>
            <h3 className="sheet-title">Nueva conversación</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Crea un mensaje directo o un grupo de chat.
            </p>
          </div>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={() => setCreateOpen(false)}
            aria-label="Cerrar"
          >
            <IconSvg d={Icons.x} size={14} />
          </button>
        </div>

        <div className="sheet-body">
          {/* Type switcher */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => {
                setNewChannelType("direct");
                setSelectedMembers([]);
              }}
              style={{
                flex: 1,
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                border:
                  newChannelType === "direct"
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border)",
                background:
                  newChannelType === "direct" ? "var(--accent-soft)" : "var(--bg-elevated)",
                color:
                  newChannelType === "direct" ? "var(--accent-strong)" : "var(--text-secondary)",
                transition: "all 0.12s",
              }}
            >
              Mensaje directo
            </button>
            <button
              type="button"
              onClick={() => setNewChannelType("group")}
              style={{
                flex: 1,
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                border:
                  newChannelType === "group"
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border)",
                background:
                  newChannelType === "group" ? "var(--accent-soft)" : "var(--bg-elevated)",
                color:
                  newChannelType === "group" ? "var(--accent-strong)" : "var(--text-secondary)",
                transition: "all 0.12s",
              }}
            >
              Grupo
            </button>
          </div>

          {newChannelType === "group" && (
            <div className="form-group">
              <label className="form-label" htmlFor="new-channel-name">
                Nombre del grupo
              </label>
              <input
                id="new-channel-name"
                type="text"
                className="form-input"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Ej: Equipo Backend"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="new-channel-members">
              Agregar miembros
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                  display: "flex",
                }}
              >
                <IconSvg d={Icons.search} size={14} />
              </span>
              <input
                id="new-channel-members"
                type="text"
                className="form-input"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                style={{ paddingLeft: 32 }}
              />
            </div>
            {employeesLoading && (
              <p className="form-hint" style={{ marginTop: 6 }}>
                Cargando empleados...
              </p>
            )}
            {employeeSearch && filteredEmployees.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 200,
                  overflowY: "auto",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                }}
              >
                {filteredEmployees.slice(0, 12).map((emp) => (
                  <button
                    key={emp.EmployeeID}
                    type="button"
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      textAlign: "left",
                      fontSize: 13,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.12s",
                      color: "var(--text-primary)",
                    }}
                    onClick={() => {
                      setSelectedMembers((prev) => [...prev, emp]);
                      setEmployeeSearch("");
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <MiniAvatar id={emp.EmployeeID} name={emp.FullName} size={24} />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {emp.FullName}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedMembers.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {selectedMembers.map((m) => (
                <span
                  key={m.EmployeeID}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 999,
                    background: "var(--accent-soft)",
                    padding: "4px 8px 4px 4px",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--accent-strong)",
                  }}
                >
                  <MiniAvatar id={m.EmployeeID} name={m.FullName} size={22} />
                  {m.FullName.split(" ")[0]}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMembers((prev) => prev.filter((p) => p.EmployeeID !== m.EmployeeID))
                    }
                    style={{
                      marginLeft: 4,
                      padding: 2,
                      borderRadius: "50%",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      color: "inherit",
                    }}
                    aria-label={`Quitar ${m.FullName}`}
                  >
                    <IconSvg d={Icons.x} size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="sheet-foot">
          <button type="button" className="btn outline btn-sm" onClick={() => setCreateOpen(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary btn-sm"
            onClick={handleCreateChannel}
            disabled={
              createChannel.isPending ||
              selectedMembers.length === 0 ||
              (newChannelType === "group" && !newChannelName.trim())
            }
          >
            {createChannel.isPending && <Spinner size={12} />}
            Crear conversación
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // =========================================================================
  // INFO PANEL (DM / Group)
  // =========================================================================

  const infoPanelContent =
    selectedChannel && showInfoPanel ? (
      <div
        style={{
          position: "absolute",
          inset: "0 0 0 auto",
          zIndex: 30,
          display: "flex",
          width: "100%",
          maxWidth: 320,
          flexDirection: "column",
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          style={{
            display: "flex",
            height: 56,
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border)",
            padding: "0 16px",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            {selectedChannel.Type === "direct" ? "Informacion de contacto" : "Informacion del grupo"}
          </h3>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={() => setShowInfoPanel(false)}
            aria-label="Cerrar"
          >
            <IconSvg d={Icons.x} size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {/* Avatar & name */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            <MiniAvatar
              id={selectedChannel.ChannelID}
              name={getChannelDisplayName(selectedChannel)}
              isGroupHash={selectedChannel.Type !== "direct"}
              size={64}
              fontSize={18}
            />

            <div style={{ marginTop: 12 }}>
              {selectedChannel.Type === "group" && editingGroupName ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    width: "100%",
                    maxWidth: 220,
                  }}
                >
                  <input
                    type="text"
                    className="form-input"
                    value={groupNameDraft}
                    onChange={(e) => setGroupNameDraft(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveGroupName();
                      if (e.key === "Escape") setEditingGroupName(false);
                    }}
                    style={{ textAlign: "center", height: 32 }}
                  />
                  <button
                    type="button"
                    className="btn ghost btn-sm"
                    onClick={handleSaveGroupName}
                    disabled={savingGroupName}
                  >
                    {savingGroupName ? <Spinner size={12} /> : <IconSvg d={Icons.check} size={12} />}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                    {getChannelDisplayName(selectedChannel)}
                  </p>
                  {selectedChannel.Type === "group" &&
                    selectedChannel.CreatedBy === currentUserId && (
                      <button
                        type="button"
                        className="btn ghost btn-sm"
                        onClick={() => {
                          setGroupNameDraft(selectedChannel.Name || "");
                          setEditingGroupName(true);
                        }}
                        style={{ padding: 4 }}
                      >
                        <IconSvg d={Icons.edit} size={12} />
                      </button>
                    )}
                </div>
              )}
            </div>

            {selectedChannel.Type === "group" && (
              <p style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
                {selectedChannel.Members.length} miembro{selectedChannel.Members.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* DM: contact details */}
          {selectedChannel.Type === "direct" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {infoPanelLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ) : infoPanelData ? (
                <>
                  {infoPanelData.Position && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)", display: "flex", flexShrink: 0 }}>
                        <IconSvg d={Icons.briefcase} size={16} />
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Cargo</p>
                        <p style={{ margin: 0, fontWeight: 500, color: "var(--text-primary)" }}>
                          {infoPanelData.Position}
                        </p>
                      </div>
                    </div>
                  )}
                  {infoPanelData.Area && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)", display: "flex", flexShrink: 0 }}>
                        <IconSvg d={Icons.building} size={16} />
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Area</p>
                        <p style={{ margin: 0, fontWeight: 500, color: "var(--text-primary)" }}>
                          {infoPanelData.Area}
                        </p>
                      </div>
                    </div>
                  )}
                  {infoPanelData.Email && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)", display: "flex", flexShrink: 0 }}>
                        <IconSvg d={Icons.mail} size={16} />
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Correo</p>
                        <p
                          style={{
                            margin: 0,
                            fontWeight: 500,
                            color: "var(--text-primary)",
                            wordBreak: "break-all",
                          }}
                        >
                          {infoPanelData.Email}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                  No se pudo cargar la informacion
                </p>
              )}
            </div>
          )}

          {/* Group: member list */}
          {selectedChannel.Type === "group" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Miembros
                </p>
                <button
                  type="button"
                  className="btn ghost btn-sm"
                  onClick={() => setShowAddMember(!showAddMember)}
                >
                  <IconSvg d={Icons.plus} size={12} />
                  Agregar
                </button>
              </div>

              {/* Add member UI */}
              {showAddMember && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    padding: 8,
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-muted)",
                        display: "flex",
                      }}
                    >
                      <IconSvg d={Icons.search} size={12} />
                    </span>
                    <input
                      type="text"
                      className="form-input"
                      value={addMemberSearch}
                      onChange={(e) => setAddMemberSearch(e.target.value)}
                      placeholder="Buscar empleado..."
                      autoFocus
                      style={{ height: 30, paddingLeft: 28, fontSize: 12 }}
                    />
                  </div>
                  {addMemberSearch && addMemberFilteredEmployees.length > 0 && (
                    <div style={{ maxHeight: 160, overflowY: "auto" }}>
                      {addMemberFilteredEmployees.slice(0, 8).map((emp) => (
                        <button
                          key={emp.EmployeeID}
                          type="button"
                          style={{
                            display: "flex",
                            width: "100%",
                            alignItems: "center",
                            gap: 8,
                            borderRadius: 4,
                            padding: "6px 8px",
                            fontSize: 12,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            transition: "background 0.12s",
                            color: "var(--text-primary)",
                          }}
                          onClick={() => handleAddMember(emp)}
                          disabled={addingMember}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "var(--bg-subtle)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <MiniAvatar id={emp.EmployeeID} name={emp.FullName} size={22} />
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {emp.FullName}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {addMemberSearch && addMemberFilteredEmployees.length === 0 && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 4px" }}>
                      Sin resultados
                    </p>
                  )}
                </div>
              )}

              {/* Members */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {selectedChannel.Members.map((memberId) => {
                  const name = selectedChannel.MemberNames[memberId] ?? "Desconocido";
                  const isCreator = selectedChannel.CreatedBy === memberId;
                  const isMe = memberId === currentUserId;
                  return (
                    <div
                      key={memberId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        borderRadius: 8,
                        padding: "6px 8px",
                      }}
                    >
                      <MiniAvatar id={memberId} name={name} size={24} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          style={{
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: 12,
                            fontWeight: 500,
                            color: "var(--text-primary)",
                          }}
                        >
                          {name}
                          {isMe && (
                            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                              {" "}
                              (tu)
                            </span>
                          )}
                        </p>
                        {isCreator && (
                          <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>
                            Creador
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leave group */}
              <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  className="btn ghost btn-sm"
                  onClick={handleLeaveGroup}
                  disabled={leavingGroup}
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    color: "var(--danger)",
                  }}
                >
                  {leavingGroup ? <Spinner size={12} /> : <IconSvg d={Icons.logout} size={14} />}
                  Salir del grupo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    ) : null;

  // =========================================================================
  // MESSAGE BUBBLE
  // =========================================================================

  const renderMessage = (msg: ChatMessage, idx: number) => {
    const isGroup = selectedChannel?.Type === "group";
    return (
      <MessageBubble
        key={msg.MessageID}
        msg={msg}
        prev={messages[idx - 1]}
        currentUserId={currentUserId ?? undefined}
        isGroup={isGroup}
        renderAvatar={(m, size) => (
          <MiniAvatar id={m.SenderID} name={m.SenderName} size={size} />
        )}
        onReact={toggleReaction}
        onReply={handleReply}
      />
    );
  };

    // =========================================================================
  // THREAD PANEL
  // =========================================================================

  const threadPanel = selectedChannelId ? (
    <div
      style={{
        position: "relative",
        display: "flex",
        height: "100%",
        width: "100%",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      {/* Thread header */}
      <div
        style={{
          display: "flex",
          height: 56,
          flexShrink: 0,
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          padding: "0 16px",
        }}
      >
        <button
          type="button"
          className="btn ghost btn-sm"
          onClick={handleBackToList}
          style={{ marginLeft: -4 }}
          aria-label="Volver"
        >
          <IconSvg d={Icons.arrowLeft} size={14} />
        </button>
        {selectedChannel && (
          <>
            <button
              type="button"
              onClick={toggleInfoPanel}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                minWidth: 0,
                flex: 1,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                padding: 0,
                color: "inherit",
              }}
            >
              <MiniAvatar
                id={selectedChannel.ChannelID}
                name={getChannelDisplayName(selectedChannel)}
                isGroupHash={selectedChannel.Type !== "direct"}
                size={32}
                badgeStatus={
                  selectedChannel.Type === "direct" ? otherUserPresence?.status : undefined
                }
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {getChannelDisplayName(selectedChannel)}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color:
                      otherUserPresence?.status === "online"
                        ? "var(--success)"
                        : "var(--text-muted)",
                  }}
                >
                  {typingUsers.length > 0
                    ? `${typingUsers.join(", ")} escribiendo...`
                    : selectedChannel.Type === "direct"
                      ? otherUserPresence
                        ? getPresenceDisplay(otherUserPresence.status).label +
                          (otherUserPresence.status === "offline" && otherUserPresence.lastActivity
                            ? ` · ${formatLastSeen(otherUserPresence.lastActivity)}`
                            : "")
                        : "Cargando..."
                      : `${selectedChannel.Members.length} miembro${selectedChannel.Members.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </button>
            <button
              type="button"
              className={`btn ghost btn-sm`}
              onClick={toggleInfoPanel}
              style={{
                flexShrink: 0,
                background: showInfoPanel ? "var(--bg-subtle)" : "transparent",
                color: showInfoPanel ? "var(--text-primary)" : "var(--text-secondary)",
              }}
              aria-label="Info"
            >
              <IconSvg d={Icons.helpCircle} size={14} />
            </button>
          </>
        )}
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {messagesLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "32px 0" }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: i % 2 === 0 ? "flex-end" : "flex-start",
                  }}
                >
                  {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full" />}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <Skeleton
                      className={i % 2 === 0 ? "h-10 w-48 rounded-2xl" : "h-10 w-56 rounded-2xl"}
                    />
                    <Skeleton className="h-2.5 w-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={Icons.send}
              title="Inicia la conversación"
              description="Envia el primer mensaje para comenzar a chatear con tu equipo"
            />
          ) : (
            messages.map((msg, idx) => renderMessage(msg, idx))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick-share pills */}
      {showShareMenu && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderTop: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            padding: "8px 16px",
          }}
        >
          <button
            type="button"
            onClick={shareAttendance}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.12s",
              color: "var(--text-primary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
          >
            <span style={{ color: "var(--success)", display: "flex" }}>
              <IconSvg d={Icons.check} size={14} />
            </span>
            Compartir asistencia
          </button>
          <button
            type="button"
            onClick={shareEvent}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.12s",
              color: "var(--text-primary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
          >
            <span style={{ color: "var(--accent-strong)", display: "flex" }}>
              <IconSvg d={Icons.calendar} size={14} />
            </span>
            Compartir evento
          </button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          style={{
            position: "fixed",
            bottom: 80,
            right: 96,
            zIndex: 50,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            padding: 12,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: 4,
            }}
          >
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                style={{
                  display: "flex",
                  height: 32,
                  width: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  fontSize: 18,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reply bar */}
      {replyTo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderTop: "1px solid var(--border)",
            background: "var(--bg-subtle)",
            padding: "8px 16px",
          }}
        >
          <div
            style={{
              height: 32,
              width: 3,
              borderRadius: 2,
              background: "var(--accent)",
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--accent-strong)" }}>
              {replyTo.senderName}
            </p>
            <p
              style={{
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              {replyTo.content}
            </p>
          </div>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={() => setReplyTo(null)}
            style={{ flexShrink: 0, padding: 4 }}
            aria-label="Cancelar respuesta"
          >
            <IconSvg d={Icons.x} size={12} />
          </button>
        </div>
      )}

      {/* Typing indicator — bouncing dots in a "them" bubble (handoff .chat-typing) */}
      {typingUsers.length > 0 && (
        <div
          style={{
            padding: "8px 24px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-elevated)",
          }}
        >
          <div className="msg-typing-row" style={{ maxWidth: 880, margin: "0 auto" }}>
            <div className="msg-typing-bubble" aria-hidden>
              <span className="msg-typing-dot" />
              <span className="msg-typing-dot" />
              <span className="msg-typing-dot" />
            </div>
            <span className="msg-typing-label">
              {typingUsers.length === 1
                ? `${typingUsers[0]} está escribiendo…`
                : `${typingUsers.join(", ")} están escribiendo…`}
            </span>
          </div>
        </div>
      )}

      {/* Input area */}
      <form
        onSubmit={handleSend}
        style={{
          borderTop: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
          }}
        >
          {/* Plus / share toggle */}
          <button
            type="button"
            onClick={() => setShowShareMenu(!showShareMenu)}
            style={{
              display: "flex",
              height: 36,
              width: 36,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background: showShareMenu ? "var(--bg-subtle)" : "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              transition: "all 0.2s",
              transform: showShareMenu ? "rotate(45deg)" : "rotate(0)",
            }}
            aria-label="Compartir"
          >
            <IconSvg d={Icons.plus} size={18} />
          </button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              if (selectedChannelId && e.target.value) startTyping(selectedChannelId);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => stopTyping()}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="form-textarea"
            style={{
              flex: 1,
              resize: "none",
              borderRadius: 18,
              padding: "10px 16px",
              fontSize: 13,
              minHeight: 40,
              maxHeight: 128,
              background: "var(--bg-subtle)",
            }}
          />

          {/* Emoji picker toggle */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            style={{
              display: "flex",
              height: 36,
              width: 36,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            aria-label="Emoji"
          >
            <IconSvg d={Icons.smile} size={18} />
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={!messageText.trim() || sendMessage.isPending}
            style={{
              display: "flex",
              height: 36,
              width: 36,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background: "var(--accent)",
              color: "#0a1628",
              border: "none",
              cursor: messageText.trim() ? "pointer" : "not-allowed",
              opacity: messageText.trim() ? 1 : 0.5,
              transform: messageText.trim() ? "scale(1)" : "scale(0.9)",
              transition: "all 0.2s",
            }}
            aria-label="Enviar"
          >
            {sendMessage.isPending ? <Spinner size={16} /> : <IconSvg d={Icons.send} size={16} />}
          </button>
        </div>
      </form>

      {/* Info panel overlay */}
      {infoPanelContent}
    </div>
  ) : (
    /* Empty state */
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-subtle)",
        padding: 32,
        textAlign: "center",
      }}
    >
      <div style={{ position: "relative", marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            height: 80,
            width: 80,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            background: "var(--accent-soft)",
            color: "var(--accent-strong)",
          }}
        >
          <IconSvg d={Icons.chat} size={36} />
        </div>
        <div
          style={{
            position: "absolute",
            bottom: -4,
            right: -4,
            display: "flex",
            height: 32,
            width: 32,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: "var(--accent)",
            color: "#0a1628",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <IconSvg d={Icons.users} size={16} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
        Tus mensajes
      </p>
      <p
        style={{
          marginTop: 8,
          maxWidth: 320,
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}
      >
        Selecciona una conversación o crea una nueva para empezar a chatear con tu equipo.
      </p>
      <button
        type="button"
        className="btn primary"
        onClick={() => setCreateOpen(true)}
        style={{ marginTop: 24, borderRadius: 999, padding: "8px 24px" }}
      >
        <IconSvg d={Icons.plus} size={14} />
        Nueva conversación
      </button>
    </div>
  );

  // =========================================================================
  // LAYOUT
  // =========================================================================

  return (
    <>
      <div
        style={{
          // Cancel the `.main` parent's `padding: 0 28px 28px` so the
          // messaging UI sits edge-to-edge inside the content area.
          margin: "0 -28px -28px",
          display: "flex",
          // Topbar is ~52px sticky; leave a tiny buffer so the bottom of
          // the composer never gets clipped by an off-by-one on smaller
          // viewports.
          height: "calc(100vh - 58px)",
          minHeight: 480,
          background: "var(--bg)",
        }}
      >
        {/* Desktop: both panels */}
        <aside
          className="msgs-aside"
          style={{
            display: "none",
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          {channelListPanel}
        </aside>
        <section
          className="msgs-section"
          style={{
            display: "none",
            flex: 1,
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {threadPanel}
        </section>

        {/* Mobile: one or the other */}
        <div
          className="msgs-mobile"
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
          }}
        >
          {showMobileThread && selectedChannelId ? threadPanel : channelListPanel}
        </div>
      </div>

      {/* Responsive: show desktop layout at >=768px, hide mobile */}
      <style jsx>{`
        @media (min-width: 768px) {
          .msgs-aside {
            display: flex !important;
            flex-direction: column;
            width: 320px;
          }
          .msgs-section {
            display: flex !important;
          }
          .msgs-mobile {
            display: none !important;
          }
        }
        @media (min-width: 1024px) {
          .msgs-aside {
            width: 360px;
          }
        }
      `}</style>

      {/* Create channel sheet (rendered last so overlay is on top) */}
      {createChannelSheet}
    </>
  );
}
