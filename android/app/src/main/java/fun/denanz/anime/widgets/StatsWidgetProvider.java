package fun.denanz.anime.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

import fun.denanz.anime.R;

/** Watch streak + a headline number. Whole tile taps into the profile/stats page. */
public class StatsWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] appWidgetIds) {
        for (int id : appWidgetIds) updateOne(context, mgr, id);
    }

    private void updateOne(Context context, AppWidgetManager mgr, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_stats);
        JSONObject data = WidgetUtils.readJson(context, "stats");

        int streak = data.optInt("streak", 0);
        int episodes = data.optInt("episodes", 0);

        views.setTextViewText(R.id.streak_value, "🔥 " + streak + (streak == 1 ? " день" : " дней"));
        views.setTextViewText(R.id.episodes_value, episodes + " серий просмотрено");

        views.setOnClickPendingIntent(R.id.root, WidgetUtils.deepLink(context, 1001, "stats", null));

        mgr.updateAppWidget(widgetId, views);
    }
}
