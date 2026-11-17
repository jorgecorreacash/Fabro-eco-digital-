package com.fabro.browser.browser

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.util.UUID

enum class AndroidTabModality {
    INTEGRATED_WEBVIEW,
    EXTERNAL_REQUIRED,
    EXTERNAL_CUSTOM_TAB
}

data class AndroidBrowserTab(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val url: String,
    val modality: AndroidTabModality,
    val isLoading: Boolean = false
)

data class AndroidBrowserState(
    val activeProfileName: String = "Estudiante Principal",
    val tabs: List<AndroidBrowserTab> = listOf(
        AndroidBrowserTab(
            title = "Wikipedia",
            url = "https://es.wikipedia.org/",
            modality = AndroidTabModality.INTEGRATED_WEBVIEW
        )
    ),
    val activeTabIndex: Int = 0,
    val favorites: List<Pair<String, String>> = emptyList(),
    val history: List<Pair<String, String>> = emptyList()
) {
    val activeTab: AndroidBrowserTab?
        get() = tabs.getOrNull(activeTabIndex)
}

class BrowserTabManager {
    private val _state = MutableStateFlow(AndroidBrowserState())
    val state: StateFlow<AndroidBrowserState> = _state.asStateFlow()

    fun openTab(title: String, url: String, prefersExternalCustomTab: Boolean = false) {
        val modality = if (prefersExternalCustomTab) {
            AndroidTabModality.EXTERNAL_REQUIRED
        } else {
            AndroidTabModality.INTEGRATED_WEBVIEW
        }
        val newTab = AndroidBrowserTab(title = title, url = url, modality = modality)
        _state.update { s ->
            val updated = s.tabs + newTab
            s.copy(
                tabs = updated,
                activeTabIndex = updated.lastIndex,
                history = (listOf(title to url) + s.history).take(100)
            )
        }
    }

    fun selectTab(index: Int) {
        _state.update { s ->
            if (index in s.tabs.indices) s.copy(activeTabIndex = index) else s
        }
    }

    fun closeTab(index: Int) {
        _state.update { s ->
            if (s.tabs.size <= 1 || index !in s.tabs.indices) return@update s
            val nextTabs = s.tabs.toMutableList().apply { removeAt(index) }
            val nextIdx = s.activeTabIndex.coerceAtMost(nextTabs.lastIndex)
            s.copy(tabs = nextTabs, activeTabIndex = nextIdx)
        }
    }

    fun markOpenedInCustomTab(tabId: String) {
        _state.update { s ->
            s.copy(
                tabs = s.tabs.map {
                    if (it.id == tabId) it.copy(modality = AndroidTabModality.EXTERNAL_CUSTOM_TAB) else it
                }
            )
        }
    }

    fun toggleFavorite(title: String, url: String) {
        _state.update { s ->
            val exists = s.favorites.any { it.second == url }
            val next = if (exists) s.favorites.filterNot { it.second == url } else listOf(title to url) + s.favorites
            s.copy(favorites = next)
        }
    }

    fun switchProfile(name: String) {
        _state.update { s ->
            s.copy(activeProfileName = name)
        }
    }
}
