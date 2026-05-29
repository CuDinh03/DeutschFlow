'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTracking } from '@/hooks/useTracking';
import api from '@/lib/api';

interface PracticeExercise {
    id: number;
    exerciseType: string;
    cefrLevel: string;
    skillType: string;
    examName: string | null;
    sourceName: string;
    sourceUrl?: string | null;
    xpReward: number;
}

interface SpringPage<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
}

export default function PracticePageClient() {
    const [exercises, setExercises] = useState<PracticeExercise[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterLevel, setFilterLevel] = useState<string>('');
    const [submitting, setSubmitting] = useState<number | null>(null);
    const { trackFeatureAction } = useTracking();

    useEffect(() => {
        trackFeatureAction('practice_library', 'started');
        return () => trackFeatureAction('practice_library', 'quit');
    }, [trackFeatureAction]);

    const fetchExercises = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (filterLevel) params.cefrLevel = filterLevel;
            const { data } = await api.get<SpringPage<PracticeExercise>>('/practice/exercises', { params });
            setExercises(data.content);
        } catch (error) {
            console.error(error);
            toast.error('Không thể tải bài tập. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, [filterLevel]);

    useEffect(() => {
        fetchExercises();
    }, [fetchExercises]);

    const handleSubmitTest = async (id: number) => {
        setSubmitting(id);
        try {
            await api.post('/practice/submit', { practiceId: id, scorePercent: 100 });
            toast.success('Hoàn thành bài tập! Bạn đã nhận được XP.');
            trackFeatureAction('practice_exercise', 'completed', { exerciseId: id });
        } catch (error) {
            console.error(error);
            toast.error('Không thể ghi nhận kết quả. Vui lòng thử lại.');
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Thư viện Tài nguyên & Luyện thi</h1>
                    <p className="text-muted-foreground">Làm bài tập bổ trợ để nhận thêm XP. Các bài tập này không ảnh hưởng đến lộ trình chính của bạn.</p>
                </div>

                <div className="flex gap-2">
                    <select
                        className="p-2 border rounded-md bg-background"
                        value={filterLevel}
                        onChange={(e) => setFilterLevel(e.target.value)}
                    >
                        <option value="">Tất cả trình độ</option>
                        <option value="A1">A1</option>
                        <option value="A2">A2</option>
                        <option value="B1">B1</option>
                        <option value="B2">B2</option>
                        <option value="C1">C1</option>
                        <option value="C2">C2</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">Đang tải dữ liệu...</div>
            ) : exercises.length === 0 ? (
                <div className="text-center py-12 border rounded-xl bg-muted/20">
                    <p className="text-muted-foreground">Chưa có bài tập nào cho tiêu chí này.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exercises.map((ex) => (
                        <Card key={ex.id} className="flex flex-col hover:border-primary/50 transition-colors">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant={ex.exerciseType === 'EXAM' ? 'destructive' : 'default'}>
                                        {ex.exerciseType === 'EXAM' ? 'Đề thi' : 'Bài tập'}
                                    </Badge>
                                    <Badge variant="outline" className="font-bold">{ex.cefrLevel}</Badge>
                                </div>
                                <CardTitle className="text-lg leading-tight">
                                    {ex.examName || `${ex.skillType} Practice`}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 text-sm text-muted-foreground">
                                <p>Kỹ năng: <span className="font-semibold text-foreground">{ex.skillType}</span></p>
                                <p>Nguồn: {ex.sourceName}</p>
                                <p className="mt-2 text-primary font-medium">+{ex.xpReward} XP</p>
                            </CardContent>
                            <CardFooter>
                                <Button
                                    className="w-full"
                                    disabled={submitting === ex.id}
                                    onClick={() => handleSubmitTest(ex.id)}
                                >
                                    {submitting === ex.id ? 'Đang xử lý...' : 'Làm bài ngay'}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
