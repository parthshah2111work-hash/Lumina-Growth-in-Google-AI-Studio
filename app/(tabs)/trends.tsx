import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { TRENDS, TrendItem, CATEGORY_LABELS, TREND_CATEGORIES } from '@/constants/data';
import { LinearGradient } from 'expo-linear-gradient';
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export default function TrendsScreen() {
  const colors = useColors();
  const { profile, ageMonths } = useApp();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [useChildAge, setUseChildAge] = useState(true);
  const [aiTrends, setAiTrends] = useState<TrendItem[]>([]);
  const [isFetchingAi, setIsFetchingAi] = useState(false);

  const filteredTrends = useMemo(() => {
    let list = [...TRENDS, ...aiTrends];
    
    if (useChildAge) {
      list = list.filter(item => 
        ageMonths >= item.minAgeMonths && ageMonths <= item.maxAgeMonths
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter(item => item.category === selectedCategory);
    }

    return list;
  }, [selectedCategory, useChildAge, ageMonths, aiTrends]);

  const fetchAiTrends = async () => {
    if (!apiKey) {
      Alert.alert("API Key Missing", "Please set GEMINI_API_KEY in the environment.");
      return;
    }
    setIsFetchingAi(true);
    try {
      const prompt = `Act as a childcare and developmental expert. Generate 3 real-time trending topics/advice for a parent with a child who is ${ageMonths} months old. 
      For each topic, provide:
      1. A catchy title
      2. A 2-sentence summary
      3. A category (one of: health, development, education, parenting, nutrition)
      4. A mock but realistic-looking URL from a reputable source like 'healthline.com', 'mayoclinic.org', or 'aap.org'.
      
      Format the output as a JSON array of objects with fields: id (unique string), title, description, category, url, source, type (fixed as 'article'), minAgeMonths (${ageMonths-3}), maxAgeMonths (${ageMonths+6}).
      Only return the JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      const cleanedJson = text?.replace(/```json/g, "").replace(/```/g, "").trim() || "[]";
      const parsed: TrendItem[] = JSON.parse(cleanedJson);
      
      setAiTrends(prev => [...parsed, ...prev]);
      Alert.alert("AI Insight", "Found 3 new relevant trends for you!");
    } catch (error) {
      console.error("Gemini Error:", error);
      Alert.alert("Error", "Could not fetch AI trends at this moment.");
    } finally {
      setIsFetchingAi(false);
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      console.error('Error opening browser:', error);
    }
  };

  const renderTrendItem = ({ item }: { item: TrendItem }) => {
    const typeIcons = {
      video: 'play-circle',
      article: 'document-text',
      study: 'analytics',
      material: 'library',
    };

    const isAi = item.id.startsWith('ai-') || item.id.length > 5; // Simple heuristic

    return (
      <TouchableOpacity 
        style={[styles.itemCard, { backgroundColor: colors.card, borderColor: isAi ? colors.accent : colors.border }]}
        onPress={() => handleOpenLink(item.url)}
        activeOpacity={0.7}
      >
        <View style={styles.itemHeader}>
          <View style={[styles.typeBadge, { backgroundColor: colors.accent + '20' }]}>
            <Ionicons name={(isAi ? "sparkles" : typeIcons[item.type] || 'document-text') as any} size={14} color={isAi ? colors.accent : colors.primary} />
            <Text style={[styles.typeText, { color: isAi ? colors.accent : colors.primary }]}>
              {isAi ? "AI INSIGHT" : item.type.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.sourceText, { color: colors.mutedForeground }]}>
            {item.source}
          </Text>
        </View>
        
        <Text style={[styles.itemTitle, { color: colors.foreground }]}>{item.title}</Text>
        <Text style={[styles.itemDescription, { color: colors.mutedForeground }]} numberOfLines={3}>
          {item.description}
        </Text>
        
        <View style={styles.itemFooter}>
          <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.categoryText, { color: colors.primary }]}>
              {CATEGORY_LABELS[item.category] || item.category}
            </Text>
          </View>
          <View style={styles.goButton}>
            <Text style={[styles.goButtonText, { color: colors.primary }]}>Explore</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <LinearGradient colors={[colors.primary, colors.background]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Trend & Study</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
              Curated for {profile?.name ?? 'your child'}'s growth
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.aiFetchBtn, { backgroundColor: colors.accent }]}
            onPress={fetchAiTrends}
            disabled={isFetchingAi}
          >
            {isFetchingAi ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="white" />
                <Text style={styles.aiFetchText}>Real-time AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.filterSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.categoryList}
        >
          {['all', ...TREND_CATEGORIES].map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.categoryChip,
                { 
                  backgroundColor: selectedCategory === cat ? colors.primary : colors.card,
                  borderColor: selectedCategory === cat ? colors.primary : colors.border
                }
              ]}
            >
              <Text style={[
                styles.categoryChipText,
                { color: selectedCategory === cat ? "white" : colors.foreground }
              ]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.ageToggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleBtn, useChildAge && { backgroundColor: colors.primary + '10' }]}
            onPress={() => setUseChildAge(!useChildAge)}
          >
            <Ionicons 
              name={useChildAge ? "checkmark-circle" : "ellipse-outline"} 
              size={20} 
              color={useChildAge ? colors.primary : colors.mutedForeground} 
            />
            <Text style={[styles.toggleText, { color: colors.foreground }]}>
              Age-relevant for {profile?.name ?? 'Child'} ({ageMonths}m)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredTrends}
        renderItem={renderTrendItem}
        keyExtractor={(item, index) => item.id + index}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No trends found. Try "Real-time AI" above!
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  aiFetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  aiFetchText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  filterSection: {
    marginBottom: 10,
  },
  categoryList: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  ageToggleContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  toggleText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  itemCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      }
    }),
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    marginLeft: 4,
  },
  sourceText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  itemTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  itemDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: 'Inter_400Regular',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  goButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginRight: 4,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
});
