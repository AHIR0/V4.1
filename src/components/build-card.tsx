
'use client';

import Image from "next/image";
import { Cpu, Disc3, MemoryStick, HardDrive, CalendarDays, Power, Computer, Fan, Info, CheckCircle, ChevronLeft, ChevronRight, Wind, Star, Trash2, Pencil, AlertTriangle, Loader2 as LucideLoader } from "lucide-react";
import type { PcBuild } from "@/lib/mock-data";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"; // Corrected import
import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";
import { db, storage } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage'; // Removed listAll as it's not used for simple deletion by URL
import { useToast } from "@/hooks/use-toast";


interface BuildCardProps {
  build: PcBuild;
  currentUserEmail: string | null;
  onBuildDeleted: (buildId: string) => void;
  onBuildEdited: (build: PcBuild) => void;
}

const componentIcons: { [key: string]: React.ElementType } = {
  CPU: Cpu,
  Motherboard: HardDrive,
  Cooler: Fan,
  RAM: MemoryStick,
  Storage: Disc3,
  GPU: Computer,
  PSU: Power,
  Case: Computer,
  "Case Fans": Wind,
};

export function BuildCard({ build, currentUserEmail, onBuildDeleted, onBuildEdited }: BuildCardProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogSelectedImageIndex, setDialogSelectedImageIndex] = useState(build.primaryImageIndex || 0);

  useEffect(() => {
    setDialogSelectedImageIndex(build.primaryImageIndex || 0);
  }, [build.primaryImageIndex, build.id]);


  const getPrimaryImageUrl = () => {
    if (build.imageUrls && build.imageUrls.length > 0) {
      const index = build.primaryImageIndex !== undefined && build.primaryImageIndex < build.imageUrls.length
                      ? build.primaryImageIndex
                      : 0;
      return build.imageUrls[index];
    }
    return "https://placehold.co/600x400.png";
  };

  const primaryImageUrl = getPrimaryImageUrl();
  const primaryImageHint = build.primaryImageHint || (build.imageUrls && build.imageUrls.length > 0 ? "custom computer" : "placeholder image");

  const handleThumbnailClickInDialog = (index: number) => {
    setDialogSelectedImageIndex(index);
  };

  const currentLargeImageUrlInDialog = build.imageUrls && build.imageUrls.length > dialogSelectedImageIndex
                                       ? build.imageUrls[dialogSelectedImageIndex]
                                       : "https://placehold.co/600x400.png";

  const nextImageInDialog = () => {
    if (build.imageUrls && build.imageUrls.length > 0) {
      setDialogSelectedImageIndex((prevIndex) => (prevIndex + 1) % build.imageUrls.length);
    }
  };

  const prevImageInDialog = () => {
     if (build.imageUrls && build.imageUrls.length > 0) {
      setDialogSelectedImageIndex((prevIndex) => (prevIndex - 1 + build.imageUrls.length) % build.imageUrls.length);
    }
  };

  const handleDeleteBuild = async () => {
    if (!build.id) {
      toast({ title: "錯誤", description: "組裝 ID 遺失，無法刪除。", variant: "destructive" });
      return;
    }
    setIsDeleting(true);
    try {
      if (build.imageUrls && build.imageUrls.length > 0) {
        const deletePromises = build.imageUrls.map(async (imageUrl) => {
          if (imageUrl.startsWith("https://firebasestorage.googleapis.com/")) {
            try {
              const imageToDeleteRef = storageRef(storage, imageUrl);
              await deleteObject(imageToDeleteRef);
              console.log(`Deleted image from Storage: ${imageUrl}`);
            } catch (imgError: any) {
              if (imgError.code === 'storage/object-not-found') {
                console.warn(`Image not found in Storage (already deleted?): ${imageUrl}`);
              } else if (imgError.code === 'storage/invalid-argument') {
                console.warn(`Invalid argument for image deletion: ${imageUrl}`, imgError);
                 try {
                    const pathSegments = new URL(imageUrl).pathname.split('/o/');
                    if (pathSegments.length > 1) {
                        const decodedPath = decodeURIComponent(pathSegments[1].split('?')[0]);
                        // Check if it's in the expected user_build_images path
                        if (decodedPath.startsWith(`user_build_images/`)) { // Simplified check
                           const directPathRef = storageRef(storage, decodedPath);
                           await deleteObject(directPathRef);
                           console.log(`Deleted image from Storage via constructed path: ${decodedPath}`);
                        } else {
                           console.warn(`Could not reliably construct path for deletion: ${imageUrl}`);
                        }
                    }
                } catch (pathConstructError) {
                    console.error(`Error constructing path or deleting for ${imageUrl}:`, pathConstructError);
                }
              } else {
                console.error(`Failed to delete image ${imageUrl} from Storage:`, imgError);
                toast({
                  title: "圖片刪除部分失敗",
                  description: `無法刪除圖片 ${imageUrl}。您可能需要手動從 Firebase Storage 中移除。`,
                  variant: "destructive",
                  duration: 7000,
                });
              }
            }
          }
        });
        await Promise.all(deletePromises);
      }

      await deleteDoc(doc(db, "builds", build.id));
      toast({ title: "成功", description: `組裝 "${build.buildName}" 已刪除。` });
      onBuildDeleted(build.id);
    } catch (error: any) {
      console.error("Error deleting build:", error);
      toast({ title: "刪除失敗", description: `刪除組裝時發生錯誤: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditBuild = () => {
    onBuildEdited(build);
  };

  const isOwner = currentUserEmail && currentUserEmail === build.uploaderEmail;

  return (
    <Dialog onOpenChange={(isOpen) => {
        if (!isOpen) {
          setDialogSelectedImageIndex(build.primaryImageIndex || 0);
        }
    }}>
      <Card className="flex flex-col h-full overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card text-card-foreground">
          <DialogTrigger asChild>
            <div className="relative aspect-video w-full cursor-pointer group">
              <Image
                src={primaryImageUrl}
                alt={build.buildName}
                fill
                className="object-cover group-hover:opacity-90 transition-opacity"
                data-ai-hint={primaryImageHint}
                priority={build.id === "build-1"}
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Info className="h-8 w-8 text-white" />
              </div>
            </div>
          </DialogTrigger>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl h-14 overflow-hidden text-ellipsis">{build.buildName}</CardTitle>
          <CardDescription>由 {build.studentName}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow pb-4">
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3 h-[4.5rem] overflow-hidden">
            {build.description || "沒有提供描述。"}
          </p>
          <Separator className="my-3" />
          <h4 className="font-semibold mb-2 text-sm text-card-foreground">主要零組件:</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {build.components.slice(0, 7).map((component, index) => {
              const Icon = componentIcons[component.type] || Info;
              return (
                <li key={index} className="flex items-center truncate">
                  <Icon className="mr-2 h-4 w-4 text-accent flex-shrink-0" />
                  <span className="font-medium text-card-foreground">{component.type}:</span>
                  <span className="ml-1 truncate" title={component.name}>{component.name}</span>
                </li>
              );
            })}
            {build.components.length > 7 && (
              <li className="text-accent text-xs mt-1">...等 {build.components.length - 7} 個零組件</li>
            )}
          </ul>
        </CardContent>
        <CardFooter className="flex justify-between items-center text-xs text-muted-foreground p-4 border-t mt-auto">
          <div className="flex items-center">
            <CalendarDays className="mr-1 h-3 w-3" />
            <span>{build.createdAt || "日期未知"}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {isOwner && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={handleEditBuild} title="編輯組裝">
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="刪除組裝" disabled={isDeleting}>
                       {isDeleting ? <LucideLoader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>確定要刪除嗎？</AlertDialogTitle>
                      <AlertDialogDescription>
                        您確定要刪除組裝「{build.buildName}」嗎？此操作無法復原，相關圖片也會從儲存空間移除。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteBuild}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "刪除中..." : "確認刪除"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            <DialogTrigger asChild>
              <Badge variant="secondary" className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors px-2 py-1 sm:px-2.5 sm:py-0.5">
                查看詳情
              </Badge>
            </DialogTrigger>
          </div>
        </CardFooter>
      </Card>

      {/* This Dialog is the "View Details" dialog, triggered by the Badge above OR the Card image. */}
      <DialogContent
        className={cn(
          "w-11/12 sm:max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl",
          "max-h-[90vh] p-0 flex flex-col bg-card text-card-foreground"
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b shrink-0">
          <DialogTitle className="text-xl sm:text-2xl font-bold text-primary">{build.buildName}</DialogTitle>
          <DialogDescription>由 {build.studentName} 分享於 {build.createdAt || "日期未知"}</DialogDescription>
        </DialogHeader>

        <div className="flex-grow p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto min-h-0">
          {build.imageUrls && build.imageUrls.length > 0 && (
            <div className="relative aspect-video w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto rounded-lg overflow-hidden border shadow-md">
              <Image
                src={currentLargeImageUrlInDialog}
                alt={`${build.buildName} - Image ${dialogSelectedImageIndex + 1}`}
                fill
                className="object-contain"
                data-ai-hint={build.primaryImageHint || "custom computer build"}
              />
              {build.imageUrls.length > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80 h-8 w-8 sm:h-10 sm:w-10"
                    onClick={prevImageInDialog}
                  >
                    <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80 h-8 w-8 sm:h-10 sm:w-10"
                    onClick={nextImageInDialog}
                  >
                    <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                </>
              )}
            </div>
          )}

          {build.imageUrls && build.imageUrls.length > 1 && (
            <ScrollArea className="mt-2">
              <div className="flex justify-center space-x-2 p-2">
                {build.imageUrls.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => handleThumbnailClickInDialog(index)}
                    className={cn(
                      "relative h-14 w-14 sm:h-16 sm:w-16 rounded border-2 overflow-hidden transition-all flex-shrink-0",
                      index === dialogSelectedImageIndex ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent hover:border-muted-foreground"
                    )}
                  >
                    <Image
                      src={url}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      className="object-cover"
                      data-ai-hint="build thumbnail"
                    />
                    {index === dialogSelectedImageIndex && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white/80"/>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}

          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2 text-primary">組裝描述</h3>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
              {build.description || "沒有提供描述。"}
            </p>
          </div>

          <Separator />

          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 text-primary">零組件清單</h3>
            {/* Removed max-h from ScrollArea, relying on parent for scrolling */}
            <ScrollArea className="pr-2 sm:pr-4">
              <ul className="space-y-1.5 sm:space-y-2">
                {build.components.map((component, index) => {
                  const Icon = componentIcons[component.type] || Info;
                  return (
                    <li key={index} className="flex items-start p-1.5 sm:p-2 border rounded-md bg-muted/50 hover:bg-muted/80 transition-colors">
                      <Icon className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0 mt-0.5" />
                      <div className="min-w-0"> {/* Added min-w-0 for flex child to allow wrapping */}
                        <span className="font-semibold text-xs sm:text-sm text-card-foreground">{component.type}: </span>
                        <span className="text-xs sm:text-sm text-muted-foreground break-all">{component.name}</span> {/* Added break-all for long names */}
                      </div>
                    </li>
                  );
                })}
                {build.components.length === 0 && (
                  <p className="text-xs sm:text-sm text-muted-foreground">此組裝未列出任何零組件。</p>
                )}
              </ul>
              <ScrollBar orientation="vertical" /> {/* Added vertical scrollbar */}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-6 pt-3 sm:pt-4 border-t shrink-0">
          <DialogClose asChild>
            <Button variant="outline">關閉</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

