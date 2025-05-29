// src/app/quiz-challenge/page.tsx
'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function QuizChallengePage() {
    const basicQuizId = "basic-quiz"; // 假設基本硬體測驗的 ID 是 basic-quiz

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl mb-6">
                測驗挑戰
            </h1>
            <p className="text-lg leading-8 text-muted-foreground mb-8">
                準備好挑戰自己了嗎？開始一次測驗來檢驗您的電腦硬體知識！
            </p>

            {/* 一個簡單的開始按鈕，後續會連結到實際的測驗頁面 */}
            <Link href={`/quiz-challenge/${basicQuizId}/start`} passHref>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 py-4">
                    開始基本硬體測驗
                </Button>
            </Link>

            {/* 後續可以加入排行榜的連結或區塊 */}
            {/* <div className="mt-8">
        <h2 className="text-2xl font-semibold text-primary mb-4">排行榜</h2>
        <p className="text-muted-foreground">即將推出！</p>
      </div> */}
        </div>
    );
}
