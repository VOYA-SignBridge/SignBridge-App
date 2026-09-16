import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import LibraryVideoPlayer from '@/components/library/LibraryVideoPlayer';
import {
  ALPHABET_LIBRARY, filterLibraryItems,
  type LibraryCategory, type LibraryItem, type RegionFilter, type SortOrder,
} from '../data/libraryData';

const REGION_KEYS: Record<RegionFilter, string> = {
  'Tất cả': 'all', 'Bắc': 'north', 'Trung': 'central', 'Nam': 'south', 'Chung': 'common',
};

export default function DictionaryScreen() {
  const { colors: theme } = useTheme();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();

  const [category, setCategory] = useState<LibraryCategory>('vocabulary');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWord, setSelectedWord] = useState<LibraryItem | null>(null);
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

  const filteredData = useMemo(
    () => filterLibraryItems(category, searchQuery, filterRegion, sortOrder),
    [category, searchQuery, filterRegion, sortOrder],
  );
  const readyAlphabetCount = ALPHABET_LIBRARY.filter(item => item.videoUrl).length;

  const switchCategory = (next: LibraryCategory) => {
    if (category === next) return;
    setCategory(next);
    setSelectedWord(null);
    setSearchQuery('');
    setShowFilters(false);
    Keyboard.dismiss();
  };

  const handleWordSelect = useCallback((item: LibraryItem) => {
    Keyboard.dismiss();
    setSelectedWord(item);
  }, []);

  const renderItem = ({ item }: { item: LibraryItem }) => category === 'alphabet' ? (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: selectedWord?.id === item.id }}
      accessibilityLabel={`${item.word}, ${t(item.videoUrl ? 'library.available' : 'library.unavailable')}`}
      style={[
        styles.letterTile,
        { backgroundColor: selectedWord?.id === item.id ? theme.primary : theme.controlBG,
          borderColor: selectedWord?.id === item.id ? theme.primary : theme.borderColor },
      ]}
      onPress={() => handleWordSelect(item)}
    >
      <Text style={[styles.letterText, { color: selectedWord?.id === item.id ? 'white' : theme.text }]}>{item.word}</Text>
      <Ionicons name={item.videoUrl ? 'play-circle-outline' : 'time-outline'} size={18}
        color={selectedWord?.id === item.id ? 'white' : theme.icon} />
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: selectedWord?.id === item.id }}
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
        {item.word}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

      <View style={[styles.headerContainer, { borderBottomColor: theme.lightGray }]}>
        <Text style={[styles.title, { color: theme.text }]}>{t('library.title')}</Text>
        <View style={[styles.categoryBar, { backgroundColor: theme.controlBG }]}>
          {(['vocabulary', 'alphabet'] as LibraryCategory[]).map(value => (
            <TouchableOpacity key={value} accessibilityRole="tab" accessibilityState={{ selected: category === value }}
              onPress={() => switchCategory(value)}
              style={[styles.categoryButton, category === value && { backgroundColor: theme.primary }]}>
              <Ionicons name={value === 'alphabet' ? 'hand-left-outline' : 'book-outline'} size={18}
                color={category === value ? 'white' : theme.icon} />
              <Text style={[styles.categoryText, { color: category === value ? 'white' : theme.text }]}>
                {t(`library.${value}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.headerRow}>
          <View style={[styles.searchWrapper, { backgroundColor: theme.textInputBG }]}>
            <Ionicons name="search" size={20} color={theme.icon} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={t(category === 'alphabet' ? 'library.searchAlphabet' : 'library.searchVocabulary')}
              placeholderTextColor={theme.icon}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
               <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('library.clearSearch')}
                 onPress={() => { setSearchQuery(''); Keyboard.dismiss(); }}>
                  <Ionicons name="close-circle" size={18} color={theme.icon} />
               </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('library.filters')}
            accessibilityState={{ expanded: showFilters }}
            style={[styles.filterButton, { backgroundColor: showFilters ? theme.primary : theme.controlBG }]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="options-outline" size={24} color={showFilters ? 'white' : theme.icon} />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filterPanel}>
            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: theme.text }]}>{t('library.sort')}</Text>
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

            {category === 'vocabulary' && <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: theme.text }]}>{t('library.region')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(['Tất cả', 'Bắc', 'Trung', 'Nam', 'Chung'] as RegionFilter[]).map((region) => (
                  <TouchableOpacity
                    key={region}
                    style={[styles.chip, { backgroundColor: theme.controlBG }, filterRegion === region && { backgroundColor: theme.primary }]}
                    onPress={() => setFilterRegion(region)}
                  >
                    <Text style={[styles.chipText, { color: theme.mediumGray }, filterRegion === region && { color: 'white' }]}>
                      {t(`library.regions.${REGION_KEYS[region]}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>}
          </View>
        )}
      </View>

      <View style={[styles.videoSection, { height: Math.min(280, height * (showFilters ? 0.22 : 0.28)) }]}>
        {selectedWord ? (
          <View style={[styles.videoWrapper, { backgroundColor: theme.controlBG, borderColor: theme.borderColor }]}>
            {videoUrl ? (
              isFocused && <LibraryVideoPlayer key={videoUrl} url={videoUrl} />
            ) : (
              <View style={styles.videoStatus}>
                <Ionicons name="time-outline" size={32} color={theme.icon} />
                <Text style={[styles.videoStatusText, { color: theme.text }]}>{t('library.unavailable')}</Text>
                <Text style={[styles.videoStatusText, { color: theme.icon }]}>{t('library.pendingVideo', { letter: selectedWord.word })}</Text>
              </View>
            )}
            <View pointerEvents="none" style={styles.videoLabel}>
               <Text style={styles.videoLabelText}>{selectedWord.word}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.placeholderBox, { borderColor: theme.lightGray }]}>
             <Ionicons name={category === 'alphabet' ? 'hand-left-outline' : 'videocam-outline'} size={32} color={theme.icon} />
             <Text style={{ color: theme.icon }}>{t(category === 'alphabet' ? 'library.selectLetter' : 'library.selectWord')}</Text>
          </View>
        )}
      </View>

      <View style={styles.listSection}>
        <Text style={[styles.resultCount, { color: theme.icon }]}>
          {category === 'alphabet'
            ? t('library.alphabetCount', { count: filteredData.length, ready: readyAlphabetCount, total: ALPHABET_LIBRARY.length })
            : t('library.vocabularyCount', { count: filteredData.length })}
        </Text>
        <FlatList
          key={category}
          numColumns={category === 'alphabet' ? 4 : 1}
          data={filteredData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          initialNumToRender={20}
          extraData={selectedWord?.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={{alignItems: 'center', marginTop: 20}}>
                <Text style={{color: theme.icon}}>{t('library.noResults')}</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  categoryBar: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 12 },
  categoryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 9 },
  categoryText: { fontSize: 15, fontWeight: '600' },
  resultCount: { fontSize: 13, marginBottom: 8 },
  letterTile: { flex: 1, maxWidth: '23%', marginHorizontal: '1%', marginBottom: 10, minHeight: 84, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
  letterText: { fontSize: 30, fontWeight: '700' },
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
    top: 10,
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
    height: '100%',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
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
