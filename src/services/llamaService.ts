import { Ollama } from 'ollama';

class LlamaService {
  private ollama: Ollama;

  constructor() {
    this.ollama = new Ollama({ host: 'http://localhost:11434' });
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await this.ollama.generate({
        model: 'llama3',
        prompt: prompt,
      });
      return response.response;
    } catch (error) {
      console.error('Error generating response from Llama 3:', error);
      throw new Error(
        'Failed to generate response from Llama 3. Is Ollama running with the llama3 model?',
      );
    }
  }

  async startChat(history: Array<{ role: string; parts: string[] }>) {
    // Note: The 'ollama' library's chat handling might differ.
    // This is a simplified implementation for demonstration.
    try {
      const messages = history.map(msg => ({
        role: msg.role,
        content: msg.parts.join(' '),
      }));

      await this.ollama.chat({
        model: 'llama3',
        messages: messages,
      });

      return {
        sendMessage: async (newMessage: string) => {
          messages.push({ role: 'user', content: newMessage });
          const chatResponse = await this.ollama.chat({ model: 'llama3', messages });
          return chatResponse.message.content;
        },
      };
    } catch (error) {
      console.error('Error starting chat with Llama 3:', error);
      throw new Error('Failed to start chat with Llama 3.');
    }
  }
}

export default new LlamaService(); 