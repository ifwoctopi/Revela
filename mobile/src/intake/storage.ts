// Local, per-user persistence for UserContext: one JSON file under the app's
// document directory, keyed by user id. Nothing here touches the network.

import { Directory, File, Paths } from 'expo-file-system';

import { parseUserContext, type UserContext } from './userContext';

const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

function contextFile(userId: string): File {
  // The id pattern rules out path traversal; reject anything else outright.
  if (!USER_ID.test(userId)) throw new Error('Invalid user id.');
  return new File(Paths.document, 'users', userId, 'context.json');
}

export async function loadUserContext(userId: string): Promise<UserContext | null> {
  const file = contextFile(userId);
  if (!file.exists) return null;
  try {
    const parsed = parseUserContext(JSON.parse(await file.text()));
    // Never return another user's record, even if files were moved around.
    return parsed?.userId === userId ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveUserContext(context: UserContext): Promise<void> {
  const valid = parseUserContext(context);
  if (!valid) throw new Error('Refusing to save an invalid user context.');
  const file = contextFile(valid.userId);
  const directory = new Directory(Paths.document, 'users', valid.userId);
  if (!directory.exists) directory.create({ intermediates: true });
  file.write(JSON.stringify(valid));
}

export async function deleteUserContext(userId: string): Promise<void> {
  const file = contextFile(userId);
  if (file.exists) file.delete();
}
