export interface LLMResponse {
  text: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LLMProviderInterface {
  name: string;
  generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse>;
  isAvailable(): boolean;
}

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
}
