import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  Platform,
  Keyboard,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MOET_DATA } from '@/data/dictionaryData'; 

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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filterRegion, setFilterRegion] = useState<RegionFilter>('Tất cả');
  const [sortOrder, setSortOrder] = useState<SortOrder>('AZ');

  const player = useVideoPlayer(null, (player) => {
    player.loop = true;
  });

  useEffect(() => {
    if (videoUrl) {
      const source = { 
        uri: videoUrl,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://qipedc.moet.gov.vn/'
        }
      };
      if (player.replaceAsync) {
        player.replaceAsync(source);
      } else {
        player.replace(source);
      }
      player.play();
    } else {
      player.pause();
    }
  }, [videoUrl, player]);

  useEffect(() => {
    if (selectedWord) {
        setVideoUrl(selectedWord.videoUrl);
    }
  }, [selectedWord]);

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

  const renderItem = ({ item }: { item: DictionaryItem }) => (
    <TouchableOpacity 
      style={[
        styles.itemContainer, 
        { borderBottomColor: theme.lightGray, backgroundColor: selectedWord?.id === item.id ? theme.controlBG : 'transparent' }
      ]}
      onPress={() => setSelectedWord(item)}
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
                  style={[styles.chip, sortOrder === 'AZ' && { backgroundColor: theme.primary }]}
                  onPress={() => setSortOrder('AZ')}
                >
                  <Text style={[styles.chipText, sortOrder === 'AZ' && { color: 'white' }]}>A-Z</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.chip, sortOrder === 'ZA' && { backgroundColor: theme.primary }]}
                  onPress={() => setSortOrder('ZA')}
                >
                  <Text style={[styles.chipText, sortOrder === 'ZA' && { color: 'white' }]}>Z-A</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterRow}>
              <Text style={[styles.filterLabel, { color: theme.text }]}>Vùng:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(['Tất cả', 'Bắc', 'Trung', 'Nam', 'Chung'] as RegionFilter[]).map((region) => (
                  <TouchableOpacity 
                    key={region}
                    style={[styles.chip, filterRegion === region && { backgroundColor: theme.primary }]}
                    onPress={() => setFilterRegion(region)}
                  >
                    <Text style={[styles.chipText, filterRegion === region && { color: 'white' }]}>
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
          <View style={styles.videoWrapper}>
            <VideoView
              style={styles.video}
              player={player}
              contentFit="contain"
              allowsPictureInPicture
              nativeControls={true} 
            />
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

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  headerContainer: {
    paddingTop: Platform.OS === 'android' ? 50 : 20, 
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
    backgroundColor: '#e0e0e0', 
    marginRight: 10,
  },
  chipText: { 
    fontSize: 14, 
    fontWeight: '500',
    color: '#333' 
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
    backgroundColor: '#687076', 
    borderWidth: 2,         
    borderColor: '#687076',
    elevation: 5,
    position: 'relative',
  },
  video: { 
    width: '100%', 
    height: '100%' 
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