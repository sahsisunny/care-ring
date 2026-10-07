Build and integrate a production-ready **Smart Activity Detection system** into our existing family/circle location-sharing application.

## 1. First inspect the existing project

Before changing any code, inspect the complete existing project structure and identify:

- Frontend framework
- React Native version
- iOS and Android setup
- Existing location-tracking implementation
- Location permissions
- Background location implementation
- Existing state management
- Backend architecture
- Authentication
- WebSocket/realtime implementation
- Existing family/circle/member model
- Existing database schema
- Existing notification system

Do NOT rewrite existing working functionality.

Integrate the activity detection system into the current architecture.

---

# 2. Feature Objective

Our application allows multiple family members to share their live location.

We want to automatically detect the user's current activity.

Supported activities:

- `STATIONARY`
- `WALKING`
- `RUNNING`
- `CYCLING`
- `DRIVING`
- `RIDING`
- `UNKNOWN`

The activity should be visible to other members of the same family/circle.

Example:

Sunny  
🏍️ Riding  
Moving • Updated 8 sec ago

Mom  
🚶 Walking  
Moving • Updated 12 sec ago

Dad  
🏠 Stationary  
Updated 1 min ago

---

# 3. Critical Requirement

## NEVER classify activity using instantaneous GPS speed alone.

The current implementation has a serious problem.

Suppose a user gets into a car:

0 km/h
→ 3 km/h
→ 7 km/h
→ 12 km/h
→ 25 km/h
→ 50 km/h

A speed-only algorithm may produce:

Walking → Cycling → Driving

This is wrong.

The user was driving from the beginning.

The system must understand the **movement session over time** rather than reacting to every individual GPS speed value.

---

# 4. Sensor Fusion

Use multiple signals whenever available:

### GPS

- latitude
- longitude
- speed
- accuracy
- heading
- timestamp

### Motion sensors

- accelerometer
- gyroscope
- device motion

### OS activity recognition

Use native activity-recognition capabilities where available.

Android:
- Activity Recognition / Activity Recognition Transition APIs
- Fused Location Provider
- SensorManager

iOS:
- Core Location
- Core Motion
- CMMotionActivityManager where applicable

GPS speed must only be one input to the classifier.

---

# 5. Detection Pipeline

Implement this pipeline:

```text
Location / Motion Sensors
        ↓
Sensor Data Normalization
        ↓
GPS Filtering + Smoothing
        ↓
Feature Extraction
        ↓
Activity Scoring
        ↓
State Machine
        ↓
Confidence + Hysteresis
        ↓
Confirmed Activity
        ↓
Local UI
        ↓
Backend
        ↓
Realtime Family Members
```

Keep these components independent.

---

# 6. Activity State Machine

Implement:

```text
UNKNOWN
   ↓
MOVEMENT_STARTED
   ↓
COLLECTING_DATA
   ↓
CANDIDATE_ACTIVITY
   ↓
CONFIRMED_ACTIVITY
   ↓
ACTIVITY_CHANGE_CANDIDATE
   ↓
CONFIRMED_NEW_ACTIVITY
```

The important rule is:

**A candidate activity must be confirmed before changing the user's visible activity.**

---

# 7. Movement Start

When movement starts:

DO NOT immediately display:

Walking

or:

Cycling

or:

Driving

Instead:

```text
UNKNOWN
↓
MOVEMENT_STARTED
↓
Collect sensor data
↓
Evaluate candidate
↓
Confirm activity
```

Collect approximately 10–20 seconds of evidence before confirming the initial activity.

Make this configurable.

Example:

```ts
ACTIVITY_START_CONFIRMATION_MS = 15000;
```

---

# 8. Activity Switching / Hysteresis

This is one of the most important requirements.

Once an activity is confirmed, do NOT change it because of a single GPS reading.

Example:

Current:

```text
DRIVING
```

Then traffic causes:

```text
35 km/h
10 km/h
3 km/h
0 km/h
5 km/h
15 km/h
```

The activity must remain:

```text
DRIVING
```

It should NOT become:

```text
DRIVING
→ WALKING
→ CYCLING
→ DRIVING
```

Require strong and sustained evidence before changing activity.

Example:

```ts
ACTIVITY_SWITCH_CONFIRMATION_MS = 12000;
MIN_ACTIVITY_CONFIDENCE = 0.75;
HIGH_ACTIVITY_CONFIDENCE = 0.85;
```

These values must be configurable.

---

# 9. GPS Speed Smoothing

Never use raw instantaneous GPS speed directly.

Maintain a rolling window.

Example:

```text
3
5
7
10
14
18
```

Calculate:

- smoothed speed
- speed trend
- acceleration
- speed variance
- duration at current speed
- maximum speed
- minimum speed

Reject unrealistic GPS jumps.

Also handle:

- GPS accuracy degradation
- stale locations
- duplicate timestamps
- out-of-order updates
- GPS speed spikes
- GPS unavailable

---

# 10. GPS Accuracy

GPS accuracy must influence confidence.

For example:

If GPS accuracy is poor:

```text
GPS contribution ↓
```

If GPS is reliable:

```text
GPS contribution ↑
```

Never blindly trust speed when location accuracy is poor.

Create a configurable threshold such as:

```ts
GPS_ACCURACY_THRESHOLD_METERS = 50;
```

Do not hardcode the value throughout the application.

---

# 11. Activity Scoring

Do not create one giant if/else block.

Create an activity scoring system.

Conceptually:

```ts
scoreActivity(sensorData): ActivityPrediction
```

Return:

```ts
{
  activity: ActivityType,
  confidence: number,
  evidence: ActivityEvidence[]
}
```

Example:

```json
{
  "activity": "DRIVING",
  "confidence": 0.94,
  "evidence": [
    "automotive OS activity",
    "sustained vehicle speed",
    "vehicle-like acceleration",
    "consistent GPS trajectory"
  ]
}
```

---

# 12. Walking Detection

Consider:

- low/moderate speed
- pedestrian OS activity
- accelerometer pattern
- walking cadence
- movement consistency
- duration

Do not classify Walking merely because:

```text
speed < 7 km/h
```

---

# 13. Running Detection

Consider:

- pedestrian OS activity
- higher pedestrian speed
- accelerometer pattern
- cadence
- sustained running motion

Do not classify Running merely because speed exceeds a fixed threshold.

---

# 14. Cycling Detection

Consider:

- cycling OS activity
- moderate/high speed
- motion pattern
- acceleration pattern
- sustained movement

GPS speed alone must not distinguish Cycling from Driving.

---

# 15. Driving Detection

Use:

- automotive OS activity recognition
- sustained vehicle-like speed
- acceleration/deceleration pattern
- GPS movement consistency
- motion sensor signals

Example:

```text
0
3
6
10
18
30
45
```

If automotive activity is detected, the system should be able to classify the session as Driving even during the initial low-speed phase.

---

# 16. Motorcycle / Riding Detection

Do NOT pretend that GPS can reliably distinguish a car from a motorcycle.

Both can have similar:

- speed
- acceleration
- GPS trajectory

Use additional signals where available:

- OS activity recognition
- accelerometer
- gyroscope
- device orientation
- motion characteristics
- historical context
- optional user preference

If the system cannot confidently distinguish:

```text
CAR vs MOTORCYCLE
```

return:

```text
VEHICLE
```

or use the previously confirmed vehicle activity.

Never randomly switch between Driving and Riding.

---

# 17. Previous Activity Context

The previous confirmed activity is an important signal.

Example:

```text
Current = DRIVING
Speed temporarily = 5 km/h
```

Do not immediately classify as Walking.

Instead:

```text
Previous activity
+
Current sensor evidence
+
Duration
+
Confidence
=
Next activity
```

Use temporal context.

---

# 18. Stationary Detection

Stationary should also require confirmation.

Example:

```text
DRIVING
↓
0 km/h
↓
0 km/h
↓
0 km/h
↓
vehicle remains stopped
```

After the configured stationary duration:

```text
DRIVING → STATIONARY
```

Do not immediately switch to Stationary when one GPS reading reports zero speed.

---

# 19. Activity Transition Rules

Implement explicit transition rules.

Example:

```text
UNKNOWN → WALKING       allowed
UNKNOWN → RUNNING       allowed
UNKNOWN → CYCLING       allowed
UNKNOWN → DRIVING       allowed
UNKNOWN → RIDING        allowed

DRIVING → WALKING       requires strong sustained evidence
DRIVING → CYCLING       requires strong sustained evidence
DRIVING → RIDING        requires strong sustained evidence

WALKING → RUNNING       requires confirmation
RUNNING → WALKING       requires confirmation
CYCLING → DRIVING       requires confirmation
```

The state machine should prevent rapid oscillation.

---

# 20. Background Tracking

The system must work when the app is in the background, subject to OS restrictions and permissions.

## Android

Use appropriate:

- Fused Location Provider
- Activity Recognition
- Foreground Service where required
- Background location permissions
- SensorManager

## iOS

Use appropriate:

- Core Location
- Core Motion
- background location capability
- motion/activity APIs where available

Do not implement fake background tracking.

Respect OS restrictions.

---

# 21. Battery Optimization

Battery consumption is critical for a family location app.

Do NOT keep every sensor running at maximum frequency permanently.

Use adaptive sampling.

### Stationary

Low-power mode.

### Movement detected

Increase sampling.

### Activity transition candidate

Temporarily increase sampling.

### Confirmed activity

Use appropriate reduced frequency.

### Return to stationary

Reduce sampling again.

Create centralized configuration:

```ts
LOCATION_UPDATE_INTERVAL
FAST_LOCATION_INTERVAL
SENSOR_SAMPLING_RATE
ACTIVITY_START_CONFIRMATION_MS
ACTIVITY_SWITCH_CONFIRMATION_MS
STATIONARY_CONFIRMATION_MS
GPS_ACCURACY_THRESHOLD
MIN_ACTIVITY_CONFIDENCE
```

---

# 22. Privacy

Raw sensor data should preferably remain on-device.

Do not send continuous accelerometer/gyroscope streams to the backend unless absolutely necessary.

Backend should receive the result:

```json
{
  "activity": "RIDING",
  "confidence": 0.91,
  "startedAt": "...",
  "updatedAt": "..."
}
```

Implement:

- explicit location permission
- activity permission
- sharing controls
- secure API communication
- authenticated access
- authorization per family/circle
- minimum necessary data retention

---

# 23. Backend Model

Create or extend an activity model.

Example:

```ts
ActivityEvent {
  id
  userId
  activity
  confidence
  startedAt
  endedAt
  averageSpeed
  maxSpeed
  sourceSignals
  createdAt
}
```

Current state:

```ts
CurrentActivity {
  userId
  activity
  confidence
  startedAt
  lastUpdatedAt
}
```

Do NOT create a database row for every GPS update.

Store activity transitions/events.

---

# 24. Realtime Updates

When the confirmed activity changes:

```text
Mobile
 ↓
Activity Detection Engine
 ↓
Confirmed Activity
 ↓
Backend API
 ↓
WebSocket / Realtime
 ↓
Family Members
```

Example:

```json
{
  "userId": "user123",
  "activity": "RIDING",
  "confidence": 0.91,
  "timestamp": "2026-10-06T13:20:00Z"
}
```

Only broadcast meaningful confirmed activity changes.

Do not broadcast every candidate prediction.

---

# 25. UI

Each family member should display:

```text
Sunny
🏍️ Riding
Moving • Updated 8 sec ago
```

Examples:

```text
Mom
🚶 Walking
Moving • Updated 12 sec ago
```

```text
Dad
🏠 Stationary
Updated 1 min ago
```

```text
Rahul
❔ Activity unavailable
Updated 30 sec ago
```

Do not show:

```text
Walking
Cycling
Driving
Walking
Driving
```

within a few seconds.

The UI must only display confirmed activity.

---

# 26. Activity Change Animation

When activity genuinely changes:

```text
🏍️ Riding
      ↓
🚗 Driving
```

Show a subtle transition.

Do not animate every sensor update.

Only animate confirmed state changes.

---

# 27. Offline Support

Activity detection should primarily happen locally.

If network is unavailable:

- continue detecting locally
- keep latest confirmed activity
- queue important activity transitions
- synchronize when network returns

The activity engine must not depend on a permanent backend connection.

---

# 28. Error Handling

Handle:

- location permission denied
- motion permission denied
- activity recognition permission denied
- GPS disabled
- poor GPS accuracy
- GPS unavailable
- sensors unavailable
- battery saver
- background permission denied
- network unavailable

Fallback gracefully.

If only GPS is available:

```text
Use GPS-based estimation
↓
Reduce confidence
↓
Mark internally as low-confidence
```

Do not pretend GPS-only classification is highly reliable.

---

# 29. Debug Mode

Create a developer/debug mode.

Display:

```text
Current Activity: DRIVING
Confidence: 94%

GPS Speed: 18 km/h
GPS Accuracy: 8 m

OS Activity: AUTOMOTIVE

Accelerometer: Available
Gyroscope: Available

Candidate:
DRIVING 94%
CYCLING 31%
WALKING 12%

Current State:
CONFIRMED_ACTIVITY

Previous Activity:
DRIVING

Time Since Confirmation:
42 sec
```

This will be extremely useful for testing real-world behavior.

---

# 30. Logging

Create structured logs.

Example:

```text
[ActivityDetection]
speed=8.2
accuracy=7
osActivity=AUTOMOTIVE
candidate=DRIVING
confidence=0.88
previousActivity=DRIVING
action=KEEP_CURRENT
reason=HYSTERESIS
```

Avoid excessive production logging.

Debug logging should be configurable.

---

# 31. Test Cases

Implement automated tests for all of these.

## Test 1 — Car starts

```text
0
3
7
12
25
50 km/h
```

Expected:

```text
UNKNOWN → DRIVING
```

NOT:

```text
WALKING → CYCLING → DRIVING
```

---

## Test 2 — Motorcycle starts

```text
0
5
12
25
50 km/h
```

Expected:

```text
UNKNOWN → RIDING
```

when supporting signals are available.

---

## Test 3 — Walking

```text
0
2
4
5 km/h
```

Expected:

```text
UNKNOWN → WALKING
```

with supporting pedestrian signals.

---

## Test 4 — Running

```text
0
6
9
12 km/h
```

Expected:

```text
UNKNOWN → RUNNING
```

when motion signals support running.

---

## Test 5 — Cycling

```text
0
8
15
22 km/h
```

Expected:

```text
UNKNOWN → CYCLING
```

when cycling evidence is present.

---

## Test 6 — Traffic Jam

```text
DRIVING

35
10
3
0
5
15 km/h
```

Expected:

```text
DRIVING
```

throughout.

---

## Test 7 — Vehicle Stop

```text
DRIVING
↓
0 km/h
↓
stopped for configured duration
```

Expected:

```text
DRIVING → STATIONARY
```

only after confirmation.

---

## Test 8 — GPS Noise

Input:

```text
5
80
4
90
6
```

Expected:

No activity switching caused by GPS spikes.

---

# 32. Code Quality

Follow the existing project's coding conventions.

Requirements:

- TypeScript where applicable
- Strong typing
- No unnecessary `any`
- Modular architecture
- Unit-testable services
- Dependency injection where appropriate
- No business logic inside UI components
- No duplicated detection logic
- Centralized configuration
- Clear naming
- Proper error handling
- Comments only where they explain non-obvious logic

---

# 33. Suggested Architecture

If compatible with the existing project, use a structure similar to:

```text
activity/
├── ActivityDetectionEngine
├── ActivityStateMachine
├── ActivityScorer
├── SensorFusion
├── GpsProcessor
├── MotionProcessor
├── ActivityRecognitionProvider
├── ActivityHistory
├── ActivityConfig
├── ActivityLogger
└── types
```

The UI should consume:

```ts
currentActivity
```

It must NOT contain activity-classification logic.

---

# 34. Important Implementation Rule

Before implementing anything:

1. Inspect the existing code.
2. Identify what already exists.
3. Reuse existing location infrastructure.
4. Do not duplicate location tracking.
5. Do not introduce a new library if the current project already provides equivalent functionality.
6. Check platform compatibility before adding native dependencies.
7. Explain any required native configuration changes.
8. Implement incrementally.
9. Run tests/build checks after implementation.

---

# 35. Final Deliverables

After implementation, provide:

1. Architecture overview
2. Files changed
3. New files created
4. Dependencies added
5. Android changes
6. iOS changes
7. Permission changes
8. Backend changes
9. Database changes
10. Realtime changes
11. Activity state machine
12. Sensor-fusion logic
13. Hysteresis logic
14. Battery strategy
15. Privacy strategy
16. Unit tests
17. Integration tests
18. Manual testing instructions
19. Known limitations
20. Recommended future improvements

Most importantly:

### DO NOT build a speed-to-activity lookup table.

Bad:

```text
0–7 km/h     = Walking
7–20 km/h    = Cycling
20+ km/h     = Driving
```

This approach is explicitly rejected.

Instead use:

```text
GPS
+
Motion Sensors
+
OS Activity Recognition
+
Temporal History
+
Previous Activity
+
Confidence
+
Hysteresis
=
Confirmed Activity
```

The system should prioritize **stability and correctness over instant classification**.

If the evidence is insufficient, return:

```text
UNKNOWN
```

rather than confidently returning the wrong activity.