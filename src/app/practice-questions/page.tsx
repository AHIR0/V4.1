
'use client';

import { useState, useEffect } from 'react';
import { practiceQuestionBank, type PracticeQuestion } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ClipboardList, CheckCircle, XCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export default function PracticeQuestionsPage() {
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);

  useEffect(() => {
    // In a real app, you might fetch these or have more complex logic
    setQuestions(practiceQuestionBank);
  }, []);

  if (questions.length === 0) {
    return (
      <div className="container mx-auto py-8 text-center">
        <ClipboardList className="h-12 w-12 mx-auto mb-4 text-primary" />
        <h1 className="text-3xl font-bold text-primary mb-2">練習題庫</h1>
        <p className="text-muted-foreground">目前題庫中沒有題目。</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <header className="mb-12 text-center">
        <ClipboardList className="h-16 w-16 mx-auto mb-4 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          練習題庫
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          瀏覽所有練習題目，點開查看選項與答案。
        </p>
      </header>

      <Accordion type="multiple" className="w-full space-y-4">
        {questions.map((question, index) => (
          <AccordionItem key={question.id} value={`item-${index}`} className="border bg-card shadow-sm rounded-lg">
            <AccordionTrigger className="p-6 text-lg font-semibold text-left text-card-foreground hover:no-underline">
              <span className="mr-2">{`${index + 1}.`}</span>{question.questionText}
            </AccordionTrigger>
            <AccordionContent className="p-6 pt-0">
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
                      <div className="h-5 w-5" /> // Placeholder for alignment
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
