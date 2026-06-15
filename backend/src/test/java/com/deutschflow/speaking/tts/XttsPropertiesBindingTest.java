package com.deutschflow.speaking.tts;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(SpringExtension.class)
@EnableConfigurationProperties(XttsProperties.class)
@TestPropertySource(properties = {
        "app.ai.xtts.base-url=https://example.ngrok-free.dev",
        "app.ai.xtts.connect-timeout-ms=2500",
        "app.ai.xtts.read-timeout-ms=12000",
        "app.ai.xtts.ngrok-skip-warning=true",
        "app.ai.xtts.seed=99"
})
class XttsPropertiesBindingTest {

    @Autowired
    XttsProperties props;

    @Test
    void bindsXttsConnectionSettings() {
        assertEquals("https://example.ngrok-free.dev", props.getBaseUrl());
        assertEquals(2500, props.getConnectTimeoutMs());
        assertEquals(12000, props.getReadTimeoutMs());
        assertTrue(props.isNgrokSkipWarning());
        assertEquals(99, props.getSeed());
        assertTrue(props.isConfigured());
    }
}
