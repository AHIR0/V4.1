
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ElementType } from 'react';
import { BookOpen, UsersRound, Cpu, PanelLeft, User, LogOut, Bot, Store, Trophy, Settings, MapPin, MessageSquare, UserCircle2, ListX, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signOut, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from "@/hooks/use-toast";

interface NavItem {
    href: string;
    label: string;
    icon: ElementType;
}

const navItems: NavItem[] = [
    { href: '/', label: '學習路徑', icon: BookOpen },
    { href: '/community', label: '社群組裝', icon: UsersRound },
    { href: '/community-discussion', label: '社群討論', icon: MessageSquare },
    { href: '/ai-assistant', label: 'AI 助理', icon: Bot },
    { href: '/nearby-stores', label: '附近的店家', icon: MapPin },
    { href: '/leaderboard', label: '排行榜', icon: Trophy },
    { href: '/incorrect-answers', label: '錯題本', icon: ListX },
];

const NavLinksContent = () => {
    const pathname = usePathname();
    return (
        <ul className="space-y-1">
            {navItems.map((item) => {
                let isActive = false;
                if (item.href === "/community") {
                    isActive = (pathname === "/community" || pathname.startsWith("/community/"));
                } else {
                    isActive = (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
                }
                return (
                    <li key={item.href}>
                        <Link href={item.href} passHref legacyBehavior>
                            <Button
                                className={cn(
                                    "w-full justify-start text-base font-normal h-10 px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "bg-transparent"
                                )}
                                asChild
                            >
                                <a>
                                    <item.icon className="mr-3 h-5 w-5" />
                                    {item.label}
                                </a>
                            </Button>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
};

const MobileNavLinksContent = () => {
    const pathname = usePathname();
    return (
        <ul className="space-y-1">
            {navItems.map((item) => {
                let isActive = false;
                if (item.href === "/community") {
                    isActive = (pathname === "/community" || pathname.startsWith("/community/"));
                } else {
                    isActive = (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
                }
                return (
                    <li key={item.href}>
                        <SheetClose asChild>
                            <Link href={item.href} passHref legacyBehavior>
                                <Button
                                    className={cn(
                                        "w-full justify-start text-base font-normal h-10 px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "bg-transparent"
                                    )}
                                    asChild
                                >
                                    <a>
                                        <item.icon className="mr-3 h-5 w-5" />
                                        {item.label}
                                    </a>
                                </Button>
                            </Link>
                        </SheetClose>
                    </li>
                );
            })}
        </ul>
    );
};


const SidebarHeaderContent = () => (
    <div className="flex h-16 items-center border-b border-sidebar-border px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-sidebar-primary-foreground">
            <Cpu className="h-7 w-7" />
            <span className="text-xl">PC Builder</span>
        </Link>
    </div>
);

const SidebarFooterContent = () => {
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();
    const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
    const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAuthUser(user);
            if (user) {
                setUserDisplayName(user.displayName || user.email);
                setUserPhotoURL(user.photoURL);
                localStorage.setItem('userEmail', user.email || '');
                localStorage.setItem('userDisplayName', user.displayName || '');
                localStorage.setItem('userPhotoURL', user.photoURL || '');
            } else {
                setUserDisplayName(null);
                setUserPhotoURL(null);
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userDisplayName');
                localStorage.removeItem('userPhotoURL');
            }
        });

        const updateStateFromStorage = () => {
            const storedEmail = localStorage.getItem('userEmail');
            const storedDisplayName = localStorage.getItem('userDisplayName');
            const storedPhotoURL = localStorage.getItem('userPhotoURL');

            if (storedEmail) {
                if (!auth.currentUser) {
                    setAuthUser({ email: storedEmail, displayName: storedDisplayName, photoURL: storedPhotoURL } as FirebaseUser);
                }
                setUserDisplayName(storedDisplayName || storedEmail);
                setUserPhotoURL(storedPhotoURL);
            } else {
                setAuthUser(null);
                setUserDisplayName(null);
                setUserPhotoURL(null);
            }
        };

        window.addEventListener('storage', updateStateFromStorage);
        updateStateFromStorage();

        return () => {
            unsubscribe();
            window.removeEventListener('storage', updateStateFromStorage);
        };
    }, [isClient, pathname]);


    const handleLoginClick = () => {
        router.push('/login');
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            toast({
                title: "登出成功！",
                description: "您已成功登出。",
            });
            router.push('/login');
        } catch (error) {
            console.error("Error signing out: ", error);
            toast({
                title: "登出失敗",
                description: "登出時發生錯誤，請稍後再試。",
                variant: "destructive",
            });
        }
    };

    if (!isClient) {
        return (
            <div className="mt-auto border-t border-sidebar-border p-4">
                <div className="flex items-center space-x-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-auto border-t border-sidebar-border p-4">
            {authUser ? (
                <div className="flex flex-col space-y-2">
                    <Link href="/profile" passHref legacyBehavior>
                        <Button
                            asChild
                            variant="ghost"
                            className="w-full h-auto py-2 px-3 text-left justify-start text-base font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer"
                            title={authUser.email || "個人資料"}
                        >
                            <a className="flex items-center space-x-3">
                                <Avatar className="h-10 w-10 border border-sidebar-border">
                                    <AvatarImage src={userPhotoURL || undefined} alt={userDisplayName || authUser.email || "User"} data-ai-hint="user avatar" />
                                    <AvatarFallback>
                                        <UserCircle2 className="h-full w-full text-sidebar-foreground/70" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sidebar-foreground text-sm font-medium truncate block">
                                        {userDisplayName || authUser.email}
                                    </span>
                                    {userDisplayName && authUser.email && userDisplayName !== authUser.email && (
                                        <span className="text-xs text-sidebar-foreground/70 truncate block">
                                            {authUser.email}
                                        </span>
                                    )}
                                </div>
                            </a>
                        </Button>
                    </Link>
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-base font-normal h-10 px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        onClick={handleLogout}
                    >
                        <LogOut className="mr-3 h-5 w-5" />
                        登出
                    </Button>
                </div>
            ) : (
                <Button
                    variant="ghost"
                    className="w-full justify-start text-base font-normal h-10 px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={handleLoginClick}
                >
                    <User className="mr-3 h-5 w-5" />
                    使用者 / 登入
                </Button>
            )}
        </div>
    );
};

export function AppDesktopSidebar() {
    return (
        <aside className="fixed top-0 left-0 z-30 hidden h-screen w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
            <SidebarHeaderContent />
            <nav className="flex-1 overflow-y-auto p-4">
                <NavLinksContent />
            </nav>
            <SidebarFooterContent />
        </aside>
    );
}

export function AppMobileHeaderWithSheet() {
    return (
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
            <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
                <Cpu className="h-7 w-7" />
                <span className="text-xl">PC Builder</span>
            </Link>
            <Sheet>
                <SheetTrigger asChild>
                    <Button size="icon" variant="outline">
                        <PanelLeft className="h-5 w-5" />
                        <span className="sr-only">Toggle Menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64 bg-sidebar p-0 text-sidebar-foreground border-l border-sidebar-border flex flex-col">
                    <SheetHeader className="sr-only">
                        <SheetTitle>PC Builder</SheetTitle>
                        <SheetDescription>主要導覽選單</SheetDescription>
                    </SheetHeader>
                    <SidebarHeaderContent />
                    <nav className="flex-1 overflow-y-auto p-4">
                        <MobileNavLinksContent />
                    </nav>
                    <SidebarFooterContent />
                </SheetContent>
            </Sheet>
        </header>
    );
}

const Skeleton = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-sidebar-accent/20", className)}
            {...props}
        />
    )
}

