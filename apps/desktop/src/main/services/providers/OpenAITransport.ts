import { AITransport } from '../ports';

export class OpenAITransport implements AITransport {
  private getProxyHint(): string {
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
    return proxy ? ` (proxy=${proxy})` : '';
  }

  public async testConnection(apiKey: string): Promise<{ ok: true }> {
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI network request failed: ${message}${this.getProxyHint()}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Connection failed: ${response.status} ${errorText}`);
    }

    return { ok: true };
  }

  public async chatCompletions(params: {
    apiKey: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    userPrompt: string;
  }): Promise<{
    content: string;
    requestId?: string;
    status: number;
    endpoint: string;
    rawResponseText?: string;
  }> {
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.apiKey}`
        },
        body: JSON.stringify({
          model: params.model,
          temperature: params.temperature,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt }
          ]
        })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `OpenAI network request failed: ${message}${this.getProxyHint()} endpoint=${endpoint}`,
      );
    }

    const requestId = response.headers.get('x-request-id') || response.headers.get('x-openai-request-id') || undefined;
    const rawBody = await response.text();

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${rawBody}`);
    }

    let data: { choices?: Array<{ message?: { content?: unknown } }> };
    try {
      data = JSON.parse(rawBody) as { choices?: Array<{ message?: { content?: unknown } }> };
    } catch {
      throw new Error(`OpenAI response is not valid JSON: ${rawBody}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('OpenAI response missing content');
    }

    return {
      content,
      requestId,
      status: response.status,
      endpoint,
      rawResponseText: rawBody.slice(0, 4000)
    };
  }
}
