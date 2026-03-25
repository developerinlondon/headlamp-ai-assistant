import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, AIMessage } from '@langchain/core/messages';
import { ChatResult } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';

/**
 * Browser-compatible Bedrock chat model that sends requests through
 * an aws-sigv4-proxy. No AWS SDK needed — the proxy handles SigV4 signing.
 *
 * Bedrock Converse API: POST /model/{modelId}/converse
 */
export class ChatBedrockProxy extends BaseChatModel {
  proxyUrl: string;
  modelId: string;

  constructor(fields: { proxyUrl: string; modelId: string }) {
    super({});
    this.proxyUrl = fields.proxyUrl.replace(/\/$/, '');
    this.modelId = fields.modelId;
  }

  _llmType(): string {
    return 'bedrock-proxy';
  }

  async _generate(
    messages: BaseMessage[],
    _options: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    // Convert LangChain messages to Bedrock Converse format
    const bedrockMessages = messages
      .filter(m => m._getType() !== 'system')
      .map(m => ({
        role: m._getType() === 'human' ? 'user' : 'assistant',
        content: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
      }));

    // Extract system message if present
    const systemMessages = messages
      .filter(m => m._getType() === 'system')
      .map(m => ({ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }));

    const body: Record<string, any> = {
      messages: bedrockMessages,
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.7,
      },
    };

    if (systemMessages.length > 0) {
      body.system = systemMessages;
    }

    const url = `${this.proxyUrl}/model/${encodeURIComponent(this.modelId)}/converse`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bedrock API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Extract text from Bedrock Converse response
    const outputContent = data.output?.message?.content || [];
    const text = outputContent.map((c: any) => c.text || '').join('');

    return {
      generations: [
        {
          text,
          message: new AIMessage(text),
        },
      ],
    };
  }
}
