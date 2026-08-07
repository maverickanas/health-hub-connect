package com.example.myapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Persistent foreground service that owns the workout session.
 *
 * - Listens to the HARDWARE pedometer (Sensor.TYPE_STEP_COUNTER), which keeps
 *   counting inside the SoC even while the JS thread / screen is off.
 * - Holds a PARTIAL_WAKE_LOCK so the CPU keeps delivering sensor batches.
 * - Posts an ongoing, un-dismissible notification with live steps / kcal /
 *   distance and PAUSE + STOP action buttons.
 * - Broadcasts every update so the Capacitor plugin can forward it to JS.
 */
public class WorkoutTrackingService extends Service implements SensorEventListener {

    public static final String ACTION_START = "com.example.myapp.START_WORKOUT";
    public static final String ACTION_PAUSE = "com.example.myapp.PAUSE_WORKOUT";
    public static final String ACTION_RESUME = "com.example.myapp.RESUME_WORKOUT";
    public static final String ACTION_STOP = "com.example.myapp.STOP_WORKOUT";
    public static final String ACTION_UPDATE_METRICS = "com.example.myapp.UPDATE_METRICS";
    public static final String ACTION_SYNC = "com.example.myapp.SYNC_WORKOUT";

    /** Broadcast emitted to the JS layer on every tick. */
    public static final String BROADCAST_UPDATE = "com.example.myapp.WORKOUT_UPDATE";

    public static final String EXTRA_DISTANCE_KM = "distanceKm";
    public static final String EXTRA_CALORIES = "calories";
    public static final String EXTRA_ETA = "eta";
    public static final String EXTRA_STEPS = "steps";
    public static final String EXTRA_ELAPSED = "elapsedSeconds";
    public static final String EXTRA_PAUSED = "paused";
    public static final String EXTRA_EVENT = "event";

    private static final String CHANNEL_ID = "healthyhub_workout";
    private static final int NOTIFICATION_ID = 4301;
    private static final String PREFS = "healthyhub_workout_state";

    private SensorManager sensorManager;
    private Sensor stepCounter;
    private PowerManager.WakeLock wakeLock;

    private float baselineSteps = -1f;   // first raw TYPE_STEP_COUNTER value
    private int sessionSteps = 0;
    private int stepsAtPause = 0;

    private double distanceKm = 0d;
    private int calories = 0;
    private String eta = "--";

    private boolean paused = false;
    private long startedAt = 0L;
    private long pausedAccumMs = 0L;
    private long pausedAt = 0L;

    public static boolean isRunning = false;

    public static boolean hasRunningSession(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getBoolean("running", false);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            if (stepCounter == null) {
                // Fallback: composite detector still runs in hardware on most devices.
                stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
            }
        }
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (action == null) action = ACTION_START;

        switch (action) {
            case ACTION_PAUSE:
                paused = true;
                pausedAt = System.currentTimeMillis();
                stepsAtPause = sessionSteps;
                detachSensor();
                pushNotification();
                persistState();
                broadcast("pause");
                break;
            case ACTION_RESUME:
                if (paused) {
                    paused = false;
                    pausedAccumMs += System.currentTimeMillis() - pausedAt;
                    baselineSteps = -1f; // re-baseline against the hardware counter
                    attachSensor();
                    pushNotification();
                    persistState();
                    broadcast("resume");
                }
                break;
            case ACTION_STOP:
                broadcast("stop");
                stopTracking();
                return START_NOT_STICKY;
            case ACTION_UPDATE_METRICS:
                distanceKm = intent.getDoubleExtra(EXTRA_DISTANCE_KM, distanceKm);
                calories = intent.getIntExtra(EXTRA_CALORIES, calories);
                String e = intent.getStringExtra(EXTRA_ETA);
                if (e != null) eta = e;
                pushNotification();
                persistState();
                broadcast("metrics");
                break;
            case ACTION_SYNC:
                if (isRunning) {
                    broadcast(paused ? "pause" : "step");
                } else {
                    startTracking();
                }
                break;
            default:
                startTracking();
                break;
        }
        return START_STICKY;
    }

    private void startTracking() {
        if (isRunning) {
            broadcast(paused ? "pause" : "start");
            return;
        }
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        boolean restoring = prefs.getBoolean("running", false);
        isRunning = true;
        paused = restoring && prefs.getBoolean("paused", false);
        sessionSteps = restoring ? prefs.getInt("steps", 0) : 0;
        stepsAtPause = sessionSteps;
        // TYPE_STEP_COUNTER is cumulative since boot. After service recreation,
        // take a fresh baseline and add new movement to the persisted session.
        baselineSteps = -1f;
        pausedAccumMs = restoring ? prefs.getLong("pausedAccumMs", 0L) : 0L;
        startedAt = restoring ? prefs.getLong("startedAt", System.currentTimeMillis()) : System.currentTimeMillis();
        pausedAt = restoring ? prefs.getLong("pausedAt", 0L) : 0L;
        distanceKm = restoring ? Double.longBitsToDouble(prefs.getLong("distanceBits", 0L)) : 0d;
        calories = restoring ? prefs.getInt("calories", 0) : 0;
        eta = restoring ? prefs.getString("eta", "--") : "--";

        startInForeground();
        acquireWakeLock();
        if (!paused) attachSensor();
        persistState();
        broadcast("start");
    }

    private void startInForeground() {
        Notification n = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
            if (Build.VERSION.SDK_INT >= 34) {
                type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH;
            }
            startForeground(NOTIFICATION_ID, n, type);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }
    }

    private void stopTracking() {
        isRunning = false;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().clear().apply();
        detachSensor();
        releaseWakeLock();
        stopForeground(true);
        stopSelf();
    }

    // ---------------------------------------------------------------- sensors

    private void attachSensor() {
        if (sensorManager != null && stepCounter != null) {
            // SENSOR_DELAY_NORMAL + 0 latency: hardware batches while asleep and
            // flushes on wake, so no steps are lost with the screen off.
            sensorManager.registerListener(this, stepCounter, SensorManager.SENSOR_DELAY_NORMAL, 0);
        }
    }

    private void detachSensor() {
        if (sensorManager != null) sensorManager.unregisterListener(this);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (paused) return;
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            float raw = event.values[0];
            if (baselineSteps < 0) baselineSteps = raw;
            sessionSteps = stepsAtPause + (int) Math.max(0, raw - baselineSteps);
        } else if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            sessionSteps += 1;
        } else {
            return;
        }
        pushNotification();
        persistState();
        broadcast("step");
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) { }

    // ------------------------------------------------------------- wake lock

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm == null) return;
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HealthyHub::WorkoutWakeLock");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(6 * 60 * 60 * 1000L); // hard 6h safety cap
        } catch (Exception ignored) { }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) { }
        wakeLock = null;
    }

    // ---------------------------------------------------------- notification

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Live Workout", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Ongoing step, distance and calorie tracking");
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.enableVibration(false);
        ch.enableLights(false);
        ch.setSound(null, null);
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
    }

    private long elapsedSeconds() {
        long now = paused ? pausedAt : System.currentTimeMillis();
        long ms = now - startedAt - pausedAccumMs;
        return Math.max(0, ms / 1000);
    }

    private PendingIntent servicePendingIntent(String action, int requestCode) {
        Intent i = new Intent(this, WorkoutTrackingService.class).setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, requestCode, i, flags);
    }

    private Notification buildNotification() {
        long secs = elapsedSeconds();
        String time = String.format("%02d:%02d", secs / 60, secs % 60);
        String shortLine = sessionSteps + " steps · " + time;
        String expanded = sessionSteps + " steps\n"
                + String.format("%.2f", distanceKm) + " km · " + calories + " kcal\n"
                + "Elapsed " + time + " · ETA " + eta;

        Intent open = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) f |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, f);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(getResources().getIdentifier(
                        "ic_stat_healthyhub", "drawable", getPackageName()))
                .setColor(0xFFCCFF00)
                .setColorized(true)
                .setContentTitle(paused ? "Healthy Hub · Paused" : "Healthy Hub · Live Workout")
                .setContentText(shortLine)
                .setSubText(String.format("%.2f km", distanceKm))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(expanded))
                .setOngoing(true)
                .setAutoCancel(false)
                .setSilent(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setUsesChronometer(!paused)
                .setWhen(startedAt + pausedAccumMs)
                .setCategory(NotificationCompat.CATEGORY_WORKOUT)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setContentIntent(openPi);

        if (paused) {
            b.addAction(0, "RESUME", servicePendingIntent(ACTION_RESUME, 11));
        } else {
            b.addAction(0, "PAUSE", servicePendingIntent(ACTION_PAUSE, 10));
        }
        b.addAction(0, "STOP WORKOUT", servicePendingIntent(ACTION_STOP, 12));

        return b.build();
    }

    private void pushNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
    }

    private void persistState() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putBoolean("running", isRunning)
                .putBoolean("paused", paused)
                .putInt("steps", sessionSteps)
                .putInt("calories", calories)
                .putFloat("baseline", baselineSteps)
                .putLong("startedAt", startedAt)
                .putLong("pausedAt", pausedAt)
                .putLong("pausedAccumMs", pausedAccumMs)
                .putLong("distanceBits", Double.doubleToRawLongBits(distanceKm))
                .putString("eta", eta)
                .apply();
    }

    // ------------------------------------------------------------- broadcast

    private void broadcast(String event) {
        Intent i = new Intent(BROADCAST_UPDATE)
                .setPackage(getPackageName())
                .putExtra(EXTRA_EVENT, event)
                .putExtra(EXTRA_STEPS, sessionSteps)
                .putExtra(EXTRA_DISTANCE_KM, distanceKm)
                .putExtra(EXTRA_CALORIES, calories)
                .putExtra(EXTRA_ELAPSED, elapsedSeconds())
                .putExtra(EXTRA_PAUSED, paused);
        sendBroadcast(i);
    }

    @Override
    public void onDestroy() {
        detachSensor();
        releaseWakeLock();
        // Keep the persisted running session intact. START_STICKY recreates the
        // service and startTracking() restores the counter instead of zeroing it.
        isRunning = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
