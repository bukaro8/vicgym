import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EquipmentImage = { storagePath: string; altText: string };

export function ResponsiveEquipmentImage({ image, className, sizes = "(max-width: 640px) 100vw, 50vw", priority = false, placeholderTitle = "Exercise image not yet available", placeholderDescription = "A movement-specific image has not been added yet." }: Readonly<{ image?: EquipmentImage | null; className?: string; sizes?: string; priority?: boolean; placeholderTitle?: string; placeholderDescription?: string }>) {
  if (!image) {
    return (
      <div className={cn("grid aspect-[4/3] place-items-center bg-accent p-5 text-center text-primary", className)}>
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-primary/15 bg-card/75"><ImageIcon className="size-6" aria-hidden="true" /></span>
          <p className="mt-3 text-sm font-semibold">{placeholderTitle}</p>
          <p className="mx-auto mt-1 max-w-52 text-xs leading-5 text-accent-foreground/80">{placeholderDescription}</p>
        </div>
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
