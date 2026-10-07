Build and integrate a production-ready “Driving Safety Detection Engine” into our existing family/circle location-sharing application.

IMPORTANT:
This is an ADD-ON to the existing Smart Activity Detection system.

Do NOT replace or rewrite the existing activity detection engine.

The existing application already detects activities such as:

- STATIONARY
- WALKING
- RUNNING
- CYCLING
- DRIVING
- RIDING
- UNKNOWN

The new system should detect potentially unsafe driving/riding events while the user is travelling.

Supported safety events:

1. RAPID_ACCELERATION
2. HARD_BRAKING
3. HARSH_CORNERING
4. OVERSPEEDING
5. POSSIBLE_DISTRACTED_DRIVING

The system must prioritize accuracy and avoid false positives.

==================================================
1. FIRST INSPECT THE EXISTING PROJECT
==================================================

Before writing code, inspect the complete existing project.

Identify:

- React Native version
- iOS implementation
- Android implementation
- Existing location tracking
- Existing activity detection engine
- GPS/location provider
- Accelerometer implementation
- Gyroscope implementation
- Device motion implementation
- Background tracking
- Permissions
- State management
- Backend APIs
- Database
- WebSocket/realtime implementation
- Family/circle/member model
- Existing notification system
- Existing map implementation
- Existing driving/activity UI

Do NOT duplicate functionality that already exists.

Reuse the existing location and sensor infrastructure wherever possible.

If the existing activity engine already calculates:

- speed
- acceleration
- heading
- movement state
- GPS accuracy

reuse those values instead of recalculating them.

==================================================
2. CORE ARCHITECTURE
==================================================

Create a separate safety detection layer.

Recommended architecture:

safety/
├── SafetyDetectionEngine
├── AccelerationDetector
├── BrakingDetector
├── CorneringDetector
├── OverspeedDetector
├── DistractionDetector
├── SafetyEventStateMachine
├── SafetyEventManager
├── SafetyEventScorer
├── SafetyConfig
├── SafetyLogger
├── types
└── utils

Architecture:

Location Sensors
        +
Motion Sensors
        +
Existing Activity Detection
        +
Vehicle Context
        ↓
Safety Detection Engine
        ↓
Feature Extraction
        ↓
Event Detection
        ↓
Confidence Validation
        ↓
Deduplication / Cooldown
        ↓
Confirmed Safety Event
        ↓
Local UI
        ↓
Backend / Realtime
        ↓
Family Members

==================================================
3. CRITICAL RULE
==================================================

DO NOT detect safety events using a single GPS reading.

GPS can contain:

- speed spikes
- inaccurate acceleration
- location jumps
- heading jumps
- delayed updates

Therefore every event must use multiple data points over time.

Prefer:

GPS
+
Accelerometer
+
Gyroscope
+
GPS accuracy
+
Speed history
+
Heading history
+
Existing activity state
+
Temporal validation

when those signals are available.

==================================================
4. RAPID ACCELERATION
==================================================

Detect unusually rapid acceleration during:

DRIVING
or
RIDING

Do NOT simply use:

speed > X

Instead calculate acceleration from speed/time history.

Example:

previous speed:
20 km/h

current speed:
45 km/h

time:
2 seconds

Calculate:

acceleration = Δspeed / Δtime

Also compare with accelerometer data when available.

Example:

20 km/h
→ 25
→ 32
→ 40
→ 45 km/h

If acceleration remains unusually high for a short duration and sensor signals agree:

Generate:

RAPID_ACCELERATION

Event:

{
  type: "RAPID_ACCELERATION",
  severity: "MEDIUM",
  confidence: 0.89,
  timestamp: "...",
  speedBefore: 20,
  speedAfter: 45,
  acceleration: "...",
  duration: "...",
  sourceSignals: [
    "GPS",
    "ACCELEROMETER"
  ]
}

Do not trigger from one noisy GPS point.

==================================================
5. HARD BRAKING
==================================================

Detect sudden deceleration.

Example:

60 km/h
→ 52
→ 40
→ 25
→ 10
→ 0

within a short period.

Calculate deceleration using:

Δspeed / Δtime

Also use accelerometer data where available.

The event should require:

- meaningful speed before braking
- significant negative acceleration
- sustained evidence across multiple samples
- acceptable GPS accuracy
- sensor agreement when available

Generate:

HARD_BRAKING

Example:

{
  type: "HARD_BRAKING",
  severity: "HIGH",
  confidence: 0.94,
  speedBefore: 62,
  speedAfter: 18,
  duration: 2.1,
  sourceSignals: [
    "GPS",
    "ACCELEROMETER"
  ]
}

Do not trigger when:

5 km/h
→ 0 km/h

because that is normal stopping.

==================================================
6. HARSH CORNERING
==================================================

Detect potentially aggressive cornering.

Use:

- GPS heading
- heading change rate
- speed
- accelerometer
- gyroscope
- lateral acceleration where available

Calculate:

heading change / time

Example:

Heading:

120°
→ 135°
→ 160°
→ 185°

while travelling at meaningful speed.

Combine heading change with speed and lateral motion.

Do NOT trigger simply because heading changed.

Normal turns should NOT be classified as harsh cornering.

Example:

Slow turn at 10 km/h:

Do not trigger.

Fast aggressive turn:

Potentially trigger:

HARSH_CORNERING

Example event:

{
  type: "HARSH_CORNERING",
  severity: "MEDIUM",
  confidence: 0.86,
  speed: 52,
  headingChange: 48,
  duration: 1.8,
  sourceSignals: [
    "GPS",
    "GYROSCOPE",
    "ACCELEROMETER"
  ]
}

==================================================
7. OVERSPEEDING
==================================================

Overspeeding should NOT simply mean:

speed > 60 km/h

Speed limits are contextual.

The system should support configurable speed limits.

Possible sources:

1. Road speed limit data
2. Map provider speed-limit information
3. User-configured speed limit
4. Fallback configured threshold

Architecture:

currentSpeed
+
roadSpeedLimit
+
GPS accuracy
+
sustained duration
=
overspeed confidence

Do NOT trigger because of a single GPS spike.

Example:

Road speed limit:

60 km/h

Current speed:

72 km/h

If the speed remains above the limit for the configured duration:

Generate:

OVERSPEEDING

Example:

{
  type: "OVERSPEEDING",
  severity: "MEDIUM",
  confidence: 0.91,
  currentSpeed: 73,
  speedLimit: 60,
  excessSpeed: 13,
  duration: 18,
  sourceSignals: [
    "GPS",
    "ROAD_SPEED_LIMIT"
  ]
}

Use a tolerance buffer.

For example:

speed limit = 60

Do not trigger immediately at:

61

Allow configurable tolerance:

OVERSPEED_TOLERANCE_KMH

Also use:

OVERSPEED_CONFIRMATION_MS

==================================================
8. POSSIBLE DISTRACTED DRIVING
==================================================

IMPORTANT:

Do NOT claim that the application can definitively determine that someone is distracted.

We can only detect signals suggesting possible distraction.

Use wording such as:

"Possible distracted driving"

rather than:

"Driver is distracted"

Potential signals may include:

- phone movement
- frequent screen interaction
- device orientation changes
- unusual phone handling
- driving state + active screen interaction
- device motion inconsistent with normal mounted navigation
- prolonged interaction with the phone while moving

Where supported, detect:

screen interaction while driving.

However:

Do NOT continuously record:

- camera
- microphone
- private user content

Do not inspect message content.

Do not record keystrokes.

Do not implement invasive surveillance.

Privacy is critical.

If reliable signals are unavailable:

return:

UNKNOWN / NOT_AVAILABLE

rather than guessing.

==================================================
9. DISTRACTION CONFIDENCE
==================================================

Create a confidence-based model.

Example:

Driving detected:
0.95

Phone interaction detected:
0.88

Repeated interaction:
0.91

Duration:
25 seconds

Result:

POSSIBLE_DISTRACTED_DRIVING
confidence = 0.90

But:

Driving detected:
0.60

Phone interaction:
0.40

Result:

No event.

Do not create false accusations.

==================================================
10. VEHICLE CONTEXT
==================================================

Safety detection should only run for:

DRIVING
or
RIDING

from the existing activity detection engine.

Do NOT generate:

HARD_BRAKING

for:

WALKING
RUNNING
CYCLING

unless there is an explicit reason to support it.

Example:

Current activity:

WALKING

Acceleration spike:

Ignore driving safety event.

Current activity:

DRIVING

Acceleration spike:

Evaluate RAPID_ACCELERATION.

==================================================
11. TEMPORAL VALIDATION
==================================================

Every safety event must use temporal validation.

Do not trigger from one sample.

Example:

Bad:

speed = 90

Immediately:

OVERSPEEDING

Correct:

speed:

72
75
78
81
83
85

for configured duration.

Then:

OVERSPEEDING

Similarly:

Do not trigger HARD_BRAKING from one GPS speed drop.

Require multiple samples and/or accelerometer confirmation.

==================================================
12. CONFIDENCE SCORING
==================================================

Create a generic scoring engine.

Example:

SafetyEventPrediction:

{
  type,
  confidence,
  severity,
  timestamp,
  evidence,
  sourceSignals
}

Possible confidence inputs:

- GPS quality
- sensor agreement
- event magnitude
- duration
- previous activity
- sampling consistency
- speed history
- accelerometer
- gyroscope
- heading
- road speed limit

Example:

confidence =

GPS reliability
+
motion sensor agreement
+
event magnitude
+
temporal consistency
+
activity confidence

Normalize to:

0.0 – 1.0

==================================================
13. EVENT SEVERITY
==================================================

Use:

LOW
MEDIUM
HIGH
CRITICAL

Example:

Rapid acceleration:
LOW / MEDIUM

Hard braking:
MEDIUM / HIGH

Harsh cornering:
MEDIUM / HIGH

Overspeeding:
MEDIUM / HIGH

Possible distracted driving:
HIGH

Severity should depend on magnitude and confidence.

==================================================
14. EVENT DEDUPLICATION
==================================================

Do NOT generate the same event repeatedly.

Example:

Hard braking detected.

Do not generate:

Hard braking
Hard braking
Hard braking
Hard braking

every second.

Implement cooldown.

Example:

HARD_BRAKING_COOLDOWN_MS

During cooldown:

ignore duplicate events unless the new event is significantly more severe.

==================================================
15. EVENT STATE MACHINE
==================================================

Implement:

NORMAL
↓
POTENTIAL_EVENT
↓
VALIDATING
↓
CONFIRMED_EVENT
↓
COOLDOWN
↓
NORMAL

Example:

speed rapidly decreases

↓

POTENTIAL_HARD_BRAKING

↓

validate GPS + accelerometer

↓

confidence > threshold

↓

HARD_BRAKING

↓

cooldown

↓

NORMAL

==================================================
16. BATTERY OPTIMIZATION
==================================================

Do not continuously run every sensor at maximum frequency.

Reuse existing activity detection sensor infrastructure.

Use adaptive sampling.

When:

STATIONARY

→ low-power mode

When:

DRIVING/RIDING

→ safety monitoring active

When:

potential event detected

→ temporarily increase sampling

After event:

→ return to normal sampling

==================================================
17. BACKGROUND OPERATION
==================================================

The safety engine must work when the app is in the background, subject to platform restrictions and permissions.

Android:

- Foreground Service where required
- Activity Recognition
- Fused Location Provider
- SensorManager

iOS:

- Core Location
- Core Motion
- background location capabilities
- appropriate background execution mechanisms

Do not implement fake background tracking.

Respect OS battery and privacy restrictions.

==================================================
18. LOCAL-FIRST PROCESSING
==================================================

Perform safety event detection primarily on-device.

Do not continuously upload:

- accelerometer streams
- gyroscope streams
- raw sensor data

Instead send confirmed events.

Example:

{
  userId,
  type: "HARD_BRAKING",
  severity: "HIGH",
  confidence: 0.94,
  timestamp,
  latitude,
  longitude,
  speed,
  metadata
}

==================================================
19. BACKEND MODEL
==================================================

Create:

SafetyEvent

Example:

{
  id,
  userId,
  type,
  severity,
  confidence,
  timestamp,
  latitude,
  longitude,
  speed,
  acceleration,
  duration,
  metadata,
  createdAt
}

Do not store every sensor sample.

Store meaningful safety events.

==================================================
20. REALTIME FAMILY NOTIFICATION
==================================================

When a confirmed HIGH or CRITICAL safety event occurs:

Mobile
↓
Safety Detection Engine
↓
Confirmed Event
↓
Backend
↓
Realtime/WebSocket
↓
Family Members

Example:

"Sunny experienced hard braking."

or:

"Sunny is travelling above the detected speed limit."

For MEDIUM/LOW events, do not necessarily notify the entire family immediately.

Use configurable notification rules.

==================================================
21. FAMILY UI
==================================================

On the family map/member card, optionally show:

Sunny
🏍️ Riding
🟢 Safe

If a recent event occurred:

Sunny
🏍️ Riding
⚠️ Hard braking detected

For overspeeding:

Sunny
🏍️ Riding
⚠️ Above speed limit

For possible distraction:

Sunny
🏍️ Riding
⚠️ Possible distraction

Do not make the UI alarming for every minor event.

==================================================
22. SAFETY SUMMARY
==================================================

Create a safety summary screen.

Example:

Today's Driving

Distance:
84 km

Driving Time:
2h 14m

Safety Score:
82/100

Events:

⚠️ 2 Hard Braking
⚠️ 1 Rapid Acceleration
⚠️ 3 Overspeeding
⚠️ 0 Harsh Cornering
⚠️ 0 Possible Distraction

The scoring algorithm should be configurable.

Do not pretend the score is scientifically validated.

Clearly treat it as an internal safety metric.

==================================================
23. SAFETY SCORE
==================================================

Create a configurable scoring system.

Start with a transparent rule-based model.

Example:

Base score:
100

Subtract points for confirmed events.

Hard braking:
-5

Rapid acceleration:
-3

Harsh cornering:
-4

Overspeeding:
-3 to -10 depending on severity/duration

Possible distracted driving:
-10

Do not blindly apply penalties.

Severity and frequency should influence the score.

Make the rules configurable.

==================================================
24. PRIVACY
==================================================

This feature deals with sensitive behavioural information.

Implement:

- explicit consent
- clear safety settings
- ability to disable safety detection
- ability to disable family notifications
- secure API
- authenticated access
- authorization per family/circle
- minimal data retention

Never secretly monitor:

- messages
- keyboard input
- private screen content
- microphone
- camera

unless a separate explicit product feature and permission exists.

==================================================
25. DEBUG MODE
==================================================

Create a developer-only debug screen.

Display:

Current Activity:
DRIVING

Activity Confidence:
94%

Speed:
72 km/h

GPS Accuracy:
7m

Acceleration:
2.4 m/s²

Heading:
124°

Heading Change:
32°

Road Speed Limit:
60 km/h

Overspeed Confidence:
91%

Hard Braking:
No

Rapid Acceleration:
No

Harsh Cornering:
Potential

Possible Distraction:
No

Current Safety State:
VALIDATING

This is required for real-world testing.

==================================================
26. LOGGING
==================================================

Create structured debug logs.

Example:

[SafetyDetection]

activity=DRIVING
speed=72
gpsAccuracy=8
acceleration=1.2
roadLimit=60

candidate=OVERSPEEDING
confidence=0.87

action=VALIDATING

Reason:

speed sustained above configured tolerance.

Production logging must be lightweight.

==================================================
27. TEST CASES
==================================================

Implement automated tests.

TEST 1 — Rapid Acceleration

20 km/h
→ 30
→ 45
→ 60

Expected:

RAPID_ACCELERATION

provided acceleration exceeds configured threshold.

-----------------------------------

TEST 2 — Normal Acceleration

20
→ 25
→ 30
→ 35

Expected:

No event.

-----------------------------------

TEST 3 — Hard Braking

80
→ 65
→ 45
→ 25
→ 10

within short duration.

Expected:

HARD_BRAKING

-----------------------------------

TEST 4 — Normal Braking

50
→ 45
→ 40
→ 35

Expected:

No hard-braking event.

-----------------------------------

TEST 5 — Harsh Cornering

High speed
+
large heading change
+
lateral acceleration

Expected:

HARSH_CORNERING

-----------------------------------

TEST 6 — Normal Corner

Low speed
+
normal heading change

Expected:

No event.

-----------------------------------

TEST 7 — Overspeeding

Road limit:
60 km/h

Speed:

70
72
74
76
75

sustained for configured duration.

Expected:

OVERSPEEDING

-----------------------------------

TEST 8 — GPS Spike

Speed:

50
→ 150
→ 48
→ 52

Expected:

No overspeeding event.

-----------------------------------

TEST 9 — Traffic

DRIVING

35
→ 10
→ 3
→ 0
→ 5
→ 15

Expected:

No hard-braking event unless actual deceleration exceeds threshold.

Activity remains:

DRIVING

-----------------------------------

TEST 10 — Phone Interaction

DRIVING
+
repeated phone interaction
+
sustained movement

Expected:

POSSIBLE_DISTRACTED_DRIVING

only if supported by available signals.

-----------------------------------

TEST 11 — Walking

WALKING
+
large acceleration

Expected:

No driving safety event.

-----------------------------------

TEST 12 — Event Deduplication

One hard braking event.

Expected:

Only one event.

No repeated event every second.

==================================================
28. REAL-WORLD TESTING
==================================================

Create a manual testing checklist.

Test:

1. Start driving slowly.
2. Accelerate normally.
3. Accelerate aggressively.
4. Brake normally.
5. Brake hard in a safe controlled environment.
6. Take normal turns.
7. Take controlled sharper turns where safe.
8. Drive above configured speed limit where legally and safely appropriate.
9. Stop in traffic.
10. Start again.
11. Test poor GPS conditions.
12. Test background mode.
13. Test battery saver.
14. Test network loss.
15. Test permission denial.

IMPORTANT:

Never instruct the developer/tester to intentionally drive dangerously on public roads.

Use a controlled/private environment or recorded sensor datasets for aggressive driving scenarios.

==================================================
29. RECORDED SENSOR DATA / REPLAY
==================================================

Create a replay/test interface if practical.

Allow developers to feed recorded:

- GPS points
- speed
- timestamps
- accelerometer
- gyroscope
- heading

into the SafetyDetectionEngine.

This will allow testing without physically performing dangerous manoeuvres.

Example:

SensorReplay → SafetyDetectionEngine → Events

==================================================
30. CODE QUALITY
==================================================

Follow the existing project's coding standards.

Requirements:

- Strong TypeScript typing
- No unnecessary `any`
- Modular architecture
- Unit-testable services
- No safety logic inside UI components
- Centralized configuration
- No duplicated sensor processing
- Clear error handling
- Good naming
- Minimal comments
- Comments only for non-obvious logic

==================================================
31. IMPORTANT LIMITATIONS
==================================================

Do NOT claim:

"Driver is definitely distracted."

Instead:

"Possible distracted driving."

Do NOT claim:

"Driver is definitely speeding."

Use:

"Overspeeding detected based on available speed-limit data."

Do NOT claim:

"Hard braking means dangerous driving."

It may be legitimate braking.

The system detects potentially unsafe driving events, not intent.

==================================================
32. FINAL DELIVERABLES
==================================================

After implementation provide:

1. Architecture overview
2. Existing code reused
3. New files created
4. Files modified
5. Dependencies added
6. Android changes
7. iOS changes
8. Permission changes
9. Backend changes
10. Database changes
11. Realtime changes
12. Safety state machine
13. Detection algorithms
14. Threshold configuration
15. Battery strategy
16. Privacy strategy
17. Unit tests
18. Integration tests
19. Sensor replay tests
20. Manual testing instructions
21. Known limitations
22. Future improvements

==================================================
33. MOST IMPORTANT RULES
==================================================

DO NOT build simple rules like:

if speed > 60:
    overspeeding

if speed drops by 20:
    hard braking

if heading changes:
    harsh cornering

These simplistic rules will produce false positives.

Instead use:

Sensor Fusion
+
Temporal History
+
GPS Quality
+
Motion Sensors
+
Existing Activity Detection
+
Confidence
+
State Machine
+
Cooldown
+
Event Deduplication

=

Reliable Safety Event Detection

When evidence is insufficient:

DO NOT GUESS.

Return:

UNKNOWN

or:

NO_CONFIRMED_EVENT

Accuracy is more important than detecting every possible event.