import React from 'react';
import { Tooltip } from '@mui/material';

const AutoRefreshIndicator = ({ progress }) => {
    if (!progress) return null;

    return (
        <Tooltip
            title={
                <div style={{ textAlign: 'center' }}>
                    <div>{progress.message || 'Updating...'}</div>
                    {progress.total > 0 && (
                        <div style={{ marginTop: '5px', width: '100%', backgroundColor: '#555', borderRadius: '2px', height: '4px' }}>
                            <div
                                style={{
                                    width: `${(progress.current / progress.total) * 100}%`,
                                    backgroundColor: '#4caf50',
                                    height: '100%',
                                    borderRadius: '2px',
                                    transition: 'width 0.3s ease'
                                }}
                            />
                        </div>
                    )}
                </div>
            }
            arrow
        >
            <div
                style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#4caf50',
                    borderRadius: '50%',
                    boxShadow: '0 0 0 0 rgba(76, 175, 80, 0.7)',
                    animation: 'pulsate 1.5s infinite',
                    cursor: 'pointer',
                    marginLeft: '10px'
                }}
            >
                <style>
                    {`
            @keyframes pulsate {
              0% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
              }
              70% {
                transform: scale(1);
                box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
              }
              100% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
              }
            }
          `}
                </style>
            </div>
        </Tooltip>
    );
};

export default AutoRefreshIndicator;
