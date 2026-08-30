import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EquipmentImage = { storagePath: string; altText: string };

export function ResponsiveEquipmentImage({ image, className, sizes = "(max-width: 640px) 100vw, 50vw", priority = false }: Readonly<{ image?: EquipmentImage | null; className?: string; sizes?: string; priority?: boolean }>) {
  if (!image) {
    return (
      <div className={cn("grid aspect-[4/3] place-items-center bg-accent text-primary", className)}>
        <ImageIcon className="size-10" aria-hidden="true" />
        <span className="sr-only">No equipment photo is needed for this exercise</span>
      </div>
    );
  }

  const stem = image.storagePath.replace(/-1280\.webp$/, "");

  return (
    <picture>
      <source type="image/avif" srcSet={`${stem}-640.avif 640w, ${stem}-1280.avif 1280w`} sizes={sizes} />
      <source type="image/webp" srcSet={`${stem}-640.webp 640w, ${stem}-1280.webp 1280w`} sizes={sizes} />
      <img src={`${stem}-1280.webp`} alt={image.altText} width={1280} height={960} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" className={cn("aspect-[4/3] h-full w-full object-cover", className)} />
    </picture>
  );
}
