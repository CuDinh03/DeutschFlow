"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function TeacherMaterialsPage() {
    const params = useParams();
    const classId = params.id;
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError("Vui lòng chọn một tài liệu (PDF/Word).");
            return;
        }

        setIsProcessing(true);
        setStatus("Đang tải lên...");
        setError(null);
        setDownloadUrl(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const token = localStorage.getItem("accessToken");
            const res = await fetch(`/api/teacher/materials/generate-pptx`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                throw new Error("Lỗi tải lên: " + res.statusText);
            }

            const data = await res.json();
            if (data.jobId) {
                setJobId(data.jobId);
                setStatus("Đang xử lý AI...");
            }
        } catch (err: any) {
            setError(err.message);
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        let eventSource: EventSource | null = null;

        if (jobId && isProcessing) {
            const token = localStorage.getItem("accessToken");
            // Appending token to URL is required for SSE since we can't set headers easily in native EventSource
            // For real production, using a query param or a cookie is needed if using native EventSource.
            // Assuming the backend accepts token via query param (or we just allow it temporarily if security allows).
            // Another approach is using fetch-event-source library, but let's use native for now.
            const sseUrl = `/api/teacher/materials/jobs/${jobId}/sse?access_token=${token}`;
            eventSource = new EventSource(sseUrl);

            eventSource.addEventListener("connected", (e: any) => {
                console.log("SSE Connected:", e.data);
            });

            eventSource.addEventListener("COMPLETED", (e: any) => {
                setIsProcessing(false);
                setStatus("Xong!");
                eventSource?.close();
                
                // Parse resultPayload
                if (e.data) {
                    try {
                        const payload = JSON.parse(e.data);
                        const link = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${payload.fileData}`;
                        setDownloadUrl(link);
                    } catch (parseError) {
                        console.error("Error parsing payload", parseError);
                    }
                }
            });

            eventSource.addEventListener("FAILED", (e: any) => {
                setIsProcessing(false);
                setStatus("Lỗi");
                setError(e.data || "Có lỗi xảy ra khi tạo bài giảng.");
                eventSource?.close();
            });

            eventSource.onerror = (err) => {
                console.error("SSE Error", err);
                // We don't close immediately to allow reconnection, but if it fails too much we should
            };
        }

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [jobId, isProcessing]);

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6 text-slate-800">Tạo Bài Giảng bằng AI</h1>
            <p className="mb-4 text-slate-600">Tải lên tài liệu PDF hoặc Word để hệ thống tự động sinh bài thuyết trình PPTX.</p>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <input 
                    type="file" 
                    accept=".pdf,.docx" 
                    onChange={handleFileChange}
                    className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
                    disabled={isProcessing}
                />

                <button 
                    onClick={handleUpload}
                    disabled={!file || isProcessing}
                    className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-slate-300 hover:bg-blue-700 transition"
                >
                    {isProcessing ? "Đang xử lý..." : "Tạo PPTX"}
                </button>

                {status && (
                    <div className="mt-4 text-sm font-medium text-slate-700">
                        Trạng thái: {status}
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
                        {error}
                    </div>
                )}

                {downloadUrl && (
                    <div className="mt-6">
                        <a 
                            href={downloadUrl} 
                            download="Baigiang.pptx"
                            className="inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                        >
                            Tải xuống file PowerPoint
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
