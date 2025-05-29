
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, MessageSquare, Send, UserCircle2, Loader2, CheckCircle, ArrowLeftCircle, ArrowRightCircle, Star } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, Timestamp, serverTimestamp, type DocumentData } from 'firebase/firestore';
import type { DiscussionPost, DiscussionComment } from '@/lib/mock-data';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';


export default function DiscussionPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [post, setPost] = useState<DiscussionPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string | null>(null);

  const [dialogSelectedImageIndex, setDialogSelectedImageIndex] = useState(0);


  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    const displayName = localStorage.getItem('userDisplayName');
    setCurrentUserEmail(email);
    setCurrentUserDisplayName(displayName);

    if (postId) {
      const fetchPost = async () => {
        setIsLoading(true);
        try {
          const postDocRef = doc(db, 'discussionPosts', postId as string);
          const docSnap = await getDoc(postDocRef);

          if (docSnap.exists()) {
            const data = docSnap.data() as DocumentData;
            setPost({
              id: docSnap.id,
              ...data,
              comments: data.comments || [],
              imageUrls: data.imageUrls || [],
              primaryImageIndex: data.primaryImageIndex || 0,
            } as DiscussionPost);
            setDialogSelectedImageIndex(data.primaryImageIndex || 0);
          } else {
            toast({ title: "錯誤", description: "找不到此討論主題。", variant: "destructive" });
            router.push('/community-discussion');
          }
        } catch (error) {
          console.error("Error fetching post: ", error);
          toast({ title: "載入失敗", description: "獲取討論主題時發生錯誤。", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchPost();
    }
  }, [postId, router, toast]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast({ description: "留言內容不能為空。" });
      return;
    }
    if (!currentUserEmail) {
      toast({ title: "請先登入", description: "您需要登入才能發表留言。", variant: "destructive" });
      return;
    }
    if (!post || !post.id) return;

    setIsSubmittingComment(true);
    const commentToAdd: DiscussionComment = {
      id: uuidv4(),
      authorEmail: currentUserEmail,
      authorDisplayName: currentUserDisplayName || currentUserEmail.split('@')[0],
      text: newComment.trim(),
      createdAt: serverTimestamp(),
    };

    try {
      const postDocRef = doc(db, 'discussionPosts', post.id);
      await updateDoc(postDocRef, {
        comments: arrayUnion(commentToAdd)
      });
      
      const commentForUI: DiscussionComment = {
        ...commentToAdd,
        createdAt: new Timestamp(Math.floor(Date.now() / 1000), 0) 
      };
      setPost(prevPost => prevPost ? { ...prevPost, comments: [...(prevPost.comments || []), commentForUI] } : null);
      
      setNewComment('');
      toast({ title: "成功", description: "您的留言已送出。" });
    } catch (error) {
      console.error("Error adding comment: ", error);
      toast({ title: "留言失敗", description: "儲存您的留言時發生錯誤。", variant: "destructive" });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const formatRelativeTime = (timestamp: Timestamp | null | undefined) => {
    if (!timestamp) return '日期未知';
    try {
      if (timestamp instanceof Timestamp) {
        return formatDistanceToNow(timestamp.toDate(), { addSuffix: true, locale: zhTW });
      }
      return '剛剛';
    } catch (e) {
      return '日期處理中';
    }
  };

  const handleThumbnailClickInDialog = (index: number) => {
    setDialogSelectedImageIndex(index);
  };

  const nextImageInDialog = () => {
    if (post && post.imageUrls && post.imageUrls.length > 0) {
      setDialogSelectedImageIndex((prevIndex) => (prevIndex + 1) % post.imageUrls.length);
    }
  };

  const prevImageInDialog = () => {
     if (post && post.imageUrls && post.imageUrls.length > 0) {
      setDialogSelectedImageIndex((prevIndex) => (prevIndex - 1 + post.imageUrls.length) % post.imageUrls.length);
    }
  };

  const currentLargeImageUrlInDialog = post?.imageUrls && post.imageUrls.length > dialogSelectedImageIndex
                                       ? post.imageUrls[dialogSelectedImageIndex]
                                       : "https://placehold.co/600x400.png";


  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">載入討論主題中...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-xl text-muted-foreground">找不到此討論主題，或它已被刪除。</p>
        <Button asChild variant="link" className="mt-4">
          <Link href="/community-discussion">返回討論區</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <Button asChild variant="outline" size="sm" className="mb-6">
        <Link href="/community-discussion">
          <ChevronLeft className="mr-2 h-4 w-4" />
          返回討論區
        </Link>
      </Button>

      <Card className="mb-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">{post.title}</CardTitle>
          <CardDescription className="text-xs text-muted-foreground flex items-center pt-1">
            <UserCircle2 className="mr-1.5 h-4 w-4" />
            由 {post.authorDisplayName || post.authorEmail.split('@')[0]} 發表於 {formatRelativeTime(post.createdAt as Timestamp)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {post.imageUrls && post.imageUrls.length > 0 && (
            <div className="mb-6 space-y-3">
              <div className="relative aspect-video w-full max-w-xl mx-auto rounded-lg overflow-hidden border shadow-md">
                <Image
                  src={currentLargeImageUrlInDialog}
                  alt={`${post.title} - 圖片 ${dialogSelectedImageIndex + 1}`}
                  fill
                  className="object-contain"
                  data-ai-hint="discussion content"
                />
                {post.imageUrls.length > 1 && (
                  <>
                    <Button variant="outline" size="icon" className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80 h-8 w-8 sm:h-10 sm:w-10" onClick={prevImageInDialog}><ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" /></Button>
                    <Button variant="outline" size="icon" className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80 h-8 w-8 sm:h-10 sm:w-10" onClick={nextImageInDialog}><ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" /></Button>
                  </>
                )}
              </div>
              {post.imageUrls.length > 1 && (
                <ScrollArea className="mt-2">
                  <div className="flex justify-center space-x-2 p-2">
                    {post.imageUrls.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => handleThumbnailClickInDialog(index)}
                        className={cn(
                          "relative h-14 w-14 sm:h-16 sm:w-16 rounded border-2 overflow-hidden transition-all flex-shrink-0",
                          index === dialogSelectedImageIndex ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent hover:border-muted-foreground"
                        )}
                      >
                        <Image src={url} alt={`縮圖 ${index + 1}`} fill className="object-cover" data-ai-hint="discussion thumbnail" />
                        {index === dialogSelectedImageIndex && ( <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white/80"/></div>)}
                      </button>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </div>
          )}
          <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed">
            {post.content}
          </p>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <h2 className="text-xl font-semibold mb-6 text-primary flex items-center">
        <MessageSquare className="mr-2 h-6 w-6" />
        留言區 ({post.comments?.length || 0})
      </h2>

      <div className="space-y-6 mb-8">
        {post.comments && post.comments.length > 0 ? (
          post.comments.sort((a, b) => (a.createdAt as Timestamp)?.toDate().getTime() - (b.createdAt as Timestamp)?.toDate().getTime()).map((comment) => (
            <Card key={comment.id} className="bg-muted/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs text-muted-foreground flex items-center">
                  <UserCircle2 className="mr-1.5 h-4 w-4" />
                  {comment.authorDisplayName || comment.authorEmail.split('@')[0]}
                  <span className="mx-1.5">&bull;</span>
                  {formatRelativeTime(comment.createdAt as Timestamp)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">{comment.text}</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">目前尚無留言，成為第一個留言的人吧！</p>
        )}
      </div>

      {currentUserEmail ? (
        <form onSubmit={handleCommentSubmit} className="space-y-4">
          <div>
            <Label htmlFor="newComment" className="text-base font-medium text-primary">
              發表您的留言
            </Label>
            <Textarea
              id="newComment"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="輸入您的留言..."
              rows={4}
              className="mt-2 focus:ring-accent focus:border-accent"
            />
          </div>
          <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmittingComment}>
            {isSubmittingComment ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />送出中...</> : <><Send className="mr-2 h-4 w-4" />送出留言</>}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">您需要<Link href="/login" className="underline text-primary hover:text-accent">登入</Link>才能發表留言。</p>
      )}
    </div>
  );
}

