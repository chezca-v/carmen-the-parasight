// LingapLink Landing Page JavaScript
document.addEventListener('DOMContentLoaded', () => {
    console.log('LingapLink Landing Page Loaded');
    
    // Initialize all page functionality
    initializeSearch();
    initializeLocationDetection();
    initializeBookingButtons();
    initializeBusinessPartnership();
    initializeNavigation();
    initializeAnimations();
    initializeAccessibility();
});

// Search Functionality
function initializeSearch() {
    const searchButton = document.querySelector('.search-button');
    const searchInput = document.querySelector('.search-input input');
    const locationInput = document.querySelector('.location-input input');
    
    if (searchButton) {
        searchButton.addEventListener('click', handleSearch);
    }
    
    // Handle Enter key in search inputs
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }
    
    if (locationInput) {
        locationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }
}

function handleSearch() {
    const searchInput = document.querySelector('.search-input input');
    const locationInput = document.querySelector('.location-input input');
    
    const searchTerm = searchInput?.value.trim() || '';
    const location = locationInput?.value.trim() || '';
    
    if (!searchTerm && !location) {
        showNotification('Please enter a search term or location', 'warning');
        return;
    }
    
    // Show loading state
    const searchButton = document.querySelector('.search-button');
    const originalText = searchButton.textContent;
    searchButton.textContent = 'Searching...';
    searchButton.disabled = true;
    
    // Simulate search (replace with actual search implementation)
    setTimeout(() => {
        console.log('Searching for:', { searchTerm, location });
        
        // For now, show a message and redirect to patient portal
        showNotification(`Searching for "${searchTerm}" ${location ? `in ${location}` : 'nationwide'}...`, 'info');
        
        // Reset button
        searchButton.textContent = originalText;
        searchButton.disabled = false;
        
        // Redirect to patient portal for search results
        setTimeout(() => {
            window.location.href = '/public/patientPortal.html';
        }, 1500);
    }, 1000);
}

// Location Detection
function initializeLocationDetection() {
    const locationBtn = document.querySelector('.location-detect-btn');
    const enableLocationBtn = document.querySelector('.enable-location');
    
    if (locationBtn) {
        locationBtn.addEventListener('click', detectLocation);
    }
    
    if (enableLocationBtn) {
        enableLocationBtn.addEventListener('click', (e) => {
            e.preventDefault();
            detectLocation();
        });
    }
}

function detectLocation() {
    const locationInput = document.querySelector('.location-input input');
    const locationBtn = document.querySelector('.location-detect-btn');
    
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by this browser', 'error');
        return;
    }
    
    // Show loading state
    if (locationBtn) {
        locationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        locationBtn.disabled = true;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            
            // Simulate reverse geocoding (replace with actual geocoding service)
            setTimeout(() => {
                const mockLocation = 'Makati City, Metro Manila';
                if (locationInput) {
                    locationInput.value = mockLocation;
                }
                
                showNotification('Location detected successfully!', 'success');
                resetLocationButton();
            }, 1000);
        },
        (error) => {
            let message = 'Unable to detect location';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = 'Location access denied by user';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'Location information unavailable';
                    break;
                case error.TIMEOUT:
                    message = 'Location request timeout';
                    break;
            }
            
            showNotification(message, 'error');
            resetLocationButton();
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 600000
        }
    );
}

function resetLocationButton() {
    const locationBtn = document.querySelector('.location-detect-btn');
    if (locationBtn) {
        locationBtn.innerHTML = '<i class="fas fa-crosshairs"></i>';
        locationBtn.disabled = false;
    }
}

// Booking Functionality
function initializeBookingButtons() {
    const bookingButtons = document.querySelectorAll('.book-appointment');
    
    bookingButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const facilityCard = e.target.closest('.facility-card');
            const facilityName = facilityCard?.querySelector('h3')?.textContent || 'Healthcare Facility';
            
            handleAppointmentBooking(facilityName, button);
        });
    });
}

// Business Partnership Functionality
function initializeBusinessPartnership() {
    // Handle business registration buttons (footer CTA and featured links)
    const businessRegisterButtons = document.querySelectorAll('.cta-primary-btn');
    const businessSigninButtons = document.querySelectorAll('.cta-secondary-btn');
    
    businessRegisterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            handleBusinessRegistration(button);
        });
    });
    
    businessSigninButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            handleBusinessSignin(button);
        });
    });
    
    // Handle special "Join LingapLink" featured link
    const featuredJoinLinks = document.querySelectorAll('.featured a[href*="businessRegistration"]');
    featuredJoinLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            handleBusinessRegistration(link);
        });
    });
}

function handleBusinessRegistration(button) {
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Processing...';
    button.disabled = true;
    
    setTimeout(() => {
        showNotification('Redirecting to business registration portal...', 'info');
        
        // Reset button
        button.innerHTML = originalText;
        button.disabled = false;
        
        // Redirect to business registration
        setTimeout(() => {
            window.location.href = '/public/businessRegistration.html';
        }, 1500);
    }, 1000);
}

function handleBusinessSignin(button) {
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Signing In...';
    button.disabled = true;
    
    setTimeout(() => {
        showNotification('Redirecting to business portal...', 'info');
        
        // Reset button
        button.innerHTML = originalText;
        button.disabled = false;
        
        // Redirect to business signin
        setTimeout(() => {
            window.location.href = '/public/businessSignIn.html';
        }, 1500);
    }, 1000);
}

function handleAppointmentBooking(facilityName, button) {
    // Show loading state
    const originalText = button.textContent;
    button.textContent = 'Processing...';
    button.disabled = true;
    
    // Simulate booking process
    setTimeout(() => {
        showNotification(`Redirecting to book appointment with ${facilityName}...`, 'info');
        
        // Reset button
        button.textContent = originalText;
        button.disabled = false;
        
        // Redirect to patient sign-up/sign-in for booking
        setTimeout(() => {
            window.location.href = '/public/patientSign-up.html';
        }, 1500);
    }, 1000);
}

// Navigation Enhancement
function initializeNavigation() {
    // Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add click analytics for navigation links
    const navLinks = document.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('#')) {
                console.log('Navigation:', href);
            }
        });
    });
}

// Animations and Visual Enhancements
function initializeAnimations() {
    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animateElements = document.querySelectorAll('.facility-card, .section-header, .hero-content');
    animateElements.forEach(el => {
        observer.observe(el);
    });
    
    // Add hover effects for facility cards
    const facilityCards = document.querySelectorAll('.facility-card');
    facilityCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '';
        });
    });
}

// Accessibility Enhancements
function initializeAccessibility() {
    // Keyboard navigation for buttons
    const interactiveElements = document.querySelectorAll('button, .book-appointment, .search-button');
    interactiveElements.forEach(element => {
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                element.click();
            }
        });
    });
    
    // Focus management
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-navigation');
        }
    });
    
    document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-navigation');
    });
    
    // Announce page load to screen readers
    announceToScreenReader('LingapLink healthcare platform loaded. Use Tab to navigate.');
}

// Utility Functions
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
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
    `;
    
    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => notification.remove());
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
    
    // Announce to screen readers
    announceToScreenReader(message);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || icons.info;
}

function getNotificationColor(type) {
    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    return colors[type] || colors.info;
}

function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.cssText = `
        position: absolute !important;
        left: -10000px !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
    `;
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .animate-in {
        animation: fadeInUp 0.6s ease-out;
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .keyboard-navigation *:focus {
        outline: 2px solid #4A90E2 !important;
        outline-offset: 2px !important;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
    }
    
    .notification-close:hover {
        opacity: 0.7;
    }
`;
document.head.appendChild(style);

