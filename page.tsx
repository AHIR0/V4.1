
import { LearningPathCard } from "@/components/learning-path-card";
import { learningPaths } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <div className="container mx-auto pb-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
 歡迎來到 PC Builder LMS
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
 您的PC組裝掌握之旅從這裡開始。探索我們精選的學習路徑。
        </p>
      </header>

      <section>
        <h2 className="text-3xl font-semibold mb-8 text-primary">
 可用的學習路徑
        </h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {learningPaths.map((path) => (
            <LearningPathCard key={path.id} path={path} />
          ))}
        </div>
      </section>
    </div>
  );
}
