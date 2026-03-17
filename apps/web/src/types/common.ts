// Utility types used globally across the FE codebase

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type ID = string;

/** Navigation item shape used by sidebar */
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: string[];
  badge?: string | number;
}

/** Generic key-value pair */
export type KV<V = string> = Record<string, V>;

/** A value paired with a display label */
export interface LabeledValue<T = string> {
  label: string;
  value: T;
}
