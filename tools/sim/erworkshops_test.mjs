// ER Classes (erWorkshops) and ER Rooms: removing one has to delete the
// Firestore document, not just the row on screen.
//
// Both delete paths had the same shape of bug — drop the item from the
// in-memory array first, then look through that same array for the item in
// order to delete it. The search always came up empty, so Save deleted
// nothing and the class reappeared on the next load.
import { store, resetStats } from './db.js';
import { addDoc, updateDoc, deleteDoc, getWhere } from './db.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }
function reset() { for (const k in store) store[k] = []; resetStats(); }

// The page's logic, transcribed: the two functions under test, with the DOM
// read replaced by the array the DOM was rendered from.
function makePage() {
  let workshops = [];
  let removedWorkshopIds = [];
  return {
    get workshops() { return workshops; },
    set workshops(v) { workshops = v; },
    removeWorkshopRow(idx) {
      const [removed] = workshops.splice(idx, 1);
      if (removed?.id) removedWorkshopIds.push(removed.id);
    },
    async saveWorkshops(rows) {
      const updated = [];
      rows.forEach((row, i) => { if (row.name) updated.push({ ...workshops[i], ...row, order: i }); });
      const goneIds = [...new Set([
        ...removedWorkshopIds,
        ...workshops.filter(w => w.id && !updated.find(u => u.id === w.id)).map(w => w.id),
      ])];
      for (const id of goneIds) await deleteDoc('erWorkshops', id);
      removedWorkshopIds = [];
      const saved = [];
      for (const w of updated) {
        if (w.id) { await updateDoc('erWorkshops', w.id, { name: w.name, room: w.room, order: w.order }); saved.push(w); }
        else { const id = await addDoc('erWorkshops', { name: w.name, room: w.room, order: w.order }); saved.push({ ...w, id }); }
      }
      workshops = saved;
      return saved;
    },
  };
}

// ── Removing a class and saving deletes it ──
reset();
{
  const page = makePage();
  store.erWorkshops.push({ id: 'w1', name: 'Study Hall', room: '101', order: 0 },
                         { id: 'w2', name: 'Art', room: '102', order: 1 });
  page.workshops = await getWhere('erWorkshops', 'order', '>=', 0);
  t("two classes to start with", page.workshops.length === 2);

  page.removeWorkshopRow(0);                                   // delete "Study Hall"
  t("it leaves the screen straight away", page.workshops.length === 1);

  await page.saveWorkshops(page.workshops.map(w => ({ name: w.name, room: w.room })));
  const left = await getWhere('erWorkshops', 'order', '>=', 0);
  t("and the document is gone from Firestore, so it stays gone",
    left.length === 1 && left[0].name === 'Art', JSON.stringify(left.map(w => w.name)));
}

// ── Removing several at once, and the last one ──
reset();
{
  const page = makePage();
  store.erWorkshops.push({ id:'w1', name:'A', order:0 }, { id:'w2', name:'B', order:1 }, { id:'w3', name:'C', order:2 });
  page.workshops = await getWhere('erWorkshops', 'order', '>=', 0);
  page.removeWorkshopRow(2); page.removeWorkshopRow(0);        // C, then A
  await page.saveWorkshops(page.workshops.map(w => ({ name: w.name, room: w.room })));
  const left = await getWhere('erWorkshops', 'order', '>=', 0);
  t("two removed in one go are both deleted", left.length === 1 && left[0].name === 'B',
    JSON.stringify(left.map(w => w.name)));

  page.removeWorkshopRow(0);
  await page.saveWorkshops([]);
  t("removing the last one empties the collection",
    (await getWhere('erWorkshops', 'order', '>=', 0)).length === 0);
}

// ── A row added and removed before ever being saved ──
reset();
{
  const page = makePage();
  page.workshops = [{ name: '', room: '', order: 0 }];
  page.removeWorkshopRow(0);
  await page.saveWorkshops([]);
  t("an unsaved row costs no writes", store.erWorkshops.length === 0);
}

// ── Clearing the name is still a delete, as it always was ──
reset();
{
  const page = makePage();
  store.erWorkshops.push({ id: 'w1', name: 'Study Hall', room: '101', order: 0 });
  page.workshops = await getWhere('erWorkshops', 'order', '>=', 0);
  await page.saveWorkshops([{ name: '', room: '101' }]);
  t("a class whose name was blanked is deleted too",
    (await getWhere('erWorkshops', 'order', '>=', 0)).length === 0);
}

// ── Deleting a room takes its student assignments with it ──
reset();
{
  let erRooms = [{ id: 'r1', name: '101' }, { id: 'r2', name: '102' }];
  let erRoomStudents = [
    { id: 'rs1', roomId: 'r1', studentId: 'sA' },
    { id: 'rs2', roomId: 'r1', studentId: 'sB' },
    { id: 'rs3', roomId: 'r2', studentId: 'sC' },
    { roomId: 'r1', studentId: 'sD', _isNew: true },          // dragged in, never saved
  ];
  store.erRooms.push(...erRooms.map(r => ({ ...r })));
  store.erRoomStudents.push({ id:'rs1', roomId:'r1' }, { id:'rs2', roomId:'r1' }, { id:'rs3', roomId:'r2' });

  const roomId = 'r1';
  const toDelete = erRoomStudents.filter(rs => rs.roomId === roomId && rs.id && !rs._isNew);
  erRoomStudents = erRoomStudents.filter(rs => rs.roomId !== roomId);
  erRooms = erRooms.filter(r => r.id !== roomId);
  await deleteDoc('erRooms', roomId);
  for (const rs of toDelete) await deleteDoc('erRoomStudents', rs.id);

  t("the room document is deleted", store.erRooms.length === 1 && store.erRooms[0].id === 'r2');
  t("its saved student rows go with it, and the other room's stay",
    store.erRoomStudents.length === 1 && store.erRoomStudents[0].id === 'rs3',
    JSON.stringify(store.erRoomStudents.map(r => r.id)));
  t("the never-saved row needs no delete", erRoomStudents.every(rs => rs.roomId !== 'r1'));
}

console.log(fails ? `\n${fails} FAILED` : "\nAll ER class/room deletion tests passed.");
