'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { mockData } from '@/lib/mock-data';

interface Question {
    id: string;
    questionText: string;
    options: string[];
    correctAnswer: string | string[];
}

export default function StartQuizPage() {
    const params = useParams();
    const quizId = params.quizId as string;

    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
    const [quizStarted, setQuizStarted] = useState(false);
    const [userAnswers, setUserAnswers] = useState<{ [questionId: string]: string }>({});

    // Load questions
    useEffect(() => {
        const quizData = mockData.find(data => data.id === quizId)?.quiz;
        if (quizData && quizData.questions) {
            const formattedQuestions = quizData.questions.map(q => ({
                id: q.id,
                questionText: q.questionText,
                options: q.options,
                correctAnswer: q.correctAnswer,
            }));
            setQuestions(formattedQuestions);
        } else {
            console.error(`Quiz data not found for quizId: ${quizId}`);
        }
    }, [quizId]);

    // Timer countdown
    useEffect(() => {
        if (quizStarted && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        }
        if (timeLeft === 0) {
            console.log("Time's up!");
            // Handle time up
        }
    }, [timeLeft, quizStarted]);

    const handleStartQuiz = () => {
        setQuizStarted(true);
    };

    const handleOptionSelect = (questionId: string, selected: string) => {
        setUserAnswers(prev => ({
            ...prev,
            [questionId]: selected,
        }));
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            console.log("Quiz Completed");
            // Future: show result or redirect
        }
    };

    const currentQuestion = questions[currentQuestionIndex];
    const progressValue = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

    if (questions.length === 0) {
        return (
            <div className="container mx-auto py-8 text-center">
                Loading questions or no questions found for Quiz ID: {quizId}...
            </div>
        );
    }

    if (!quizStarted) {
        return (
            <div className="container mx-auto py-8 text-center">
                <h2 className="text-3xl font-bold mb-4">Start Quiz: {quizId}</h2>
                <p className="text-lg text-muted-foreground mb-6">Are you ready to take the challenge?</p>
                <Button size="lg" onClick={handleStartQuiz}>
                    Start Challenge
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-4">Quiz in Progress</h1>

            <div className="mb-4">
                <Progress value={progressValue} className="w-full" />
                <p className="text-sm text-muted-foreground text-right mt-1">
                    Question {currentQuestionIndex + 1} / {questions.length}
                </p>
            </div>

            <div className="text-xl font-semibold text-primary mb-6">
                Time Left: {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:
                {Math.floor(timeLeft % 60).toString().padStart(2, '0')}
            </div>

            {currentQuestion && (
                <div className="bg-card text-card-foreground p-6 rounded-lg shadow-md mb-6">
                    <h2 className="text-xl font-semibold mb-4">
                        {currentQuestionIndex + 1}. {currentQuestion.questionText}
                    </h2>
                    <div className="space-y-3">
                        {currentQuestion.options.map((option, index) => {
                            const isSelected = userAnswers[currentQuestion.id] === option;
                            return (
                                <div
                                    key={index}
                                    className={`border p-3 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-primary text-white' : 'hover:bg-muted'
                                        }`}
                                    onClick={() => handleOptionSelect(currentQuestion.id, option)}
                                >
                                    {option}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex justify-end">
                <Button onClick={handleNextQuestion}>
                    {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Finish Quiz"}
                </Button>
            </div>
        </div>
    );
}
