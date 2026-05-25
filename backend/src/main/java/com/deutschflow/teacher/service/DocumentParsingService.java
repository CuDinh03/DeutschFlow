package com.deutschflow.teacher.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;

@Service
@Slf4j
public class DocumentParsingService {

    public String encodeFileToBase64(MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        // Check size again just in case (5MB = 5 * 1024 * 1024)
        if (bytes.length > 5 * 1024 * 1024) {
            log.warn("File is larger than 5MB, consider size limits for LLM APIs.");
        }
        return Base64.getEncoder().encodeToString(bytes);
    }

    public String determineMimeType(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isEmpty()) {
            return contentType;
        }
        String filename = file.getOriginalFilename();
        if (filename != null) {
            if (filename.toLowerCase().endsWith(".pdf")) return "application/pdf";
            if (filename.toLowerCase().endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }
        return "application/octet-stream";
    }

    /**
     * Fallback method to extract raw text if Gemini file parsing fails.
     */
    public String extractTextFallback(MultipartFile file) {
        String filename = file.getOriginalFilename();
        try (InputStream is = file.getInputStream()) {
            if (filename != null && filename.toLowerCase().endsWith(".pdf")) {
                try (PDDocument document = org.apache.pdfbox.Loader.loadPDF(file.getBytes())) {
                    PDFTextStripper stripper = new PDFTextStripper();
                    return stripper.getText(document);
                }
            } else if (filename != null && filename.toLowerCase().endsWith(".docx")) {
                try (XWPFDocument document = new XWPFDocument(is);
                     XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
                    return extractor.getText();
                }
            }
        } catch (Exception e) {
            log.error("Failed to extract text fallback for {}: {}", filename, e.getMessage());
        }
        return null;
    }
}
