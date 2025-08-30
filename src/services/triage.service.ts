import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAITriageConfig, isAITriageConfigured, getAITriageStatus } from '../config/ai-triage.config'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '')

// Cache for urgency evaluations to avoid repeated API calls
const urgencyCache = new Map<string, { level: string; urgency: string; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 10, // Maximum requests per minute
  windowMs: 60 * 1000, // 1 minute window
  requests: [] as number[]
}

interface AppointmentData {
  id?: string
  symptoms?: string
  condition?: string
  notes?: string
  type?: string
  status?: string
  date?: string
  [key: string]: any
}

interface UrgencyResult {
  level: 'RED' | 'ORANGE' | 'GREEN'
  urgency: string
}

/**
 * Checks if we're within rate limits
 */
function isRateLimited(): boolean {
  const now = Date.now()
  // Remove old requests outside the window
  RATE_LIMIT.requests = RATE_LIMIT.requests.filter(time => now - time < RATE_LIMIT.windowMs)
  
  // Check if we've exceeded the limit
  if (RATE_LIMIT.requests.length >= RATE_LIMIT.maxRequests) {
    console.warn('Rate limit exceeded, using fallback evaluation')
    return true
  }
  
  return false
}

/**
 * Records a request for rate limiting
 */
function recordRequest(): void {
  RATE_LIMIT.requests.push(Date.now())
}

/**
 * Evaluates the urgency of an appointment using Gemini AI
 * @param appointment - The appointment data to evaluate
 * @returns Promise<UrgencyResult> - The urgency level and description
 */
export async function evaluateAppointmentUrgency(appointment: AppointmentData): Promise<UrgencyResult> {
  try {
    console.log(`🚨 evaluateAppointmentUrgency called for appointment ${appointment.id}`)
    
    // Check if AI triage service is enabled and configured
    const isConfigured = isAITriageConfigured()
    console.log(`🔧 AI triage configured:`, isConfigured)
    console.log(`🔧 Config status:`, getAITriageStatus())
    
    if (!isConfigured) {
      console.log('❌ AI triage service not configured, using fallback evaluation')
      return fallbackUrgencyEvaluation(appointment)
    }
    
    console.log(`✅ AI triage is configured and enabled, proceeding with Gemini evaluation...`)

    // Check cache first
    const cacheKey = generateCacheKey(appointment)
    const cached = urgencyCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Using cached urgency for appointment ${appointment.id}: ${cached.level}`)
      return {
        level: cached.level as 'RED' | 'ORANGE' | 'GREEN',
        urgency: cached.urgency
      }
    }

    // Check rate limiting
    if (isRateLimited()) {
      console.log('Rate limit active, using fallback evaluation for appointment:', appointment.id)
      const fallback = fallbackUrgencyEvaluation(appointment)
      // Cache the fallback result to avoid repeated fallback calls
      urgencyCache.set(cacheKey, {
        level: fallback.level,
        urgency: fallback.urgency,
        timestamp: Date.now()
      })
      return fallback
    }

    console.log(`🔥 Evaluating urgency for appointment ${appointment.id} using Gemini AI...`)

    // Record this request for rate limiting
    recordRequest()

    // Prepare the prompt for Gemini AI
    const prompt = createUrgencyPrompt(appointment)
    console.log(`📝 Prompt for Gemini:`, prompt)
    
    // Get Gemini model
    console.log(`🤖 Initializing Gemini model...`)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    console.log(`✅ Gemini model initialized`)
    
    // Get configuration for timeout
    const config = getAITriageConfig()
    console.log(`⏱️ Using timeout:`, config.timeout)
    
    // Generate response with timeout
    console.log(`🚀 Sending request to Gemini AI...`)
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), config.timeout)
      )
    ])
    
    console.log(`📨 Received response from Gemini AI`)
    const response = await (result as any).response
    const text = response.text()
    
    console.log(`🎯 Gemini AI response for appointment ${appointment.id}:`, text)
    
    // Parse the AI response
    const urgency = parseAIResponse(text)
    
    console.log(`Parsed urgency for appointment ${appointment.id}:`, urgency)
    
    // Cache the result
    urgencyCache.set(cacheKey, {
      level: urgency.level,
      urgency: urgency.urgency,
      timestamp: Date.now()
    })
    
    return urgency
  } catch (error: any) {
    // Handle specific error types
    if (error.message?.includes('RATE_LIMIT_EXCEEDED') || 
        error.message?.includes('429') ||
        error.message?.includes('quota')) {
      console.log(`Rate limit exceeded for appointment ${appointment.id}, using fallback`)
      
      // Cache the fallback result to avoid repeated API calls
      const cacheKey = generateCacheKey(appointment)
      const fallback = fallbackUrgencyEvaluation(appointment)
      urgencyCache.set(cacheKey, {
        level: fallback.level,
        urgency: fallback.urgency,
        timestamp: Date.now()
      })
      
      return fallback
    }
    
    if (error.message?.includes('timeout')) {
      console.log(`Request timeout for appointment ${appointment.id}, using fallback`)
    } else {
      console.log(`Error evaluating appointment ${appointment.id} urgency:`, error.message || 'Unknown error')
    }
    
    // Fallback to basic evaluation based on keywords
    const fallback = fallbackUrgencyEvaluation(appointment)
    
    // Cache the fallback result
    const cacheKey = generateCacheKey(appointment)
    urgencyCache.set(cacheKey, {
      level: fallback.level,
      urgency: fallback.urgency,
      timestamp: Date.now()
    })
    
    return fallback
  }
}

/**
 * Creates a prompt for Gemini AI to evaluate urgency
 */
function createUrgencyPrompt(appointment: AppointmentData): string {
  const { symptoms = '', condition = '', notes = '', type = '', status = '' } = appointment
  
  return `You are a medical triage AI assistant. Evaluate the urgency of this medical appointment and respond with ONLY a JSON object in this exact format:

{
  "level": "RED|ORANGE|GREEN",
  "urgency": "CRITICAL|VERY URGENT|ROUTINE"
}

Use these criteria:
- RED (CRITICAL): Life-threatening conditions, severe symptoms, immediate medical attention required
- ORANGE (VERY URGENT): Serious conditions, moderate to severe symptoms, attention needed soon
- GREEN (ROUTINE): Non-urgent conditions, mild symptoms, can wait for normal scheduling

Appointment details:
- Symptoms: ${symptoms}
- Condition: ${condition}
- Notes: ${notes}
- Type: ${type}
- Status: ${status}

Consider medical urgency, not scheduling priority. Respond with only the JSON object.`
}

/**
 * Parses the AI response to extract urgency information
 */
function parseAIResponse(response: string): UrgencyResult {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.level && parsed.urgency) {
        return {
          level: parsed.level.toUpperCase() as 'RED' | 'ORANGE' | 'GREEN',
          urgency: parsed.urgency.toUpperCase()
        }
      }
    }
    
    // Fallback parsing if JSON extraction fails
    const levelMatch = response.match(/(RED|ORANGE|GREEN)/i)
    const urgencyMatch = response.match(/(CRITICAL|VERY URGENT|ROUTINE)/i)
    
    if (levelMatch && urgencyMatch) {
      return {
        level: levelMatch[1].toUpperCase() as 'RED' | 'ORANGE' | 'GREEN',
        urgency: urgencyMatch[1].toUpperCase()
      }
    }
    
    throw new Error('Could not parse AI response')
  } catch (error) {
    console.warn('Failed to parse AI response, using fallback:', error)
    return {
      level: 'GREEN',
      urgency: 'ROUTINE'
    }
  }
}

/**
 * Fallback urgency evaluation based on keyword analysis
 */
function fallbackUrgencyEvaluation(appointment: AppointmentData): UrgencyResult {
  const { symptoms = '', condition = '', notes = '', type = '' } = appointment
  const text = `${symptoms} ${condition} ${notes} ${type}`.toLowerCase()
  
  // Critical/Red indicators
  const redKeywords = [
    'chest pain', 'heart attack', 'stroke', 'severe bleeding', 'unconscious',
    'difficulty breathing', 'severe trauma', 'overdose', 'suicide', 'seizure',
    'cardiac arrest', 'respiratory failure', 'anaphylaxis', 'severe burns'
  ]
  
  // Urgent/Orange indicators
  const orangeKeywords = [
    'high fever', 'severe headache', 'broken bone', 'deep cut', 'infection',
    'dehydration', 'severe pain', 'allergic reaction', 'meningitis symptoms',
    'appendicitis', 'gallbladder', 'kidney stone', 'pneumonia symptoms'
  ]
  
  // Check for red level
  if (redKeywords.some(keyword => text.includes(keyword))) {
    return { level: 'RED', urgency: 'CRITICAL' }
  }
  
  // Check for orange level
  if (orangeKeywords.some(keyword => text.includes(keyword))) {
    return { level: 'ORANGE', urgency: 'VERY URGENT' }
  }
  
  // Default to green
  return { level: 'GREEN', urgency: 'ROUTINE' }
}

/**
 * Generates a cache key for the appointment
 */
function generateCacheKey(appointment: AppointmentData): string {
  const { symptoms = '', condition = '', notes = '', type = '' } = appointment
  return `${symptoms}|${condition}|${notes}|${type}`.toLowerCase().trim()
}

/**
 * Clears the urgency cache
 */
export function clearUrgencyCache(): void {
  urgencyCache.clear()
  console.log('Urgency cache cleared')
}

/**
 * Gets cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: urgencyCache.size,
    entries: Array.from(urgencyCache.keys())
  }
}

/**
 * Checks if the service is properly configured
 */
export function isServiceConfigured(): boolean {
  return !!import.meta.env.VITE_GEMINI_API_KEY
}

/**
 * Gets service status information
 */
export function getServiceStatus(): {
  configured: boolean
  cacheSize: number
  lastCacheClear: string
} {
  return {
    configured: isServiceConfigured(),
    cacheSize: urgencyCache.size,
    lastCacheClear: new Date().toISOString()
  }
}
