package com.deutschflow.media.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3StorageService {

    private final S3Client s3Client;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${aws.s3.region}")
    private String region;

    /**
     * Uploads a file to AWS S3 and returns the public URL.
     * 
     * @param file The file to upload
     * @return The public URL of the uploaded file
     * @throws IOException If the file cannot be read
     */
    public String uploadFile(MultipartFile file) throws IOException {
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }

        String uniqueFilename = UUID.randomUUID().toString() + extension;

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(uniqueFilename)
                .contentType(file.getContentType())
                .build();

        log.info("Uploading file {} to S3 bucket {}", uniqueFilename, bucketName);

        s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        // Construct the public URL
        return String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, uniqueFilename);
    }
}
