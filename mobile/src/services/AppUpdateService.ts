import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { serverConfigService } from './ServerConfigService';

export interface AppReleaseNoteItem {
  icon: string;
  title: string;
  description: string;
}

export interface AppUpdateInfo {
  version: string;
  buildNumber: number;
  releaseTitle: string;
  releaseNotes: AppReleaseNoteItem[];
  releaseDate: string;
  downloadSize: string;
  isMandatory: boolean;
  storeUrl?: string;
  apkDownloadUrl?: string;
}

export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up_to_date';

const STORAGE_KEY_DISMISSED_VERSION = '@carering_app_update_dismissed_version';
const STORAGE_KEY_DISMISSED_TIME = '@carering_app_update_dismissed_time';

// Default metadata matches current installed version (1.0.5 / build 9)
// Update banner will only show when a remote or simulated release is higher
export const LATEST_RELEASE_INFO: AppUpdateInfo = {
  version: Constants.expoConfig?.version || '1.0.5',
  buildNumber: Number(Constants.expoConfig?.android?.versionCode || 9),
  releaseTitle: 'CareRing 1.0.5 — Precision 3D Maps & UI Uniformity',
  releaseNotes: [
    {
      icon: 'sync-circle',
      title: '2-Finger Map Rotation & Compass',
      description: 'Rotate the map view naturally with two fingers with automatic True-North snap and animated compass indicator.',
    },
    {
      icon: 'shapes',
      title: 'Consistent Rounded Square UI',
      description: 'Harmonized map controls and action buttons across all views into an ergonomic rounded square design.',
    },
    {
      icon: 'map',
      title: 'Relocated Map Layers Picker',
      description: 'Quickly preview High-Res Satellite, Topographic, and Outdoor styles with intuitive top-right floating access.',
    },
    {
      icon: 'people',
      title: 'Multi-Person Cluster Callouts',
      description: 'Group clustering pins with member preview avatars, status callouts, and pointer tails.',
    },
    {
      icon: 'shield-checkmark',
      title: 'Emergency SOS & Siren Controls',
      description: 'High-priority dispatch channel with siren audio service, volume boost, and audible alert preferences.',
    },
  ],
  releaseDate: 'October 2026',
  downloadSize: '28.4 MB',
  isMandatory: false,
  storeUrl:
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/carering/id644000000'
      : 'https://play.google.com/store/apps/details?id=com.carering.app',
  apkDownloadUrl: 'https://care-ring.netlify.app/download/CareRing-v1.0.5.apk',
};

class AppUpdateService {
  private currentVersion: string = Constants.expoConfig?.version || '1.0.5';
  private currentBuild: number = Number(Constants.expoConfig?.android?.versionCode || 9);

  private state: UpdateState = 'idle';
  private updateInfo: AppUpdateInfo | null = null;
  private isSimulated: boolean = false;
  private isBannerVisible: boolean = false;
  private isModalVisible: boolean = false;
  private downloadProgress: number = 0; // 0 to 100
  private listeners: Set<() => void> = new Set();
  private downloadInterval: any = null;

  constructor() {
    this.updateInfo = LATEST_RELEASE_INFO;
  }

  public getCurrentVersion(): string {
    return this.currentVersion;
  }

  public getCurrentBuild(): number {
    return this.currentBuild;
  }

  public getState(): UpdateState {
    return this.state;
  }

  public getUpdateInfo(): AppUpdateInfo | null {
    return this.updateInfo;
  }

  public getIsBannerVisible(): boolean {
    return this.isBannerVisible;
  }

  public getIsModalVisible(): boolean {
    return this.isModalVisible;
  }

  public getDownloadProgress(): number {
    return this.downloadProgress;
  }

  public isSimulatingUpdate(): boolean {
    return this.isSimulated;
  }

  public async clearSnooze(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY_DISMISSED_VERSION);
    await AsyncStorage.removeItem(STORAGE_KEY_DISMISSED_TIME);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.warn('[AppUpdateService] Listener error:', err);
      }
    });
  }

  /**
   * Robust Semantic Version Comparison:
   * Strips 'v', build metadata ('-beta'), etc.
   * Returns > 0 if vA > vB, < 0 if vA < vB, 0 if equal.
   */
  public compareVersions(vA: string, vB: string): number {
    const cleanA = (vA || '').replace(/^v/i, '').split('-')[0].trim();
    const cleanB = (vB || '').replace(/^v/i, '').split('-')[0].trim();
    const partsA = cleanA.split('.').map((p) => parseInt(p, 10) || 0);
    const partsB = cleanB.split('.').map((p) => parseInt(p, 10) || 0);
    const maxLen = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < maxLen; i++) {
      const a = partsA[i] || 0;
      const b = partsB[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  /**
   * Checks if an update is available comparing target release vs current installed app version & build
   */
  public isUpdateAvailable(targetInfo: AppUpdateInfo | null = this.updateInfo): boolean {
    if (!targetInfo) return false;
    const semverDiff = this.compareVersions(targetInfo.version, this.currentVersion);
    if (semverDiff > 0) return true;
    if (semverDiff === 0 && Number(targetInfo.buildNumber || 0) > this.currentBuild) return true;
    return false;
  }

  /**
   * Check for updates on startup or manual trigger.
   * The update banner ONLY shows when ALL proper conditions are satisfied:
   * 1. Target version is strictly newer than current installed version (or higher build number).
   * 2. The update has not been dismissed/snoozed within the last 24 hours (unless forceManual or isMandatory).
   * 3. Network check succeeds or simulated update mode is active.
   */
  public async checkForUpdates(forceManual: boolean = false): Promise<{
    hasUpdate: boolean;
    updateInfo: AppUpdateInfo | null;
  }> {
    this.state = 'checking';
    this.notify();

    // If developer simulation is active, preserve simulation
    if (!this.isSimulated) {
      try {
        const httpBase = serverConfigService.getActiveHttpUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(`${httpBase}/api/app/version`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const remoteData = await response.json();
          if (remoteData?.version) {
            this.updateInfo = {
              version: remoteData.version,
              buildNumber: Number(remoteData.buildNumber || 0),
              releaseTitle: remoteData.releaseTitle || `CareRing ${remoteData.version}`,
              releaseNotes: remoteData.releaseNotes || LATEST_RELEASE_INFO.releaseNotes,
              releaseDate: remoteData.releaseDate || 'October 2026',
              downloadSize: remoteData.downloadSize || '28.4 MB',
              isMandatory: Boolean(remoteData.isMandatory),
              storeUrl: remoteData.storeUrl || LATEST_RELEASE_INFO.storeUrl,
              apkDownloadUrl: remoteData.apkDownloadUrl || LATEST_RELEASE_INFO.apkDownloadUrl,
            };
          }
        }
      } catch {
        // Network timeout / offline: fall back to current known release
      }
    }

    const target = this.updateInfo || LATEST_RELEASE_INFO;
    const hasNewerVersion = this.isUpdateAvailable(target);

    // Condition 1: If current app version is equal or newer, DO NOT show banner
    if (!hasNewerVersion) {
      this.state = 'up_to_date';
      this.isBannerVisible = false;
      this.notify();
      return { hasUpdate: false, updateInfo: null };
    }

    this.state = 'available';

    // Condition 2: Check if dismissed previously within 24 hours (snooze)
    if (!forceManual && !target.isMandatory) {
      const dismissedVer = await AsyncStorage.getItem(STORAGE_KEY_DISMISSED_VERSION);
      const dismissedTime = await AsyncStorage.getItem(STORAGE_KEY_DISMISSED_TIME);

      if (dismissedVer === target.version && dismissedTime) {
        const timeDiff = Date.now() - parseInt(dismissedTime, 10);
        // Snooze for 24 hours (86,400,000 ms)
        if (timeDiff < 24 * 60 * 60 * 1000) {
          this.isBannerVisible = false;
          this.notify();
          return { hasUpdate: true, updateInfo: target };
        }
      }
    }

    // Condition 3: Version is newer and not snoozed -> show banner!
    this.isBannerVisible = true;
    if (forceManual || target.isMandatory) {
      this.isModalVisible = true;
    }

    this.notify();
    return { hasUpdate: true, updateInfo: target };
  }

  /**
   * Test/Demo helper: simulate an update availability for verification
   */
  public simulateUpdate(enable: boolean = true): void {
    this.isSimulated = enable;
    if (enable) {
      this.updateInfo = {
        ...LATEST_RELEASE_INFO,
        version: '1.0.5',
        buildNumber: 9,
        releaseTitle: 'CareRing 1.0.5 — Precision 3D Maps & Silky Motion',
        releaseNotes: [
          {
            icon: 'sync-circle',
            title: '2-Finger Map Rotation',
            description: 'Rotate the map view naturally with two fingers just like Google Maps, with automatic True-North snap and compass sync.',
          },
          {
            icon: 'map',
            title: 'Enhanced Map Styles Picker',
            description: 'Quickly preview High-Res Satellite, Topographic, and Outdoor styles with real-time background switching.',
          },
          {
            icon: 'cloud-offline',
            title: 'Offline Tile Engine v2',
            description: 'Blazing fast offline raster caching with intelligent multi-zoom tile prefetching and zero battery drain.',
          },
        ],
      };
      this.state = 'available';
      this.isBannerVisible = true;
    } else {
      this.updateInfo = {
        ...LATEST_RELEASE_INFO,
        version: this.currentVersion,
        buildNumber: this.currentBuild,
      };
      this.state = 'up_to_date';
      this.isBannerVisible = false;
      this.isModalVisible = false;
    }
    this.notify();
  }

  /**
   * Dismiss the banner (snooze for 24 hours)
   */
  public async dismissBanner(): Promise<void> {
    this.isBannerVisible = false;
    if (this.updateInfo) {
      await AsyncStorage.setItem(STORAGE_KEY_DISMISSED_VERSION, this.updateInfo.version);
      await AsyncStorage.setItem(STORAGE_KEY_DISMISSED_TIME, Date.now().toString());
    }
    this.notify();
  }

  /**
   * Open the detailed update modal
   */
  public openUpdateModal(): void {
    this.isModalVisible = true;
    this.notify();
  }

  /**
   * Close the detailed update modal (if not mandatory)
   */
  public closeUpdateModal(): void {
    if (this.updateInfo?.isMandatory) return; // Cannot dismiss mandatory update
    this.isModalVisible = false;
    this.notify();
  }

  /**
   * Starts downloading and applying the update
   */
  public startDownload(): void {
    if (this.state === 'downloading') return;

    this.state = 'downloading';
    this.downloadProgress = 0;
    this.notify();

    if (this.downloadInterval) {
      clearInterval(this.downloadInterval);
    }

    // Realistic progressive download simulation
    this.downloadInterval = setInterval(() => {
      this.downloadProgress += Math.floor(Math.random() * 9) + 6; // +6% to +14% per tick
      if (this.downloadProgress >= 100) {
        this.downloadProgress = 100;
        clearInterval(this.downloadInterval);
        this.downloadInterval = null;
        this.state = 'ready';
        this.notify();
      } else {
        this.notify();
      }
    }, 280);
  }

  /**
   * Trigger external store / APK update or finish installation
   */
  public async installOrOpenStore(): Promise<void> {
    if (this.state === 'ready') {
      // Simulate app bundle reload
      this.state = 'up_to_date';
      this.currentVersion = this.updateInfo?.version || '1.0.5';
      this.currentBuild = this.updateInfo?.buildNumber || 9;
      this.isBannerVisible = false;
      this.isModalVisible = false;
      this.notify();
      return;
    }

    const url =
      Platform.OS === 'ios'
        ? this.updateInfo?.storeUrl
        : this.updateInfo?.apkDownloadUrl || this.updateInfo?.storeUrl;

    if (url) {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        }
      } catch (err) {
        console.warn('[AppUpdateService] Could not open store URL:', err);
      }
    }

    // Also trigger in-app download
    this.startDownload();
  }
}

export const appUpdateService = new AppUpdateService();
