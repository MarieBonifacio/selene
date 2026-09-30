package io.github.mariebonifacio.selene;

import android.content.Context;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;

/* Ce que la page dit au widget (src/native/boot.js → Capacitor.Plugins.SeleneWidget.update) : { moon, lines[] }.
   Trois lignes au plus, chacune bornée : le widget n'a pas la place d'un roman, et une page ne doit pas pouvoir
   remplir les préférences de l'app. */
@CapacitorPlugin(name = "SeleneWidget")
public class WidgetPlugin extends Plugin {
  private static final int MAX_LINES = 3, MAX_CHARS = 120;

  @PluginMethod
  public void update(PluginCall call) {
    String moon = clip(call.getString("moon", ""));
    JSArray lines = call.getArray("lines", new JSArray());
    StringBuilder text = new StringBuilder();
    try {
      for (int i = 0; i < Math.min(lines.length(), MAX_LINES); i++) {
        if (text.length() > 0) text.append('\n');
        text.append("· ").append(clip(lines.getString(i)));
      }
    } catch (JSONException e) {
      call.reject("lignes illisibles");
      return;
    }
    Context ctx = getContext();
    ctx.getSharedPreferences(SeleneWidget.PREFS, Context.MODE_PRIVATE).edit()
      .putString("moon", moon).putString("lines", text.toString()).apply();
    SeleneWidget.refresh(ctx);
    call.resolve();
  }

  private static String clip(String s) {
    if (s == null) return "";
    String t = s.replaceAll("\\s+", " ").trim();
    return t.length() > MAX_CHARS ? t.substring(0, MAX_CHARS - 1) + "…" : t;
  }
}
