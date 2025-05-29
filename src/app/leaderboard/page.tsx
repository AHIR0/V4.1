
'use client';

import { useEffect, useState } from 'react';
import { db, collection, query, orderBy, onSnapshot, type Timestamp } from '@/lib/firebase';
import type { LeaderboardEntry } from '@/lib/mock-data';
import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Star, Loader2, UserCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function getRankIcon(rank: number): React.ReactNode {
  if (rank === 1) {
    return <Trophy className="h-5 w-5 text-yellow-500" />;
  }
  if (rank === 2) {
    return <Medal className="h-5 w-5 text-slate-400" />;
  }
  if (rank === 3) {
    return <Star className="h-5 w-5 text-yellow-700" />;
  }
  return <span className="text-sm">{rank}</span>;
}

export default function LeaderboardPage() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    // Ensure V9 modular syntax: collection(db, 'collectionName')
    const leaderboardCollectionRef = collection(db, 'leaderboardData');
    const q = query(leaderboardCollectionRef, orderBy('score', 'desc'), orderBy('lastUpdatedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data = querySnapshot.docs.map((doc, index) => {
        const docData = doc.data();
        return {
          id: doc.id,
          displayName: docData.displayName || '匿名使用者',
          score: docData.score || 0,
          avatarUrl: docData.avatarUrl || undefined,
          avatarHint: docData.avatarHint || 'student avatar',
          lastUpdatedAt: docData.lastUpdatedAt, // Keep as Timestamp
          rank: index + 1, // Assign rank based on sorted order
        } as LeaderboardEntry;
      });
      setLeaderboardData(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching leaderboard data: ", error);
      toast({
        title: "載入排行榜失敗",
        description: "無法從資料庫獲取排行榜數據。",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, [toast]);

  return (
    <div className="container mx-auto py-8">
      <header className="mb-12 text-center">
        <Trophy className="h-16 w-16 mx-auto mb-4 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          排行榜
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          看看誰是 PC 組裝知識王！
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">載入排行榜中...</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border shadow-md bg-card">
          <Table>
            <TableCaption className="py-4">排行榜將根據最新測驗分數即時更新</TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[80px] text-center text-base font-semibold text-card-foreground">排名</TableHead>
                <TableHead className="text-base font-semibold text-card-foreground">學生姓名</TableHead>
                <TableHead className="text-right text-base font-semibold text-card-foreground">分數 (最新測驗)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboardData.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/50">
                  <TableCell className="text-center font-medium text-lg text-muted-foreground">
                    <div className="flex items-center justify-center">
                      {getRankIcon(entry.rank || 0)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={entry.avatarUrl || undefined} alt={entry.displayName} data-ai-hint={entry.avatarHint || "student avatar"}/>
                        <AvatarFallback>
                            <UserCircle2 className="h-full w-full text-muted-foreground/70" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-card-foreground">{entry.displayName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-lg text-primary">{entry.score.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
       {!isLoading && leaderboardData.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          目前排行榜上沒有資料。完成一個測驗來上榜吧！
        </p>
      )}
    </div>
  );
}
