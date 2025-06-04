
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, MessageSquareText, UserCircle2, Star, CheckCircle, ArrowLeftCircle, ArrowRightCircle } from 'lucide-react';
import { db } from '@/lib/firebase'; // Removed storage import
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, Timestamp, type DocumentData } from 'firebase/firestore';
// Removed: import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import type { DiscussionPost, ManagedImage } from '@/lib/mock-data';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILES_COUNT = 3; // Max 3 images
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

// Helper function to convert File to Base64 Data URI
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

const postFormSchema = z.object({
    title: z.string().min(5, { message: '標題至少需要 5 個字元。' }).max(100, { message: '標題不能超過 100 個字元。' }),
    content: z.string().min(10, { message: '內容至少需要 10 個字元。' }).max(5000, { message: '內容不能超過 5000 個字元。' }),
    imageFiles: z
        .array(z.instanceof(File))
        .max(MAX_FILES_COUNT, `您最多可以上傳 ${MAX_FILES_COUNT} 張圖片。`)
        .optional()
        .refine(
            (files) => {
                if (!files || files.length === 0) return true;
                for (const file of files) {
                    if (file.size > MAX_FILE_SIZE_BYTES) return false;
                }
                return true;
            },
            `有圖片檔案大小超過 ${MAX_FILE_SIZE_MB}MB。`
        )
        .refine(
            (files) => {
                if (!files || files.length === 0) return true;
                for (const file of files) {
                    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return false;
                }
                return true;
            },
            "有圖片格式不受支援。僅支援 JPG, JPEG, PNG, WEBP, GIF。"
        ),
    primaryImageIndex: z.number().min(0).optional().default(0),
});

type PostFormValues = z.infer<typeof postFormSchema>;

export default function CommunityDiscussionPage() {
    const { toast } = useToast();
    const [posts, setPosts] = useState<DiscussionPost[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);
    const [isSubmittingPost, setIsSubmittingPost] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
    const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string | null>(null);

    const [managedImages, setManagedImages] = useState<ManagedImage[]>([]);

    const form = useForm<PostFormValues>({
        resolver: zodResolver(postFormSchema),
        defaultValues: {
            title: '',
            content: '',
            imageFiles: [],
            primaryImageIndex: 0,
        },
    });
    const watchedPrimaryImageIndex = form.watch('primaryImageIndex');

    useEffect(() => {
        const email = localStorage.getItem('userEmail');
        const displayName = localStorage.getItem('userDisplayName');
        setCurrentUserEmail(email);
        setCurrentUserDisplayName(displayName);

        const fetchPosts = async () => {
            setIsLoadingPosts(true);
            try {
                const postsCollection = collection(db, 'discussionPosts');
                const q = query(postsCollection, orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);
                const postsData = querySnapshot.docs.map(doc => {
                    const data = doc.data() as DocumentData;
                    return {
                        id: doc.id,
                        title: data.title,
                        content: data.content,
                        authorEmail: data.authorEmail,
                        authorDisplayName: data.authorDisplayName,
                        createdAt: data.createdAt,
                        comments: data.comments || [],
                        imageUrls: data.imageUrls || [], // These can be Storage URLs or Base64 Data URIs
                        primaryImageIndex: data.primaryImageIndex !== undefined ? data.primaryImageIndex : 0,
                    } as DiscussionPost;
                });
                setPosts(postsData);
            } catch (error) {
                console.error("Error fetching discussion posts: ", error);
                toast({
                    title: "載入討論失敗",
                    description: "無法從資料庫獲取討論列表。",
                    variant: "destructive",
                });
            } finally {
                setIsLoadingPosts(false);
            }
        };
        fetchPosts();
    }, [toast]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) {
            setManagedImages([]);
            form.setValue("imageFiles", [], { shouldValidate: true });
            event.target.value = '';
            return;
        }

        if (files.length > MAX_FILES_COUNT) {
            form.setError("imageFiles", { type: "manual", message: `您最多可以上傳 ${MAX_FILES_COUNT} 張圖片。` });
            setManagedImages([]); // Clear managed images on error
            form.setValue("imageFiles", [], { shouldValidate: true }); // Clear form value
            event.target.value = '';
            return;
        }

        let allFilesValid = true;
        const newManagedImages: ManagedImage[] = [];
        const fileObjectsForForm: File[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > MAX_FILE_SIZE_BYTES) {
                form.setError("imageFiles", { type: "manual", message: `圖片 "${file.name}" 過大 (最大 ${MAX_FILE_SIZE_MB}MB)。` });
                allFilesValid = false;
                break;
            }
            if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
                form.setError("imageFiles", { type: "manual", message: `圖片 "${file.name}" 格式不受支援。` });
                allFilesValid = false;
                break;
            }
            newManagedImages.push({ id: uuidv4(), file, previewUrl: URL.createObjectURL(file) });
            fileObjectsForForm.push(file);
        }

        if (!allFilesValid) {
            setManagedImages([]); // Clear managed images on error
            form.setValue("imageFiles", [], { shouldValidate: true }); // Clear form value
            event.target.value = '';
            return;
        }

        form.clearErrors("imageFiles");
        setManagedImages(newManagedImages);
        form.setValue("imageFiles", fileObjectsForForm, { shouldValidate: true });
        form.setValue('primaryImageIndex', 0); // Reset primary image index when new files are selected
    };

    const handleSetCoverImage = (index: number) => {
        form.setValue('primaryImageIndex', index, { shouldValidate: true, shouldDirty: true });
    };

    const moveImage = (index: number, direction: 'left' | 'right') => {
        const newImagesArray = [...managedImages];
        const targetIndex = direction === 'left' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newImagesArray.length) return;

        [newImagesArray[index], newImagesArray[targetIndex]] = [newImagesArray[targetIndex], newImagesArray[index]];

        let newPrimaryIndex = form.getValues('primaryImageIndex');
        if (newPrimaryIndex === index) {
            newPrimaryIndex = targetIndex;
        } else if (newPrimaryIndex === targetIndex) {
            newPrimaryIndex = index;
        }

        setManagedImages(newImagesArray);
        const newFileObjects = newImagesArray.map(img => img.file).filter(file => file !== null) as File[];
        form.setValue('imageFiles', newFileObjects, { shouldValidate: true });
        form.setValue('primaryImageIndex', newPrimaryIndex);
    };

    const onSubmit: SubmitHandler<PostFormValues> = async (data) => {
        if (!currentUserEmail) {
            toast({ title: "錯誤", description: "您需要登入才能發表主題。", variant: "destructive" });
            return;
        }
        setIsSubmittingPost(true);

        const imageBase64Strings: string[] = [];
        if (data.imageFiles && data.imageFiles.length > 0) {
            for (const file of data.imageFiles) {
                try {
                    // Re-validate before conversion as an extra check
                    if (file.size > MAX_FILE_SIZE_BYTES) throw new Error(`圖片 "${file.name}" 過大。`);
                    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error(`圖片 "${file.name}" 格式不受支援。`);

                    const base64String = await fileToBase64(file);
                    imageBase64Strings.push(base64String);
                } catch (error: any) {
                    console.error("Error converting image to Base64:", error);
                    toast({
                        title: "圖片處理失敗",
                        description: error.message || `轉換圖片 ${file.name} 時發生錯誤。`,
                        variant: "destructive",
                    });
                    setIsSubmittingPost(false);
                    return;
                }
            }
        }

        const finalPrimaryImageIndex = data.primaryImageIndex < imageBase64Strings.length ? data.primaryImageIndex : 0;
        let finalImageUrlsInOrder = [...imageBase64Strings];
        if (finalPrimaryImageIndex > 0 && finalPrimaryImageIndex < finalImageUrlsInOrder.length) {
            const primary = finalImageUrlsInOrder.splice(finalPrimaryImageIndex, 1)[0];
            finalImageUrlsInOrder.unshift(primary);
        }

        const newPostData: Omit<DiscussionPost, 'id' | 'comments'> & { createdAt: any; imageUrls?: string[]; primaryImageIndex?: number; } = {
            title: data.title,
            content: data.content,
            authorEmail: currentUserEmail,
            authorDisplayName: currentUserDisplayName || currentUserEmail.split('@')[0],
            createdAt: serverTimestamp(),
            imageUrls: finalImageUrlsInOrder, // Store Base64 strings
            primaryImageIndex: 0, // After reordering, primary is at index 0
        };

        try {
            const docRef = await addDoc(collection(db, 'discussionPosts'), newPostData);
            const postForUI: DiscussionPost = {
                ...newPostData,
                id: docRef.id,
                createdAt: new Timestamp(Math.floor(Date.now() / 1000), 0),
                comments: [],
            };
            setPosts(prevPosts => [postForUI, ...prevPosts]);

            toast({ title: "成功", description: "您的討論主題已發表。" });
            form.reset();
            setManagedImages([]);
            const fileInput = document.getElementById('imageFilesPost') as HTMLInputElement | null;
            if (fileInput) fileInput.value = '';
            setIsDialogOpen(false);

        } catch (error: any) {
            console.error("Error during post submission: ", error);
            const isSizeError = error.message?.includes("longer than 1048487 bytes") || error.code === 'invalid-argument' || error.message?.includes("Entity too large");
            toast({
                title: "發表失敗",
                description: isSizeError
                    ? "發表失敗：圖片資料量過大，已超出 Firestore 文件限制 (1MB)。請嘗試減少圖片數量或使用較小解析度的圖片。"
                    : `發表失敗: ${error.message || '未知 Firestore 錯誤'}`,
                variant: "destructive",
                duration: 9000,
            });
        } finally {
            setIsSubmittingPost(false);
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


    return (
        <div className="container mx-auto py-8">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl flex items-center">
                        <MessageSquareText className="mr-3 h-10 w-10" />
                        社群討論區
                    </h1>
                    <p className="mt-2 text-lg leading-8 text-muted-foreground">
                        在這裡與其他學習者交流心得、提問或分享您的組裝經驗。
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        form.reset();
                        setManagedImages([]);
                        const fileInput = document.getElementById('imageFilesPost') as HTMLInputElement | null;
                        if (fileInput) fileInput.value = '';
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="mt-4 sm:mt-0 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!currentUserEmail}>
                            <PlusCircle className="mr-2 h-5 w-5" />
                            發表新主題
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-2xl">發表新的討論主題</DialogTitle>
                            <DialogDescription>
                                請填寫標題和內容來開始一個新的討論。您可以選擇上傳最多 {MAX_FILES_COUNT} 張圖片。
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>標題 *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="請輸入您的主題標題" {...field} className="placeholder:opacity-50" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="content"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>內容 *</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="詳細描述您的問題、心得或想討論的內容..."
                                                    className="resize-y min-h-[150px] placeholder:opacity-50"
                                                    rows={8}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="imageFiles"
                                    render={({ field: { ref, name, onBlur } }) => (
                                        <FormItem>
                                            <FormLabel>上傳圖片 (最多 {MAX_FILES_COUNT} 張，選填)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="file"
                                                    id="imageFilesPost"
                                                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                                                    multiple
                                                    ref={ref}
                                                    name={name}
                                                    onBlur={onBlur}
                                                    onChange={handleFileChange}
                                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20 cursor-pointer"
                                                />
                                            </FormControl>
                                            {managedImages && managedImages.length > 0 && (
                                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {managedImages.map((img, index) => (
                                                        <div key={img.id} className="relative group flex flex-col items-center">
                                                            <div className={`relative aspect-video w-full border-2 rounded-md overflow-hidden transition-all ${watchedPrimaryImageIndex === index ? 'border-primary ring-2 ring-primary' : 'border-transparent group-hover:border-muted-foreground'}`}>
                                                                <Image src={img.previewUrl} alt={`預覽 ${index + 1}`} fill={true} className="object-contain" data-ai-hint="discussion preview" />
                                                                {watchedPrimaryImageIndex === index && (
                                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                                        <CheckCircle className="h-8 w-8 text-white" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-center w-full mt-1 space-x-1">
                                                                {managedImages.length > 1 && (
                                                                    <Button variant="ghost" size="icon" type="button" onClick={() => moveImage(index, 'left')} disabled={index === 0} className="h-6 w-6 p-1 text-muted-foreground hover:text-primary disabled:opacity-30" title="向左移動"><ArrowLeftCircle className="h-4 w-4" /></Button>
                                                                )}
                                                                <Button variant="outline" size="sm" type="button" onClick={() => handleSetCoverImage(index)} className={`flex-grow text-xs px-1.5 py-0.5 h-6 ${watchedPrimaryImageIndex === index ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}><Star className={`mr-1 h-3 w-3 ${watchedPrimaryImageIndex === index ? 'fill-current' : ''}`} />{watchedPrimaryImageIndex === index ? '主要' : '設為主要'}</Button>
                                                                {managedImages.length > 1 && (
                                                                    <Button variant="ghost" size="icon" type="button" onClick={() => moveImage(index, 'right')} disabled={index === managedImages.length - 1} className="h-6 w-6 p-1 text-muted-foreground hover:text-primary disabled:opacity-30" title="向右移動"><ArrowRightCircle className="h-4 w-4" /></Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <FormDescription>
                                                選擇您的圖片 (每張最大 {MAX_FILE_SIZE_MB}MB)。
                                                <br />注意：圖片將以 Base64 格式儲存於資料庫，過大的圖片可能導致儲存失敗。
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter className="pt-4">
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline" onClick={() => { form.reset(); setManagedImages([]); const fileInput = document.getElementById('imageFilesPost') as HTMLInputElement | null; if (fileInput) fileInput.value = ''; }}>取消</Button>
                                    </DialogClose>
                                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmittingPost}>
                                        {isSubmittingPost ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />發表中...</> : "確認發表"}
                                    </Button>
                                </DialogFooter>
                                {!currentUserEmail && (
                                    <p className="text-sm text-destructive text-center mt-2">您需要登入才能發表主題。</p>
                                )}
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </header>

            <section>
                {isLoadingPosts ? (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="ml-4 text-muted-foreground">載入討論中...</p>
                    </div>
                ) : posts.length > 0 ? (
                    <div className="space-y-6">
                        {posts.map((post) => (
                            <Card key={post.id} className="shadow-md hover:shadow-lg transition-shadow duration-300">
                                <CardHeader>
                                    <Link href={`/community-discussion/${post.id}`} passHref>
                                        <CardTitle className="text-xl text-primary hover:text-accent cursor-pointer">
                                            {post.title}
                                        </CardTitle>
                                    </Link>
                                    <CardDescription className="text-xs text-muted-foreground flex items-center pt-1">
                                        <UserCircle2 className="mr-1.5 h-4 w-4" />
                                        由 {post.authorDisplayName || post.authorEmail.split('@')[0]} 發表於 {formatRelativeTime(post.createdAt as Timestamp)}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {post.imageUrls && post.imageUrls.length > 0 && (
                                        <div className="mb-4 aspect-video w-full max-w-md rounded-md overflow-hidden relative border">
                                            {/* Ensure next/image can handle base64 data URIs */}
                                            <Image src={post.imageUrls[post.primaryImageIndex || 0]} alt={`主題圖片 ${post.title}`} fill className="object-contain" data-ai-hint="discussion image" />
                                        </div>
                                    )}
                                    <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-3">
                                        {post.content}
                                    </p>
                                </CardContent>
                                <CardFooter className="flex justify-between items-center">
                                    <Link href={`/community-discussion/${post.id}`} passHref>
                                        <Button variant="outline" size="sm" className="text-xs">
                                            查看討論 ({post.comments?.length || 0} 則回覆)
                                        </Button>
                                    </Link>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <MessageSquareText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                        <h2 className="text-2xl font-semibold text-primary mb-2">尚無討論主題</h2>
                        <p className="text-muted-foreground">目前還沒有人發表主題。成為第一個吧！</p>
                    </div>
                )}
            </section>
        </div>
    );
}
