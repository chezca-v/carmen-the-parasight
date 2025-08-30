import React, { useCallback } from 'react'

interface NotificationSystemProps {
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({ showNotification }) => {
  const getNotificationIcon = useCallback((type: string) => {
    switch (type) {
      case 'success': return 'check-circle'
      case 'error': return 'exclamation-circle'
      case 'warning': return 'exclamation-triangle'
      case 'info': return 'info-circle'
      default: return 'info-circle'
    }
  }, [])

  const getNotificationColor = useCallback((type: string) => {
    switch (type) {
      case 'success': return '#22c55e'
      case 'error': return '#ef4444'
      case 'warning': return '#f59e0b'
      case 'info': return '#3b82f6'
      default: return '#3b82f6'
    }
  }, [])

  const createNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification')
    existingNotifications.forEach(notification => notification.remove())
    
    // Create notification
    const notification = document.createElement('div')
    notification.className = `notification notification-${type}`
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${getNotificationIcon(type)}" aria-hidden="true"></i>
        <span>${message}</span>
        <button class="notification-close" aria-label="Close notification">&times;</button>
      </div>
    `
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${getNotificationColor(type)};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      max-width: 350px;
      animation: slideIn 0.3s ease-out;
    `
    
    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close')
    closeBtn?.addEventListener('click', () => notification.remove())
    
    // Add to page
    document.body.appendChild(notification)
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease-in'
        setTimeout(() => notification.remove(), 300)
      }
    }, 5000)
  }, [getNotificationIcon, getNotificationColor])

  // Expose the createNotification function through the showNotification prop
  React.useEffect(() => {
    // This is a bit of a hack, but it allows us to use the existing showNotification function
    // In a real implementation, you'd want to use a proper state management solution
    (window as any).showNotification = createNotification
  }, [createNotification])

  return null // This component doesn't render anything visible
}

export default React.memo(NotificationSystem)








