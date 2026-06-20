import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@brika/clay";

type Props = Readonly<{ images: string[]; alt: string }>;

export function ScreenshotGallery({ images, alt }: Props) {
  if (images.length === 0) return null;
  return (
    <Carousel className="w-full">
      <CarouselContent>
        {images.map((src, index) => (
          <CarouselItem key={src}>
            <img
              src={src}
              alt={`${alt} screenshot ${index + 1}`}
              loading="lazy"
              className="aspect-video w-full rounded-lg border border-border object-contain"
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      {images.length > 1 ? (
        <>
          <CarouselPrevious />
          <CarouselNext />
        </>
      ) : null}
    </Carousel>
  );
}
