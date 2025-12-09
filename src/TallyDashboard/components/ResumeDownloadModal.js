import React from 'react';

const ResumeDownloadModal = ({ isOpen, onContinue, onStartFresh, onClose, progress, companyName }) => {
  if (!isOpen) return null;

  const progressPercentage = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={(e) => {
        // Don't close on backdrop click - user must choose
        e.stopPropagation();
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          animation: 'slideUp 0.3s ease-out',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'transparent',
              border: 'none',
              fontSize: '28px',
              color: '#64748b',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'all 0.2s',
              padding: 0,
              lineHeight: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#1e293b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }}
            aria-label="Close"
          >
            ×
          </button>
        )}
        {/* Icon */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span className="material-icons" style={{
              fontSize: '36px',
              color: '#f59e0b'
            }}>
              download
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#1e293b',
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          Resume Download?
        </h2>

        {/* Message */}
        <p style={{
          fontSize: '16px',
          color: '#64748b',
          marginBottom: '24px',
          textAlign: 'center',
          lineHeight: '1.6'
        }}>
          A previous download for <strong>{companyName}</strong> was interrupted.
        </p>

        {/* Progress Info */}
        {progress.total > 0 && (
          <div style={{
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              fontSize: '14px',
              color: '#475569',
              marginBottom: '8px',
              fontWeight: 500
            }}>
              Previous Progress:
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e0f2fe',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '8px'
            }}>
              <div style={{
                width: `${progressPercentage}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{
              fontSize: '13px',
              color: '#64748b',
              textAlign: 'center'
            }}>
              {progress.current} / {progress.total} chunks ({progressPercentage}%)
            </div>
          </div>
        )}

        {/* Options */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <button
            onClick={onContinue}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.25)';
            }}
          >
            <span className="material-icons" style={{ fontSize: '20px' }}>
              play_arrow
            </span>
            Continue from where it left off
          </button>

          <button
            onClick={onStartFresh}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: '#fff',
              color: '#475569',
              border: '2px solid #cbd5e1',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <span className="material-icons" style={{ fontSize: '20px' }}>
              refresh
            </span>
            Start from the beginning
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ResumeDownloadModal;

