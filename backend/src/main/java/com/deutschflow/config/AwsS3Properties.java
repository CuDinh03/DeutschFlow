package com.deutschflow.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "aws.s3")
public class AwsS3Properties {

    private String bucketName = "";
    private String region = "ap-southeast-1";
    private String accessKey = "";
    private String secretKey = "";

    public boolean isConfigured() {
        return bucketName != null && !bucketName.isBlank()
                && accessKey != null && !accessKey.isBlank()
                && secretKey != null && !secretKey.isBlank();
    }
}
