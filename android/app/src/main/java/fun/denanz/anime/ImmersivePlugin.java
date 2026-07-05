package fun.denanz.anime;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges immersive (system-bar hiding) on/off to the web layer so that the
 * status + navigation bars are hidden only while the player is open.
 */
@CapacitorPlugin(name = "Immersive")
public class ImmersivePlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        toggle(call, true);
    }

    @PluginMethod
    public void disable(PluginCall call) {
        toggle(call, false);
    }

    private void toggle(PluginCall call, boolean value) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).setImmersive(value);
        }
        call.resolve();
    }
}
