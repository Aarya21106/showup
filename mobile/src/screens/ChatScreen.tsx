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
} from 'react-native';
import { X } from 'lucide-react-native';
import { Colors, Spacing } from '../theme/colors';
import { CustomHeader } from '../components/CustomHeader';
import { MessageBubble } from '../components/MessageBubble';
import { FloatingInputBar } from '../components/FloatingInputBar';
import { CameraProofSheet } from '../components/CameraProofSheet';
import { PledgeDrawer } from '../components/PledgeDrawer';
import { UserModal } from '../components/UserModal';
import { ShowUpApi, ChatMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const ChatScreen: React.FC = () => {
  const { phone, refreshProfile, checkConnection } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoSheetMode, setPhotoSheetMode] = useState<'attach' | 'checkin'>('attach');
  const [initialPhotoCaption, setInitialPhotoCaption] = useState('');
  const [isPledgeDrawerOpen, setIsPledgeDrawerOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Initial welcome message if conversation is blank
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          role: 'model',
          text: 'Hey, I am ShowUp. I will be your daily accountability coach for the next 30 days.\n\nWhat should I call you?',
          created_at: new Date().toISOString(),
          status: 'delivered',
        },
      ]);
    }
  }, []);

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

        const idsToAck = pending.map((m) => Number(m.id)).filter((id) => !isNaN(id));
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

    try {
      await ShowUpApi.sendMessage({ body: text });

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'delivered' } : m))
      );

      // Immediately poll for AI reply
      setTimeout(fetchNewMessages, 600);
      setTimeout(fetchNewMessages, 2000);
      setTimeout(fetchNewMessages, 4000);
    } catch (err: any) {
      console.error('Send error:', err);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-offline-${Date.now()}`,
            role: 'model',
            text: 'Unable to reach backend server. Tap the header to verify your PC IP URL.',
            created_at: new Date().toISOString(),
            status: 'delivered',
          },
        ]);
        scrollToBottom(true);
      }, 1000);
    } finally {
      setIsLoading(false);
      scrollToBottom(true);
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

    try {
      await ShowUpApi.sendMessage({
        body: caption || 'Here is my workout proof',
        imageBase64,
        mimeType: 'image/jpeg',
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'delivered' } : m))
      );

      setTimeout(fetchNewMessages, 1000);
      setTimeout(fetchNewMessages, 3000);
    } catch (err) {
      console.error('Photo submission error:', err);
    } finally {
      setIsLoading(false);
      scrollToBottom(true);
    }
  };

  const handleResetChat = () => {
    handleSendMessage('/reset');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgMain} translucent />

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

const styles = StyleSheet.create({
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
