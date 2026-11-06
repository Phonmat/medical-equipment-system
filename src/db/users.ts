import fs from 'fs';
import path from 'path';

const USERS_FILE = path.resolve(process.cwd(), '.users-store.json');

export interface StoredUser {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
}

function loadUsers(): StoredUser[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Failed to read users store:', err);
  }
  return [
    {
      id: 1,
      uid: 'phonmat',
      email: 'phonmat1990@gmail.com',
      displayName: 'phonmat',
      role: 'Super Admin',
      createdAt: new Date().toISOString(),
    },
  ];
}

function saveUsers(usersList: StoredUser[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersList, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write users store:', err);
  }
}

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  const list = loadUsers();
  const idx = list.findIndex((u) => u.uid === uid);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      email,
      ...(displayName ? { displayName } : {}),
    };
    saveUsers(list);
    return list[idx];
  }
  const newUser: StoredUser = {
    id: list.length + 1,
    uid,
    email,
    displayName: displayName || email.split('@')[0],
    role: 'Super Admin',
    createdAt: new Date().toISOString(),
  };
  list.push(newUser);
  saveUsers(list);
  return newUser;
}

export async function getUsers() {
  return loadUsers();
}
