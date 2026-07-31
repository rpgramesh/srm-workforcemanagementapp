import type { StaffListFilters } from "./user";

export interface FilterPreset {
  id: string;
  userId: string;
  module: string;
  name: string;
  filters: StaffListFilters;
  sortOrder: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FilterPresetRepository {
  list(userId: string, module: string): Promise<FilterPreset[]>;
  upsert(
    userId: string,
    module: string,
    name: string,
    filters: StaffListFilters,
    isDefault?: boolean,
  ): Promise<string>;
  remove(userId: string, module: string, presetId: string): Promise<void>;
}
