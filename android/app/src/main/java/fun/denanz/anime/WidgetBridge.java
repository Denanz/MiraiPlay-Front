package fun.denanz.anime;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;

import fun.denanz.anime.widgets.ContinueWatchingWidgetProvider;
import fun.denanz.anime.widgets.ScheduleWidgetProvider;
import fun.denanz.anime.widgets.ScreenshotWidgetProvider;
import fun.denanz.anime.widgets.StatsWidgetProvider;

/**
 * Bridges home-screen-widget data from the web layer to native. The JS side
 * (src/lib/widgetSync.ts) calls sync() right after each of the 4 relevant
 * pages (Continue Watching, Schedule, Stats, Gallery) fetches its own data —
 * there is no native background refresh, since the API auth token only lives
 * in the WebView's localStorage. Widgets show data "as of the last time you
 * opened that screen".
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridge extends Plugin {

    static final String PREFS = "widget_data";

    @PluginMethod
    public void sync(PluginCall call) {
        String kind = call.getString("kind");
        if (kind == null) {
            call.reject("kind required");
            return;
        }
        Context ctx = getContext();

        SharedPreferences.Editor editor = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        JSObject json = call.getObject("json");
        editor.putString(kind + "_json", json != null ? json.toString() : "{}");
        editor.apply();

        // Images are downloaded natively (plain https URLs in, JPEG files out) —
        // deliberately NOT fetched in JS: a WebView fetch() needs the server's
        // CORS response to be readable, while a plain PluginCall runs off the
        // main thread already, so a direct HttpURLConnection sidesteps that
        // whole class of failure (and doesn't need extra threading).
        JSObject images = call.getObject("images"); // { fileKey: imageUrl }
        if (images != null) {
            File dir = new File(ctx.getFilesDir(), "widgets");
            if (!dir.exists()) dir.mkdirs();
            Iterator<String> keys = images.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String url = images.optString(key, null);
                if (url == null || url.isEmpty()) continue;
                downloadImage(url, new File(dir, key + ".jpg"));
            }
        }

        Class<?> providerClass = providerFor(kind);
        if (providerClass != null) {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            ComponentName cn = new ComponentName(ctx, providerClass);
            int[] ids = mgr.getAppWidgetIds(cn);
            if (ids.length > 0) {
                Intent intent = new Intent(ctx, providerClass);
                intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                ctx.sendBroadcast(intent);
            }
        }

        call.resolve();
    }

    private void downloadImage(String urlStr, File dest) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setInstanceFollowRedirects(true);
            try (InputStream in = conn.getInputStream()) {
                Bitmap bmp = BitmapFactory.decodeStream(in);
                if (bmp == null) return;
                try (FileOutputStream out = new FileOutputStream(dest)) {
                    bmp.compress(Bitmap.CompressFormat.JPEG, 85, out);
                }
            }
        } catch (Exception ignored) {
            // Network hiccup / bad URL — skip, keep whatever was cached before.
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private Class<?> providerFor(String kind) {
        switch (kind) {
            case "continue": return ContinueWatchingWidgetProvider.class;
            case "schedule": return ScheduleWidgetProvider.class;
            case "stats": return StatsWidgetProvider.class;
            case "screenshot": return ScreenshotWidgetProvider.class;
            default: return null;
        }
    }
}
