'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { mockData } from '@/lib/mock-data'; // Assuming mockData is structured appropriately

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string | string[]; // Assuming correct answer can be string or array
}

export default function StartQuizPage() {
  const params = useParams();
  const quizId = params.quizId as string; // Get the dynamic route parameter quizId

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(600); // Placeholder: 600 seconds (10 minutes)
  const [quizStarted, setQuizStarted] = useState(false);

  // Load questions based on quizId from mockData
  useEffect(() => {
    // This part needs to be adjusted based on your actual mockData structure
    const quizData = mockData.find(data => data.id === quizId)?.quiz;

    if (quizData && quizData.questions) {
      // Map your mockData questions to the Question interface if necessary
      const formattedQuestions = quizData.questions.map(q => ({
        id: q.id,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer, // Ensure field names match your mockData
      }));
      setQuestions(formattedQuestions);
    } else {
      console.error(`Quiz data not found for quizId: ${quizId}`);
      // Handle case where quiz data is not found (e.g., redirect or show error)
    }
  }, [quizId]); // Re-run effect when quizId changes

  // Basic timer effect
  useEffect(() => {
    if (quizStarted && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer); // Cleanup timer on unmount or state change
    }
    if (timeLeft === 0) {
      console.log("Time's up! Quiz ended.");
      // TODO: Implement quiz end logic (e.g., calculate score, show results)
    }
  }, [timeLeft, quizStarted]); // Re-run effect when timeLeft or quizStarted changes

  const handleStartQuiz = () => {
    setQuizStarted(true);
    // Timer starts automatically due to useEffect dependency on quizStarted
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      // TODO: Implement logic to handle user's answer submission for the current question
    } else {
      console.log("Reached the last question.");
      // TODO: Implement quiz completion logic
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progressValue = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  // Loading state or no questions found
  if (questions.length === 0) {
    return (
      <div className=\"container mx-auto py-8 text-center\">
        Loading questions or no questions found for Quiz ID: {quizId}...
      </div>
    );
  }

  // Before quiz starts state
  if (!quizStarted) {
    return (
      <div className=\"container mx-auto py-8 text-center\">
        <h2 className=\"text-3xl font-bold mb-4\">Start Quiz: {quizId}</h2>
        <p className=\"text-lg text-muted-foreground mb-6\">Are you ready to take the challenge?</p>
        <Button size=\"lg\" onClick={handleStartQuiz}>
          Start Challenge
        </Button>
      </div>
    );
  }

  // Quiz in progress state
  return (
    <div className=\"container mx-auto py-8\">
      <h1 className=\"text-3xl font-bold mb-4\">Quiz in Progress</h1>

      {/* Progress Bar */}
      <div className=\"mb-4\">
        <Progress value={progressValue} className=\"w-full\" />
        <p className=\"text-sm text-muted-foreground text-right mt-1\">
          Question {currentQuestionIndex + 1} / {questions.length}
        </p>
      </div>

      {/* Timer Display */}
      <div className=\"text-xl font-semibold text-primary mb-6\">
        Time Left: {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{Math.floor(timeLeft % 60).toString().padStart(2, '0')}
      </div>

      {/* Current Question Display */}
      {currentQuestion && (
        <div className=\"bg-card text-card-foreground p-6 rounded-lg shadow-md mb-6\">
          <h2 className=\"text-xl font-semibold mb-4\">
            {currentQuestionIndex + 1}. {currentQuestion.questionText}
          </h2>
          {/* TODO: Render options and handle user selection */}
          <div className=\"space-y-3\">
            {currentQuestion.options.map((option, index) => (
              <div key={index} className=\"border p-3 rounded-md cursor-pointer hover:bg-muted transition-colors\">
                {/* This div is currently just displaying text, not interactive */}
                {option}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className=\"flex justify-end\">
        <Button onClick={handleNextQuestion}>
          {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Finish Quiz"}
        </Button>
      </div>
    </div>
  );
}