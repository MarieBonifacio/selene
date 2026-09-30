package io.github.mariebonifacio.selene;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/* Selene sous Android. Le partage (« Partager » → Selene) arrive comme un Intent ACTION_SEND ; il est rendu à la page sous
   la forme qu'elle connaît déjà, celle du Web Share Target de la PWA : index.html?title=…&text=…, qu'elle dépose dans
   la boîte de réception une fois les données prêtes (docs/android.md). */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    partage(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    partage(intent);
  }

  private void partage(Intent intent) {
    if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
    String type = intent.getType(), text = intent.getStringExtra(Intent.EXTRA_TEXT), title = intent.getStringExtra(Intent.EXTRA_SUBJECT);
    if (type == null || !type.startsWith("text/") || text == null) return;
    Uri.Builder u = Uri.parse(getBridge().getLocalUrl()).buildUpon().path("/index.html").appendQueryParameter("text", text);
    if (title != null) u.appendQueryParameter("title", title);
    String url = u.build().toString();
    getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(url));
    setIntent(new Intent(Intent.ACTION_MAIN)); // déposé une fois : ni une rotation ni un retour ne le rejouent
  }
}
