import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
  type ToolResultContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import type { AIChatMessage } from "@/lib/types/chat";
import { AI_TOOLS } from "./tools";
import { executeTool } from "./tool-executor";
import type { ToolName } from "./tools";

const client = new BedrockRuntimeClient({
  region: process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  ...((process.env.CUSTOM_ACCESS_KEY_ID &&
    process.env.CUSTOM_SECRET_ACCESS_KEY) && {
    credentials: {
      accessKeyId: process.env.CUSTOM_ACCESS_KEY_ID,
      secretAccessKey: process.env.CUSTOM_SECRET_ACCESS_KEY,
    },
  }),
});

const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

const DEFAULT_SYSTEM_PROMPT =
  `Eres un asistente de recursos humanos inteligente para la plataforma Novasys Asistencia. Responde en español de forma profesional y concisa.

Tienes acceso a herramientas que te permiten ejecutar acciones reales en el sistema:
- Puedes regularizar asistencia (crear solicitudes de regularización)
- Puedes crear solicitudes de permisos y vacaciones
- Puedes consultar la asistencia del día o de la semana
- Puedes ver el estado de solicitudes pendientes
- Puedes registrar marcaciones de entrada/salida/break

Cuando el usuario pida realizar una acción, usa las herramientas disponibles. Si necesitas información que no tienes (como una fecha específica), pregunta al usuario antes de ejecutar la acción.

Hoy es ${new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.

Sé proactivo: si el usuario dice "regulariza ayer", infiere la fecha. Si dice "marca mi entrada", ejecuta la herramienta directamente.`;

interface ToolCallContext {
  employeeId: string;
  employeeName: string;
  tenantId?: string;
}

function toBedrockMessages(messages: AIChatMessage[]): Message[] {
  return messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: [{ text: msg.content } as ContentBlock],
  }));
}

/**
 * Send a message with tool use support.
 * Handles the tool use loop: model may request tools, we execute them and loop back.
 */
export async function sendMessageWithTools(
  messages: AIChatMessage[],
  toolCtx: ToolCallContext,
  systemPrompt?: string
): Promise<{ content: string; toolActions: string[] }> {
  const bedrockMessages: Message[] = toBedrockMessages(messages);
  const toolActions: string[] = [];
  let maxIterations = 5;

  while (maxIterations-- > 0) {
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages: bedrockMessages,
      system: [{ text: systemPrompt || DEFAULT_SYSTEM_PROMPT }],
      toolConfig: { tools: AI_TOOLS },
      inferenceConfig: {
        maxTokens: 2048,
        temperature: 0.5,
      },
    });

    const response = await client.send(command);
    const outputContent = response.output?.message?.content;
    const stopReason = response.stopReason;

    if (!outputContent || outputContent.length === 0) {
      return {
        content: "No pude generar una respuesta. Por favor, intenta de nuevo.",
        toolActions,
      };
    }

    // Add assistant message to conversation
    bedrockMessages.push({
      role: "assistant",
      content: outputContent,
    });

    // If model wants to use tools
    if (stopReason === "tool_use") {
      const toolUseBlocks = outputContent.filter(
        (block) => "toolUse" in block
      );

      const toolResults: ContentBlock[] = [];

      for (const block of toolUseBlocks) {
        if ("toolUse" in block && block.toolUse) {
          const { toolUseId, name, input } = block.toolUse;
          const toolInput = (input ?? {}) as Record<string, unknown>;

          const result = await executeTool(
            name as ToolName,
            toolInput,
            toolCtx
          );

          toolActions.push(`${name}: ${result}`);

          toolResults.push({
            toolResult: {
              toolUseId,
              content: [{ text: result } as ToolResultContentBlock],
            },
          } as ContentBlock);
        }
      }

      // Add tool results as user message
      bedrockMessages.push({
        role: "user",
        content: toolResults,
      });

      // Continue loop — model will process tool results
      continue;
    }

    // Model finished (end_turn or stop) — extract text
    const textBlock = outputContent.find((block) => "text" in block);
    const content =
      textBlock && "text" in textBlock
        ? textBlock.text!
        : "No pude generar una respuesta. Por favor, intenta de nuevo.";

    return { content, toolActions };
  }

  return {
    content: "Se alcanzó el límite de iteraciones. Por favor, intenta de nuevo.",
    toolActions,
  };
}

/** Simple message without tools (backward compatibility) */
export async function sendMessage(
  messages: AIChatMessage[],
  systemPrompt?: string
): Promise<string> {
  const command = new ConverseCommand({
    modelId: MODEL_ID,
    messages: toBedrockMessages(messages),
    system: [{ text: systemPrompt || DEFAULT_SYSTEM_PROMPT }],
    inferenceConfig: {
      maxTokens: 2048,
      temperature: 0.7,
    },
  });

  const response = await client.send(command);

  const outputContent = response.output?.message?.content;
  if (!outputContent || outputContent.length === 0) {
    return "No pude generar una respuesta. Por favor, intenta de nuevo.";
  }

  const textBlock = outputContent.find((block) => "text" in block);
  return textBlock && "text" in textBlock
    ? textBlock.text!
    : "No pude generar una respuesta. Por favor, intenta de nuevo.";
}
