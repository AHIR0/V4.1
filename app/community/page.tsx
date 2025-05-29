
'use client';

import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { BuildCard } from "@/components/build-card";
import type { PcBuild, ManagedImage } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Loader2, Star, CheckCircle, ArrowLeftCircle, ArrowRightCircle } from "lucide-react";

// Firebase imports
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, Timestamp, deleteDoc, doc as firestoreDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';


const MAX_FILE_SIZE_MB = 5;
const MAX_FILES_COUNT = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

const buildFormSchema = z.object({
    buildName: z.string().min(3, { message: "組裝名稱至少需要 3 個字元。" }),
    studentName: z.string().min(2, { message: "您的名稱至少需要 2 個字元。" }),
    description: z.string().optional(),
    imageFiles: z
        .array(z.instanceof(File))
        .min(0, "")
        .max(MAX_FILES_COUNT, `您最多可以上傳 ${MAX_FILES_COUNT} 張圖片。`)
        .refine(
            (files) => {
                for (const file of files) {
                    if (file.size > MAX_FILE_SIZE_BYTES) return false;
                }
                return true;
            },
            `有圖片檔案大小超過 ${MAX_FILE_SIZE_MB}MB。請檢查每個檔案。`
        )
        .refine(
            (files) => {
                for (const file of files) {
                    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return false;
                }
                return true;
            },
            "有圖片格式不受支援。僅支援 JPG, JPEG, PNG, WEBP, GIF。"
        ),
    primaryImageIndex: z.number().min(0).optional().default(0),
    cpu: z.string().optional(),
    motherboard: z.string().optional(),
    cooler: z.string().optional(),
    ram: z.string().optional(),
    storage: z.string().optional(),
    gpu: z.string().optional(),
    psu: z.string().optional(),
    pcCase: z.string().optional(),
    caseFans: z.string().optional(),
});

type BuildFormValues = z.infer<typeof buildFormSchema>;

export default function CommunityPage() {
    const { toast } = useToast();
    const [communityBuilds, setCommunityBuilds] = useState<PcBuild[]>([]);
    const [isLoadingBuilds, setIsLoadingBuilds] = useState(true);
    const [isSubmittingBuild, setIsSubmittingBuild] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [managedImages, setManagedImages] = useState<ManagedImage[]>([]);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string | null>(null);
    const [editingBuild, setEditingBuild] = useState<PcBuild | null>(null);


    const form = useForm<BuildFormValues>({
        resolver: zodResolver(buildFormSchema),
        defaultValues: {
            buildName: "",
            studentName: "",
            description: "",
            imageFiles: [],
            primaryImageIndex: 0,
            cpu: "",
            motherboard: "",
            cooler: "",
            ram: "",
            storage: "",
            gpu: "",
            psu: "",
            pcCase: "",
            caseFans: "",
        },
    });

    const watchedPrimaryImageIndex = form.watch('primaryImageIndex');

    useEffect(() => {
        const storedEmail = localStorage.getItem('userEmail');
        const storedDisplayName = localStorage.getItem('userDisplayName');
        setUserEmail(storedEmail);
        setCurrentUserDisplayName(storedDisplayName);

        const fetchBuilds = async () => {
            setIsLoadingBuilds(true);
            try {
                const buildsCollection = collection(db, 'builds');
                const q = query(buildsCollection, orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);
                const buildsData = querySnapshot.docs.map(docSnapshot => {
                    const data = docSnapshot.data();
                    let createdAtString = "日期未知";
                    if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                        createdAtString = data.createdAt.toDate().toLocaleDateString();
                    } else if (data.createdAt) {
                        createdAtString = new Date(data.createdAt).toLocaleDateString();
                    }

                    let imageUrls: string[];
                    let primaryImageHint: string | undefined;

                    if (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
                        imageUrls = data.imageUrls;
                        primaryImageHint = data.primaryImageHint || (data.imageUrls.length > 1 ? "build gallery" : "build photo");
                    } else if (data.imageUrl) {
                        imageUrls = [data.imageUrl as string];
                        primaryImageHint = data.imageHint || "build photo";
                    } else {
                        imageUrls = ["https://placehold.co/600x400.png"];
                        primaryImageHint = "custom build";
                    }

                    return {
                        id: docSnapshot.id,
                        buildName: data.buildName ?? "未命名組裝",
                        studentName: data.studentName ?? "匿名",
                        description: data.description ?? "沒有提供描述。",
                        imageUrls,
                        primaryImageHint: primaryImageHint ?? "build photo",
                        primaryImageIndex: typeof data.primaryImageIndex === 'number' ? data.primaryImageIndex : 0,
                        createdAt: createdAtString,
                        uploaderEmail: data.uploaderEmail ?? undefined,
                        components: Array.isArray(data.components)
                            ? data.components
                            : [], // 組件可以為空，但要存在
                    } satisfies PcBuild;
                });
                setCommunityBuilds(buildsData);
            } catch (error) {
                console.error("Error fetching builds: ", error);
                toast({
                    title: "載入組裝失敗",
                    description: "無法從資料庫獲取組裝列表。",
                    variant: "destructive",
                });
            } finally {
                setIsLoadingBuilds(false);
            }
        };
        fetchBuilds();
    }, [toast]);

    useEffect(() => {
        if (isDialogOpen && currentUserDisplayName && !editingBuild) {
            form.setValue('studentName', currentUserDisplayName, { shouldDirty: false, shouldValidate: false });
        }
    }, [isDialogOpen, currentUserDisplayName, form, editingBuild]);

    const handleBuildDeleted = (buildId: string) => {
        setCommunityBuilds(prevBuilds => prevBuilds.filter(build => build.id !== buildId));
    };

    const handleEditBuild = (build: PcBuild) => {
        setEditingBuild(build);
        form.reset({
            buildName: build.buildName,
            studentName: build.studentName,
            description: build.description,
            imageFiles: [],
            primaryImageIndex: build.primaryImageIndex || 0,
            cpu: build.components.find(c => c.type === "CPU")?.name || "",
            motherboard: build.components.find(c => c.type === "Motherboard")?.name || "",
            cooler: build.components.find(c => c.type === "Cooler")?.name || "",
            ram: build.components.find(c => c.type === "RAM")?.name || "",
            storage: build.components.find(c => c.type === "Storage")?.name || "",
            gpu: build.components.find(c => c.type === "GPU")?.name || "",
            psu: build.components.find(c => c.type === "PSU")?.name || "",
            pcCase: build.components.find(c => c.type === "Case")?.name || "",
            caseFans: build.components.find(c => c.type === "Case Fans")?.name || "",
        });

        if (build.imageUrls && build.imageUrls.length > 0) {
            setManagedImages(build.imageUrls.map(url => ({ id: uuidv4(), file: null, previewUrl: url })));
        } else {
            setManagedImages([]);
        }
        setIsDialogOpen(true);
    };


    const onSubmit: SubmitHandler<BuildFormValues> = async (data) => {
        console.log("Form data on submit:", data);
        if (!userEmail && !editingBuild) {
            toast({
                title: "請先登入",
                description: "您需要登入才能分享您的組裝。",
                variant: "destructive",
            });
            return;
        }
        setIsSubmittingBuild(true);
        console.log("Submitting build. Editing mode:", !!editingBuild);

        let uploadedImageUrls: string[] = [];
        const newFilesToUpload = data.imageFiles.filter(file => file instanceof File);

        if (newFilesToUpload.length > 0) {
            console.log("New files to upload:", newFilesToUpload.length);
            try {
                // Sanitize email for path and handle null/undefined case
                const userPathSegment = userEmail
                    ? userEmail.replace(/\./g, '_').replace(/@/g, '_at_')
                    : 'anonymous_builds';
                console.log(`Using user path segment for storage: ${userPathSegment}`);

                const uploadPromises = newFilesToUpload.map(async (file) => {
                    const fileName = `${uuidv4()}-${file.name}`;
                    const imagePath = `user_build_images/${userPathSegment}/${fileName}`;
                    const imageRef = storageRef(storage, imagePath);
                    console.log(`Uploading ${fileName} to Firebase Storage path: ${imagePath}...`);
                    await uploadBytes(imageRef, file);
                    const downloadURL = await getDownloadURL(imageRef);
                    console.log(`Uploaded ${fileName}, URL: ${downloadURL}`);
                    return downloadURL;
                });
                uploadedImageUrls = await Promise.all(uploadPromises);
            } catch (error: any) {
                console.error("Error uploading images to Firebase Storage:", error);
                let toastMessage = `上傳圖片時發生錯誤: ${error.message || '未知錯誤'}`;
                if (error.code === 'storage/unauthorized' || error.code === 'storage/object-not-found') {
                    toastMessage = `圖片上傳失敗: ${error.message}. 請檢查 Firebase Storage 安全性規則或網路連線。`;
                }
                toast({
                    title: "圖片上傳失敗",
                    description: toastMessage,
                    variant: "destructive",
                });
                setIsSubmittingBuild(false);
                return;
            }
        } else if (editingBuild && editingBuild.imageUrls && editingBuild.imageUrls.length > 0) {
            uploadedImageUrls = managedImages
                .map(img => img.previewUrl)
                .filter(url => typeof url === 'string' && url.startsWith("https://firebasestorage.googleapis.com/"));
            console.log("Keeping existing images, potentially reordered:", uploadedImageUrls);
        }



        const finalPrimaryImageIndex = data.primaryImageIndex < uploadedImageUrls.length ? data.primaryImageIndex : 0;

        let finalImageUrlsInOrder = [...uploadedImageUrls];
        if (finalPrimaryImageIndex > 0 && finalPrimaryImageIndex < finalImageUrlsInOrder.length) {
            const primary = finalImageUrlsInOrder.splice(finalPrimaryImageIndex, 1)[0];
            finalImageUrlsInOrder.unshift(primary);
        }

        console.log("Final image URLs to save (in order):", finalImageUrlsInOrder);
        console.log("Other form data:", {
            buildName: data.buildName,
            studentName: data.studentName,
            description: data.description,
            cpu: data.cpu,
            // ... (log other components if needed)
        });


        const buildToSave: Omit<PcBuild, 'id' | 'createdAt'> & { createdAt?: any; uploaderEmail?: string } = {
            buildName: data.buildName,
            studentName: data.studentName,
            description: data.description || "沒有提供描述。",
            imageUrls: finalImageUrlsInOrder,
            primaryImageHint: "uploaded build",
            primaryImageIndex: 0,
            components: [
                { type: "CPU", name: data.cpu || "未知" },
                { type: "Motherboard", name: data.motherboard || "未知" },
                { type: "Cooler", name: data.cooler || "未知" },
                { type: "RAM", name: data.ram || "未知" },
                { type: "Storage", name: data.storage || "未知" },
                { type: "GPU", name: data.gpu || "未知" },
                { type: "PSU", name: data.psu || "未知" },
                { type: "Case", name: data.pcCase || "未知" },
                { type: "Case Fans", name: data.caseFans || "未知" },
            ].filter(c => c.name !== "未知" || c.name.trim() !== ""),
        };

        if (userEmail) {
            buildToSave.uploaderEmail = userEmail;
        }

        try {
            if (editingBuild && editingBuild.id) {
                console.log("Updating existing build:", editingBuild.id);
                const buildDocRef = firestoreDoc(db, "builds", editingBuild.id);
                await updateDoc(buildDocRef, buildToSave);
                toast({
                    title: "組裝更新成功！",
                    description: `您的組裝 "${data.buildName}" 已更新。`,
                });
                setCommunityBuilds(prevBuilds => prevBuilds.map(b => b.id === editingBuild.id ? { ...b, ...buildToSave, id: editingBuild.id, createdAt: b.createdAt } : b));
            } else {
                console.log("Adding new build to Firestore...");
                buildToSave.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, "builds"), buildToSave);
                console.log("New build added with ID:", docRef.id);
                toast({
                    title: "組裝分享成功！",
                    description: `您的組裝 "${data.buildName}" 已提交。`,
                });
                const newBuildForUI: PcBuild = {
                    id: docRef.id,
                    ...buildToSave,
                    createdAt: new Date().toLocaleDateString(),
                };
                setCommunityBuilds(prevBuilds => [newBuildForUI, ...prevBuilds]);
            }

            form.reset();
            setManagedImages([]);
            form.setValue('primaryImageIndex', 0);
            setIsDialogOpen(false);
            setEditingBuild(null);
        } catch (error: any) {
            console.error("Error saving document to Firestore: ", error);
            console.error("Full Firestore error object:", JSON.stringify(error, null, 2));
            const isSizeError = error.message?.includes("longer than 1048487 bytes") || error.code === 'invalid-argument';
            toast({
                title: editingBuild ? "更新失敗" : "分享失敗",
                description: isSizeError
                    ? "儲存您的組裝時發生錯誤：資料量過大，請嘗試減少圖片數量或描述長度。"
                    : `儲存您的組裝時發生錯誤: ${error.message || '未知 Firestore 錯誤'}`,
                variant: "destructive",
            });
        } finally {
            setIsSubmittingBuild(false);
        }
    }


    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) {
            setManagedImages([]);
            form.setValue("imageFiles", [], { shouldValidate: true });
            return;
        }

        if (files.length > MAX_FILES_COUNT) {
            form.setError("imageFiles", { type: "manual", message: `您最多可以上傳 ${MAX_FILES_COUNT} 張圖片。` });
            setManagedImages([]);
            form.setValue("imageFiles", [], { shouldValidate: true });
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
            setManagedImages([]);
            form.setValue("imageFiles", [], { shouldValidate: true });
            event.target.value = '';
            return;
        }

        form.clearErrors("imageFiles");
        setManagedImages(newManagedImages);
        form.setValue("imageFiles", fileObjectsForForm, { shouldValidate: true });
        form.setValue('primaryImageIndex', 0);
    };

    const handleSetCoverImage = (index: number) => {
        form.setValue('primaryImageIndex', index, { shouldValidate: true, shouldDirty: true });
    };

    const moveImage = (index: number, direction: 'left' | 'right') => {
        const newImages = [...managedImages];
        const targetIndex = direction === 'left' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newImages.length) return;

        [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];

        let newPrimaryIndex = form.getValues('primaryImageIndex');
        if (newPrimaryIndex === index) {
            newPrimaryIndex = targetIndex;
        } else if (newPrimaryIndex === targetIndex) {
            newPrimaryIndex = index;
        }

        setManagedImages(newImages);
        form.setValue('primaryImageIndex', newPrimaryIndex);
        form.setValue('imageFiles', newImages.map(img => img.file).filter(file => file !== null) as File[], { shouldValidate: true });
    };


    return (
        <div className="container mx-auto py-8">
            <header className="mb-12 flex flex-col sm:flex-row justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
                        社群組裝分享
                    </h1>
                    <p className="mt-2 text-lg leading-8 text-muted-foreground">
                        分享您的自訂電腦組裝，並從他人的作品中獲取靈感。
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        form.reset({
                            buildName: "",
                            studentName: currentUserDisplayName || "",
                            description: "",
                            imageFiles: [],
                            primaryImageIndex: 0,
                            cpu: "", motherboard: "", cooler: "", ram: "",
                            storage: "", gpu: "", psu: "", pcCase: "", caseFans: ""
                        });
                        setManagedImages([]);
                        setEditingBuild(null);
                    } else if (currentUserDisplayName && !editingBuild) {
                        form.setValue('studentName', currentUserDisplayName);
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="mt-4 sm:mt-0 bg-accent hover:bg-accent/90 text-accent-foreground">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            分享您的組裝
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogDescription>
                                {editingBuild ? "修改您的組裝資訊。" : "填寫以下資訊來分享您的作品。組裝名稱、您的名稱與至少一張圖片為必填。"}
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                                <FormField
                                    control={form.control}
                                    name="buildName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>組裝名稱 *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="例如：我的夢幻電競機" {...field} className="placeholder:opacity-30" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="studentName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>您的名稱/暱稱 *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="例如：電腦小達人" {...field} className="placeholder:opacity-30" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>描述 (選填)</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="分享一下您的組裝理念、特色或遇到的挑戰..."
                                                    className="resize-none placeholder:opacity-30"
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
                                    render={({ field: { ref, name, onBlur, value, onChange: onFieldChange } }) => (
                                        <FormItem>
                                            <FormLabel>上傳圖片 (最多 {MAX_FILES_COUNT} 張) </FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="file"
                                                    id="imageFiles"
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
                                                                <Image src={img.previewUrl} alt={`圖片預覽 ${index + 1}`} fill={true} className="object-contain" data-ai-hint="build preview" />
                                                                {watchedPrimaryImageIndex === index && (
                                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                                        <CheckCircle className="h-8 w-8 text-white" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-center w-full mt-1 space-x-1">
                                                                {managedImages.length > 1 && (
                                                                    <Button
                                                                        variant="ghost" size="icon" type="button"
                                                                        onClick={() => moveImage(index, 'left')}
                                                                        disabled={index === 0}
                                                                        className="h-6 w-6 p-1 text-muted-foreground hover:text-primary disabled:opacity-30"
                                                                        title="向左移動"
                                                                    >
                                                                        <ArrowLeftCircle className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="outline" size="sm" type="button"
                                                                    onClick={() => handleSetCoverImage(index)}
                                                                    className={`flex-grow text-xs px-1.5 py-0.5 h-6 ${watchedPrimaryImageIndex === index ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                                                                >
                                                                    <Star className={`mr-1 h-3 w-3 ${watchedPrimaryImageIndex === index ? 'fill-current' : ''}`} />
                                                                    {watchedPrimaryImageIndex === index ? '封面' : '設為封面'}
                                                                </Button>
                                                                {managedImages.length > 1 && (
                                                                    <Button
                                                                        variant="ghost" size="icon" type="button"
                                                                        onClick={() => moveImage(index, 'right')}
                                                                        disabled={index === managedImages.length - 1}
                                                                        className="h-6 w-6 p-1 text-muted-foreground hover:text-primary disabled:opacity-30"
                                                                        title="向右移動"
                                                                    >
                                                                        <ArrowRightCircle className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <FormDescription>
                                                選擇您的組裝圖片 (每張最大 {MAX_FILE_SIZE_MB}MB)。
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <h3 className="text-lg font-semibold pt-2 text-primary">主要零組件 (選填)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="cpu" render={({ field }) => (<FormItem><FormLabel>CPU</FormLabel><FormControl><Input placeholder="例如：AMD Ryzen 7 7800X3D" {...field} className="placeholder:opacity-30" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="motherboard" render={({ field }) => (<FormItem><FormLabel>主機板</FormLabel><FormControl><Input placeholder="例如：ASUS ROG STRIX B650-E" {...field} className="placeholder:opacity-30" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="cooler" render={({ field }) => (<FormItem><FormLabel>散熱器 (CPU)</FormLabel><FormControl><Input placeholder="例如：Noctua NH-D15" {...field} className="placeholder:opacity-30" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="ram" render={({ field }) => (<FormItem><FormLabel>RAM (記憶體)</FormLabel><FormControl><Input placeholder="例如：Corsair Vengeance 32GB DDR5 6000MHz" {...field} className="placeholder:opacity-30" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="storage" render={({ field }) => (<FormItem><FormLabel>硬碟 (儲存裝置)</FormLabel><FormControl><Input placeholder="例如：Samsung 980 Pro 2TB NVMe SSD" {...field} className="placeholder:opacity-30" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="gpu" render={({ field }) => (<FormItem><FormLabel>GPU (顯示卡)</FormLabel><FormControl><Input placeholder="例如：NVIDIA RTX 4080" {...field} className="placeholder:opacity-30" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="psu" render={({ field }) => (<FormItem><FormLabel>電源供應器 (PSU)</FormLabel><FormControl><Input placeholder="例如：Corsair RM850x 850W 80+ Gold" {...field} className="placeholder:opacity-30" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="pcCase" render={({ field }) => (<FormItem><FormLabel>機殼</FormLabel><FormControl><Input placeholder="例如：NZXT H510 Flow" {...field} className="placeholder:opacity-30" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="caseFans" render={({ field }) => (<FormItem><FormLabel>機箱風扇</FormLabel><FormControl><Input placeholder="例如：Arctic P12 PWM PST (5 Pack)" {...field} className="placeholder:opacity-30" /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                <DialogFooter className="pt-4">
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline" onClick={() => {
                                            form.reset();
                                            setManagedImages([]);
                                            setEditingBuild(null);
                                            const fileInput = document.getElementById('imageFiles') as HTMLInputElement | null;
                                            if (fileInput) fileInput.value = '';
                                        }}>
                                            取消
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmittingBuild || (!userEmail && !editingBuild)}>
                                        {isSubmittingBuild ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {editingBuild ? "更新中..." : "提交中..."}
                                            </>
                                        ) : (!userEmail && !editingBuild) ? "請先登入" : (editingBuild ? "確認更新" : "分享組裝")}
                                    </Button>
                                </DialogFooter>
                                {(!userEmail && !editingBuild) && (
                                    <p className="text-sm text-destructive text-center mt-2">您需要登入才能分享您的組裝。</p>
                                )}
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </header>

            <section>
                {isLoadingBuilds ? (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="ml-4 text-muted-foreground">載入社群組裝中...</p>
                    </div>
                ) : communityBuilds.length > 0 ? (
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {communityBuilds.map((build) => (
                            <BuildCard
                                key={build.id}
                                build={build}
                                currentUserEmail={userEmail}
                                onBuildDeleted={handleBuildDeleted}
                                onBuildEdited={handleEditBuild}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-semibold text-primary mb-2">尚無分享</h2>
                        <p className="text-muted-foreground">目前還沒有人分享他們的組裝。成為第一個吧！</p>
                    </div>
                )}
            </section>
        </div>
    );
}

