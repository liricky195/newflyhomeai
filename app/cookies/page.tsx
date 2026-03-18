export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-navy-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Cookie Policy</h1>
          <p className="text-slate-400">Last Updated: March 18, 2026</p>
        </div>
        
        <div className="prose prose-invert max-w-none">
          <h2 className="text-3xl font-bold text-white mb-6 mt-8">1. Introduction</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            FlyHome AI uses cookies and similar technologies to enhance your experience, provide our services, and analyze usage. This Cookie Policy explains what cookies are, how we use them, and your choices regarding their use.
          </p>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">2. What Are Cookies?</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            Cookies are small text files that are stored on your device (computer, tablet, or mobile) when you visit a website. They allow the website to remember your actions and preferences over time.
          </p>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">3. How We Use Cookies</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.1 Essential Cookies</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            These cookies are necessary for our Service to function:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Authentication Cookies:</strong> Keep you logged in to your account</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Security Cookies:</strong> Prevent fraudulent activities and protect your account</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Session Cookies:</strong> Maintain your session as you navigate our Service</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Load Balancing Cookies:</strong> Distribute traffic across our servers</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.2 Functional Cookies</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            These cookies enhance your experience:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Preference Cookies:</strong> Remember your settings and choices</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Location Cookies:</strong> Store your preferred airports and destinations</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Notification Cookies:</strong> Remember your notification preferences</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Language Cookies:</strong> Remember your language preferences</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.3 Analytics Cookies</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            These cookies help us understand how our Service is used:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Google Analytics:</strong> Track user behavior and service performance</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Custom Analytics:</strong> Monitor flight search patterns and booking funnels</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Performance Cookies:</strong> Measure service speed and reliability</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>A/B Testing Cookies:</strong> Test new features and improvements</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">3.4 Marketing Cookies</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            These cookies are used for marketing purposes:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Advertising Cookies:</strong> Show relevant advertisements</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Retargeting Cookies:</strong> Display ads based on your interests</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Social Media Cookies:</strong> Enable social media sharing and integration</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Affiliate Cookies:</strong> Track referral sources for marketing partnerships</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">4. Third-Party Cookies</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            Our Service uses third-party services that may place their own cookies:
          </p>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.1 Payment Processors</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Stripe:</strong> Processes payments and may place cookies for security</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Duffel:</strong> Handles flight bookings and payment processing</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.2 Authentication Services</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>NextAuth:</strong> Manages user authentication and sessions</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Google OAuth:</strong> Enables Google account login</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.3 Analytics Services</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Google Analytics:</strong> Provides website analytics and reporting</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Vercel Analytics:</strong> Monitors performance and uptime</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">4.4 Communication Services</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Email Providers:</strong> Track email opens and clicks</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Push Notification Services:</strong> Manage device notifications</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">5. Cookie Duration</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.1 Session Cookies</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Expire when you close your browser</li>
            <li className="text-slate-300 ml-6 mb-1">Used for authentication and temporary preferences</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">5.2 Persistent Cookies</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Remain on your device for a set period</li>
            <li className="text-slate-300 ml-6 mb-1">Authentication: 30 days</li>
            <li className="text-slate-300 ml-6 mb-1">Preferences: 1 year</li>
            <li className="text-slate-300 ml-6 mb-1">Analytics: 2 years</li>
            <li className="text-slate-300 ml-6 mb-1">Marketing: Varies by provider</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">6. Managing Your Cookie Preferences</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.1 Browser Settings</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            You can control cookies through your browser settings:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Accept all cookies</strong></li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Reject all cookies</strong></li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Delete existing cookies</strong></li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Block third-party cookies</strong></li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.2 Our Cookie Consent Tool</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            When you first visit our Service, you'll see a cookie consent banner where you can:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Accept all cookies</li>
            <li className="text-slate-300 ml-6 mb-1">Reject non-essential cookies</li>
            <li className="text-slate-300 ml-6 mb-1">Customize your preferences</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">6.3 Specific Cookie Management</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>Authentication cookies:</strong> Cannot be disabled without affecting service functionality</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Essential cookies:</strong> Required for basic service operation</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Analytics cookies:</strong> Can be disabled without affecting core functionality</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Marketing cookies:</strong> Can be disabled without affecting service experience</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">7. Impact of Disabling Cookies</h2>
          
          <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.1 Essential Cookies</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            If you disable essential cookies, you may:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Be unable to log in to your account</li>
            <li className="text-slate-300 ml-6 mb-1">Experience reduced security features</li>
            <li className="text-slate-300 ml-6 mb-1">Lose your session when navigating between pages</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.2 Functional Cookies</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            If you disable functional cookies, you may:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Need to re-enter preferences each visit</li>
            <li className="text-slate-300 ml-6 mb-1">Lose personalized settings</li>
            <li className="text-slate-300 ml-6 mb-1">Experience reduced convenience</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.3 Analytics Cookies</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            If you disable analytics cookies:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Your usage won't be tracked for analytics</li>
            <li className="text-slate-300 ml-6 mb-1">Service improvements may be slower</li>
            <li className="text-slate-300 ml-6 mb-1">We won't receive usage statistics</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">7.4 Marketing Cookies</h3>
          <p className="text-slate-300 mb-4 leading-relaxed">
            If you disable marketing cookies:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">You may see less relevant advertisements</li>
            <li className="text-slate-300 ml-6 mb-1">Some social media features may not work</li>
            <li className="text-slate-300 ml-6 mb-1">Personalized content may be reduced</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">8. Local Storage and Similar Technologies</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            In addition to cookies, we use:
          </p>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.1 Local Storage</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Stores flight monitoring preferences</li>
            <li className="text-slate-300 ml-6 mb-1">Caches flight data for offline viewing</li>
            <li className="text-slate-300 ml-6 mb-1">Remembers your search history</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.2 Session Storage</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Maintains temporary session data</li>
            <li className="text-slate-300 ml-6 mb-1">Stores form inputs during multi-step processes</li>
            <li className="text-slate-300 ml-6 mb-1">Remembers pagination state</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-4">8.3 IndexedDB</h3>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1">Caches large datasets for performance</li>
            <li className="text-slate-300 ml-6 mb-1">Stores offline flight information</li>
            <li className="text-slate-300 ml-6 mb-1">Enables background synchronization</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">9. Cookie Security</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            We implement security measures to protect cookie data:
          </p>
          <ul className="list-disc mb-4">
            <li className="text-slate-300 ml-6 mb-1"><strong>HTTPS Encryption:</strong> All cookies are transmitted securely</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>HttpOnly Flag:</strong> Sensitive cookies cannot be accessed via JavaScript</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>SameSite Attribute:</strong> Prevents cross-site request forgery</li>
            <li className="text-slate-300 ml-6 mb-1"><strong>Secure Attribute:</strong> Ensures cookies are only sent over HTTPS</li>
          </ul>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">10. International Data Transfers</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            Some cookies may transfer data to countries outside your own. We ensure appropriate safeguards are in place for international data transfers.
          </p>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">11. Updates to This Policy</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            We may update this Cookie Policy from time to time to reflect changes in our practices or applicable law. We will notify you of significant changes by email or prominent notice on our website.
          </p>

          <h2 className="text-3xl font-bold text-white mb-6 mt-8">12. Contact Us</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            If you have questions about this Cookie Policy or our use of cookies, please contact us:
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
            If you have questions about this Cookie Policy, please contact us at{" "}
            <a href="mailto:support@flyhome.ai" className="text-accent hover:underline">
              support@flyhome.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
