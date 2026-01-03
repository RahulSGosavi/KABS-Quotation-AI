
export const AuthService = {
    TOKEN_KEY: 'kabs_admin_jwt',

    login(email: string, pass: string): boolean {
        if (email === 'admin@kabs.com' && pass === 'admin') {
            // Create a mock JWT payload
            const payload = {
                sub: 'admin-user-id',
                email: email,
                role: 'admin',
                iat: Date.now(),
                exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days validity
            };
            
            // Encode as base64 to look like a token (Mock JWT)
            const token = btoa(JSON.stringify(payload));
            localStorage.setItem(this.TOKEN_KEY, token);
            return true;
        }
        return false;
    },

    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
    },

    isAuthenticated(): boolean {
        const token = localStorage.getItem(this.TOKEN_KEY);
        if (!token) return false;

        try {
            const payload = JSON.parse(atob(token));
            // Check expiration
            if (Date.now() > payload.exp) {
                this.logout();
                return false;
            }
            return true;
        } catch (e) {
            this.logout();
            return false;
        }
    }
};
