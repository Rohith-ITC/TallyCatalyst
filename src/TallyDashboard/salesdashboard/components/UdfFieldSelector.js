import React, { useState, useEffect } from 'react';
import { loadUdfConfig, getAvailableUdfFields, clearCompanyUdfConfigCache } from '../../../utils/udfConfigLoader';

const UdfFieldSelector = ({ 
  companyInfo, 
  selectedFields, 
  onSelectionChange
}) => {
  const [udfConfig, setUdfConfig] = useState(null);
  const [availableFields, setAvailableFields] = useState({ fields: [], aggregates: [] });
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    console.log('UDF Field Selector: useEffect triggered', { companyInfo });
    if (companyInfo?.tallyloc_id && companyInfo?.guid) {
      loadUdfFields();
    } else {
      console.log('UDF Field Selector: Missing company info, clearing state');
      setUdfConfig(null);
      setAvailableFields({ fields: [], aggregates: [] });
    }
  }, [companyInfo]);
  
  const loadUdfFields = async () => {
    if (!companyInfo?.tallyloc_id || !companyInfo?.guid) {
      console.log('UDF Field Selector: Missing company info', companyInfo);
      return;
    }
    
    console.log('UDF Field Selector: Loading UDF config for', {
      tallyloc_id: companyInfo.tallyloc_id,
      guid: companyInfo.guid
    });
    
    setLoading(true);
    try {
      const config = await loadUdfConfig(companyInfo.tallyloc_id, companyInfo.guid);
      console.log('UDF Field Selector: Loaded config', config);
      setUdfConfig(config);
      
      if (config) {
        console.log('UDF Field Selector: Raw config received', config);
        const available = getAvailableUdfFields(config);
        console.log('UDF Field Selector: Available fields after processing', available);
        console.log('UDF Field Selector: Fields count:', available.fields.length, 'Aggregates count:', available.aggregates.length);
        
        if (available.fields.length === 0 && available.aggregates.length === 0) {
          console.warn('UDF Field Selector: Config exists but no fields/aggregates extracted. Config structure:', JSON.stringify(config, null, 2));
        }
        
        setAvailableFields(available);
      } else {
        console.log('UDF Field Selector: No config found or config is null');
        setAvailableFields({ fields: [], aggregates: [] });
      }
    } catch (error) {
      console.error('UDF Field Selector: Error loading UDF fields:', error);
      setUdfConfig(null);
      setAvailableFields({ fields: [], aggregates: [] });
    } finally {
      setLoading(false);
    }
  };
  
  const handleFieldToggle = (fieldName, isAggregate = false) => {
    const newSelection = { ...selectedFields };
    
    if (isAggregate) {
      // Toggle aggregate and all its fields
      const aggregate = availableFields.aggregates.find(a => a.name === fieldName);
      if (aggregate) {
        const allSelected = aggregate.fields.every(f => selectedFields[`${fieldName}.${f.fieldName}`]);
        
        aggregate.fields.forEach(f => {
          const key = `${fieldName}.${f.fieldName}`;
          if (allSelected) {
            delete newSelection[key];
          } else {
            newSelection[key] = true;
          }
        });
      }
    } else {
      // Toggle simple field
      if (newSelection[fieldName]) {
        delete newSelection[fieldName];
      } else {
        newSelection[fieldName] = true;
      }
    }
    
    onSelectionChange(newSelection);
  };
  
  const handleAggregateFieldToggle = (aggregateName, fieldName) => {
    const newSelection = { ...selectedFields };
    const key = `${aggregateName}.${fieldName}`;
    
    if (newSelection[key]) {
      delete newSelection[key];
    } else {
      newSelection[key] = true;
    }
    
    onSelectionChange(newSelection);
  };
  
  if (loading) {
    return (
      <div style={{
        padding: '16px',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        textAlign: 'center'
      }}>
        <span className="material-icons" style={{ 
          fontSize: '20px', 
          color: '#3b82f6',
          animation: 'spin 1s linear infinite',
          display: 'block',
          marginBottom: '8px'
        }}>
          sync
        </span>
        <div style={{ fontSize: '13px', color: '#64748b' }}>
          Loading UDF fields...
        </div>
      </div>
    );
  }
  
  if (!udfConfig || (availableFields.fields.length === 0 && availableFields.aggregates.length === 0)) {
    console.log('UDF Field Selector: Rendering empty state', {
      hasUdfConfig: !!udfConfig,
      fieldsCount: availableFields.fields.length,
      aggregatesCount: availableFields.aggregates.length,
      companyInfo: companyInfo ? { tallyloc_id: companyInfo.tallyloc_id, guid: companyInfo.guid } : null
    });
    return (
      <div style={{
        padding: '16px',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          fontSize: '13px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span className="material-icons" style={{ fontSize: '16px', color: '#3b82f6' }}>tune</span>
          UDF Fields
        </div>
        <div style={{
          fontSize: '12px',
          color: '#64748b',
          marginBottom: '12px',
          lineHeight: '1.5'
        }}>
          {!companyInfo ? (
            'No company selected. Please select a company first.'
          ) : (
            <>
              No UDF fields configured for this company. To configure UDF fields:
              <ol style={{ margin: '8px 0 0 20px', padding: 0, fontSize: '12px' }}>
                <li style={{ marginBottom: '4px' }}>Go to <strong>Tally Settings</strong> → <strong>Company Configurations</strong></li>
                <li style={{ marginBottom: '4px' }}>Navigate to <strong>Voucher UDF</strong> section</li>
                <li style={{ marginBottom: '4px' }}>Configure your UDF fields and aggregates</li>
                <li>Click <strong>Refresh</strong> below to reload</li>
              </ol>
            </>
          )}
        </div>
        {companyInfo && (
          <button
            onClick={async () => {
              if (companyInfo?.tallyloc_id && companyInfo?.guid) {
                clearCompanyUdfConfigCache(companyInfo.tallyloc_id, companyInfo.guid);
                await loadUdfFields();
              }
            }}
            style={{
              padding: '8px 14px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#3b82f6';
            }}
          >
            <span className="material-icons" style={{ fontSize: '16px' }}>refresh</span>
            Refresh UDF Config
          </button>
        )}
      </div>
    );
  }
  
  console.log('UDF Field Selector: Rendering with fields', {
    fieldsCount: availableFields.fields.length,
    aggregatesCount: availableFields.aggregates.length
  });
  
  const selectedCount = Object.keys(selectedFields || {}).filter(k => selectedFields[k]).length;
  
  return (
    <div style={{
      padding: '16px',
      background: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{
        fontSize: '13px',
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-icons" style={{ fontSize: '16px', color: '#3b82f6' }}>tune</span>
          UDF Fields
        </div>
        {selectedCount > 0 && (
          <span style={{
            background: '#3b82f6',
            color: '#fff',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 700
          }}>
            {selectedCount} selected
          </span>
        )}
      </div>
      
      <div style={{
        maxHeight: '400px',
        overflowY: 'auto',
        paddingRight: '8px',
        marginRight: '-8px'
      }}>
        {/* Simple Fields */}
        {availableFields.fields.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#64748b',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Fields
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {availableFields.fields.map(field => (
                <label
                  key={field.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px',
                    background: '#fff',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedFields[field.name]}
                    onChange={() => handleFieldToggle(field.name, false)}
                    style={{
                      width: '16px',
                      height: '16px',
                      marginRight: '12px',
                      cursor: 'pointer',
                      accentColor: '#3b82f6',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: 600, 
                      color: '#1e293b', 
                      fontSize: '13px',
                      marginBottom: '4px'
                    }}>
                      {field.name}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#64748b', 
                      fontFamily: 'monospace',
                      wordBreak: 'break-word'
                    }}>
                      {field.formula}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
        
        {/* Aggregates */}
        {availableFields.aggregates.length > 0 && (
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#64748b',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Aggregates
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {availableFields.aggregates.map(aggregate => {
                const allFieldsSelected = aggregate.fields.every(
                  f => selectedFields[`${aggregate.name}.${f.fieldName}`]
                );
                const someFieldsSelected = aggregate.fields.some(
                  f => selectedFields[`${aggregate.name}.${f.fieldName}`]
                );
                
                return (
                  <div
                    key={aggregate.name}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      background: someFieldsSelected ? '#f0f9ff' : '#fff'
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        marginBottom: '8px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={allFieldsSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someFieldsSelected && !allFieldsSelected;
                        }}
                        onChange={() => handleFieldToggle(aggregate.name, true)}
                        style={{
                          width: '16px',
                          height: '16px',
                          marginRight: '10px',
                          cursor: 'pointer',
                          accentColor: '#3b82f6',
                          flexShrink: 0
                        }}
                      />
                      <div style={{ 
                        fontWeight: 700, 
                        color: '#1e40af', 
                        fontSize: '13px' 
                      }}>
                        {aggregate.name}
                      </div>
                    </label>
                    
                    <div style={{ marginLeft: '26px' }}>
                      {aggregate.fields.map(field => (
                        <label
                          key={field.fullName}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '6px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginBottom: '4px',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedFields[field.fullName]}
                            onChange={() => handleAggregateFieldToggle(aggregate.name, field.fieldName)}
                            style={{
                              width: '14px',
                              height: '14px',
                              marginRight: '10px',
                              cursor: 'pointer',
                              accentColor: '#3b82f6',
                              flexShrink: 0
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              fontWeight: 500, 
                              color: '#374151', 
                              fontSize: '12px',
                              marginBottom: '2px'
                            }}>
                              {field.fieldName}
                            </div>
                            <div style={{ 
                              fontSize: '10px', 
                              color: '#94a3b8', 
                              fontFamily: 'monospace',
                              wordBreak: 'break-word'
                            }}>
                              {field.formula}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UdfFieldSelector;

