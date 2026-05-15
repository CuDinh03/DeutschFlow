import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
    title: 'Đội ngũ chuyên gia | DeutschFlow',
    description: 'Khám phá và đặt lịch với đội ngũ chuyên gia, giáo viên luyện thi tiếng Đức hàng đầu tại DeutschFlow.',
};

interface TeacherProfileDto {
    id: number;
    userId: number;
    name: string;
    email: string;
    headline: string;
    bio: string;
    qualifications: string;
    featured: boolean;
}

async function getPublicTeachers(): Promise<TeacherProfileDto[]> {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v2/teachers/public`, {
            next: { revalidate: 3600 }, // ISR: Revalidate every hour
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.content || [];
    } catch (e) {
        return [];
    }
}

export default async function TeachersMarketplacePage() {
    const teachers = await getPublicTeachers();

    return (
        <div className="container mx-auto py-10">
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-bold tracking-tight mb-4">Đội ngũ chuyên gia DeutschFlow</h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Đồng hành cùng những giáo viên ưu tú nhất, chuyên gia luyện thi Goethe, Telc, TestDaF và tư vấn lộ trình du học Đức.
                </p>
            </div>

            {teachers.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    Hiện chưa có hồ sơ giáo viên nào được công khai.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teachers.map((teacher) => (
                        <Card key={teacher.id} className={`flex flex-col h-full ${teacher.featured ? 'border-primary shadow-md' : ''}`}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-2xl">{teacher.name}</CardTitle>
                                        <CardDescription className="text-base mt-2 font-medium text-foreground">
                                            {teacher.headline}
                                        </CardDescription>
                                    </div>
                                    {teacher.featured && (
                                        <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">Nổi bật</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                    {teacher.bio}
                                </p>
                                {teacher.qualifications && (
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                        <p className="text-sm font-semibold mb-1">Bằng cấp & Chứng chỉ:</p>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {teacher.qualifications}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button asChild className="w-full">
                                    <Link href={`/teachers/${teacher.id}`}>
                                        Xem chi tiết
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
