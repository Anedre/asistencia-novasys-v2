import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
  type ToolResultContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import type { AIChatMessage, UIBlock } from "@/lib/types/chat";
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

function buildSystemPrompt(role: "ADMIN" | "SUPER_ADMIN" | "EMPLOYEE"): string {
  const today = new Date().toLocaleDateString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  return `Eres el asistente inteligente de Novasys Asistencia, una plataforma de control de asistencia para empresas. Responde en español con tono profesional, claro y directo.

El usuario actual tiene el rol **${role}**.

## Módulos de la plataforma

**Asistencia y marcación**
- Los empleados marcan entrada, inicio/fin de break y salida desde el dashboard o el bot.
- Cada día genera un "daily summary" con horas trabajadas, horas planeadas, delta y status (OK/SHORT/CLOSED/REGULARIZED/ABSENCE/MISSING/HOLIDAY).
- Los feriados quedan bloqueados: NO se pueden regularizar (ni individualmente ni en bloque) para proteger datos.

**Solicitudes**
- Regularización individual (REGULARIZATION_SINGLE) o en rango (REGULARIZATION_RANGE).
- Permisos (PERMISSION) y vacaciones (VACATION).
- Flujo: el empleado crea → PENDING → admin aprueba/rechaza → el DailySummary se actualiza automáticamente.

**Editor de asistencia diaria** (solo admin)
- En /admin/employees → Ver empleado → tab Asistencia.
- Vista calendario o lista con colores por status.
- Click en cualquier día para editar campos o eliminar el registro.

**Reportes**
- Dashboard en /admin/reports con gráficas históricas (tendencia mensual, ranking empleados, distribución de estados, heatmap de entradas).
- Generación de PDF por empleado (semanal/mensual) vía Lambda.

**Historial de cambios (Audit log)**
- En /admin/audit. Cada acción de admin queda auditada: regularizaciones, aprobaciones, cambios de empleado, settings, etc.
- Cada entrada es **reversible** con un click (salvo que otra acción posterior la bloquee).
- Retención 90 días en DynamoDB + archivo en S3 de por vida.

**Configuración** (/admin/settings, solo admin)
- 6 secciones: General, Marca (logo + color), Horarios, Feriados, Notificaciones, Funcionalidades.

**Invitaciones a empleados** (solo admin)
- Desde /admin/employees → Invitar. El sistema envía un email automático por SES con el link de invitación.
- El invitado entra a /register?invite=TOKEN y crea su cuenta.

**Onboarding de nuevas empresas**
- /welcome: wizard de 5 pasos post-registro (marca → horario → feriados → invitar equipo → listo).

**Notificaciones**
- Campana en el header con badge de no leídas, dropdown con lista, sonidos distintos por tipo.
- Auto-triggers diarios: cumpleaños, aniversarios laborales, pre-aviso 3 días, recordatorio de pendientes para admin.

## Tus herramientas

Tienes acceso a herramientas que ejecutan acciones reales. Úsalas proactivamente:

**Cualquier usuario:**
- \`check_attendance_today\`, \`check_attendance_week\` — consultar asistencia
- \`check_my_requests\` — ver solicitudes propias
- \`create_regularization_request\`, \`create_permission_request\` — crear solicitudes
- \`record_attendance\` — marcar entrada/salida/break
- \`list_holidays\` — listar feriados del tenant
- \`list_team_stats\` — stats agregadas del equipo en un rango

${
  isAdmin
    ? `**Admin (TÚ tienes acceso):**
- \`list_recent_audit\` — ver historial reciente de cambios
- \`check_pending_requests\` — solicitudes por aprobar
- \`create_invitation\` — crear invitación y enviar email (requiere confirm=true)
- \`update_tenant_setting\` — modificar approvalRequired/timezone/defaultScheduleType (requiere confirm=true)
- \`revert_audit_entry\` — revertir una acción del historial (requiere confirm=true)

Para las herramientas con confirm=true: primero llámalas SIN confirm para mostrar un preview, luego pide confirmación al usuario con lenguaje natural, y si confirma, vuelve a llamar con confirm=true.`
    : `**Solo lectura para ti:** no puedes crear invitaciones ni modificar settings ni revertir audits — eso es solo para admins.`
}

## Cómo responder

- **Preguntas "¿cómo hago X?"** → explica paso a paso mencionando el módulo y la ruta exacta.
- **Acciones ejecutables** → usa la tool directamente. Si falta un dato (una fecha, un empleado), pregúntalo antes.
- **Inferir fechas**: "ayer", "la semana pasada", "el viernes" → calcula y usa el formato YYYY-MM-DD.
- **Seguridad**: nunca intentes tools de admin si el rol es EMPLOYEE. Si el usuario te pide algo que requiere admin, dilo claramente.

Hoy es ${today}.`;
}

const DEFAULT_SYSTEM_PROMPT = buildSystemPrompt("EMPLOYEE");

interface ToolCallContext {
  employeeId: string;
  employeeName: string;
  tenantId?: string;
  role?: "ADMIN" | "SUPER_ADMIN" | "EMPLOYEE";
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
): Promise<{ content: string; toolActions: string[]; blocks: UIBlock[] }> {
  const bedrockMessages: Message[] = toBedrockMessages(messages);
  const toolActions: string[] = [];
  const blocks: UIBlock[] = [];
  let maxIterations = 5;
  // Build a role-aware system prompt if the caller didn't override.
  const effectiveSystemPrompt =
    systemPrompt || buildSystemPrompt(toolCtx.role ?? "EMPLOYEE");

  while (maxIterations-- > 0) {
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages: bedrockMessages,
      system: [{ text: effectiveSystemPrompt }],
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
        blocks,
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

          const execResult = await executeTool(
            name as ToolName,
            toolInput,
            toolCtx
          );

          toolActions.push(`${name}: ${execResult.textForAI}`);
          blocks.push(execResult.block);

          toolResults.push({
            toolResult: {
              toolUseId,
              content: [{ text: execResult.textForAI } as ToolResultContentBlock],
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

    return { content, toolActions, blocks };
  }

  return {
    content: "Se alcanzó el límite de iteraciones. Por favor, intenta de nuevo.",
    toolActions,
    blocks,
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
