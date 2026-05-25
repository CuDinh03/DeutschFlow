package com.deutschflow.media.service;

import com.deutschflow.config.S3BucketContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.IOException;
import java.time.Duration;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3StorageService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final S3BucketContext bucketContext;

    public S3UploadResult uploadFile(MultipartFile file, String category) throws IOException {
        String originalFilename = file.getOriginalFilename();
        String extension = "";

        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }

        String folder = (category != null && !category.trim().isEmpty()) ? category.trim().toLowerCase() : "general";
        String uniqueFilename = UUID.randomUUID().toString() + extension;
        String s3Key = folder + "/" + uniqueFilename;

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketContext.bucketName())
                .key(s3Key)
                .contentType(file.getContentType())
                .build();

        log.info("Uploading file {} to S3 bucket {} ({})", s3Key, bucketContext.bucketName(), bucketContext.region());

        s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        String url = bucketContext.publicObjectUrl(s3Key);
        return new S3UploadResult(s3Key, url);
    }

    public String uploadFile(MultipartFile file) throws IOException {
        S3UploadResult result = uploadFile(file, "general");
        return result.getUrl();
    }

    public void deleteFile(String s3Key) {
        log.info("Deleting file {} from S3 bucket {}", s3Key, bucketContext.bucketName());
        DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                .bucket(bucketContext.bucketName())
                .key(s3Key)
                .build();
        s3Client.deleteObject(deleteObjectRequest);
    }

    public String generatePresignedUrl(String objectKey, String contentType) {
        PutObjectRequest objectRequest = PutObjectRequest.builder()
                .bucket(bucketContext.bucketName())
                .key(objectKey)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(15))
                .putObjectRequest(objectRequest)
                .build();

        PresignedPutObjectRequest presignedRequest = s3Presigner.presignPutObject(presignRequest);

        log.info("Generated Presigned URL for object: {}", objectKey);

        return presignedRequest.url().toString();
    }

    @lombok.Value
    public static class S3UploadResult {
        String s3Key;
        String url;
    }
}
