import React from 'react';
import { Link } from 'react-router-dom';
import TallyLogo from './DLrlogo.png';
import { COPYRIGHT_CONFIG } from './config/copyright';

function TermsOfService() {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      position: 'relative',
      overflow: 'auto',
      background: 'linear-gradient(135deg, #e6f4ea 0%, #dbeafe 100%)',
      padding: '20px',
    }}>
      {/* Faint grid pattern overlay */}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 0, pointerEvents: 'none' }}
      >
        <defs>
          <pattern id="smallGrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#b6e0c6" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#smallGrid)" />
      </svg>

      <div style={{
        maxWidth: '900px',
        margin: '40px auto',
        background: '#fff',
        borderRadius: '18px',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        padding: '40px',
        zIndex: 2,
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img src={TallyLogo} alt="Tally Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '20px' }} />
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1e40af', margin: '0 0 10px 0' }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content */}
        <div style={{
          fontSize: '15px',
          lineHeight: '1.8',
          color: '#334155',
          textAlign: 'left',
        }}>
          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing and using DataLynkr (TallyCatalyst) services, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
            <p>
              These Terms of Service ("Terms") govern your access to and use of our website, applications, and services (collectively, the "Service"). Please read these Terms carefully before using our Service.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              2. Description of Service
            </h2>
            <p>
              DataLynkr provides a platform for integrating and managing Tally accounting data, including but not limited to:
            </p>
            <ul style={{ paddingLeft: '25px', marginTop: '10px' }}>
              <li>Access to ledger information and vouchers</li>
              <li>Sales order management and processing</li>
              <li>Inventory and stock management</li>
              <li>Receivables and payables tracking</li>
              <li>Financial reporting and analytics</li>
              <li>Customer and vendor management</li>
            </ul>
            <p style={{ marginTop: '15px' }}>
              We reserve the right to modify, suspend, or discontinue any part of the Service at any time with or without notice.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              3. User Accounts and Registration
            </h2>
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              3.1 Account Creation
            </h3>
            <p>
              To use certain features of our Service, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.
            </p>

            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              3.2 Account Security
            </h3>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to immediately notify us of any unauthorized use of your account or any other breach of security.
            </p>

            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              3.3 Account Termination
            </h3>
            <p>
              We reserve the right to suspend or terminate your account at any time for violation of these Terms or for any other reason we deem necessary to protect the integrity of our Service.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              4. Acceptable Use
            </h2>
            <p>You agree not to use the Service to:</p>
            <ul style={{ paddingLeft: '25px', marginTop: '10px' }}>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others</li>
              <li>Transmit any malicious code, viruses, or harmful data</li>
              <li>Attempt to gain unauthorized access to our systems or networks</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Copy, modify, or create derivative works of the Service</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Remove any proprietary notices or labels</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              5. Subscription and Payment
            </h2>
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              5.1 Subscription Plans
            </h3>
            <p>
              We offer various subscription plans with different features and pricing. Subscription fees are billed in advance on a monthly or annual basis, as selected by you.
            </p>

            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              5.2 Payment Terms
            </h3>
            <p>
              All fees are non-refundable unless otherwise stated. You are responsible for providing valid payment information and authorizing us to charge your payment method for all fees.
            </p>

            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              5.3 Price Changes
            </h3>
            <p>
              We reserve the right to modify our pricing at any time. We will provide notice of any price changes, and you may cancel your subscription if you do not agree to the new pricing.
            </p>

            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              5.4 Cancellation
            </h3>
            <p>
              You may cancel your subscription at any time. Cancellation will take effect at the end of your current billing period. You will continue to have access to the Service until the end of your paid period.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              6. Intellectual Property
            </h2>
            <p>
              The Service and its original content, features, and functionality are owned by DataLynkr and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
            <p style={{ marginTop: '15px' }}>
              You retain ownership of any data you submit through the Service. By using the Service, you grant us a license to use, store, and process your data as necessary to provide the Service.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              7. Data and Privacy
            </h2>
            <p>
              Your use of the Service is also governed by our Privacy Policy. Please review our Privacy Policy to understand how we collect, use, and protect your information.
            </p>
            <p style={{ marginTop: '15px' }}>
              You are responsible for ensuring that any data you provide or process through the Service complies with applicable data protection laws and regulations.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              8. Disclaimers and Limitations of Liability
            </h2>
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              8.1 Service Availability
            </h3>
            <p>
              We strive to provide reliable and continuous access to the Service, but we do not guarantee that the Service will be available at all times or free from errors, interruptions, or security vulnerabilities.
            </p>

            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              8.2 Disclaimer of Warranties
            </h3>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>

            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              8.3 Limitation of Liability
            </h3>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              9. Indemnification
            </h2>
            <p>
              You agree to indemnify, defend, and hold harmless DataLynkr and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your access to or use of the Service or your violation of these Terms.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              10. Third-Party Services
            </h2>
            <p>
              Our Service may integrate with or link to third-party services, including Tally software and payment processors. We are not responsible for the availability, accuracy, or practices of third-party services. Your use of third-party services is subject to their respective terms and conditions.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              11. Modifications to Terms
            </h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of any material changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of the Service after such modifications constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              12. Governing Law and Dispute Resolution
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions. Any disputes arising out of or relating to these Terms or the Service shall be resolved through binding arbitration or in the courts of [Your Jurisdiction].
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              13. Severability
            </h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              14. Contact Information
            </h2>
            <p>
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <p style={{ marginTop: '10px' }}>
              <strong>Email:</strong> support@datalynkr.com<br />
              <strong>Address:</strong> [Your Company Address]
            </p>
          </section>
        </div>

        {/* Footer Links */}
        <div style={{
          marginTop: '40px',
          paddingTop: '30px',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center',
        }}>
          <Link
            to="/"
            style={{
              color: '#3b82f6',
              fontWeight: 600,
              textDecoration: 'none',
              marginRight: '20px',
            }}
          >
            ← Back to Login
          </Link>
          <Link
            to="/privacy-policy"
            style={{
              color: '#3b82f6',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Privacy Policy →
          </Link>
        </div>
      </div>

      {/* Copyright Footer */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        textAlign: 'center',
        padding: '12px 0',
        background: 'transparent',
        zIndex: 10,
      }}>
        <span style={{
          fontSize: '16px',
          color: '#64748b',
          fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
          fontWeight: '500'
        }}>
          © <span style={{ color: COPYRIGHT_CONFIG.ORANGE_COLOR, fontWeight: '700' }}>{COPYRIGHT_CONFIG.ORANGE_PART}</span> {COPYRIGHT_CONFIG.COMPANY_NAME.replace(COPYRIGHT_CONFIG.ORANGE_PART, '').trim()}
        </span>
      </div>
    </div>
  );
}

export default TermsOfService;

