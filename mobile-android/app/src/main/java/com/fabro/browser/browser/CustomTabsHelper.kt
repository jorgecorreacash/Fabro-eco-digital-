package com.fabro.browser.browser

import android.content.Context
import android.graphics.Color
import android.net.Uri
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import com.fabro.browser.security.SafeUrlValidator

object CustomTabsHelper {

    /**
     * Launches an external portal inside Chrome Custom Tabs (isolated external session).
     * Never mislabeled as an integrated FABRO tab.
     */
    fun openExternalCustomTab(context: Context, rawUrl: String): Boolean {
        val check = SafeUrlValidator.validateHttpsUrl(rawUrl)
        if (!check.valid) return false

        val colorParams = CustomTabColorSchemeParams.Builder()
            .setToolbarColor(Color.parseColor("#0F1623"))
            .setNavigationBarColor(Color.parseColor("#090D16"))
            .build()

        val customTabsIntent = CustomTabsIntent.Builder()
            .setDefaultColorSchemeParams(colorParams)
            .setShowTitle(true)
            .setUrlBarHidingEnabled(false)
            .build()

        customTabsIntent.launchUrl(context, Uri.parse(check.normalizedUrl))
        return true
    }
}
