import React from 'react'

interface TopBarProps {
  onToggleSidebar: () => void
  isSidebarOpen: boolean
}

const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar, isSidebarOpen }) => {
  return (
    <div className="top-bar">
      <button 
        className={`mobile-menu-toggle ${isSidebarOpen ? 'active' : ''}`}
        onClick={onToggleSidebar}
        aria-label="Toggle navigation menu"
        aria-expanded={isSidebarOpen}
        aria-controls="sidebar-navigation"
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>
    </div>
  )
}

export default React.memo(TopBar)







