import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, GraduationCap, Award, BookOpen } from 'lucide-react';

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

async function getTeacherProfile(id: string): Promise<TeacherProfileDto | null> {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v2/teachers/${id}`, {
            next: { revalidate: 3600 },
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

// Generate Dynamic Metadata for SEO
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
    const profile = await getTeacherProfile(params.id);
    if (!profile) {
        return { title: 'Không tìm thấy hồ sơ | DeutschFlow' };
    }
    return {
        title: `${profile.name} - ${profile.headline} | Chuyên gia DeutschFlow`,
        description: profile.bio ? profile.bio.substring(0, 160) : `Hồ sơ chuyên gia ${profile.name} trên DeutschFlow`,
    };
}

export default async function TeacherProfilePage({ params }: { params: { id: string } }) {
    const profile = await getTeacherProfile(params.id);

    if (!profile) {
        notFound();
    }

    return (
        <div className="container mx-auto py-10 max-w-4xl">
            <Card className="border-t-4 border-t-primary shadow-lg">
                <CardHeader className="text-center pb-2">
                    {profile.featured && (
                        <div className="flex justify-center mb-4">
                            <Badge className="bg-amber-500 hover:bg-amber-600 px-3 py-1 text-sm">
                                Chuyên gia Nổi bật
                            </Badge>
                        </div>
                    )}
                    <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-background shadow-sm">
                        <span className="text-4xl font-bold text-primary">
                            {profile.name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <CardTitle className="text-4xl font-bold">{profile.name}</CardTitle>
                    <p className="text-xl text-muted-foreground mt-2 font-medium">{profile.headline}</p>
                    
                    <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span>{profile.email}</span>
                    </div>
                </CardHeader>
                <CardContent className="pt-8">
                    <div className="grid gap-8">
                        <div>
                            <h3 className="text-xl font-semibold flex items-center gap-2 mb-3">
                                <BookOpen className="w-5 h-5 text-primary" />
                                Giới thiệu chung
                            </h3>
                            <div className="prose prose-sm sm:prose lg:prose-lg text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                {profile.bio || "Chưa có thông tin giới thiệu."}
                            </div>
                        </div>

                        {profile.qualifications && (
                            <div>
                                <h3 className="text-xl font-semibold flex items-center gap-2 mb-3">
                                    <GraduationCap className="w-5 h-5 text-primary" />
                                    Bằng cấp & Chuyên môn
                                </h3>
                                <div className="bg-secondary/50 p-6 rounded-lg text-muted-foreground whitespace-pre-wrap leading-relaxed border border-border/50">
                                    {profile.qualifications}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-center pt-6 pb-2">
                            <Button size="lg" className="px-8" asChild>
                                <a href={`mailto:${profile.email}?subject=Yêu cầu tư vấn từ DeutschFlow`}>
                                    Liên hệ chuyên gia
                                </a>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
