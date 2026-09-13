import {
  Cpu, Droplet, Filter, Disc3, Circle, Link2, Battery, Zap, Move, Wind,
  Thermometer, Wrench, PaintBucket, MoreHorizontal, Key, Hammer, Sparkles,
  AlertTriangle, MapPin, Trophy, Users, Award, Camera, SplitSquareHorizontal,
  Receipt, BookOpen, BadgeCheck, FileText, Armchair, Lightbulb, Gauge,
  ShieldCheck, Sliders, PoundSterling, Flame, Layers, Bike
} from 'lucide-react';

export const MAINTENANCE_ICONS = [
  { value: 'ENGINE',      label: 'Motore',     icon: Cpu },
  { value: 'OIL',         label: 'Olio',       icon: Droplet },
  { value: 'FILTER',      label: 'Filtro',     icon: Filter },
  { value: 'BRAKES',      label: 'Freni',      icon: Disc3 },
  { value: 'TYRES',       label: 'Gomme',      icon: Circle },
  { value: 'CHAIN',       label: 'Catena',     icon: Link2 },
  { value: 'BATTERY',     label: 'Batteria',   icon: Battery },
  { value: 'ELECTRICAL',  label: 'Elettrico',  icon: Zap },
  { value: 'SUSPENSION',  label: 'Sospens.',   icon: Move },
  { value: 'CARBURATION', label: 'Carburaz.',  icon: Sliders },
  { value: 'COOLING',     label: 'Raffredd.',  icon: Thermometer },
  { value: 'EXHAUST',     label: 'Scarico',    icon: Wind },
  { value: 'BODYWORK',    label: 'Carroz.',    icon: PaintBucket },
  { value: 'OTHER',       label: 'Altro',      icon: MoreHorizontal },
];

export const TIMELINE_ICONS = [
  { value: 'PURCHASE',     label: 'Acquisto',   icon: Key },
  { value: 'RESTORATION',  label: 'Restauro',   icon: Hammer },
  { value: 'MAINTENANCE',  label: 'Manutenz.',  icon: Wrench },
  { value: 'MODIFICATION', label: 'Modifica',   icon: Sparkles },
  { value: 'ACCIDENT',     label: 'Incidente',  icon: AlertTriangle },
  { value: 'TRIP',         label: 'Viaggio',    icon: MapPin },
  { value: 'RACE',         label: 'Gara',       icon: Trophy },
  { value: 'MEETUP',       label: 'Raduno',     icon: Users },
  { value: 'MILESTONE',    label: 'Traguardo',  icon: Award },
  { value: 'OTHER',        label: 'Altro',      icon: MoreHorizontal },
];

export const MODIFICATION_ICONS = [
  { value: 'ENGINE',     label: 'Motore',     icon: Cpu },
  { value: 'EXHAUST',    label: 'Scarico',    icon: Flame },
  { value: 'SUSPENSION', label: 'Sospens.',   icon: Move },
  { value: 'BRAKES',     label: 'Freni',      icon: Disc3 },
  { value: 'ELECTRICAL', label: 'Elettrico',  icon: Zap },
  { value: 'BODY',       label: 'Corpo',      icon: Bike },
  { value: 'LIGHTING',   label: 'Luci',       icon: Lightbulb },
  { value: 'WHEELS',     label: 'Ruote',      icon: Circle },
  { value: 'TYRES',      label: 'Gomme',      icon: Circle },
  { value: 'CONTROLS',   label: 'Comandi',    icon: Gauge },
  { value: 'SEAT',       label: 'Sella',      icon: Armchair },
  { value: 'OTHER',      label: 'Altro',      icon: MoreHorizontal },
];

export const GALLERY_ICONS = [
  { value: 'PROFILE',       label: 'Profilo',    icon: Camera },
  { value: 'RESTORATION',   label: 'Restauro',   icon: Hammer },
  { value: 'MAINTENANCE',   label: 'Manutenz.',  icon: Wrench },
  { value: 'MODIFICATION',  label: 'Modifica',   icon: Sparkles },
  { value: 'TRIP',          label: 'Viaggio',    icon: MapPin },
  { value: 'MEETUP',        label: 'Raduno',     icon: Users },
  { value: 'BEFORE_AFTER',  label: 'Prima/Dopo', icon: SplitSquareHorizontal },
  { value: 'OTHER',         label: 'Altro',      icon: MoreHorizontal },
];

export const DOCUMENT_ICONS = [
  { value: 'INVOICE',                label: 'Fattura',     icon: Receipt },
  { value: 'RECEIPT',                label: 'Ricevuta',    icon: Receipt },
  { value: 'MANUAL',                 label: 'Manuale',     icon: BookOpen },
  { value: 'CERTIFICATE',            label: 'Certificato', icon: BadgeCheck },
  { value: 'SERVICE_DOCUMENT',       label: 'Tagliando',   icon: FileText },
  { value: 'RESTORATION_DOCUMENT',   label: 'Restauro',    icon: Layers },
  { value: 'OTHER',                  label: 'Altro',       icon: MoreHorizontal },
];

export const ICON_MAP = {
  maintenance: MAINTENANCE_ICONS,
  timeline: TIMELINE_ICONS,
  modification: MODIFICATION_ICONS,
  gallery: GALLERY_ICONS,
  document: DOCUMENT_ICONS,
};

// Reverse lookup: get icon + label from category value
export function findCategoryMeta(kind, value) {
  const list = ICON_MAP[kind] || [];
  return list.find(o => o.value === value) || { value, label: value, icon: MoreHorizontal };
}
