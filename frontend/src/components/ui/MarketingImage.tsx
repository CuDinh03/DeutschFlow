export type MarketingImageProps = {
  src: string
  alt: string
  className?: string
  priority?: boolean
}

export function MarketingImage({ src, alt, className, priority }: MarketingImageProps) {
  return <img src={src} alt={alt} className={className} loading={priority ? 'eager' : 'lazy'} />
}

export default MarketingImage
