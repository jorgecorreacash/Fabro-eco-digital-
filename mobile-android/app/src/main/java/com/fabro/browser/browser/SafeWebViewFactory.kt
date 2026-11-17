package com.fabro.browser.browser

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import com.fabro.browser.security.SafeUrlValidator

object SafeWebViewFactory {

    @SuppressLint("SetJavaScriptEnabled")
    fun createHardenedWebView(
        context: Context,
        onPageStarted: (String) -> Unit,
        onPageFinished: (String, String) -> Unit,
        onSslBlocked: (String) -> Unit,
        onDownloadBlocked: (String) -> Unit,
        onPermissionPrompt: (PermissionRequest) -> Unit
    ): WebView {
        val webView = WebView(context)
        val settings = webView.settings

        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        @Suppress("DEPRECATION")
        settings.allowFileAccessFromFileURLs = false
        @Suppress("DEPRECATION")
        settings.allowUniversalAccessFromFileURLs = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.builtInZoomControls = true
        settings.displayZoomControls = false

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = true
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val targetUrl = request?.url?.toString() ?: return true
                val check = SafeUrlValidator.validateHttpsUrl(targetUrl)
                return !check.valid
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                if (url != null) onPageStarted(url)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                onPageFinished(url ?: "", view?.title ?: "")
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?
            ) {
                handler?.cancel()
                onSslBlocked("Certificado SSL inválido o no confiable. Conexión cancelada.")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request != null) {
                    onPermissionPrompt(request)
                }
            }
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            val check = SafeUrlValidator.validateHttpsUrl(url)
            if (!check.valid) {
                onDownloadBlocked("Descarga bloqueada: origen sin HTTPS válido.")
                return@setDownloadListener
            }
            val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)
            if (SafeUrlValidator.isDangerousDownload(filename)) {
                onDownloadBlocked("Descarga bloqueada por extensión potencialmente peligrosa: $filename")
                return@setDownloadListener
            }
            val dmRequest = DownloadManager.Request(Uri.parse(check.normalizedUrl)).apply {
                setMimeType(mimeType)
                addRequestHeader("User-Agent", userAgent)
                setTitle(filename)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
            }
            val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(dmRequest)
        }

        return webView
    }

    fun clearAllSessionData(webView: WebView? = null) {
        CookieManager.getInstance().removeAllCookies(null)
        CookieManager.getInstance().flush()
        WebStorage.getInstance().deleteAllData()
        webView?.clearCache(true)
        webView?.clearHistory()
    }
}
