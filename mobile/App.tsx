import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ChatScreen } from './src/screens/ChatScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OtpScreen } from './src/screens/OtpScreen';

function MainNavigator() {
  const { isAuthenticated, isLoadingSession } = useAuth();
  const [authStep, setAuthStep] = useState<'login' | 'otp'>('login');

  if (isLoadingSession) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <ChatScreen />;
  }

  if (authStep === 'otp') {
    return <OtpScreen onBack={() => setAuthStep('login')} />;
  }

  return <LoginScreen onOtpSent={() => setAuthStep('otp')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
