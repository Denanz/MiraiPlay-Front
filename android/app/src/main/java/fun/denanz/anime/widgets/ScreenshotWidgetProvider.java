package fun.denanz.anime.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Random;

import fun.denanz.anime.R;

/**
 * A random shot from the last dozen or so screenshots, as a big image tile.
 * Rotates on its own: onUpdate() re-rolls the pick every time it's called —
 * by the OS's own widget update timer (res/xml/widget_screenshot_info.xml,
 * 30 min — the Android-enforced minimum) as well as whenever the Gallery page
 * resyncs the pool. Tap opens that shot's release page if known, else the Gallery.
 */
public class ScreenshotWidgetProvider extends AppWidgetProvider {
    private static final Random RANDOM = new Random();

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] appWidgetIds) {
        for (int id : appWidgetIds) updateOne(context, mgr, id);
    }

    private void updateOne(Context context, AppWidgetManager mgr, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_screenshot);
        JSONObject data = WidgetUtils.readJson(context, "screenshot");
        JSONArray pool = data.optJSONArray("items");

        JSONObject pick = (pool != null && pool.length() > 0) ? pool.optJSONObject(RANDOM.nextInt(pool.length())) : null;

        views.setViewVisibility(R.id.empty_state, pick == null ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.shot_image, pick == null ? View.GONE : View.VISIBLE);

        String releaseTarget = "gallery";
        String releaseQuery = null;

        if (pick != null) {
            String id = pick.optString("id", "");
            views.setTextViewText(R.id.shot_title, pick.optString("title", "Кадр"));
            views.setTextViewText(R.id.shot_sub, pick.optString("sub", ""));

            Bitmap bmp = WidgetUtils.loadImage(context, "screenshot_" + id);
            if (bmp != null) views.setImageViewBitmap(R.id.shot_image, bmp);

            String releaseId = pick.optString("releaseId", "");
            if (!releaseId.isEmpty()) {
                releaseTarget = "release";
                releaseQuery = "releaseId=" + releaseId;
            }
        }

        views.setOnClickPendingIntent(R.id.root, WidgetUtils.deepLink(context, 1002, releaseTarget, releaseQuery));

        mgr.updateAppWidget(widgetId, views);
    }
}
