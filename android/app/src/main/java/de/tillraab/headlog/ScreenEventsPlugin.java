package de.tillraab.headlog;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reads when the screen turned on and off, from Android's usage log. Needs the special "usage access"
 * permission, which the user grants in the system settings. Nothing runs in the background.
 */
@CapacitorPlugin(name = "ScreenEvents")
public class ScreenEventsPlugin extends Plugin {

    @PluginMethod
    public void hasAccess(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P);
        result.put("granted", granted());
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (Exception e) {
            // Some devices only open the general list, without the package.
            Intent list = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            list.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(list);
        }
        call.resolve();
    }

    /** Screen on and off events between `from` and `to` (epoch milliseconds), oldest first. */
    @PluginMethod
    public void events(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P || !granted()) {
            call.reject("Usage access not granted");
            return;
        }
        long from = call.getLong("from", 0L);
        long to = call.getLong("to", System.currentTimeMillis());
        UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        UsageEvents events = usm.queryEvents(from, to);
        UsageEvents.Event event = new UsageEvents.Event();
        JSArray list = new JSArray();
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            int type = event.getEventType();
            if (type != UsageEvents.Event.SCREEN_INTERACTIVE && type != UsageEvents.Event.SCREEN_NON_INTERACTIVE) continue;
            JSObject item = new JSObject();
            item.put("time", event.getTimeStamp());
            item.put("on", type == UsageEvents.Event.SCREEN_INTERACTIVE);
            list.put(item);
        }
        JSObject result = new JSObject();
        result.put("events", list);
        call.resolve(result);
    }

    private boolean granted() {
        AppOpsManager ops = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName())
            : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }
}
