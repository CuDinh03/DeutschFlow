package com.deutschflow.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AwsS3ConfigTest {

    @Test
    void normalizeBucketLocation_usEast1() {
        assertEquals("us-east-1", AwsS3Config.normalizeBucketLocation(null));
        assertEquals("us-east-1", AwsS3Config.normalizeBucketLocation(""));
    }

    @Test
    void normalizeBucketLocation_apSoutheast() {
        assertEquals("ap-southeast-1", AwsS3Config.normalizeBucketLocation("ap-southeast-1"));
    }

    @Test
    void normalizeBucketLocation_legacyEu() {
        assertEquals("eu-west-1", AwsS3Config.normalizeBucketLocation("EU"));
    }
}
