package com.deutschflow.vocabulary;

import com.deutschflow.vocabulary.service.IpaNormalization;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IpaNormalizationTest {

    @Test
    void keepsBracketForm() {
        assertThat(IpaNormalization.toBracketForm("[nˈɛːɜ]")).isEqualTo("[nˈɛːɜ]");
    }

    @Test
    void convertsSlashesToBrackets() {
        assertThat(IpaNormalization.toBracketForm("/ˈʃtʁaːsə/")).isEqualTo("[ˈʃtʁaːsə]");
    }

    @Test
    void wrapsBareIpa() {
        assertThat(IpaNormalization.toBracketForm("ˈbaːxən")).isEqualTo("[ˈbaːxən]");
    }

    @Test
    void nullOrBlankReturnsNull() {
        assertThat(IpaNormalization.toBracketForm(null)).isNull();
        assertThat(IpaNormalization.toBracketForm("   ")).isNull();
    }
}
