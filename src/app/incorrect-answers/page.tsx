
'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { getIncorrectlyAnsweredQuestions } from '@/lib/user-progress';
import { learningPaths, type QuizQuestion, type LearningPath } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ListX, CheckCircle, XCircle, Loader2, BrainCircuit } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { generateQuizExplanation, type QuizExplanationInput, type QuizExplanationOutput } from '@/ai/flows/quiz-explanation-flow';
import { Separator } from '@/components/ui/separator';

interface IncorrectReviewItem {
  pathId: string;
  pathTitle: string;
  questions: QuizQuestion[];
}

export default function IncorrectAnswersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [incorrectReviewItems, setIncorrectReviewItems] = useState<IncorrectReviewItem[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { toast } = useToast();

  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [isLoadingExplanation, setIsLoadingExplanation] = useState<Record<string, boolean>>({});


  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.email) {
        setUserEmail(user.email);
      } else {
        setUserEmail(null);
        setIsLoading(false);
        setIncorrectReviewItems([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userEmail) {
      setIsLoading(false);
      return;
    }

    const fetchIncorrectAnswers = async () => {
      setIsLoading(true);
      const incorrectlyAnsweredMap = await getIncorrectlyAnsweredQuestions(userEmail);
      const reviewItems: IncorrectReviewItem[] = [];

      for (const pathId in incorrectlyAnsweredMap) {
        const path = learningPaths.find(p => p.id === pathId);
        if (path && path.quiz) {
          const incorrectQuestionIds = incorrectlyAnsweredMap[pathId];
          const questionsForPath: QuizQuestion[] = [];
          incorrectQuestionIds.forEach(qId => {
            const question = path.quiz!.questions.find(q => q.id === qId);
            if (question) {
              questionsForPath.push(question);
            }
          });
          if (questionsForPath.length > 0) {
            reviewItems.push({
              pathId: path.id,
              pathTitle: path.quiz.title, // Use quiz title for more context
              questions: questionsForPath,
            });
          }
        }
      }
      setIncorrectReviewItems(reviewItems);
      setIsLoading(false);
    };

    fetchIncorrectAnswers();
  }, [userEmail]);

  const handleFetchExplanation = async (question: QuizQuestion) => {
    if (!question) return;

    setIsLoadingExplanation(prev => ({ ...prev, [question.id]: true }));
    toast({
      title: "AI 詳解生成中...",
      description: `正在為題目「${question.questionText.substring(0,20)}...」尋找解釋。`,
    });

    try {
      const input: QuizExplanationInput = {
        questionText: question.questionText,
        options: question.options,
        correctOptionId: question.correctOptionId,
      };
      const result: QuizExplanationOutput = await generateQuizExplanation(input);
      setAiExplanations(prev => ({ ...prev, [question.id]: result.explanation }));
      toast({
        title: "AI 詳解已生成！",
        description: "已成功獲取題目解釋。",
      });
    } catch (error) {
      console.error('Error getting AI explanation:', error);
      setAiExplanations(prev => ({ ...prev, [question.id]: '取得 AI 詳解時發生錯誤，請稍後再試。' }));
      toast({
        title: "AI 詳解生成失敗",
        description: "執行 AI 查詢時遇到問題。",
        variant: "destructive",
      });
    } finally {
      setIsLoadingExplanation(prev => ({ ...prev, [question.id]: false }));
    }
  };


  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">載入錯題中...</p>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="container mx-auto py-8 text-center">
        <ListX className="h-16 w-16 mx-auto mb-4 text-primary" />
        <h1 className="text-3xl font-bold text-primary mb-2">錯題本</h1>
        <p className="text-muted-foreground mb-4">請先<Link href="/login" className="underline text-accent hover:text-accent/80">登入</Link>以查看您的錯題記錄。</p>
      </div>
    );
  }

  if (incorrectReviewItems.length === 0) {
    return (
      <div className="container mx-auto py-8 text-center">
        <ListX className="h-16 w-16 mx-auto mb-4 text-primary" />
        <h1 className="text-3xl font-bold text-primary mb-2">錯題本</h1>
        <p className="text-muted-foreground">太棒了！您目前沒有任何錯題記錄。</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <header className="mb-12 text-center">
        <ListX className="h-16 w-16 mx-auto mb-4 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          錯題本
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          查看您之前答錯的題目，加強學習。
        </p>
      </header>

      <div className="space-y-6">
        {incorrectReviewItems.map((item) => (
          <Card key={item.pathId} className="shadow-md">
            <CardHeader>
              <CardTitle className="text-xl text-primary">{item.pathTitle}</CardTitle>
              <CardDescription>來自「{learningPaths.find(p=>p.id === item.pathId)?.title || '未知學習路徑'}」的測驗</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full space-y-4">
                {item.questions.map((question, index) => (
                  <AccordionItem key={question.id} value={`q-${item.pathId}-${question.id}`} className="border bg-card shadow-sm rounded-lg">
                    <AccordionTrigger className="p-4 sm:p-6 text-base font-semibold text-left text-card-foreground hover:no-underline">
                      <span className="mr-2">{`${index + 1}.`}</span>{question.questionText}
                    </AccordionTrigger>
                    <AccordionContent className="p-4 sm:p-6 pt-0">
                      <div className="space-y-3 mb-4">
                        {question.options.map((option) => (
                          <div
                            key={option.id}
                            className={`flex items-center space-x-3 p-3 border rounded-md 
                                        ${option.id === question.correctOptionId ? 'border-green-500 bg-green-500/10' : 'border-border'}`}
                          >
                            {option.id === question.correctOptionId ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <div className="h-5 w-5" /> 
                            )}
                            <Label htmlFor={`${question.id}-${option.id}`} className="text-base font-normal flex-1">
                              {option.text}
                            </Label>
                          </div>
                        ))}
                      </div>
                      {question.explanation && (
                        <div className="mt-4 p-3 border-t border-dashed">
                          <h4 className="font-semibold text-sm mb-1 text-primary">解釋：</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{question.explanation}</p>
                        </div>
                      )}

                      <Separator className="my-4" />
                      
                      <div className="mt-4">
                        <Button
                          onClick={() => handleFetchExplanation(question)}
                          disabled={isLoadingExplanation[question.id] || !!aiExplanations[question.id]}
                          variant="outline"
                          size="sm"
                          className="bg-accent/10 hover:bg-accent/20 text-accent border-accent/30"
                        >
                          {isLoadingExplanation[question.id] ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <BrainCircuit className="mr-2 h-4 w-4" />
                          )}
                          {aiExplanations[question.id] && !isLoadingExplanation[question.id] ? '已取得 AI 詳解' : (isLoadingExplanation[question.id] ? 'AI 解答中...' : '請求 AI 詳解')}
                        </Button>

                        {isLoadingExplanation[question.id] && !aiExplanations[question.id] && ( // Show loader only if explanation not yet loaded
                          <div className="mt-3 flex items-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            AI 助教思考中...
                          </div>
                        )}

                        {aiExplanations[question.id] && !isLoadingExplanation[question.id] && (
                          <div className="mt-3 p-3 border rounded-md bg-secondary/30">
                            <h4 className="font-semibold text-sm mb-1 text-primary flex items-center">
                              <BrainCircuit className="mr-2 h-4 w-4" /> AI 助教詳解：
                            </h4>
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {aiExplanations[question.id]}
                            </p>
                          </div>
                        )}
                      </div>

                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>
       <div className="mt-8 text-center">
        <Button asChild variant="outline">
          <Link href="/">返回首頁</Link>
        </Button>
      </div>
    </div>
  );
}

