#include <ESP32Servo.h>

// ─── pins ──────────────────────────────────────────────
const int trigPin    = 4;
const int echoPin    = 5;
const int servoPin1  = 6;
const int servoPin2  = 7;

// ─── distance thresholds (cm) ──────────────────────────
// Tune these once the device is mounted.
const int LEVEL1_DISTANCE = 35;   // "getting close" — paws drop, soft mmm
const int LEVEL2_DISTANCE = 25;   // "way too close" — paws drop, full meow

// ─── servo positions ───────────────────────────────────
// Servos are mirrored, so the two values differ.
//
// REST is now 90° (middle of servo range) so paws can swing
// BOTH up (happy mood) and down (alarm / dropdown / tracking).
// This required re-seating the servo horns so the paws are
// in the "tucked away" position when each servo reads 90°.
//
// If you ever change REST, you must shift DOWN, UP, and the
// TRACK_CENTER constants below by the same amount to keep
// the existing tracking calibration aligned.
const int SERVO1_REST = 90;
const int SERVO2_REST = 90;
const int SERVO1_DOWN = 155;    // was 65 (shifted +90 with REST)
const int SERVO2_DOWN = 25;     // was 45 (shifted -20 with REST)
const int SERVO1_UP   = 25;     // mirror of DOWN around REST → "raised" arm
const int SERVO2_UP   = 155;    // mirror of DOWN around REST → "raised" arm

// ─── happy-mood "yay" raise ────────────────────────────
// When the app detects you've been in a "happy" app (Illustrator,
// Figma, Photoshop, etc.) for 10+ seconds, it sends "R:3000\n".
// Firmware raises both paws to UP and bobs them in a small wave
// for that duration, then returns to whatever priority is active.
const int RAISE_WAVE_AMP_DEG = 10;    // ± degrees around UP — "wave" amplitude
const int RAISE_WAVE_PERIOD_MS = 320; // one full sine cycle = one "yay" wave

// ============================================================
// CURSOR-TRACKING TUNABLES — edit these and re-flash to iterate.
// ============================================================
//
// SWEEP_AMOUNT
//   Degrees each paw rotates from its DOWN angle at cursor extremes.
//   Bigger = paws swing further. Start ~70. Try 100 if motion feels small.
//
// SERVO1_SIGN, SERVO2_SIGN
//   Each is +1 or -1. Flip the sign of *one* servo if it moves in the
//   wrong direction. Each servo can be tuned independently because the
//   two are physically mirrored and need different signs depending on
//   how they're mounted.
//
//   Decision table:
//   - Cursor LEFT, RIGHT paw should rotate LEFT  → tune SERVO_for_right_paw
//   - Cursor LEFT, LEFT  paw should rotate LEFT  → tune SERVO_for_left_paw
//   If one paw moves correctly and the other doesn't, only flip that
//   servo's sign.
//
// HARDWARE NOTE
//   servo2's DOWN is at 0°, so it physically cannot rotate further "down"
//   past DOWN. If your tracking on one side feels truncated, that's the
//   hardware limit, not a code bug.

const int SWEEP_AMOUNT = 50;
const int SERVO1_SIGN  = +1;
const int SERVO2_SIGN  = +1;

// Paw positions when the cursor is at the SCREEN CENTER. The cursor sits
// BETWEEN the two paws, so they should tilt slightly inward (toward each
// other) rather than point perfectly straight down.
//   SERVO1: REST=0, DOWN=65 → pick a value between them (lower = more inward)
//   SERVO2: REST=95, DOWN=30 → pick a value between them (higher = more inward)
// To remove the inward bias entirely, set these to SERVO1_DOWN/SERVO2_DOWN.
const int SERVO1_TRACK_CENTER = 130;   // was 40 (shifted +90 with REST)
const int SERVO2_TRACK_CENTER = 50;    // was 70 (shifted -20 with REST)

// How long firmware holds the last tracking angle before letting paws snap
// back to REST. App sends T: ~20×/sec while tracking is active; if it stops
// for longer than this, paws release. Bump higher for more "patience".
const unsigned long TRACKING_TIMEOUT_MS = 3000;   // 3 seconds
// ============================================================

// Asymmetric debounce:
//  - Going CLOSER (escalating): require a long stable window so a hand-pass
//    doesn't trigger an alarm.
//  - Going FARTHER (calming): much shorter — paws should snap back when the
//    user actually backs off.
const unsigned long DEBOUNCE_CLOSER_MS  = 10000;
const unsigned long DEBOUNCE_FARTHER_MS = 2500;

Servo servo1;
Servo servo2;

int observedState   = 0;              // what the sensor is reading right now
int committedState  = 0;              // what we report and act on
unsigned long observedStartedMs = 0;  // when the current observation began
int trackingAngle   = -1;             // -1 = not tracking
unsigned long lastTrackingMs = 0;
// Per-paw "hold down" bitmask from app — set when a dropdown is open.
// Bit 0 = servo1 (right paw, notes), bit 1 = servo2 (left paw, pomodoro).
int holdMask = 0;
// Happy-mood raise window — when millis() < raiseUntilMs, paws are UP.
unsigned long raiseStartMs = 0;
unsigned long raiseUntilMs = 0;
String inputBuffer;

void setup() {
  Serial.begin(115200);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  servo1.attach(servoPin1);
  servo2.attach(servoPin2);
  servo1.write(SERVO1_REST);
  servo2.write(SERVO2_REST);
}

int readDistanceCm() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 30000UL);
  if (duration == 0) return -1;
  return (int)(duration * 0.034 / 2);
}

void handleSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      if (inputBuffer.startsWith("T:")) {
        trackingAngle = inputBuffer.substring(2).toInt();
        lastTrackingMs = millis();
      } else if (inputBuffer.startsWith("H:")) {
        holdMask = inputBuffer.substring(2).toInt();
      } else if (inputBuffer.startsWith("R:")) {
        // "R:<ms>" — raise paws to UP with a small "yay" wave for that long.
        unsigned long dur = (unsigned long)inputBuffer.substring(2).toInt();
        raiseStartMs = millis();
        raiseUntilMs = millis() + dur;
      } else if (inputBuffer == "R") {
        trackingAngle = -1;
      }
      inputBuffer = "";
    } else if (c != '\r') {
      inputBuffer += c;
    }
  }
}

void loop() {
  handleSerial();

  int distance = readDistanceCm();

  // Instantaneous reading
  int observed = 0;
  if (distance > 0 && distance < LEVEL2_DISTANCE) {
    observed = 2;
  } else if (distance > 0 && distance < LEVEL1_DISTANCE) {
    observed = 1;
  }

  // Reset debounce timer whenever the live reading changes.
  if (observed != observedState) {
    observedState = observed;
    observedStartedMs = millis();
  }

  // Pick the right debounce window depending on direction of change.
  unsigned long required =
      (observedState > committedState) ? DEBOUNCE_CLOSER_MS
                                       : DEBOUNCE_FARTHER_MS;

  int newCommitted = committedState;
  if (millis() - observedStartedMs >= required) {
    newCommitted = observedState;
  }

  if (millis() - lastTrackingMs > TRACKING_TIMEOUT_MS) {
    trackingAngle = -1;
  }

  // Compute servo positions by priority (highest wins):
  //   1. Distance alarm   → both DOWN
  //   2. Happy raise      → both UP with small "yay" wave
  //   3. Per-paw HOLD     → that paw DOWN (dropdown open)
  //   4. Cursor tracking  → paws follow cursor
  //   5. Otherwise        → both REST
  int s1 = SERVO1_REST;
  int s2 = SERVO2_REST;

  bool raiseActive = (millis() < raiseUntilMs);

  if (newCommitted >= 1) {
    // alarm
    s1 = SERVO1_DOWN;
    s2 = SERVO2_DOWN;
  } else if (raiseActive) {
    // happy raise + small sinusoidal wave
    unsigned long t = millis() - raiseStartMs;
    float phase = 2.0f * 3.14159265f * (float)t / (float)RAISE_WAVE_PERIOD_MS;
    int wave = (int)((float)RAISE_WAVE_AMP_DEG * sinf(phase));
    // Both paws wave the same physical direction (mirror compensation):
    //   SERVO1 angle increases → "downward" rotation
    //   SERVO2 angle decreases → "downward" rotation
    s1 = SERVO1_UP + wave;
    s2 = SERVO2_UP - wave;
  } else {
    // base: tracking if active, else REST
    if (trackingAngle >= 0) {
      int s1Left  = SERVO1_DOWN - SERVO1_SIGN * SWEEP_AMOUNT;
      int s1Right = SERVO1_DOWN + SERVO1_SIGN * SWEEP_AMOUNT;
      int s2Left  = SERVO2_DOWN - SERVO2_SIGN * SWEEP_AMOUNT;
      int s2Right = SERVO2_DOWN + SERVO2_SIGN * SWEEP_AMOUNT;
      if (trackingAngle <= 90) {
        s1 = map(trackingAngle, 0, 90, s1Left, SERVO1_TRACK_CENTER);
        s2 = map(trackingAngle, 0, 90, s2Left, SERVO2_TRACK_CENTER);
      } else {
        s1 = map(trackingAngle, 90, 180, SERVO1_TRACK_CENTER, s1Right);
        s2 = map(trackingAngle, 90, 180, SERVO2_TRACK_CENTER, s2Right);
      }
    }
    // Per-paw HOLD overrides — applies to tracking/rest but NOT to alarm or raise.
    if (holdMask & 0x1) s1 = SERVO1_DOWN;   // right paw — notes
    if (holdMask & 0x2) s2 = SERVO2_DOWN;   // left paw  — pomodoro
  }

  servo1.write(constrain(s1, 0, 180));
  servo2.write(constrain(s2, 0, 180));

  Serial.print("D:");
  Serial.println(distance);

  if (newCommitted != committedState) {
    Serial.print("S:");
    Serial.println(newCommitted);
    committedState = newCommitted;
  }

  delay(50);
}
