
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
import { db } from '@/lib/firebase'; // Removed storage import as new uploads go to Firestore
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, Timestamp, deleteDoc, updateDoc } from 'firebase/firestore';
// Removed storage-related imports: storageRef, uploadBytes, getDownloadURL, deleteObject
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE_MB = 999999999999;
const MAX_FILES_COUNT = 5;
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

const buildFormSchema = z.object({
    buildName: z.string().min(3, { message: "組裝名稱至少需要 3 個字元。" }),
    studentName: z.string().min(2, { message: "您的名稱至少需要 2 個字元。" }),
    description: z.string().optional(),
    imageFiles: z // This field in the form will hold File objects for new uploads
        .array(z.instanceof(File))
        .max(MAX_FILES_COUNT, `您最多可以上傳 ${MAX_FILES_COUNT} 張圖片。`)
        .refine(
            (files) => {
                if (!files || files.length === 0 && !buildFormSchema.isEditing) return true; // Allow empty if not editing and images are not mandatory
                for (const file of files) {
                    if (file.size > MAX_FILE_SIZE_BYTES) return false;
                }
                return true;
            },
            `有圖片檔案大小超過 ${MAX_FILE_SIZE_MB}MB。請檢查每個檔案。`
        )
        .refine(
            (files) => {
                if (!files || files.length === 0 && !buildFormSchema.isEditing) return true;
                for (const file of files) {
                    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return false;
                }
                return true;
            },
            "有圖片格式不受支援。僅支援 JPG, JPEG, PNG, WEBP, GIF。"
        )
        .optional(), // Making it optional as existing builds might not re-upload
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
}).refine(data => {
    // When creating a new build, at least one image (via imageFiles) is required.
    // When editing, imageFiles can be empty if existing images are kept.
    // This logic might need refinement based on whether `managedImages` (representing existing + new) is empty.
    // For now, we'll rely on the `onSubmit` logic to ensure there's at least one image if it's a new build.
    return true;
}, {
    message: "請至少上傳一張圖片。",
    path: ["imageFiles"], // This error message might be overridden by individual file checks
});

// Add a flag to the schema for context, not ideal but works for zodResolver
// This is a bit of a hack; a custom resolver or form context might be cleaner
declare module 'zod' {
    interface ZodType {
        isEditing?: boolean;
    }
}
buildFormSchema.isEditing = false;


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
                        imageUrls = data.imageUrls; // These can be Storage URLs or Base64 Data URIs
                        primaryImageHint = data.primaryImageHint || (data.imageUrls.length > 1 ? "build gallery" : "build photo");
                    } else {
                        imageUrls = ["https://placehold.co/600x400.png"];
                        primaryImageHint = "custom build";
                    }

                    return {
                        id: docSnapshot.id,
                        ...data,
                        createdAt: createdAtString,
                        imageUrls: imageUrls,
                        primaryImageHint: primaryImageHint,
                        primaryImageIndex: data.primaryImageIndex !== undefined ? data.primaryImageIndex : 0,
                        uploaderEmail: data.uploaderEmail || undefined,
                    } as PcBuild;
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
        buildFormSchema.isEditing = !!editingBuild; // Update schema context
        if (isDialogOpen && currentUserDisplayName && !editingBuild) {
            form.setValue('studentName', currentUserDisplayName, { shouldDirty: false, shouldValidate: false });
        }
    }, [isDialogOpen, currentUserDisplayName, form, editingBuild]);

    const handleBuildDeleted = (buildId: string) => {
        setCommunityBuilds(prevBuilds => prevBuilds.filter(build => build.id !== buildId));
    };

    const handleEditBuild = (build: PcBuild) => {
        setEditingBuild(build);
        buildFormSchema.isEditing = true; // Set context for Zod schema
        form.reset({
            buildName: build.buildName,
            studentName: build.studentName,
            description: build.description,
            imageFiles: [], // Clear file input, existing images are in managedImages
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
        if (!userEmail && !editingBuild) {
            toast({
                title: "請先登入",
                description: "您需要登入才能分享您的組裝。",
                variant: "destructive",
            });
            return;
        }
        setIsSubmittingBuild(true);

        const finalImageRepresentations: string[] = [];

        // Process images from managedImages to maintain order and convert new ones
        for (const managedImage of managedImages) {
            if (managedImage.file) { // This is a new or replaced image
                try {
                    // Validate file again just before conversion (optional, Zod should cover it)
                    if (managedImage.file.size > MAX_FILE_SIZE_BYTES) {
                        throw new Error(`圖片 "${managedImage.file.name}" 過大 (最大 ${MAX_FILE_SIZE_MB}MB)。`);
                    }
                    if (!ACCEPTED_IMAGE_TYPES.includes(managedImage.file.type)) {
                        throw new Error(`圖片 "${managedImage.file.name}" 格式不受支援。`);
                    }
                    const base64String = await fileToBase64(managedImage.file);
                    finalImageRepresentations.push(base64String);
                } catch (error: any) {
                    console.error("Error converting image to Base64:", error);
                    toast({ title: "圖片處理失敗", description: error.message || `轉換圖片 ${managedImage.file?.name || ''} 時發生錯誤。`, variant: "destructive" });
                    setIsSubmittingBuild(false);
                    return;
                }
            } else if (managedImage.previewUrl) { // This is an existing image URL (could be Storage URL or already Base64)
                finalImageRepresentations.push(managedImage.previewUrl);
            }
        }


        if (finalImageRepresentations.length === 0) {
            toast({
                title: "缺少圖片",
                description: "請至少包含一張圖片。", // Updated message
                variant: "destructive",
            });
            setIsSubmittingBuild(false);
            return;
        }

        const finalPrimaryImageIndex = data.primaryImageIndex < finalImageRepresentations.length ? data.primaryImageIndex : 0;

        let finalImageUrlsInOrder = [...finalImageRepresentations];
        if (finalPrimaryImageIndex > 0 && finalPrimaryImageIndex < finalImageUrlsInOrder.length) {
            const primary = finalImageUrlsInOrder.splice(finalPrimaryImageIndex, 1)[0];
            finalImageUrlsInOrder.unshift(primary);
        }


        const buildToSave: Omit<PcBuild, 'id' | 'createdAt'> & { createdAt?: any; uploaderEmail?: string } = {
            buildName: data.buildName,
            studentName: data.studentName,
            description: data.description || "沒有提供描述。",
            imageUrls: finalImageUrlsInOrder,
            primaryImageHint: "uploaded build", // Or a more dynamic hint
            primaryImageIndex: 0, // After reordering, the primary image is always at index 0
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
            ].filter(c => c.name !== "未知" && c.name.trim() !== ""),
        };

        if (userEmail) {
            buildToSave.uploaderEmail = userEmail;
        }

        try {
            if (editingBuild && editingBuild.id) {
                const buildDocRef = firestoreDoc(db, "builds", editingBuild.id);
                // For updates, we don't change createdAt server-side, but could add an `updatedAt` field
                await updateDoc(buildDocRef, {
                    ...buildToSave,
                    updatedAt: serverTimestamp() // Example of adding an updatedAt field
                });
                toast({
                    title: "組裝更新成功！",
                    description: `您的組裝 "${data.buildName}" 已更新。`,
                });
                // Optimistically update local state
                setCommunityBuilds(prevBuilds => prevBuilds.map(b =>
                    b.id === editingBuild.id
                        ? { ...b, ...buildToSave, id: editingBuild.id, createdAt: b.createdAt, primaryImageIndex: 0 } // ensure primaryImageIndex is updated
                        : b
                ));
            } else {
                buildToSave.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, "builds"), buildToSave);
                toast({
                    title: "組裝分享成功！",
                    description: `您的組裝 "${data.buildName}" 已提交。`,
                });
                const newBuildForUI: PcBuild = {
                    id: docRef.id,
                    ...buildToSave,
                    createdAt: new Date().toLocaleDateString(),
                    primaryImageIndex: 0,
                };
                setCommunityBuilds(prevBuilds => [newBuildForUI, ...prevBuilds]);
            }

            form.reset();
            setManagedImages([]);
            form.setValue('primaryImageIndex', 0);
            setIsDialogOpen(false);
            setEditingBuild(null);
            buildFormSchema.isEditing = false; // Reset schema context
        } catch (error: any) {
            console.error("Error saving document to Firestore: ", error);
            const isSizeError = error.message?.includes("longer than 1048487 bytes") || error.code === 'invalid-argument' || error.message?.includes("Entity too large");
            toast({
                title: editingBuild ? "更新失敗" : "分享失敗",
                description: isSizeError
                    ? "儲存您的組裝時發生錯誤：圖片資料量過大，已超出 Firestore 文件限制 (1MB)。請嘗試減少圖片數量或使用較小解析度的圖片。"
                    : `儲存您的組裝時發生錯誤: ${error.message || '未知 Firestore 錯誤'}`,
                variant: "destructive",
                duration: 9000,
            });
        } finally {
            setIsSubmittingBuild(false);
        }
    }


    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) {
            // If in edit mode and files are cleared, keep existing managed images
            if (!editingBuild) {
                setManagedImages([]);
            }
            form.setValue("imageFiles", [], { shouldValidate: true });
            return;
        }

        if (files.length === 0 && !editingBuild) {
            form.setError("imageFiles", { type: "manual", message: `請至少上傳一張圖片。` });
            setManagedImages([]);
            form.setValue("imageFiles", [], { shouldValidate: true });
            event.target.value = '';
            return;
        }

        const currentImageCount = managedImages.filter(img => !img.file).length; // Count existing images not being replaced
        if (currentImageCount + files.length > MAX_FILES_COUNT) {
            form.setError("imageFiles", { type: "manual", message: `圖片總數不能超過 ${MAX_FILES_COUNT} 張。您已選擇 ${files.length} 張，目前有 ${currentImageCount} 張舊圖。` });
            event.target.value = ''; // Clear the file input
            return;
        }


        let allFilesValid = true;
        const newManagedImagesFromFileInput: ManagedImage[] = [];
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
            newManagedImagesFromFileInput.push({ id: uuidv4(), file, previewUrl: URL.createObjectURL(file) });
            fileObjectsForForm.push(file);
        }

        if (!allFilesValid) {
            // Don't clear managedImages if invalid files are selected during an edit,
            // just clear the file input and don't add the invalid files.
            event.target.value = '';
            return;
        }

        form.clearErrors("imageFiles");
        // When new files are selected, they replace all previous managed images or add to existing ones.
        // If editing, we want to merge or replace. For simplicity now, let's assume new file selection replaces.
        // A more robust solution would allow adding to existing or replacing specific ones.
        // For now, if new files are chosen, they become the new set of managedImages.
        // If editing and want to keep old + add new, this logic needs refinement.
        // The current `managedImages` state is crucial.

        // Let's try to append new files to existing ones if editing, respecting MAX_FILES_COUNT
        if (editingBuild) {
            const combinedImages = [...managedImages.filter(img => !img.file), ...newManagedImagesFromFileInput];
            if (combinedImages.length > MAX_FILES_COUNT) {
                form.setError("imageFiles", { type: "manual", message: `圖片總數不能超過 ${MAX_FILES_COUNT} 張。` });
                event.target.value = '';
                return;
            }
            setManagedImages(combinedImages);
        } else {
            setManagedImages(newManagedImagesFromFileInput);
        }

        form.setValue("imageFiles", fileObjectsForForm, { shouldValidate: true }); // This should be the new File[] objects
        // Only reset primaryImageIndex if it's not an edit or if it becomes invalid
        if (!editingBuild || form.getValues('primaryImageIndex') >= (editingBuild ? managedImages.length : newManagedImagesFromFileInput.length)) {
            form.setValue('primaryImageIndex', 0);
        }
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
        // Update imageFiles in form state if needed, though direct manipulation of managedImages is main driver
        const newFileArray = newImages.map(img => img.file).filter(file => file !== null) as File[];
        form.setValue('imageFiles', newFileArray, { shouldValidate: true });
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
                        buildFormSchema.isEditing = false; // Reset schema context
                    } else {
                        buildFormSchema.isEditing = !!editingBuild; // Set schema context
                        if (currentUserDisplayName && !editingBuild) {
                            form.setValue('studentName', currentUserDisplayName);
                        }
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
                            <DialogTitle className="text-2xl">{editingBuild ? "編輯您的電腦組裝" : "分享您的電腦組裝"}</DialogTitle>
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
                                    name="imageFiles" // This name corresponds to the File[] input
                                    render={({ field: { ref, name, onBlur } }) => (
                                        <FormItem>
                                            <FormLabel>上傳圖片 (最多 {MAX_FILES_COUNT} 張) {editingBuild ? "(可選，以替換或新增)" : "*"} </FormLabel>
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
                                                選擇您的組裝圖片 (每張最大 { }MB)。{editingBuild ? "新增或替換圖片。" : "至少上傳一張。"}
                                                <br />注意：圖片將以 Base64 格MAX_FILE_SIZE_MB式儲存於資料庫，過大的圖片可能導致儲存失敗。
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
                                            buildFormSchema.isEditing = false;
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
