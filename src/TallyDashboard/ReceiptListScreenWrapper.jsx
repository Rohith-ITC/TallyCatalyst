import React from 'react';
import ReceiptListScreen from './ReceiptListScreen';

// Wrapper component that reads company from sessionStorage and passes to TypeScript screen
const ReceiptListScreenWrapper = () => {
  // Read company data from sessionStorage
  const tallyloc_id = sessionStorage.getItem('tallyloc_id');
  const companyName = sessionStorage.getItem('company');
  const guid = sessionStorage.getItem('guid');
  const conn_name = sessionStorage.getItem('conn_name') || companyName;

  // Format company object to match TypeScript Company interface
  const company = {
    tallyloc_id: tallyloc_id ? parseInt(tallyloc_id, 10) : 0,
    company: companyName || '',
    conn_name: conn_name || companyName || '',
    guid: guid || '',
    address: sessionStorage.getItem('address') || '',
    pincode: sessionStorage.getItem('pincode') || '',
    statename: sessionStorage.getItem('statename') || '',
    countryname: sessionStorage.getItem('countryname') || '',
    email: sessionStorage.getItem('email') || '',
    phonenumber: sessionStorage.getItem('phonenumber') || '',
    mobilenumbers: sessionStorage.getItem('mobilenumbers') || '',
    gstinno: sessionStorage.getItem('gstinno') || '',
    startingfrom: sessionStorage.getItem('startingfrom') || '',
    booksfrom: sessionStorage.getItem('booksfrom') || '',
    shared_email: sessionStorage.getItem('shared_email') || '',
    status: sessionStorage.getItem('status') || '',
    access_type: sessionStorage.getItem('access_type') || '',
    createdAt: sessionStorage.getItem('createdAt') || '',
  };

  // Empty onBack handler (not needed in dashboard context)
  const handleBack = () => {
    // No-op - back button is hidden in dashboard
  };

  if (!tallyloc_id || !companyName || !guid) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Company information not found. Please select a company first.</p>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        .receipt-list-header .back-button {
          display: none;
        }
      `}</style>
      <ReceiptListScreen company={company} onBack={handleBack} />
    </div>
  );
};

export default ReceiptListScreenWrapper;

