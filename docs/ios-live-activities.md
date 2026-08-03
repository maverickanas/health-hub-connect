# iOS Live Activities / Dynamic Island (ActivityKit)

The Android side ships as native code in this repo (`WorkoutTrackingService` +
`WorkoutTrackerPlugin`). iOS needs an app extension, which can only be added in
Xcode after `npx cap add ios`.

## 1. Steps in the background
Use `CMPedometer` (hardware, keeps counting while suspended) instead of JS math:

```swift
import CoreMotion
let pedometer = CMPedometer()
pedometer.startUpdates(from: sessionStart) { data, _ in
    guard let d = data else { return }
    LiveWorkoutActivity.shared.update(steps: d.numberOfSteps.intValue,
                                      distance: d.distance?.doubleValue ?? 0)
}
```
Add to `Info.plist`: `NSMotionUsageDescription`,
`NSLocationAlwaysAndWhenInUseUsageDescription`, and background modes
`location` + `processing`.

## 2. Live Activity + Dynamic Island
Add a **Widget Extension** target, enable `NSSupportsLiveActivities` in the app
`Info.plist`, then:

```swift
struct WorkoutAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var steps: Int; var kcal: Int; var km: Double; var elapsed: TimeInterval
    }
    var title: String
}

// Start when the workout starts
let activity = try Activity.request(
    attributes: WorkoutAttributes(title: "Healthy Hub"),
    content: .init(state: .init(steps: 0, kcal: 0, km: 0, elapsed: 0), staleDate: nil))

// Update on every pedometer tick
await activity.update(.init(state: newState, staleDate: nil))
await activity.end(nil, dismissalPolicy: .immediate)
```

Dynamic Island regions: `compactLeading` = crest icon, `compactTrailing` =
step count, `minimal` = steps, `expanded` = steps / kcal / km / timer with
PAUSE and STOP `Button(intent:)` App Intents (iOS 17+).

## 3. Bridging to this Capacitor app
Create `WorkoutTrackerPlugin.swift` implementing the same JS contract used by
`src/lib/backgroundTracker.ts` (`start`, `pause`, `resume`, `stop`,
`updateMetrics`, `workoutUpdate` event) and register it in
`ios/App/App/AppDelegate.swift`. No JS changes are then required.

Prebuilt alternative if you prefer not to write Swift:
`capacitor-live-activities` (Capacitor) or `@notifee/react-native` +
`react-native-live-activity` on bare React Native.
