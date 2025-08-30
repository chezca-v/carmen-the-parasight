import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    }
  }

  async generateResponse(prompt: string): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error('Failed to generate response from Gemini');
    }
  }

  async startChat(history: Array<{ role: string; parts: string }> = []) {
    if (!this.model) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const chat = this.model.startChat({
        history: history.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.parts }]
        })),
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      });

      return chat;
    } catch (error) {
      console.error('Error starting chat:', error);
      throw new Error('Failed to start chat with Gemini');
    }
  }
}

export default new GeminiService(); 