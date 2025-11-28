
const STORAGE_KEY = 'e2ee_chat_identity';

export interface UserIdentity {
    username: string;
    avatarColor: string;
}



export const generateRandomIdentity = (): UserIdentity => {
    const adjectives = ['Quantum', 'Neon', 'Cyber', 'Digital', 'Crypto', 'Neural', 'Binary', 'Techno', 'Solar', 'Cosmic'];
    const nouns = ['Wolf', 'Cipher', 'Ghost', 'Phantom', 'Ronin', 'Spectre', 'Viper', 'Raven', 'Nomad', 'Sentinel'];

    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    // Generate a random hex color for avatar
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    return {
        username: `${randomAdjective}${randomNoun}#${randomSuffix}`,
        avatarColor: randomColor
    };
};

export const getStoredIdentity = (): UserIdentity | null => {
    // Use sessionStorage so each tab has a unique identity
    const stored = sessionStorage.getItem('chat_identity');
    if (stored) {
        return JSON.parse(stored);
    }
    return null;
};

export const storeIdentity = (identity: UserIdentity): void => {
    sessionStorage.setItem('chat_identity', JSON.stringify(identity));
};

export const clearIdentity = () => {
    sessionStorage.removeItem(STORAGE_KEY);
};
