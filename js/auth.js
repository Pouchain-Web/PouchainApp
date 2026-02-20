import config from './config.js';

// Initialize Supabase
const supabase = window.supabase.createClient(config.supabase.url, config.supabase.anonKey);

export const auth = {
    // Login function
    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Check profile role
        // Assumption: 'profiles' table has 'id' linked to auth.users.id and a 'role' column
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

        // If no profile found, default to 'user' or handle error
        const role = profile ? profile.role : 'user';

        return { user: data.user, role };
    },

    // Logout function
    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        localStorage.clear(); // Clear local session data
        window.location.href = 'index.html';
    },

    // Get current session
    async getSession() {
        const { data } = await supabase.auth.getSession();
        return data.session;
    },

    // Get User Role (helper)
    async getUserRole() {
        const session = await this.getSession();
        if (!session) return null;

        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (error) {
                // If table doesn't exist (500) or no profile (PGRST116), default to user
                console.warn("Auth Warning: Could not fetch profile role (likely missing table). Defaulting to 'user'.");
                return 'user';
            }
            return profile ? profile.role : 'user';
        } catch (err) {
            console.error("Auth Exception:", err);
            return 'user';
        }
    },

    // Update password for logged in user
    async updatePassword(newPassword) {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        if (error) throw error;
    }
};
