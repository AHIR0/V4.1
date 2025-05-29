import { Target } from "lucide-react";

export default function AllQuizzesPage() {
  return (
    <div className="container mx-auto py-8">
      <header className="mb-12 text-center">
        <Target className="h-16 w-16 mx-auto mb-4 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          All Quizzes
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Test your knowledge with our range of PC building quizzes.
        </p>
      </header>
       <div className="flex items-center justify-center h-64 border-2 border-dashed border-border rounded-lg bg-card">
        <p className="text-muted-foreground">Quiz content will be displayed here.</p>
      </div>
    </div>
  );
}