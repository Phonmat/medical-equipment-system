export type Role = 'Super Admin' | 'Admin' | 'PM/CAL' | 'Pool' | 'User';

export interface AppUser {
  id: string;
  username: string;
  password?: string;
  role: Role;
  facility?: string;
  team?: string;
  avatar?: string;
  createdAt: string;
}

export interface FacilityUsageConfig {
  facility: string;
  usageDays: number;
  startDate: string;
  expiryDate: string;
  maxRegularUsers?: number;
  updatedAt?: string;
}

export type RiskLevel = 'High' | 'Medium' | 'Low';

export type EquipmentStatus = 'active' | 'repairing' | 'broken' | 'decommissioned' | 'inactive';

export interface Equipment {
  id: string;
  code: string;
  name: string;
  riskLevel: RiskLevel;
  purchaseDate: string;
  purchase: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  department: string;
  facility?: string;
  ownerUsername?: string;
  team?: string;
  itrisId: string;
  status: EquipmentStatus;
  installationDate?: string;
  registrationDate?: string;
  vendorCompany?: string;
  warrantyYears?: string | number;
  warrantyPeriod?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  assetNo?: string;
  poNo?: string;
  umdnsCode?: string;
  deptAbbreviation?: string;
  costCenter?: string;
  building?: string;
  floor?: string;
  room?: string;
  station?: string;
  accessories?: string;
  consumables?: string;
}

export type RepairStatus = 'pending' | 'in_progress' | 'completed';

export interface RepairJob {
  id: string;
  equipmentId: string;
  isNonRegistered?: boolean;
  equipmentCode?: string;
  equipmentName?: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  issue: string;
  repairDetails?: string;
  department?: string;
  facility?: string;
  ownerUsername?: string;
  reportDate: string;
  reportTime?: string;
  technician: string;
  technicianSignature?: string;
  closingTechnician?: string;
  closingTechnicianSignature?: string;
  status: RepairStatus;
  reportedBy?: string;
  requesterSignature?: string;
  signerName?: string;
  signatureDate?: string;
  closingSignature?: string;
  closerName?: string;
  closingSignerName?: string;
  closingDate?: string;
  closingTime?: string;
  closingNotes?: string;
}

export interface Decommission {
  id: string;
  equipmentId: string;
  reason: string;
  date: string;
  approvedBy: string;
  approverSignature?: string;
  technician?: string;
  technicianSignature?: string;
}

export type PlanStatus = 'pending' | 'completed' | 'overdue';

export interface MaintenancePlan {
  id: string;
  equipmentId: string;
  frequency: string;
  lastDate: string;
  nextDate: string;
  technician?: string;
  notes?: string;
  status: PlanStatus;
}

export interface CalibrationPlan {
  id: string;
  equipmentId: string;
  frequency: string;
  lastDate: string;
  nextDate: string;
  agency?: string;
  certNumber?: string;
  status: PlanStatus;
}

export type PoolLoanStatus = 'borrowed' | 'returned' | 'overdue';
export type PoolReturnCondition = 'normal' | 'damaged' | 'needs_cleaning';

export interface PoolLoan {
  id: string;
  equipmentId: string;
  equipmentCode?: string;
  equipmentName?: string;
  borrowerDepartment: string;
  borrowerName: string;
  borrowDate: string;
  borrowTime?: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  purpose?: string;
  status: PoolLoanStatus;
  issuedBy?: string;
  returnedTo?: string;
  returnCondition?: PoolReturnCondition;
  notes?: string;
}

export type EquipmentDocType = 
  | 'mutation_in' 
  | 'inspection' 
  | 'manual' 
  | 'warranty' 
  | 'calibration_cert' 
  | 'invoice' 
  | 'service_report' 
  | 'other';

export interface EquipmentDocument {
  id: string;
  equipmentId: string;
  equipmentCode?: string;
  equipmentName?: string;
  department?: string;
  title: string;
  docType: EquipmentDocType;
  docNumber?: string;
  fileData?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  uploadDate: string;
  uploadedBy?: string;
  notes?: string;
}
