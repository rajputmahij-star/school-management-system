import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

const COL = 'timetables'

export const getTimetable = async (className) => {
  const snap = await getDoc(doc(db, COL, className))
  if (snap.exists()) return snap.data()
  return null
}

export const saveTimetable = async (className, data) => {
  await setDoc(doc(db, COL, className), {
    ...data,
    className,
    updatedAt: serverTimestamp(),
  })
}
