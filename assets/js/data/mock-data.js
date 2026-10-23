/**
 * Care-OAU - Central Mock Data Engine
 * Realistic initial mock data for Obafemi Awolowo University Health Centre.
 * Persisted in browser localStorage to simulate live backend interactions.
 */

export const INITIAL_SERVICES = [
  {
    id: 'srv_gen_med',
    name: 'General Medical Consultation',
    description: 'Outpatient consultations for general illnesses, malaria, typhoid, infections and routine diagnoses.',
    category: 'General Outpatient',
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    startTime: '08:00',
    endTime: '20:00',
    dailyCapacity: 80,
    requiresReferral: false,
    isActive: true
  },
  {
    id: 'srv_dent',
    name: 'Dental Care & Surgery',
    description: 'Tooth extractions, dental hygiene, scaling and polishing, cavity fillings and oral healthcare.',
    category: 'Specialist Clinic',
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: '09:00',
    endTime: '15:00',
    dailyCapacity: 25,
    requiresReferral: false,
    isActive: true
  },
  {
    id: 'srv_opt',
    name: 'Optometry & Eye Clinic',
    description: 'Vision screening, refraction tests, eye infection treatment and corrective prescription glasses.',
    category: 'Specialist Clinic',
    operatingDays: ['Tuesday', 'Thursday'],
    startTime: '09:00',
    endTime: '14:00',
    dailyCapacity: 30,
    requiresReferral: false,
    isActive: true
  },
  {
    id: 'srv_lab',
    name: 'Diagnostic Laboratory Services',
    description: 'Blood counts (FBC), genotype, blood group, urinalysis, Widal test, malaria microscopy.',
    category: 'Diagnostics',
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    startTime: '08:00',
    endTime: '18:00',
    dailyCapacity: 120,
    requiresReferral: true,
    isActive: true
  },
  {
    id: 'srv_mental',
    name: 'Student Mental Health & Counselling',
    description: 'Confidential psychological counselling, stress management, anxiety and academic wellness guidance.',
    category: 'Mental Wellness',
    operatingDays: ['Monday', 'Wednesday', 'Friday'],
    startTime: '10:00',
    endTime: '16:00',
    dailyCapacity: 20,
    requiresReferral: false,
    isActive: true
  }
];

export const INITIAL_DOCTORS = [
  { id: 'doc_lab', name: 'Dr. Mariam Sule', title: 'Diagnostic Services', specialization: 'Diagnostic Laboratory Services', serviceId: 'srv_lab', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], startTime: '08:00', endTime: '15:00', dailyCapacity: 30, currentLoad: 0, isAvailable: true, room: 'Laboratory' },
  {
    id: 'doc_01',
    name: 'Dr. O. A. Adeleke',
    title: 'Senior Medical Officer',
    specialization: 'General Medical Consultation',
    serviceId: 'srv_gen_med',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: '08:00',
    endTime: '16:00',
    dailyCapacity: 25,
    currentLoad: 12,
    isAvailable: true,
    room: 'Consulting Room 2'
  },
  {
    id: 'doc_02',
    name: 'Dr. (Mrs) F. K. Babalola',
    title: 'Consultant Dental Surgeon',
    specialization: 'Dental Care & Surgery',
    serviceId: 'srv_dent',
    workingDays: ['Monday', 'Wednesday', 'Friday'],
    startTime: '09:00',
    endTime: '15:00',
    dailyCapacity: 15,
    currentLoad: 8,
    isAvailable: true,
    room: 'Dental Suite 1'
  },
  {
    id: 'doc_03',
    name: 'Dr. A. M. Ibrahim',
    title: 'Consultant Optometrist',
    specialization: 'Optometry & Eye Clinic',
    serviceId: 'srv_opt',
    workingDays: ['Tuesday', 'Thursday'],
    startTime: '09:00',
    endTime: '14:00',
    dailyCapacity: 20,
    currentLoad: 20, // At capacity example
    isAvailable: true,
    room: 'Eye Clinic Suite'
  },
  {
    id: 'doc_04',
    name: 'Dr. E. O. Okonjo',
    title: 'Medical Officer',
    specialization: 'General Medical Consultation',
    serviceId: 'srv_gen_med',
    workingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
    startTime: '12:00',
    endTime: '20:00',
    dailyCapacity: 25,
    currentLoad: 5,
    isAvailable: true,
    room: 'Consulting Room 4'
  },
  {
    id: 'doc_05',
    name: 'Dr. (Mrs) C. Y. Bello',
    title: 'Clinical Psychologist',
    specialization: 'Student Mental Health & Counselling',
    serviceId: 'srv_mental',
    workingDays: ['Monday', 'Wednesday', 'Friday'],
    startTime: '10:00',
    endTime: '16:00',
    dailyCapacity: 12,
    currentLoad: 4,
    isAvailable: true,
    room: 'Wellness Centre 3'
  }
];

export const INITIAL_APPOINTMENTS = [
  {
    id: 'apt_001',
    studentId: 'usr_student_01',
    studentName: 'Oluwaseun Adeleke',
    matricNo: 'CSC/2021/045',
    phone: '08123456789',
    serviceId: 'srv_gen_med',
    serviceName: 'General Medical Consultation',
    doctorId: 'doc_01',
    doctorName: 'Dr. O. A. Adeleke',
    appointmentDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    timeSlot: '10:00 AM',
    reason: 'Fever, joint pain and severe headache since yesterday.',
    status: 'Pending Approval', // Requirement: initially pending approval
    queueNumber: null,
    createdAt: new Date().toISOString()
  },
  {
    id: 'apt_002',
    studentId: 'usr_student_02',
    studentName: 'Tunde Bakare',
    matricNo: 'EEE/2020/091',
    phone: '08098765432',
    serviceId: 'srv_dent',
    serviceName: 'Dental Care & Surgery',
    doctorId: 'doc_02',
    doctorName: 'Dr. (Mrs) F. K. Babalola',
    appointmentDate: new Date().toISOString().split('T')[0], // Today
    timeSlot: '09:30 AM',
    reason: 'Molar toothache and scaling request.',
    status: 'Approved',
    queueNumber: null, // Note: Queue number is ONLY assigned upon staff check-in
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'apt_003',
    studentId: 'usr_student_03',
    studentName: 'Chioma Eze',
    matricNo: 'MED/2022/114',
    phone: '07033445566',
    serviceId: 'srv_gen_med',
    serviceName: 'General Medical Consultation',
    doctorId: 'doc_01',
    doctorName: 'Dr. O. A. Adeleke',
    appointmentDate: new Date().toISOString().split('T')[0],
    timeSlot: '08:30 AM',
    reason: 'Routine medical certificate check.',
    status: 'Checked In',
    queueNumber: 'Q-001',
    createdAt: new Date(Date.now() - 172800000).toISOString()
  }
];

export const INITIAL_QUEUE = [
  {
    id: 'q_001',
    queueNumber: 'Q-001',
    appointmentId: 'apt_003',
    patientName: 'Chioma Eze',
    matricNo: 'MED/2022/114',
    doctorName: 'Dr. O. A. Adeleke',
    serviceName: 'General Medical Consultation',
    room: 'Consulting Room 2',
    status: 'In Consultation',
    checkInTime: '08:15 AM'
  },
  {
    id: 'q_002',
    queueNumber: 'Q-002',
    appointmentId: 'apt_004_mock',
    patientName: 'Adebayo Ogunlesi',
    matricNo: 'CHE/2019/082',
    doctorName: 'Dr. O. A. Adeleke',
    serviceName: 'General Medical Consultation',
    room: 'Consulting Room 2',
    status: 'Waiting',
    checkInTime: '08:40 AM'
  }
];
