
'use client';

import Image from "next/image";
import Link from "next/link";
import { BookOpen, CheckSquare, PlayCircle, Loader2 } from "lucide-react";
import type { LearningPath } from "@/lib/mock-data";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { getCompletedLessonsCountForPath } from "@/lib/user-progress";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription } from "@/components/ui/dialog";


interface LearningPathCardProps {
  path: LearningPath;
}

export function LearningPathCard({ path }: LearningPathCardProps) {
  const totalLessons = path.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const modulesCount = path.modules.length;

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [completedLessons, setCompletedLessons] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  useEffect(() => {
    setIsClient(true);
    const email = localStorage.getItem('userEmail');
    setUserEmail(email);
  }, []);

  useEffect(() => {
    const fetchProgress = async () => {
      if (isClient && userEmail) {
        setIsLoadingProgress(true);
        const count = await getCompletedLessonsCountForPath(userEmail, path.id);
        setCompletedLessons(count);
        setIsLoadingProgress(false);
      } else if (isClient && !userEmail) {
        setCompletedLessons(0); 
        setIsLoadingProgress(false);
      }
    };
    fetchProgress();
  }, [isClient, userEmail, path.id]); 

  const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  
 
 const buttonText = 
    totalLessons === 0 ? "沒有課程" : 
    (isClient && userEmail && completedLessons === totalLessons && totalLessons > 0) ? "重新學習" :
    (isClient && userEmail && completedLessons > 0 && completedLessons < totalLessons) ? "繼續學習" : 
    "開始學習";

  // Always link to the path detail page
  const linkDestination = `/learning-paths/${path.id}`;


  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card">
      <CardHeader className="p-0">
        {path.imageUrl && (
              <div className="relative aspect-video w-full"> 
                <Image
                  src={path.imageUrl}
                  alt={path.title}
                  fill
                  className="object-contain" 
                  data-ai-hint={path.imageHint || "technology education"}
                  priority={path.id === 'beginner-pc-building'} 
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
        )}
         <div className="p-6">
          <CardTitle className="text-xl mb-2 h-14 overflow-hidden text-ellipsis text-card-foreground">{path.title}</CardTitle>
          <CardDescription className="text-sm h-20 overflow-hidden text-ellipsis text-muted-foreground">
            {path.description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-6 pt-0">
        <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
          <div className="flex items-center" title="模組數量">
            <BookOpen className="mr-1 h-4 w-4" />
            <span>{modulesCount} 個模組</span>
          </div>
          <div className="flex items-center" title="總課程數">
            <CheckSquare className="mr-1 h-4 w-4" />
            <span>{totalLessons} 堂課程</span>
          </div>
        </div>
        {isLoadingProgress && isClient && userEmail ? (
           <div className="mt-2 space-y-1">
             <div className="flex justify-between text-xs text-muted-foreground/50 mb-1">
                <span>進度</span>
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            <div className="h-2 w-full bg-muted rounded-full animate-pulse"></div>
           </div>
        ) : isClient && userEmail && totalLessons > 0 ? (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>進度</span>
              <span>{completedLessons}/{totalLessons}</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        ) : null }
      </CardContent>
      <CardFooter className="p-6 pt-0 border-t mt-auto">
        <Button asChild variant="default" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={totalLessons === 0 || (isLoadingProgress && isClient && !userEmail) }>
          <Link href={linkDestination}>
             {(isLoadingProgress && isClient && userEmail) ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5" />}
            {buttonText}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
