import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Modal,
  Image,
  TouchableOpacity,
  Keyboard,
  useColorScheme,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Spacing } from '../theme/colors';
import { useTheme } from '../theme/useTheme';
import { CustomHeader } from '../components/CustomHeader';
import { MessageBubble } from '../components/MessageBubble';
import { FloatingInputBar } from '../components/FloatingInputBar';
import { CameraProofSheet } from '../components/CameraProofSheet';
import { PledgeDrawer } from '../components/PledgeDrawer';
import { UserModal } from '../components/UserModal';
import { ShowUpApi, ChatMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { loadCachedMessages, saveCachedMessages, clearCachedMessages } from '../utils/chatStorage';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-1',
  role: 'model',
  text: 'Hey, I am ShowUp. I will be your daily accountability coach for the next 30 days.\n\nWhat should I call you?',
  created_at: new Date().toISOString(),
  status: 'delivered',
};

// Retries a send with exponential backoff (2s, 4s, 8s, capped at 15s) before giving up.
// Used for every outbound send (text/photo/voice) so a network blip resolves itself
// instead of surfacing an error immediately.
async function sendWithRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        const delay = Math.min(2000 * 2 ** attempt, 15000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastErr;
}

export const ChatScreen: React.FC = () => {
  const { phone, profile, refreshProfile, checkConnection } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoSheetMode, setPhotoSheetMode] = useState<'attach' | 'checkin'>('attach');
  const [initialPhotoCaption, setInitialPhotoCaption] = useState('');
  const [isPledgeDrawerOpen, setIsPledgeDrawerOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const Colors = useTheme();
  const styles = getStyles(Colors);
  const isDarkScheme = useColorScheme() === 'dark';

  const flatListRef = useRef<FlatList>(null);
  const isPro = !!profile?.tier && profile.tier.startsWith('pro');
  // Holds the original "resend this" closure for any message currently in 'failed'
  // state, so tapping it can retry the exact same payload without re-deriving it.
  const pendingSendersRef = useRef<Map<string | number, () => Promise<any>>>(new Map());

  // On mount (and whenever the logged-in phone changes), restore the conversation
  // from the on-device cache first — instant, no network wait, "doesn't forget it"
  // across app restarts. If the device cache is empty (fresh install / new device),
  // fall back to fetching recent history from the backend to re-seed it; only show
  // the welcome message if both are genuinely empty (brand-new user).
  useEffect(() => {
    if (!phone) return;
    let cancelled = false;

    const restoreConversation = async () => {
      const cached = await loadCachedMessages(phone);
      if (cancelled) return;

      if (cached.length > 0) {
        setMessages(cached);
        setIsHistoryLoaded(true);
        return;
      }

      try {
        const history = await ShowUpApi.getChatHistory();
        if (cancelled) return;
        if (history.length > 0) {
          setMessages(history);
          await saveCachedMessages(phone, history);
        } else {
          setMessages([WELCOME_MESSAGE]);
        }
      } catch (e) {
        setMessages([WELCOME_MESSAGE]);
      } finally {
        setIsHistoryLoaded(true);
      }
    };

    restoreConversation();
    return () => {
      cancelled = true;
    };
  }, [phone]);

  // Persist to the on-device cache whenever the conversation changes, once the
  // initial restore above has completed (avoids overwriting the cache with an
  // empty array during the brief window before restoration finishes).
  useEffect(() => {
    if (!phone || !isHistoryLoaded) return;
    saveCachedMessages(phone, messages);
  }, [messages, phone, isHistoryLoaded]);

  // Poll for pending outbox messages from the backend
  const fetchNewMessages = useCallback(async () => {
    try {
      const pending = await ShowUpApi.getPendingMessages();
      if (pending.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newOnes = pending.filter((m) => !existingIds.has(m.id));
          if (newOnes.length === 0) return prev;
          return [...prev, ...newOnes];
        });

        // Ack using the raw backend id (serverId), not the composite display `id`
        // (e.g. "out-4-2026-08-21...") — the composite exists specifically so it
        // can't collide with stale cached ids after a server-side database reset;
        // parsing it back with Number() would just yield NaN.
        const idsToAck = pending.map((m) => m.serverId).filter((id): id is number => typeof id === 'number' && !isNaN(id));
        await ShowUpApi.acknowledgeMessages(idsToAck);
        refreshProfile();
      }
    } catch (e) {}
  }, [refreshProfile]);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(fetchNewMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchNewMessages, checkConnection]);

  const scrollToBottom = (animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 100);
  };

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => scrollToBottom(true)
    );
    return () => showSub.remove();
  }, []);

  // Send a text message to the AI coach
  const handleSendMessage = async (text: string) => {
    const tempId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      text,
      created_at: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom(true);
    setIsLoading(true);

    const sendFn = () => ShowUpApi.sendMessage({ body: text });
    pendingSendersRef.current.set(tempId, sendFn);

    try {
      await sendWithRetry(sendFn);

      pendingSendersRef.current.delete(tempId);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'delivered' } : m))
      );

      // Immediately poll for AI reply
      setTimeout(fetchNewMessages, 600);
      setTimeout(fetchNewMessages, 2000);
      setTimeout(fetchNewMessages, 4000);
    } catch (err: any) {
      // Retries (2s, 4s, 8s) are already exhausted at this point — mark it failed
      // rather than injecting a fake bot reply. The bubble itself shows the failure
      // and can be tapped to retry again (see handleRetryMessage).
      console.error('Send error after retries:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    } finally {
      setIsLoading(false);
      scrollToBottom(true);
    }
  };

  // Manually retry a message that's sitting in 'failed' state (tapped by the user).
  const handleRetryMessage = async (message: ChatMessage) => {
    const sendFn = pendingSendersRef.current.get(message.id);
    if (!sendFn) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, status: 'sending' } : m))
    );

    try {
      await sendWithRetry(sendFn);
      pendingSendersRef.current.delete(message.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, status: 'delivered' } : m))
      );
      setTimeout(fetchNewMessages, 600);
      setTimeout(fetchNewMessages, 2000);
    } catch (err) {
      console.error('Retry failed:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, status: 'failed' } : m))
      );
    }
  };

  // Submit a photo check-in with gesture / screenshot proof
  const handleSubmitProof = async (imageBase64: string, caption: string, imageUri: string) => {
    const tempId = `user-photo-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      text: caption || 'Submitted workout proof',
      imageUri,
      created_at: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom(true);
    setIsLoading(true);

    const sendFn = () => ShowUpApi.sendMessage({
      body: caption || 'Here is my workout proof',
      imageBase64,
      mimeType: 'image/jpeg',
    });
    pendingSendersRef.current.set(tempId, sendFn);

    try {
      await sendWithRetry(sendFn);

      pendingSendersRef.current.delete(tempId);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'delivered' } : m))
      );

      setTimeout(fetchNewMessages, 1000);
      setTimeout(fetchNewMessages, 3000);
    } catch (err) {
      console.error('Photo submission error after retries:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    } finally {
      setIsLoading(false);
      scrollToBottom(true);
    }
  };

  const handleResetChat = () => {
    handleSendMessage('/reset');
  };

  // Clears the LOCAL on-device conversation view only — never calls the backend,
  // never touches chat_messages / profile / streak / progress. Distinct from
  // "Restart Onboarding" above, which is a real destructive account reset.
  const handleClearChat = async () => {
    if (phone) {
      await clearCachedMessages(phone);
    }
    setMessages([WELCOME_MESSAGE]);
  };

  // Submit a Pro-only voice message
  const handleSubmitVoice = async (audioBase64: string, mimeType: string) => {
    const tempId = `user-voice-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      text: '🎤 Voice message',
      created_at: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom(true);
    setIsLoading(true);

    const sendFn = () => ShowUpApi.sendMessage({
      body: '',
      audioBase64,
      audioMimeType: mimeType,
    });
    pendingSendersRef.current.set(tempId, sendFn);

    try {
      await sendWithRetry(sendFn);

      pendingSendersRef.current.delete(tempId);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'delivered' } : m))
      );

      setTimeout(fetchNewMessages, 1500);
      setTimeout(fetchNewMessages, 3500);
    } catch (err) {
      console.error('Voice submission error:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    } finally {
      setIsLoading(false);
      scrollToBottom(true);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDarkScheme ? 'light-content' : 'dark-content'} backgroundColor={Colors.bgMain} translucent />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Custom Header with Safe Area insets */}
        <CustomHeader
          onOpenPledgeDrawer={() => setIsPledgeDrawerOpen(true)}
          onOpenUserModal={() => setIsUserModalOpen(true)}
        />

        {/* Message Stream */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              onOpenCheckinCamera={() => {
                setPhotoSheetMode('checkin');
                setInitialPhotoCaption('');
                setIsCameraOpen(true);
              }}
              onImagePress={(url) => setEnlargedImage(url)}
              onRetryMessage={() => handleRetryMessage(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => scrollToBottom(false)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* Floating Input Bar */}
        <FloatingInputBar
          onSendMessage={handleSendMessage}
          onAttachPhoto={(caption) => {
            setPhotoSheetMode('attach');
            setInitialPhotoCaption(caption || '');
            setIsCameraOpen(true);
          }}
          onSubmitVoice={handleSubmitVoice}
          canUseVoice={isPro}
          isLoading={isLoading}
        />

        {/* Camera / Photo Attachment & Check-in Sheet */}
        <CameraProofSheet
          visible={isCameraOpen}
          mode={photoSheetMode}
          initialCaption={initialPhotoCaption}
          onClose={() => setIsCameraOpen(false)}
          onSubmitProof={handleSubmitProof}
        />

        {/* 30-Day Pledge Status Drawer */}
        <PledgeDrawer
          visible={isPledgeDrawerOpen}
          onClose={() => setIsPledgeDrawerOpen(false)}
        />

        {/* Account & Server Config Modal */}
        <UserModal
          visible={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
          onResetChat={handleResetChat}
          onClearChat={handleClearChat}
        />

        {/* Fullscreen Image Preview Modal */}
        <Modal visible={!!enlargedImage} transparent animationType="fade">
          <View style={styles.imageViewerOverlay}>
            <TouchableOpacity
              style={styles.closeImageBtn}
              onPress={() => setEnlargedImage(null)}
            >
              <X size={24} color="#FFF" />
            </TouchableOpacity>
            {enlargedImage && (
              <Image
                source={{ uri: enlargedImage }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const getStyles = (Colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  listContent: {
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
  },
  fullscreenImage: {
    width: '94%',
    height: '80%',
  },
});
