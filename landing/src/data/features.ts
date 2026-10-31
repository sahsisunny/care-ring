export interface FeatureItem {
  id: string;
  icon: string;
  title: string;
  category: 'location' | 'driving' | 'privacy' | 'family' | 'dev';
  categoryLabel: string;
  badge: string;
  description: string;
  familyBenefit: string;
  specs: string[];
}

export const FEATURES_DATA: FeatureItem[] = [
  {
    id: 'radar',
    icon: 'radar',
    title: 'Live Family GPS Radar',
    category: 'location',
    categoryLabel: 'Location & Maps',
    badge: 'Real-Time Sync',
    description:
      'Watch your loved ones move smoothly on a live vector map as they walk, bike, or commute — with zero delay and no pull-to-refresh needed.',
    familyBenefit:
      'Never wonder where anyone is or send repetitive "Where are you?" texts.',
    specs: ['Sub-50ms live sync', 'Smooth fluid pin motion', 'Heading direction indicators', 'Interactive map layers'],
  },
  {
    id: 'geofences',
    icon: 'geofence',
    title: 'Unlimited Safe Places',
    category: 'location',
    categoryLabel: 'Location & Maps',
    badge: '100% Free',
    description:
      'Add unlimited safe zones (home, school, grandparents’ house, soccer practice, work) with custom radiuses and get instant arrival and departure notifications.',
    familyBenefit:
      'Get notified the exact moment your kids arrive at school or leave for home.',
    specs: ['Unlimited places (Others lock you to 2)', 'Instant arrival alerts', '50m to 2,000m radius sliders', 'Custom icons & names'],
  },
  {
    id: 'driving',
    icon: 'driving',
    title: 'Intelligent Driving Safety & Scores',
    category: 'driving',
    categoryLabel: 'Driving Safety',
    badge: 'Driver Scores',
    description:
      'Automated background trip detection calculates top speed, hard braking events, rapid accelerations, and phone distraction scores for every drive.',
    familyBenefit:
      'Helps teens and new drivers build calm, safe driving habits with friendly 0–100 scores.',
    specs: ['0–100 Driver Safety Score', 'Hard braking detection', 'Speed limit monitoring', 'Trip route summary'],
  },
  {
    id: 'crash-sos',
    icon: 'crash',
    title: 'Automatic Crash Detection & SOS',
    category: 'driving',
    categoryLabel: 'Driving Safety',
    badge: 'Life Saving',
    description:
      'High-frequency motion sensors detect severe vehicular collisions (>3.5G impact) and immediately alert your circle with exact GPS coordinates, loud audio siren, and driving directions.',
    familyBenefit:
      'Emergency help is dispatched automatically even if the driver is unconscious.',
    specs: ['Automatic crash collision detection', '10-second countdown', 'Loud emergency siren', 'Included free (No $25/mo paywall)'],
  },
  {
    id: 'ghost-mode',
    icon: 'ghost',
    title: 'Ghost Mode & Privacy Boundaries',
    category: 'privacy',
    categoryLabel: 'Privacy & Autonomy',
    badge: 'Healthy Boundaries',
    description:
      'Mutual respect and privacy control. Blur your exact coordinates to a general 500m neighborhood zone or pause sharing whenever you need personal space.',
    familyBenefit:
      'Teens and partners maintain healthy independence without awkward arguments or invasive surveillance.',
    specs: ['3 privacy levels (Precise, Blurred, Frozen)', 'No alert sent to others', 'On-device client-side blur', '1-tap uncloak'],
  },
  {
    id: 'zero-broker',
    icon: 'shield',
    title: 'Strict Zero-Data Selling Pledge',
    category: 'privacy',
    categoryLabel: 'Privacy & Autonomy',
    badge: 'MIT Open Source',
    description:
      'Commercial safety apps broker your family’s location trails to insurance companies, advertising networks, and data brokers. CareRing strictly never sells or shares your coordinates with anyone.',
    familyBenefit:
      'Your family’s location history remains strictly yours forever.',
    specs: ['Never sold to advertisers', 'No commercial data brokers', 'TLS 1.3 encrypted coordinates', 'Self-hostable backend'],
  },
  {
    id: 'battery-saver',
    icon: 'battery',
    title: 'Smart Motion Battery Preserver',
    category: 'location',
    categoryLabel: 'Location & Maps',
    badge: '< 1% Drain / Hr',
    description:
      'Smart sensor gating puts high-power GPS polling to sleep when you are stationary at home, work, or school, and wakes up immediately when vehicular driving or walking starts.',
    familyBenefit:
      'All-day battery life with zero battery anxiety.',
    specs: ['<1% battery drain per hour', 'Automatic motion sensor gating', 'Low battery alerts (<15%)', 'Battery level visible to circle'],
  },
  {
    id: 'history-replay',
    icon: 'history',
    title: '30-Day Complete Trip History',
    category: 'location',
    categoryLabel: 'Location & Maps',
    badge: 'Full Replay',
    description:
      'Review 30 days of complete driving trails, transit timelines, and historical stops. Unlike commercial apps that lock history to 2 days on their free tier.',
    familyBenefit:
      'Look back at past trips, verify arrival times, or find lost items.',
    specs: ['30 days included free', 'Turn-by-turn route replay', 'Speed timestamps', 'Instant 1-tap purge'],
  },
  {
    id: 'circle-chat',
    icon: 'chat',
    title: 'Private Circle Chat & Check-Ins',
    category: 'family',
    categoryLabel: 'Family & Chat',
    badge: 'Private & Fast',
    description:
      'Send direct family check-in messages with 1-tap coordinate pins directly inside your safety radar.',
    familyBenefit:
      'Communicate quickly with loved ones without jumping between multiple apps.',
    specs: ['Instant location check-in pins', 'Circle member chat', 'Private invite codes', 'Zero spam or public discovery'],
  },
  {
    id: 'panic-siren',
    icon: 'bell',
    title: 'One-Tap Emergency Panic Button',
    category: 'family',
    categoryLabel: 'Family & Chat',
    badge: 'Instant Alert',
    description:
      'If you feel unsafe walking at night, tap the panic button to broadcast an urgent high-priority alarm with your live coordinates to everyone in your circle.',
    familyBenefit:
      'Reassurance in your pocket when walking through dark parking lots or public transit.',
    specs: ['1-tap emergency dispatch', 'Audible alert siren', 'Live coordinates link', 'SMS fallback'],
  },
  {
    id: 'docker-cluster',
    icon: 'server',
    title: 'One-Command Self-Hosting Docker Stack',
    category: 'dev',
    categoryLabel: 'Developers',
    badge: 'Total Sovereignty',
    description:
      'For privacy enthusiasts and engineers: run your family’s private safety server on your own home lab or VPS with a single Docker Compose command.',
    familyBenefit:
      'Zero dependency on any third-party cloud. Complete data independence.',
    specs: ['PostgreSQL 16 + PostGIS 3.4', 'High-concurrency WebSockets', 'Built-in APK server switcher', 'MIT Open Source'],
  },
  {
    id: 'universal-apk',
    icon: 'smartphone',
    title: 'Universal Android APK (v1.0.5)',
    category: 'dev',
    categoryLabel: 'Developers',
    badge: 'Universal Binary',
    description:
      'Single signed APK running natively on ARM64, ARMv7, and x86_64 devices from Android 8.0 Oreo up to Android 15.',
    familyBenefit:
      'Install on any Android smartphone in seconds with zero Google Play requirement.',
    specs: ['Android 8.0 to Android 15+', 'Universal architecture support', '83.36 MB signed package', 'SHA-256 integrity verified'],
  },
];
