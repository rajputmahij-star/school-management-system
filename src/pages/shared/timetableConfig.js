export const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']

export const TIME_SLOTS = [
  { id: '10:00-10:15', label: '10:00 – 10:15' },
  { id: '10:15-10:45', label: '10:15 – 10:45' },
  { id: '10:45-11:15', label: '10:45 – 11:15' },
  { id: '11:15-12:00', label: '11:15 – 12:00' },
  { id: '12:00-12:45', label: '12:00 – 12:45' },
  { id: '12:45-1:30',  label: '12:45 – 1:30'  },
  { id: '1:30-2:10',   label: '1:30 – 2:10'   },
  { id: '2:10-2:25',   label: '2:10 – 2:25'   },
]

// Day header colors matching the printed timetable
export const DAY_COLORS = {
  MONDAY:    { bg: '#e53e3e', text: '#fff' },  // Red
  TUESDAY:   { bg: '#3182ce', text: '#fff' },  // Blue
  WEDNESDAY: { bg: '#38a169', text: '#fff' },  // Green
  THURSDAY:  { bg: '#d69e2e', text: '#fff' },  // Yellow/Orange
  FRIDAY:    { bg: '#805ad5', text: '#fff' },  // Purple
}

// Default timetable content (based on the uploaded image — Primary-I)
export const DEFAULT_TIMETABLE = {
  MONDAY: {
    '10:00-10:15': 'Home Room Period\nAttendance & Communication',
    '10:15-10:45': 'Rhymes &\nAction Songs',
    '10:45-11:15': 'English (A-Z Writing)\nKhushi Ma\'am',
    '11:15-12:00': 'Maths\n(Concept & Activities)\nFatima Ma\'am',
    '12:00-12:45': 'Lunch and\nCleaning Time\nFatima Ma\'am',
    '12:45-1:30':  'Identification and\nVocabulary\nKhushi Ma\'am',
    '1:30-2:10':   'Outdoor Games\nFatima Ma\'am',
    '2:10-2:25':   'Back Pack\nand Go to Home',
  },
  TUESDAY: {
    '10:00-10:15': 'Home Room Period\nAttendance & Communication',
    '10:15-10:45': 'Rhymes',
    '10:45-11:15': 'English (Small Letters)\nKhushi Ma\'am',
    '11:15-12:00': 'Maths\n(Counting)\nFatima Ma\'am',
    '12:00-12:45': 'Lunch and\nCleaning Time\nFatima Ma\'am',
    '12:45-1:30':  'Art and Craft\n(Tearing and Paste)\nFatima Ma\'am',
    '1:30-2:10':   'Indoor Games\nKhushi Ma\'am',
    '2:10-2:25':   'Back Pack\nand Go to Home',
  },
  WEDNESDAY: {
    '10:00-10:15': 'Home Room Period\nAttendance & Communication',
    '10:15-10:45': 'Story Time',
    '10:45-11:15': 'English (Capital Letters)\nKhushi Ma\'am',
    '11:15-12:00': 'Maths\n(Shapes)\nKhushi Ma\'am',
    '12:00-12:45': 'Lunch and\nCleaning Time\nFatima Ma\'am',
    '12:45-1:30':  'Identification and\nVocabulary\nFatima Ma\'am',
    '1:30-2:10':   'Music & Dance\nFatima Ma\'am',
    '2:10-2:25':   'Back Pack\nand Go to Home',
  },
  THURSDAY: {
    '10:00-10:15': 'Home Room Period\nAttendance & Communication',
    '10:15-10:45': 'Rhymes',
    '10:45-11:15': 'English (Picture Reading)\nKhushi Ma\'am',
    '11:15-12:00': 'Maths\n(Matching)\nFatima Ma\'am',
    '12:00-12:45': 'Lunch and\nCleaning Time\nFatima Ma\'am',
    '12:45-1:30':  'Art and Craft\n(Tearing and Paste)\nFatima Ma\'am',
    '1:30-2:10':   'Fun Games\nFatima Ma\'am',
    '2:10-2:25':   'Back Pack\nand Go to Home',
  },
  FRIDAY: {
    '10:00-10:15': 'Home Room Period\nAttendance & Communication',
    '10:15-10:45': 'Prayer Songs\nEnglish Revago',
    '10:45-11:15': 'English Revision\nKhushi Ma\'am',
    '11:15-12:00': 'Maths\n123\nKhushi Ma\'am',
    '12:00-12:45': 'Lunch and\nCleaning Time\nFatima Ma\'am',
    '12:45-1:30':  'Identification and\nVocabulary\nFatima Ma\'am',
    '1:30-2:10':   'Revision &\nFun Friday\nKhushi Ma\'am',
    '2:10-2:25':   'Back Pack\nand Go to Home',
  },
}
