/**
 * Care-OAU - Appointment Service
 * Central service for appointment lifecycle management: booking, verification,
 * staff approval/rejection, rescheduling, and digital check-in.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { Utils } from '../core/utils.js';
import { INITIAL_APPOINTMENTS } from '../data/mock-data.js';
import { availableSlots, localDate } from './availability.js';
import { QueueService } from './queue-service.js';

export const AppointmentService = {
  /**
   * Get all appointments from persistent client storage
   */
  async getAllAppointments() {
    let appointments = Storage.get(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS);
    if (!appointments) {
      if (APP_CONFIG.USE_MOCK_DATA) {
        appointments = INITIAL_APPOINTMENTS;
        Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, appointments);
      } else {
        appointments = [];
      }
    }
    const normalized = appointments.map(a => ({ ...a,
      appointmentDate: a.appointmentDate || a.date,
      timeSlot: a.timeSlot || a.time,
      studentName: a.studentName || a.patientName,
      matricNo: a.matricNo || a.patientMatric,
      studentId: a.studentId || (a.patientMatric === '21/SCI/1048' ? 'usr_student_amina' : a.patientMatric === 'CSC/2021/045' ? 'usr_student_01' : undefined)
    }));
    if (JSON.stringify(normalized) !== JSON.stringify(appointments)) Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, normalized);
    return normalized;
  },

  /**
   * Get appointments for a specific student
   */
  async getStudentAppointments(studentId = 'usr_student_01') {
    const list = await this.getAllAppointments();
    return list.filter(a => a.studentId === studentId);
  },

  /**
   * Book a new appointment request.
   * NOTE: Per Care-OAU hospital policy, new appointments MUST start as 'Pending Approval',
   * and queue numbers are NEVER issued during booking.
   */
  async createAppointment({
    studentId,
    studentName,
    matricNo,
    phone,
    serviceId,
    serviceName,
    doctorId,
    doctorName,
    appointmentDate,
    timeSlot,
    reason,
    referralCode
  }) {
    await new Promise(r => setTimeout(r, 400));
    const appointments = await this.getAllAppointments();

    const slot = availableSlots(serviceId, doctorId, appointmentDate).find(s => s.time === timeSlot);
    if (!slot) return { success: false, message: 'This time is no longer available. Please select another appointment time.' };
    const service = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES, []).find(s => s.id === serviceId);
    if (service?.requiresReferral && !referralCode?.trim()) return { success: false, message: 'A referral code is required.' };
    doctorId = slot.doctor.id;
    doctorName = slot.doctor.name;

    const newAppointment = {
      id: `apt_${Date.now()}`,
      referenceNo: `CHC-${Date.now().toString().slice(-8)}`,
      referralCode: referralCode || null,
      studentId: studentId || 'usr_student_01',
      studentName: studentName || 'Oluwaseun Adeleke',
      matricNo: matricNo || 'CSC/2021/045',
      phone: phone || '08123456789',
      serviceId,
      serviceName,
      doctorId,
      doctorName,
      appointmentDate,
      timeSlot,
      reason,
      status: APP_CONFIG.APPOINTMENT_STATUS.PENDING, // Strictly Pending Approval
      queueNumber: null, // Strictly null until staff check-in
      createdAt: new Date().toISOString()
    };

    const updated = [newAppointment, ...appointments];
    Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, updated);

    return { success: true, appointment: newAppointment };
  },

  /**
   * Admin Action: Approve a pending appointment request
   */
  async approveAppointment(appointmentId) {
    const appointments = await this.getAllAppointments();
    if (!appointments.some(a => a.id === appointmentId && a.status === APP_CONFIG.APPOINTMENT_STATUS.PENDING)) return { success: false, message: 'Only pending requests can be approved.' };
    const updated = appointments.map(apt => {
      if (apt.id === appointmentId) {
        return {
          ...apt,
          status: APP_CONFIG.APPOINTMENT_STATUS.APPROVED,
          approvedAt: new Date().toISOString()
        };
      }
      return apt;
    });

    Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, updated);
    return { success: true };
  },

  /**
   * Admin Action: Reject an appointment with reason
   */
  async rejectAppointment(appointmentId, rejectionReason = 'Doctor unavailable') {
    const appointments = await this.getAllAppointments();
    if (!appointments.some(a => a.id === appointmentId && a.status === APP_CONFIG.APPOINTMENT_STATUS.PENDING)) return { success: false, message: 'Only pending requests can be rejected.' };
    const updated = appointments.map(apt => {
      if (apt.id === appointmentId) {
        return {
          ...apt,
          status: APP_CONFIG.APPOINTMENT_STATUS.REJECTED,
          rejectionReason,
          rejectedAt: new Date().toISOString()
        };
      }
      return apt;
    });

    Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, updated);
    return { success: true };
  },

  /**
   * Cancel an appointment (by student or admin)
   */
  async cancelAppointment(appointmentId, cancellationReason = 'Cancelled by student') {
    const appointments = await this.getAllAppointments();
    if (!appointments.some(a => a.id === appointmentId && ['Pending Approval', 'Approved'].includes(a.status))) return { success: false, message: 'This visit can no longer be cancelled online.' };
    const updated = appointments.map(apt => {
      if (apt.id === appointmentId) {
        return {
          ...apt,
          status: APP_CONFIG.APPOINTMENT_STATUS.CANCELLED,
          cancellationReason,
          cancelledAt: new Date().toISOString()
        };
      }
      return apt;
    });

    Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, updated);
    return { success: true };
  },

  /**
   * Reschedule appointment date and time
   */
  async rescheduleAppointment(appointmentId, newDate, newTimeSlot) {
    const appointments = await this.getAllAppointments();
    const target = appointments.find(a => a.id === appointmentId);
    if (!target || !['Pending Approval', 'Approved'].includes(target.status)) return { success: false, message: 'Only upcoming appointments can be rescheduled.' };
    const slot = availableSlots(target.serviceId, target.doctorId, newDate, target.id).find(s => s.time === newTimeSlot);
    if (!slot) return { success: false, message: 'That time is unavailable. Choose a free slot within the doctor’s schedule.' };
    const updated = appointments.map(apt => {
      if (apt.id === appointmentId) {
        return {
          ...apt,
          appointmentDate: newDate,
          timeSlot: newTimeSlot,
          status: APP_CONFIG.APPOINTMENT_STATUS.PENDING,
          rescheduledAt: new Date().toISOString()
        };
      }
      return apt;
    });

    Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, updated);
    return { success: true };
  },

  /**
   * Admin / Reception Action: Check in an approved patient at hospital
   * Generates sequential Queue Ticket (Q-001) and adds to live triage queue.
   */
  async checkInPatient(appointmentId) {
    const appointments = await this.getAllAppointments();
    let queueList = await QueueService.getQueue();

    const targetApt = appointments.find(a => a.id === appointmentId);
    if (!targetApt) {
      return { success: false, message: 'Appointment not found.' };
    }

    if (targetApt.status !== APP_CONFIG.APPOINTMENT_STATUS.APPROVED) {
      return { 
        success: false, 
        message: 'Only approved appointments may proceed to hospital check-in.' 
      };
    }

    if (targetApt.appointmentDate !== localDate()) return { success: false, message: 'Check-in is available on the appointment date.' };

    // Generate next queue ticket
    const ticketNumber = Utils.generateQueueTicket(queueList);

    // Update appointment record
    const updatedAppointments = appointments.map(apt => {
      if (apt.id === appointmentId) {
        return {
          ...apt,
          status: APP_CONFIG.APPOINTMENT_STATUS.CHECKED_IN,
          queueNumber: ticketNumber,
          checkedInAt: new Date().toISOString()
        };
      }
      return apt;
    });

    // Add entry to Live Queue
    const newQueueItem = {
      id: `q_${Date.now()}`,
      queueNumber: ticketNumber,
      appointmentId: targetApt.id,
      patientName: targetApt.studentName,
      matricNo: targetApt.matricNo,
      doctorName: targetApt.doctorName,
      serviceName: targetApt.serviceName,
      room: Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []).find(d => d.id === targetApt.doctorId)?.room || 'Reception',
      status: APP_CONFIG.QUEUE_STATUS.WAITING,
      checkInTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };

    queueList = [...queueList, newQueueItem];

    Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, updatedAppointments);
    Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, queueList);

    return { success: true, queueNumber: ticketNumber, queueItem: newQueueItem };
  }
};
