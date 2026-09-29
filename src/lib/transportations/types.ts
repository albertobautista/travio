import { ArrowRightLeft, Bus, Car, Plane, Ship, TrainFront, type LucideIcon } from "lucide-react";

/** Mirrors the check constraint on transportations.type. */
export const TRANSPORT_TYPES = ["flight", "train", "bus", "ferry", "car_rental", "other"] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

type Meta = {
  label: string;
  icon: LucideIcon;
  /** Words the form and cards use for this type. */
  departs: string;
  arrives: string;
  carrier: string;
  /** Null when the type has no service number (car rentals). */
  number: string | null;
  departureDetail: string;
  arrivalDetail: string;
};

export const TRANSPORT_META: Record<TransportType, Meta> = {
  flight: {
    label: "Vuelo",
    icon: Plane,
    departs: "Sale",
    arrives: "Llega",
    carrier: "Aerolínea",
    number: "Vuelo",
    departureDetail: "Terminal 5 · puerta B32",
    arrivalDetail: "Terminal 1",
  },
  train: {
    label: "Tren",
    icon: TrainFront,
    departs: "Sale",
    arrives: "Llega",
    carrier: "Operador",
    number: "Tren",
    departureDetail: "Andén 4 · coche 7",
    arrivalDetail: "Andén 2",
  },
  bus: {
    label: "Autobús",
    icon: Bus,
    departs: "Sale",
    arrives: "Llega",
    carrier: "Línea",
    number: "Número",
    departureDetail: "Andén 12",
    arrivalDetail: "Terminal norte",
  },
  ferry: {
    label: "Ferry",
    icon: Ship,
    departs: "Sale",
    arrives: "Llega",
    carrier: "Naviera",
    number: "Número",
    departureDetail: "Muelle 3",
    arrivalDetail: "Muelle 1",
  },
  car_rental: {
    label: "Renta de auto",
    icon: Car,
    departs: "Recoger",
    arrives: "Devolver",
    carrier: "Arrendadora",
    number: null,
    departureDetail: "Mostrador en la terminal 2",
    arrivalDetail: "Estacionamiento P3",
  },
  other: {
    label: "Otro",
    icon: ArrowRightLeft,
    departs: "Sale",
    arrives: "Llega",
    carrier: "Operador",
    number: "Número",
    departureDetail: "Punto de salida",
    arrivalDetail: "Punto de llegada",
  },
};

export function isTransportType(value: string): value is TransportType {
  return (TRANSPORT_TYPES as readonly string[]).includes(value);
}

export function transportMeta(type: string) {
  return TRANSPORT_META[isTransportType(type) ? type : "other"];
}
