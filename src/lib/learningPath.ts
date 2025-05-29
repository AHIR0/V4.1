// lib/learningPath.ts
import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "./firebase";
import type { LearningPath } from "@/types";

export async function fetchLearningPath(pathId: string): Promise<LearningPath | null> {
    const docRef = doc(db, "learningPaths", pathId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) return null;

    const data = snapshot.data();

    // 取得圖片的下載連結
    let imageUrl: string | undefined;
    if (data.imagePath) {
        const storageRef = ref(storage, data.imagePath);
        imageUrl = await getDownloadURL(storageRef);
    }

    return {
        id: pathId,
        title: data.title,
        description: data.description,
        imageUrl,
        imageHint: data.imageHint || "",
        modules: [], // 你也可以從 Firestore 拿 modules
    };
}
