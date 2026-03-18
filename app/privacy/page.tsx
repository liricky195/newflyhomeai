export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-navy-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-slate-400">Last Updated: March 18, 2026</p>
        </div>
        
        <div className="prose prose-invert max-w-none">
          <h2 className="text-3xl font-bold text-white mb-6 mt-8">1. Introduction</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            {"FlyHome AI (\"we,\" \"our,\" or \"us\") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our flight monitoring and booking service."}
          </p>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">2. Information We Collect</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.1 Personal Information</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Email Address:</strong> Required for account creation and email notifications</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Name:</strong> Display name and booking information</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Phone Number:</strong> Optional, for flight booking notifications</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Date of Birth:</strong> Required for flight bookings</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Nationality &amp; Passport Information:</strong> Required for international flight bookings</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Payment Information:</strong> Processed securely through Stripe and Duffel (we never store card details)</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.2 Flight Monitoring Data</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Monitored Airports:</strong> Your preferred departure airports</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Destination Preferences:</strong> Your preferred destination airports</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Price Alerts:</strong> Minimum price thresholds for notifications</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">2.3 Technical Data</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>IP Address:</strong> For security and regional functionality</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Browser & Device Information:</strong> For service optimization</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Usage Data:</strong> How you interact with our service</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Cookies & Local Storage:</strong> For authentication and preferences</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">3. How We Use Your Information</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.1 Service Provision</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Monitor flights from your selected airports</li>
            <li className="text-slate-300 ml-6 mb-1">Send notifications about price changes and new flights</li>
            <li className="text-slate-300 ml-6 mb-1">Process flight bookings through Duffel</li>
            <li className="text-slate-300 ml-6 mb-1">Provide customer support</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.2 Communication</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Send flight alerts and booking confirmations</li>
            <li className="text-slate-300 ml-6 mb-1">Provide service updates and security notifications</li>
            <li className="text-slate-300 ml-6 mb-1">Respond to your inquiries and support requests</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.3 Service Improvement</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Analyze usage patterns to improve our service</li>
            <li className="text-slate-300 ml-6 mb-1">Conduct security monitoring and fraud prevention</li>
            <li className="text-slate-300 ml-6 mb-1">Optimize flight search algorithms</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">4. Data Sharing & Third Parties</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.1 Flight Booking Partners</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Duffel:</strong> Processes flight bookings and payments</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Airlines:</strong> Receive booking information for ticket issuance</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Stripe:</strong> Processes payment transactions</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.2 Service Providers</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Email Service:</strong> Sends notifications and confirmations</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Push Notification Services:</strong> Delivers real-time alerts</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Analytics Providers:</strong> Help us understand service usage</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.3 Legal Requirements</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            We may share your information when required by law, court order, or to protect our rights and safety.
          </p>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">5. Data Security</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            We implement industry-standard security measures:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Encryption:</strong> Data is encrypted in transit and at rest</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Access Control:</strong> Limited access to personal information</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Regular Security Audits:</strong> Ongoing security assessments</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Secure Authentication:</strong> Multi-factor authentication available</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">6. Data Retention</h2>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Account Information:</strong> Retained while your account is active</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Booking Data:</strong> Retained for 7 years (legal requirement)</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Flight Monitoring Data:</strong> Retained until you delete your account</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Technical Logs:</strong> Retained for 90 days for security purposes</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">7. Your Rights</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.1 Access & Correction</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">View your personal information in your account dashboard</li>
            <li className="text-slate-300 ml-6 mb-1">Update your profile information at any time</li>
            <li className="text-slate-300 ml-6 mb-1">Request deletion of your account and associated data</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.2 Data Portability</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Export your booking history and monitoring preferences</li>
            <li className="text-slate-300 ml-6 mb-1">Transfer your data to other services where technically feasible</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.3 Marketing Preferences</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Opt out of marketing emails at any time</li>
            <li className="text-slate-300 ml-6 mb-1">Manage notification preferences in your account settings</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">8. Cookies & Tracking</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.1 Essential Cookies</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Authentication:</strong> Keep you logged in</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Security:</strong> Prevent fraudulent activities</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Preferences:</strong> Remember your settings</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.2 Analytics Cookies</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Usage Analytics:</strong> Understand how our service is used</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Performance:</strong> Monitor and improve service speed</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>A/B Testing:</strong> Test new features and improvements</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.3 Marketing Cookies</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Personalization:</strong> Show relevant content</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Retargeting:</strong> Display relevant advertisements</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">9. International Data Transfers</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            Your information may be transferred to and processed in countries outside your own. We ensure appropriate safeguards are in place for international data transfers.
          </p>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">{"10. Children's Privacy"}</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            Our service is not intended for children under 16. We do not knowingly collect information from children under 16.
          </p>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">11. Changes to This Policy</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of significant changes by email or prominent notice on our website.
          </p>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">12. Contact Us</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            If you have questions about this Privacy Policy or your data rights, please contact us:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Email:</strong> support@flyhome.ai</li>
          </ul>

          <hr className="border-border my-8" />
          
          <p className="text-slate-400 text-sm">
            <strong>Effective Date:</strong> March 18, 2026
          </p>
        </div>
        
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-slate-400 text-sm">
            If you have questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:support@flyhome.ai" className="text-accent hover:underline">
              support@flyhome.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
