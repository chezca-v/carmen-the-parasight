import React from 'react'

interface SidebarProps {
  isSidebarOpen: boolean
  activeSection: 'dashboard' | 'profile' | 'help' | 'facilities'
  onNavClick: (section: 'dashboard' | 'profile' | 'help' | 'facilities') => void
  onLogout: () => void
  sidebarRef: React.RefObject<HTMLElement>
}

const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  activeSection,
  onNavClick,
  onLogout,
  sidebarRef
}) => {
  return (
    <aside className={`sidebar ${isSidebarOpen ? 'active' : ''}`} ref={sidebarRef} role="navigation" aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="logo">
          <i className="fas fa-heart-pulse" aria-hidden="true"></i>
          <span>LingapLink</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        <ul className="nav-items" role="menubar">
          <li className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} role="none">
            <button 
              className="nav-link" 
              onClick={(e) => { e.preventDefault(); onNavClick('dashboard'); }}
              role="menuitem"
              aria-current={activeSection === 'dashboard' ? 'page' : undefined}
              aria-label="Navigate to Dashboard"
            >
              <i className="fas fa-th-large" aria-hidden="true"></i>
              <span>Dashboard</span>
            </button>
          </li>

          <li className={`nav-item ${activeSection === 'profile' ? 'active' : ''}`} role="none">
            <button 
              className="nav-link" 
              onClick={(e) => { e.preventDefault(); onNavClick('profile'); }}
              role="menuitem"
              aria-current={activeSection === 'profile' ? 'page' : undefined}
              aria-label="Navigate to Profile"
            >
              <i className="fas fa-user" aria-hidden="true"></i>
              <span>Profile</span>
            </button>
          </li>
          
          <li className={`nav-item ${activeSection === 'facilities' ? 'active' : ''}`} role="none">
            <button 
              className="nav-link" 
              onClick={(e) => { e.preventDefault(); onNavClick('facilities'); }}
              role="menuitem"
              aria-current={activeSection === 'facilities' ? 'page' : undefined}
              aria-label="Navigate to Healthcare Facilities"
            >
              <i className="fas fa-hospital" aria-hidden="true"></i>
              <span>Facilities</span>
            </button>
          </li>
          
          <li className={`nav-item ${activeSection === 'help' ? 'active' : ''}`} role="none">
            <button 
              className="nav-link" 
              onClick={(e) => { e.preventDefault(); onNavClick('help'); }}
              role="menuitem"
              aria-current={activeSection === 'help' ? 'page' : undefined}
              aria-label="Navigate to Help"
            >
              <i className="fas fa-question-circle" aria-hidden="true"></i>
              <span>Help</span>
            </button>
          </li>
        </ul>
      </nav>
      
      <div className="sidebar-footer">
        <button 
          className="logout-btn" 
          onClick={onLogout}
          aria-label="Sign out of your account"
        >
          <i className="fas fa-sign-out-alt" aria-hidden="true"></i>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

export default React.memo(Sidebar)









