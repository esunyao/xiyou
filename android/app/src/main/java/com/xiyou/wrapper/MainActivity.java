package com.xiyou.wrapper;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

    private String injectJS = "";
    private String injectCSS = "";
    private int errorCount = 0;
    private WebView webView;
    private static final int PERMISSION_REQUEST_CODE = 100;
    private PermissionRequest pendingPermissionRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 请求权限
        requestPermissions();

        // 读取注入文件
        loadInjectFiles();

        // 配置 WebView
        this.bridge.getWebView().post(() -> {
            webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();

            // 允许缩放 - 桌面版体验
            settings.setSupportZoom(true);
            settings.setBuiltInZoomControls(true);
            settings.setDisplayZoomControls(true);
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);

            // 设置默认缩放级别为 40%
            webView.setInitialScale(40);

            // 其他设置
            settings.setDomStorageEnabled(true);
            settings.setAllowContentAccess(true);
            settings.setAllowFileAccess(true);
            settings.setJavaScriptEnabled(true);

            // 关键：允许媒体播放不需要用户手势（WebRTC 需要）
            settings.setMediaPlaybackRequiresUserGesture(false);

            // 关键：允许加载混合内容（HTTPS 页面中的 HTTP 资源）
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setAllowContentAccess(true);
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);

            // 设置缓存
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

            // 设置网络超时时间
            webView.setHorizontalScrollBarEnabled(false);
            webView.setVerticalScrollBarEnabled(false);

            // 模拟桌面版 User-Agent (包含 Chrome 版本)
            String desktopUserAgent = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36";
            settings.setUserAgentString(desktopUserAgent);

            // WebChromeClient - 处理麦克风和摄像头权限
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    android.util.Log.i("xiyou", "Permission request from: " + request.getOrigin());
                    android.util.Log.i("xiyou", "Permission resources: " + java.util.Arrays.toString(request.getResources()));

                    // 直接授予权限
                    request.grant(request.getResources());
                    android.util.Log.i("xiyou", "Permission granted automatically");
                }

                @Override
                public void onGeolocationPermissionsShowPrompt(String origin, android.webkit.GeolocationPermissions.Callback callback) {
                    callback.invoke(origin, true, false);
                }
            });

            // 处理下载
            webView.setDownloadListener(new DownloadListener() {
                @Override
                public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                    android.util.Log.i("xiyou", "Download start: url=" + url);

                    try {
                        String cookies = CookieManager.getInstance().getCookie(url);
                        DownloadManager.Request downloadRequest = new DownloadManager.Request(Uri.parse(url));
                        downloadRequest.setMimeType(mimeType);
                        downloadRequest.addRequestHeader("cookie", cookies);
                        downloadRequest.addRequestHeader("User-Agent", userAgent);
                        downloadRequest.setDescription("下载文件");
                        String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                        downloadRequest.setTitle(fileName);
                        downloadRequest.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                        downloadRequest.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

                        DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                        long downloadId = dm.enqueue(downloadRequest);
                        android.util.Log.i("xiyou", "Download enqueued, id=" + downloadId);

                        Intent intent = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
                        startActivity(intent);
                    } catch (Exception e) {
                        android.util.Log.e("xiyou", "Download failed: " + e.getMessage(), e);
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW);
                            intent.setData(Uri.parse(url));
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception e2) {
                            android.util.Log.e("xiyou", "Open browser failed: " + e2.getMessage(), e2);
                        }
                    }
                }
            });

            // 设置 WebViewClient
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageStarted(WebView view, String url, Bitmap favicon) {
                    super.onPageStarted(view, url, favicon);
                    android.util.Log.i("xiyou", "Page started: " + url);
                    errorCount = 0;
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    android.util.Log.i("xiyou", "Page finished: " + url);

                    // 注入桌面版 viewport meta 标签
                    String viewportScript = "(function(){" +
                        "var meta = document.createElement('meta');" +
                        "meta.name = 'viewport';" +
                        "meta.content = 'width=1200, initial-scale=0.5, user-scalable=yes, maximum-scale=5';" +
                        "document.head.appendChild(meta);" +
                        "})();";
                    view.evaluateJavascript(viewportScript, null);

                    // 注入 CSS
                    if (!injectCSS.isEmpty()) {
                        String cssScript = "(function(){" +
                            "var style = document.createElement('style');" +
                            "style.textContent = " + escapeString(injectCSS) + ";" +
                            "document.head.appendChild(style);" +
                            "})();";
                        view.evaluateJavascript(cssScript, null);
                    }
                    // 注入 JS
                    if (!injectJS.isEmpty()) {
                        view.evaluateJavascript(injectJS, null);
                    }
                }

                @Override
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    String url = request.getUrl().toString();
                    String errorDesc = error.getDescription().toString();
                    android.util.Log.e("xiyou", "WebResource error: url=" + url + ", error=" + errorDesc);
                    errorCount++;
                    super.onReceivedError(view, request, error);
                }

                @Override
                public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                    String url = request.getUrl().toString();
                    int statusCode = errorResponse.getStatusCode();
                    android.util.Log.e("xiyou", "HTTP error: url=" + url + ", statusCode=" + statusCode);
                    errorCount++;
                    super.onReceivedHttpError(view, request, errorResponse);
                }

                @Override
                public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
                    android.util.Log.w("xiyou", "SSL Error: " + error);
                    handler.proceed();
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    android.util.Log.i("xiyou", "Loading URL: " + url);
                    view.loadUrl(url);
                    return true;
                }
            });

            // 直接加载外部网站
            android.util.Log.i("xiyou", "Loading URL: https://student.xiyouyingyu.com/");
            webView.loadUrl("https://student.xiyouyingyu.com/");
        });
    }

    private void requestPermissions() {
        String[] permissions = {
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE
        };

        boolean needPermission = false;
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                needPermission = true;
                break;
            }
        }

        if (needPermission) {
            ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            for (int i = 0; i < permissions.length; i++) {
                String result = (grantResults[i] == PackageManager.PERMISSION_GRANTED) ? "GRANTED" : "DENIED";
                android.util.Log.i("xiyou", "Permission " + permissions[i] + " = " + result);
            }

            // 如果有等待中的权限请求，授予它
            if (pendingPermissionRequest != null) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                    android.util.Log.i("xiyou", "Pending permission granted");
                } else {
                    pendingPermissionRequest.deny();
                    android.util.Log.i("xiyou", "Pending permission denied");
                }
                pendingPermissionRequest = null;
            }
        }
    }

    private void loadInjectFiles() {
        try {
            InputStreamReader isrCSS = new InputStreamReader(getAssets().open("public/user/inject.css"), StandardCharsets.UTF_8);
            BufferedReader brCSS = new BufferedReader(isrCSS);
            StringBuilder cssContent = new StringBuilder();
            String line;
            while ((line = brCSS.readLine()) != null) {
                cssContent.append(line).append("\n");
            }
            brCSS.close();
            injectCSS = cssContent.toString();

            InputStreamReader isrJS = new InputStreamReader(getAssets().open("public/user/inject.js"), StandardCharsets.UTF_8);
            BufferedReader brJS = new BufferedReader(isrJS);
            StringBuilder jsContent = new StringBuilder();
            while ((line = brJS.readLine()) != null) {
                jsContent.append(line).append("\n");
            }
            brJS.close();
            injectJS = jsContent.toString();

            android.util.Log.i("xiyou", "Inject files loaded successfully, JS length=" + injectJS.length() + ", CSS length=" + injectCSS.length());
        } catch (Exception e) {
            android.util.Log.e("xiyou", "Failed to load inject files: " + e.getMessage(), e);
        }
    }

    private String escapeString(String s) {
        return s.replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
