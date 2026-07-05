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

/** "Расписание · сегодня" — up to 4 rows, tap opens that title's release page. */
public class ScheduleWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] appWidgetIds) {
        for (int id : appWidgetIds) updateOne(context, mgr, id);
    }

    private void updateOne(Context context, AppWidgetManager mgr, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_schedule);
        JSONObject data = WidgetUtils.readJson(context, "schedule");
        JSONArray items = data.optJSONArray("items");

        int[] rowIds = { R.id.row1, R.id.row2, R.id.row3, R.id.row4 };
        int[] thumbIds = { R.id.thumb1, R.id.thumb2, R.id.thumb3, R.id.thumb4 };
        int[] titleIds = { R.id.title1, R.id.title2, R.id.title3, R.id.title4 };
        int[] timeIds = { R.id.time1, R.id.time2, R.id.time3, R.id.time4 };

        int count = items != null ? items.length() : 0;
        views.setViewVisibility(R.id.empty_state, count == 0 ? View.VISIBLE : View.GONE);

        for (int i = 0; i < rowIds.length; i++) {
            JSONObject item = i < count ? items.optJSONObject(i) : null;
            if (item == null) {
                views.setViewVisibility(rowIds[i], View.GONE);
                continue;
            }
            views.setViewVisibility(rowIds[i], View.VISIBLE);

            String releaseId = item.optString("releaseId", "");
            views.setTextViewText(titleIds[i], item.optString("title", ""));
            views.setTextViewText(timeIds[i], item.optString("sub", ""));

            Bitmap bmp = WidgetUtils.loadImage(context, "schedule_" + releaseId);
            if (bmp != null) views.setImageViewBitmap(thumbIds[i], bmp);

            views.setOnClickPendingIntent(rowIds[i],
                WidgetUtils.deepLink(context, ("release:" + releaseId).hashCode(), "release", "releaseId=" + releaseId));
        }

        mgr.updateAppWidget(widgetId, views);
    }
}
