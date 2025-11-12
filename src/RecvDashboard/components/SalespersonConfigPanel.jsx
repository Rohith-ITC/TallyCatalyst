import React, { useMemo, useRef, useEffect } from 'react';

const SalespersonConfigPanel = ({
  receivables,
  columns,
  enabledSalespersons,
  onEnabledSalespersonsChange,
}) => {
  const salespersonIndex = columns.findIndex(
    (col) =>
      col.name.includes('SalesPerson') ||
      col.alias?.includes('SalesPerson') ||
      col.name.includes('Salesperson')
  );

  const allSalespersons = useMemo(() => {
    if (salespersonIndex === -1 || !receivables || receivables.length === 0) return [];
    const uniqueSalespersons = new Set();
    receivables.forEach((row) => {
      const salespersonName = row[salespersonIndex] || 'Unassigned';
      uniqueSalespersons.add(salespersonName);
    });
    return Array.from(uniqueSalespersons).sort();
  }, [receivables, columns, salespersonIndex]);

  // Determine if a salesperson is currently enabled/included
  // Empty set means none selected (all excluded)
  // Non-empty set means only those in the set are included
  const isSalespersonEnabled = (salespersonName) => {
    if (enabledSalespersons.size === 0) {
      return false; // None selected (all excluded)
    }
    return enabledSalespersons.has(salespersonName);
  };

  const handleToggleSalesperson = (salespersonName) => {
    const newEnabled = new Set(enabledSalespersons);
    
    if (newEnabled.has(salespersonName)) {
      newEnabled.delete(salespersonName);
    } else {
      newEnabled.add(salespersonName);
    }
    onEnabledSalespersonsChange(newEnabled);
  };

  const handleSelectAll = () => {
    // Select all explicitly
    onEnabledSalespersonsChange(new Set(allSalespersons));
  };

  const handleDeselectAll = () => {
    // Clear selection (none selected - all excluded)
    onEnabledSalespersonsChange(new Set());
  };

  const allSelected = enabledSalespersons.size === allSalespersons.length && enabledSalespersons.size > 0;
  const noneSelected = enabledSalespersons.size === 0;
  const someSelected = enabledSalespersons.size > 0 && enabledSalespersons.size < allSalespersons.length;
  const masterCheckboxRef = useRef(null);

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  return (
    <div className="salesperson-config-panel">
      <div className="config-panel-header">
        <h3>Select Salespersons to Include</h3>
      </div>
      <div className="config-panel-content">
        {/* Master checkbox for Select All / Deselect All */}
        <label 
          className="config-checkbox-label" 
          style={{ 
            fontWeight: '600', 
            padding: '8px 0',
            borderBottom: '1px solid #e5e7eb',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            ref={masterCheckboxRef}
            checked={allSelected}
            onChange={() => {
              if (allSelected) {
                handleDeselectAll();
              } else {
                handleSelectAll();
              }
            }}
            className="config-checkbox"
            style={{ marginRight: '8px', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: '600' }}>
            {allSelected ? 'All Selected' : someSelected ? 'Some Selected' : 'None Selected'}
          </span>
        </label>
        {allSalespersons.map((salesperson) => {
          const isEnabled = isSalespersonEnabled(salesperson);
          return (
            <label key={salesperson} className="config-checkbox-label">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={() => handleToggleSalesperson(salesperson)}
                className="config-checkbox"
              />
              <span>{salesperson}</span>
            </label>
          );
        })}
      </div>
      <div className="config-panel-footer">
        <span className="config-info">
          {allSalespersons.length === 0
            ? 'No salespersons found'
            : enabledSalespersons.size === 0
            ? `0 of ${allSalespersons.length} salespersons selected (none included)`
            : `${enabledSalespersons.size} of ${allSalespersons.length} salespersons selected`}
        </span>
      </div>
    </div>
  );
};

export default SalespersonConfigPanel;

