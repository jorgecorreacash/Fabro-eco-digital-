package com.fabro.browser.ui

import android.webkit.PermissionRequest
import android.webkit.WebView
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.fabro.browser.browser.*
import com.fabro.browser.security.SafeUrlValidator

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FabroBrowserScreen(tabManager: BrowserTabManager) {
    val context = LocalContext.current
    val state by tabManager.state.collectAsState()
    val activeTab = state.activeTab

    var omniboxText by remember(activeTab?.id, activeTab?.url) {
        mutableStateOf(activeTab?.url ?: "https://es.wikipedia.org/")
    }
    var statusNotice by remember { mutableStateOf<String?>(null) }
    var pendingPermission by remember { mutableStateOf<PermissionRequest?>(null) }
    var aiSheetOpen by remember { mutableStateOf(false) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    Scaffold(
        topBar = {
            Column(modifier = Modifier.fillMaxWidth()) {
                // Multi-Tab Strip
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    state.tabs.forEachIndexed { idx, tab ->
                        FilterChip(
                            selected = idx == state.activeTabIndex,
                            onClick = { tabManager.selectTab(idx) },
                            label = {
                                Text(
                                    text = tab.title,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            },
                            trailingIcon = if (state.tabs.size > 1) {
                                {
                                    IconButton(
                                        onClick = { tabManager.closeTab(idx) },
                                        modifier = Modifier.size(18.dp)
                                    ) {
                                        Icon(Icons.Default.Close, contentDescription = "Cerrar")
                                    }
                                }
                            } else null,
                            modifier = Modifier.padding(end = 6.dp)
                        )
                    }
                    IconButton(
                        onClick = {
                            tabManager.openTab("OpenAlex", "https://openalex.org/")
                        }
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Nueva pestaña")
                    }
                }

                // Omnibox + Controls
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { webViewRef?.goBack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Atrás")
                    }
                    IconButton(onClick = { webViewRef?.goForward() }) {
                        Icon(Icons.Default.ArrowForward, contentDescription = "Adelante")
                    }
                    IconButton(onClick = { webViewRef?.reload() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Recargar")
                    }
                    OutlinedTextField(
                        value = omniboxText,
                        onValueChange = { omniboxText = it },
                        singleLine = true,
                        leadingIcon = {
                            Icon(Icons.Default.Lock, contentDescription = "HTTPS")
                        },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("https:// o búsqueda académica...") }
                    )
                    IconButton(
                        onClick = {
                            val resolved = SafeUrlValidator.resolveOmnibox(omniboxText)
                            if (resolved.valid) {
                                webViewRef?.loadUrl(resolved.normalizedUrl)
                                statusNotice = null
                            } else {
                                statusNotice = resolved.reason
                            }
                        }
                    ) {
                        Icon(Icons.Default.Search, contentDescription = "Ir")
                    }
                    IconButton(onClick = { aiSheetOpen = true }) {
                        Icon(Icons.Default.AutoAwesome, contentDescription = "FABRO AI")
                    }
                }

                // Honest Modality Status Bar
                if (activeTab != null) {
                    Surface(tonalElevation = 2.dp, modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = when (activeTab.modality) {
                                    AndroidTabModality.INTEGRATED_WEBVIEW -> "Modalidad: WebView Integrado"
                                    AndroidTabModality.EXTERNAL_CUSTOM_TAB -> "Pestaña externa (Chrome Custom Tab)"
                                    AndroidTabModality.EXTERNAL_REQUIRED -> "Modalidad: Externo requerido"
                                },
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            TextButton(
                                onClick = {
                                    if (CustomTabsHelper.openExternalCustomTab(context, activeTab.url)) {
                                        tabManager.markOpenedInCustomTab(activeTab.id)
                                    }
                                }
                            ) {
                                Text("Abrir en Custom Tab")
                            }
                        }
                    }
                }

                if (statusNotice != null) {
                    Text(
                        text = statusNotice ?: "",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (activeTab != null && activeTab.modality == AndroidTabModality.INTEGRATED_WEBVIEW) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        SafeWebViewFactory.createHardenedWebView(
                            context = ctx,
                            onPageStarted = { url -> omniboxText = url },
                            onPageFinished = { _, _ -> },
                            onSslBlocked = { msg -> statusNotice = msg },
                            onDownloadBlocked = { msg -> statusNotice = msg },
                            onPermissionPrompt = { req -> pendingPermission = req }
                        ).also {
                            webViewRef = it
                            it.loadUrl(activeTab.url)
                        }
                    },
                    update = { view ->
                        webViewRef = view
                    }
                )
            } else if (activeTab != null) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = activeTab.title,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Este portal se abre mediante Chrome Custom Tabs para respetar su seguridad y autenticación oficial.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = {
                            if (CustomTabsHelper.openExternalCustomTab(context, activeTab.url)) {
                                tabManager.markOpenedInCustomTab(activeTab.id)
                            }
                        }
                    ) {
                        Text("Abrir portal en Custom Tab")
                    }
                }
            }
        }
    }

    // Explicit interactive permission prompt dialog (never auto-grants camera/mic/geo)
    val permissionReq = pendingPermission
    if (permissionReq != null) {
        AlertDialog(
            onDismissRequest = {
                permissionReq.deny()
                pendingPermission = null
            },
            title = { Text("Permiso de sitio web") },
            text = { Text("El sitio ${permissionReq.origin} solicita permisos de hardware.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        permissionReq.grant(permissionReq.resources)
                        pendingPermission = null
                    }
                ) {
                    Text("Permitir")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        permissionReq.deny()
                        pendingPermission = null
                    }
                ) {
                    Text("Bloquear")
                }
            }
        )
    }

    if (aiSheetOpen) {
        ModalBottomSheet(onDismissRequest = { aiSheetOpen = false }) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = "FABRO AI ASSISTANT",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Compartí voluntariamente un texto para resumir, explicar, traducir o crear apuntes y fichas de estudio en tu cuenta FABRO.",
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
