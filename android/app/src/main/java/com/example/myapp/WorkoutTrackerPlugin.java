package com.example.myapp;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS bridge for {@link WorkoutTrackingService}.
 *
 * JS never counts steps itself on native: it starts the service and listens to
 * "workoutUpdate" events emitted from the hardware pedometer inside the
 * foreground service, so the counter keeps running with the app backgrounded.
 */
@CapacitorPlugin(name = "WorkoutTracker")
public class WorkoutTrackerPlugin extends Plugin {

    private BroadcastReceiver receiver;

    @Override
    public void load() {
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject payload = new JSObject();
                payload.put("event", intent.getStringExtra(WorkoutTrackingService.EXTRA_EVENT));
                payload.put("steps", intent.getIntExtra(WorkoutTrackingService.EXTRA_STEPS, 0));
                payload.put("distanceKm", intent.getDoubleExtra(WorkoutTrackingService.EXTRA_DISTANCE_KM, 0));
                payload.put("calories", intent.getIntExtra(WorkoutTrackingService.EXTRA_CALORIES, 0));
                payload.put("elapsedSeconds", intent.getLongExtra(WorkoutTrackingService.EXTRA_ELAPSED, 0));
                payload.put("paused", intent.getBooleanExtra(WorkoutTrackingService.EXTRA_PAUSED, false));
                notifyListeners("workoutUpdate", payload);
            }
        };
        IntentFilter filter = new IntentFilter(WorkoutTrackingService.BROADCAST_UPDATE);
        if (Build.VERSION.SDK_INT >= 33) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (receiver != null) getContext().unregisterReceiver(receiver);
        } catch (Exception ignored) { }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        boolean hw = sm != null && (sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
                || sm.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) != null);
        boolean recognition = Build.VERSION.SDK_INT < 29
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION)
                   == PackageManager.PERMISSION_GRANTED;
        JSObject r = new JSObject();
        r.put("hardwareStepCounter", hw);
        r.put("activityRecognitionGranted", recognition);
        r.put("running", WorkoutTrackingService.isRunning);
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        Intent i = new Intent(getContext(), WorkoutTrackingService.class)
                .setAction(WorkoutTrackingService.ACTION_START);
        ContextCompat.startForegroundService(getContext(), i);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        send(WorkoutTrackingService.ACTION_PAUSE);
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        send(WorkoutTrackingService.ACTION_RESUME);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        send(WorkoutTrackingService.ACTION_STOP);
        call.resolve();
    }

    /** Push GPS-derived metrics into the live notification. */
    @PluginMethod
    public void updateMetrics(PluginCall call) {
        Intent i = new Intent(getContext(), WorkoutTrackingService.class)
                .setAction(WorkoutTrackingService.ACTION_UPDATE_METRICS)
                .putExtra(WorkoutTrackingService.EXTRA_DISTANCE_KM, call.getDouble("distanceKm", 0d))
                .putExtra(WorkoutTrackingService.EXTRA_CALORIES, call.getInt("calories", 0))
                .putExtra(WorkoutTrackingService.EXTRA_ETA, call.getString("eta", "--"));
        ContextCompat.startForegroundService(getContext(), i);
        call.resolve();
    }

    private void send(String action) {
        Intent i = new Intent(getContext(), WorkoutTrackingService.class).setAction(action);
        ContextCompat.startForegroundService(getContext(), i);
    }
}
