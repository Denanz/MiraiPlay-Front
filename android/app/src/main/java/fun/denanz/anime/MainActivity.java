package fun.denanz.anime;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // System bars (status + navigation) are hidden ONLY while the player screen
    // is active. The web layer toggles this via the "Immersive" plugin; the rest
    // of the app keeps the normal Android UI visible.
    private boolean immersive = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ImmersivePlugin.class);
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        // Disable the native overscroll glow/stretch so the page can't be dragged
        // past its bounds (CSS overscroll-behavior covers Chromium, this covers
        // the WebView's own overscroll on older Android).
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        }
        applySystemUi();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Re-assert the current mode after regaining focus (e.g. after pulling
        // down the notification shade while in the player).
        if (hasFocus) applySystemUi();
    }

    public void setImmersive(boolean value) {
        immersive = value;
        runOnUiThread(this::applySystemUi);
    }

    private void applySystemUi() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), !immersive);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        int bars = WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars();
        if (immersive) {
            controller.hide(bars);
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else {
            controller.show(bars);
            // Keep the bars tinted to the app's dark background with light icons.
            getWindow().setStatusBarColor(0xFF07060B);
            getWindow().setNavigationBarColor(0xFF07060B);
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }
    }
}
