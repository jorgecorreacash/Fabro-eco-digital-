package com.fabro.browser

import com.fabro.browser.security.SafeUrlValidator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SafeUrlValidatorTest {

    @Test
    fun acceptsValidHttpsPortal() {
        val result = SafeUrlValidator.validateHttpsUrl("https://chatgpt.com/")
        assertTrue(result.valid)
        assertTrue(result.isHttps)
        assertEquals("chatgpt.com", result.hostname)
    }

    @Test
    fun rejectsCleartextHttpAndDangerousSchemes() {
        assertFalse(SafeUrlValidator.validateHttpsUrl("http://example.com").valid)
        assertFalse(SafeUrlValidator.validateHttpsUrl("javascript:alert(1)").valid)
        assertFalse(SafeUrlValidator.validateHttpsUrl("file:///etc/hosts").valid)
    }

    @Test
    fun blocksPrivateNetworkAndMetadataTargets() {
        assertFalse(SafeUrlValidator.validateHttpsUrl("https://127.0.0.1/").valid)
        assertFalse(SafeUrlValidator.validateHttpsUrl("https://169.254.169.254/").valid)
        assertFalse(SafeUrlValidator.validateHttpsUrl("https://192.168.0.10/").valid)
    }

    @Test
    fun detectsDangerousAndroidDownloads() {
        assertTrue(SafeUrlValidator.isDangerousDownload("malicioso.apk"))
        assertTrue(SafeUrlValidator.isDangerousDownload("script.sh"))
        assertFalse(SafeUrlValidator.isDangerousDownload("apunte_constitucional.pdf"))
    }
}
