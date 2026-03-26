import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import type { AIChatMessage } from "@/lib/types/chat";

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
  "Eres un asistente de recursos humanos para una empresa. Responde en español de forma profesional y concisa. Puedes ayudar con consultas sobre horarios, políticas de la empresa, trámites de RRHH, y más.";

function toBedrockMessages(messages: AIChatMessage[]): Message[] {
  return messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: [{ text: msg.content } as ContentBlock],
  }));
}

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
