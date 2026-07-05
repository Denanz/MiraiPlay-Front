package fun.denanz.anime.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import fun.denanz.anime.R;

/** "Продолжить смотреть" — up to 3 tiles, tap resumes playback via the app's own resumeWatch(). */
public class ContinueWatchingWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] appWidgetIds) {
        for (int id : appWidgetIds) updateOne(context, mgr, id);
    }

    private void updateOne(Context context, AppWidgetManager mgr, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_continue_watching);
        JSONObject data = WidgetUtils.readJson(context, "continue");
        JSONArray items = data.optJSONArray("items");

        int[] tileIds = { R.id.tile1, R.id.tile2, R.id.tile3 };
        int[] thumbIds = { R.id.thumb1, R.id.thumb2, R.id.thumb3 };
        int[] titleIds = { R.id.title1, R.id.title2, R.id.title3 };
        int[] subIds = { R.id.sub1, R.id.sub2, R.id.sub3 };
        int[] progressIds = { R.id.progress1, R.id.progress2, R.id.progress3 };

        int count = items != null ? items.length() : 0;
        views.setViewVisibility(R.id.empty_state, count == 0 ? View.VISIBLE : View.GONE);

        for (int i = 0; i < tileIds.length; i++) {
            JSONObject item = i < count ? items.optJSONObject(i) : null;
            if (item == null) {
                views.setViewVisibility(tileIds[i], View.GONE);
                continue;
            }
            views.setViewVisibility(tileIds[i], View.VISIBLE);

            String releaseId = item.optString("releaseId", "");
            String title = item.optString("title", "");
            int position = item.optInt("episodePosition", 0);
            int total = item.optInt("episodesTotal", 0);
            int pct = item.optInt("pct", 0);

            views.setTextViewText(titleIds[i], title);
            views.setTextViewText(subIds[i], total > 0 ? ("Серия " + position + "/" + total) : ("Серия " + position));
            views.setProgressBar(progressIds[i], 100, Math.max(0, Math.min(100, pct)), false);

            Bitmap bmp = WidgetUtils.loadImage(context, "continue_" + releaseId);
            if (bmp != null) views.setImageViewBitmap(thumbIds[i], bmp);

            views.setOnClickPendingIntent(tileIds[i],
                WidgetUtils.deepLink(context, ("resume:" + releaseId).hashCode(), "resume", "releaseId=" + releaseId));
        }

        mgr.updateAppWidget(widgetId, views);
    }
}
