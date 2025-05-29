
import { learningPaths, type LearningPath, type Module, type Lesson } from "@/lib/mock-data";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, PlayCircle, ChevronRight } from "lucide-react";
import Link from "next/link";

interface EnrichedLesson extends Lesson {
  pathId: string;
  pathTitle: string;
  moduleId: string;
  moduleTitle: string;
}

export default function AllLessonsPage() {
  const allEnrichedLessons: EnrichedLesson[] = [];

  learningPaths.forEach((path: LearningPath) => {
    path.modules.forEach((module: Module) => {
      module.lessons.forEach((lesson: Lesson) => {
        allEnrichedLessons.push({
          ...lesson,
          pathId: path.id,
          pathTitle: path.title,
          moduleId: module.id,
          moduleTitle: module.title,
        });
      });
    });
  });

  return (
    <div className="container mx-auto py-8">
      <header className="mb-12">
        <div className="flex flex-col items-center text-center">
          <GraduationCap className="h-16 w-16 mb-4 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
            所有課程
          </h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            瀏覽所有可用的 PC 組裝課程。點擊課程以開始學習。
          </p>
        </div>
      </header>

      {allEnrichedLessons.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {allEnrichedLessons.map((lesson) => (
            <Card key={`${lesson.pathId}-${lesson.moduleId}-${lesson.id}`} className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="mb-2">
                  <Badge variant="secondary" className="mr-2">{lesson.pathTitle}</Badge>
                  <Badge variant="outline">{lesson.moduleTitle}</Badge>
                </div>
                <CardTitle className="text-xl h-14 overflow-hidden text-ellipsis">{lesson.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {/* Displaying a snippet of the actual description if it's long */}
                  {lesson.description.length > 100 ? lesson.description.substring(0, 100) + "..." : lesson.description || "此課程沒有提供描述。"}
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link href={`/learning-paths/${lesson.pathId}/modules/${lesson.moduleId}/lessons/${lesson.id}`}>
                    <PlayCircle className="mr-2 h-5 w-5" />
                    開始課程
                    <ChevronRight className="ml-auto h-5 w-5" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-lg bg-card text-center p-8">
          <GraduationCap className="h-20 w-20 mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-semibold text-primary mb-2">尚無可用課程</h2>
          <p className="text-muted-foreground">
            目前還沒有任何課程。請稍後再回來查看，或聯絡管理員新增課程內容。
          </p>
        </div>
      )}
    </div>
  );
}
