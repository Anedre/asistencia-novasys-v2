"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageCircle,
  Plus,
  Send,
  ArrowLeft,
  Loader2,
  Users,
  User,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useChannels,
  useMessages,
  useSendMessage,
  useCreateChannel,
} from "@/hooks/use-messaging";
import type { ChatChannel } from "@/lib/types/channel";

interface EmployeeOption {
  EmployeeID: string;
  FullName: string;
}

// Map API response (camelCase) to EmployeeOption (PascalCase)
function normalizeEmployee(raw: Record<string, unknown>): EmployeeOption {
  return {
    EmployeeID:
      (raw.EmployeeID as string) ?? (raw.employeeId as string) ?? "",
    FullName:
      (raw.FullName as string) ?? (raw.fullName as string) ?? "Sin nombre",
  };
}

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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMobileThread, setShowMobileThread] = useState(false);

  // Create form state
  const [newChannelType, setNewChannelType] = useState<"direct" | "group">(
    "direct"
  );
  const [newChannelName, setNewChannelName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<EmployeeOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeList, setEmployeeList] = useState<EmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentUserId = (session?.user as { employeeId?: string })?.employeeId;

  const channels = channelsData?.channels ?? [];
  const messages = messagesData?.messages ?? [];

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // When selecting a channel on mobile, show thread
  useEffect(() => {
    if (selectedChannelId) {
      setShowMobileThread(true);
    }
  }, [selectedChannelId]);

  // Fetch employees for member search
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
      // Silently fail
    } finally {
      setEmployeesLoading(false);
    }
  }, [employeeList.length]);

  useEffect(() => {
    if (showCreateForm) {
      fetchEmployees();
    }
  }, [showCreateForm, fetchEmployees]);

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

    // Reset form and navigate to new channel
    setShowCreateForm(false);
    setNewChannelName("");
    setSelectedMembers([]);
    setEmployeeSearch("");
    if (result.channel) {
      selectChannel(result.channel.ChannelID);
    }
  };

  const getChannelDisplayName = (channel: ChatChannel) => {
    if (channel.Name) return channel.Name;
    // For DMs, show the other person's name
    if (channel.Type === "direct" && currentUserId) {
      const otherMemberId = channel.Members.find((m) => m !== currentUserId);
      if (otherMemberId && channel.MemberNames[otherMemberId]) {
        return channel.MemberNames[otherMemberId];
      }
    }
    // Fallback: list member names
    const names = Object.entries(channel.MemberNames)
      .filter(([id]) => id !== currentUserId)
      .map(([, name]) => name);
    return names.join(", ") || "Canal";
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) {
      return d.toLocaleDateString("es-PE", { weekday: "short" });
    }
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
  };

  const filteredEmployees = employeeList.filter(
    (emp) =>
      emp.EmployeeID !== currentUserId &&
      !selectedMembers.some((m) => m.EmployeeID === emp.EmployeeID) &&
      (emp.FullName ?? "").toLowerCase().includes(employeeSearch.toLowerCase())
  );

  // ---- Channel list panel ----
  const channelListPanel = (
    <div className="flex h-full flex-col border-r">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">Mensajes</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Nuevo
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="border-b p-4 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Tipo</Label>
            <Select
              value={newChannelType}
              onValueChange={(v) => {
                if (v === "direct" || v === "group") setNewChannelType(v);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Mensaje directo</SelectItem>
                <SelectItem value="group">Grupo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {newChannelType === "group" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Nombre del grupo</Label>
              <Input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Nombre del grupo..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-medium">Buscar miembros</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                className="pl-8"
              />
            </div>
            {employeesLoading && (
              <p className="text-xs text-muted-foreground">Cargando...</p>
            )}
            {employeeSearch && filteredEmployees.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded border">
                {filteredEmployees.slice(0, 10).map((emp) => (
                  <button
                    key={emp.EmployeeID}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent truncate"
                    onClick={() => {
                      setSelectedMembers((prev) => [...prev, emp]);
                      setEmployeeSearch("");
                    }}
                  >
                    {emp.FullName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedMembers.map((m) => (
                <span
                  key={m.EmployeeID}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {m.FullName}
                  <button
                    onClick={() =>
                      setSelectedMembers((prev) =>
                        prev.filter((p) => p.EmployeeID !== m.EmployeeID)
                      )
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
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
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              Crear
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCreateForm(false);
                setSelectedMembers([]);
                setNewChannelName("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {channelsLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <MessageCircle className="mb-2 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No tienes conversaciones
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Crea una nueva para empezar
            </p>
          </div>
        ) : (
          channels.map((channel) => {
            const isActive = selectedChannelId === channel.ChannelID;
            const displayName = getChannelDisplayName(channel);
            const Icon = channel.Type === "direct" ? User : Users;

            return (
              <button
                key={channel.ChannelID}
                className={cn(
                  "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-accent/50",
                  isActive && "bg-accent"
                )}
                onClick={() => selectChannel(channel.ChannelID)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {displayName}
                    </p>
                    {channel.LastMessageAt && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatTime(channel.LastMessageAt)}
                      </span>
                    )}
                  </div>
                  {channel.LastMessage && (
                    <p className="truncate text-xs text-muted-foreground mt-0.5">
                      {channel.LastMessageBy && (
                        <span className="font-medium">
                          {channel.LastMessageBy}:{" "}
                        </span>
                      )}
                      {channel.LastMessage}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // ---- Message thread panel ----
  const selectedChannel = channels.find(
    (c) => c.ChannelID === selectedChannelId
  );

  const threadPanel = selectedChannelId ? (
    <div className="flex h-full flex-col">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button
          size="sm"
          variant="ghost"
          className="md:hidden"
          onClick={handleBackToList}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {selectedChannel && (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              {selectedChannel.Type === "direct" ? (
                <User className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {getChannelDisplayName(selectedChannel)}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedChannel.Members.length} miembro
                {selectedChannel.Members.length !== 1 ? "s" : ""}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messagesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-3/4 rounded-lg" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No hay mensajes aun. Envia el primero!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.SenderID === currentUserId;
            return (
              <div
                key={msg.MessageID}
                className={cn(
                  "flex flex-col max-w-[80%]",
                  isOwn ? "ml-auto items-end" : "items-start"
                )}
              >
                {!isOwn && (
                  <span className="mb-0.5 text-[10px] font-medium text-muted-foreground">
                    {msg.SenderName}
                  </span>
                )}
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm",
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {msg.Content}
                </div>
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatTime(msg.CreatedAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!messageText.trim() || sendMessage.isPending}
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
    <div className="flex h-full flex-col items-center justify-center text-center p-8">
      <MessageCircle className="mb-3 h-12 w-12 text-muted-foreground/30" />
      <p className="text-lg font-medium text-muted-foreground">
        Selecciona una conversacion o crea una nueva
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Tus mensajes apareceran aqui
      </p>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-lg border bg-card">
      {/* Desktop: show both panels */}
      <div className="hidden md:flex md:w-80 lg:w-96 shrink-0">
        {channelListPanel}
      </div>
      <div className="hidden md:flex md:flex-1">{threadPanel}</div>

      {/* Mobile: show one or the other */}
      <div className="flex flex-1 md:hidden">
        {showMobileThread && selectedChannelId ? threadPanel : channelListPanel}
      </div>
    </div>
  );
}
