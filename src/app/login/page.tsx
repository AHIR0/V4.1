
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, UserPlus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Firebase imports
import { auth } from '@/lib/firebase'; // 確保您的 Firebase 初始化檔案路徑正確
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  type UserCredential,
  type AuthError
} from "firebase/auth";

export default function LoginPage() {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isLoginView) {
      try {
        const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Logged in successfully:", userCredential.user);
        toast({
          title: "登入成功！",
          description: `歡迎回來，${userCredential.user.email}！`,
        });
        if (typeof window !== 'undefined' && userCredential.user.email) {
          localStorage.setItem('userEmail', userCredential.user.email);
        }
        router.push('/'); 
        // router.refresh(); // Force a refresh to update layout components - Removed for simpler client update
      } catch (err: any) {
        const authError = err as AuthError;
        console.error("Error logging in:", authError.code, authError.message);
        let friendlyMessage = "登入時發生錯誤，請稍後再試。";
        if (authError.code === 'auth/invalid-credential' || 
            authError.code === 'auth/user-not-found' || 
            authError.code === 'auth/wrong-password' ||
            authError.code === 'auth/invalid-password' // Legacy for older SDKs, wrong-password is current
        ) {
          friendlyMessage = "電子郵件或密碼不正確，請確認後再試一次。";
        } else if (authError.code === 'auth/user-disabled') {
          friendlyMessage = "此帳戶已被禁用。";
        } else if (authError.code === 'auth/invalid-email') {
            friendlyMessage = "電子郵件格式不正確。";
        }
        setError(friendlyMessage);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('userEmail'); // Clear on error
        }
      }
    } else { // Create account view
      if (password !== confirmPassword) {
        setError("密碼不相符！");
        setLoading(false);
        return;
      }
      try {
        const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Account created successfully:", userCredential.user);
        toast({
          title: "帳戶建立成功！",
          description: "您現在可以使用新帳戶登入了。",
        });
        setIsLoginView(true); // Switch to login view
        setEmail(''); // Clear fields for potential login
        setPassword('');
        setConfirmPassword('');
      } catch (err: any) {
        const authError = err as AuthError;
        console.error("Error creating account:", authError.code, authError.message);
        let friendlyMessage = "建立帳戶時發生錯誤，請稍後再試。";
        if (authError.code === 'auth/email-already-in-use') {
          friendlyMessage = "此電子郵件已被註冊，請使用其他電子郵件或嘗試登入。";
        } else if (authError.code === 'auth/weak-password') {
          friendlyMessage = "密碼強度不足，請設定更安全的密碼（至少6個字元）。";
        } else if (authError.code === 'auth/invalid-email') {
          friendlyMessage = "電子郵件格式不正確。";
        }
        setError(friendlyMessage);
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,4rem)-8rem)] py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {isLoginView ? (
              <LogIn className="h-16 w-16 text-primary" />
            ) : (
              <UserPlus className="h-16 w-16 text-primary" />
            )}
          </div>
          <CardTitle className="text-3xl font-bold">
            {isLoginView ? "登入您的帳戶" : "建立新帳戶"}
          </CardTitle>
          <CardDescription>
            {isLoginView
              ? "歡迎回來！請輸入您的憑證以繼續。"
              : "只需幾步即可開始您的學習旅程。"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">電子郵件</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus:ring-accent focus:border-accent"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                placeholder="請輸入密碼"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="focus:ring-accent focus:border-accent"
                disabled={loading}
              />
            </div>
            {!isLoginView && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">確認密碼</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="請再次輸入密碼"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="focus:ring-accent focus:border-accent"
                  disabled={loading}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loading}>
              {loading ? "處理中..." : (isLoginView ? "登入" : "建立帳戶")}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => {
                setIsLoginView(!isLoginView);
                setError(null); 
                // setEmail(''); // Optionally clear fields on view toggle
                // setPassword('');
                // setConfirmPassword('');
              }}
              className="text-sm text-accent hover:text-accent/80"
              disabled={loading}
            >
              {isLoginView
                ? "還沒有帳戶？ 註冊一個"
                : "已經有帳戶了？ 前往登入"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

