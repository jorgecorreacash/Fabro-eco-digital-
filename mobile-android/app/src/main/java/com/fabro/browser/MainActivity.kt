package com.fabro.browser

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import com.fabro.browser.browser.BrowserTabManager
import com.fabro.browser.ui.FabroBrowserScreen

class MainActivity : ComponentActivity() {
    private val tabManager = BrowserTabManager()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                FabroBrowserScreen(tabManager = tabManager)
            }
        }
    }
}
