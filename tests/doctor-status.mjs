import assert from 'node:assert/strict';
const data = new Map();
globalThis.window = {localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}};
const {Storage}=await import('../assets/js/core/storage.js');
const {APP_CONFIG:{STORAGE_KEYS:k}}=await import('../assets/js/core/config.js');
const {saveDoctorStatus,attendanceStatus,attendanceAllowsTime,attendanceAllowsDate,dateKey,doctorLoad}=await import('../assets/js/services/doctor-status.js');
Storage.set(k.DOCTORS,[{id:'doctor',isAvailable:true,currentLoad:5,dailyCapacity:5}]);
assert.throws(()=>saveDoctorStatus('doctor','Available'),/staff/);
Storage.set(k.AUTH_USER,{role:'admin'});
assert.throws(()=>saveDoctorStatus('doctor','Unknown'),/valid/);
assert.throws(()=>saveDoctorStatus('doctor','Arriving Soon',3),/arrival/);
for(const status of ['Available','In Consultation','On Break','Arriving Soon','Off Duty','On Leave']) {
 saveDoctorStatus('doctor',status,30);
 const doc=Storage.get(k.DOCTORS)[0];
 assert.equal(attendanceStatus(doc),status);
 assert.equal(doctorLoad(doc),5,'attendance must not alter capacity');
 const future=new Date();future.setDate(future.getDate()+1);
 assert.ok(attendanceAllowsDate(doc,dateKey(future)),'attendance must not overwrite future roster');
 if(['Off Duty','On Leave'].includes(status))assert.equal(attendanceAllowsTime(doc,dateKey(),1439),false);
 if(status==='Arriving Soon')assert.ok(new Date(doc.expectedArrivalAt)>new Date());
}
console.log('PASS: six persisted statuses, staff guard, arrival validation, future roster and independent capacity.');
