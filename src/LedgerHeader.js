import React from 'react';
import './AdminHomeResponsive.css';
import PropTypes from 'prop-types';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

function LedgerHeader({
  company,
  ledger,
  fromDate,
  toDate,
  companyOptions = [],
  ledgerOptions = [],
  onCompanyChange,
  onLedgerChange,
  onFromDateChange,
  onToDateChange,
  onSubmit,
  submitLabel = 'Submit',
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="ledger-form-row"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'flex-end',
        marginBottom: 24,
        overflowX: 'auto',
      }}
    >
      <div style={{ flex: '0.3 1 0', minWidth: 30, marginRight: 35 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 600, marginBottom: 4 }}>
          <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>business</span>
          Company
        </label>
        <Autocomplete
          options={companyOptions}
          getOptionLabel={option => option.label || ''}
          value={companyOptions.find(opt => opt.value === company) || null}
          onChange={(_, newValue) => {
            if (onCompanyChange) {
              // Simulate event for compatibility
              onCompanyChange({ target: { value: newValue ? newValue.value : '' } });
            }
          }}
          isOptionEqualToValue={(option, value) => option.value === value.value}
          renderInput={(params) => (
            <TextField
              {...params}
              required
              placeholder="Select company"
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: false }}
              sx={{
                width: '100%',
                background: '#fff',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  fontSize: 15,
                  color: '#334155',
                  fontFamily: 'inherit',
                  padding: '0',
                },
                '& .MuiInputLabel-root': {
                  color: '#334155',
                  fontWeight: 500,
                },
              }}
            />
          )}
        />
      </div>
      <div style={{ flex: '0.5 1 0', minWidth: 30, marginRight: 35 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 600, marginBottom: 4 }}>
          <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>account_balance_wallet</span>
          Ledger
        </label>
        <Autocomplete
          options={ledgerOptions}
          getOptionLabel={option => option.label || ''}
          value={ledgerOptions.find(opt => opt.value === ledger) || null}
          onChange={(_, newValue) => {
            if (onLedgerChange) {
              onLedgerChange({ target: { value: newValue ? newValue.value : '' } });
            }
          }}
          isOptionEqualToValue={(option, value) => option.value === value.value}
          renderInput={(params) => (
            <TextField
              {...params}
              required
              placeholder="Select ledger"
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: false }}
              sx={{
                width: '100%',
                background: '#fff',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  fontSize: 15,
                  color: '#334155',
                  fontFamily: 'inherit',
                  padding: '0',
                },
                '& .MuiInputLabel-root': {
                  color: '#334155',
                  fontWeight: 500,
                },
              }}
            />
          )}
        />
      </div>
      {/* From Date */}
      <div style={{ flex: '0.5 1 0', minWidth: 120, maxWidth: 180, marginRight: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 600, marginBottom: 4 }}>
          <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>calendar_month</span>
          From Date
        </label>
        <input
          type="date"
          value={fromDate}
          onChange={onFromDateChange}
          style={{
            width: '100%',
            minWidth: 120,
            maxWidth: 180,
            padding: '7px 14px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: 15,
            background: '#fff',
            color: '#334155',
            fontFamily: 'inherit',
            height: 40,
            boxSizing: 'border-box',
          }}
          required
        />
      </div>
      {/* To Date */}
      <div style={{ flex: '0.5 1 0', minWidth: 120, maxWidth: 180, marginRight: 0 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 600, marginBottom: 4 }}>
          <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>calendar_month</span>
          To Date
        </label>
        <input
          type="date"
          value={toDate}
          onChange={onToDateChange}
          style={{
            width: '100%',
            minWidth: 120,
            maxWidth: 180,
            padding: '7px 14px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: 15,
            background: '#fff',
            color: '#334155',
            fontFamily: 'inherit',
            height: 40,
            boxSizing: 'border-box',
          }}
          required
        />
      </div>
      <button
        type="submit"
        style={{
          flex: '0.1 0 auto',
          padding: '12px 12px',
          background: '#1e40af',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 16,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          height: 44,
          whiteSpace: 'nowrap',
        }}
      >
        <span className="material-icons" style={{ fontSize: 18 }}>send</span>
        {submitLabel}
      </button>
    </form>
  );
}

LedgerHeader.propTypes = {
  company: PropTypes.string.isRequired,
  ledger: PropTypes.string.isRequired,
  fromDate: PropTypes.string,
  toDate: PropTypes.string,
  companyOptions: PropTypes.array,
  ledgerOptions: PropTypes.array,
  onCompanyChange: PropTypes.func.isRequired,
  onLedgerChange: PropTypes.func.isRequired,
  onFromDateChange: PropTypes.func,
  onToDateChange: PropTypes.func,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.string,
};

export default LedgerHeader; 