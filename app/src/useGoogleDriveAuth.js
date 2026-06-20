import { useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Fill these in once you've created OAuth credentials in Google Cloud Console
// (see README for exact steps). Each platform needs its own client ID.
export const GOOGLE_CLIENT_IDS = {
  android: 'REPLACE_WITH_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  ios: 'REPLACE_WITH_IOS_CLIENT_ID.apps.googleusercontent.com',
  web: 'REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com',
};

export function useGoogleDriveAuth() {
  const [accessToken, setAccessToken] = useState(null);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'memonasworkspace' });

  const promptAsync = useCallback(async () => {
    const clientId =
      GOOGLE_CLIENT_IDS[
        require('react-native').Platform.OS === 'ios'
          ? 'ios'
          : require('react-native').Platform.OS === 'android'
          ? 'android'
          : 'web'
      ];

    const request = new AuthSession.AuthRequest({
      clientId,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
    });

    const result = await request.promptAsync(DISCOVERY);
    if (result.type === 'success' && result.authentication?.accessToken) {
      setAccessToken(result.authentication.accessToken);
      return result.authentication.accessToken;
    }
    if (result.type === 'error') {
      throw new Error(result.error?.message || 'Google sign-in failed');
    }
    return null;
  }, [redirectUri]);

  return { accessToken, promptAsync };
}
