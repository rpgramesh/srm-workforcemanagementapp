import type {
  User,
  UserPagination,
  StaffCreateInput,
  StaffUpdateInput,
  StaffListFilters,
} from "@/types/user";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByMobile(mobile: string): Promise<User | null>;
  findByEmployeeId(employeeId: string): Promise<User | null>;
  list(params?: UserPagination): Promise<User[]>;
  count(params?: Omit<UserPagination, "limit" | "offset">): Promise<number>;

  filter(params?: StaffListFilters): Promise<User[]>;
  filterCount(params?: Omit<StaffListFilters, "limit" | "offset">): Promise<number>;

  create(input: StaffCreateInput): Promise<User>;
  update(input: StaffUpdateInput): Promise<User>;
  softDelete(id: string): Promise<void>;

  verifyByMobileAndPin(
    mobile: string,
    pin: string,
  ): Promise<User | null>;

  verifyByClockInPin(pin: string): Promise<User | null>;
}
