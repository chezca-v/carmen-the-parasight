import React, { useEffect } from 'react'

const YearUpdater: React.FC = () => {
  useEffect(() => {
    const yearElement = document.getElementById('current-year')
    if (yearElement) {
      yearElement.textContent = new Date().getFullYear().toString()
    }
  }, [])

  return null
}

export default YearUpdater 