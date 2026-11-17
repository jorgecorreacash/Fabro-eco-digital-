package com.fabro.browser.security

import java.net.URI
import java.net.URLEncoder

data class UrlValidationResult(
    val valid: Boolean,
    val normalizedUrl: String,
    val hostname: String,
    val isHttps: Boolean,
    val reason: String? = null
)

object SafeUrlValidator {

    private val privateHostRegex = Regex(
        "^(localhost|127\\.|10\\.|169\\.254\\.|192\\.168\\.|172\\.(1[6-9]|2\\d|3[01])\\.|0\\.0\\.0\\.0|\\[::1])",
        RegexOption.IGNORE_CASE
    )

    private val schemePrefixRegex = Regex("^[a-zA-Z][a-zA-Z\\d+.-]*:")

    private val dangerousExtensions = listOf(
        ".apk", ".exe", ".msi", ".bat", ".cmd", ".ps1", ".vbs", ".scr", ".jar", ".sh"
    )

    fun validateHttpsUrl(rawInput: String): UrlValidationResult {
        val trimmed = rawInput.trim()
        if (trimmed.isEmpty()) {
            return UrlValidationResult(false, "", "", false, "La dirección está vacía.")
        }

        val candidate = if (schemePrefixRegex.containsMatchIn(trimmed)) trimmed else "https://$trimmed"

        return try {
            val uri = URI(candidate)
            val scheme = (uri.scheme ?: "").lowercase()
            if (scheme != "https") {
                return UrlValidationResult(
                    valid = false,
                    normalizedUrl = "",
                    hostname = uri.host ?: "",
                    isHttps = false,
                    reason = "Solo se permiten conexiones cifradas HTTPS en FABRO Browser Android."
                )
            }

            val host = (uri.host ?: "").trim()
            if (host.isEmpty() || privateHostRegex.containsMatchIn(host)) {
                return UrlValidationResult(
                    valid = false,
                    normalizedUrl = "",
                    hostname = host,
                    isHttps = false,
                    reason = "Destino local o privado bloqueado por seguridad."
                )
            }

            UrlValidationResult(
                valid = true,
                normalizedUrl = uri.toString(),
                hostname = host,
                isHttps = true
            )
        } catch (_: Exception) {
            UrlValidationResult(false, "", "", false, "URL inválida.")
        }
    }

    fun resolveOmnibox(input: String, searchEngine: String = "google"): UrlValidationResult {
        val trimmed = input.trim()
        val looksLikeDomain = !trimmed.contains(" ") && trimmed.contains(".")
        if (schemePrefixRegex.containsMatchIn(trimmed) || looksLikeDomain) {
            return validateHttpsUrl(trimmed)
        }
        val encoded = URLEncoder.encode(trimmed, "UTF-8")
        val searchUrl = when (searchEngine) {
            "duckduckgo" -> "https://duckduckgo.com/?q=$encoded"
            "bing" -> "https://www.bing.com/search?q=$encoded"
            "scholar" -> "https://scholar.google.com/scholar?q=$encoded"
            else -> "https://www.google.com/search?q=$encoded"
        }
        return validateHttpsUrl(searchUrl)
    }

    fun isDangerousDownload(filename: String): Boolean {
        val lower = filename.trim().lowercase()
        return dangerousExtensions.any { lower.endsWith(it) }
    }
}
