/**
 * Care-OAU - Queue Service
 * Manages live patient queue calling, status transitions, position calculations,
 * and hospital reception check-in state.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { INITIAL_QUEUE } from '../data/mock-data.js';
import { Api } from './api-client.js';

export const QueueService = {
  /**
   * Check in a student on arrival (Staff reception action)
   */
  async checkIn(appointmentPublicId) {
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        const res = await Api.post('/queue/check-in', { appointmentPublicId });
        if (res?.data) {
          const ticket = res.data;
          const currentQueue = Storage.get(APP_CONFIG.STORAGE_KEYS.QUEUE, []);
          const updated = [...currentQueue, {
            id: ticket.publicId,
            publicId: ticket.publicId,
            queueNumber: ticket.ticketNumber,
            ticketNumber: ticket.ticketNumber,
            appointmentId: ticket.appointmentPublicId,
            studentName: ticket.studentName,
            matricNo: ticket.matricNo,
            doctorName: ticket.doctorName,
            serviceName: ticket.serviceName,
            status: APP_CONFIG.QUEUE_STATUS.WAITING,
            checkInTime: ticket.checkInTime
          }];
          Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, updated);
          return { success: true, ticket };
        }
      } catch (err) {
        if (err.status === 409) {
          return { success: false, message: err.message || 'Student is already checked into live queue.' };
        }
      }
    }
    return { success: true };
  },

  async callPatient(queueId) {
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        await Api.patch('/admin/queue/call-next');
      } catch (err) {
        if (err.code === 'ACTIVE_VISIT_IN_PROGRESS') {
          return { success: false, message: err.message };
        }
      }
    }

    const queue = await this.getQueue();
    const patient = queue.find(q => q.id === queueId || q.publicId === queueId);
    if (!patient || patient.status !== 'Waiting') return { success: false, message: 'This patient is no longer waiting.' };
    if (queue.some(q => ['Called', 'In Consultation'].includes(q.status))) return { success: false, message: 'Finish the active visit before calling another patient.' };
    patient.status = APP_CONFIG.QUEUE_STATUS.CALLED;
    patient.calledAt = new Date().toISOString();
    Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, queue);
    return { success: true, patient };
  },

  async markNoShow(queueId) {
    const cleanId = String(queueId || '').trim();
    if (!APP_CONFIG.USE_MOCK_DATA && cleanId && !cleanId.startsWith('emg_')) {
      try {
        await Api.patch(`/admin/queue/${cleanId}/no-show`);
      } catch (err) {
        // Fallback
      }
    }

    const queue = await this.getQueue();
    const patient = queue.find(q => q.id === queueId || q.publicId === queueId);
    if (!patient || !['Waiting', 'Called'].includes(patient.status)) return { success: false, message: 'Only waiting or called patients can be marked absent.' };
    patient.status = APP_CONFIG.QUEUE_STATUS.NO_SHOW;
    Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, queue);
    const appointments = Storage.get(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, []);
    Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, appointments.map(a => (a.id === patient.appointmentId || a.publicId === patient.appointmentId) ? { ...a, status: 'No Show' } : a));
    return { success: true, patient };
  },

  /**
   * Get all active queue items
   */
  async getQueue() {
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
        if (user?.role === 'admin') {
          const res = await Api.get('/admin/queue');
          const raw = res?.data?.queue || res?.data || (Array.isArray(res) ? res : null);
          if (raw !== null) {
            const mapped = raw.map(q => {
              const queueNum = q.queueNumber || q.ticketNumber;
              const ticketStr = typeof queueNum === 'number' ? `Q-${String(queueNum).padStart(3, '0')}` : String(queueNum || '');
              return {
                id: q.publicId || `que_${queueNum}`,
                publicId: q.publicId || `que_${queueNum}`,
                queueNumber: ticketStr,
                ticketNumber: ticketStr,
                appointmentId: q.appointmentPublicId || q.appointment?.publicId,
                studentName: q.student?.name || q.studentName,
                matricNo: q.student?.matricNumber || q.matricNo,
                doctorName: q.doctor?.name || q.doctorName,
                serviceName: q.assignedClinic?.name || q.serviceName,
                room: q.assignedClinic?.consultingRoom || q.room || 'Consulting Room',
                status: q.status === 'waiting' ? APP_CONFIG.QUEUE_STATUS.WAITING :
                        q.status === 'called' ? APP_CONFIG.QUEUE_STATUS.CALLED :
                        q.status === 'in_consultation' ? APP_CONFIG.QUEUE_STATUS.IN_CONSULTATION :
                        q.status === 'completed' ? APP_CONFIG.QUEUE_STATUS.COMPLETED :
                        q.status === 'no_show' ? APP_CONFIG.QUEUE_STATUS.NO_SHOW : q.status,
                checkInTime: q.checkInTime,
                calledAt: q.calledAt
              };
            });
            Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, mapped);
            return mapped;
          }
        }
      } catch (err) {
        // Fallback
      }
    }

    let queue = Storage.get(APP_CONFIG.STORAGE_KEYS.QUEUE);
    if (!queue) {
      if (APP_CONFIG.USE_MOCK_DATA) {
        queue = INITIAL_QUEUE;
        Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, queue);
      } else {
        queue = [];
      }
    }
    return queue;
  },

  /**
   * Find student's active queue ticket (if checked in)
   */
  async getStudentActiveTicket(matricNo = 'CSC/2021/045') {
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        const res = await Api.get('/queue/me');
        if (res?.data?.ticket) {
          const t = res.data.ticket;
          return {
            id: t.publicId,
            publicId: t.publicId,
            queueNumber: t.ticketNumber,
            ticketNumber: t.ticketNumber,
            status: t.status === 'waiting' ? APP_CONFIG.QUEUE_STATUS.WAITING :
                    t.status === 'called' ? APP_CONFIG.QUEUE_STATUS.CALLED :
                    t.status === 'in_consultation' ? APP_CONFIG.QUEUE_STATUS.IN_CONSULTATION : t.status,
            doctorName: t.doctorName,
            serviceName: t.serviceName,
            checkInTime: t.checkInTime,
            position: res.data.position,
            estimatedWaitMinutes: res.data.estimatedWaitMinutes
          };
        }
      } catch (err) {
        // Fallback
      }
    }

    const queue = await this.getQueue();
    // Return most recent waiting or called or in-consultation ticket
    return queue.find(q => 
      q.matricNo === matricNo && 
      (q.status === APP_CONFIG.QUEUE_STATUS.WAITING || 
       q.status === APP_CONFIG.QUEUE_STATUS.CALLED || 
       q.status === APP_CONFIG.QUEUE_STATUS.IN_CONSULTATION)
    ) || null;
  },

  /**
   * Get currently serving patient
   */
  async getCurrentlyServing() {
    const queue = await this.getQueue();
    return queue.find(q => 
      q.status === APP_CONFIG.QUEUE_STATUS.IN_CONSULTATION || 
      q.status === APP_CONFIG.QUEUE_STATUS.CALLED
    ) || null;
  },

  /**
   * Calculate how many patients are ahead of a given queue ticket
   */
  async getPatientsAhead(queueNumber) {
    const queue = await this.getQueue();
    const targetIdx = queue.findIndex(q => q.queueNumber === queueNumber);
    if (targetIdx === -1) return 0;

    // Count waiting patients before target
    return queue
      .slice(0, targetIdx)
      .filter(q => q.status === APP_CONFIG.QUEUE_STATUS.WAITING || q.status === APP_CONFIG.QUEUE_STATUS.CALLED)
      .length;
  },

  /**
   * Staff Action: Call next waiting patient
   */
  async callNextPatient() {
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        await Api.patch('/admin/queue/call-next');
      } catch (err) {
        console.warn('[QueueService] /admin/queue/call-next notice:', err.message);
      }
    }

    const queue = await this.getQueue();
    if (queue.some(q => ['Called', 'In Consultation'].includes(q.status))) {
      return { success: false, message: 'Finish the current visit or mark the called patient absent before calling the next patient.' };
    }
    const waitingIdx = queue.findIndex(q => q.status === APP_CONFIG.QUEUE_STATUS.WAITING);

    if (waitingIdx === -1) {
      return { success: false, message: 'No patients currently waiting in the queue.' };
    }

    queue[waitingIdx].status = APP_CONFIG.QUEUE_STATUS.CALLED;
    queue[waitingIdx].calledAt = new Date().toISOString();

    Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, queue);
    return { success: true, patient: queue[waitingIdx] };
  },

  /**
   * Staff Action: Start Consultation
   */
  async startConsultation(queueId) {
    const cleanId = String(queueId || '').trim();
    if (!APP_CONFIG.USE_MOCK_DATA && cleanId && !cleanId.startsWith('emg_')) {
      try {
        await Api.patch(`/admin/queue/${cleanId}/start`);
      } catch (err) {
        console.warn(`[QueueService] /admin/queue/${cleanId}/start notice:`, err.message);
      }
    }

    const queue = await this.getQueue();
    const target = queue.find(q => q.id === queueId || q.publicId === queueId || q.queueNumber === queueId);
    if (!target || target.status !== APP_CONFIG.QUEUE_STATUS.CALLED) return { success: false, message: 'Call the patient before starting consultation.' };
    const updated = queue.map(q => {
      if (q.id === queueId || q.publicId === queueId || q.queueNumber === queueId) {
        return {
          ...q,
          status: APP_CONFIG.QUEUE_STATUS.IN_CONSULTATION,
          consultationStartedAt: new Date().toISOString()
        };
      }
      return q;
    });

    Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, updated);
    const appointments = Storage.get(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, []);
    Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, appointments.map(a => a.id === target.appointmentId ? { ...a, status: APP_CONFIG.APPOINTMENT_STATUS.IN_CONSULTATION } : a));
    return { success: true };
  },

  /**
   * Staff Action: Complete Patient Visit
   */
  async completeVisit(queueId) {
    const cleanId = String(queueId || '').trim();
    if (!APP_CONFIG.USE_MOCK_DATA && cleanId && !cleanId.startsWith('emg_')) {
      try {
        await Api.patch(`/admin/queue/${cleanId}/complete`);
      } catch (err) {
        console.warn(`[QueueService] /admin/queue/${cleanId}/complete notice:`, err.message);
      }
    }

    const queue = await this.getQueue();
    const target = queue.find(q => q.id === queueId || q.publicId === queueId || q.queueNumber === queueId);
    if (!target || !['Called', 'In Consultation'].includes(target.status)) return { success: false, message: 'This patient has no active visit.' };
    const appointments = Storage.get(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, []);

    let completedItem = null;
    const updatedQueue = queue.map(q => {
      if (q.id === queueId || q.queueNumber === queueId) {
        completedItem = q;
        return {
          ...q,
          status: APP_CONFIG.QUEUE_STATUS.COMPLETED,
          completedAt: new Date().toISOString()
        };
      }
      return q;
    });

    // Also update matching appointment status to Completed
    if (completedItem && completedItem.appointmentId) {
      const updatedAppointments = appointments.map(apt => {
        if (apt.id === completedItem.appointmentId) {
          return {
            ...apt,
            status: APP_CONFIG.APPOINTMENT_STATUS.COMPLETED,
            completedAt: new Date().toISOString()
          };
        }
        return apt;
      });
      Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, updatedAppointments);
    }

    Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, updatedQueue);
    return { success: true };
  }
};
