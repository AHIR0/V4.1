
'use client';

import { useState } from 'react';
import { mockNearbyStores, type StoreInfo } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Phone, Clock, Search, Store } from 'lucide-react';

export default function NearbyStoresPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // 模擬搜尋功能 - 目前無實際作用
  const handleSearch = () => {
    console.log('Searching for (simulated):', searchTerm);
  };

  return (
    <div className="container mx-auto py-8">
      <header className="mb-8 text-center">
        <Store className="h-16 w-16 mx-auto mb-4 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          台南大學附近的電腦店家
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          探索台南大學周邊的電腦零組件與服務店家。
        </p>
      </header>
      

      <div className="mb-8 max-w-xl mx-auto flex gap-2">
        <Input
          type="text"
          placeholder="輸入店家名稱或關鍵字 (示意功能)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow"
        />
        <Button onClick={handleSearch} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Search className="mr-2 h-4 w-4" />
          搜尋
        </Button>
      </div>

      {/* 店家列表 */}
      <div className="max-w-2xl mx-auto"> {/* Added a max-width container */}
        <StoreList stores={mockNearbyStores} />
      </div>

    </div>
  );
}

const StoreList = ({ stores }: { stores: StoreInfo[] }) => {
  if (stores.length === 0) {
    return <p className="text-center text-muted-foreground">附近沒有找到店家資訊。</p>;
  }

  return (
    <div className="space-y-6"> {/* Changed from grid to space-y for single column list */}
      {stores.map((store) => (
        <Card key={store.id} className="flex flex-col shadow-md hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="text-xl text-primary">{store.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow space-y-2 text-sm">
            <div className="flex items-start">
              <MapPin className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">{store.address}</span>
            </div>
            <div className="flex items-center">
              <Phone className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">{store.phone}</span>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">{store.hours}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

