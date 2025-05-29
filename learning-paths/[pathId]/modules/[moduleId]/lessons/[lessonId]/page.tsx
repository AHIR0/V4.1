
'use client';

import { useEffect, useState, useMemo } from 'react';
import { learningPaths, type Lesson } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, BookOpenText, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { isLessonCompleted, toggleLessonCompletion, getCompletedLessonIdsForPath } from '@/lib/user-progress';
import { useToast } from "@/hooks/use-toast";

export default function LessonDetailPage() {
  const { pathId, moduleId, lessonId } = useParams<{ pathId: string; moduleId: string; lessonId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [lessonStatus, setLessonStatus] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isProcessingCompletion, setIsProcessingCompletion] = useState(false);
  const [isLessonAccessible, setIsLessonAccessible] = useState(false); // New state for access control
  const [isCheckingAccess, setIsCheckingAccess] = useState(true); // New state for loading access check


  const path = useMemo(() => learningPaths.find(p => p.id === pathId), [pathId]);
  const module = useMemo(() => path?.modules.find(m => m.id === moduleId), [path, moduleId]);
  const lesson = useMemo(() => module?.lessons.find(l => l.id === lessonId), [module, lessonId]);

  useEffect(() => {
    setIsClient(true);
    const email = localStorage.getItem('userEmail');
    setUserEmail(email);
  }, []);

  useEffect(() => {
    if (!isClient || !path || !module || !lesson) {
      if (isClient && (!path || !module || !lesson)) {
        // If path, module, or lesson is not found after client is ready, trigger notFound.
        // However, this might be too aggressive if data is still loading or props are briefly undefined.
        // For now, we rely on the initial notFound() call below.
      }
      return;
    }

    const checkLessonAccess = async () => {
      setIsCheckingAccess(true);
      if (!userEmail) { // Not logged in, all lessons accessible (progress not tracked)
        setIsLessonAccessible(true);
        setIsCheckingAccess(false);
        return;
      }

      const currentPathIndex = learningPaths.findIndex(p => p.id === pathId);
      const currentModuleIndex = path.modules.findIndex(m => m.id === moduleId);
      const currentLessonIndex = module.lessons.findIndex(l => l.id === lessonId);

      if (currentPathIndex === -1 || currentModuleIndex === -1 || currentLessonIndex === -1) {
        notFound(); // Should be caught by the main check below, but good to have
        setIsCheckingAccess(false);
        return;
      }

      let isUnlocked = false;
      if (currentModuleIndex === 0 && currentLessonIndex === 0) {
        isUnlocked = true; // First lesson of first module is always unlocked
      } else {
        const completedIds = await getCompletedLessonIdsForPath(userEmail, pathId);
        let prevLessonActualId: string | null = null;

        if (currentLessonIndex > 0) {
          // Previous lesson in the same module
          prevLessonActualId = module.lessons[currentLessonIndex - 1].id;
        } else {
          // First lesson of a new module, check last lesson of the actual previous non-empty module
          for (let i = currentModuleIndex - 1; i >= 0; i--) {
            if (path.modules[i].lessons.length > 0) {
              prevLessonActualId = path.modules[i].lessons[path.modules[i].lessons.length - 1].id;
              break;
            }
          }
          // If prevLessonActualId is still null here, it means all previous modules were empty.
          // And since it's not the first module (currentModuleIndex > 0), it means the path structure is such
          // that there's no preceding content to complete. This case is a bit ambiguous.
          // For strict sequential, if there's no preceding content to be completed, it's locked unless it's the first overall.
          // Let's assume if there's no actual preceding lesson to complete (e.g., previous modules were empty), it's locked.
        }

        if (prevLessonActualId) {
          isUnlocked = completedIds.includes(prevLessonActualId);
        } else {
            // This case (not first lesson overall but no actual predecessor found) should mean it's locked.
            isUnlocked = false; 
        }
      }
      
      if (!isUnlocked) {
        toast({
          title: "課程鎖定",
          description: "請先完成前面的課程。",
          variant: "destructive",
        });
        router.push(`/learning-paths/${pathId}`);
      } else {
        setIsLessonAccessible(true);
      }
      setIsCheckingAccess(false);
    };

    checkLessonAccess();

  }, [isClient, userEmail, pathId, moduleId, lessonId, path, module, lesson, router, toast]);


  useEffect(() => {
    const fetchStatus = async () => {
      if (isClient && userEmail && pathId && moduleId && lessonId && isLessonAccessible) { // Only fetch status if accessible
        setIsLoadingStatus(true);
        const status = await isLessonCompleted(userEmail, pathId, moduleId, lessonId);
        setLessonStatus(status);
        setIsLoadingStatus(false);
      } else if (isClient && !userEmail) {
        if (lessonStatus) {
          setLessonStatus(false);
        }
        setIsLoadingStatus(false);
      }
    };
    if (pathId && moduleId && lessonId) {
      fetchStatus();
    }
  }, [isClient, userEmail, pathId, moduleId, lessonId, lessonStatus, isLessonAccessible]);

  if (!path || !module || !lesson) {
    notFound();
  }
  
  if (isCheckingAccess || !isLessonAccessible) { // Show loader or nothing until access is confirmed
    return (
      <div className="container mx-auto py-8 flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">正在檢查課程權限...</p>
      </div>
    );
  }

  const markLessonAsCompleteIfNotAlready = async () => {
    if (!userEmail || !path || !module || !lesson || isProcessingCompletion || !isLessonAccessible) return;

    setIsProcessingCompletion(true);
    try {
      const currentStatus = await isLessonCompleted(userEmail, path.id, module.id, lesson.id);
      if (!currentStatus) {
        const newStatus = await toggleLessonCompletion(userEmail, path.id, module.id, lesson.id);
        if (newStatus !== null) {
          setLessonStatus(newStatus);
          toast({
            title: "課程已標記為完成",
            description: `「${lesson.title}」`,
          });
        } else {
          toast({
            title: "錯誤",
            description: "標記課程完成時發生錯誤。",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error("Error in markLessonAsCompleteIfNotAlready: ", error);
      toast({
        title: "操作失敗",
        description: "處理課程完成狀態時發生未知錯誤。",
        variant: "destructive"
      });
    } finally {
      setIsProcessingCompletion(false);
    }
  };

  let prevLessonLink: string | null = null;
  let nextLessonLink: string | null = null;
  let isLastLessonInModule = false;
  let isLastLessonInPath = false;

  if (path && module && lesson) {
    const currentModuleIndex = path.modules.findIndex(m => m.id === module.id);
    const currentLessonIndex = module.lessons.findIndex(l => l.id === lesson.id);

    // Find previous lesson
    if (currentLessonIndex > 0) {
      prevLessonLink = `/learning-paths/${path.id}/modules/${module.id}/lessons/${module.lessons[currentLessonIndex - 1].id}`;
    } else if (currentModuleIndex > 0) {
      for (let i = currentModuleIndex - 1; i >= 0; i--) {
        if (path.modules[i].lessons.length > 0) {
          prevLessonLink = `/learning-paths/${path.id}/modules/${path.modules[i].id}/lessons/${path.modules[i].lessons[path.modules[i].lessons.length - 1].id}`;
          break;
        }
      }
    }

    // Find next lesson
    isLastLessonInModule = currentLessonIndex === module.lessons.length - 1;
    if (!isLastLessonInModule) {
      nextLessonLink = `/learning-paths/${path.id}/modules/${module.id}/lessons/${module.lessons[currentLessonIndex + 1].id}`;
    } else {
      let nextModuleFound = false;
      for (let i = currentModuleIndex + 1; i < path.modules.length; i++) {
        if (path.modules[i].lessons.length > 0) {
          nextLessonLink = `/learning-paths/${path.id}/modules/${path.modules[i].id}/lessons/${path.modules[i].lessons[0].id}`;
          nextModuleFound = true;
          break;
        }
      }
      if (!nextModuleFound) { // This is the last lesson of the last module with content
        isLastLessonInPath = true;
      }
    }
  }


  const handleNextLessonClick = async () => {
    if (!isClient || isProcessingCompletion) return;
    if (userEmail && path && module && lesson) {
      await markLessonAsCompleteIfNotAlready();
    }
    if (nextLessonLink) {
      router.push(nextLessonLink);
    }
  };

  const handleCompletePathClick = async () => {
    if (!isClient || isProcessingCompletion) return;
    if (userEmail && path && module && lesson) {
      await markLessonAsCompleteIfNotAlready();
    }

    if (path.quiz && path.quiz.questions.length > 0) {
      toast({
        title: "恭喜！",
        description: `您已完成「${path.title}」的所有課程，現在開始測驗吧！`,
      });
      router.push(`/quizzes/${path.id}`);
    } else {
      toast({
        title: "恭喜！",
        description: `您已完成學習路徑：「${path.title}」`,
      });
      router.push(`/learning-paths/${path.id}`);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Button asChild variant="outline" size="sm" className="mb-6">
        <Link href={`/learning-paths/${path.id}`}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          返回 {path.title}
        </Link>
      </Button>

      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center mb-2">
              {(isLoadingStatus && isClient && userEmail) ? (
                <Loader2 className="h-7 w-7 mr-3 animate-spin text-muted-foreground" />
              ) : isClient && userEmail && lessonStatus ? (
                <CheckCircle2 className="h-7 w-7 mr-3 text-green-500" />
              ) : (
                <BookOpenText className="h-7 w-7 mr-3 text-primary" />
              )}
              <CardTitle className="text-3xl font-bold text-primary">{lesson.title}</CardTitle>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            屬於模組：<span className="font-semibold">{module.title}</span>
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div
            className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: lesson.description.replace(/\n\n/g, '<br /><br />').replace(/\n/g, '<br />') }}
          />
          {lesson.quizDescription && (
            <div className="mt-6 p-4 border-t">
              <h3 className="text-xl font-semibold mb-3 text-accent">題目練習</h3>
              <div
                className="prose prose-sm sm:prose max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: lesson.quizDescription.replace(/\n\n/g, '<br /><br />').replace(/\n/g, '<br />') }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 flex justify-between">
        {prevLessonLink ? (
          <Button asChild variant="outline" disabled={isProcessingCompletion}>
            <Link href={prevLessonLink}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              上一課
            </Link>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一課
          </Button>
        )}

        {nextLessonLink ? (
          <Button onClick={handleNextLessonClick} variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isProcessingCompletion}>
            {isProcessingCompletion && userEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            下一課
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : isLastLessonInPath ? (
          <Button onClick={handleCompletePathClick} variant="default" className="bg-green-500 hover:bg-green-600 text-white" disabled={isProcessingCompletion}>
            {isProcessingCompletion && userEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {path.quiz && path.quiz.questions.length > 0 ? "完成課程，開始測驗" : "完成學習路徑"}
          </Button>
        ) : (
          <Button variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground"
            disabled={isProcessingCompletion}
            onClick={handleCompletePathClick}>
            {isProcessingCompletion && userEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {(path.quiz && path.quiz.questions.length > 0 ? "完成課程，開始測驗" : "完成學習路徑")}
            <CheckCircle2 className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

