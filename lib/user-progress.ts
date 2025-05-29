// src/lib/user-progress.ts
'use client';

import { db, firestoreSetDoc, firestoreDoc, firestoreGetDoc, Timestamp, arrayUnion, arrayRemove, firestoreUpdateDoc as updateDoc } from '@/lib/firebase'; // Ensure all are V9 imports
import type { QuizQuestion } from '@/lib/mock-data'; // For return type if needed

const getProgressDocRef = (userEmail: string) => {
  const safeUserEmail = userEmail.replace(/\//g, '_'); // Basic sanitization for document ID
  return firestoreDoc(db, 'userProgress', safeUserEmail);
};

// Helper to create a composite ID for lessons
const getCompositeLessonId = (pathId: string, moduleId: string, lessonId: string): string => {
  return `${pathId}/${moduleId}/${lessonId}`;
};

export const isLessonCompleted = async (userEmail: string | null, pathId: string, moduleId: string, lessonId: string): Promise<boolean> => {
  if (!userEmail) {
    // console.log("isLessonCompleted: No userEmail, returning false.");
    return false;
  }
  const progressDocRef = getProgressDocRef(userEmail);
  const compositeId = getCompositeLessonId(pathId, moduleId, lessonId);
  // console.log(`isLessonCompleted: Checking for user ${userEmail}, lesson ${compositeId}`);

  try {
    const docSnap = await firestoreGetDoc(progressDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // console.log(`isLessonCompleted: Document data for ${userEmail}:`, data);
      return data.completedLessons?.includes(compositeId) || false;
    }
    // console.log(`isLessonCompleted: No document found for ${userEmail}.`);
    return false;
  } catch (error) {
    console.error("Error checking lesson completion from Firestore:", error);
    return false;
  }
};

export const toggleLessonCompletion = async (userEmail: string | null, pathId: string, moduleId: string, lessonId: string): Promise<boolean | null> => {
  if (!userEmail) {
    // console.log("toggleLessonCompletion: No userEmail, returning null.");
    return null;
  }
  const progressDocRef = getProgressDocRef(userEmail);
  const compositeId = getCompositeLessonId(pathId, moduleId, lessonId);
  // console.log(`toggleLessonCompletion: Toggling for user ${userEmail}, lesson ${compositeId}`);

  try {
    const docSnap = await firestoreGetDoc(progressDocRef);
    let newStatus = false;

    if (docSnap.exists()) {
      const data = docSnap.data();
      const currentlyCompleted = data.completedLessons?.includes(compositeId) || false;
      if (currentlyCompleted) {
        // console.log(`toggleLessonCompletion: Lesson ${compositeId} is completed, marking as incomplete.`);
        await updateDoc(progressDocRef, {
          completedLessons: arrayRemove(compositeId),
          lastUpdated: Timestamp.now()
        });
        newStatus = false;
      } else {
        // console.log(`toggleLessonCompletion: Lesson ${compositeId} is incomplete, marking as complete.`);
        await updateDoc(progressDocRef, {
          completedLessons: arrayUnion(compositeId),
          lastUpdated: Timestamp.now()
        });
        newStatus = true;
      }
    } else {
      // console.log(`toggleLessonCompletion: No document for ${userEmail}, creating and marking ${compositeId} as complete.`);
      await firestoreSetDoc(progressDocRef, {
        completedLessons: [compositeId],
        createdAt: Timestamp.now(),
        lastUpdated: Timestamp.now()
      });
      newStatus = true;
    }
    // console.log(`toggleLessonCompletion: New status for ${compositeId} is ${newStatus}`);
    return newStatus;
  } catch (error) {
    console.error("Error toggling lesson completion in Firestore:", error);
    return null;
  }
};


export const getCompletedLessonIdsForPath = async (userEmail: string | null, pathId: string): Promise<string[]> => {
  if (!userEmail) return [];
  const progressDocRef = getProgressDocRef(userEmail);
  try {
    const docSnap = await firestoreGetDoc(progressDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // console.log(`getCompletedLessonIdsForPath: All completed for ${userEmail}:`, allCompleted);
      const allCompleted: string[] = data.completedLessons || [];
      return allCompleted
        .filter(compositeId => compositeId.startsWith(`${pathId}/`))
        .map(compositeId => compositeId.split('/')[2]); // Get only the lessonId part
    }
    return [];
  } catch (error) {
    console.error("Error getting completed lesson IDs for path from Firestore:", error);
    return [];
  }
};

export const getCompletedLessonsCountForPath = async (userEmail: string | null, pathId: string): Promise<number> => {
  if (!userEmail) {
    // console.log("getCompletedLessonsCountForPath: No userEmail, returning 0.");
    return 0;
  }
  const progressDocRef = getProgressDocRef(userEmail);
  // console.log(`getCompletedLessonsCountForPath: Checking for user ${userEmail}, path ${pathId}`);
  try {
    const docSnap = await firestoreGetDoc(progressDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const allCompleted: string[] = data.completedLessons || [];
      // console.log(`getCompletedLessonsCountForPath: All completed for ${userEmail}:`, allCompleted);
      const count = allCompleted.filter(compositeId => compositeId.startsWith(`${pathId}/`)).length;
      // console.log(`getCompletedLessonsCountForPath: Count for path ${pathId} is ${count}`);
      return count;
    }
    // console.log(`getCompletedLessonsCountForPath: No document found for ${userEmail}.`);
    return 0;
  } catch (error) {
    console.error("Error getting completed lessons count for path from Firestore:", error);
    return 0;
  }
};

export const recordIncorrectAnswer = async (userEmail: string, pathId: string, questionId: string): Promise<void> => {
  if (!userEmail) return;
  const progressDocRef = getProgressDocRef(userEmail);
  const fieldPath = `incorrectlyAnsweredQuestions.${pathId}`;

  try {
    const docSnap = await firestoreGetDoc(progressDocRef);
    if (docSnap.exists()) {
      // console.log(`recordIncorrectAnswer: Updating existing document for ${userEmail}, path ${pathId}, question ${questionId}`);
      await updateDoc(progressDocRef, {
        [fieldPath]: arrayUnion(questionId), // Adds to array, Firestore handles uniqueness in arrayUnion
        lastUpdated: Timestamp.now()
      });
    } else {
      // console.log(`recordIncorrectAnswer: Creating new document for ${userEmail}, path ${pathId}, question ${questionId}`);
      await firestoreSetDoc(progressDocRef, {
        incorrectlyAnsweredQuestions: {
          [pathId]: [questionId]
        },
        createdAt: Timestamp.now(),
        lastUpdated: Timestamp.now()
      });
    }
  } catch (error) {
    console.error("Error recording incorrect answer:", error);
  }
};

export const getIncorrectlyAnsweredQuestions = async (userEmail: string): Promise<Record<string, string[]>> => {
  if (!userEmail) {
    return {};
  }
  const progressDocRef = getProgressDocRef(userEmail);
  try {
    const docSnap = await firestoreGetDoc(progressDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.incorrectlyAnsweredQuestions || {};
    }
    return {};
  } catch (error) {
    console.error("Error fetching incorrectly answered questions:", error);
    return {};
  }
};
