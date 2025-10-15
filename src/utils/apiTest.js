import { getApiUrl, API_CONFIG } from '../config';

export const testApiConnection = async () => {
  const testPayload = {
    ip: "localhost",
    port: "9005"
  };

  console.log('🧪 Testing API Connection...');
  console.log('URL:', getApiUrl(API_CONFIG.ENDPOINTS.TALLY_CHECK_CONNECTION));
  console.log('Payload:', testPayload);

  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.TALLY_CHECK_CONNECTION), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    console.log('📡 Response Status:', response.status);
    console.log('📡 Response OK:', response.ok);

    if (!response.ok) {
      console.error('❌ HTTP Error:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    console.log('📡 Response Data:', data);

    if (data.status === 'success') {
      console.log('✅ API Test Successful!');
      return true;
    } else {
      console.error('❌ API returned error:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Network Error:', error);
    return false;
  }
};

// Test function that can be called from browser console
window.testTallyApi = testApiConnection; 