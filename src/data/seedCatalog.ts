/**
 * Static catalogues used to generate the demonstration dataset for the
 * EMOCOM Technologies and Consulting Ltd demo. The company profile reflects
 * EMOCOM's published services; every person, client, supplier, record and
 * figure below is invented for the demonstration.
 */
import type { AccessLevel, AssetCategory, ExpenseCategory, InventoryCategory } from '../types'

export const FIRST_NAMES = [
  'Adaeze', 'Tunde', 'Chiamaka', 'Ibrahim', 'Funmilayo', 'Emeka', 'Zainab', 'Olumide', 'Ngozi', 'Yusuf',
  'Kemi', 'Chidi', 'Aisha', 'Babatunde', 'Ifeoma', 'Musa', 'Temitope', 'Obinna', 'Halima', 'Segun',
  'Nneka', 'Kunle', 'Amaka', 'Sani', 'Bisi', 'Uche', 'Fatima', 'Femi', 'Chioma', 'Danladi',
  'Yetunde', 'Ikenna', 'Hauwa', 'Gbenga', 'Ebere', 'Abdul', 'Toyin', 'Nnamdi', 'Rukayat', 'Dayo',
  'Grace', 'Daniel', 'Esther', 'Samuel', 'Joy', 'David', 'Blessing', 'Michael',
]

export const LAST_NAMES = [
  'Okafor', 'Adeyemi', 'Bello', 'Okonkwo', 'Balogun', 'Eze', 'Abubakar', 'Ogunleye', 'Nwosu', 'Lawal',
  'Afolabi', 'Umeh', 'Danjuma', 'Oyelaran', 'Chukwu', 'Ibekwe', 'Adebayo', 'Obi', 'Suleiman', 'Akande',
  'Nwachukwu', 'Olatunji', 'Garba', 'Onyeka', 'Bakare', 'Etim', 'Usman', 'Ajayi', 'Okeke', 'Yakubu',
]

export const LOCATIONS = ['Lekki HQ', 'Ikeja Office', 'Abuja Office', 'Port Harcourt Office']

export interface DepartmentSeed {
  code: string
  name: string
  /** Short slug used in demo usernames, e.g. hod.sales */
  slug: string
  headcount: number
  titles: string[]
  headTitle: string
  avgMonthlyPayMajor: number
}

export const DEPARTMENT_SEEDS: DepartmentSeed[] = [
  { code: 'EXO', slug: 'executive', name: 'Executive Office', headcount: 5, headTitle: 'Managing Director & CEO', titles: ['Executive Director, Strategy', 'Executive Assistant', 'Corporate Communications Lead'], avgMonthlyPayMajor: 1_600_000 },
  { code: 'SBD', slug: 'sales', name: 'Sales & Business Development', headcount: 13, headTitle: 'Head of Sales & Business Development', titles: ['Account Manager', 'Business Development Executive', 'Presales Consultant', 'Bid & Proposal Officer'], avgMonthlyPayMajor: 650_000 },
  { code: 'ENG', slug: 'engineering', name: 'Solutions Engineering', headcount: 18, headTitle: 'Head of Solutions Engineering', titles: ['Network Engineer', 'Radio Communications Engineer', 'Microwave Engineer', 'Security Solutions Engineer', 'SCADA & Instrumentation Engineer', 'Field Technician'], avgMonthlyPayMajor: 720_000 },
  { code: 'MSS', slug: 'services', name: 'Managed Services & Support', headcount: 14, headTitle: 'Head of Managed Services', titles: ['NOC Engineer', 'Service Desk Analyst', 'Cloud Engineer', 'Managed Print Technician', 'Systems Administrator'], avgMonthlyPayMajor: 560_000 },
  { code: 'PMO', slug: 'projects', name: 'Projects & Delivery', headcount: 8, headTitle: 'Head of Projects & Delivery', titles: ['Project Manager', 'Project Coordinator', 'Site Supervisor'], avgMonthlyPayMajor: 640_000 },
  { code: 'FIN', slug: 'finance', name: 'Finance & Accounts', headcount: 7, headTitle: 'Head of Finance', titles: ['Accountant', 'Finance Officer', 'Accounts Payable Officer', 'Treasury Officer'], avgMonthlyPayMajor: 600_000 },
  { code: 'HRA', slug: 'hr', name: 'Human Resources & Admin', headcount: 6, headTitle: 'Head of HR & Admin', titles: ['HR Officer', 'Recruitment Specialist', 'Admin Officer', 'Payroll Officer'], avgMonthlyPayMajor: 520_000 },
  { code: 'PRL', slug: 'procurement', name: 'Procurement & Logistics', headcount: 8, headTitle: 'Head of Procurement & Logistics', titles: ['Procurement Officer', 'Store Keeper', 'Logistics Coordinator', 'Fleet Officer'], avgMonthlyPayMajor: 450_000 },
]

/**
 * Demo accounts, one per person, following EMOCOM's agreed account types.
 * `pick` chooses the person: the department head, or the n-th active staff member.
 */
export interface UserSeed {
  username: string
  level: AccessLevel
  departmentCode: string
  pick: 'head' | number
  /** Optional job title override so the account matches its role. */
  title?: string
}

export const USER_SEEDS: UserSeed[] = [
  { username: 'ceo', level: 'Main Admin', departmentCode: 'EXO', pick: 'head' },
  { username: 'admin', level: 'Secondary Admin', departmentCode: 'EXO', pick: 1, title: 'ERP & Systems Administrator' },
  { username: 'finance.manager', level: 'Finance', departmentCode: 'FIN', pick: 'head', title: 'Finance Manager' },
  { username: 'finance.accountant', level: 'Finance', departmentCode: 'FIN', pick: 1, title: 'Accountant' },
  { username: 'hr.manager', level: 'HR', departmentCode: 'HRA', pick: 'head', title: 'HR Manager' },
  { username: 'sales.exec', level: 'Sales', departmentCode: 'SBD', pick: 1, title: 'Account Manager' },
  { username: 'sales.bd', level: 'Sales', departmentCode: 'SBD', pick: 2, title: 'Business Development Executive' },
  { username: 'manager.sales', level: 'Manager', departmentCode: 'SBD', pick: 'head' },
  { username: 'manager.engineering', level: 'Manager', departmentCode: 'ENG', pick: 'head' },
  { username: 'manager.services', level: 'Manager', departmentCode: 'MSS', pick: 'head' },
  { username: 'manager.projects', level: 'Manager', departmentCode: 'PMO', pick: 'head' },
  { username: 'staff.presales', level: 'Staff', departmentCode: 'SBD', pick: 3, title: 'Presales Consultant' },
  { username: 'staff.engineering', level: 'Staff', departmentCode: 'ENG', pick: 1, title: 'Network Engineer' },
  { username: 'staff.services', level: 'Staff', departmentCode: 'MSS', pick: 1, title: 'NOC Engineer' },
  { username: 'staff.projects', level: 'Staff', departmentCode: 'PMO', pick: 1, title: 'Project Coordinator' },
]

export interface ItemSeed {
  name: string
  category: InventoryCategory
  unit: string
  unitCostMajor: number
  reorderLevel: number
  target: 'ok' | 'low' | 'out'
  supplierCode: string
}

export const ITEM_SEEDS: ItemSeed[] = [
  { name: 'Enterprise Wi-Fi Access Point', category: 'Networking & Wi-Fi', unit: 'unit', unitCostMajor: 285_000, reorderLevel: 10, target: 'ok', supplierCode: 'SUP-001' },
  { name: '24-Port PoE Managed Switch', category: 'Networking & Wi-Fi', unit: 'unit', unitCostMajor: 520_000, reorderLevel: 4, target: 'ok', supplierCode: 'SUP-001' },
  { name: 'SFP+ Fibre Module (10G)', category: 'Networking & Wi-Fi', unit: 'unit', unitCostMajor: 48_000, reorderLevel: 20, target: 'low', supplierCode: 'SUP-001' },
  { name: 'Cat6 Cable (305m box)', category: 'Networking & Wi-Fi', unit: 'box', unitCostMajor: 120_000, reorderLevel: 6, target: 'ok', supplierCode: 'SUP-001' },
  { name: 'Fibre Patch Cord (3m)', category: 'Networking & Wi-Fi', unit: 'piece', unitCostMajor: 6_500, reorderLevel: 50, target: 'ok', supplierCode: 'SUP-001' },
  { name: '42U Server Rack Cabinet', category: 'Networking & Wi-Fi', unit: 'unit', unitCostMajor: 780_000, reorderLevel: 2, target: 'out', supplierCode: 'SUP-001' },
  { name: 'TETRA Handheld Radio', category: 'Radio & Microwave', unit: 'unit', unitCostMajor: 650_000, reorderLevel: 8, target: 'low', supplierCode: 'SUP-002' },
  { name: 'Radio Battery Pack', category: 'Radio & Microwave', unit: 'piece', unitCostMajor: 38_000, reorderLevel: 30, target: 'ok', supplierCode: 'SUP-002' },
  { name: 'Base Station Antenna', category: 'Radio & Microwave', unit: 'unit', unitCostMajor: 210_000, reorderLevel: 3, target: 'ok', supplierCode: 'SUP-002' },
  { name: 'Microwave Link Antenna (0.6m)', category: 'Radio & Microwave', unit: 'unit', unitCostMajor: 950_000, reorderLevel: 2, target: 'out', supplierCode: 'SUP-002' },
  { name: 'Lightning Arrestor Kit', category: 'Radio & Microwave', unit: 'kit', unitCostMajor: 45_000, reorderLevel: 10, target: 'ok', supplierCode: 'SUP-002' },
  { name: 'IP CCTV Dome Camera (4MP)', category: 'Security & CCTV', unit: 'unit', unitCostMajor: 145_000, reorderLevel: 15, target: 'ok', supplierCode: 'SUP-003' },
  { name: 'Network Video Recorder (16-ch)', category: 'Security & CCTV', unit: 'unit', unitCostMajor: 620_000, reorderLevel: 3, target: 'ok', supplierCode: 'SUP-003' },
  { name: 'Access Control Card Reader', category: 'Security & CCTV', unit: 'unit', unitCostMajor: 95_000, reorderLevel: 8, target: 'low', supplierCode: 'SUP-003' },
  { name: 'Next-Gen Firewall Appliance', category: 'Security & CCTV', unit: 'unit', unitCostMajor: 2_400_000, reorderLevel: 2, target: 'ok', supplierCode: 'SUP-003' },
  { name: 'SCADA RTU Module', category: 'SCADA & Instrumentation', unit: 'unit', unitCostMajor: 1_850_000, reorderLevel: 2, target: 'ok', supplierCode: 'SUP-004' },
  { name: 'Pressure Transmitter', category: 'SCADA & Instrumentation', unit: 'unit', unitCostMajor: 420_000, reorderLevel: 6, target: 'ok', supplierCode: 'SUP-004' },
  { name: 'Flow Meter Sensor', category: 'SCADA & Instrumentation', unit: 'unit', unitCostMajor: 560_000, reorderLevel: 4, target: 'low', supplierCode: 'SUP-004' },
  { name: 'Industrial Ethernet Switch', category: 'SCADA & Instrumentation', unit: 'unit', unitCostMajor: 690_000, reorderLevel: 3, target: 'ok', supplierCode: 'SUP-004' },
  { name: 'GPS Vehicle Tracker', category: 'Fleet Telematics', unit: 'unit', unitCostMajor: 85_000, reorderLevel: 25, target: 'ok', supplierCode: 'SUP-005' },
  { name: 'Fuel Level Sensor', category: 'Fleet Telematics', unit: 'unit', unitCostMajor: 110_000, reorderLevel: 10, target: 'ok', supplierCode: 'SUP-005' },
  { name: 'Driver ID Tag Reader', category: 'Fleet Telematics', unit: 'unit', unitCostMajor: 32_000, reorderLevel: 15, target: 'out', supplierCode: 'SUP-005' },
  { name: 'MPS Toner Cartridge (Black)', category: 'Print & Consumables', unit: 'piece', unitCostMajor: 78_000, reorderLevel: 20, target: 'ok', supplierCode: 'SUP-006' },
  { name: 'MPS Toner Cartridge (Colour)', category: 'Print & Consumables', unit: 'piece', unitCostMajor: 96_000, reorderLevel: 12, target: 'low', supplierCode: 'SUP-006' },
  { name: 'Printer Drum Unit', category: 'Print & Consumables', unit: 'piece', unitCostMajor: 145_000, reorderLevel: 5, target: 'ok', supplierCode: 'SUP-006' },
  { name: 'A4 Copier Paper (ream)', category: 'Print & Consumables', unit: 'ream', unitCostMajor: 6_500, reorderLevel: 80, target: 'ok', supplierCode: 'SUP-006' },
  { name: 'Online UPS 3kVA', category: 'Power & Accessories', unit: 'unit', unitCostMajor: 950_000, reorderLevel: 3, target: 'ok', supplierCode: 'SUP-007' },
  { name: 'Inverter Battery 200Ah', category: 'Power & Accessories', unit: 'unit', unitCostMajor: 310_000, reorderLevel: 8, target: 'ok', supplierCode: 'SUP-007' },
  { name: 'Surge Protector Strip', category: 'Power & Accessories', unit: 'piece', unitCostMajor: 18_000, reorderLevel: 20, target: 'ok', supplierCode: 'SUP-007' },
  { name: 'Safety Helmet', category: 'Field Safety', unit: 'piece', unitCostMajor: 9_500, reorderLevel: 20, target: 'ok', supplierCode: 'SUP-008' },
  { name: 'Full-body Climbing Harness', category: 'Field Safety', unit: 'piece', unitCostMajor: 85_000, reorderLevel: 6, target: 'low', supplierCode: 'SUP-008' },
  { name: 'Hi-Visibility Vest', category: 'Field Safety', unit: 'piece', unitCostMajor: 4_000, reorderLevel: 25, target: 'ok', supplierCode: 'SUP-008' },
  { name: 'First Aid Kit', category: 'Field Safety', unit: 'kit', unitCostMajor: 22_000, reorderLevel: 6, target: 'ok', supplierCode: 'SUP-008' },
]

export interface AssetModelSeed {
  name: string
  category: AssetCategory
  costMajor: number
  count: number
  prefix: string
}

export const ASSET_MODEL_SEEDS: AssetModelSeed[] = [
  { name: 'Dell Latitude 5440 Laptop', category: 'Laptop', costMajor: 1_450_000, count: 9, prefix: 'DL' },
  { name: 'HP EliteBook 840 G10 Laptop', category: 'Laptop', costMajor: 1_680_000, count: 6, prefix: 'HP' },
  { name: 'Apple MacBook Air 13" Laptop', category: 'Laptop', costMajor: 2_150_000, count: 3, prefix: 'AP' },
  { name: 'Dell P2422H 24" Monitor', category: 'Monitor', costMajor: 285_000, count: 8, prefix: 'DM' },
  { name: 'Fibre Optic Fusion Splicer', category: 'Test Equipment', costMajor: 4_800_000, count: 2, prefix: 'FS' },
  { name: 'OTDR Fibre Tester', category: 'Test Equipment', costMajor: 6_500_000, count: 2, prefix: 'OT' },
  { name: 'RF Spectrum Analyser', category: 'Test Equipment', costMajor: 9_200_000, count: 1, prefix: 'SA' },
  { name: 'Network Cable Certifier', category: 'Test Equipment', costMajor: 3_600_000, count: 2, prefix: 'CC' },
  { name: 'Samsung Galaxy A55 (Company Phone)', category: 'Phone', costMajor: 520_000, count: 4, prefix: 'SG' },
  { name: 'Multifunction Office Printer', category: 'Printer', costMajor: 760_000, count: 3, prefix: 'MF' },
  { name: 'Executive Office Desk', category: 'Furniture', costMajor: 420_000, count: 3, prefix: 'FD' },
  { name: 'Toyota Hilux (Field Service)', category: 'Vehicle', costMajor: 48_500_000, count: 3, prefix: 'TH' },
  { name: 'Toyota Hiace (Installation Van)', category: 'Vehicle', costMajor: 52_000_000, count: 1, prefix: 'TV' },
]

export const SUPPLIER_SEEDS = [
  { code: 'SUP-001', name: 'Lagoon Networks Distribution', category: 'Networking & Wi-Fi', city: 'Lagos' },
  { code: 'SUP-002', name: 'Atlantic Radio Systems Ltd', category: 'Radio & Microwave', city: 'Lagos' },
  { code: 'SUP-003', name: 'Sentinel Security Supplies', category: 'Security & CCTV', city: 'Abuja' },
  { code: 'SUP-004', name: 'Delta Instrumentation Services', category: 'SCADA & Instrumentation', city: 'Port Harcourt' },
  { code: 'SUP-005', name: 'TrackPoint Telematics Ltd', category: 'Fleet Telematics', city: 'Lagos' },
  { code: 'SUP-006', name: 'Marina Print & Imaging', category: 'Print & Consumables', city: 'Lagos' },
  { code: 'SUP-007', name: 'Kainji Power Systems', category: 'Power & Energy', city: 'Ibadan' },
  { code: 'SUP-008', name: 'Zuma Safety Gear Ltd', category: 'Field Safety', city: 'Abuja' },
  { code: 'SUP-009', name: 'Cedarwood Furniture Works', category: 'Furniture', city: 'Enugu' },
  { code: 'SUP-010', name: 'BrightPath Logistics', category: 'Logistics & Haulage', city: 'Port Harcourt' },
  { code: 'SUP-011', name: 'Vertex Computer Distribution', category: 'Computers & Software Licences', city: 'Lagos' },
  { code: 'SUP-012', name: 'Atlantic Fleet Services', category: 'Vehicle Maintenance', city: 'Lagos' },
]

/** Fictional clients in the sectors EMOCOM serves. */
export const CUSTOMER_SEEDS = [
  { name: 'Harbourline Bank Plc', city: 'Lagos' },
  { name: 'Niger Delta Pipelines Ltd', city: 'Port Harcourt' },
  { name: 'Lagoon Broadcasting Network', city: 'Lagos' },
  { name: 'Savannah Cement Manufacturing', city: 'Lokoja' },
  { name: 'Meridian Health Clinics', city: 'Abuja' },
  { name: 'Northgate Logistics Ltd', city: 'Kaduna' },
  { name: 'Crestwave Telecom Services', city: 'Lagos' },
  { name: 'Riverbend Energy Services', city: 'Warri' },
  { name: 'Sunrise Foods & Beverages', city: 'Ibadan' },
  { name: 'Keystone Microfinance Bank', city: 'Enugu' },
]

/** EMOCOM's published service lines, used as invoice descriptions. */
export const INVOICE_SERVICES = [
  { description: 'Enterprise network & Wi-Fi deployment' },
  { description: 'TETRA radio deployment & commissioning' },
  { description: 'Microwave link installation' },
  { description: 'Managed print services — monthly' },
  { description: 'Fleet management subscription' },
  { description: 'SCADA telemetry & pipeline monitoring support' },
  { description: 'Security monitoring retainer' },
  { description: 'Cloud migration project milestone' },
  { description: 'Business intelligence implementation' },
  { description: 'Document & records management' },
]

export const RECURRING_EXPENSES: {
  category: ExpenseCategory
  description: string
  payee: string
  departmentCode: string
  minMajor: number
  maxMajor: number
  probability: number
}[] = [
  { category: 'Rent & Utilities', description: 'Office rent — Lekki HQ', payee: 'Carlton Property Managers (Demo)', departmentCode: 'HRA', minMajor: 6_500_000, maxMajor: 6_500_000, probability: 1 },
  { category: 'Rent & Utilities', description: 'Electricity & diesel', payee: 'Kainji Power Systems', departmentCode: 'HRA', minMajor: 1_800_000, maxMajor: 3_400_000, probability: 1 },
  { category: 'Licences & Cloud', description: 'Cloud platform subscriptions', payee: 'Vertex Computer Distribution', departmentCode: 'MSS', minMajor: 1_400_000, maxMajor: 2_600_000, probability: 1 },
  { category: 'Licences & Cloud', description: 'NOC monitoring & ITSM tools licence', payee: 'Vertex Computer Distribution', departmentCode: 'MSS', minMajor: 950_000, maxMajor: 950_000, probability: 1 },
  { category: 'Licences & Cloud', description: 'Dedicated internet bandwidth', payee: 'Crestwave Telecom Services', departmentCode: 'MSS', minMajor: 850_000, maxMajor: 850_000, probability: 1 },
  { category: 'Marketing', description: 'Industry event & digital campaign', payee: 'Palmview Media (Demo)', departmentCode: 'SBD', minMajor: 1_200_000, maxMajor: 4_200_000, probability: 0.8 },
  { category: 'Travel', description: 'Client visits & presales travel', payee: 'Various', departmentCode: 'SBD', minMajor: 450_000, maxMajor: 1_900_000, probability: 0.9 },
  { category: 'Field Operations', description: 'Site deployment logistics', payee: 'BrightPath Logistics', departmentCode: 'ENG', minMajor: 900_000, maxMajor: 3_200_000, probability: 0.95 },
  { category: 'Field Operations', description: 'Project site allowances', payee: 'Staff allowances', departmentCode: 'PMO', minMajor: 600_000, maxMajor: 1_800_000, probability: 0.85 },
  { category: 'Field Operations', description: 'Fleet fuel & maintenance', payee: 'Atlantic Fleet Services', departmentCode: 'PRL', minMajor: 700_000, maxMajor: 1_600_000, probability: 1 },
  { category: 'Professional Fees', description: 'Audit & legal retainer', payee: 'Obudu Consulting Partners (Demo)', departmentCode: 'FIN', minMajor: 1_200_000, maxMajor: 1_200_000, probability: 1 },
  { category: 'Training', description: 'OEM certification training', payee: 'Various', departmentCode: 'ENG', minMajor: 500_000, maxMajor: 2_400_000, probability: 0.55 },
  { category: 'Training', description: 'Staff development programme', payee: 'Various', departmentCode: 'HRA', minMajor: 300_000, maxMajor: 1_200_000, probability: 0.4 },
]

export interface PRTemplate {
  title: string
  departmentCode: string
  itemNames?: string[]
  serviceLine?: { description: string; priceMajor: number; quantity?: number }
  supplierCode: string
}

export const PR_TEMPLATES: PRTemplate[] = [
  { title: 'Wi-Fi rollout stock for bank branches', departmentCode: 'ENG', itemNames: ['Enterprise Wi-Fi Access Point', '24-Port PoE Managed Switch', 'Cat6 Cable (305m box)'], supplierCode: 'SUP-001' },
  { title: 'Fibre modules and patch cords', departmentCode: 'ENG', itemNames: ['SFP+ Fibre Module (10G)', 'Fibre Patch Cord (3m)'], supplierCode: 'SUP-001' },
  { title: 'TETRA radios for pipeline client', departmentCode: 'ENG', itemNames: ['TETRA Handheld Radio', 'Radio Battery Pack'], supplierCode: 'SUP-002' },
  { title: 'Microwave link materials', departmentCode: 'ENG', itemNames: ['Microwave Link Antenna (0.6m)', 'Lightning Arrestor Kit'], supplierCode: 'SUP-002' },
  { title: 'CCTV and NVR for client site', departmentCode: 'PMO', itemNames: ['IP CCTV Dome Camera (4MP)', 'Network Video Recorder (16-ch)'], supplierCode: 'SUP-003' },
  { title: 'Firewalls for managed security client', departmentCode: 'MSS', itemNames: ['Next-Gen Firewall Appliance'], supplierCode: 'SUP-003' },
  { title: 'SCADA spares for pipeline monitoring', departmentCode: 'ENG', itemNames: ['SCADA RTU Module', 'Pressure Transmitter'], supplierCode: 'SUP-004' },
  { title: 'Flow meters for telemetry upgrade', departmentCode: 'PMO', itemNames: ['Flow Meter Sensor', 'Industrial Ethernet Switch'], supplierCode: 'SUP-004' },
  { title: 'GPS trackers for fleet management client', departmentCode: 'MSS', itemNames: ['GPS Vehicle Tracker', 'Fuel Level Sensor'], supplierCode: 'SUP-005' },
  { title: 'Managed print toner restock', departmentCode: 'MSS', itemNames: ['MPS Toner Cartridge (Black)', 'MPS Toner Cartridge (Colour)', 'Printer Drum Unit'], supplierCode: 'SUP-006' },
  { title: 'UPS and batteries for the NOC', departmentCode: 'MSS', itemNames: ['Online UPS 3kVA', 'Inverter Battery 200Ah'], supplierCode: 'SUP-007' },
  { title: 'Safety gear for tower climbs', departmentCode: 'ENG', itemNames: ['Full-body Climbing Harness', 'Safety Helmet', 'Hi-Visibility Vest'], supplierCode: 'SUP-008' },
  { title: 'Office furniture for new Lekki wing', departmentCode: 'HRA', serviceLine: { description: 'Workstation desks with pedestals', priceMajor: 265_000 }, supplierCode: 'SUP-009' },
  { title: 'Equipment haulage to Port Harcourt', departmentCode: 'PRL', serviceLine: { description: 'Haulage trips (Lagos–Port Harcourt)', priceMajor: 950_000 }, supplierCode: 'SUP-010' },
  { title: 'Demo kit for client presentations', departmentCode: 'SBD', itemNames: ['Enterprise Wi-Fi Access Point', '24-Port PoE Managed Switch'], supplierCode: 'SUP-001' },
  { title: 'Copier paper for head office', departmentCode: 'HRA', itemNames: ['A4 Copier Paper (ream)'], supplierCode: 'SUP-006' },
  { title: 'Fleet vehicle servicing', departmentCode: 'PRL', serviceLine: { description: 'Vehicle service (per vehicle)', priceMajor: 420_000 }, supplierCode: 'SUP-012' },
  { title: 'Bid documents printing & courier', departmentCode: 'SBD', serviceLine: { description: 'Tender document printing & delivery', priceMajor: 180_000 }, supplierCode: 'SUP-010' },
]

export const REJECTION_REASONS = [
  'Budget for this quarter already committed. Resubmit next quarter.',
  'Please obtain at least two additional supplier quotations.',
  'Quantities exceed current project needs; reduce and resubmit.',
  'Duplicate of an existing approved request.',
]
