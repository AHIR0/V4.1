// components/FirebaseImage.tsx
import { useEffect, useState } from "react";
import Image from "next/image";
import { getImageUrl } from "@/lib/getImageUrl";

interface Props {
    imageId: string;
    alt: string;
}

export default function FirebaseImage({ imageId, alt }: Props) {
    const [imgUrl, setImgUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchUrl() {
            const data = await getImageUrl(imageId);
            if (data?.url) {
                setImgUrl(data.url);
            }
            setLoading(false);
        }
        fetchUrl();
    }, [imageId]);

    if (loading) return <div className="h-full bg-muted animate-pulse rounded-lg" />;
    if (!imgUrl) return <p className="text-center text-red-500">找不到圖片</p>;

    return (
        <Image
            src={imgUrl}
            alt={alt}
            fill
            className="object-contain"
        />
    );
}
