"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useTenantConfig } from "@/hooks/use-tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Avatar,
  AvatarFallback,
  AvatarBadge,
} from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Loader2,
  Search,
  Hash,
  X,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useChannels,
  useMessages,
  useSendMessage,
} from "@/hooks/use-messaging";
import type { ChatChannel } from "@/lib/types/channel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  "bg-blue-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-violet-500",
  "bg-cyan-500","bg-pink-500","bg-teal-500","bg-orange-500","bg-indigo-500",
] as const;

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
  if (diffDays === 0) return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return d.toLocaleDateString("es-PE", { weekday: "short" });
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
}

function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
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
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export function MessagingWidget() {
  const { data: session } = useSession();
  const { data: tenant } = useTenantConfig();
  const chatEnabled = tenant?.settings?.features?.chat !== false;
  const currentUserId = (session?.user as { employeeId?: string })?.employeeId;

  const [isOpen, setIsOpen] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [channelSearch, setChannelSearch] = useState("");

  const { data: channelsData, isLoading: channelsLoading } = useChannels();
  const { data: messagesData, isLoading: messagesLoading } = useMessages(activeChannelId);
  const sendMessage = useSendMessage(activeChannelId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const channels = channelsData?.channels ?? [];
  const messages = messagesData?.messages ?? [];

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Focus input when opening a channel
  useEffect(() => {
    if (activeChannelId && isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeChannelId, isOpen]);

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

  const activeChannel = channels.find((c) => c.ChannelID === activeChannelId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeChannelId) return;
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

  const handleBack = () => {
    setActiveChannelId(null);
    setMessageText("");
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  if (!chatEnabled) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-22 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110",
          isOpen
            ? "bg-muted text-muted-foreground"
            : "bg-blue-600 text-white hover:bg-blue-700",
        )}
        aria-label={isOpen ? "Cerrar mensajes" : "Abrir mensajes"}
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-24 right-22 z-50 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-300",
          isOpen
            ? "w-[380px] h-[560px] opacity-100 translate-y-0"
            : "w-0 h-0 opacity-0 translate-y-4 pointer-events-none",
        )}
      >
        {/* ============================================================= */}
        {/* VIEW: Channel List                                            */}
        {/* ============================================================= */}
        {!activeChannelId ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">Mensajes</h3>
                <p className="text-[10px] text-white/70">
                  {channels.length} conversacion{channels.length !== 1 ? "es" : ""}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
                title="Minimizar"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="h-8 rounded-lg bg-muted/50 pl-8 text-xs border-0 focus-visible:ring-1"
                />
              </div>
            </div>

            {/* Channel list */}
            <ScrollArea className="flex-1">
              {channelsLoading ? (
                <div className="space-y-1 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-lg px-2 py-2.5">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-2.5 w-36" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {channelSearch ? "Sin resultados" : "No tienes conversaciones"}
                  </p>
                </div>
              ) : (
                <div className="px-1.5 py-0.5">
                  {filteredChannels.map((channel) => {
                    const displayName = getChannelDisplayName(channel);
                    const isDirect = channel.Type === "direct";
                    return (
                      <button
                        key={channel.ChannelID}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent/50"
                        onClick={() => setActiveChannelId(channel.ChannelID)}
                      >
                        <Avatar size="sm" className="shrink-0">
                          <AvatarFallback className={cn("text-[10px] font-semibold text-white", colorFor(channel.ChannelID))}>
                            {isDirect ? getInitials(displayName) : <Hash className="h-3.5 w-3.5" />}
                          </AvatarFallback>
                          {isDirect && <AvatarBadge className="bg-emerald-500" />}
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <p className="truncate text-xs font-medium">{displayName}</p>
                            {channel.LastMessageAt && (
                              <span className="shrink-0 text-[9px] text-muted-foreground">{formatRelative(channel.LastMessageAt)}</span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {channel.LastMessage ? (
                              <>
                                {channel.LastMessageBy && <span className="font-medium">{channel.LastMessageBy.split(" ")[0]}: </span>}
                                {channel.LastMessage}
                              </>
                            ) : (
                              <span className="italic">Sin mensajes</span>
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          /* ============================================================= */
          /* VIEW: Active Chat                                             */
          /* ============================================================= */
          <>
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b bg-gradient-to-r from-blue-600 to-blue-500 px-3 py-2.5">
              <button
                onClick={handleBack}
                className="rounded-lg p-1 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              {activeChannel && (
                <>
                  <Avatar size="sm">
                    <AvatarFallback className={cn("text-[10px] font-semibold text-white", colorFor(activeChannel.ChannelID))}>
                      {activeChannel.Type === "direct" ? getInitials(getChannelDisplayName(activeChannel)) : <Hash className="h-3.5 w-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-semibold text-white">{getChannelDisplayName(activeChannel)}</p>
                    <p className="text-[10px] text-white/60">
                      {activeChannel.Type === "direct" ? "En linea" : `${activeChannel.Members.length} miembros`}
                    </p>
                  </div>
                </>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {messagesLoading ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "justify-end" : "")}>
                      {i % 2 !== 0 && <Skeleton className="h-6 w-6 rounded-full shrink-0" />}
                      <Skeleton className={cn("h-8 rounded-2xl", i % 2 === 0 ? "w-32" : "w-40")} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Send className="h-6 w-6 text-muted-foreground/30" />
                  <p className="mt-2 text-[11px] text-muted-foreground">Envia el primer mensaje</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwn = msg.SenderID === currentUserId;
                  const prev = messages[idx - 1];
                  const showDateSep = !prev || !isSameDay(prev.CreatedAt, msg.CreatedAt);
                  const showSender = !isOwn && (!prev || prev.SenderID !== msg.SenderID || showDateSep);

                  return (
                    <div key={msg.MessageID}>
                      {showDateSep && (
                        <div className="flex items-center justify-center py-2">
                          <span className="rounded-full bg-muted/80 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {dateLabelFor(msg.CreatedAt)}
                          </span>
                        </div>
                      )}
                      <div className={cn("flex items-end gap-1.5 py-0.5", isOwn ? "flex-row-reverse" : "flex-row")}>
                        {!isOwn ? (
                          showSender ? (
                            <Avatar size="sm" className="mb-4 shrink-0">
                              <AvatarFallback className={cn("text-[9px] font-semibold text-white", colorFor(msg.SenderID))}>
                                {getInitials(msg.SenderName)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-6 shrink-0" />
                          )
                        ) : null}
                        <div className={cn("max-w-[80%] flex flex-col", isOwn ? "items-end" : "items-start")}>
                          {showSender && (
                            <span className="mb-0.5 ml-0.5 text-[10px] font-medium text-muted-foreground">
                              {msg.SenderName.split(" ")[0]}
                            </span>
                          )}
                          <div
                            className={cn(
                              "rounded-2xl px-3 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words",
                              isOwn ? "bg-blue-600 text-white rounded-br-md" : "bg-muted text-foreground rounded-bl-md",
                            )}
                          >
                            {msg.Content}
                          </div>
                          <span className="mt-0.5 px-0.5 text-[9px] text-muted-foreground/60">
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

            {/* Input */}
            <form onSubmit={handleSend} className="border-t bg-background px-3 py-2.5">
              <div className="flex items-center gap-2">
                <textarea
                  ref={inputRef}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring focus:bg-background max-h-20 overflow-y-auto"
                  style={{ minHeight: "36px" }}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!messageText.trim() || sendMessage.isPending}
                  className="h-8 w-8 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
}
