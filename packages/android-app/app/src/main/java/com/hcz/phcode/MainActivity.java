package com.hcz.phcode;

import android.app.Activity;
import android.os.Bundle;

import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoView;

import java.io.IOException;
import java.io.InputStream;

import fi.iki.elonen.NanoHTTPD;

public class MainActivity extends Activity {
    private static final int PORT = 27120;
    private static GeckoRuntime sRuntime;
    private GeckoSession session;
    private AssetServer assetServer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            assetServer = new AssetServer();
            assetServer.start();
        } catch (IOException e) {
            throw new RuntimeException("Failed to start asset server", e);
        }

        GeckoView view = new GeckoView(this);
        setContentView(view);

        session = new GeckoSession();
        session.setContentDelegate(new GeckoSession.ContentDelegate() {});
        if (sRuntime == null) {
            sRuntime = GeckoRuntime.create(this);
        }
        session.open(sRuntime);
        view.setSession(session);
        session.loadUri("http://127.0.0.1:" + assetServer.getListeningPort() + "/index.html");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (assetServer != null) {
            assetServer.stop();
        }
        if (session != null) {
            session.close();
        }
    }

    @Override
    public void onBackPressed() {
        if (session != null) {
            session.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private class AssetServer extends NanoHTTPD {
        AssetServer() {
            super(PORT);
        }

        @Override
        public Response serve(IHTTPSession session) {
            String uri = session.getUri();
            if (uri == null || uri.equals("/")) {
                uri = "/index.html";
            }
            try {
                String path = uri.startsWith("/") ? uri.substring(1) : uri;
                InputStream is = getAssets().open(path);
                String mimeType = mimeTypeForFile(uri);
                Response resp = newFixedLengthResponse(Response.Status.OK, mimeType, is, is.available());
                resp.addHeader("Access-Control-Allow-Origin", "*");
                resp.addHeader("Cross-Origin-Opener-Policy", "same-origin");
                resp.addHeader("Cross-Origin-Embedder-Policy", "require-corp");
                return resp;
            } catch (IOException e) {
                return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "404");
            }
        }

        private String mimeTypeForFile(String uri) {
            if (uri.endsWith(".html")) return "text/html; charset=UTF-8";
            if (uri.endsWith(".js")) return "application/javascript; charset=UTF-8";
            if (uri.endsWith(".css")) return "text/css; charset=UTF-8";
            if (uri.endsWith(".wasm")) return "application/wasm";
            if (uri.endsWith(".png")) return "image/png";
            if (uri.endsWith(".ico")) return "image/x-icon";
            if (uri.endsWith(".svg")) return "image/svg+xml";
            if (uri.endsWith(".json")) return "application/json; charset=UTF-8";
            if (uri.endsWith(".tar")) return "application/x-tar";
            return "application/octet-stream";
        }
    }
}
