export const formatTime = (timeString: string): string => {
  try {
    // Handle different time formats
    let time = timeString
    
    // If time is already in AM/PM format, return as is
    if (timeString.includes('AM') || timeString.includes('PM')) {
      return timeString
    }
    
    // If time is in HH:MM format, convert to AM/PM
    if (timeString.includes(':')) {
      const [hours, minutes] = timeString.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes.padStart(2, '0')} ${ampm}`
    }
    
    return timeString
  } catch (error) {
    console.warn('Error formatting time:', error)
    return timeString
  }
}

export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  } catch (error) {
    console.warn('Error formatting date:', error)
    return dateString
  }
}

export const formatDateTime = (dateTimeString: string): string => {
  try {
    const date = new Date(dateTimeString)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } catch (error) {
    console.warn('Error formatting date time:', error)
    return dateTimeString
  }
}

export const getTimeAgo = (timestamp: string): string => {
  try {
    const now = new Date()
    const past = new Date(timestamp)
    const diffInMs = now.getTime() - past.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
    
    return formatDate(timestamp)
  } catch (error) {
    console.warn('Error calculating time ago:', error)
    return timestamp
  }
}












