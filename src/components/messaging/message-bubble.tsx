"use client";

/**
 * MessageBubble — single chat message row used by `/messages`.
 *
 * Wraps the `.msg-row / .msg-bubble-* / .msg-reply-preview / .msg-toolbar /
 * .msg-reactions` CSS classes from `nova-design.css`. Renders:
 *
 *   - an optional centered date separator (when the previous message was
 *     on a different calendar day)
 *   - the bubble itself, with sender avatar (groups only) + reply quote +
 *     content + inline timestamp
 *   - a hover toolbar with quick-reaction buttons + reply
 *   - the reactions strip below the bubble
 *
 * This component owns its own hover state so the parent doesn't have to
 * keep `hoveredMsgId` in sync — that was the previous source of awkward
 * lifted state.
 */

import { useState } from "react";
import { IconSvg, Icons } from "@/components/nova/icons";
import type { ChatMessage } from "@/lib/types/channel";

/* ----------------------------------------------- local helpers (pure) */

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function dateLabelFor(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d.toISOString(), today.toISOString())) return "Hoy";
  if (isSameDay(d.toISOString(), yesterday.toISOString())) return "Ayer";
  return d.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const QUICK_REACTIONS = ["\u{1F44D}", "❤️", "\u{1F602}", "\u{1F44F}", "\u{1F525}"] as const;

/* ----------------------------------------------- component */

export interface MessageBubbleProps {
  msg: ChatMessage;
  /** Previous message in the list — used to decide whether to show a date
   *  separator and whether to show the sender name (consecutive messages
   *  from the same sender are collapsed). */
  prev?: ChatMessage;
  /** EmployeeID of the viewer. Drives "mine" vs "theirs" styling. */
  currentUserId?: string;
  /** True when the parent channel is a group chat — controls avatar/name
   *  visibility (DMs don't show those on each message). */
  isGroup: boolean;
  /** Avatar rendered to the left of the bubble in groups. The parent owns
   *  this because it already has the avatar palette / sizing config. */
  renderAvatar: (msg: ChatMessage, size: number) => React.ReactNode;
  /** Toggle a reaction on this message. */
  onReact: (messageId: string, emoji: string) => void;
  /** Quote this message in the composer. */
  onReply: (msg: ChatMessage) => void;
}

export function MessageBubble({
  msg,
  prev,
  currentUserId,
  isGroup,
  renderAvatar,
  onReact,
  onReply,
}: MessageBubbleProps) {
  const isOwn = msg.SenderID === currentUserId;
  const showDateSep = !prev || !isSameDay(prev.CreatedAt, msg.CreatedAt);
  const showSender =
    !isOwn && (!prev || prev.SenderID !== msg.SenderID || showDateSep);
  const [hovered, setHovered] = useState(false);

  const reactions = msg.Reactions
    ? Object.entries(msg.Reactions).filter(([, r]) => r.userIds.length > 0)
    : [];

  return (
    <div>
      {showDateSep && (
        <div className="msg-date-sep">
          <div className="msg-date-sep-chip">{dateLabelFor(msg.CreatedAt)}</div>
        </div>
      )}

      <div
        className={`msg-row${isOwn ? " mine" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Avatar slot — groups only, and only on the first of a streak */}
        {!isOwn && isGroup ? (
          showSender ? (
            <div className="msg-row-avatar">{renderAvatar(msg, 24)}</div>
          ) : (
            <div className="msg-row-avatar-spacer" aria-hidden />
          )
        ) : null}

        <div className="msg-row-bubble-wrap">
          {showSender && isGroup && (
            <span className="msg-sender-name">{msg.SenderName.split(" ")[0]}</span>
          )}

          <div className="msg-bubble-shell">
            <div className={`msg-bubble-content${isOwn ? " mine" : ""}`}>
              {msg.ReplyTo && (
                <div className="msg-reply-preview">
                  <p className="msg-reply-preview-who">{msg.ReplyTo.senderName}</p>
                  <p className="msg-reply-preview-content">{msg.ReplyTo.content}</p>
                </div>
              )}

              <span>{msg.Content}</span>
            </div>

            {hovered && (
              <div className="msg-toolbar">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="msg-toolbar-btn"
                    onClick={() => onReact(msg.MessageID, emoji)}
                    aria-label={`Reaccionar con ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <div className="msg-toolbar-divider" aria-hidden />
                <button
                  type="button"
                  className="msg-toolbar-btn"
                  onClick={() => onReply(msg)}
                  title="Responder"
                  aria-label="Responder a este mensaje"
                >
                  <IconSvg d={Icons.arrowLeft} size={12} />
                </button>
              </div>
            )}
          </div>

          <div className={`msg-bubble-time${isOwn ? " mine" : ""}`}>
            <span>{formatBubbleTime(msg.CreatedAt)}</span>
            {isOwn && <IconSvg d={Icons.check} size={12} className="msg-read" />}
          </div>

          {reactions.length > 0 && (
            <div className="msg-reactions">
              {reactions.map(([emoji, data]) => {
                const hasReacted = currentUserId
                  ? data.userIds.includes(currentUserId)
                  : false;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onReact(msg.MessageID, emoji)}
                    title={data.userNames.join(", ")}
                    className={`msg-reaction-pill${hasReacted ? " mine" : ""}`}
                  >
                    <span>{emoji}</span>
                    <span className="msg-reaction-pill-count">{data.userIds.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
