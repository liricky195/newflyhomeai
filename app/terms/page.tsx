export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-navy-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-slate-400">Last Updated: March 18, 2026</p>
        </div>
        
        <div className="prose prose-invert max-w-none">
          <h2 className="text-3xl font-bold text-white mb-6 mt-8">1. Agreement to Terms</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            {"By accessing and using FlyHome AI (\"Service\"), you agree to be bound by these Terms of Service (\"Terms\"). If you do not agree to these Terms, please do not use our Service."}
          </p>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">2. Description of Service</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            FlyHome AI is a flight monitoring and booking service that:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Monitors flights from your selected airports</li>
            <li className="text-slate-300 ml-6 mb-1">Sends notifications about price changes and new flights</li>
            <li className="text-slate-300 ml-6 mb-1">Facilitates flight bookings through third-party providers</li>
            <li className="text-slate-300 ml-6 mb-1">Provides travel-related information and recommendations</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">3. User Accounts</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.1 Account Registration</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">You must provide accurate and complete information</li>
            <li className="text-slate-300 ml-6 mb-1">You are responsible for maintaining the confidentiality of your account</li>
            <li className="text-slate-300 ml-6 mb-1">You must be at least 16 years old to use our Service</li>
            <li className="text-slate-300 ml-6 mb-1">One account per person is permitted</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.2 Account Responsibilities</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Keep your login credentials secure</li>
            <li className="text-slate-300 ml-6 mb-1">Update your information when it changes</li>
            <li className="text-slate-300 ml-6 mb-1">Notify us immediately of unauthorized use</li>
            <li className="text-slate-300 ml-6 mb-1">Comply with all applicable laws</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">4. Service Fees and Payments</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.1 Subscription Plans</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Free Plan:</strong> Basic flight monitoring with limited features</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Standard Plan:</strong> Enhanced monitoring and notifications</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Pro Plan:</strong> Advanced features and priority support</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Ultimate Plan:</strong> All features with premium support</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.2 Payment Terms</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Subscription fees are charged monthly or annually</li>
            <li className="text-slate-300 ml-6 mb-1">Payments are processed through Stripe</li>
            <li className="text-slate-300 ml-6 mb-1">Prices are subject to change with 30 days notice</li>
            <li className="text-slate-300 ml-6 mb-1">No refunds for partial months of service</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.3 Flight Bookings</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Flight bookings are processed through Duffel</li>
            <li className="text-slate-300 ml-6 mb-1">We do not charge additional fees on flight bookings</li>
            <li className="text-slate-300 ml-6 mb-1">Airline terms and conditions apply to all bookings</li>
            <li className="text-slate-300 ml-6 mb-1">Payment processing fees may apply</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">5. Flight Monitoring and Notifications</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.1 Monitoring Service</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">We monitor flights from your selected airports</li>
            <li className="text-slate-300 ml-6 mb-1">Flight data is provided by third-party sources</li>
            <li className="text-slate-300 ml-6 mb-1">We strive for accuracy but cannot guarantee 100% reliability</li>
            <li className="text-slate-300 ml-6 mb-1">Monitoring frequency depends on your subscription plan</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.2 Notifications</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Notifications are sent via email and/or push notifications</li>
            <li className="text-slate-300 ml-6 mb-1">Delivery timing depends on external factors beyond our control</li>
            <li className="text-slate-300 ml-6 mb-1">We are not responsible for missed notifications</li>
            <li className="text-slate-300 ml-6 mb-1">Notification preferences can be managed in your account</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">6. Flight Bookings</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.1 Booking Process</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">We facilitate bookings through Duffel, a third-party provider</li>
            <li className="text-slate-300 ml-6 mb-1">Booking terms are governed by Duffel and airline policies</li>
            <li className="text-slate-300 ml-6 mb-1">We are not responsible for airline decisions or policies</li>
            <li className="text-slate-300 ml-6 mb-1">Booking confirmation is provided by the airline</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.2 Booking Responsibilities</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Ensure all passenger information is accurate</li>
            <li className="text-slate-300 ml-6 mb-1">Comply with airline booking requirements</li>
            <li className="text-slate-300 ml-6 mb-1">Provide valid travel documents</li>
            <li className="text-slate-300 ml-6 mb-1">Pay applicable taxes and fees</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.3 Cancellations and Refunds</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Cancellation policies vary by airline and fare type</li>
            <li className="text-slate-300 ml-6 mb-1">Refunds are subject to airline terms and conditions</li>
            <li className="text-slate-300 ml-6 mb-1">We assist with cancellation requests but cannot guarantee outcomes</li>
            <li className="text-slate-300 ml-6 mb-1">Processing fees may apply to cancellations</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">7. User Conduct</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.1 Prohibited Activities</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            You may not:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Use the Service for illegal purposes</li>
            <li className="text-slate-300 ml-6 mb-1">Attempt to gain unauthorized access to our systems</li>
            <li className="text-slate-300 ml-6 mb-1">Interfere with or disrupt the Service</li>
            <li className="text-slate-300 ml-6 mb-1">Use automated tools to access the Service</li>
            <li className="text-slate-300 ml-6 mb-1">Reverse engineer or attempt to extract source code</li>
            <li className="text-slate-300 ml-6 mb-1">Use the Service to harass or harm others</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.2 Content</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">You retain rights to content you provide</li>
            <li className="text-slate-300 ml-6 mb-1">You grant us license to use content for Service operation</li>
            <li className="text-slate-300 ml-6 mb-1">Do not upload malicious or harmful content</li>
            <li className="text-slate-300 ml-6 mb-1">Respect intellectual property rights of others</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">8. Intellectual Property</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.1 Our Rights</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">The Service and its content are owned by FlyHome AI</li>
            <li className="text-slate-300 ml-6 mb-1">Our trademarks, logos, and service marks are protected</li>
            <li className="text-slate-300 ml-6 mb-1">You may not use our intellectual property without permission</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.2 Third-Party Content</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Some content is provided by third parties</li>
            <li className="text-slate-300 ml-6 mb-1">Third-party content is protected by their respective owners</li>
            <li className="text-slate-300 ml-6 mb-1">We do not claim ownership of third-party content</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">9. Privacy and Data</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.1 Data Collection</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">We collect information as described in our Privacy Policy</li>
            <li className="text-slate-300 ml-6 mb-1">Your data is used to provide and improve our Service</li>
            <li className="text-slate-300 ml-6 mb-1">We protect your data in accordance with applicable laws</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">9.2 Data Security</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">We implement reasonable security measures</li>
            <li className="text-slate-300 ml-6 mb-1">We cannot guarantee absolute security</li>
            <li className="text-slate-300 ml-6 mb-1">You are responsible for your account security</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">10. Disclaimers and Limitations</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">10.1 Service Availability</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">{"The Service is provided \"as is\" and \"as available\""}</li>
            <li className="text-slate-300 ml-6 mb-1">We do not guarantee uninterrupted or error-free service</li>
            <li className="text-slate-300 ml-6 mb-1">We may suspend or terminate the Service for maintenance</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">10.2 Flight Information</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Flight data is provided by third parties</li>
            <li className="text-slate-300 ml-6 mb-1">We do not guarantee flight information accuracy</li>
            <li className="text-slate-300 ml-6 mb-1">Flight schedules and prices are subject to change</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">10.3 Limitation of Liability</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Our liability is limited to the amount you paid for the Service</li>
            <li className="text-slate-300 ml-6 mb-1">We are not liable for indirect, incidental, or consequential damages</li>
            <li className="text-slate-300 ml-6 mb-1">We are not liable for airline decisions or flight disruptions</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">11. Indemnification</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            You agree to indemnify and hold us harmless from:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Your use of the Service</li>
            <li className="text-slate-300 ml-6 mb-1">Your violation of these Terms</li>
            <li className="text-slate-300 ml-6 mb-1">Your violation of any rights of another</li>
            <li className="text-slate-300 ml-6 mb-1">Any claims arising from your flight bookings</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">12. Termination</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">12.1 Termination by You</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">You may terminate your account at any time</li>
            <li className="text-slate-300 ml-6 mb-1">No refunds for partial subscription periods</li>
            <li className="text-slate-300 ml-6 mb-1">Your data will be deleted upon request</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">12.2 Termination by Us</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">We may terminate accounts for violations</li>
            <li className="text-slate-300 ml-6 mb-1">We may suspend access for security reasons</li>
            <li className="text-slate-300 ml-6 mb-1">We may discontinue the Service with reasonable notice</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">13. Dispute Resolution</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">13.1 Governing Law</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            These Terms are governed by the laws of Hong Kong.
          </p>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">13.2 Dispute Resolution</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">We will attempt to resolve disputes informally</li>
            <li className="text-slate-300 ml-6 mb-1">Unresolved disputes may be subject to arbitration</li>
            <li className="text-slate-300 ml-6 mb-1">Class action waivers apply to all disputes</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">14. Changes to Terms</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            We may update these Terms from time to time. We will notify you of significant changes by email or prominent notice on our website.
          </p>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">15. Contact Information</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            For questions about these Terms, please contact us:
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
            If you have questions about these Terms of Service, please contact us at
            <a href="mailto:support@flyhome.ai" className="text-accent hover:underline">
              support@flyhome.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
