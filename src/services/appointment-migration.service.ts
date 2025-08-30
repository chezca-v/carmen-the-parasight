/**
 * Appointment Migration Service
 * Helps migrate existing appointments to include urgency information
 */

import { getFirestore, collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore'

export interface UrgencyInfo {
  level: 'RED' | 'ORANGE' | 'GREEN'
  description: string
  evaluatedAt: string
  evaluatedBy: string
  migrated: boolean
}

/**
 * Migrate existing appointments to include urgency information
 * This should be run once to update all existing appointments
 */
export async function migrateExistingAppointments(): Promise<{
  totalAppointments: number
  migratedCount: number
  errors: string[]
}> {
  const db = getFirestore()
  const results = {
    totalAppointments: 0,
    migratedCount: 0,
    errors: [] as string[]
  }

  try {
    console.log('🔄 Starting appointment migration...')
    
    // Get all patient documents
    const patientsRef = collection(db, 'patients')
    const patientsSnapshot = await getDocs(patientsRef)
    
    console.log(`📋 Found ${patientsSnapshot.size} patient documents`)
    
    for (const patientDoc of patientsSnapshot.docs) {
      try {
        const patientData = patientDoc.data()
        const appointments = patientData?.activity?.appointments || []
        
        if (appointments.length === 0) continue
        
        console.log(`📋 Processing patient ${patientDoc.id} with ${appointments.length} appointments`)
        
        let hasUpdates = false
        const updatedAppointments = appointments.map((appointment: any) => {
          // Skip if appointment already has urgency info
          if (appointment.urgency && appointment.urgency.level) {
            return appointment
          }
          
          // Evaluate urgency for appointments without it
          const urgencyInfo = evaluateUrgencyForMigration(appointment)
          
          hasUpdates = true
          return {
            ...appointment,
            urgency: urgencyInfo
          }
        })
        
        if (hasUpdates) {
          // Update the patient document
          await updateDoc(doc(db, 'patients', patientDoc.id), {
            'activity.appointments': updatedAppointments,
            updatedAt: new Date().toISOString()
          })
          
          results.migratedCount += appointments.length
          console.log(`✅ Migrated ${appointments.length} appointments for patient ${patientDoc.id}`)
        }
        
        results.totalAppointments += appointments.length
        
      } catch (error) {
        const errorMsg = `Failed to migrate patient ${patientDoc.id}: ${error}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }
    
    console.log(`✅ Migration completed. Total: ${results.totalAppointments}, Migrated: ${results.migratedCount}`)
    
  } catch (error) {
    const errorMsg = `Migration failed: ${error}`
    console.error(errorMsg)
    results.errors.push(errorMsg)
  }
  
  return results
}

/**
 * Evaluate urgency for an existing appointment during migration
 * Uses the same logic as the fallback evaluation
 */
function evaluateUrgencyForMigration(appointment: any): UrgencyInfo {
  const text = `${appointment.notes || ''} ${appointment.type || ''}`.toLowerCase()
  
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
  
  let level: 'RED' | 'ORANGE' | 'GREEN' = 'GREEN'
  let description = 'ROUTINE'
  
  // Check for red level
  if (redKeywords.some(keyword => text.includes(keyword))) {
    level = 'RED'
    description = 'CRITICAL'
  }
  // Check for orange level
  else if (orangeKeywords.some(keyword => text.includes(keyword))) {
    level = 'ORANGE'
    description = 'VERY URGENT'
  }
  
  return {
    level,
    description,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: 'migration-service',
    migrated: true
  }
}

/**
 * Check migration status for a specific patient
 */
export async function checkPatientMigrationStatus(patientId: string): Promise<{
  totalAppointments: number
  migratedCount: number
  needsMigration: boolean
}> {
  try {
    const db = getFirestore()
    const patientDoc = await getDocs(doc(db, 'patients', patientId))
    
    if (!patientDoc.exists()) {
      throw new Error('Patient not found')
    }
    
    const patientData = patientDoc.data()
    const appointments = patientData?.activity?.appointments || []
    
    const migratedCount = appointments.filter((apt: any) => 
      apt.urgency && apt.urgency.level
    ).length
    
    return {
      totalAppointments: appointments.length,
      migratedCount,
      needsMigration: migratedCount < appointments.length
    }
    
  } catch (error) {
    console.error('Error checking migration status:', error)
    throw error
  }
}

/**
 * Get migration statistics across all patients
 */
export async function getMigrationStatistics(): Promise<{
  totalPatients: number
  totalAppointments: number
  migratedAppointments: number
  migrationProgress: number
}> {
  try {
    const db = getFirestore()
    const patientsRef = collection(db, 'patients')
    const patientsSnapshot = await getDocs(patientsRef)
    
    let totalAppointments = 0
    let migratedAppointments = 0
    
    patientsSnapshot.forEach((doc) => {
      const patientData = doc.data()
      const appointments = patientData?.activity?.appointments || []
      
      totalAppointments += appointments.length
      migratedAppointments += appointments.filter((apt: any) => 
        apt.urgency && apt.urgency.level
      ).length
    })
    
    const migrationProgress = totalAppointments > 0 ? (migratedAppointments / totalAppointments) * 100 : 0
    
    return {
      totalPatients: patientsSnapshot.size,
      totalAppointments,
      migratedAppointments,
      migrationProgress: Math.round(migrationProgress)
    }
    
  } catch (error) {
    console.error('Error getting migration statistics:', error)
    throw error
  }
}
