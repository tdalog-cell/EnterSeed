/**
 * Documentary photography of Philippine farmers and local businesses.
 * All images are free under the Unsplash License (https://unsplash.com/license) and hotlinked from
 * Unsplash's CDN, as their guidelines ask. Credit is shown wherever a photo appears.
 */
export interface Photo {
  id: string;
  alt: string;
  credit: string;
  place: string;
  href: string;
  /** CSS object-position, tuned so the subject survives tight crops. */
  focus?: string;
}

export const PHOTOS = {
  carabao: {
    id: '1630192226649-1934968dca48',
    alt: 'A farmer rides a carabao along a road between rice fields and coconut palms',
    credit: 'Rogel Tura',
    place: 'Koronadal, South Cotabato',
    href: 'https://unsplash.com/photos/uSZuoz9zo6E',
    focus: '45% 85%'
  },
  planting: {
    id: '1777045453456-fe90afaf5c29',
    alt: 'A farmer in a green cap planting seedlings in a flooded field',
    credit: 'Toffi Teraytay',
    place: 'Los Baños, Laguna',
    href: 'https://unsplash.com/photos/ttA5K151bwU',
    focus: '62% 18%'
  },
  fruitStand: {
    id: '1607100450047-de71c8f4814b',
    alt: 'A vendor stands at a roadside fruit and vegetable stall',
    credit: 'Lance Lozano',
    place: 'Silang, Cavite',
    href: 'https://unsplash.com/photos/BYnSclKsreA',
    focus: '55% 50%'
  },
  market: {
    id: '1768199439172-08b8c55e683b',
    alt: 'Vendors selling produce under umbrellas at a busy outdoor market',
    credit: 'JC Gellidon',
    place: 'Philippines',
    href: 'https://unsplash.com/photos/v50DftXmY7A',
    focus: '50% 55%'
  },
  foodStall: {
    id: '1771868456622-496aeeb48b2c',
    alt: 'A vendor serving grilled skewers at her food stall at night',
    credit: 'Angelyn Sanjorjo',
    place: 'Philippines',
    href: 'https://unsplash.com/photos/c-U3QSWIhwI',
    focus: '50% 60%'
  }
} satisfies Record<string, Photo>;

export const photoSrc = (p: Photo, width: number) =>
  `https://images.unsplash.com/photo-${p.id}?auto=format&fit=crop&q=70&w=${width}`;

export const photoSrcSet = (p: Photo, widths = [640, 960, 1400, 2000]) =>
  widths.map((w) => `${photoSrc(p, w)} ${w}w`).join(', ');
