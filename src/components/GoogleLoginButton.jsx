import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useGameStore, translations } from '../store/useGameStore';

export const GoogleLoginButton = () => {
  const language = useGameStore((state) => state.language);
  const user = useGameStore((state) => state.user);
  const loginWithGoogle = useGameStore((state) => state.loginWithGoogle);
  const logout = useGameStore((state) => state.logout);
  const t = translations[language] || translations['zh-TW'];

  const handleGoogleSuccess = async (credentialResponse) => {
    if (credentialResponse?.credential) {
      await loginWithGoogle(credentialResponse.credential);
    }
  };

  const handleGoogleError = () => {
    console.warn('[Google Sign-In] Sign-in failed or was closed by user.');
  };

  const handleDemoLogin = async () => {
    // Quick Demo Sign-In simulation if testing locally without Google Cloud console setup
    await loginWithGoogle('demo_credential_token');
  };

  if (user?.isLoggedIn) {
    return (
      <div className="google-user-profile-chip">
        {user.pictureUrl ? (
          <img src={user.pictureUrl} alt={user.name} className="google-user-avatar-img" />
        ) : (
          <span className="google-avatar-icon">👤</span>
        )}
        <span className="google-user-name">{user.name}</span>
        <button type="button" className="btn-google-logout" onClick={logout} title={t.googleLogout || '登出'}>
          🚪
        </button>
      </div>
    );
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isDefaultClientId = !clientId || clientId.includes('example');

  return (
    <div className="google-login-wrap">
      {!isDefaultClientId ? (
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          shape="circle"
          size="small"
          theme="filled_black"
          text="signin_with"
        />
      ) : (
        <button type="button" className="btn-demo-google-login" onClick={handleDemoLogin}>
          <span className="google-g-icon">G</span> {t.googleLogin || 'Google 登入'}
        </button>
      )}
    </div>
  );
};
