/**
 * Documentary photography of Philippine farmers and local businesses.
 * All images are free under the Unsplash License (https://unsplash.com/license) and hotlinked from
 * Unsplash's CDN, as their guidelines ask. Credit is shown wherever a photo appears.
 */
export interface Photo {
  id: string;
  src?: string;
  alt: string;
  credit: string;
  place: string;
  href: string;
  /** CSS object-position, tuned so the subject survives tight crops. */
  focus?: string;
}

export const PHOTOS = {
  carabao: {
    id: 'pids-market',
    src: 'https://serp-p.pids.gov.ph/media/featured-image/1685338051_647437c361ed2.jpeg',
    alt: 'A vendor arranging prepared food and drinks at a market stall, viewed from above',
    credit: 'PIDS',
    place: 'Philippines',
    href: 'https://serp-p.pids.gov.ph/media/featured-image/1685338051_647437c361ed2.jpeg',
    focus: '45% 85%'
  },
  planting: {
    id: 'philippine-hub-market',
    src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYC9Bi5MzJu0UrFi54H_yQcjaq76jX5T1cR579zWcmHpg6n9KXLf8oeOyD&s=10',
    alt: 'A customer and vendor browsing products at a Philippine Hub market stall',
    credit: 'Philippine Hub',
    place: 'Philippines',
    href: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYC9Bi5MzJu0UrFi54H_yQcjaq76jX5T1cR579zWcmHpg6n9KXLf8oeOyD&s=10'
  },
  fruitStand: {
    id: '1607100450047-de71c8f4814b',
    alt: 'A vendor stands at a roadside fruit and agricultural produce stall',
    credit: 'Lance Lozano',
    place: 'Polomolok, South Cotabato',
    href: 'https://unsplash.com/photos/BYnSclKsreA',
    focus: '55% 50%'
  },
  market: {
    id: '1768199439172-08b8c55e683b',
    alt: 'Vendors selling produce under umbrellas at a busy local commercial market',
    credit: 'JC Gellidon',
    place: 'Koronadal City, South Cotabato',
    href: 'https://unsplash.com/photos/v50DftXmY7A',
    focus: '50% 55%'
  },
  foodStall: {
    id: '1771868456622-496aeeb48b2c',
    alt: 'A local food stall vendor serving freshly prepared food in South Cotabato',
    credit: 'Angelyn Sanjorjo',
    place: 'Lake Sebu, South Cotabato',
    href: 'https://unsplash.com/photos/c-U3QSWIhwI',
    focus: '50% 60%'
  }
} satisfies Record<string, Photo>;

export const photoSrc = (p: Photo, width: number) =>
  p.src ?? `https://images.unsplash.com/photo-${p.id}?auto=format&fit=crop&q=70&w=${width}`;

export const photoSrcSet = (p: Photo, widths = [640, 960, 1400, 2000]) =>
  widths.map((w) => `${photoSrc(p, w)} ${w}w`).join(', ');
