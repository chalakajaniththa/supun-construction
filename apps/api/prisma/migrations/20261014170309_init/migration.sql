-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'DANGER');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "BackupTrigger" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "BackupDestination" AS ENUM ('LOCAL', 'GDRIVE', 'BOTH');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('GOVERNMENT', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('MATERIAL', 'HARDWARE', 'FUEL', 'SUBCONTRACTOR', 'EQUIPMENT_HIRE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('ROAD', 'BUILDING', 'SCHOOL_BUILDING', 'BRIDGE_CULVERT', 'IRRIGATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectSource" AS ENUM ('GOVERNMENT_TENDER', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ONGOING', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('LABOUR', 'MATERIALS', 'EQUIPMENT', 'SUBCONTRACT', 'OVERHEAD', 'OTHER');

-- CreateEnum
CREATE TYPE "VariationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CERTIFIED', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHEQUE', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "ClientPaymentKind" AS ENUM ('IPC_PAYMENT', 'ADVANCE', 'RETENTION_RELEASE', 'OTHER');

-- CreateEnum
CREATE TYPE "BondType" AS ENUM ('BID_BOND', 'PERFORMANCE_BOND', 'ADVANCE_PAYMENT_GUARANTEE', 'RETENTION_GUARANTEE');

-- CreateEnum
CREATE TYPE "BondStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DocumentOwnerType" AS ENUM ('COMPANY', 'PROJECT', 'ASSET', 'WORKER', 'SUPPLIER', 'CLIENT');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('PLAN_DRAWING', 'CONTRACT', 'BOQ', 'PHOTO', 'INVOICE', 'RECEIPT', 'LETTER', 'ESTIMATE', 'REVENUE_LICENCE', 'INSURANCE', 'EMISSION_TEST', 'FITNESS_CERTIFICATE', 'REGISTRATION_BOOK', 'NIC_COPY', 'CERTIFICATE', 'CIDA_REGISTRATION', 'BOND_COPY', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkerSkill" AS ENUM ('MASON', 'CARPENTER', 'HELPER', 'MACHINE_OPERATOR', 'DRIVER', 'STEEL_FIXER', 'ELECTRICIAN', 'PLUMBER', 'SUPERVISOR', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('DAILY', 'PERMANENT');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('PLANNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('OPEN', 'RECOVERED');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('JCB_BACKHOE', 'EXCAVATOR', 'TIPPER', 'CAB', 'TRACTOR', 'ROLLER', 'CONCRETE_MIXER', 'WATER_BOWSER', 'COMPACTOR', 'GENERATOR', 'TOOL', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetOwnership" AS ENUM ('OWNED', 'HIRED_IN');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'UNDER_REPAIR', 'DISPOSED');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('HOURS', 'KM', 'NONE');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('SERVICE', 'REPAIR', 'TYRE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('CEMENT', 'SAND', 'AGGREGATE', 'STEEL', 'BRICKS_BLOCKS', 'TIMBER', 'HARDWARE', 'FUEL', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchasePaymentType" AS ENUM ('CASH', 'CREDIT');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'TRANSPORT', 'MEALS', 'EQUIPMENT_HIRE', 'SUBCONTRACT', 'SMALL_TOOLS', 'UTILITIES', 'PERMITS_FEES', 'REPAIRS', 'OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpensePaidBy" AS ENUM ('CASH', 'BANK', 'CREDIT');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "usingDefaultPassword" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" "AuditAction" NOT NULL,
    "summary" JSONB NOT NULL,
    "username" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL,
    "titleKey" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "entityType" TEXT,
    "entityId" TEXT,
    "dueDate" DATE,
    "readAt" TIMESTAMPTZ,
    "resolvedAt" TIMESTAMPTZ,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_runs" (
    "id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "status" "BackupStatus" NOT NULL,
    "trigger" "BackupTrigger" NOT NULL,
    "size_bytes" BIGINT,
    "destination" "BackupDestination" NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_requests" (
    "id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "picked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClientType" NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SupplierType" NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL,
    "source" "ProjectSource" NOT NULL,
    "clientId" UUID NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "contractValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "contractNo" TEXT,
    "tenderNo" TEXT,
    "startDate" DATE NOT NULL,
    "plannedEndDate" DATE NOT NULL,
    "revisedEndDate" DATE,
    "actualEndDate" DATE,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "retentionPct" DECIMAL(7,4) NOT NULL DEFAULT 10,
    "retentionCapPct" DECIMAL(7,4) NOT NULL DEFAULT 5,
    "advanceAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "advanceRecoveryPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "dlpMonths" INTEGER NOT NULL DEFAULT 12,
    "progressPct" DECIMAL(7,4),
    "siteSupervisorWorkerId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBudgetLine" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ProjectBudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtensionOfTime" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "previousEndDate" DATE NOT NULL,
    "newEndDate" DATE NOT NULL,
    "approvedDate" DATE NOT NULL,
    "reference" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ExtensionOfTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqItem" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "itemNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "variationId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BoqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqMeasurement" (
    "id" UUID NOT NULL,
    "boqItemId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "cumulativeQty" DECIMAL(14,3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BoqMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variation" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "VariationStatus" NOT NULL DEFAULT 'PENDING',
    "amountChange" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Variation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCertificate" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "periodFrom" DATE NOT NULL,
    "periodTo" DATE NOT NULL,
    "cumulativeWorkDone" DECIMAL(14,2) NOT NULL,
    "previousCertified" DECIMAL(14,2) NOT NULL,
    "grossThisBill" DECIMAL(14,2) NOT NULL,
    "retentionDeducted" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "advanceRecovered" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherDeductionsNote" TEXT,
    "netPayable" DECIMAL(14,2) NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedDate" DATE,
    "certifiedDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PaymentCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPayment" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "certificateId" UUID,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "kind" "ClientPaymentKind" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ClientPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bond" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "type" "BondType" NOT NULL,
    "bank" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "issueDate" DATE NOT NULL,
    "expiryDate" DATE NOT NULL,
    "status" "BondStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Bond_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "ownerType" "DocumentOwnerType" NOT NULL,
    "ownerId" UUID,
    "category" "DocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "currentVersionId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "issueDate" DATE,
    "expiryDate" DATE,
    "note" TEXT,
    "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nameSinhala" TEXT,
    "nic" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "dateOfBirth" DATE,
    "skill" "WorkerSkill" NOT NULL,
    "type" "WorkerType" NOT NULL,
    "joinedDate" DATE NOT NULL,
    "leftDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "epfNo" TEXT,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "emergencyContact" TEXT,
    "photoDocId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerRate" (
    "id" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "dailyRate" DECIMAL(14,2),
    "monthlySalary" DECIMAL(14,2),
    "otHourlyRate" DECIMAL(14,2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WorkerRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerAllocation" (
    "id" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "notes" TEXT,
    "status" "AllocationStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WorkerAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "projectId" UUID,
    "status" "AttendanceStatus" NOT NULL,
    "otHours" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "payrollRunId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT,
    "recoveryPerMonth" DECIMAL(14,2),
    "status" "AdvanceStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceRecovery" (
    "id" UUID NOT NULL,
    "advanceId" UUID NOT NULL,
    "payrollLineId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AdvanceRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "registrationNo" TEXT,
    "chassisNo" TEXT,
    "engineNo" TEXT,
    "yearOfManufacture" INTEGER,
    "purchaseDate" DATE,
    "purchaseCost" DECIMAL(14,2),
    "ownership" "AssetOwnership" NOT NULL DEFAULT 'OWNED',
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "meterType" "MeterType" NOT NULL DEFAULT 'HOURS',
    "currentMeter" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "serviceIntervalMeter" DECIMAL(14,3),
    "lastServiceMeter" DECIMAL(14,3),
    "internalRatePerHour" DECIMAL(14,2),
    "internalRatePerDay" DECIMAL(14,2),
    "isVehicle" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAllocation" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "operatorWorkerId" UUID,
    "notes" TEXT,
    "status" "AllocationStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AssetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetUsageLog" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "projectId" UUID,
    "date" DATE NOT NULL,
    "startMeter" DECIMAL(14,3),
    "endMeter" DECIMAL(14,3),
    "hoursUsed" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "fuelLitres" DECIMAL(14,3),
    "fuelCost" DECIMAL(14,2),
    "operatorWorkerId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AssetUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "description" TEXT NOT NULL,
    "meterReading" DECIMAL(14,3),
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "supplierId" UUID,
    "nextServiceMeter" DECIMAL(14,3),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameSinhala" TEXT,
    "unit" TEXT NOT NULL,
    "category" "MaterialCategory" NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "invoiceNo" TEXT,
    "paymentType" "PurchasePaymentType" NOT NULL,
    "notes" TEXT,
    "total" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "projectId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIssue" (
    "id" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MaterialIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "projectId" UUID,
    "assetId" UUID,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidBy" "ExpensePaidBy" NOT NULL DEFAULT 'CASH',
    "supplierId" UUID,
    "receiptDocumentId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" UUID NOT NULL,
    "payrollRunId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "workerType" "WorkerType" NOT NULL,
    "daysWorked" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "halfDays" INTEGER NOT NULL DEFAULT 0,
    "otHours" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "basicPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "epfEmployee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "epfEmployer" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "etfEmployer" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "advanceDeduction" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "breakdown" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_resolvedAt_readAt_idx" ON "Notification"("resolvedAt", "readAt");

-- CreateIndex
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "backup_runs_started_at_idx" ON "backup_runs"("started_at");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBudgetLine_projectId_category_key" ON "ProjectBudgetLine"("projectId", "category");

-- CreateIndex
CREATE INDEX "ExtensionOfTime_projectId_approvedDate_idx" ON "ExtensionOfTime"("projectId", "approvedDate");

-- CreateIndex
CREATE INDEX "BoqItem_projectId_sortOrder_idx" ON "BoqItem"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BoqMeasurement_boqItemId_date_key" ON "BoqMeasurement"("boqItemId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Variation_projectId_number_key" ON "Variation"("projectId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCertificate_projectId_number_key" ON "PaymentCertificate"("projectId", "number");

-- CreateIndex
CREATE INDEX "ClientPayment_projectId_date_idx" ON "ClientPayment"("projectId", "date");

-- CreateIndex
CREATE INDEX "Bond_status_expiryDate_idx" ON "Bond"("status", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Document_currentVersionId_key" ON "Document"("currentVersionId");

-- CreateIndex
CREATE INDEX "Document_ownerType_ownerId_idx" ON "Document"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_storageKey_key" ON "DocumentVersion"("storageKey");

-- CreateIndex
CREATE INDEX "DocumentVersion_expiryDate_idx" ON "DocumentVersion"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNo_key" ON "DocumentVersion"("documentId", "versionNo");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_code_key" ON "Worker"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_nic_key" ON "Worker"("nic");

-- CreateIndex
CREATE INDEX "Worker_fullName_idx" ON "Worker"("fullName");

-- CreateIndex
CREATE INDEX "Worker_type_active_idx" ON "Worker"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerRate_workerId_effectiveFrom_key" ON "WorkerRate"("workerId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "WorkerAllocation_workerId_startAt_idx" ON "WorkerAllocation"("workerId", "startAt");

-- CreateIndex
CREATE INDEX "WorkerAllocation_projectId_startAt_idx" ON "WorkerAllocation"("projectId", "startAt");

-- CreateIndex
CREATE INDEX "Attendance_projectId_date_idx" ON "Attendance"("projectId", "date");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_workerId_date_key" ON "Attendance"("workerId", "date");

-- CreateIndex
CREATE INDEX "Advance_workerId_status_idx" ON "Advance"("workerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceRecovery_advanceId_payrollLineId_key" ON "AdvanceRecovery"("advanceId", "payrollLineId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_code_key" ON "Asset"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_registrationNo_key" ON "Asset"("registrationNo");

-- CreateIndex
CREATE INDEX "Asset_category_idx" ON "Asset"("category");

-- CreateIndex
CREATE INDEX "AssetAllocation_assetId_startAt_idx" ON "AssetAllocation"("assetId", "startAt");

-- CreateIndex
CREATE INDEX "AssetAllocation_projectId_startAt_idx" ON "AssetAllocation"("projectId", "startAt");

-- CreateIndex
CREATE INDEX "AssetUsageLog_assetId_date_idx" ON "AssetUsageLog"("assetId", "date");

-- CreateIndex
CREATE INDEX "AssetUsageLog_projectId_date_idx" ON "AssetUsageLog"("projectId", "date");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_assetId_date_idx" ON "MaintenanceRecord"("assetId", "date");

-- CreateIndex
CREATE INDEX "Material_name_idx" ON "Material"("name");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_date_idx" ON "Purchase"("supplierId", "date");

-- CreateIndex
CREATE INDEX "Purchase_date_idx" ON "Purchase"("date");

-- CreateIndex
CREATE INDEX "PurchaseLine_materialId_idx" ON "PurchaseLine"("materialId");

-- CreateIndex
CREATE INDEX "PurchaseLine_projectId_idx" ON "PurchaseLine"("projectId");

-- CreateIndex
CREATE INDEX "MaterialIssue_materialId_date_idx" ON "MaterialIssue"("materialId", "date");

-- CreateIndex
CREATE INDEX "MaterialIssue_projectId_date_idx" ON "MaterialIssue"("projectId", "date");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_date_idx" ON "SupplierPayment"("supplierId", "date");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_projectId_date_idx" ON "Expense"("projectId", "date");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_year_month_key" ON "PayrollRun"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollLine_payrollRunId_workerId_key" ON "PayrollLine"("payrollRunId", "workerId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_siteSupervisorWorkerId_fkey" FOREIGN KEY ("siteSupervisorWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBudgetLine" ADD CONSTRAINT "ProjectBudgetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtensionOfTime" ADD CONSTRAINT "ExtensionOfTime_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqMeasurement" ADD CONSTRAINT "BoqMeasurement_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCertificate" ADD CONSTRAINT "PaymentCertificate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPayment" ADD CONSTRAINT "ClientPayment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPayment" ADD CONSTRAINT "ClientPayment_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "PaymentCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bond" ADD CONSTRAINT "Bond_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_photoDocId_fkey" FOREIGN KEY ("photoDocId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRate" ADD CONSTRAINT "WorkerRate_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAllocation" ADD CONSTRAINT "WorkerAllocation_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAllocation" ADD CONSTRAINT "WorkerAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceRecovery" ADD CONSTRAINT "AdvanceRecovery_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceRecovery" ADD CONSTRAINT "AdvanceRecovery_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAllocation" ADD CONSTRAINT "AssetAllocation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAllocation" ADD CONSTRAINT "AssetAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAllocation" ADD CONSTRAINT "AssetAllocation_operatorWorkerId_fkey" FOREIGN KEY ("operatorWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetUsageLog" ADD CONSTRAINT "AssetUsageLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetUsageLog" ADD CONSTRAINT "AssetUsageLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetUsageLog" ADD CONSTRAINT "AssetUsageLog_operatorWorkerId_fkey" FOREIGN KEY ("operatorWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssue" ADD CONSTRAINT "MaterialIssue_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssue" ADD CONSTRAINT "MaterialIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_receiptDocumentId_fkey" FOREIGN KEY ("receiptDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
