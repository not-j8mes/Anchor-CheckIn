/**
 * Random-but-realistic data generators used by the "Add Test Data" admin
 * action (POST /admin/seed-test-data). Kept separate from the route handler
 * so the name pools don't clutter the seeding logic.
 */

const KID_FIRST_NAMES = [
  "Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason",
  "Isabella", "Lucas", "Mia", "Elijah", "Charlotte", "James", "Amelia",
  "Benjamin", "Harper", "Henry", "Evelyn", "Alexander",
];

const ADULT_FIRST_NAMES = [
  "Michael", "Jennifer", "David", "Sarah", "Robert", "Jessica", "William",
  "Ashley", "Christopher", "Amanda", "Daniel", "Melissa", "Matthew",
  "Nicole", "Joseph", "Elizabeth", "Andrew", "Megan", "Joshua", "Lauren",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson",
  "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee",
];

const ALLERGIES = ["Peanuts", "Tree nuts", "Dairy", "Gluten", "Bee stings", "Shellfish"];

const MEDICAL_NOTES = [
  "Mild asthma — inhaler in bag",
  "Wears glasses",
  "ADHD — may need redirection",
  "Type 1 diabetic — insulin pump",
];

const EMERGENCY_RELATIONSHIPS = ["Grandparent", "Aunt", "Uncle", "Family friend", "Neighbor"];

let counter = 0;
/** Monotonic counter so generated phone numbers/emails don't collide within a single seed run. */
function nextCounter(): number {
  return counter++;
}

export function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function maybe<T>(probability: number, value: () => T): T | null {
  return Math.random() < probability ? value() : null;
}

export function randomKidFirstName(): string {
  return randomItem(KID_FIRST_NAMES);
}

export function randomAdultFirstName(): string {
  return randomItem(ADULT_FIRST_NAMES);
}

export function randomLastName(): string {
  return randomItem(LAST_NAMES);
}

export function randomAllergies(): string | null {
  return maybe(0.3, () => randomItem(ALLERGIES));
}

export function randomMedicalNotes(): string | null {
  return maybe(0.15, () => randomItem(MEDICAL_NOTES));
}

export function randomEmergencyContact(lastName: string): { name: string; phone: string; relationship: string } {
  return {
    name: `${randomAdultFirstName()} ${lastName}`,
    phone: randomPhone(),
    relationship: randomItem(EMERGENCY_RELATIONSHIPS),
  };
}

/** Generates a (555) xxx-xxxx phone number — the reserved-for-fiction NANP prefix. */
export function randomPhone(): string {
  const n = nextCounter() % 10000;
  return `(555) ${String(100 + (n % 900)).padStart(3, "0")}-${String(n).padStart(4, "0")}`;
}

export function randomEmail(firstName: string, lastName: string): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${nextCounter()}@example.com`;
}

/** Returns a YYYY-MM-DD date string for someone currently `years` old (± a few months). */
export function dobForAge(years: number): string {
  const today = new Date();
  const dob = new Date(today.getFullYear() - years, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28));
  return dob.toISOString().slice(0, 10);
}

export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Returns the YYYY-MM-DD date of the next occurrence of `dow` (0=Sun..6=Sat), always 1-7 days out. */
export function nextDateForDow(dow: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d.toISOString().slice(0, 10);
}
