import { db } from './config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function getStudentProfile(studentId) {
  const ref = doc(db, "students", studentId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// add more as needed