import React from 'react'
import { formatTime, formatDateTime } from '../utils/dateUtils'

interface AppointmentCardProps {
  appointment: any
  onEdit: (appointment: any) => void
  onDelete: (appointmentId: string) => void
  onViewUpdates?: (appointment: any) => void
  formatTime: (time: string) => string
  formatDateTime: (dateTime: string) => string
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({ 
  appointment, 
  onEdit, 
  onDelete, 
  onViewUpdates, 
  formatTime, 
  formatDateTime
}) => {

  return (
    <div className={`appointment-card ${appointment.updatedBy === 'facility' ? 'has-modifications' : ''}`}>
      {/* Card Header - Date and Status */}
      <div className="appointment-header">
        <div className="appointment-date">
          <span className="date">{new Date(appointment.date).getDate()}</span>
          <span className="month">{new Date(appointment.date).toLocaleDateString('en-US', { month: 'short' })}</span>
        </div>
        
        <div className="appointment-status">
          <div className={`status ${appointment.status}`}>
            {appointment.status === 'confirmed' ? 'Confirmed' : 
             appointment.status === 'pending' ? 'Pending' : 
             appointment.status === 'scheduled' ? 'Scheduled' : 
             appointment.status === 'completed' ? 'Completed' : 
             appointment.status === 'cancelled' ? 'Cancelled' : appointment.status}
          </div>
        </div>
      </div>
      
      {/* Card Body - Appointment Information */}
      <div className="appointment-body">
        <div className="appointment-info">
          <h4>{appointment.doctor || 'Doctor To Be Determined'}</h4>
          <p className="appointment-type">{appointment.type || 'Consultation'}</p>
          <div className="appointment-time">
            <i className="fas fa-clock"></i>
            {formatTime(appointment.time)}
          </div>
          <div className="appointment-facility">
            <i className="fas fa-hospital"></i>
            {appointment.facilityName || 'Facility To Be Determined'}
          </div>
          
          {/* Show completion/cancellation timestamp */}
          {(appointment.status === 'completed' || appointment.status === 'cancelled') && appointment.updatedAt && (
            <div className="appointment-status-info">
              <small className="status-time">
                {appointment.status === 'completed' ? 'Completed' : 'Cancelled'}: {formatDateTime(appointment.updatedAt)}
              </small>
            </div>
          )}
        </div>
      </div>
      
      {/* Card Footer - Action Buttons */}
      <div className="appointment-footer">
        <div className="action-buttons">
          {/* Show View Updates button if there are modifications or facility notes */}
          {(appointment.updatedBy === 'facility' || appointment.facilityNotes) && onViewUpdates && (
            <button 
              className="btn btn-info btn-sm"
              onClick={() => onViewUpdates(appointment)}
              title="View appointment updates and facility notes"
              aria-label="View appointment updates and facility notes"
            >
              <i className="fas fa-history" aria-hidden="true"></i>
              View Updates
            </button>
          )}
          
          {/* Only show edit/delete for upcoming appointments */}
          {['scheduled', 'confirmed', 'pending'].includes(appointment.status) && (
            <>
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => onEdit(appointment)}
                title="Edit appointment"
                aria-label="Edit this appointment"
              >
                <i className="fas fa-edit" aria-hidden="true"></i>
                Edit
              </button>
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => onDelete(appointment.id)}
                title="Delete appointment"
                aria-label="Delete this appointment"
              >
                <i className="fas fa-trash" aria-hidden="true"></i>
                Delete
              </button>
            </>
          )}
          
          {/* Show view details for completed/cancelled appointments */}
          {(appointment.status === 'completed' || appointment.status === 'cancelled') && (
            <button 
              className="btn btn-outline btn-sm"
              onClick={() => onEdit(appointment)}
              title="View appointment details"
              aria-label="View appointment details"
            >
              <i className="fas fa-eye" aria-hidden="true"></i>
              View
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default React.memo(AppointmentCard)



