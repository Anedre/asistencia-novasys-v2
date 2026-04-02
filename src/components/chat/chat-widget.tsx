"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTenantConfig } from "@/hooks/use-tenant";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  Loader2,
  Bot,
  User,
  X,
  Minus,
  ChevronLeft,
  Clock,
  CalendarDays,
  FileText,
  LogIn,
  Sparkles,
  LayoutGrid,
  UserCog,
} from "lucide-react";
import {
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useSendMessage,
} from "@/hooks/use-chat";
import { ChatBlockRenderer } from "./chat-blocks";
import type { AIChatMessage } from "@/lib/types/chat";
import { toast } from "sonner";

const QUICK_ACTIONS = [
  { label: "Mi asistencia hoy", icon: Clock, message: "Muestra mi asistencia de hoy" },
  { label: "Resumen semanal", icon: CalendarDays, message: "Dame mi resumen semanal de horas" },
  { label: "Regularizar fecha", icon: FileText, message: "Quiero regularizar mi asistencia" },
  { label: "Marcar entrada", icon: LogIn, message: "Marca mi entrada" },
  { label: "Solicitar permiso", icon: Send, message: "Quiero solicitar un permiso" },
  { label: "Mis solicitudes", icon: FileText, message: "Muestra el estado de mis solicitudes" },
  { label: "Editar perfil", icon: UserCog, message: "__NAVIGATE:/profile" },
];

export function ChatWidget() {
  const router = useRouter();
  const { data: tenant } = useTenantConfig();
  const aiEnabled = tenant?.settings?.features?.aiAssistant !== false;
  const [isOpen, setIsOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<AIChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading: sessionsLoading } = useChatSessions();
  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const sendMessage = useSendMessage(activeSessionId || "");

  const sessions = data?.sessions ?? [];
  const activeSession = sessions.find((s) => s.SessionID === activeSessionId);

  // Sync from server only when switching sessions
  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSession) {
      setLocalMessages([]);
      prevSessionIdRef.current = null;
      return;
    }
    if (prevSessionIdRef.current !== activeSession.SessionID) {
      setLocalMessages(activeSession.Messages);
      prevSessionIdRef.current = activeSession.SessionID;
    }
  }, [activeSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, isSending]);

  useEffect(() => {
    if (isOpen && activeSessionId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen, activeSessionId]);

  // Send pending message once session is ready
  useEffect(() => {
    if (pendingMessage && activeSessionId && !isSending) {
      const msg = pendingMessage;
      setPendingMessage(null);
      sendContent(msg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage, activeSessionId, isSending]);

  const handleCreateSession = async () => {
    try {
      const result = await createSession.mutateAsync();
      setActiveSessionId(result.session.SessionID);
      setLocalMessages([]);
      setShowSessions(false);
    } catch {
      toast.error("Error al crear la conversación");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession.mutateAsync(sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setLocalMessages([]);
      }
      toast.success("Conversación eliminada");
    } catch {
      toast.error("Error al eliminar la conversación");
    }
  };

  const sendContent = useCallback(async (content: string) => {
    if (!content.trim() || !activeSessionId || isSending) return;

    setInputValue("");
    setShowQuickMenu(false);
    setIsSending(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMessage: AIChatMessage = {
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMessage]);

    try {
      const result = await sendMessage.mutateAsync(content.trim());
      const assistantMsg: AIChatMessage = {
        ...result.message,
        blocks: result.blocks,
      };
      setLocalMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setLocalMessages((prev) => prev.slice(0, -1));
      toast.error("Error al enviar el mensaje. Intenta de nuevo.");
    } finally {
      setIsSending(false);
    }
  }, [activeSessionId, isSending, sendMessage]);

  /** Central action handler — intercepts navigation sentinels, otherwise sends to AI */
  const handleAction = useCallback((message: string) => {
    if (message.startsWith("__NAVIGATE:")) {
      const path = message.replace("__NAVIGATE:", "");
      router.push(path);
      setIsOpen(false);
      return;
    }

    if (!activeSessionId) {
      // Need to create session first
      createSession.mutateAsync().then((result) => {
        setActiveSessionId(result.session.SessionID);
        setLocalMessages([]);
        setPendingMessage(message);
      }).catch(() => {
        toast.error("Error al crear la conversación");
      });
      return;
    }

    sendContent(message);
  }, [activeSessionId, sendContent, router, createSession]);

  const handleSend = useCallback(() => {
    handleAction(inputValue);
  }, [inputValue, handleAction]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  if (!aiEnabled) return null;

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110",
          isOpen
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground"
        )}
        aria-label={isOpen ? "Cerrar asistente IA" : "Abrir asistente IA"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-300",
          isOpen
            ? "w-[400px] h-[600px] opacity-100 translate-y-0"
            : "w-0 h-0 opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b bg-gradient-to-r from-primary to-primary/80 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-primary-foreground">
              Asistente IA
            </h3>
            <p className="text-[10px] text-primary-foreground/70 truncate">
              {activeSession ? activeSession.Title : "Tu asistente de RRHH inteligente"}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="rounded-lg p-1.5 text-primary-foreground/70 hover:bg-white/15 hover:text-primary-foreground transition-colors"
              title="Ver conversaciones"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              onClick={handleCreateSession}
              className="rounded-lg p-1.5 text-primary-foreground/70 hover:bg-white/15 hover:text-primary-foreground transition-colors"
              title="Nueva conversación"
              disabled={createSession.isPending}
            >
              {createSession.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-primary-foreground/70 hover:bg-white/15 hover:text-primary-foreground transition-colors"
              title="Minimizar"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sessions panel (slide-over) */}
        {showSessions && (
          <div className="absolute inset-0 z-10 flex flex-col bg-background">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <button
                onClick={() => setShowSessions(false)}
                className="rounded-lg p-1 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="text-sm font-semibold flex-1">Conversaciones</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateSession}
                disabled={createSession.isPending}
                className="h-8 gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Nueva
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessionsLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Cargando...</p>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No hay conversaciones</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.SessionID}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                      activeSessionId === session.SessionID
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground/70"
                    )}
                    onClick={() => {
                      setActiveSessionId(session.SessionID);
                      setShowSessions(false);
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate text-xs">{session.Title}</span>
                    <button
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.SessionID);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Chat body */}
        <div className="flex flex-1 flex-col min-h-0">
          {!activeSessionId ? (
            /* Welcome state with quick actions */
            <div className="flex flex-1 flex-col p-4">
              <div className="flex flex-col items-center text-center mb-4 pt-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mt-3 text-sm font-semibold">
                  ¿En que te puedo ayudar?
                </h3>
                <p className="mt-1 text-[11px] text-muted-foreground max-w-[280px]">
                  Ejecuto acciones reales: regularizo asistencia, creo solicitudes, consulto horas y mas.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-auto">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleAction(action.message)}
                    disabled={createSession.isPending}
                    className="flex items-center gap-2 rounded-xl border bg-background p-3 text-left transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <action.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-[11px] font-medium leading-tight">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {localMessages.length === 0 && !isSending && (
                  <div className="space-y-3">
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <Bot className="h-7 w-7 text-muted-foreground/30" />
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Escribe un mensaje o usa una accion rapida
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {QUICK_ACTIONS.filter(a => !a.message.startsWith("__NAVIGATE")).map((action) => (
                        <button
                          key={action.label}
                          onClick={() => handleAction(action.message)}
                          className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-[10px] font-medium transition-all hover:border-primary/30 hover:bg-primary/5"
                        >
                          <action.icon className="h-3 w-3 text-primary" />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {localMessages.map((msg, idx) => (
                  <div key={idx}>
                    {msg.role === "user" ? (
                      <div className="flex gap-2 max-w-[85%] ml-auto flex-row-reverse">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <User className="h-3 w-3" />
                        </div>
                        <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3 py-2 text-xs leading-relaxed">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {msg.content && (
                          <div className="flex gap-2 max-w-[92%] mr-auto">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                              <Sparkles className="h-3 w-3 text-primary" />
                            </div>
                            <div className="rounded-2xl rounded-tl-sm bg-muted text-foreground px-3 py-2 text-xs leading-relaxed">
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        )}
                        {msg.blocks && msg.blocks.length > 0 && (
                          <div className="pl-8 space-y-2">
                            {msg.blocks.map((block, bIdx) => (
                              <ChatBlockRenderer key={bIdx} block={block} onAction={handleAction} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isSending && (
                  <div className="flex gap-2 max-w-[85%] mr-auto">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                      <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                    </div>
                    <div className="rounded-2xl bg-muted px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" />
                        <span className="ml-1 text-[10px] text-muted-foreground">Procesando...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick actions menu (toggle) */}
              {showQuickMenu && (
                <div className="border-t px-3 py-2 bg-muted/30">
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => handleAction(action.message)}
                        disabled={isSending}
                        className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1.5 text-[10px] font-medium transition-all hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50"
                      >
                        <action.icon className="h-3 w-3 text-primary" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="border-t bg-background px-3 py-2.5">
                <div className="flex items-end gap-1.5">
                  <button
                    onClick={() => setShowQuickMenu(!showQuickMenu)}
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors",
                      showQuickMenu
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    title="Acciones rapidas"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu mensaje..."
                    rows={1}
                    disabled={isSending}
                    className="flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background disabled:opacity-50"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isSending}
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-xl"
                  >
                    {isSending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
