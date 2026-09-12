import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MOET_DATA } from '../data/dictionaryData'; 
import { resolveQipedcVideoUrl } from '../utils/QipedcVideoResolver';

type DictionaryItem = {
  id: string;
  word: string;
  videoUrl: string; 
};

type RegionFilter = 'Tất cả' | 'Bắc' | 'Trung' | 'Nam' | 'Chung';
type SortOrder = 'AZ' | 'ZA';

export default function AvatarScreen() {
  const { colors: theme } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWord, setSelectedWord] = useState<DictionaryItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterRegion, setFilterRegion] = useState<RegionFilter>('Tất cả');
  const [sortOrder, setSortOrder] = useState<SortOrder>('AZ');
  const [isFocused, setIsFocused] = useState(false);

  const videoUrl = selectedWord?.videoUrl ?? null;

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const getDisplayName = (item: DictionaryItem) => {
    return item.word; 
  };

  const getRegionCode = (id: string): RegionFilter => {
    const lastChar = id.slice(-1).toUpperCase();
    if (lastChar === 'B') return 'Bắc';
    if (lastChar === 'N') return 'Nam';
    if (lastChar === 'T') return 'Trung';
    return 'Chung';
  };

  const filteredData = useMemo(() => {
    let data = MOET_DATA;

    if (searchQuery.trim()) {
      data = data.filter(item => {
        const displayName = getDisplayName(item).toLowerCase();
        return displayName.includes(searchQuery.toLowerCase());
      });
    }

    if (filterRegion !== 'Tất cả') {
      data = data.filter(item => {
        const region = getRegionCode(item.id);
        return region === filterRegion;
      });
    }

    data = [...data].sort((a, b) => {
      const nameA = getDisplayName(a);
      const nameB = getDisplayName(b);
      return sortOrder === 'AZ' 
        ? nameA.localeCompare(nameB) 
        : nameB.localeCompare(nameA);
    });

    return data;
  }, [searchQuery, filterRegion, sortOrder]);

  const handleWordSelect = useCallback((item: DictionaryItem) => {
    InteractionManager.runAfterInteractions(() => {
      setSelectedWord(item);
    });
  }, []);

  const renderItem = ({ item }: { item: DictionaryItem }) => (
    <TouchableOpacity
      style={[
        styles.itemContainer,
        { borderBottomColor: theme.lightGray, backgroundColor: selectedWord?.id === item.id ? theme.controlBG : 'transparent' }
      ]}
      onPress={() => handleWordSelect(item)}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.controlBG }]}>
        <Ionicons name="videocam" size={24} color={theme.primary} />
      </View>
      <Text style={[styles.itemText, { color: theme.text }]}>
        {getDisplayName(item)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      
      <View style={[styles.headerContainer, { borderBottomColor: theme.lightGray }]}>
        <View style={styles.headerRow}>
          <View style={[styles.searchWrapper, { backgroundColor: theme.textInputBG }]}>
            <Ionicons name="search" size={20} color={theme.icon} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Tìm kiếm..."
              placeholderTextColor={theme.icon}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
               <TouchableOpacity onPress={() => { setSearchQuery(''); Keyboard.dismiss(); }}>
                  <Ionicons name="close-circle" size={18} color={theme.icon} />
               </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.filterButton, { backgroundColor: showFilters ? theme.primary : theme.controlBG }]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="options-outline" size={24} color={showFilters ? 'white' : theme.icon} />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filterPanel}>
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: theme.text }]}>Sắp xếp:</Text>
              <View style={styles.chipContainer}>
                <TouchableOpacity
                  style={[styles.chip, { backgroundColor: theme.controlBG }, sortOrder === 'AZ' && { backgroundColor: theme.primary }]}
                  onPress={() => setSortOrder('AZ')}
                >
                  <Text style={[styles.chipText, { color: theme.mediumGray }, sortOrder === 'AZ' && { color: 'white' }]}>A-Z</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, { backgroundColor: theme.controlBG }, sortOrder === 'ZA' && { backgroundColor: theme.primary }]}
                  onPress={() => setSortOrder('ZA')}
                >
                  <Text style={[styles.chipText, { color: theme.mediumGray }, sortOrder === 'ZA' && { color: 'white' }]}>Z-A</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: theme.text }]}>Vùng:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(['Tất cả', 'Bắc', 'Trung', 'Nam', 'Chung'] as RegionFilter[]).map((region) => (
                  <TouchableOpacity 
                    key={region}
                    style={[styles.chip, { backgroundColor: theme.controlBG }, filterRegion === region && { backgroundColor: theme.primary }]}
                    onPress={() => setFilterRegion(region)}
                  >
                    <Text style={[styles.chipText, { color: theme.mediumGray }, filterRegion === region && { color: 'white' }]}>
                      {region}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      <View style={styles.videoSection}>
        {selectedWord ? (
          <View style={[styles.videoWrapper, { backgroundColor: theme.controlBG, borderColor: theme.borderColor }]}>
            {videoUrl && isFocused && <DictVideoSection key={videoUrl} url={videoUrl} />}
            <View style={styles.videoLabel}>
               <Text style={styles.videoLabelText}>{getDisplayName(selectedWord)}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.placeholderBox, { borderColor: theme.lightGray }]}>
             <Text style={{ color: theme.icon }}>Chọn từ để xem</Text>
          </View>
        )}
      </View>

      <View style={styles.listSection}>
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          initialNumToRender={20}
          ListEmptyComponent={
            <View style={{alignItems: 'center', marginTop: 20}}>
                <Text style={{color: theme.icon}}>Không tìm thấy kết quả.</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

function DictVideoSection({ url }: { url: string }) {
  const { colors } = useTheme();
  const [playableUrl, setPlayableUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setPlayableUrl(null);
    setError(null);

    resolveQipedcVideoUrl(url)
      .then((resolvedUrl) => {
        if (isActive) setPlayableUrl(resolvedUrl);
      })
      .catch((reason) => {
        if (isActive) {
          setError(reason instanceof Error ? reason.message : 'Không thể tải video.');
        }
      });

    return () => {
      isActive = false;
    };
  }, [url]);

  const player = useVideoPlayer(playableUrl, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (playableUrl) {
      player.loop = true;
      player.play();
    }
  }, [playableUrl, player]);

  if (error) {
    return (
      <View style={[styles.videoStatus, { backgroundColor: colors.controlBG }]}>
        <Ionicons name="alert-circle-outline" size={30} color={colors.icon} />
        <Text style={[styles.videoStatusText, { color: colors.text }]}>{error}</Text>
      </View>
    );
  }

  if (!playableUrl) {
    return (
      <View style={[styles.videoStatus, { backgroundColor: colors.controlBG }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.videoStatusText, { color: colors.text }]}>Đang tải video...</Text>
      </View>
    );
  }

  return (
    <VideoView style={[styles.video, { backgroundColor: colors.controlBG }]} player={player} contentFit="contain" nativeControls />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  headerContainer: {
    paddingTop: 4,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10, 
  },
  searchWrapper: {
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    height: 44, 
    borderRadius: 12, 
    paddingHorizontal: 12,
  },
  searchInput: { 
    flex: 1, 
    fontSize: 16, 
    height: '100%',
  },
  filterButton: {
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  filterPanel: {
    marginTop: 12,
    padding: 12
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 16, 
    fontWeight: 'bold', 
    width: 80,
  },
  chipContainer: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  videoSection: {
    height: 300, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 16,
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 3,
    position: 'relative',
  },
  video: { 
    width: '100%', 
    height: '100%' 
  },
  videoStatus: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  videoStatusText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  videoLabel: {
    position: 'absolute', 
    bottom: 10, 
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20,
  },
  videoLabelText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  placeholderBox: {
    width: '100%', 
    height: 200, 
    borderWidth: 2, 
    borderStyle: 'dashed', 
    borderRadius: 16,
    justifyContent: 'center', 
    alignItems: 'center',
  },
  listSection: { 
    flex: 1, 
    paddingHorizontal: 16 
  },
  itemContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12,
  },
  itemText: { 
    fontSize: 16, 
    flex: 1 
  },
});
