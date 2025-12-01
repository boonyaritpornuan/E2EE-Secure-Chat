import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ChatDB extends DBSchema {
    keys: {
        key: string;
        value: CryptoKey;
    };
}

const DB_NAME = 'e2ee-chat-db';
const STORE_NAME = 'keys';

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null;

const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<ChatDB>(DB_NAME, 1, {
            upgrade(db) {
                db.createObjectStore(STORE_NAME);
            },
        });
    }
    return dbPromise;
};

export const storeKey = async (keyName: string, key: CryptoKey): Promise<void> => {
    const db = await getDB();
    await db.put(STORE_NAME, key, keyName);
};

export const getKey = async (keyName: string): Promise<CryptoKey | undefined> => {
    const db = await getDB();
    return await db.get(STORE_NAME, keyName);
};

export const clearKeys = async (): Promise<void> => {
    const db = await getDB();
    await db.clear(STORE_NAME);
};
