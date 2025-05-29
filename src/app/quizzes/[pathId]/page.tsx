
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { learningPaths, type LearningPath, type QuizQuestion } from '@/lib/mock-data'; // Import learningPaths
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { Timestamp, doc as firestoreDoc, setDoc as firestoreSetDoc, getDoc as firestoreGetDoc } from 'firebase/firestore';
import { recordIncorrectAnswer } from '@/lib/user-progress';

const POINTS_PER_QUESTION = 10;

export default function QuizPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [path, setPath] = useState<LearningPath | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: string }>({});
  const [score, setScore] = useState(0); // Score in points
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const currentPathData = learningPaths.find(p => p.id === pathId);
    if (currentPathData) {
      setPath(currentPathData);
      if (currentPathData.quiz && currentPathData.quiz.questions.length > 0) {
        setQuizTitle(currentPathData.quiz.title);
        setQuestions(currentPathData.quiz.questions);
      } else {
        toast({ title: "錯誤", description: "此學習路徑沒有可用的測驗。", variant: "destructive" });
        router.push(`/learning-paths/${pathId}`);
      }
    } else {
      toast({ title: "錯誤", description: "找不到指定的學習路徑。", variant: "destructive" });
      router.push('/');
    }
  }, [pathId, router, toast]);

  const handleAnswerSelect = (questionId: string, optionId: string) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleSubmitQuiz = async () => {
    setIsSubmittingScore(true);
    let correctAnswersCount = 0;
    const incorrectQuestionsToRecord: string[] = [];

    questions.forEach(q => {
      if (selectedAnswers[q.id] === q.correctOptionId) {
        correctAnswersCount++;
      } else {
        if (pathId && q.id) {
          incorrectQuestionsToRecord.push(q.id);
        }
      }
    });
    const currentQuizScore = correctAnswersCount * POINTS_PER_QUESTION;
    setScore(currentQuizScore);
    

    const currentUser = auth.currentUser;
    if (currentUser && currentUser.email && pathId) {
      try {
        // Record incorrect answers
        for (const questionId of incorrectQuestionsToRecord) {
          await recordIncorrectAnswer(currentUser.email, pathId, questionId);
        }

        // Update userPathScores (highest score for this specific path)
        const userPathScoreDocId = `${currentUser.email}_${pathId}`;
        const userPathScoreDocRef = firestoreDoc(db, 'userPathScores', userPathScoreDocId);
        const pathDocSnap = await firestoreGetDoc(userPathScoreDocRef);
        let currentHighestForPath = 0;
        if (pathDocSnap.exists()) {
          currentHighestForPath = pathDocSnap.data().highestScore || 0;
        }
        
        const scoreToSaveForPath = Math.max(currentQuizScore, currentHighestForPath);
        await firestoreSetDoc(userPathScoreDocRef, {
          highestScore: scoreToSaveForPath,
          lastAttemptTimestamp: Timestamp.now(),
          userEmail: currentUser.email,
          pathId: pathId,
          totalPossibleScore: questions.length * POINTS_PER_QUESTION, // Store total possible score
        }, { merge: true });

        // Recalculate total leaderboard score by summing highest scores from userPathScores
        let totalLeaderboardScore = 0;
        for (const lp of learningPaths) {
          if (lp.quiz && lp.quiz.questions && lp.quiz.questions.length > 0) {
            const userPathScoreDocIdToFetch = `${currentUser.email}_${lp.id}`;
            const userPathScoreDocRefToFetch = firestoreDoc(db, 'userPathScores', userPathScoreDocIdToFetch);
            const specificPathDocSnap = await firestoreGetDoc(userPathScoreDocRefToFetch);
            if (specificPathDocSnap.exists()) {
              totalLeaderboardScore += (specificPathDocSnap.data().highestScore || 0);
            }
          }
        }
        
        // Update leaderboardData with the new total score
        const leaderboardDocRef = firestoreDoc(db, 'leaderboardData', currentUser.email);
        await firestoreSetDoc(leaderboardDocRef, {
          id: currentUser.email,
          displayName: currentUser.displayName || currentUser.email.split('@')[0],
          score: totalLeaderboardScore,
          avatarUrl: currentUser.photoURL || '',
          avatarHint: currentUser.photoURL ? "user avatar" : "default avatar",
          lastUpdatedAt: Timestamp.now(),
        }, { merge: true });

        setQuizSubmitted(true);
        toast({
          title: "測驗完成！",
          description: `您在此測驗獲得 ${currentQuizScore} / ${questions.length * POINTS_PER_QUESTION} 分。排行榜總分已更新為 ${totalLeaderboardScore} 分！`,
        });

      } catch (error) {
        console.error("Error saving score or updating leaderboard to Firestore: ", error);
        setQuizSubmitted(true);
        toast({
          title: "錯誤",
          description: "儲存您的分數或更新排行榜時發生錯誤。",
          variant: "destructive",
        });
      } finally {
        setIsSubmittingScore(false);
      }
    } else {
      setQuizSubmitted(true);
       toast({
        title: "測驗完成！",
        description: `您答對了 ${correctAnswersCount} / ${questions.length} 題，得分 ${currentQuizScore} / ${questions.length * POINTS_PER_QUESTION} 分。登入以記錄您的分數。`,
      });
      setIsSubmittingScore(false);
    }
  };

  const handleRetakeQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setScore(0);
    setQuizSubmitted(false);
  };

  if (!isClient || !path || questions.length === 0) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">載入測驗中或此路徑沒有測驗...</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={pathId ? `/learning-paths/${pathId}` : '/'}>
            <ChevronLeft className="mr-2 h-4 w-4" /> 返回
          </Link>
        </Button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progressPercentage = ((currentQuestionIndex + 1) / questions.length) * 100;
  const totalPossibleQuizScore = questions.length * POINTS_PER_QUESTION;

  if (quizSubmitted) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <CardTitle className="text-3xl font-bold text-primary">測驗結果</CardTitle>
            <CardDescription>{quizTitle}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-2xl font-semibold mb-2">您的得分：</p>
            <p className="text-5xl font-bold text-accent mb-6">
              {score} / {totalPossibleQuizScore} 分
            </p>
            <p className="text-lg text-muted-foreground">
              {totalPossibleQuizScore > 0 && (score / totalPossibleQuizScore >= 0.7) ? "做得好！您對這個主題有很好的理解。" : "再接再厲！您可以重新學習相關課程並再次嘗試測驗。"}
            </p>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-center gap-4">
            <Button onClick={handleRetakeQuiz} variant="outline" disabled={isSubmittingScore}>
               <FileText className="mr-2 h-4 w-4" /> 再進行一次測驗
            </Button>
            <Button asChild>
              <Link href={`/learning-paths/${pathId}`}>
                <ChevronLeft className="mr-2 h-4 w-4" /> 返回學習路徑
              </Link>
            </Button>
             <Button asChild variant="secondary">
              <Link href="/incorrect-answers">
                 前往錯題本
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 flex flex-col items-center">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-2xl font-bold text-primary">{quizTitle}</CardTitle>
            <Button asChild variant="outline" size="sm">
                <Link href={`/learning-paths/${pathId}`}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> 返回路徑
                </Link>
            </Button>
          </div>
          <CardDescription>
            問題 {currentQuestionIndex + 1} / {questions.length} (每題 {POINTS_PER_QUESTION} 分)
          </CardDescription>
          <Progress value={progressPercentage} className="mt-2 h-2" />
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-semibold mb-6 whitespace-pre-wrap">{currentQuestion.questionText}</h3>
          <RadioGroup
            value={selectedAnswers[currentQuestion.id] || ''}
            onValueChange={(value) => handleAnswerSelect(currentQuestion.id, value)}
            className="space-y-3"
          >
            {currentQuestion.options.map(option => (
              <div key={option.id} className="flex items-center space-x-3 p-3 border rounded-md hover:bg-muted/50 transition-colors">
                <RadioGroupItem value={option.id} id={`${currentQuestion.id}-${option.id}`} />
                <Label htmlFor={`${currentQuestion.id}-${option.id}`} className="text-base font-normal cursor-pointer flex-1">
                  {option.text}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
        <CardFooter className="flex justify-end">
          {currentQuestionIndex < questions.length - 1 ? (
            <Button onClick={handleNextQuestion} disabled={!selectedAnswers[currentQuestion.id]}>
              下一題 <ChevronLeft className="ml-2 h-4 w-4 transform rotate-180" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmitQuiz}
              className="bg-green-500 hover:bg-green-600 text-white"
              disabled={!selectedAnswers[currentQuestion.id] || isSubmittingScore}
            >
              {isSubmittingScore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              提交測驗
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
