import React from 'react';
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
}> = ({ photo, sizes, className, imgClassName, eager, credit = 'overlay', fill }) => (
  <figure className={cx(fill ? 'absolute inset-0' : 'relative', 'overflow-hidden bg-[#3a2a33]', className)}>
    <img
      src={photoSrc(photo, 1400)}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      alt={photo.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      style={{ objectPosition: photo.focus }}
      className={cx('absolute inset-0 w-full h-full object-cover', imgClassName)}
    />
    {credit === 'overlay' && (
      <figcaption className="absolute right-2 bottom-2 rounded-md bg-night/55 px-1.5 py-0.5 text-[10px] leading-tight text-white/85">
        <a href={photo.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {photo.credit} · {photo.place}
        </a>
      </figcaption>
    )}
  </figure>
);
