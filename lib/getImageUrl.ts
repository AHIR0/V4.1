// lib/getImageUrl.ts
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function getImageUrl(imageId: string): Promise<{ url: string; hint?: string } | null> {
  const docRef = doc(db, "images", imageId); // 假設 collection 是 images，文件ID是 imageId
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as { url: string; hint?: string };
  } else {
    return null;
  }
}
