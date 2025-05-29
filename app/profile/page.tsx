
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCircle2, Edit3, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  auth,
  firebaseUpdateProfile, // Corrected: Import by its exported name
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type AuthError
} from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const displayNameSchema = z.object({
  displayName: z.string().min(1, "顯示名稱不能為空。").max(50, "顯示名稱不能超過50個字元。"),
});
type DisplayNameFormValues = z.infer<typeof displayNameSchema>;

const passwordSchema = z.object({
  newPassword: z.string().min(6, "新密碼至少需要6個字元。"),
  confirmNewPassword: z.string().min(6, "確認密碼至少需要6個字元。"),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "新密碼與確認密碼不相符。",
  path: ["confirmNewPassword"],
});
type PasswordFormValues = z.infer<typeof passwordSchema>;


export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingDisplayName, setIsUpdatingDisplayName] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [showReauthDialog, setShowReauthDialog] = useState(false);
  const [pendingPasswordChange, setPendingPasswordChange] = useState<PasswordFormValues | null>(null);
  const [currentPhotoURL, setCurrentPhotoURL] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const displayNameForm = useForm<DisplayNameFormValues>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { displayName: "" },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", confirmNewPassword: "" },
  });


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        displayNameForm.reset({ displayName: user.displayName || "" });
        setCurrentPhotoURL(user.photoURL || null);
      } else {
        router.push('/login');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [router, displayNameForm]);

  const handleDisplayNameSubmit: SubmitHandler<DisplayNameFormValues> = async (data) => {
    if (!currentUser) return;
    setIsUpdatingDisplayName(true);
    try {
      await firebaseUpdateProfile(currentUser, { displayName: data.displayName });
      setCurrentUser(prev => prev ? { ...prev, displayName: data.displayName } as User : null);
      if (typeof window !== 'undefined') {
        localStorage.setItem('userDisplayName', data.displayName || '');
      }
      toast({ title: "成功", description: "顯示名稱已更新。" });
    } catch (error) {
      console.error("Error updating display name:", error);
      toast({ title: "錯誤", description: "更新顯示名稱失敗。", variant: "destructive" });
    } finally {
      setIsUpdatingDisplayName(false);
    }
  };

  const handleChangePasswordSubmit: SubmitHandler<PasswordFormValues> = async (data) => {
    if (!currentUser) return;
    setIsUpdatingPassword(true);
    try {
      await updatePassword(currentUser, data.newPassword);
      toast({ title: "成功", description: "密碼已更新。" });
      passwordForm.reset();
    } catch (error: any) {
      const authError = error as AuthError;
      console.error("Error updating password:", authError);
      if (authError.code === 'auth/requires-recent-login') {
        setPendingPasswordChange(data);
        setShowReauthDialog(true);
        toast({ title: "需要重新驗證", description: "更改密碼需要您最近曾登入。請重新輸入您的密碼。", variant: "destructive", duration: 7000 });
      } else {
        toast({ title: "錯誤", description: `更新密碼失敗: ${authError.message}`, variant: "destructive" });
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleReauthenticate = async () => {
    if (!currentUser || !currentUser.email || !pendingPasswordChange || !reauthPassword) return;

    setShowReauthDialog(false);
    setIsUpdatingPassword(true);

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, reauthPassword);
      console.log("Attempting reauthentication...");
      await reauthenticateWithCredential(currentUser, credential);
      console.log("Reauthentication successful.");
      toast({ title: "重新驗證成功", description: "現在您可以再次嘗試更改密碼。" });

      console.log("Attempting to update password again with:", pendingPasswordChange);
      await updatePassword(currentUser, pendingPasswordChange.newPassword);
      toast({ title: "成功", description: "密碼已成功更新。" });
      passwordForm.reset();
      setPendingPasswordChange(null);

    } catch (error: any) {
      const authError = error as AuthError;
      console.error("Reauthentication or subsequent password update failed:", authError);
      toast({ title: "操作失敗", description: `發生錯誤: ${authError.message}`, variant: "destructive" });
      setPendingPasswordChange(null);
    } finally {
      setReauthPassword('');
      setIsUpdatingPassword(false);
    }
  };


  if (isLoading) {
    return <div className="container mx-auto py-8 text-center"><Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" /></div>;
  }

  if (!currentUser) {
    return <div className="container mx-auto py-8 text-center"><p>請先登入以查看個人資料。</p></div>;
  }

  return (
    <div className="container mx-auto py-8">
      <header className="mb-12 text-center">
        <Avatar className="h-24 w-24 mx-auto mb-4 border-2 border-primary shadow-lg">
          <AvatarImage src={currentPhotoURL || undefined} alt={currentUser.displayName || currentUser.email || "User"} data-ai-hint="user avatar" />
          <AvatarFallback><UserCircle2 className="h-12 w-12 text-muted-foreground" /></AvatarFallback>
        </Avatar>
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          {currentUser.displayName || currentUser.email || "個人資料"}
        </h1>
        {currentUser.displayName && currentUser.email && currentUser.displayName !== currentUser.email && (
           <p className="mt-1 text-sm text-muted-foreground">{currentUser.email}</p>
        )}
      </header>

      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Edit3 className="mr-2 h-5 w-5 text-primary" /> 更改顯示名稱</CardTitle>
            <CardDescription>更新您在應用程式中顯示的名稱。</CardDescription>
          </CardHeader>
          <Form {...displayNameForm}>
            <form onSubmit={displayNameForm.handleSubmit(handleDisplayNameSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={displayNameForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="displayName">新顯示名稱</FormLabel>
                      <FormControl>
                        <Input id="displayName" placeholder="您的新顯示名稱" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isUpdatingDisplayName} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  {isUpdatingDisplayName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存名稱
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><KeyRound className="mr-2 h-5 w-5 text-primary" /> 更改密碼</CardTitle>
            <CardDescription>設定您的新登入密碼。</CardDescription>
          </CardHeader>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handleChangePasswordSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="newPassword">新密碼</FormLabel>
                      <FormControl>
                        <Input id="newPassword" type="password" placeholder="至少6個字元" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="confirmNewPassword">確認新密碼</FormLabel>
                      <FormControl>
                        <Input id="confirmNewPassword" type="password" placeholder="再次輸入新密碼" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isUpdatingPassword} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                 {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存密碼
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>

      <AlertDialog open={showReauthDialog} onOpenChange={setShowReauthDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><ShieldAlert className="mr-2 h-5 w-5 text-destructive" />需要重新驗證</AlertDialogTitle>
            <AlertDialogDescription>
              為了安全起見，更改密碼需要您重新輸入目前的登入密碼。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reauthPassword">目前密碼</Label>
            <Input
              id="reauthPassword"
              type="password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              placeholder="請輸入您目前的密碼"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingPasswordChange(null); setReauthPassword(''); setIsUpdatingPassword(false); }} disabled={isUpdatingPassword}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleReauthenticate} disabled={isUpdatingPassword || !reauthPassword}>
              {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}確認並重試
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

