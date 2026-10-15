import { createHash, randomUUID } from 'node:crypto';
import {
  type AssetCategory,
  type BudgetCategory,
  type ClientType,
  type CompanySettings,
  DEFAULT_SETTINGS,
  type DocumentCategory,
  type DocumentOwnerType,
  type MaterialCategory,
  type ProjectSource,
  type ProjectStatus,
  type ProjectType,
  type SupplierType,
  type WorkerSkill,
  type WorkerType,
  dayToDate,
} from '@sc/shared';
import { addDays, todayInColombo } from '../common/dates/dates.js';
import type { StorageService } from '../common/storage/storage.service.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { storageKeyFor } from '../modules/documents/documents.service.js';
import { makePdf, makePng } from './files.js';
import { seedOperations } from './sample-operations.js';

/** Sample company details (fictional; overview §10). */
export const SAMPLE_COMPANY: CompanySettings = {
  ...DEFAULT_SETTINGS.company,
  name: 'Supun Construction (Pvt) Ltd',
  address: 'No. 45, Batticaloa Road, Kaduruwela, Polonnaruwa',
  phone: '027 222 3456',
  email: 'info@supunconstruction.example',
  cidaGrade: 'C5 (Building), C6 (Highways)',
};

// ─────────────────────────────── Sample records ───────────────────────────────
// Everything is clearly fictional ("sample") and placed around Polonnaruwa.

const CLIENTS: {
  key: string;
  name: string;
  type: ClientType;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}[] = [
  {
    key: 'rda',
    name: 'Provincial Road Development Authority – North Central (sample)',
    type: 'GOVERNMENT',
    contactPerson: 'Eng. H. M. Rathnayake (Divisional Engineer)',
    phone: '027 222 5100',
    email: 'pr-da.sample@example.lk',
    address: 'New Town, Polonnaruwa',
  },
  {
    key: 'ps',
    name: 'Hingurakgoda Pradeshiya Sabha (sample)',
    type: 'GOVERNMENT',
    contactPerson: 'Mr. A. G. Dissanayake (Secretary)',
    phone: '027 224 6011',
    address: 'Main Street, Hingurakgoda',
  },
  {
    key: 'sds',
    name: 'Medirigiriya Central College – School Development Society (sample)',
    type: 'GOVERNMENT',
    contactPerson: 'Mrs. K. P. Jayawardena (Principal)',
    phone: '027 224 8890',
    address: 'Medirigiriya',
  },
  {
    key: 'person',
    name: 'Mr. W. A. Chandana Wickramasinghe',
    type: 'PRIVATE',
    phone: '071 456 7788',
    address: 'No. 12, Lake View Road, Kaduruwela',
  },
  {
    key: 'company',
    name: 'Polonnaruwa Agro Traders (Pvt) Ltd (sample)',
    type: 'PRIVATE',
    contactPerson: 'Mr. S. Karunaratne (Director)',
    phone: '027 222 7766',
    email: 'office@agrotraders.example',
    address: 'Habarana Road, Polonnaruwa',
  },
];

interface SampleProject {
  key: string;
  name: string;
  type: ProjectType;
  source: ProjectSource;
  client: string;
  status: ProjectStatus;
  location: string;
  description: string;
  contractValue: string;
  /** Days from today. */
  start: number;
  end: number;
  actualEnd?: number;
  contractNo?: string;
  tenderNo?: string;
  advanceAmount?: string;
  advanceRecoveryPct?: string;
  progressPct?: string;
  supervisor?: string;
  budget: Partial<Record<BudgetCategory, string>>;
}

const PROJECTS: SampleProject[] = [
  {
    key: 'road',
    name: 'Rural road rehabilitation – Hingurakgoda (2.4 km)',
    type: 'ROAD',
    source: 'GOVERNMENT_TENDER',
    client: 'rda',
    status: 'ONGOING',
    location: 'Hingurakgoda – Yaya 4 road',
    description:
      'Widening, ABC base and DBST surfacing of 2.4 km with side drains and 3 pipe culverts.',
    contractValue: '48500000.00',
    start: -150,
    end: 120,
    contractNo: 'PRDA/NCP/2026/RD/014',
    tenderNo: 'NCP/RDA/T/2025/112',
    advanceAmount: '9700000.00',
    advanceRecoveryPct: '25',
    supervisor: 'W-0019',
    budget: {
      LABOUR: '7800000.00',
      MATERIALS: '19500000.00',
      EQUIPMENT: '9200000.00',
      SUBCONTRACT: '2400000.00',
      OVERHEAD: '1500000.00',
      OTHER: '600000.00',
    },
  },
  {
    key: 'school',
    name: 'Two-storey classroom block – Medirigiriya Central College',
    type: 'SCHOOL_BUILDING',
    source: 'GOVERNMENT_TENDER',
    client: 'sds',
    status: 'ONGOING',
    location: 'Medirigiriya',
    description: '2-storey, 8-classroom block (560 m²) with staircase and toilets.',
    contractValue: '32750000.00',
    start: -90,
    end: 180,
    contractNo: 'MCC/SDS/2026/01',
    tenderNo: 'ZEO/MED/2025/07',
    advanceAmount: '3275000.00',
    advanceRecoveryPct: '15',
    supervisor: 'W-0020',
    budget: {
      LABOUR: '7200000.00',
      MATERIALS: '14800000.00',
      EQUIPMENT: '1600000.00',
      SUBCONTRACT: '2900000.00',
      OVERHEAD: '1100000.00',
    },
  },
  {
    key: 'culvert',
    name: 'Box culvert – Kaduruwela–Giritale road (km 3+250)',
    type: 'BRIDGE_CULVERT',
    source: 'GOVERNMENT_TENDER',
    client: 'rda',
    status: 'COMPLETED',
    location: 'Kaduruwela – Giritale road',
    description: '2 m × 2 m reinforced concrete box culvert with wing walls.',
    contractValue: '8900000.00',
    start: -400,
    end: -200,
    actualEnd: -210,
    contractNo: 'PRDA/NCP/2025/BC/006',
    tenderNo: 'NCP/RDA/T/2025/031',
    budget: {
      LABOUR: '1650000.00',
      MATERIALS: '3900000.00',
      EQUIPMENT: '1100000.00',
      OVERHEAD: '350000.00',
    },
  },
  {
    key: 'house',
    name: 'Two-storey house – Kaduruwela',
    type: 'BUILDING',
    source: 'PRIVATE',
    client: 'person',
    status: 'ONGOING',
    location: 'Lake View Road, Kaduruwela',
    description: 'Private 2-storey house, 2,400 sq ft, with a roof terrace.',
    contractValue: '18500000.00',
    start: -120,
    end: 90,
    progressPct: '45',
    supervisor: 'W-0021',
    budget: {
      LABOUR: '4300000.00',
      MATERIALS: '8600000.00',
      EQUIPMENT: '650000.00',
      SUBCONTRACT: '1800000.00',
      OVERHEAD: '500000.00',
    },
  },
  {
    key: 'shop',
    name: 'Small shop building – Habarana Road',
    type: 'BUILDING',
    source: 'PRIVATE',
    client: 'company',
    status: 'PLANNING',
    location: 'Habarana Road, Polonnaruwa',
    description: 'Single-storey shop (3 units) with a store room.',
    contractValue: '6200000.00',
    start: 20,
    end: 170,
    budget: { LABOUR: '1400000.00', MATERIALS: '3000000.00', OVERHEAD: '250000.00' },
  },
  {
    key: 'drain',
    name: 'Drain improvement – Hingurakgoda town',
    type: 'IRRIGATION',
    source: 'GOVERNMENT_TENDER',
    client: 'ps',
    status: 'ON_HOLD',
    location: 'Hingurakgoda town centre',
    description: 'Rebuilding 650 m of the town storm-water drain with covers.',
    contractValue: '11400000.00',
    start: -60,
    end: 60,
    contractNo: 'HPS/2026/W/03',
    tenderNo: 'HPS/T/2026/02',
    budget: { LABOUR: '2600000.00', MATERIALS: '4700000.00', EQUIPMENT: '1300000.00' },
  },
];

interface SampleWorker {
  name: string;
  si: string;
  skill: WorkerSkill;
  type: WorkerType;
  /** Daily rate (DAILY) or monthly salary (PERMANENT), first and (optionally) after last month's raise. */
  pay: string;
  raise?: string;
  joined: number;
  phone: string;
  nic?: string;
  epfNo?: string;
}

const WORKERS: SampleWorker[] = [
  // 18 daily-paid
  {
    name: 'K. A. Sunil Perera',
    si: 'කේ. ඒ. සුනිල් පෙරේරා',
    skill: 'MASON',
    type: 'DAILY',
    pay: '4200',
    raise: '4500',
    joined: -900,
    phone: '071 234 5601',
    nic: '781234567V',
  },
  {
    name: 'M. G. Ruwan Kumara',
    si: 'එම්. ජී. රුවන් කුමාර',
    skill: 'MASON',
    type: 'DAILY',
    pay: '4000',
    raise: '4300',
    joined: -700,
    phone: '077 345 6702',
    nic: '852345678V',
  },
  {
    name: 'H. P. Saman Jayasinghe',
    si: 'එච්. පී. සමන් ජයසිංහ',
    skill: 'MASON',
    type: 'DAILY',
    pay: '4000',
    joined: -400,
    phone: '076 456 7803',
    nic: '199012345678',
  },
  {
    name: 'D. M. Nuwan Dissanayake',
    si: 'ඩී. එම්. නුවන් දිසානායක',
    skill: 'CARPENTER',
    type: 'DAILY',
    pay: '4100',
    raise: '4300',
    joined: -650,
    phone: '071 567 8904',
    nic: '880456789V',
  },
  {
    name: 'R. A. Chaminda Rajapaksha',
    si: 'ආර්. ඒ. චමින්ද රාජපක්ෂ',
    skill: 'CARPENTER',
    type: 'DAILY',
    pay: '4000',
    joined: -300,
    phone: '070 678 9005',
  },
  {
    name: 'W. M. Kasun Bandara',
    si: 'ඩබ්ලිව්. එම්. කසුන් බණ්ඩාර',
    skill: 'STEEL_FIXER',
    type: 'DAILY',
    pay: '3800',
    raise: '4000',
    joined: -500,
    phone: '075 789 0106',
    nic: '199534567890',
  },
  {
    name: 'S. K. Lalith Senanayake',
    si: 'එස්. කේ. ලලිත් සේනානායක',
    skill: 'STEEL_FIXER',
    type: 'DAILY',
    pay: '3800',
    joined: -260,
    phone: '071 890 1207',
  },
  {
    name: 'P. G. Ajith Pushpakumara',
    si: 'පී. ජී. අජිත් පුෂ්පකුමාර',
    skill: 'MACHINE_OPERATOR',
    type: 'DAILY',
    pay: '4500',
    joined: -820,
    phone: '077 901 2308',
    nic: '800567890V',
  },
  {
    name: 'T. M. Dinesh Tennakoon',
    si: 'ටී. එම්. දිනේෂ් තෙන්නකෝන්',
    skill: 'DRIVER',
    type: 'DAILY',
    pay: '3800',
    raise: '4000',
    joined: -480,
    phone: '076 012 3409',
    nic: '870678901V',
  },
  {
    name: 'A. M. Pradeep Abeykoon',
    si: 'ඒ. එම්. ප්‍රදීප් අබේකෝන්',
    skill: 'ELECTRICIAN',
    type: 'DAILY',
    pay: '4200',
    joined: -350,
    phone: '071 123 4510',
  },
  {
    name: 'J. K. Mahesh Jayakody',
    si: 'ජේ. කේ. මහේෂ් ජයකොඩි',
    skill: 'PLUMBER',
    type: 'DAILY',
    pay: '4000',
    joined: -220,
    phone: '070 234 5611',
  },
  {
    name: 'E. W. Sampath Ekanayake',
    si: 'ඊ. ඩබ්ලිව්. සම්පත් ඒකනායක',
    skill: 'HELPER',
    type: 'DAILY',
    pay: '2900',
    raise: '3000',
    joined: -600,
    phone: '075 345 6712',
    nic: '199812345670',
  },
  {
    name: 'K. M. Nimal Karunaratne',
    si: 'කේ. එම්. නිමල් කරුණාරත්න',
    skill: 'HELPER',
    type: 'DAILY',
    pay: '2800',
    joined: -420,
    phone: '077 456 7813',
  },
  {
    name: 'B. G. Upul Gunawardena',
    si: 'බී. ජී. උපුල් ගුණවර්ධන',
    skill: 'HELPER',
    type: 'DAILY',
    pay: '2800',
    raise: '3000',
    joined: -380,
    phone: '071 567 8914',
  },
  {
    name: 'L. P. Asanka Liyanage',
    si: 'එල්. පී. අසංක ලියනගේ',
    skill: 'HELPER',
    type: 'DAILY',
    pay: '2800',
    joined: -200,
    phone: '076 678 9015',
  },
  {
    name: 'G. H. Roshan Herath',
    si: 'ජී. එච්. රොෂාන් හේරත්',
    skill: 'HELPER',
    type: 'DAILY',
    pay: '2800',
    joined: -150,
    phone: '070 789 0116',
  },
  {
    name: 'N. D. Thilak Nanayakkara',
    si: 'එන්. ඩී. තිලක් නානායක්කාර',
    skill: 'HELPER',
    type: 'DAILY',
    pay: '2850',
    joined: -90,
    phone: '075 890 1217',
  },
  {
    name: 'U. K. Janaka Udayakumara',
    si: 'යූ. කේ. ජනක උදයකුමාර',
    skill: 'HELPER',
    type: 'DAILY',
    pay: '2800',
    joined: -45,
    phone: '071 901 2318',
  },
  // 7 permanent
  {
    name: 'R. M. Priyantha Rathnayake',
    si: 'ආර්. එම්. ප්‍රියන්ත රත්නායක',
    skill: 'SUPERVISOR',
    type: 'PERMANENT',
    pay: '110000',
    raise: '120000',
    joined: -1500,
    phone: '077 111 2201',
    nic: '750123456V',
    epfNo: 'EPF/PL/0011',
  },
  {
    name: 'S. A. Nalaka Senarath',
    si: 'එස්. ඒ. නාලක සෙනරත්',
    skill: 'SUPERVISOR',
    type: 'PERMANENT',
    pay: '95000',
    joined: -1100,
    phone: '071 222 3302',
    nic: '198223456789',
    epfNo: 'EPF/PL/0014',
  },
  {
    name: 'H. M. Kumari Herath',
    si: 'එච්. එම්. කුමාරි හේරත්',
    skill: 'SUPERVISOR',
    type: 'PERMANENT',
    pay: '85000',
    joined: -800,
    phone: '076 333 4403',
    nic: '868765432V',
    epfNo: 'EPF/PL/0017',
  },
  {
    name: 'W. P. Gamini Wijesinghe',
    si: 'ඩබ්ලිව්. පී. ගාමිණී විජේසිංහ',
    skill: 'MACHINE_OPERATOR',
    type: 'PERMANENT',
    pay: '75000',
    raise: '80000',
    joined: -1300,
    phone: '077 444 5504',
    nic: '790987654V',
    epfNo: 'EPF/PL/0012',
  },
  {
    name: 'D. S. Anura Dharmasena',
    si: 'ඩී. එස්. අනුර ධර්මසේන',
    skill: 'DRIVER',
    type: 'PERMANENT',
    pay: '65000',
    joined: -950,
    phone: '070 555 6605',
    nic: '830345678V',
    epfNo: 'EPF/PL/0015',
  },
  {
    name: 'K. G. Mangala Kumarasinghe',
    si: 'කේ. ජී. මංගල කුමාරසිංහ',
    skill: 'DRIVER',
    type: 'PERMANENT',
    pay: '62000',
    joined: -600,
    phone: '075 666 7706',
    nic: '199145678901',
    epfNo: 'EPF/PL/0019',
  },
  {
    name: 'P. M. Sandya Pathirana',
    si: 'පී. එම්. සන්ධ්‍යා පතිරණ',
    skill: 'OTHER',
    type: 'PERMANENT',
    pay: '55000',
    joined: -700,
    phone: '071 777 8807',
    nic: '927654321V',
    epfNo: 'EPF/PL/0018',
  },
];

interface SampleAsset {
  name: string;
  category: AssetCategory;
  make: string;
  model: string;
  reg?: string;
  year: number;
  cost: string;
  meterType: 'HOURS' | 'KM' | 'NONE';
  meter: string;
  interval?: string;
  lastService?: string;
  ratePerHour?: string;
  ratePerDay?: string;
  isVehicle: boolean;
  status?: 'AVAILABLE' | 'IN_USE' | 'UNDER_REPAIR';
}

const ASSETS: SampleAsset[] = [
  {
    name: 'JCB backhoe loader 1',
    category: 'JCB_BACKHOE',
    make: 'JCB',
    model: '3CX',
    reg: 'NC LK-4521',
    year: 2016,
    cost: '14500000.00',
    meterType: 'HOURS',
    meter: '8420',
    interval: '250',
    lastService: '8200',
    ratePerHour: '6500.00',
    isVehicle: true,
    status: 'IN_USE',
  },
  {
    name: 'JCB backhoe loader 2',
    category: 'JCB_BACKHOE',
    make: 'JCB',
    model: '3DX',
    reg: 'NC LM-1180',
    year: 2019,
    cost: '17800000.00',
    meterType: 'HOURS',
    meter: '5130',
    interval: '250',
    lastService: '4900',
    ratePerHour: '6500.00',
    isVehicle: true,
    status: 'IN_USE',
  },
  {
    name: 'Excavator',
    category: 'EXCAVATOR',
    make: 'Komatsu',
    model: 'PC130-8',
    year: 2014,
    cost: '21000000.00',
    meterType: 'HOURS',
    meter: '11240',
    interval: '500',
    lastService: '10800',
    ratePerHour: '8500.00',
    isVehicle: false,
    status: 'IN_USE',
  },
  {
    name: 'Tipper 1',
    category: 'TIPPER',
    make: 'Isuzu',
    model: 'FVR 34',
    reg: 'NC LH-7012',
    year: 2015,
    cost: '9800000.00',
    meterType: 'KM',
    meter: '218400',
    interval: '5000',
    lastService: '215000',
    ratePerDay: '18000.00',
    isVehicle: true,
    status: 'IN_USE',
  },
  {
    name: 'Tipper 2',
    category: 'TIPPER',
    make: 'Tata',
    model: 'LPK 1618',
    reg: 'NC LJ-3365',
    year: 2018,
    cost: '8600000.00',
    meterType: 'KM',
    meter: '142750',
    interval: '5000',
    lastService: '140000',
    ratePerDay: '16500.00',
    isVehicle: true,
  },
  {
    name: 'Double cab',
    category: 'CAB',
    make: 'Toyota',
    model: 'Hilux',
    reg: 'NC PE-2290',
    year: 2017,
    cost: '11200000.00',
    meterType: 'KM',
    meter: '164300',
    interval: '5000',
    lastService: '160000',
    ratePerDay: '7500.00',
    isVehicle: true,
  },
  {
    name: 'Vibratory roller',
    category: 'ROLLER',
    make: 'Sakai',
    model: 'SV512',
    year: 2012,
    cost: '7400000.00',
    meterType: 'HOURS',
    meter: '6610',
    interval: '250',
    lastService: '6400',
    ratePerHour: '5500.00',
    isVehicle: false,
  },
  {
    name: 'Concrete mixer 1',
    category: 'CONCRETE_MIXER',
    make: 'Kirloskar',
    model: '10/7 cft',
    year: 2020,
    cost: '450000.00',
    meterType: 'NONE',
    meter: '0',
    ratePerDay: '3500.00',
    isVehicle: false,
    status: 'IN_USE',
  },
  {
    name: 'Concrete mixer 2',
    category: 'CONCRETE_MIXER',
    make: 'Kirloskar',
    model: '10/7 cft',
    year: 2017,
    cost: '380000.00',
    meterType: 'NONE',
    meter: '0',
    ratePerDay: '3500.00',
    isVehicle: false,
    status: 'UNDER_REPAIR',
  },
  {
    name: 'Water bowser',
    category: 'WATER_BOWSER',
    make: 'Isuzu',
    model: 'NPR 4000 L',
    reg: 'NC LF-8854',
    year: 2013,
    cost: '5200000.00',
    meterType: 'KM',
    meter: '187600',
    interval: '5000',
    lastService: '185000',
    ratePerDay: '9000.00',
    isVehicle: true,
  },
  {
    name: 'Generator 25 kVA',
    category: 'GENERATOR',
    make: 'Denyo',
    model: 'DCA-25',
    year: 2018,
    cost: '1650000.00',
    meterType: 'HOURS',
    meter: '3120',
    interval: '250',
    lastService: '2950',
    ratePerHour: '1200.00',
    isVehicle: false,
  },
  {
    name: 'Plate compactor (vibrator)',
    category: 'COMPACTOR',
    make: 'Mikasa',
    model: 'MVC-88',
    year: 2021,
    cost: '285000.00',
    meterType: 'NONE',
    meter: '0',
    ratePerDay: '2500.00',
    isVehicle: false,
  },
];

const SUPPLIERS: {
  name: string;
  type: SupplierType;
  phone: string;
  address: string;
  notes?: string;
}[] = [
  {
    name: 'Polonnaruwa Cement Distributors',
    type: 'MATERIAL',
    phone: '027 222 4410',
    address: 'Main Street, Kaduruwela',
    notes: 'Cement and blocks. 30 days credit.',
  },
  {
    name: 'Lanka Hardware Stores',
    type: 'HARDWARE',
    phone: '027 222 5521',
    address: 'Batticaloa Road, Kaduruwela',
  },
  {
    name: 'Mahaweli Sand & Metal Suppliers',
    type: 'MATERIAL',
    phone: '071 330 4455',
    address: 'Manampitiya Road, Polonnaruwa',
    notes: 'Sand, metal and ABC by the cube; delivers to site.',
  },
  {
    name: 'Kaduruwela Filling Station',
    type: 'FUEL',
    phone: '027 222 3399',
    address: 'Kaduruwela junction',
  },
  {
    name: 'Raja Tyre House',
    type: 'OTHER',
    phone: '027 222 6677',
    address: 'New Town, Polonnaruwa',
  },
  {
    name: 'Siripala Electrical Contractors',
    type: 'SUBCONTRACTOR',
    phone: '077 556 1122',
    address: 'Hingurakgoda',
    notes: 'Electrical wiring subcontractor.',
  },
  {
    name: 'Nuwara Machinery Hire',
    type: 'EQUIPMENT_HIRE',
    phone: '070 889 2233',
    address: 'Medirigiriya',
    notes: 'Hires rollers and a motor grader.',
  },
  {
    name: 'Weerasinghe Timber Depot',
    type: 'MATERIAL',
    phone: '027 224 5566',
    address: 'Hingurakgoda Road, Minneriya',
  },
];

const MATERIALS: { name: string; si: string; unit: string; category: MaterialCategory }[] = [
  {
    name: 'Cement (50 kg bag)',
    si: 'සිමෙන්ති (කි.ග්‍රෑ. 50 මල්ල)',
    unit: 'bag',
    category: 'CEMENT',
  },
  { name: 'River sand', si: 'ගංගා වැලි', unit: 'cube', category: 'SAND' },
  { name: 'Quarry dust', si: 'ගල් කුඩු', unit: 'cube', category: 'SAND' },
  { name: 'Metal ¾"', si: 'ගල් ¾"', unit: 'cube', category: 'AGGREGATE' },
  { name: 'Metal 1½"', si: 'ගල් 1½"', unit: 'cube', category: 'AGGREGATE' },
  { name: 'ABC (aggregate base course)', si: 'ඒබීසී ගල්', unit: 'cube', category: 'AGGREGATE' },
  { name: 'Steel bar 10 mm', si: 'යකඩ කම්බි මි.මී. 10', unit: 'kg', category: 'STEEL' },
  { name: 'Steel bar 12 mm', si: 'යකඩ කම්බි මි.මී. 12', unit: 'kg', category: 'STEEL' },
  { name: 'Steel bar 16 mm', si: 'යකඩ කම්බි මි.මී. 16', unit: 'kg', category: 'STEEL' },
  { name: 'Binding wire', si: 'බැඳුම් කම්බි', unit: 'kg', category: 'STEEL' },
  { name: 'Cement block 6"', si: 'සිමෙන්ති ගඩොල් 6"', unit: 'nos', category: 'BRICKS_BLOCKS' },
  { name: 'Clay brick', si: 'ගඩොල්', unit: 'nos', category: 'BRICKS_BLOCKS' },
  { name: 'Formwork timber', si: 'කොන්ක්‍රීට් ලෑලි', unit: 'cu ft', category: 'TIMBER' },
  { name: 'Plywood sheet 12 mm', si: 'ප්ලයිවුඩ් තහඩු මි.මී. 12', unit: 'nos', category: 'TIMBER' },
  { name: 'Nails (assorted)', si: 'ඇණ', unit: 'kg', category: 'HARDWARE' },
  { name: 'PVC pipe 4"', si: 'පීවීසී බට 4"', unit: 'nos', category: 'HARDWARE' },
  { name: 'Roofing sheet (amano)', si: 'වහල තහඩු', unit: 'nos', category: 'HARDWARE' },
  { name: 'Emulsion paint', si: 'තීන්ත', unit: 'l', category: 'OTHER' },
  { name: 'Bitumen emulsion (CRS-1)', si: 'බිටුමන්', unit: 'l', category: 'OTHER' },
  { name: 'Diesel', si: 'ඩීසල්', unit: 'l', category: 'FUEL' },
  { name: 'Petrol', si: 'පෙට්‍රල්', unit: 'l', category: 'FUEL' },
];

// ─────────────────────────────── Seeding ───────────────────────────────

/** First day of the previous month, "YYYY-MM-DD". */
function firstOfLastMonth(today: string): string {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, '0')}-01`;
}

interface PlannedVersion {
  file: { name: string; data: Buffer };
  issue?: number;
  expiry?: number;
  note?: string;
}

interface PlannedDocument {
  ownerType: DocumentOwnerType;
  ownerId: string | null;
  category: DocumentCategory;
  title: string;
  description?: string;
  /** Oldest first; the last one is current. */
  versions: PlannedVersion[];
}

/**
 * Sample data for a fresh install (overview §10). Only called when SEED_SAMPLE_DATA=true and there
 * are no projects yet. Returns true when something was added.
 *
 * @param fresh true when the base seed just created the settings (a brand-new database). The
 *              company details are only replaced then, so the owner's own edits are never lost.
 * @param storage when given, placeholder documents (PDF/PNG) are uploaded too.
 */
export async function seedSampleData(
  prisma: PrismaClient,
  opts: { fresh: boolean; storage?: StorageService; today?: string },
): Promise<boolean> {
  const today = opts.today ?? todayInColombo();
  const day = (offset: number) => dayToDate(addDays(today, offset));
  const raiseDay = dayToDate(firstOfLastMonth(today));

  if (opts.fresh) {
    await prisma.setting.update({
      where: { key: 'company' },
      data: { value: JSON.parse(JSON.stringify(SAMPLE_COMPANY)) },
    });
  }
  if ((await prisma.project.count()) > 0) return opts.fresh;

  const ids = await prisma.$transaction(
    async (tx) => {
      const clientIds = new Map<string, string>();
      for (const { key, ...c } of CLIENTS) {
        const row = await tx.client.create({ data: c });
        clientIds.set(key, row.id);
      }

      const workerIds = new Map<string, string>();
      for (const [i, w] of WORKERS.entries()) {
        const code = `W-${String(i + 1).padStart(4, '0')}`;
        const joined = addDays(today, w.joined);
        const payField = w.type === 'DAILY' ? 'dailyRate' : 'monthlySalary';
        const rates = [{ effectiveFrom: dayToDate(joined), [payField]: w.pay }];
        if (w.raise) rates.push({ effectiveFrom: raiseDay, [payField]: w.raise });
        const row = await tx.worker.create({
          data: {
            code,
            fullName: w.name,
            nameSinhala: w.si,
            nic: w.nic ?? null,
            phone: w.phone,
            address: 'Polonnaruwa District',
            skill: w.skill,
            type: w.type,
            joinedDate: dayToDate(joined),
            epfNo: w.epfNo ?? null,
            bankName: w.type === 'PERMANENT' ? 'Bank of Ceylon – Polonnaruwa' : null,
            bankAccountNo: w.type === 'PERMANENT' ? `0081${String(234560 + i * 37)}` : null,
            rates: { create: rates },
          },
        });
        workerIds.set(code, row.id);
      }

      const projectIds = new Map<string, string>();
      const perYear = new Map<string, number>();
      // Codes in start-date order, numbered per start year.
      for (const p of [...PROJECTS].sort((a, b) => a.start - b.start)) {
        const year = addDays(today, p.start).slice(0, 4);
        const n = (perYear.get(year) ?? 0) + 1;
        perYear.set(year, n);
        const row = await tx.project.create({
          data: {
            code: `PRJ-${year}-${String(n).padStart(3, '0')}`,
            name: p.name,
            type: p.type,
            source: p.source,
            clientId: clientIds.get(p.client)!,
            status: p.status,
            location: p.location,
            description: p.description,
            contractValue: p.contractValue,
            contractNo: p.contractNo ?? null,
            tenderNo: p.tenderNo ?? null,
            startDate: day(p.start),
            plannedEndDate: day(p.end),
            actualEndDate: p.actualEnd !== undefined ? day(p.actualEnd) : null,
            retentionPct: '10',
            retentionCapPct: '5',
            advanceAmount: p.advanceAmount ?? '0',
            advanceRecoveryPct: p.advanceRecoveryPct ?? '0',
            dlpMonths: p.source === 'PRIVATE' ? 6 : 12,
            progressPct: p.progressPct ?? null,
            siteSupervisorWorkerId: p.supervisor ? workerIds.get(p.supervisor)! : null,
            budgetLines: {
              create: Object.entries(p.budget).map(([category, amount]) => ({
                category: category as BudgetCategory,
                amount,
              })),
            },
          },
        });
        projectIds.set(p.key, row.id);
      }

      const assetIds: string[] = [];
      for (const [i, a] of ASSETS.entries()) {
        const row = await tx.asset.create({
          data: {
            code: `AST-${String(i + 1).padStart(3, '0')}`,
            name: a.name,
            category: a.category,
            make: a.make,
            model: a.model,
            registrationNo: a.reg ?? null,
            yearOfManufacture: a.year,
            purchaseDate: dayToDate(`${a.year + 1}-03-15`),
            purchaseCost: a.cost,
            ownership: 'OWNED',
            status: a.status ?? 'AVAILABLE',
            meterType: a.meterType,
            currentMeter: a.meter,
            serviceIntervalMeter: a.interval ?? null,
            lastServiceMeter: a.lastService ?? null,
            internalRatePerHour: a.ratePerHour ?? null,
            internalRatePerDay: a.ratePerDay ?? null,
            isVehicle: a.isVehicle,
          },
        });
        assetIds.push(row.id);
      }

      const supplierIds: string[] = [];
      for (const [i, s] of SUPPLIERS.entries()) {
        const row = await tx.supplier.create({
          data: { ...s, code: `SUP-${String(i + 1).padStart(3, '0')}` },
        });
        supplierIds.push(row.id);
      }
      const materials = await tx.material.createManyAndReturn({
        data: MATERIALS.map((m) => ({
          name: m.name,
          nameSinhala: m.si,
          unit: m.unit,
          category: m.category,
        })),
      });
      const materialIds = new Map(materials.map((m) => [m.name, m.id]));

      return { projectIds, workerIds, assetIds, supplierIds, materialIds };
    },
    { timeout: 60_000 },
  );

  await seedOperations(prisma, ids, today, opts.storage);
  if (opts.storage) {
    await seedDocuments(prisma, opts.storage, today, ids);
  }
  return true;
}

/** Vehicle documents with expiries spread around today, project / company / worker documents. */
async function seedDocuments(
  prisma: PrismaClient,
  storage: StorageService,
  today: string,
  ids: { projectIds: Map<string, string>; workerIds: Map<string, string>; assetIds: string[] },
): Promise<void> {
  const pdf = (name: string, ...lines: string[]) => ({
    name,
    data: makePdf([...lines, '', 'SAMPLE DOCUMENT - for trying out the system']),
  });
  const docs: PlannedDocument[] = [];

  // Vehicle documents. Expiry offsets (days from today): a few expired, a few within 7 / 30 days,
  // most comfortably in the future.
  const vehicleExpiries: Record<number, Partial<Record<DocumentCategory, number>>> = {
    0: { REVENUE_LICENCE: 140, INSURANCE: 5, EMISSION_TEST: 210 }, // JCB 1
    1: { REVENUE_LICENCE: -12, INSURANCE: 260, EMISSION_TEST: 95 }, // JCB 2
    3: { REVENUE_LICENCE: 25, INSURANCE: 300, EMISSION_TEST: 170, FITNESS_CERTIFICATE: 3 }, // Tipper 1
    4: { REVENUE_LICENCE: 190, INSURANCE: 18, EMISSION_TEST: -3, FITNESS_CERTIFICATE: 120 }, // Tipper 2
    5: { REVENUE_LICENCE: 230, INSURANCE: 75, EMISSION_TEST: 330 }, // Double cab
    9: { REVENUE_LICENCE: 60, INSURANCE: 150, EMISSION_TEST: 28, FITNESS_CERTIFICATE: 200 }, // Bowser
  };
  const titles: Partial<Record<DocumentCategory, string>> = {
    REVENUE_LICENCE: 'Revenue licence',
    INSURANCE: 'Insurance',
    EMISSION_TEST: 'Emission test certificate',
    FITNESS_CERTIFICATE: 'Fitness certificate',
  };
  for (const [index, cats] of Object.entries(vehicleExpiries)) {
    const asset = ASSETS[Number(index)]!;
    const ownerId = ids.assetIds[Number(index)]!;
    for (const [category, expiry] of Object.entries(cats) as [DocumentCategory, number][]) {
      const title = `${titles[category]} – ${asset.reg}`;
      const file = (offset: number) =>
        pdf(
          `${category.toLowerCase()}-${asset.reg!.replace(/\W+/g, '')}.pdf`,
          titles[category]!,
          `Vehicle: ${asset.reg} (${asset.make} ${asset.model})`,
          `Valid until: ${addDays(today, offset)}`,
        );
      const versions: PlannedVersion[] =
        Number(index) === 3 && category === 'INSURANCE'
          ? [
              // Tipper 1 insurance: renewed twice → 3 versions
              {
                file: file(expiry - 730),
                issue: expiry - 1095,
                expiry: expiry - 730,
                note: 'First policy',
              },
              {
                file: file(expiry - 365),
                issue: expiry - 729,
                expiry: expiry - 365,
                note: 'Renewed',
              },
              { file: file(expiry), issue: expiry - 364, expiry, note: 'Renewed – new insurer' },
            ]
          : [{ file: file(expiry), issue: expiry - 364, expiry }];
      docs.push({ ownerType: 'ASSET', ownerId, category, title, versions });
    }
    docs.push({
      ownerType: 'ASSET',
      ownerId,
      category: 'REGISTRATION_BOOK',
      title: `Registration book – ${asset.reg}`,
      versions: [
        {
          file: pdf(
            'registration-book.pdf',
            'Certificate of registration',
            `Vehicle: ${asset.reg}`,
          ),
        },
      ],
    });
  }
  docs.push({
    ownerType: 'ASSET',
    ownerId: ids.assetIds[2]!,
    category: 'INSURANCE',
    title: 'Machinery insurance – Excavator',
    versions: [
      {
        file: pdf('excavator-insurance.pdf', 'Machinery insurance', 'Komatsu PC130-8'),
        issue: -100,
        expiry: 265,
      },
    ],
  });

  // Project documents
  const projectDocs: [string, DocumentCategory, string, string][] = [
    ['road', 'CONTRACT', 'Signed contract agreement', 'contract-agreement.pdf'],
    ['road', 'BOQ', 'Bill of quantities (priced)', 'boq-priced.pdf'],
    ['road', 'PLAN_DRAWING', 'Road plan and cross sections', 'road-plan.pdf'],
    ['school', 'CONTRACT', 'Contract agreement', 'contract.pdf'],
    ['school', 'PLAN_DRAWING', 'Architectural drawings – ground and first floor', 'drawings.pdf'],
    ['house', 'ESTIMATE', 'Approved estimate', 'estimate.pdf'],
    ['house', 'PLAN_DRAWING', 'House plan (approved by the Pradeshiya Sabha)', 'house-plan.pdf'],
    ['culvert', 'LETTER', 'Completion certificate letter', 'completion-letter.pdf'],
  ];
  for (const [key, category, title, file] of projectDocs) {
    const project = PROJECTS.find((p) => p.key === key)!;
    docs.push({
      ownerType: 'PROJECT',
      ownerId: ids.projectIds.get(key)!,
      category,
      title,
      versions: [{ file: pdf(file, title, project.name), issue: project.start - 10 }],
    });
  }
  // the house plan was revised once
  docs.at(-2)!.versions.unshift({
    file: pdf('house-plan-first.pdf', 'House plan - first draft', 'Kaduruwela'),
    issue: -140,
    note: 'First draft',
  });
  docs.at(-2)!.versions[1]!.note = 'Approved plan';

  // Company documents
  docs.push(
    {
      ownerType: 'COMPANY',
      ownerId: null,
      category: 'CIDA_REGISTRATION',
      title: 'CIDA registration – C5 (Building), C6 (Highways)',
      versions: [
        {
          file: pdf('cida-2025.pdf', 'CIDA registration certificate', 'Grade C5 / C6'),
          issue: -545,
          expiry: -180,
          note: 'Previous registration',
        },
        {
          file: pdf('cida-2026.pdf', 'CIDA registration certificate', 'Grade C5 / C6'),
          issue: -179,
          expiry: 186,
          note: 'Renewed',
        },
      ],
    },
    {
      ownerType: 'COMPANY',
      ownerId: null,
      category: 'CERTIFICATE',
      title: 'Business registration certificate',
      versions: [
        {
          file: pdf(
            'business-registration.pdf',
            'Certificate of incorporation',
            'Supun Construction (Pvt) Ltd',
          ),
          issue: -3000,
        },
      ],
    },
    {
      ownerType: 'COMPANY',
      ownerId: null,
      category: 'INSURANCE',
      title: "Contractor's all risk insurance",
      versions: [
        {
          file: pdf('car-insurance.pdf', "Contractor's all risk insurance"),
          issue: -320,
          expiry: 45,
        },
      ],
    },
  );

  // Worker NIC copies (small PNGs)
  const nicColours: [number, number, number][] = [
    [214, 226, 240],
    [226, 236, 214],
    [240, 228, 210],
    [232, 218, 236],
  ];
  for (const [i, code] of ['W-0001', 'W-0002', 'W-0019', 'W-0022'].entries()) {
    const worker = WORKERS[Number(code.slice(2)) - 1]!;
    docs.push({
      ownerType: 'WORKER',
      ownerId: ids.workerIds.get(code)!,
      category: 'NIC_COPY',
      title: `NIC copy – ${worker.name}`,
      versions: [{ file: { name: `nic-${code}.png`, data: makePng(320, 200, nicColours[i]!) } }],
    });
  }

  for (const d of docs) {
    const documentId = randomUUID();
    const versions: Prisma.DocumentVersionCreateWithoutDocumentInput[] = [];
    for (const [i, v] of d.versions.entries()) {
      const key = storageKeyFor(documentId, i + 1, v.file.name);
      const mimeType = v.file.name.endsWith('.png') ? 'image/png' : 'application/pdf';
      await storage.putObject({ key, body: v.file.data, contentType: mimeType });
      versions.push({
        versionNo: i + 1,
        storageKey: key,
        fileName: v.file.name,
        mimeType,
        sizeBytes: v.file.data.length,
        sha256: createHash('sha256').update(v.file.data).digest('hex'),
        issueDate: v.issue !== undefined ? dayToDate(addDays(today, v.issue)) : null,
        expiryDate: v.expiry !== undefined ? dayToDate(addDays(today, v.expiry)) : null,
        note: v.note ?? null,
        uploadedAt: new Date(Date.now() - (d.versions.length - i) * 86_400_000),
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.document.create({
        data: {
          id: documentId,
          ownerType: d.ownerType,
          ownerId: d.ownerId,
          category: d.category,
          title: d.title,
          description: d.description ?? null,
          versions: { create: versions },
        },
      });
      const current = await tx.documentVersion.findUniqueOrThrow({
        where: { documentId_versionNo: { documentId, versionNo: versions.length } },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { currentVersionId: current.id },
      });
    });
  }
}
