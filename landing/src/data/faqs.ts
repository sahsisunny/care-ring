export interface FaqItem {
  id: string;
  category: 'all' | 'start' | 'privacy' | 'battery' | 'comparison';
  question: string;
  answer: string;
}

export const FAQS: FaqItem[] = [
  {
    id: 'free',
    category: 'start',
    question: 'Is CareRing really 100% free with no monthly subscription or hidden fees?',
    answer:
      'Yes, 100% free forever. Other commercial safety apps charge $14.99 to $24.99 every month for crash detection, driving scores, and unlimited safe places. CareRing is an open-source project with zero subscriptions, zero in-app purchases, and zero feature paywalls.',
  },
  {
    id: 'install',
    category: 'start',
    question: 'How do I download and install the CareRing APK on my Android phone?',
    answer:
      'Tap the "Download for Android" button to download CareRing-latest.apk (83 MB). When prompted by Android security, open Settings and allow "Install unknown apps" for your browser, then tap "Install". It works on Android 8.0 through Android 15 with zero Google Play account required.',
  },
  {
    id: 'privacy',
    category: 'privacy',
    question: 'How does CareRing protect my family from data brokers and advertisers?',
    answer:
      'CareRing has a strict Zero-Monetization Pledge. Commercial trackers sell family location trails to insurance companies and ad brokers. CareRing never sells, monetizes, or shares your coordinates with anyone. All location updates are encrypted directly between you and your circle members.',
  },
  {
    id: 'ghost',
    category: 'privacy',
    question: 'What is Ghost Mode and how does it protect my privacy or my teen’s independence?',
    answer:
      'Ghost Mode gives everyone healthy personal boundaries. Rather than forced 24/7 surveillance, anyone can turn on Ghost Mode to blur their location to a friendly neighborhood zone (approx. 500m) or freeze their pin. Your family knows you are in the safe area without seeing your exact house address.',
  },
  {
    id: 'crash',
    category: 'privacy',
    question: 'How does automatic crash detection work if there is an accident?',
    answer:
      'CareRing uses your phone’s built-in motion sensors (accelerometer & gyroscope) to detect sudden vehicular collisions (>3.5G impact). In an accident, it sounds a loud siren and starts a 10-second countdown. If not cancelled, it immediately sends your exact GPS coordinates and directions to everyone in your circle.',
  },
  {
    id: 'battery',
    category: 'battery',
    question: 'Will running CareRing in the background drain my phone’s battery?',
    answer:
      'No. CareRing is engineered for ultra-low battery drain (<1% per hour). When you are stationary at home, school, or work, high-power GPS goes to sleep. The moment motion or vehicular driving begins, high-precision radar automatically wakes up.',
  },
  {
    id: 'geofence',
    category: 'start',
    question: 'How many safe places (like Home, School, Work) can I set up?',
    answer:
      'Unlimited! Commercial apps limit free users to just 2 places and charge $15/month for more. With CareRing, you can add unlimited safe zones (home, school, grandparents’ house, sports practice, work) and get instant arrival and departure notifications for all of them.',
  },
  {
    id: 'comparison',
    category: 'comparison',
    question: 'Why should I switch to CareRing from other apps?',
    answer:
      'Three simple reasons: First, you save $180 to $300 every year because CareRing is 100% free. Second, CareRing never sells your family location history to data brokers or insurers. Third, you get premium features included free: 30 days of trip history, unlimited safe places, crash response, and Ghost Mode.',
  },
  {
    id: 'selfhost',
    category: 'comparison',
    question: 'Can I host my own private server cluster if I am a developer?',
    answer:
      'Yes! For developers and privacy enthusiasts, CareRing provides a one-command Docker Compose stack with PostgreSQL 16, PostGIS spatial indexes, and WebSockets. The Android APK includes a built-in server switcher to point to your private server.',
  },
];
