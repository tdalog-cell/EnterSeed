import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { escapeHtml } from './ui';

export interface SupplierLocation {
  id: number;
  name: string;
  category: string;
  location: string;
  products: string;
  latitude?: number;
  longitude?: number;
}

interface SupplierMapProps {
  suppliers: SupplierLocation[];
  selectedSupplier?: SupplierLocation | null;
  onSelectSupplier?: (s: SupplierLocation) => void;
}

// Approximate municipality centres in South Cotabato and SOCCSKSARGEN
const municipalityCoords: Record<string, [number, number]> = {
  koronadal: [6.5036, 124.8488],
  polomolok: [6.2186, 125.0683],
  tupi: [6.3314, 124.9519],
  surallah: [6.375, 124.7431],
  'lake sebu': [6.2239, 124.7072],
  norala: [6.5208, 124.6736],
  "t'boli": [6.2167, 124.8667],
  tboli: [6.2167, 124.8667],
  banga: [6.4258, 124.7778],
  tantangan: [6.5819, 124.8611],
  'sto. nino': [6.4528, 124.6972],
  'general santos': [6.1164, 125.1716],
  alabel: [6.1028, 125.2894]
};

/** Stable per-supplier offset so pins in the same town do not stack and do not jump between renders. */
function jitter(id: number, spread: number): [number, number] {
  const a = Math.sin(id * 12.9898) * 43758.5453;
  const b = Math.sin(id * 78.233) * 12345.6789;
  return [((a - Math.floor(a)) - 0.5) * spread, ((b - Math.floor(b)) - 0.5) * spread];
}

function coordsFor(s: SupplierLocation): [number, number] {
  if (s.latitude && s.longitude) return [s.latitude, s.longitude];
  const clean = s.location.toLowerCase();
  const hit = Object.entries(municipalityCoords).find(([key]) => clean.includes(key));
  const [base, spread] = hit ? [hit[1], 0.015] : [[6.38, 124.98] as [number, number], 0.04];
  const [dLat, dLng] = jitter(s.id, spread);
  return [base[0] + dLat, base[1] + dLng];
}

const pinIcon = L.divIcon({ className: 'supplier-pin', iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -10] });

export const SupplierMap: React.FC<SupplierMapProps> = ({ suppliers, selectedSupplier, onSelectSupplier }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelectSupplier);
  onSelectRef.current = onSelectSupplier;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([6.38, 124.98], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
    }).addTo(map);
    mapRef.current = map;
    // Leaflet measures once; re-measure when the container settles (enter animation, breakpoint changes).
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    suppliers.forEach((s) => {
      const marker = L.marker(coordsFor(s), { icon: pinIcon, title: s.name }).addTo(map);
      marker.bindPopup(
        `<div style="font-size:13px;line-height:1.45;color:#2B1C33;max-width:220px">
          <strong style="display:block;font-size:14px;color:#4A1D8F">${escapeHtml(s.name)}</strong>
          <span style="color:#6A5672">${escapeHtml(s.category.replace('-', ' '))} · ${escapeHtml(s.location)}</span>
          <p style="margin:6px 0 0">${escapeHtml(s.products)}</p>
        </div>`
      );
      marker.on('click', () => onSelectRef.current?.(s));
      markersRef.current.set(s.id, marker);
    });
  }, [suppliers]);

  useEffect(() => {
    if (!selectedSupplier || !mapRef.current) return;
    const marker = markersRef.current.get(selectedSupplier.id);
    if (marker) {
      mapRef.current.setView(marker.getLatLng(), 12, { animate: true });
      marker.openPopup();
    }
  }, [selectedSupplier]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Map of reviewed suppliers in South Cotabato"
      className="w-full h-[300px] sm:h-[380px] lg:h-[460px] rounded-xl overflow-hidden border border-line relative z-0"
    />
  );
};
