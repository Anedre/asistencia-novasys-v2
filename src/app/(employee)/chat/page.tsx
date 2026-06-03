"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { IconSvg, Icons } from "@/components/nova/icons";
import {
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useSendMessage,
} from "@/hooks/use-chat";
import type { AIChatMessage } from "@/lib/types/chat";
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
    } catch (err) {
      // Remove optimistic user message on error
      setLocalMessages((prev) => prev.slice(0, -1));
      toast.error(
        err instanceof Error
          ? err.message
          : "Error al enviar el mensaje. Intenta de nuevo.",
      );
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
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 4rem)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Mobile sidebar toggle */}
      <button
        type="button"
        className="btn ghost btn-sm chat-mobile-toggle"
        aria-label={showSidebar ? "Ocultar panel" : "Mostrar panel"}
        onClick={() => setShowSidebar(!showSidebar)}
      >
        <IconSvg d={Icons.feed} size={18} />
      </button>

      {/* Sessions sidebar */}
      <div
        className="chat-sidebar"
        data-open={showSidebar ? "true" : "false"}
        style={{
          display: "flex",
          flexDirection: "column",
          width: 288,
          borderRight: "1px solid var(--border)",
          background: "var(--bg-subtle)",
          transition: "transform 0.2s",
        }}
      >
        {/* New conversation button */}
        <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={handleCreateSession}
            disabled={createSession.isPending}
            className="btn outline"
            style={{ width: "100%", justifyContent: "flex-start" }}
          >
            {createSession.isPending ? (
              <span className="spin" style={{ width: 16, height: 16, borderColor: "var(--text-muted)", borderTopColor: "transparent" }} />
            ) : (
              <IconSvg d={Icons.plus} size={16} />
            )}
            Nueva conversación
          </button>
        </div>

        {/* Sessions list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {sessionsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))
          ) : sessions.length === 0 ? (
            <p
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                textAlign: "center",
                padding: "32px 8px",
              }}
            >
              No hay conversaciones aún
            </p>
          ) : (
            sessions.map((session) => {
              const isActive = activeSessionId === session.SessionID;
              return (
                <div
                  key={session.SessionID}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  aria-label={`Abrir conversación ${session.Title}`}
                  onClick={() => {
                    setActiveSessionId(session.SessionID);
                    if (
                      typeof window !== "undefined" &&
                      window.innerWidth < 768
                    )
                      setShowSidebar(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveSessionId(session.SessionID);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: "var(--r-sm)",
                    padding: "10px 12px",
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "background 0.15s",
                    background: isActive ? "var(--accent-soft)" : "transparent",
                    color: isActive
                      ? "var(--accent-strong)"
                      : "var(--text-secondary)",
                    fontWeight: isActive ? 600 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLDivElement).style.background =
                        "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLDivElement).style.background =
                        "transparent";
                  }}
                  className="chat-session-row"
                >
                  <IconSvg d={Icons.chat} size={16} />
                  <span
                    style={{
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {session.Title}
                  </span>
                  <button
                    type="button"
                    className="btn ghost btn-sm chat-delete-btn"
                    style={{ padding: 4, color: "var(--danger)" }}
                    aria-label="Eliminar conversación"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.SessionID);
                    }}
                  >
                    <IconSvg d={Icons.trash} size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {!activeSessionId ? (
          /* Empty state — uses .chat-empty-hero CSS classes from nova-design.css */
          <div className="chat-empty-hero">
            <div className="chat-empty-hero-icon">
              <IconSvg d={Icons.chat} size={32} />
            </div>
            <h2 className="chat-empty-hero-title">Asistente de IA</h2>
            <p className="chat-empty-hero-sub">
              Inicia una conversación con el asistente de IA. Puede ayudarte con
              consultas sobre horarios, políticas de la empresa, trámites de
              RRHH y más.
            </p>
            <div className="chat-empty-hero-actions">
              <button
                type="button"
                onClick={handleCreateSession}
                disabled={createSession.isPending}
                className="btn primary"
              >
                {createSession.isPending ? (
                  <span
                    className="spin"
                    style={{
                      width: 14,
                      height: 14,
                      borderColor: "currentColor",
                      borderTopColor: "transparent",
                    }}
                  />
                ) : (
                  <IconSvg d={Icons.plus} size={14} />
                )}
                Nueva conversación
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {localMessages.length === 0 && !isSending && (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                  }}
                >
                  <IconSvg d={Icons.chat} size={40} className="opacity-50" />
                  <p
                    style={{
                      marginTop: 12,
                      fontSize: 13,
                      color: "var(--text-muted)",
                    }}
                  >
                    Escribe un mensaje para comenzar la conversación
                  </p>
                </div>
              )}

              {localMessages.map((msg, idx) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: 12,
                      maxWidth: "85%",
                      marginLeft: isUser ? "auto" : 0,
                      marginRight: isUser ? 0 : "auto",
                      flexDirection: isUser ? "row-reverse" : "row",
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className={`avatar ${isUser ? "accent" : "plain"}`}
                      style={{
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                      }}
                    >
                      <IconSvg
                        d={isUser ? Icons.user : Icons.chat}
                        size={16}
                      />
                    </div>

                    {/* Bubble */}
                    <div
                      style={{
                        borderRadius: 18,
                        padding: "10px 16px",
                        fontSize: 13,
                        lineHeight: 1.55,
                        background: isUser
                          ? "var(--text-primary)"
                          : "var(--bg-subtle)",
                        color: isUser
                          ? "var(--bg-elevated)"
                          : "var(--text-primary)",
                        border: isUser
                          ? "none"
                          : "1px solid var(--border)",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Loading indicator */}
              {isSending && (
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    maxWidth: "85%",
                    marginRight: "auto",
                  }}
                >
                  <div
                    className="avatar plain"
                    style={{ width: 32, height: 32, flexShrink: 0 }}
                  >
                    <IconSvg d={Icons.chat} size={16} />
                  </div>
                  <div
                    style={{
                      borderRadius: 18,
                      padding: "12px 16px",
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--text-muted)",
                        animation: "bounce 1.4s infinite",
                        animationDelay: "-0.3s",
                      }}
                    />
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--text-muted)",
                        animation: "bounce 1.4s infinite",
                        animationDelay: "-0.15s",
                      }}
                    />
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--text-muted)",
                        animation: "bounce 1.4s infinite",
                      }}
                    />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div
              style={{
                borderTop: "1px solid var(--border)",
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  maxWidth: 960,
                  margin: "0 auto",
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu mensaje..."
                  rows={1}
                  disabled={isSending}
                  className="form-textarea"
                  style={{
                    flex: 1,
                    resize: "none",
                    borderRadius: 12,
                    padding: "12px 16px",
                    minHeight: 0,
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isSending}
                  className="btn primary"
                  aria-label="Enviar mensaje"
                  style={{
                    height: 44,
                    width: 44,
                    flexShrink: 0,
                    borderRadius: 12,
                    padding: 0,
                    justifyContent: "center",
                  }}
                >
                  {isSending ? (
                    <span
                      className="spin"
                      style={{
                        width: 16,
                        height: 16,
                        borderColor: "currentColor",
                        borderTopColor: "transparent",
                      }}
                    />
                  ) : (
                    <IconSvg d={Icons.send} size={16} />
                  )}
                </button>
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                Enter para enviar, Shift+Enter para nueva línea
              </p>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%,
          80%,
          100% {
            transform: scale(0);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .chat-mobile-toggle {
          display: none;
        }
        @media (max-width: 768px) {
          .chat-mobile-toggle {
            display: inline-flex;
            position: absolute;
            top: 8px;
            left: 8px;
            z-index: 20;
          }
          .chat-sidebar {
            position: absolute;
            inset: 0 auto 0 0;
            z-index: 10;
            background: var(--bg-elevated) !important;
            box-shadow: var(--shadow-lg);
          }
          .chat-sidebar[data-open="false"] {
            transform: translateX(-100%);
          }
        }
        .chat-session-row .chat-delete-btn {
          opacity: 0;
          transition: opacity 0.15s;
        }
        .chat-session-row:hover .chat-delete-btn {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
