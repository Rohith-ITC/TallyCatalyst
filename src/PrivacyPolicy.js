import React from 'react';
import { Link } from 'react-router-dom';
import TallyLogo from './DLrlogo.png';
import { COPYRIGHT_CONFIG } from './config/copyright';

function PrivacyPolicy() {
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
            Privacy Policy
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
              1. Introduction
            </h2>
            <p>
              Welcome to DataLynkr (TallyCatalyst). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services.
            </p>
            <p>
              By using our services, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              2. Information We Collect
            </h2>
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              2.1 Personal Information
            </h3>
            <p>We may collect the following types of personal information:</p>
            <ul style={{ paddingLeft: '25px', marginTop: '10px' }}>
              <li>Name and contact information (email address, phone number)</li>
              <li>Account credentials and authentication information</li>
              <li>Company information and business details</li>
              <li>Payment and billing information</li>
              <li>Usage data and preferences</li>
            </ul>

            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#3b82f6', marginTop: '15px', marginBottom: '10px' }}>
              2.2 Business Data
            </h3>
            <p>
              As part of our Tally integration services, we may process business data including but not limited to:
            </p>
            <ul style={{ paddingLeft: '25px', marginTop: '10px' }}>
              <li>Financial records and transactions</li>
              <li>Customer and vendor information</li>
              <li>Inventory and stock data</li>
              <li>Sales and purchase orders</li>
              <li>Ledger entries and vouchers</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              3. How We Use Your Information
            </h2>
            <p>We use the collected information for the following purposes:</p>
            <ul style={{ paddingLeft: '25px', marginTop: '10px' }}>
              <li>To provide, maintain, and improve our services</li>
              <li>To process transactions and manage your account</li>
              <li>To communicate with you about your account and our services</li>
              <li>To provide customer support and respond to inquiries</li>
              <li>To detect, prevent, and address technical issues and security threats</li>
              <li>To comply with legal obligations and enforce our terms</li>
              <li>To send you updates, newsletters, and promotional materials (with your consent)</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              4. Data Storage and Security
            </h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure.
            </p>
            <p>
              Your data is stored securely and is only accessible to authorized personnel who need access to perform their duties. We use encryption, secure servers, and other industry-standard security practices to safeguard your information.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              5. Data Sharing and Disclosure
            </h2>
            <p>We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:</p>
            <ul style={{ paddingLeft: '25px', marginTop: '10px' }}>
              <li>With your explicit consent</li>
              <li>To comply with legal obligations or respond to lawful requests</li>
              <li>To protect our rights, privacy, safety, or property</li>
              <li>With service providers who assist us in operating our services (under strict confidentiality agreements)</li>
              <li>In connection with a business transfer, merger, or acquisition</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              6. Your Rights and Choices
            </h2>
            <p>You have the following rights regarding your personal information:</p>
            <ul style={{ paddingLeft: '25px', marginTop: '10px' }}>
              <li><strong>Access:</strong> Request access to your personal data</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data</li>
              <li><strong>Objection:</strong> Object to processing of your personal data</li>
              <li><strong>Portability:</strong> Request transfer of your data to another service</li>
              <li><strong>Withdrawal:</strong> Withdraw consent where processing is based on consent</li>
            </ul>
            <p style={{ marginTop: '15px' }}>
              To exercise these rights, please contact us using the information provided in the "Contact Us" section below.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              7. Cookies and Tracking Technologies
            </h2>
            <p>
              We use cookies and similar tracking technologies to track activity on our service and store certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our service.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              8. Data Retention
            </h2>
            <p>
              We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When we no longer need your information, we will securely delete or anonymize it.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              9. Children's Privacy
            </h2>
            <p>
              Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              10. Changes to This Privacy Policy
            </h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', marginBottom: '15px' }}>
              11. Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us:
            </p>
            <p style={{ marginTop: '10px' }}>
              <strong>Email:</strong> privacy@datalynkr.com<br />
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
            to="/terms-of-service"
            style={{
              color: '#3b82f6',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Terms of Service →
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

export default PrivacyPolicy;

