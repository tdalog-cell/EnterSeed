import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { Photo, photoSrc, photoSrcSet } from '../photos';
import { cx } from './ui';

/** A cropped documentary photo with a quiet photographer credit. */
export const PhotoImg: React.FC<{
  photo: Photo;
  sizes: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  credit?: 'overlay' | 'none';
  /** Fill the nearest positioned ancestor instead of sizing itself. */
  fill?: boolean;
}> = ({ photo, sizes, className, imgClassName, eager, credit = 'overlay', fill }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [photo.id]);

  return (
  <figure className={cx(fill ? 'absolute inset-0' : 'relative', 'overflow-hidden bg-[#3a2a33]', className)}>
    {failed ? (
      <div role="img" aria-label={photo.alt} className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-deep to-night text-white/30">
        <ImageOff className="w-10 h-10" strokeWidth={1} aria-hidden="true" />
      </div>
    ) : <img
      key={photo.id}
      src={photoSrc(photo, 1400)}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      alt={photo.alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      style={{ objectPosition: photo.focus }}
      className={cx('absolute inset-0 w-full h-full object-cover transition-opacity duration-700 motion-reduce:transition-none', loaded ? 'opacity-100' : 'opacity-0', imgClassName)}
    />}
    {credit === 'overlay' && !failed && (
      <figcaption className="absolute right-2 bottom-2 rounded-md bg-night/55 px-1.5 py-0.5 text-[10px] leading-tight text-white/85">
        <a href={photo.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {photo.credit} · {photo.place}
        </a>
      </figcaption>
    )}
  </figure>
  );
};
