import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sequelize, initSchema  } from './db/index.js';
import { 
  Ward, 
  Staff, 
  Shift, 
  Patient, 
  AccessLog, 
  ChainAnchor 
} from './models/index.js';

// WARNING: Hardcoded password "password123" is for local testing and demonstration only.
const TEST_PASSWORD = 'password123';
const SALT_ROUNDS = 10;

export async function seedDatabase() {
  console.log('--- Initializing Sequelize schema with PostgreSQL ---');
  await initSchema();

  console.log('--- Clearing existing tables ---');
  // Clear records in order respecting constraints
  await ChainAnchor.destroy({ where: {}, truncate: false });
  await AccessLog.destroy({ where: {}, truncate: false });
  await Shift.destroy({ where: {}, truncate: false });
  await Patient.destroy({ where: {}, truncate: false });
  await Staff.destroy({ where: {}, truncate: false });
  await Ward.destroy({ where: {}, truncate: false });

  console.log('--- Seeding 5 Wards via Sequelize ---');
  const wardsData = [
    { id: 1, name: 'Ward 1' },
    { id: 2, name: 'Ward 2' },
    { id: 3, name: 'Ward 3' },
    { id: 4, name: 'ICU' },
    { id: 5, name: 'Maternity' }
  ];
  await Ward.bulkCreate(wardsData);

  const passwordHash = bcrypt.hashSync(TEST_PASSWORD, SALT_ROUNDS);
  const now = new Date();

  const staffMembers = [
    { id: 'doc-meredith-grey', name: 'Dr. Meredith Grey', email: 'meredith.grey@hospital.example', role: 'doctor', default_ward: 'Ward 1', initial_ward_id: 1 },
    { id: 'doc-cristina-yang', name: 'Dr. Cristina Yang', email: 'cristina.yang@hospital.example', role: 'doctor', default_ward: 'ICU', initial_ward_id: 4 },
    { id: 'doc-alex-karev', name: 'Dr. Alex Karev', email: 'alex.karev@hospital.example', role: 'doctor', default_ward: 'Ward 2', initial_ward_id: 2 },
    { id: 'doc-addison-montgomery', name: 'Dr. Addison Montgomery', email: 'addison.montgomery@hospital.example', role: 'doctor', default_ward: 'Maternity', initial_ward_id: 5 },
    { id: 'nurse-carol-hathaway', name: 'Nurse Carol Hathaway', email: 'carol.hathaway@hospital.example', role: 'nurse', default_ward: 'Ward 1', initial_ward_id: 1 },
    { id: 'nurse-jackie-peyton', name: 'Nurse Jackie Peyton', email: 'jackie.peyton@hospital.example', role: 'nurse', default_ward: 'Ward 2', initial_ward_id: 2 },
    { id: 'nurse-charlyne-yi', name: 'Nurse Charlyne Yi', email: 'charlyne.yi@hospital.example', role: 'nurse', default_ward: 'Ward 3', initial_ward_id: 3 },
    { id: 'clerk-pam-beesly', name: 'Clerk Pam Beesly', email: 'pam.beesly@hospital.example', role: 'clerk', default_ward: 'Ward 1', initial_ward_id: 1 },
    { id: 'admin-miranda-bailey', name: 'Admin Miranda Bailey', email: 'miranda.bailey@hospital.example', role: 'admin', default_ward: 'ICU', initial_ward_id: 4 },
    { id: 'admin-richard-webber', name: 'Admin Richard Webber', email: 'richard.webber@hospital.example', role: 'admin', default_ward: 'Ward 3', initial_ward_id: 3 }
  ];

  const staffToCreate = staffMembers.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    default_ward: s.default_ward,
    password_hash: passwordHash,
    created_at: now
  }));
  await Staff.bulkCreate(staffToCreate);

  const shiftsToCreate = staffMembers.map((s) => ({
    id: crypto.randomUUID(),
    staff_id: s.id,
    ward_id: s.initial_ward_id,
    start_time: now,
    end_time: null
  }));
  for (const shift of shiftsToCreate) {
    await Shift.create(shift);
  }

  const rawPatients = [
    { id: 'pat-101', name: 'Eleanor Vance', dob: '1982-04-14', ward_id: 1, diagnosis: 'Acute Appendicitis (Pre-Op)' },
    { id: 'pat-102', name: 'Arthur Pendelton', dob: '1965-11-23', ward_id: 1, diagnosis: 'Community-Acquired Pneumonia' },
    { id: 'pat-103', name: 'Clara Oswald', dob: '1990-07-09', ward_id: 1, diagnosis: 'Closed Tibia Fracture' },
    { id: 'pat-104', name: 'Donald Draper', dob: '1958-03-01', ward_id: 1, diagnosis: 'Exacerbation of COPD' },
    { id: 'pat-105', name: 'Fiona Gallagher', dob: '1995-12-18', ward_id: 1, diagnosis: 'Severe Dehydration & Gastroenteritis' },
    { id: 'pat-106', name: 'George Bailey', dob: '1974-09-03', ward_id: 1, diagnosis: 'Deep Vein Thrombosis' },

    { id: 'pat-107', name: 'Harold Finch', dob: '1961-02-17', ward_id: 2, diagnosis: 'Type 2 Diabetes Hyperglycemia' },
    { id: 'pat-108', name: 'Iris West', dob: '1988-10-05', ward_id: 2, diagnosis: 'Acute Cholecystitis' },
    { id: 'pat-109', name: 'James Holden', dob: '1979-05-12', ward_id: 2, diagnosis: 'Post-Concussion Observation' },
    { id: 'pat-110', name: 'Kelly Severide', dob: '1984-08-30', ward_id: 2, diagnosis: 'Smoke Inhalation Treatment' },
    { id: 'pat-111', name: 'Luke Danes', dob: '1968-11-15', ward_id: 2, diagnosis: 'Atrial Fibrillation with RVR' },
    { id: 'pat-112', name: 'Mona Vanderwaal', dob: '1994-06-22', ward_id: 2, diagnosis: 'Migraine with Aura & intractable vomiting' },

    { id: 'pat-113', name: 'Nathan Drake', dob: '1981-01-20', ward_id: 3, diagnosis: 'Multiple Soft Tissue Contusions' },
    { id: 'pat-114', name: 'Olivia Dunham', dob: '1983-09-14', ward_id: 3, diagnosis: 'Pyelonephritis' },
    { id: 'pat-115', name: 'Peter Bishop', dob: '1978-04-03', ward_id: 3, diagnosis: 'Peripheral Neuropathy Flare' },
    { id: 'pat-116', name: 'Quinn Fabray', dob: '1993-07-29', ward_id: 3, diagnosis: 'Post-Op Knee Arthroscopy' },
    { id: 'pat-117', name: 'Raymond Reddington', dob: '1960-02-07', ward_id: 3, diagnosis: 'Chronic Anemia Evaluation' },
    { id: 'pat-118', name: 'Samantha Carter', dob: '1972-12-29', ward_id: 3, diagnosis: 'Electrolyte Imbalance' },

    { id: 'pat-119', name: 'Thomas Shelby', dob: '1970-08-11', ward_id: 4, diagnosis: 'Septic Shock (Vasopressor dependent)' },
    { id: 'pat-120', name: 'Ursula Buffay', dob: '1967-03-25', ward_id: 4, diagnosis: 'Post-Cardiac Arrest Monitoring' },
    { id: 'pat-121', name: 'Victor Fries', dob: '1959-10-19', ward_id: 4, diagnosis: 'Acute Respiratory Distress Syndrome (ARDS)' },
    { id: 'pat-122', name: 'Wendy Byrde', dob: '1973-11-04', ward_id: 4, diagnosis: 'Severe Traumatic Brain Injury' },
    { id: 'pat-123', name: 'Xander Harris', dob: '1980-05-16', ward_id: 4, diagnosis: 'Bowel Perforation with Peritonitis' },
    { id: 'pat-124', name: 'Yvaine Storm', dob: '1992-01-08', ward_id: 4, diagnosis: 'Status Epilepticus' },

    { id: 'pat-125', name: 'Zoe Washburne', dob: '1986-06-19', ward_id: 5, diagnosis: 'Active Labor, 39 Weeks Gestation' },
    { id: 'pat-126', name: 'Amy Pond', dob: '1989-11-02', ward_id: 5, diagnosis: 'Postpartum Observation (Day 1)' },
    { id: 'pat-127', name: 'Beverly Crusher', dob: '1975-10-13', ward_id: 5, diagnosis: 'Preeclampsia with Severe Features' },
    { id: 'pat-128', name: 'Dana Scully', dob: '1964-02-23', ward_id: 5, diagnosis: 'Hyperemesis Gravidarum' },
    { id: 'pat-129', name: 'Elena Gilbert', dob: '1992-06-22', ward_id: 5, diagnosis: 'Scheduled Cesarean Section (Post-Op)' },
    { id: 'pat-130', name: 'Frasier Crane', dob: '1987-03-15', ward_id: 5, diagnosis: 'Preterm Premature Rupture of Membranes' }
  ];

  const patientsToCreate = rawPatients.map((p, i) => {
    const admissionHoursAgo = (i + 1) * 4;
    const admittedAt = new Date(Date.now() - admissionHoursAgo * 3600 * 1000);
    return {
      id: p.id,
      name: p.name,
      dob: p.dob,
      ward_id: p.ward_id,
      diagnosis: p.diagnosis,
      admitted_at: admittedAt
    };
  });
  await Patient.bulkCreate(patientsToCreate);

  console.log('--- Database seeding complete ---');
  console.log('Summary:');
  console.log(`- 5 Wards created`);
  console.log(`- 10 Staff created with active shifts (Default password: ${TEST_PASSWORD})`);
  console.log(`- 30 Patients created across 5 wards`);
  console.log(`- access_logs and chain_anchors left empty for organic logging`);
}

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => {
      console.log('PostgreSQL / Sequelize database seeded successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}
