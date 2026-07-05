package fun.denanz.anime.widgets;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;

import org.json.JSONObject;

import java.io.File;

import fun.denanz.anime.MainActivity;

/**
 * Shared helpers for the four home-screen widgets: reading the JSON snapshot
 * + cached poster/screenshot files that WidgetBridge writes from the JS side,
 * and building the tap-through deep link (fun.denanz.anime://<target>) back
 * into the SPA (see App.tsx's WidgetDeepLink listener).
 */
final class WidgetUtils {
    private WidgetUtils() {}

    static final String PREFS = "widget_data";

    static JSONObject readJson(Context ctx, String kind) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            return new JSONObject(prefs.getString(kind + "_json", "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static Bitmap loadImage(Context ctx, String key) {
        File f = new File(new File(ctx.getFilesDir(), "widgets"), key + ".jpg");
        if (!f.exists()) return null;
        return BitmapFactory.decodeFile(f.getAbsolutePath());
    }

    /** requestCode must be unique per distinct deep link (e.g. per releaseId) to avoid PendingIntent reuse. */
    static PendingIntent deepLink(Context ctx, int requestCode, String target, String query) {
        String uri = "fun.denanz.anime://" + target + (query != null ? "?" + query : "");
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(uri));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(ctx, requestCode, intent, flags);
    }
}
