import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import YearUpdater from './YearUpdater'
import '../styles/index.css'

// Import images
import slmcImage from '../assets/img/SLMC.jpg'
import tmcImage from '../assets/img/TMC.jpg'
import ahmcImage from '../assets/img/AHMC.jpeg'
import drWillieOngImage from '../assets/img/Dr. Willie Ong.jpg'
import drAlvinFranciscoImage from '../assets/img/Dr. Alvin Francisco.jpg'

const LandingPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [location, setLocation] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    // Initialize animations and effects
    initializeAnimations()
    initializeAccessibility()
    initializeHeaderScroll()
    
    // Ensure page is scrollable
    document.body.style.overflow = 'auto'
    document.documentElement.style.overflow = 'auto'
  }, [])

  const initializeHeaderScroll = () => {
    const header = document.querySelector('.header')
    if (header) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
          header.classList.add('scrolled')
        } else {
          header.classList.remove('scrolled')
        }
      })
    }
  }

  const initializeAnimations = () => {
    // Intersection Observer for scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in')
        }
      })
    }, observerOptions)
    
    // Observe elements for animation
    const animateElements = document.querySelectorAll('.facility-card, .section-header, .hero-content')
    animateElements.forEach(el => {
      observer.observe(el)
    })
  }

  const initializeAccessibility = () => {
    // Announce page load to screen readers
    announceToScreenReader('LingapLink healthcare platform loaded. Use Tab to navigate.')
  }

  const handleSearch = () => {
    if (!searchTerm && !location) {
      showNotification('Please enter a search term or location', 'warning')
      return
    }
    
    setIsSearching(true)
    
    // Simulate search (replace with actual search implementation)
    setTimeout(() => {
      // Search functionality would be implemented here
      
      showNotification(`Searching for "${searchTerm}" ${location ? `in ${location}` : 'nationwide'}...`, 'info')
      
      setIsSearching(false)
      
      // Redirect to patient portal for search results
      setTimeout(() => {
        navigate('/patient-portal')
      }, 1500)
    }, 1000)
  }

  const detectLocation = () => {
    if (!navigator.geolocation) {
      showNotification('Geolocation is not supported by this browser', 'error')
      return
    }
    
    navigator.geolocation.getCurrentPosition(
      () => {
        // Simulate reverse geocoding (replace with actual geocoding service)
        setTimeout(() => {
          const mockLocation = 'Makati City, Metro Manila'
          setLocation(mockLocation)
          showNotification('Location detected successfully!', 'success')
        }, 1000)
      },
      (error) => {
        let message = 'Unable to detect location'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied by user'
            break
          case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable'
            break
          case error.TIMEOUT:
            message = 'Location request timeout'
            break
        }
        
        showNotification(message, 'error')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 600000
      }
    )
  }

  const handleAppointmentBooking = (facilityName: string) => {
    showNotification(`Redirecting to book appointment with ${facilityName}...`, 'info')
    
    setTimeout(() => {
      navigate('/patient-sign-up')
    }, 1500)
  }

  const handleViewAllFacilities = () => {
    showNotification('Loading all healthcare facilities...', 'info')
    setTimeout(() => {
      navigate('/patient-portal')
    }, 1000)
  }

  const handleSocialLink = (platform: string) => {
    showNotification(`Opening ${platform}...`, 'info')
    // In production, these would link to actual social media pages
    // Social media links would be implemented here
  }

  const handlePartnerSignup = () => {
    showNotification('Redirecting to partner registration...', 'info')
    // Redirect to partner sign-up
    setTimeout(() => {
      navigate('/partner-sign-up')
    }, 1500)
  }

  const handlePartnerSignin = () => {
    showNotification('Redirecting to partner login...', 'info')
    // Redirect to partner sign-in
    setTimeout(() => {
      navigate('/partner-sign-in')
    }, 1500)
  }

  const handleBusinessPortal = () => {
    showNotification('Redirecting to business portal...', 'info')
    // For now, redirect to dashboard as placeholder
    setTimeout(() => {
      navigate('/dashboard')
    }, 1500)
  }


  const showNotification = (message: string, type: string = 'info') => {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification')
    existingNotifications.forEach(notification => notification.remove())
    
    // Create notification
    const notification = document.createElement('div')
    notification.className = `notification notification-${type}`
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
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
    
    // Announce to screen readers
    announceToScreenReader(message)
  }

  const getNotificationIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    }
    return icons[type] || icons.info
  }

  const getNotificationColor = (type: string) => {
    const colors: { [key: string]: string } = {
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    }
    return colors[type] || colors.info
  }

  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', 'polite')
    announcement.setAttribute('aria-atomic', 'true')
    announcement.style.cssText = `
      position: absolute !important;
      left: -10000px !important;
      width: 1px !important;
      height: 1px !important;
      overflow: hidden !important;
    `
    announcement.textContent = message
    
    document.body.appendChild(announcement)
    setTimeout(() => announcement.remove(), 1000)
  }

  return (
    <>
      <YearUpdater />
      {/* Live region for screen reader announcements */}
      <div id="live-region" aria-live="polite" aria-atomic="true" className="sr-only"></div>
      
      {/* Navigation Header */}
      <header className="header" role="banner">
        <div className="header-container">
          <div className="logo">
            <i className="fas fa-heartbeat" aria-hidden="true"></i>
            <span>LingapLink</span>
            <span className="logo-badge">PH</span>
          </div>
          
          <nav className="header-actions" role="navigation" aria-label="Main navigation">
            <button 
              onClick={() => navigate('/patient-sign-in')}
              className="login-btn" 
              aria-label="Sign in to your patient account"
            >
              Login
            </button>
            <button 
              onClick={() => navigate('/patient-sign-up')}
              className="register-btn" 
              aria-label="Create a new patient account"
            >
              Register
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="main-hero hero-gold-gradient" role="main">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-left">
              <h1>Get Your Consultation Online</h1>
              <h2>Connect with top healthcare facilities from home</h2>
              <p className="consultation-types">Audio, Text, Video & In-Person options available</p>
              
              <div className="online-stats">
                <div className="doctor-avatars" role="img" aria-label="Healthcare professionals">
                  <div className="avatar">
                    <img src={slmcImage} 
                         alt="St. Luke's Medical Center" 
                         loading="lazy"
                         width="50" 
                         height="50" />
                  </div>
                  <div className="avatar">
                    <img src={tmcImage} 
                         alt="The Medical City" 
                         loading="lazy"
                         width="50" 
                         height="50" />
                  </div>
                  <div className="avatar">
                    <img src={ahmcImage} 
                         alt="Asian Hospital and Medical Center" 
                         loading="lazy"
                         width="50" 
                         height="50" />
                  </div>
                </div>
                <span className="stats-text">+180 healthcare facilities are online</span>
              </div>
            </div>
            
            <div className="hero-right">
              <div className="medical-team">
                <picture className="doctor-main">
                  <img src={drWillieOngImage} 
                       alt="Photo of Dr. Willie Ong" 
                       loading="eager"
                       width="400" 
                       height="500" 
                       decoding="async" />
                </picture>
                <picture className="doctor-secondary">
                  <img src={drAlvinFranciscoImage} 
                       alt="Photo of Dr. Alvin Francisco" 
                       loading="lazy"
                       width="400" 
                       height="500" 
                       decoding="async" />
                </picture>
              </div>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <section className="search-section" aria-label="Healthcare facility search">
          <div className="search-container">
            <form className="search-bar" role="search" aria-label="Search for healthcare facilities" onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
              <div className="search-input">
                <label htmlFor="facility-search" className="sr-only">Search for hospitals and clinics</label>
                <i className="fas fa-search" aria-hidden="true"></i>
                <input 
                  type="text" 
                  id="facility-search"
                  name="facility-search"
                  placeholder="Find hospitals and clinics" 
                  aria-describedby="search-help"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div id="search-help" className="sr-only">Enter the name or type of healthcare facility you're looking for</div>
              </div>
              <div className="location-input">
                <label htmlFor="location-search" className="sr-only">Enter location</label>
                <i className="fas fa-map-marker-alt" aria-hidden="true"></i>
                <input 
                  type="text" 
                  id="location-search"
                  name="location-search"
                  placeholder="Location" 
                  aria-describedby="location-help"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <div id="location-help" className="sr-only">Enter city, province, or area to search nearby facilities</div>
                <button 
                  type="button" 
                  className="location-detect-btn" 
                  aria-label="Detect current location"
                  title="Use my current location"
                  onClick={detectLocation}
                >
                  <i className="fas fa-crosshairs" aria-hidden="true"></i>
                </button>
              </div>
              <button 
                type="submit" 
                className="search-button" 
                aria-label="Search healthcare facilities"
                disabled={isSearching}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Recommended Healthcare Facilities */}
      <section className="recommended-facilities" aria-labelledby="recommended-heading">
        <div className="container">
          <div className="section-header">
            <h2 id="recommended-heading">Recommended Healthcare Facilities</h2>
            <a 
              href="#" 
              className="view-all" 
              aria-label="View all recommended healthcare facilities"
              onClick={(e) => { e.preventDefault(); handleViewAllFacilities(); }}
            >
              View All <i className="fas fa-chevron-right" aria-hidden="true"></i>
            </a>
          </div>
          
          <div className="facilities-grid" role="list" aria-label="List of recommended healthcare facilities">
            {/* St. Luke's Medical Center */}
            <article className="facility-card" role="listitem">
              <div className="facility-profile">
                <div className="facility-image">
                  <img src={slmcImage} 
                       alt="St. Luke's Medical Center building exterior" 
                       loading="lazy"
                       width="80" 
                       height="80" />
                </div>
                <div className="facility-details">
                  <h3>St. Luke's Medical Center</h3>
                  <p className="facility-type">Multi-specialty Hospital | 25 years experience</p>
                  <span className="specialty-tag" aria-label="Specialty: Emergency Care">Emergency Care</span>
                </div>
              </div>
              
              <div className="facility-schedule">
                <div className="schedule-info">
                  <i className="fas fa-clock" aria-hidden="true"></i>
                  <span>24/7 Available</span>
                </div>
                <div className="price-info">
                  <i className="fas fa-peso-sign" aria-hidden="true"></i>
                  <span>₱2,500</span>
                  <small>Starting</small>
                </div>
              </div>
              
              <button 
                className="book-appointment" 
                aria-label="Book an appointment with St. Luke's Medical Center"
                onClick={() => handleAppointmentBooking("St. Luke's Medical Center")}
              >
                Book an appointment
              </button>
            </article>

            {/* The Medical City */}
            <article className="facility-card" role="listitem">
              <div className="facility-profile">
                <div className="facility-image">
                  <img src={tmcImage} 
                       alt="The Medical City entrance" 
                       loading="lazy"
                       width="80" 
                       height="80" />
                </div>
                <div className="facility-details">
                  <h3>The Medical City</h3>
                  <p className="facility-type">Family Medicine Clinic | 15 years experience</p>
                  <span className="specialty-tag" aria-label="Specialty: Primary Care">Primary Care</span>
                </div>
              </div>
              
              <div className="facility-schedule">
                <div className="schedule-info">
                  <i className="fas fa-clock" aria-hidden="true"></i>
                  <span>Mon-Sat 8AM-6PM</span>
                </div>
                <div className="price-info">
                  <i className="fas fa-peso-sign" aria-hidden="true"></i>
                  <span>₱1,200</span>
                  <small>Starting</small>
                </div>
              </div>
              
              <button 
                className="book-appointment" 
                aria-label="Book an appointment with The Medical City"
                onClick={() => handleAppointmentBooking("The Medical City")}
              >
                Book an appointment
              </button>
            </article>

            {/* Asian Hospital and Medical Center */}
            <article className="facility-card" role="listitem">
              <div className="facility-profile">
                <div className="facility-image">
                  <img src={ahmcImage} 
                       alt="Asian Hospital and Medical Center medical facility" 
                       loading="lazy"
                       width="80" 
                       height="80" />
                </div>
                <div className="facility-details">
                  <h3>Asian Hospital and Medical Center</h3>
                  <p className="facility-type">Cardiology Specialist | 20 years experience</p>
                  <span className="specialty-tag" aria-label="Specialty: Cardiology">Cardiology</span>
                </div>
              </div>
              
              <div className="facility-schedule">
                <div className="schedule-info">
                  <i className="fas fa-clock" aria-hidden="true"></i>
                  <span>Mon-Fri 9AM-5PM</span>
                </div>
                <div className="price-info">
                  <i className="fas fa-peso-sign" aria-hidden="true"></i>
                  <span>₱3,000</span>
                  <small>Starting</small>
                </div>
              </div>
              
              <button 
                className="book-appointment" 
                aria-label="Book an appointment with Asian Hospital and Medical Center"
                onClick={() => handleAppointmentBooking("Asian Hospital and Medical Center")}
              >
                Book an appointment
              </button>
            </article>
          </div>
        </div>
      </section>

      {/* Nearby Healthcare Facilities */}
      <section className="nearby-facilities" aria-labelledby="nearby-heading">
        <div className="container">
          <h2 id="nearby-heading">Nearby Healthcare Facilities</h2>
          <div className="location-prompt">
            <div className="location-icon">
              <i className="fas fa-map-marker-alt" aria-hidden="true"></i>
            </div>
            <div className="location-message">
              <p>Please enable your location, so we can find nearby healthcare facilities</p>
              <a 
                href="#" 
                className="enable-location" 
                aria-label="Enable location services to find nearby facilities"
                onClick={(e) => { e.preventDefault(); detectLocation(); }}
              >
                Enable Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Healthcare Provider CTA Section */}
      <section className="provider-cta" aria-labelledby="provider-heading">
        <div className="container">
          <div className="cta-content">
            <div className="cta-text">
              <h2 id="provider-heading">Are you a Healthcare Provider?</h2>
              <p>Join LingapLink and connect with thousands of patients across the Philippines. Streamline your practice with our comprehensive healthcare platform.</p>
              <div className="cta-features" role="list" aria-label="Platform features for healthcare providers">
                <div className="cta-feature" role="listitem">
                  <i className="fas fa-check-circle" aria-hidden="true"></i>
                  <span>Patient Management System</span>
                </div>
                <div className="cta-feature" role="listitem">
                  <i className="fas fa-check-circle" aria-hidden="true"></i>
                  <span>Online Consultation Tools</span>
                </div>
                <div className="cta-feature" role="listitem">
                  <i className="fas fa-check-circle" aria-hidden="true"></i>
                  <span>Appointment Scheduling</span>
                </div>
                <div className="cta-feature" role="listitem">
                  <i className="fas fa-check-circle" aria-hidden="true"></i>
                  <span>Analytics & Reports</span>
                </div>
              </div>
            </div>
                          <div className="cta-action">
                <button 
                  onClick={handlePartnerSignup}
                  className="partner-btn"
                  aria-label="Register your healthcare practice with LingapLink"
                >
                  <i className="fas fa-handshake" aria-hidden="true"></i>
                  Partner with LingapLink
                </button>
                <p className="cta-note">Join 150+ healthcare providers already on our platform</p>
              </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer" role="contentinfo">
        <div className="container">
          {/* Business Partnership CTA */}
          <div className="footer-cta">
            <div className="footer-cta-content">
              <div className="cta-text-section">
                <h3>
                  <i className="fas fa-hospital" aria-hidden="true"></i>
                  Healthcare Providers - Join LingapLink
                </h3>
                <p>Connect with thousands of patients across the Philippines. Grow your practice with our digital platform.</p>
              </div>
              <div className="cta-actions-section">
                                    <button 
                      onClick={handlePartnerSignup}
                      className="cta-primary-btn"
                      aria-label="Register your healthcare facility"
                    >
                      <i className="fas fa-plus-circle" aria-hidden="true"></i>
                      Register Your Practice
                    </button>
                    <button 
                      onClick={handlePartnerSignin}
                      className="cta-secondary-btn"
                      aria-label="Sign in to provider portal"
                    >
                      <i className="fas fa-sign-in-alt" aria-hidden="true"></i>
                      Provider Login
                    </button>
              </div>
            </div>
          </div>
          
          {/* Main Footer Content */}
          <div className="footer-main">
            <div className="footer-grid">
              {/* Company Info */}
              <div className="footer-brand">
                <div className="footer-logo">
                  <i className="fas fa-heartbeat" aria-hidden="true"></i>
                  <span>LingapLink</span>
                  <span className="logo-badge">PH</span>
                </div>
                <p className="footer-description">
                  The Philippines' leading digital healthcare platform connecting patients with trusted medical facilities.
                </p>
                <div className="footer-stats">
                  <div className="stat-item">
                    <span className="stat-number">180+</span>
                    <span className="stat-label">Partners</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">50K+</span>
                    <span className="stat-label">Patients</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">24/7</span>
                    <span className="stat-label">Available</span>
                  </div>
                </div>
              </div>

              {/* For Patients */}
              <nav className="footer-nav" aria-labelledby="patient-nav">
                <h3 id="patient-nav">For Patients</h3>
                <ul className="nav-list">
                  <li><button onClick={() => navigate('/patient-sign-up')}>Create Account</button></li>
                  <li><button onClick={() => navigate('/patient-sign-in')}>Patient Login</button></li>
                  <li><button onClick={() => navigate('/patient-portal')}>Find Healthcare</button></li>
                  <li><button onClick={() => navigate('/patient-portal')}>Book Appointment</button></li>
                  <li><button onClick={() => navigate('/patient-portal')}>Medical Records</button></li>
                  <li><button onClick={() => navigate('/patient-portal')}>Telemedicine</button></li>
                </ul>
              </nav>

              {/* For Providers */}
              <nav className="footer-nav provider-nav" aria-labelledby="provider-nav">
                <h3 id="provider-nav">
                  <i className="fas fa-user-md" aria-hidden="true"></i>
                  For Providers
                </h3>
                <ul className="nav-list">
                  <li className="featured">
                    <button onClick={handlePartnerSignup}>
                      <i className="fas fa-star" aria-hidden="true"></i>
                      Join LingapLink
                    </button>
                  </li>
                  <li><button onClick={handlePartnerSignin}>Provider Portal</button></li>
                  <li><button onClick={handleBusinessPortal}>Practice Tools</button></li>
                  <li><button onClick={handleBusinessPortal}>Patient Management</button></li>
                  <li><button onClick={handleBusinessPortal}>Analytics</button></li>
                  <li><button onClick={handleBusinessPortal}>Support</button></li>
                </ul>
              </nav>

              {/* Support & Contact */}
              <div className="footer-contact">
                <h3>Get in Touch</h3>
                <div className="contact-methods">
                  <a href="mailto:support@lingaplink.ph" className="contact-item">
                    <i className="fas fa-envelope" aria-hidden="true"></i>
                    <span>support@lingaplink.ph</span>
                  </a>
                  <a href="tel:+6321234567" className="contact-item">
                    <i className="fas fa-phone" aria-hidden="true"></i>
                    <span>+63 (2) 123-4567</span>
                  </a>
                  <div className="contact-item">
                    <i className="fas fa-map-marker-alt" aria-hidden="true"></i>
                    <span>Makati City, Philippines</span>
                  </div>
                </div>
                
                <div className="footer-links-section">
                  <h4>Quick Links</h4>
                  <ul className="quick-links">
                    <li><a href="#">Help Center</a></li>
                    <li><a href="#">Privacy Policy</a></li>
                    <li><a href="#">Terms of Service</a></li>
                    <li><a href="#">HIPAA Compliance</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer Bottom */}
          <div className="footer-bottom">
            <div className="footer-bottom-content">
              <div className="copyright">
                <p>&copy; <span id="current-year">2024</span> LingapLink. All rights reserved.</p>
              </div>
              <div className="social-links">
                <a 
                  href="#" 
                  className="social-link" 
                  aria-label="Facebook"
                  onClick={(e) => { e.preventDefault(); handleSocialLink('Facebook'); }}
                >
                  <i className="fab fa-facebook" aria-hidden="true"></i>
                </a>
                <a 
                  href="#" 
                  className="social-link" 
                  aria-label="Twitter"
                  onClick={(e) => { e.preventDefault(); handleSocialLink('Twitter'); }}
                >
                  <i className="fab fa-twitter" aria-hidden="true"></i>
                </a>
                <a 
                  href="#" 
                  className="social-link" 
                  aria-label="Instagram"
                  onClick={(e) => { e.preventDefault(); handleSocialLink('Instagram'); }}
                >
                  <i className="fab fa-instagram" aria-hidden="true"></i>
                </a>
                <a 
                  href="#" 
                  className="social-link" 
                  aria-label="LinkedIn"
                  onClick={(e) => { e.preventDefault(); handleSocialLink('LinkedIn'); }}
                >
                  <i className="fab fa-linkedin" aria-hidden="true"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Container for Notifications */}
      <div id="toast-container" className="toast-container" aria-live="polite" aria-atomic="false"></div>
    </>
  )
}

export default LandingPage 