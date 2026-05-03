import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { GoogleGenAI } from "@google/genai";
import { LinearGradient } from 'expo-linear-gradient';

const apiKey = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

export default function AssistantScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile, ageMonths, vaccinations, medicines, growthHistory } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `Hello! I'm your specialized AI Assistant. I have deep knowledge of ${profile?.name ?? 'your child'}'s current Montessori stage and health milestones. How can I help you today?`,
      sender: 'ai',
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    if (!apiKey) {
      const msg: Message = {
        id: Date.now().toString(),
        text: "API Key is missing. Please configure GEMINI_API_KEY.",
        sender: 'ai',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, msg]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const healthContext = `
        Child Health Data:
        - Vaccinations: ${vaccinations.slice(0, 5).map(v => `${v.name} (${v.isCompleted ? 'Done' : 'Due: ' + new Date(v.dueDate).toLocaleDateString()})`).join(', ')}
        - Current Meds: ${medicines.map(m => m.name).join(', ') || 'None'}
        - Latest Growth: ${growthHistory.length > 0 ? `${growthHistory[growthHistory.length-1].weight}kg, ${growthHistory[growthHistory.length-1].height}cm` : 'No data'}
      `;

      const prompt = `You are a world-class pediatrician and Montessori educator. 
      Context: The parent's child is named ${profile?.name ?? 'Child'}, age ${ageMonths} months.
      ${healthContext}
      Role: Provide encouraging, scientifically accurate, and practical Montessori activity or health advice.
      User Question: ${inputText}
      Keep your answer concise (max 3-4 short paragraphs), formatted with clear points if needed. Be empathetic but professional.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text;

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: text || "I'm sorry, I couldn't generate a response. Please try again.",
        sender: 'ai',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Gemini Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting to the AI brain right now. Please check your connection.",
        sender: 'ai',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ 
        title: 'Parenting Assistant',
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontFamily: 'Inter_700Bold' },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        )
      }} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View 
              key={msg.id} 
              style={[
                styles.messageRow,
                msg.sender === 'user' ? styles.userRow : styles.aiRow
              ]}
            >
              {msg.sender === 'ai' && (
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <Ionicons name="sparkles" size={14} color="white" />
                </View>
              )}
              <View 
                style={[
                  styles.messageContainer, 
                  msg.sender === 'user' ? 
                  [styles.userMessage, { backgroundColor: colors.primary }] : 
                  [styles.aiMessage, { backgroundColor: colors.card, borderColor: colors.border }]
                ]}
              >
                <Text style={[
                  styles.messageText, 
                  { color: msg.sender === 'user' ? 'white' : colors.foreground }
                ]}>
                  {msg.text}
                </Text>
              </View>
            </View>
          ))}
          {isLoading && (
            <View style={[styles.messageRow, styles.aiRow]}>
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Ionicons name="sparkles" size={14} color="white" />
              </View>
              <View style={[styles.messageContainer, styles.aiMessage, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.messageText, { color: colors.foreground, marginLeft: 10, fontStyle: 'italic', fontSize: 14 }]}>Genning answer...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Ask about sleep, food, Montessori..."
            placeholderTextColor={colors.mutedForeground}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: inputText.trim() ? colors.primary : colors.mutedForeground }]} 
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageList: { padding: 20, paddingBottom: 40 },
  messageRow: { flexDirection: 'row', marginBottom: 16, maxWidth: '85%' },
  userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  aiRow: { alignSelf: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 8, marginTop: 4 },
  messageContainer: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  userMessage: {
    borderBottomRightRadius: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 1
  },
  aiMessage: {
    borderBottomLeftRadius: 4,
  },
  messageText: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    fontFamily: 'Inter_400Regular',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4
  },
});
