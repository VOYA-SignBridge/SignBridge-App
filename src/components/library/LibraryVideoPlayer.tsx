import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveQipedcVideoUrl } from '../../../app/utils/QipedcVideoResolver';

export default function LibraryVideoPlayer({ url }: { url: string }) {
  const [attempt, setAttempt] = useState(0);
  return <VideoAttempt key={`${url}-${attempt}`} url={url} onRetry={() => setAttempt(value => value + 1)} />;
}

function VideoAttempt({ url, onRetry }: { url: string; onRetry: () => void }) {
  const [playableUrl, setPlayableUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    resolveQipedcVideoUrl(url).then(resolved => {
      if (active) setPlayableUrl(resolved);
    }).catch(() => {
      if (active) setHasError(true);
    });
    return () => { active = false; };
  }, [url]);

  if (hasError) return <VideoStatus failed onRetry={onRetry} />;
  if (!playableUrl) return <VideoStatus />;
  return <PlayableVideo url={playableUrl} onRetry={onRetry} />;
}

function PlayableVideo({ url, onRetry }: { url: string; onRetry: () => void }) {
  const { colors } = useTheme();
  const player = useVideoPlayer(url, instance => {
    instance.loop = true;
    instance.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  return (
    <View style={[styles.fill, { backgroundColor: colors.controlBG }]}>
      <VideoView style={styles.fill} player={player} contentFit="contain" nativeControls />
      {status === 'error' && <VideoStatus failed onRetry={onRetry} overlay />}
      {(status === 'idle' || status === 'loading') && <VideoStatus overlay />}
    </View>
  );
}

function VideoStatus({ failed = false, overlay = false, onRetry }: {
  failed?: boolean;
  overlay?: boolean;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.status, overlay && StyleSheet.absoluteFillObject, { backgroundColor: colors.controlBG }]}>
      {failed
        ? <Ionicons name="alert-circle-outline" size={30} color={colors.icon} />
        : <ActivityIndicator size="large" color={colors.primary} />}
      <Text style={[styles.message, { color: colors.text }]}>
        {t(failed ? 'library.videoError' : 'library.loadingVideo')}
      </Text>
      {failed && onRetry && (
        <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={[styles.retry, { backgroundColor: colors.primary }]}>
          <Text style={styles.retryText}>{t('library.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  status: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: 'white', fontWeight: '600' },
});
