import React from 'react';
import { formatCurrency } from '../utils/helpers';

const BillDrilldownModal = ({ data, loading, error, selectedBill, onClose, onRowClick }) => {
  if (loading) {
    return (
      <div className="drilldown-modal-overlay" onClick={onClose}>
        <div className="drilldown-modal" onClick={(e) => e.stopPropagation()}>
          <div className="drilldown-modal-header">
            <h2>Loading Bill Details...</h2>
            <button className="drilldown-close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="drilldown-modal-body">
            <div className="drilldown-loading-container">
              <div className="drilldown-loading-spinner">
                <div className="spinner-ring" />
                <div className="spinner-ring" />
                <div className="spinner-ring" />
              </div>
              <p className="drilldown-loading-text">Loading ledger entries...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="drilldown-modal-overlay" onClick={onClose}>
        <div className="drilldown-modal" onClick={(e) => e.stopPropagation()}>
          <div className="drilldown-modal-header">
            <h2>Error Loading Bill Details</h2>
            <button className="drilldown-close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="drilldown-modal-body">
            <div className="error-container">
              <p>{error}</p>
              <button onClick={onClose} className="retry-button">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="drilldown-modal-overlay" onClick={onClose}>
      <div className="drilldown-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drilldown-modal-header">
          <h2>Bill Details</h2>
          <button className="drilldown-close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="drilldown-modal-body">
          {selectedBill && (
            <div className="drilldown-info">
              <p>
                <strong>Ledger:</strong> {selectedBill.ledgerName}
              </p>
              {data && data.rows && data.rows.length > 0 && data.columns && (() => {
                const customerBalanceIndex = data.columns.findIndex((col) =>
                  (col.name || '').toLowerCase().includes('balance') ||
                  (col.alias || '').toLowerCase().includes('balance')
                );
                if (customerBalanceIndex !== -1) {
                  const customerBalance = data.rows[0] && data.rows[0][customerBalanceIndex];
                  if (customerBalance) {
                    return (
                      <p className="customer-balance-display">
                        <strong>Customer Balance:</strong>{' '}
                        <span className="balance-amount">{formatCurrency(customerBalance)}</span>
                      </p>
                    );
                  }
                }
                return null;
              })()}
              <p>
                <strong>Bill:</strong> {selectedBill.billName}
              </p>
              {selectedBill.salesperson && (
                <p>
                  <strong>Salesperson:</strong> {selectedBill.salesperson}
                </p>
              )}
            </div>
          )}
          {data && data.rows && data.rows.length > 0 ? (
            <div className="drilldown-table-container">
              <table className="drilldown-table">
                <thead>
                  <tr>
                    {data.columns.map((col, index) => {
                      const colName = (col.name || '').toLowerCase();
                      const colAlias = (col.alias || '').toLowerCase();
                      const isBalance = colName.includes('balance') || colAlias.includes('balance');
                      const isMasterId = colName.includes('masterid') || colAlias.includes('masterid') || colName === 'masterid' || colAlias === 'masterid';
                      if (isBalance || isMasterId) return null;

                      const isAmount = colName.includes('amount') || colAlias.includes('amount');
                      const isRightAligned = isAmount;
                      return (
                        <th key={index} className={isRightAligned ? 'text-right' : ''}>
                          {col.alias || col.name}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, rowIndex) => {
                    // Find MasterID column index
                    const masterIdIndex = data.columns.findIndex(
                      (col) => {
                        const colName = (col.name || '').toLowerCase();
                        const colAlias = (col.alias || '').toLowerCase();
                        return colName.includes('masterid') || colAlias.includes('masterid') || colName === 'masterid' || colAlias === 'masterid';
                      }
                    );
                    const masterId = masterIdIndex !== -1 ? row[masterIdIndex] : null;

                    return (
                      <tr 
                        key={rowIndex}
                        onClick={() => {
                          if (onRowClick && masterId) {
                            onRowClick(masterId);
                          }
                        }}
                        style={{ cursor: masterId ? 'pointer' : 'default' }}
                        className={masterId ? 'clickable-row' : ''}
                      >
                        {data.columns.map((col, colIndex) => {
                          const colName = (col.name || '').toLowerCase();
                          const colAlias = (col.alias || '').toLowerCase();
                          const isBalance = colName.includes('balance') || colAlias.includes('balance');
                          const isMasterId = colName.includes('masterid') || colAlias.includes('masterid') || colName === 'masterid' || colAlias === 'masterid';
                          if (isBalance || isMasterId) return null;

                          const cell = row[colIndex];
                          const isAmount = colName.includes('amount') || colAlias.includes('amount');
                          const isRightAligned = isAmount;
                          const formattedCell = isAmount ? formatCurrency(cell) : cell;
                          return (
                            <td key={colIndex} className={isRightAligned ? 'text-right' : ''}>
                              {formattedCell}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No ledger entries found for this bill</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillDrilldownModal;

