"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";
import {
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useSendMessage,
} from "@/hooks/use-chat";
import type { AIChatMessage } from "@/lib/types/chat";
import { toast } from "sonner";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<AIChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading: sessionsLoading } = useChatSessions();
  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const sendMessage = useSendMessage(activeSessionId || "");

  const sessions = data?.sessions ?? [];
  const activeSession = sessions.find((s) => s.SessionID === activeSessionId);

  // Sync local messages when active session changes
  useEffect(() => {
    if (activeSession) {
      setLocalMessages(activeSession.Messages);
    } else {
      setLocalMessages([]);
    }
  }, [activeSession]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, isSending]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && activeSessionId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen, activeSessionId]);

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

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !activeSessionId || isSending) return;

    const content = inputValue.trim();
    setInputValue("");
    setIsSending(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMessage: AIChatMessage = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMessage]);

    try {
      const result = await sendMessage.mutateAsync(content);
      setLocalMessages((prev) => [...prev, result.message]);
    } catch {
      setLocalMessages((prev) => prev.slice(0, -1));
      toast.error("Error al enviar el mensaje. Intenta de nuevo.");
    } finally {
      setIsSending(false);
    }
  }, [inputValue, activeSessionId, isSending, sendMessage]);

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

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110",
          isOpen
            ? "bg-muted text-muted-foreground rotate-0"
            : "bg-primary text-primary-foreground"
        )}
        aria-label={isOpen ? "Cerrar asistente IA" : "Abrir asistente IA"}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Bot className="h-6 w-6" />
        )}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-300",
          isOpen
            ? "w-[380px] h-[560px] opacity-100 translate-y-0"
            : "w-0 h-0 opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b bg-primary px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-primary-foreground">
              Asistente IA
            </h3>
            <p className="text-xs text-primary-foreground/70 truncate">
              {activeSession ? activeSession.Title : "Pregúntame lo que necesites"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="rounded-lg p-1.5 text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors"
              title="Ver conversaciones"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              onClick={handleCreateSession}
              className="rounded-lg p-1.5 text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors"
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
              className="rounded-lg p-1.5 text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors"
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
                <p className="text-xs text-muted-foreground text-center py-4">
                  Cargando...
                </p>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No hay conversaciones
                </p>
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
                    <span className="flex-1 truncate text-xs">
                      {session.Title}
                    </span>
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
            /* Welcome state */
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <h3 className="mt-3 text-base font-semibold">
                ¡Hola! Soy tu asistente
              </h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-[280px]">
                Puedo ayudarte a regularizar asistencia, solicitar permisos,
                consultar tus horas, marcar entrada/salida y más.
              </p>
              <Button
                onClick={handleCreateSession}
                disabled={createSession.isPending}
                size="sm"
                className="mt-4 gap-1.5"
              >
                {createSession.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Iniciar conversación
              </Button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {localMessages.length === 0 && !isSending && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Bot className="h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Escribe un mensaje para comenzar
                    </p>
                  </div>
                )}

                {localMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-2 max-w-[90%]",
                      msg.role === "user"
                        ? "ml-auto flex-row-reverse"
                        : "mr-auto"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {msg.role === "user" ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-2 text-xs leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {isSending && (
                  <div className="flex gap-2 max-w-[90%] mr-auto">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-3 w-3" />
                    </div>
                    <div className="rounded-2xl bg-muted px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t px-3 py-2.5">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu mensaje..."
                    rows={1}
                    disabled={isSending}
                    className="flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
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
