
'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Bot, Loader2, AlertTriangle } from 'lucide-react';
import { pcComponentQuery, type PcComponentQueryInput, type PcComponentQueryOutput } from '@/ai/flows/pc-component-query';
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  query: z.string().min(1, { message: '請輸入您的問題。' }),
});

type FormValues = z.infer<typeof formSchema>;

export default function AiAssistantPage() {
  const [aiAnswer, setAiAnswer] = useState<PcComponentQueryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setIsLoading(true);
    setAiAnswer(null);
    try {
      const input: PcComponentQueryInput = { query: data.query };
      const result: PcComponentQueryOutput = await pcComponentQuery(input);
      setAiAnswer(result);
      toast({
        title: "AI 回覆",
        description: "AI 已針對您的問題提供答覆。",
      });
    } catch (error) {
      console.error('Error getting AI answer:', error);
      setAiAnswer({
        answer: '取得 AI 回覆時發生錯誤，請稍後再試。',
      });
      toast({
        title: "查詢失敗",
        description: "執行 AI 查詢時遇到問題，請檢查主控台以獲取更多資訊。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <header className="mb-12 text-center">
        <Bot className="h-16 w-16 mx-auto mb-4 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          AI 助理
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          在這裡輸入任何關於電腦組件、相容性或故障排除的問題，AI 將嘗試提供協助。
        </p>
      </header>

      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle>輸入您的問題</CardTitle>
          <CardDescription>
            您可以提出關於電腦零組件、組裝技巧、相容性檢查或故障排除等任何問題。
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="query" className="sr-only">
                您的問題
              </Label>
              <Textarea
                id="query"
                {...register('query')}
                rows={8}
                placeholder="請在此輸入您的問題。"
                className={errors.query ? 'border-destructive' : ''}
              />
              {errors.query && (
                <p className="text-sm text-destructive mt-1">
                  {errors.query.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isLoading} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  詢問中...
                </>
              ) : (
                '詢問 AI'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {aiAnswer && (
        <Card className="max-w-2xl mx-auto mt-8 shadow-lg">
          <CardHeader>
            <CardTitle>AI 回覆</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose prose-sm sm:prose max-w-none text-foreground whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: aiAnswer.answer.replace(/\n/g, '<br />') }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
