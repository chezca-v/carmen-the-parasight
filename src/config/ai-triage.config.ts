/**
 * AI Triage Service Configuration
 * This file manages the configuration for the AI-powered triage service
 */

export interface AITriageConfig {
  enabled: boolean
  apiKey?: string
  rateLimit: {
    maxRequests: number
    windowMs: number
  }
  timeout: number
  batchSize: number
  batchDelay: number
  fallbackEnabled: boolean
}

/**
 * Default configuration for AI triage service
 */
export const defaultAITriageConfig: AITriageConfig = {
  enabled: true, // ENABLED to use AI triage when available
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
  rateLimit: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  timeout: 10000, // 10 seconds
  batchSize: 3,
  batchDelay: 1000, // 1 second
  fallbackEnabled: true,
}

/**
 * Get the current AI triage configuration
 */
export function getAITriageConfig(): AITriageConfig {
  return {
    ...defaultAITriageConfig,
    enabled: true, // ENABLED to use AI triage when available
    apiKey: import.meta.env.VITE_GEMINI_API_KEY,
  }
}

/**
 * Check if AI triage service is properly configured
 */
export function isAITriageConfigured(): boolean {
  const config = getAITriageConfig()
  return config.enabled && !!config.apiKey
}

/**
 * Get configuration status for debugging
 */
export function getAITriageStatus(): {
  configured: boolean
  enabled: boolean
  hasApiKey: boolean
  config: AITriageConfig
} {
  const config = getAITriageConfig()
  return {
    configured: isAITriageConfigured(),
    enabled: config.enabled,
    hasApiKey: !!config.apiKey,
    config,
  }
}
