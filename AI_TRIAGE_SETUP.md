# AI Triage Service Configuration

This document explains how to configure the AI-powered triage service in LingapLink to prevent console errors and manage API usage.

## Overview

The AI triage service uses Google's Gemini AI to automatically evaluate the urgency of medical appointments. **NEW: Urgency levels are now stored directly in Firestore** to eliminate the need for AI calls on every refresh.

## How It Works Now

### **1. One-Time Evaluation**
- When an appointment is **created**, urgency is evaluated once using AI or fallback logic
- When an appointment is **updated** (notes/type change), urgency is re-evaluated if needed
- **Urgency levels are stored directly in the appointment document** in Firestore

### **2. No More Repeated API Calls**
- Dashboard displays urgency from stored data, not from AI evaluation
- **Zero API calls** when refreshing the dashboard
- **Zero console errors** from rate limiting
- **Instant display** of urgency levels

### **3. Smart Updates**
- Only re-evaluates urgency when relevant fields change (notes, type)
- Maintains urgency history and modification tracking
- Fallback to keyword-based evaluation if AI fails

## Configuration Options

### 1. Environment Variables

Add these to your `.env.local` file:

```bash
# Enable/disable AI triage service
VITE_ENABLE_AI_TRIAGE=true

# Your Gemini API key
VITE_GEMINI_API_KEY=your_api_key_here
```

### 2. Disable AI Triage Service

To completely disable the AI triage service and prevent console errors:

```bash
VITE_ENABLE_AI_TRIAGE=false
```

When disabled, all appointments will use fallback urgency evaluation (GREEN/ROUTINE).

## Migration for Existing Appointments

### **Automatic Migration**
- New appointments automatically include urgency information
- Existing appointments can be migrated using the migration tool in the dashboard
- Migration button appears when there are unmigrated appointments

### **Migration Process**
1. **Dashboard Migration Button**: Click to migrate all existing appointments
2. **Progress Tracking**: Shows migration completion percentage
3. **Fallback Evaluation**: Uses keyword-based urgency assessment for existing appointments
4. **One-Time Process**: Run once to update all existing appointments

### **Migration Benefits**
- Eliminates need for AI calls on existing appointments
- Provides immediate urgency display for all appointments
- Improves dashboard performance
- Reduces API usage and costs

## Database Structure

### **Appointment Document with Urgency**
```json
{
  "id": "appointment_123",
  "patientName": "John Doe",
  "date": "2024-01-15",
  "time": "14:00",
  "type": "consultation",
  "notes": "Patient experiencing chest pain",
  "urgency": {
    "level": "RED",
    "description": "CRITICAL",
    "evaluatedAt": "2024-01-15T10:00:00Z",
    "evaluatedBy": "system",
    "reEvaluated": false
  }
}
```

### **Urgency Levels**
- **RED**: Critical - Life-threatening conditions
- **ORANGE**: Very Urgent - Serious conditions
- **GREEN**: Routine - Non-urgent conditions

## Troubleshooting Console Errors

### **Common Errors (Now Eliminated)**
1. **Rate Limit Exceeded (429)** - ❌ **NO LONGER OCCURS**
2. **API Key Not Configured** - ❌ **NO LONGER OCCURS**
3. **Request Timeout** - ❌ **NO LONGER OCCURS**

### **New Benefits**
✅ **Zero API calls** on dashboard refresh  
✅ **Instant urgency display** from stored data  
✅ **No rate limiting issues**  
✅ **Better performance** and user experience  
✅ **Cost reduction** from fewer API calls  

## Performance Optimization

### **For Production Use**
1. **Stored Urgency**: All urgency levels stored in Firestore
2. **No Repeated Evaluation**: Urgency evaluated only when needed
3. **Fast Loading**: Dashboard loads urgency instantly
4. **Reduced API Usage**: Minimal AI calls, only for new/updated appointments

### **For Development**
1. **Disable Service**: Set `VITE_ENABLE_AI_TRIAGE=false`
2. **Use Stored Data**: All appointments show urgency from database
3. **Monitor Console**: No more error messages
4. **Test Migration**: Use migration tool for existing data

## Configuration File

The service uses `src/config/ai-triage.config.ts` for centralized configuration:

```typescript
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
```

## Best Practices

1. **Run Migration**: Use the migration tool for existing appointments
2. **Monitor Progress**: Check migration status in the dashboard
3. **Test New Appointments**: Verify urgency is stored correctly
4. **Review Fallback Logic**: Ensure keyword-based evaluation works for your use case

## Support

If you continue to experience issues:

1. **Check Migration Status**: Verify all appointments have urgency data
2. **Run Migration**: Use the dashboard migration tool
3. **Review Console**: Should now be error-free
4. **Check Firestore**: Verify urgency fields are populated

The new system is designed to eliminate console errors completely while providing instant urgency display for all appointments.
