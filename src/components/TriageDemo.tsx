import React, { useState } from 'react'
import AppointmentCard from './AppointmentCard'
import { evaluateAppointmentUrgency } from '../services/triage.service'

const TriageDemo: React.FC = () => {
  const [sampleAppointments] = useState([
    {
      id: '1',
      date: '2024-01-15',
      time: '09:00',
      doctor: 'Dr. Smith',
      type: 'Emergency',
      symptoms: 'Severe chest pain, shortness of breath',
      condition: 'Possible heart attack',
      notes: 'Patient experiencing extreme discomfort',
      status: 'scheduled',
      facilityName: 'Emergency Room'
    },
    {
      id: '2',
      date: '2024-01-16',
      time: '14:00',
      doctor: 'Dr. Johnson',
      type: 'Urgent Care',
      symptoms: 'High fever, severe headache',
      condition: 'Possible meningitis',
      notes: 'Patient needs immediate attention',
      status: 'scheduled',
      facilityName: 'Urgent Care Center'
    },
    {
      id: '3',
      date: '2024-01-17',
      time: '10:00',
      doctor: 'Dr. Williams',
      type: 'Checkup',
      symptoms: 'Annual physical',
      condition: 'Routine examination',
      notes: 'No urgent symptoms',
      status: 'scheduled',
      facilityName: 'Family Clinic'
    },
    {
      id: '4',
      date: '2024-01-18',
      time: '11:00',
      doctor: 'Dr. Brown',
      type: 'Consultation',
      symptoms: 'nakagat ng lamok',
      condition: 'Mosquito bite',
      notes: 'meow',
      status: 'scheduled',
      facilityName: 'Carmen Medical Clinic'
    }
  ])

  const [urgencyData, setUrgencyData] = useState<{[key: string]: any}>({})

  const evaluateUrgency = async (appointment: any) => {
    try {
      const urgency = await evaluateAppointmentUrgency(appointment)
      setUrgencyData(prev => ({
        ...prev,
        [appointment.id]: urgency
      }))
    } catch (error) {
      console.error('Error evaluating urgency:', error)
    }
  }

  const handleEvaluateAll = async () => {
    for (const appointment of sampleAppointments) {
      await evaluateUrgency(appointment)
    }
  }

  return (
    <div className="triage-demo" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#2563eb' }}>
        🚨 Medical Triage System Demo
      </h2>
      
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button 
          onClick={handleEvaluateAll}
          style={{
            padding: '12px 24px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          🔍 Evaluate All Appointments
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Color Legend:</h3>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: '#dc2626', borderRadius: '4px' }}></div>
            <span><strong>RED:</strong> Critical - Life-threatening conditions</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: '#ea580c', borderRadius: '4px' }}></div>
            <span><strong>ORANGE:</strong> Very Urgent - Serious conditions</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: '#059669', borderRadius: '4px' }}></div>
            <span><strong>GREEN:</strong> Routine - Non-urgent conditions</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {sampleAppointments.map((appointment) => {
          const urgency = urgencyData[appointment.id] || { level: 'GREEN', urgency: 'ROUTINE' }
          return (
            <div key={appointment.id}>
              <h4 style={{ marginBottom: '10px', color: '#374151' }}>
                Sample Appointment #{appointment.id}
              </h4>
              <AppointmentCard
                appointment={appointment}
                onEdit={() => {}}
                onDelete={() => {}}
                formatTime={(time: string) => time}
                formatDateTime={(date: string) => new Date(date).toLocaleDateString()}
                urgencyLevel={urgency.level}
                urgencyText={urgency.urgency}
              />
              {!urgencyData[appointment.id] && (
                <button 
                  onClick={() => evaluateUrgency(appointment)}
                  style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Evaluate Urgency
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TriageDemo





