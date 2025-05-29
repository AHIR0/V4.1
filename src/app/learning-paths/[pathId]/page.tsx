
'use client';

import { useEffect, useState, useMemo } from 'react';
import { learningPaths } from '@/lib/mock-data';
import type { Module, Lesson as LessonType } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ChevronLeft, PlayCircle, Info, CheckCircle2, Loader2, FileText, BookOpen, Lock, Trophy } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound, useParams, useRouter } from 'next/navigation';
import { getCompletedLessonIdsForPath } from '@/lib/user-progress';
import { cn } from '@/lib/utils';
import { auth, db, firestoreDoc, firestoreGetDoc, type Timestamp } from '@/lib/firebase';

const POINTS_PER_QUESTION = 10;

interface LessonItemProps {
  lesson: LessonType;
  pathId: string;
  moduleId: string;
  isCompleted: boolean;
  isUnlocked: boolean;
}

const LessonItemClient: React.FC<LessonItemProps> = ({ lesson, pathId, moduleId, isCompleted, isUnlocked }) => {
  return (
    <li className={cn(
        "p-4 rounded-md border transition-colors",
        isUnlocked ? 'hover:bg-secondary/30' : 'opacity-60 cursor-not-allowed bg-muted/30'
      )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          {isCompleted && <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />}
          {!isCompleted && !isUnlocked && <Lock className="mr-2 h-5 w-5 text-muted-foreground/70 flex-shrink-0" />}
          <h4 className={`text-md font-semibold ${isUnlocked ? 'text-card-foreground' : 'text-muted-foreground'}`}>{lesson.title}</h4>
        </div>
        <Button asChild variant="secondary" size="default" className={`text-secondary-foreground ${isUnlocked ? 'hover:bg-secondary/80' : 'bg-muted hover:bg-muted cursor-not-allowed'}`} disabled={!isUnlocked}>
          <Link href={`/learning-paths/${pathId}/modules/${moduleId}/lessons/${lesson.id}`}>
            <PlayCircle className="mr-2 h-4 w-4" /> 開始課程
          </Link>
        </Button>
      </div>
      <p className={`text-sm mb-3 line-clamp-3 ${isUnlocked ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>{lesson.description}</p>
      {lesson.interactiveElement && (
        <div className={`mt-2 flex items-start text-xs p-2 bg-muted/50 rounded-md ${isUnlocked ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
          <Info className="mr-2 h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <strong>互動設計：</strong> {lesson.interactiveElement}
          </div>
        </div>
      )}
      {lesson.videoElement && (
          <div className={`mt-2 flex items-start text-xs p-2 bg-muted/50 rounded-md ${isUnlocked ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
          <Info className="mr-2 h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <strong>影片/動畫：</strong> {lesson.videoElement}
          </div>
        </div>
      )}
      {lesson.quizDescription && (
        <div className={`mt-2 flex items-start text-xs p-2 bg-muted/50 rounded-md ${isUnlocked ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
          <Info className="mr-2 h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <strong>題目練習：</strong> {lesson.quizDescription}
          </div>
        </div>
      )}
    </li>
  );
};


export default function LearningPathDetailPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const router = useRouter();

  const path = useMemo(() => learningPaths.find(p => p.id === pathId), [pathId]);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [highestScoreForPath, setHighestScoreForPath] = useState<number | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(true);

  useEffect(() => {
    setIsClient(true);
    const email = localStorage.getItem('userEmail');
    setUserEmail(email);
  }, []);

  useEffect(() => {
    const fetchProgressAndScore = async () => {
      if (isClient && userEmail && pathId) {
        setIsLoadingProgress(true);
        setIsLoadingScore(true);

        const ids = await getCompletedLessonIdsForPath(userEmail, pathId);
        setCompletedLessonIds(ids);
        setIsLoadingProgress(false);

        const userPathScoreDocId = `${userEmail}_${pathId}`;
        const userPathScoreDocRef = firestoreDoc(db, 'userPathScores', userPathScoreDocId);
        try {
          const docSnap = await firestoreGetDoc(userPathScoreDocRef);
          if (docSnap.exists()) {
            setHighestScoreForPath(docSnap.data().highestScore);
          } else {
            setHighestScoreForPath(null);
          }
        } catch (error) {
          console.error("Error fetching highest score for path:", error);
          setHighestScoreForPath(null);
        }
        setIsLoadingScore(false);

      } else if (isClient && !userEmail) {
        setCompletedLessonIds([]);
        setHighestScoreForPath(null);
        setIsLoadingProgress(false);
        setIsLoadingScore(false);
      }
    };
    if (pathId) {
      fetchProgressAndScore();
    }
  }, [isClient, userEmail, pathId]);

  if (!path) {
    notFound();
  }

  const getStartOrContinueLink = (): string => {
    if (!path.modules || path.modules.reduce((sum, m) => sum + m.lessons.length, 0) === 0) {
      return `/learning-paths/${pathId}`; // Should not happen if path has no lessons
    }

    if (userEmail) {
      for (const module of path.modules) {
        if (module.lessons && module.lessons.length > 0) {
          const firstUncompletedLesson = module.lessons.find(l => !completedLessonIds.includes(l.id));
          if (firstUncompletedLesson) {
            // Check if this uncompleted lesson is actually unlocked
            const currentModuleIndex = path.modules.findIndex(m => m.id === module.id);
            const currentLessonIndex = module.lessons.findIndex(l => l.id === firstUncompletedLesson.id);
            let isActuallyUnlocked = false;
            if (currentModuleIndex === 0 && currentLessonIndex === 0) {
                isActuallyUnlocked = true;
            } else {
                let prevLessonActualId: string | null = null;
                if (currentLessonIndex > 0) {
                    prevLessonActualId = module.lessons[currentLessonIndex - 1].id;
                } else if (currentModuleIndex > 0) {
                    for (let i = currentModuleIndex - 1; i >= 0; i--) {
                        if (path.modules[i].lessons.length > 0) {
                            prevLessonActualId = path.modules[i].lessons[path.modules[i].lessons.length - 1].id;
                            break;
                        }
                    }
                }
                if (prevLessonActualId) {
                    isActuallyUnlocked = completedLessonIds.includes(prevLessonActualId);
                }
            }
            if(isActuallyUnlocked) {
                return `/learning-paths/${path.id}/modules/${module.id}/lessons/${firstUncompletedLesson.id}`;
            }
          }
        }
      }
    }
    // If all lessons are completed (for logged-in user) or if not logged in, or if first uncompleted is locked,
    // link to the very first lesson of the first module that has lessons.
    const firstModuleWithLessons = path.modules.find(m => m.lessons && m.lessons.length > 0);
    if (firstModuleWithLessons && firstModuleWithLessons.lessons.length > 0) {
      return `/learning-paths/${path.id}/modules/${firstModuleWithLessons.id}/lessons/${firstModuleWithLessons.lessons[0].id}`;
    }
    return `/learning-paths/${pathId}`; // Fallback
  };

  const totalLessons = path.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const completedLessonsCount = isClient && userEmail ? completedLessonIds.length : 0;

  const startButtonText =
    totalLessons === 0 ? "沒有課程" :
    (isClient && userEmail && completedLessonsCount === totalLessons && totalLessons > 0) ? "重新學習" :
    (isClient && userEmail && completedLessonsCount > 0 && completedLessonsCount < totalLessons) ? "繼續學習" :
    "開始學習";
  
  const linkHref = getStartOrContinueLink();


  return (
    <div className="container mx-auto py-8">
      <header className="mb-8">
        <Button asChild variant="outline" size="sm" className="mb-6">
          <Link href="/">
            <ChevronLeft className="mr-2 h-4 w-4" />
            返回所有路徑
          </Link>
        </Button>
        {path.imageUrl && (
             <div className="relative aspect-video w-full rounded-lg overflow-hidden shadow-lg mb-6">
                <Image
                  src={path.imageUrl}
                  alt={path.title}
                  fill
                  priority={path.id === 'beginner-pc-building'}
                  className="object-contain"
                  data-ai-hint={path.imageHint || "technology banner"}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
        )}
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl mb-2">{path.title}</h1>
        <p className="text-lg text-muted-foreground mb-4">{path.description}</p>
        
        {totalLessons > 0 && (
            <div className="mt-4 text-left mb-8">
                <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={(isLoadingProgress && isClient && userEmail)}>
                    <Link href={linkHref}>
                        {(isLoadingProgress && isClient && userEmail) ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <BookOpen className="mr-2 h-5 w-5" />}
                        {startButtonText}
                    </Link>
                </Button>
            </div>
        )}
        
        {path.quiz && path.quiz.questions && path.quiz.questions.length > 0 && (
        <div className="mt-6 border-t pt-6">
          <h3 className="text-xl font-semibold mb-2 text-primary">完成所有課程了嗎？</h3>
          {isClient && userEmail && !isLoadingScore && highestScoreForPath !== null && (
            <p className="text-md text-muted-foreground mb-3 flex items-center">
              <Trophy className="mr-2 h-5 w-5 text-yellow-500" />
              您的本章最高分：{highestScoreForPath} / {path.quiz.questions.length * POINTS_PER_QUESTION} 分
            </p>
          )}
           {isClient && userEmail && isLoadingScore && (
             <p className="text-md text-muted-foreground mb-3 flex items-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                正在讀取最高分...
             </p>
           )}
          <Button asChild size="lg" className="bg-green-500 hover:bg-green-600 text-white">
            <Link href={`/quizzes/${path.id}`}>
              <FileText className="mr-2 h-5 w-5" /> 進行本章節測驗
            </Link>
          </Button>
        </div>
        )}
      </header>

      <div className="w-full">
        <div className="w-full">
          <h2 className="text-2xl font-semibold mb-4 text-primary">模組與課程</h2>
          {path.modules.length > 0 ? (
            <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={path.modules[0] ? `module-${path.modules[0].id}`: undefined}>
              {path.modules.map((module: Module, moduleIndex: number) => {
                return (
                <AccordionItem key={module.id} value={`module-${module.id}`} className="border bg-card shadow-sm rounded-lg">
                  <AccordionTrigger className="p-6 text-xl font-semibold text-card-foreground hover:no-underline">
                    {module.title}
                  </AccordionTrigger>
                  <AccordionContent className="p-6 pt-0">
                    {isLoadingProgress && isClient && userEmail ? (
                      <div className="space-y-3">
                        {[...Array(module.lessons.length || 1)].map((_, i) => (
                          <div key={i} className="p-4 rounded-md border h-24 animate-pulse bg-muted/50"></div>
                        ))}
                      </div>
                    ) : module.lessons.length > 0 ? (
                    <ul className="space-y-3">
                      {module.lessons.map((lesson: LessonType, lessonIndex: number) => {
                        let isUnlocked = false;
                        if (!userEmail) { // Not logged in, all lessons accessible (progress not tracked)
                            isUnlocked = true;
                        } else {
                            if (moduleIndex === 0 && lessonIndex === 0) {
                                isUnlocked = true; // First lesson of first module is always unlocked
                            } else {
                                let prevLessonActualId: string | null = null;
                                if (lessonIndex > 0) {
                                    // Previous lesson in the same module
                                    prevLessonActualId = module.lessons[lessonIndex - 1].id;
                                } else if (moduleIndex > 0) {
                                    // First lesson of a new module, check last lesson of the actual previous non-empty module
                                    for (let i = moduleIndex - 1; i >= 0; i--) {
                                        if (path.modules[i].lessons.length > 0) {
                                            prevLessonActualId = path.modules[i].lessons[path.modules[i].lessons.length - 1].id;
                                            break;
                                        }
                                    }
                                }
                                if (prevLessonActualId) {
                                    isUnlocked = completedLessonIds.includes(prevLessonActualId);
                                } else {
                                    isUnlocked = false; // If no actual preceding lesson (e.g., previous modules were empty), it's locked.
                                }
                            }
                        }

                        return (
                        <LessonItemClient
                          key={lesson.id}
                          lesson={lesson}
                          pathId={path.id}
                          moduleId={module.id}
                          isCompleted={isClient && userEmail ? completedLessonIds.includes(lesson.id) : false}
                          isUnlocked={isUnlocked}
                        />
                      );
                    })}
                    </ul>
                    ) : (
                       <p className="text-sm text-muted-foreground">此模組目前沒有課程。</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )})}
            </Accordion>
          ) : (
            <div className="p-6 rounded-lg border bg-card shadow-sm text-center">
              <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-card-foreground mb-2">即將推出</h3>
              <p className="text-sm text-muted-foreground">此學習路徑的詳細模組與課程內容正在準備中，敬請期待！</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
