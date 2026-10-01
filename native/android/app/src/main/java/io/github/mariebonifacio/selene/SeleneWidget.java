package io.github.mariebonifacio.selene;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/* Le widget d'écran d'accueil (ADR 24) : la lune du jour et les trois choses qui attendent. Il ne lit ni ne calcule
   rien lui-même : il montre ce que Selene lui a dit en dernier (WidgetPlugin), gardé dans des préférences privées.
   Toucher le widget ouvre Selene ; « + » ouvre la capture (le lien selene://capture, comme ailleurs). */
public class SeleneWidget extends AppWidgetProvider {
  static final String PREFS = "selene-widget";

  @Override
  public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
    mgr.updateAppWidget(ids, views(ctx));
  }

  /* Redessine tous les widgets posés, après que la page a envoyé du nouveau. */
  static void refresh(Context ctx) {
    AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
    int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SeleneWidget.class));
    if (ids.length > 0) mgr.updateAppWidget(ids, views(ctx));
  }

  static RemoteViews views(Context ctx) {
    SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_selene);
    v.setTextViewText(R.id.widget_moon, p.getString("moon", ctx.getString(R.string.app_name)));
    String lines = p.getString("lines", "");
    v.setTextViewText(R.id.widget_lines, lines.isEmpty() ? ctx.getString(R.string.widget_empty) : lines);
    int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
    Intent open = new Intent(ctx, MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
    v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(ctx, 0, open, flags));
    Intent capture = new Intent(Intent.ACTION_VIEW, Uri.parse("selene://capture")).setPackage(ctx.getPackageName());
    v.setOnClickPendingIntent(R.id.widget_capture, PendingIntent.getActivity(ctx, 1, capture, flags));
    return v;
  }
}
