"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Bot,
  User,
} from "lucide-react";
import {
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useSendMessage,
} from "@/hooks/use-chat";
import type { AIChatMessage, ChatSession } from "@/lib/types/chat";
import { toast } from "sonner";

export default function ChatPage() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<AIChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
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

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
  };

  const handleCreateSession = async () => {
    try {
      const result = await createSession.mutateAsync();
      setActiveSessionId(result.session.SessionID);
      setLocalMessages([]);
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

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Optimistic update: add user message locally
    const userMessage: AIChatMessage = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMessage]);

    try {
      const result = await sendMessage.mutateAsync(content);
      // Add assistant message locally
      setLocalMessages((prev) => [...prev, result.message]);
    } catch {
      // Remove optimistic user message on error
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

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-2 top-2 z-20 md:hidden"
        onClick={() => setShowSidebar(!showSidebar)}
      >
        {showSidebar ? (
          <PanelLeftClose className="h-5 w-5" />
        ) : (
          <PanelLeftOpen className="h-5 w-5" />
        )}
      </Button>

      {/* Sessions sidebar */}
      <div
        className={cn(
          "flex w-72 flex-col border-r bg-muted/30 transition-all duration-200",
          showSidebar ? "translate-x-0" : "-translate-x-full absolute md:relative md:translate-x-0",
          "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-10 max-md:bg-background max-md:shadow-lg"
        )}
      >
        {/* New conversation button */}
        <div className="p-3 border-b">
          <Button
            onClick={handleCreateSession}
            disabled={createSession.isPending}
            className="w-full justify-start gap-2"
            variant="outline"
          >
            {createSession.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Nueva conversación
          </Button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessionsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-2">
              No hay conversaciones aún
            </p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.SessionID}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors",
                  activeSessionId === session.SessionID
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground/70"
                )}
                onClick={() => {
                  setActiveSessionId(session.SessionID);
                  // Hide sidebar on mobile after selection
                  if (window.innerWidth < 768) setShowSidebar(false);
                }}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{session.Title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.SessionID);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {!activeSessionId ? (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">
              Asistente de IA
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Inicia una conversación con el asistente de IA. Puede ayudarte con
              consultas sobre horarios, políticas de la empresa, trámites de RRHH
              y más.
            </p>
            <Button
              onClick={handleCreateSession}
              disabled={createSession.isPending}
              className="mt-6 gap-2"
            >
              {createSession.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Nueva conversación
            </Button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {localMessages.length === 0 && !isSending && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Bot className="h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Escribe un mensaje para comenzar la conversación
                  </p>
                </div>
              )}

              {localMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {msg.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isSending && (
                <div className="flex gap-3 max-w-[85%] mr-auto">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl bg-muted px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t p-4">
              <div className="flex items-end gap-2 max-w-4xl mx-auto">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu mensaje..."
                  rows={1}
                  disabled={isSending}
                  className="flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isSending}
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Enter para enviar, Shift+Enter para nueva línea
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
