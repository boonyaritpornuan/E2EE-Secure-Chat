
const STORAGE_KEY = 'e2ee_chat_identity';

export interface UserIdentity {
    username: string;
    avatarColor: string;
}

const ADJECTIVES = ['Neon', 'Cyber', 'Quantum', 'Digital', 'Tech', 'Crypto', 'Secure', 'Hidden', 'Ghost', 'Shadow'];
const NOUNS = ['Tiger', 'Wolf', 'Eagle', 'Fox', 'Bear', 'Dragon', 'Phoenix', 'Shark', 'Whale', 'Owl'];
const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'];

export const generateRandomIdentity = (): UserIdentity => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    return {
        username: `${adj}${noun}`,
        avatarColor: color
    };
};

export const getStoredIdentity = (): UserIdentity | null => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
};

export const storeIdentity = (identity: UserIdentity) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
};

export const clearIdentity = () => {
    sessionStorage.removeItem(STORAGE_KEY);
};
