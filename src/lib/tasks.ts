import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { requireFirebase } from "./firebase";

export type TaskStatus = "todo" | "doing" | "done";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string;
  createdAt: number;
  updatedAt: number;
}

export interface TaskInput {
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string;
}

function taskCollection(userId: string) {
  const { db } = requireFirebase();
  return collection(db, "users", userId, "tasks");
}

export async function register(email: string, password: string, displayName: string) {
  const { auth } = requireFirebase();
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    await updateProfile(result.user, { displayName: displayName.trim() });
  }
  return result.user;
}

export async function login(email: string, password: string) {
  const { auth } = requireFirebase();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  const { auth } = requireFirebase();
  return signOut(auth);
}

export function observeAuth(callback: (user: User | null) => void): Unsubscribe {
  const { auth } = requireFirebase();
  return onAuthStateChanged(auth, callback);
}

export function observeTasks(userId: string, callback: (tasks: Task[]) => void, onError: (message: string) => void): Unsubscribe {
  const q = query(taskCollection(userId), orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((taskDoc) => {
          const data = taskDoc.data();
          return {
            id: taskDoc.id,
            title: data.title ?? "Untitled task",
            description: data.description ?? "",
            status: (data.status ?? "todo") as TaskStatus,
            dueDate: data.dueDate ?? "",
            createdAt: typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : Date.now(),
            updatedAt: typeof data.updatedAt?.toMillis === "function" ? data.updatedAt.toMillis() : Date.now(),
          };
        }),
      );
    },
    (error) => onError(error.message),
  );
}

export async function createTask(userId: string, input: TaskInput) {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Task title is required.");
  }

  await addDoc(taskCollection(userId), {
    title,
    description: input.description.trim(),
    status: input.status,
    dueDate: input.dueDate,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTask(userId: string, taskId: string, input: TaskInput) {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Task title is required.");
  }

  await updateDoc(doc(taskCollection(userId), taskId), {
    title,
    description: input.description.trim(),
    status: input.status,
    dueDate: input.dueDate,
    updatedAt: serverTimestamp(),
  });
}

export async function removeTask(userId: string, taskId: string) {
  await deleteDoc(doc(taskCollection(userId), taskId));
}