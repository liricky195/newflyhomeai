"use client";

import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  {
    category: "Getting Started",
    question: "What is FlyHome AI?",
    answer: "FlyHome AI is a flight monitoring and booking service for stranded travellers. You tell us your departure airport, and we continuously scan for available flights home and alert you the moment something bookable appears."
  },
  {
    category: "Getting Started",
    question: "How do I create an account?",
    answer: "Sign in using your Google account — no password required. On your first login you will be prompted to select your stranded departure airport. This is the only setup step required before monitoring begins."
  },
  {
    category: "Getting Started",
    question: "Can I change my departure airport after I've set it?",
    answer: "Yes. If you would like to change your departure airport, please email support at support@flyhome.ai."
  },
  {
    category: "Getting Started",
    question: "Do I need to pay to use FlyHome AI?",
    answer: "No. There is a Free tier that gives you access to flight monitoring at a standard scan interval. Paid tiers are available if you want more frequent scans and faster alerts."
  },
  {
    category: "Flight Monitoring",
    question: "How does flight scanner work?",
    answer: "Once you set your airport, our monitor daemon continuously polls for available flights departing from your airport. When new flights or price changes are detected, you receive an alert. The frequency of scans depends on your subscription tier."
  },
  {
    category: "Flight Monitoring",
    question: "What does countdown timer show?",
    answer: "The countdown shows how long until the next scheduled scan of your airport. When it reaches zero, a fresh scan runs automatically and the timer resets to your tier's interval."
  },
  {
    category: "Flight Monitoring",
    question: "How often does each tier scan?",
    answer: "Scan intervals vary by tier — higher tiers scan more frequently. You can see your current interval on your dashboard. Upgrading your subscription immediately updates your scan frequency."
  },
  {
    category: "Flight Monitoring",
    question: "Will I be notified for every flight?",
    answer: "You will be notified when new flights appear or when the status of a monitored flight changes. You can enable or disable email notifications from your account settings. Push notifications require browser permission."
  },
  {
    category: "Flight Monitoring",
    question: "What if no flights are available?",
    answer: "The scanner will keep running on your behalf. You will be notified as soon as a bookable flight appears. The app shows 'Scanning…' when a scan is actively in progress."
  },
  {
    category: "Subscriptions & Payments",
    question: "How do I upgrade my subscription?",
    answer: "You can upgrade from your account or dashboard page. Upgrades take effect immediately and your scan interval updates right away."
  },
  {
    category: "Subscriptions & Payments",
    question: "How do I cancel my subscription?",
    answer: "You can cancel at any time from your account settings. You will retain access to your paid tier until the end of the current billing period, after which your account reverts to Free."
  },
  {
    category: "Subscriptions & Payments",
    question: "Are refunds available?",
    answer: "Subscription fees are generally non-refundable. If you believe you have been charged in error, contact us and we will review your case."
  },
  {
    category: "Subscriptions & Payments",
    question: "Is my payment information stored securely?",
    answer: "We do not store your card details. All payment processing is handled by Stripe, which is PCI-DSS compliant. We only retain a Stripe customer reference for subscription management."
  },
  {
    category: "Account & Privacy",
    question: "What data does FlyHome AI store about me?",
    answer: "We store your name, email address, profile picture URL (from Google), your airport preferences, passenger details you provide for bookings, subscription status, booking history, and push notification tokens. See our Privacy Policy for full details."
  },
  {
    category: "Account & Privacy",
    question: "How do I delete my account?",
    answer: "Contact us and we will delete your account and associated data. Note that booking records may be retained for legal and financial compliance purposes."
  },
  {
    category: "Account & Privacy",
    question: "Does FlyHome AI sell my data?",
    answer: "No. We do not sell, rent, or share your personal data with advertisers or any third parties beyond what is necessary to operate the service (Google for login, Stripe for payments)."
  },
  {
    category: "Technical",
    question: "Which browsers are supported?",
    answer: "FlyHome AI works in all modern browsers. Push notifications require a browser that supports the Web Push API (Chrome, Edge, Firefox, Safari 16.4+)."
  },
  {
    category: "Technical",
    question: "Why am I not receiving push notifications?",
    answer: "Make sure you have granted notification permission to the site in your browser settings. Some browsers or operating systems may block notifications — check your system notification settings if alerts are not coming through."
  },
  {
    category: "Technical",
    question: "I'm getting an error signing in with Google. What should I do?",
    answer: "Try clearing your browser cache and cookies and signing in again. If the problem persists, contact us with a description of the error message you see."
  }
];

const categories = Array.from(new Set(faqData.map(item => item.category)));

export default function FAQ() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Getting Started");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const filteredItems = faqData.filter(item => item.category === selectedCategory);

  return (
    <section className="py-16 px-4 bg-navy-800">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Frequently Asked Questions</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Everything you need to know about FlyHome AI's flight monitoring and booking service
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? "bg-accent text-white"
                  : "bg-navy-700 text-slate-300 hover:bg-navy-600"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredItems.map((item, index) => {
            const globalIndex = faqData.indexOf(item);
            const isExpanded = expandedItems.has(globalIndex);

            return (
              <div
                key={globalIndex}
                className="bg-navy-900 rounded-lg border border-border overflow-hidden"
              >
                <button
                  onClick={() => toggleItem(globalIndex)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-navy-800 transition-colors"
                >
                  <span className="text-white font-medium">{item.question}</span>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                
                {isExpanded && (
                  <div className="px-6 py-4 border-t border-border">
                    <p className="text-slate-300 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contact Section */}
        <div className="mt-12 text-center">
          <div className="bg-navy-900 rounded-lg border border-border p-8">
            <h3 className="text-xl font-semibold text-white mb-3">
              Still have questions?
            </h3>
            <p className="text-slate-400 mb-6">
              Can't find what you're looking for? Reach out to us at:
            </p>
            <a
              href="mailto:support@flyhome.ai"
              className="inline-flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-lg font-medium hover:bg-accent/90 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              support@flyhome.ai
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
