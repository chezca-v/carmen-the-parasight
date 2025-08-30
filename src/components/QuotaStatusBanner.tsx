import React, { useState, useEffect } from 'react';
import { getQuotaMessage, getQuotaActionMessage } from '../utils/firebase-quota-helper';

interface QuotaStatusBannerProps {
  className?: string;
}

const QuotaStatusBanner: React.FC<QuotaStatusBannerProps> = ({ className = '' }) => {
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const checkQuotaStatus = () => {
      const message = getQuotaMessage();
      setQuotaMessage(message);
      setShowBanner(!!message);
    };

    // Check immediately
    checkQuotaStatus();

    // Check every 30 seconds
    const interval = setInterval(checkQuotaStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!showBanner || !quotaMessage) {
    return null;
  }

  return (
    <div className={`quota-status-banner ${className}`}>
      <div className="quota-banner-content">
        <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <span className="quota-message">{quotaMessage}</span>
        <button 
          className="quota-banner-close"
          onClick={() => setShowBanner(false)}
          aria-label="Close quota status banner"
        >
          <i className="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
      <style jsx>{`
        .quota-status-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 12px 20px;
          z-index: 10000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          animation: slideDown 0.3s ease-out;
        }

        .quota-banner-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          max-width: 1200px;
          margin: 0 auto;
          font-size: 14px;
          font-weight: 500;
        }

        .quota-message {
          flex: 1;
          text-align: center;
        }

        .quota-banner-close {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s ease;
        }

        .quota-banner-close:hover {
          background-color: rgba(255,255,255,0.1);
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @media (max-width: 768px) {
          .quota-banner-content {
            font-size: 12px;
            padding: 0 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default QuotaStatusBanner; 